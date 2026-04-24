/**
 * BotService — Servicio principal del bot de registro ciudadano.
 *
 * Implementa una FSM (Finite State Machine) para guiar al ciudadano
 * a través del proceso de registro vía WhatsApp.
 *
 * Estados FSM:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  NAME → NEIGHBORHOOD → INTERESTS → COMPLETED                   │
 * │                                                                 │
 * │  • NAME         → esperando nombre completo del ciudadano       │
 * │  • NEIGHBORHOOD → esperando selección de colonia/barrio         │
 * │  • INTERESTS    → esperando selección de temas de interés       │
 * │  • COMPLETED    → registro finalizado, mensajes solo persisten  │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * El estado se persiste en Redis (ioredis) con TTL de 24 horas.
 * Los datos permanentes se guardan en PostgreSQL via Prisma.
 *
 * Supuesto: La llamada real a la API de Meta para enviar mensajes
 * está marcada con TODO — requiere credenciales reales en .env.
 */
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { WhatsAppWebhookPayload, WhatsAppTextMessage } from '../config/types';
import { normalizePhone } from '../utils/hmac.util';
import { ConversationStatus, LeadStatus, MessageDirection, SourceChannel } from '@prisma/client';

// ─── Estados de la FSM ────────────────────────────────────────────────────────

/**
 * Estados posibles del bot de registro.
 * Se persisten en Redis bajo la clave bot:session:{phone}
 */
export enum BotFsmState {
  /** Estado inicial — ciudadano nuevo o sin sesión activa en Redis */
  NAME = 'NAME',
  /** Esperando nombre completo del ciudadano */
  NEIGHBORHOOD = 'NEIGHBORHOOD',
  /** Esperando elección de colonia/barrio */
  INTERESTS = 'INTERESTS',
  /** Esperando selección de temas de interés */
  AWAITING_INTERESTS = 'AWAITING_INTERESTS',
  /** Esperando selección de temas de interés */
  COMPLETED = 'COMPLETED',
}

/**
 * Datos de sesión serializados en Redis.
 * Permite persistir contexto parcial durante el flujo de registro.
 */
export interface BotSession {
  state: BotFsmState;
  name?: string;
  lastName?: string;
  neighborhoodId?: string;
  interests?: string[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Tiempo de vida de la sesión en Redis: 24 horas */
const SESSION_TTL_SECONDS = 60 * 60 * 24;

/** Genera la clave de Redis para la sesión de un número de teléfono */
const sessionKey = (phone: string): string => `bot:session:${phone}`;

/** Mapa de índice → slug de interés para el menú de selección */
const INTEREST_MAP: Record<number, string> = {
  1: 'agua_servicios',
  2: 'seguridad_publica',
  3: 'obras_pavimentacion',
  4: 'salud_bienestar',
  5: 'educacion',
  6: 'medio_ambiente',
  7: 'tramites_gestiones',
};

// ─── BotService ───────────────────────────────────────────────────────────────

export class BotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Punto de entrada del webhook ──────────────────────────────────────────

  /**
   * Procesa el payload completo del webhook de WhatsApp.
   * Extrae los mensajes de texto y los rutea al handler de FSM.
   *
   * @param payload - Payload completo enviado por Meta
   */
  async handleWebhookPayload(payload: WhatsAppWebhookPayload): Promise<void> {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;

        const messages: WhatsAppTextMessage[] = change.value?.messages ?? [];

        for (const msg of messages) {
          // Solo procesamos mensajes de texto por ahora
          // TODO: Agregar soporte para mensajes de voz, imagen, etc.
          if (msg.type !== 'text' || !msg.text?.body) {
            console.debug(`[BotService] Ignorando mensaje tipo: ${msg.type}`);
            continue;
          }

          const phone = normalizePhone(msg.from);
          const text = msg.text.body.trim();
          const waMessageId = msg.id;

          console.log(`[BotService] Mensaje de ${phone}: "${text.substring(0, 60)}"`);

          try {
            await this.handleMessage(phone, text, waMessageId);
          } catch (err) {
            console.error(`[BotService] Error procesando mensaje de ${phone}:`, err);
          }
        }
      }
    }
  }

  // ─── Router de estados FSM ─────────────────────────────────────────────────

  /**
   * Punto de entrada para procesar un mensaje de texto de un ciudadano.
   * Lee la sesión de Redis y rutea al handler del estado actual.
   *
   * @param phone       - Número en formato E.164 (ej: +521234567890)
   * @param text        - Texto del mensaje
   * @param waMessageId - ID único del mensaje en WhatsApp
   */
  async handleMessage(phone: string, text: string, waMessageId: string): Promise<void> {
    const session = await this.getSession(phone);

    switch (session.state) {
      case BotFsmState.NAME:
        await this.handleNameState(phone, text, waMessageId, session);
        break;

      case BotFsmState.NEIGHBORHOOD:
        await this.handleNeighborhoodState(phone, text, waMessageId, session);
        break;

      case BotFsmState.INTERESTS:
        await this.handleInterestsState(phone, text, waMessageId, session);
        break;

      case BotFsmState.AWAITING_INTERESTS:
        await this.handleAwaitingInterestsState(phone, text);
        break;

      case BotFsmState.COMPLETED:
        // Ciudadano ya registrado — solo persiste el mensaje y espera derivación
        await this.persistInboundMessage(phone, text, waMessageId);
        // TODO: Derivar a departamento según keywords o intereses del ciudadano
        break;

      default: {
        // Estado desconocido — reset defensivo a NAME
        const unknownState = session.state as string;
        console.warn(`[BotService] Estado FSM desconocido: ${unknownState}, reiniciando`);
        await this.advanceState(phone, BotFsmState.NAME);
        await this.handleNameState(phone, text, waMessageId, { state: BotFsmState.NAME });
      }
    }
  }

  // ─── Handlers por estado ──────────────────────────────────────────────────

  /**
   * Estado NAME: primer contacto del ciudadano.
   * Verifica si ya existe en DB; si no, inicia el registro y pide nombre.
   */
  private async handleNameState(
    phone: string,
    _text: string,
    _waMessageId: string,
    _session: BotSession,
  ): Promise<void> {
    const existing = await this.prisma.citizen.findUnique({ where: { phone } });

    if (existing?.leadStatus === LeadStatus.converted) {
      // Ya registrado — saltar a COMPLETED
      await this.saveResponse(phone, BotFsmState.COMPLETED, {});
      this.sendMessage(
        phone,
        `¡Bienvenido de vuelta, ${existing.name ?? 'ciudadano'}! ¿En qué podemos ayudarte?`,
      );
      return;
    }

    // Ciudadano nuevo — crear registro pendiente en DB
    await this.prisma.citizen.upsert({
      where: { phone },
      update: {},
      create: { phone, leadStatus: LeadStatus.new, sourceChannel: SourceChannel.whatsapp },
    });

    // Avanzar al siguiente estado
    await this.advanceState(phone, BotFsmState.NEIGHBORHOOD);

    this.sendMessage(
      phone,
      '👋 ¡Hola! Bienvenido a *Voz Ciudadana*, el canal oficial del municipio.\n\n' +
        '¿Cuál es tu nombre completo?',
    );
  }

  /**
   * Estado NEIGHBORHOOD: guarda el nombre y pide la colonia.
   * Valida que el nombre tenga al menos nombre + apellido.
   */
  private async handleNeighborhoodState(
    phone: string,
    text: string,
    _waMessageId: string,
    _session: BotSession,
  ): Promise<void> {
    const name = text.trim();

    // Validación mínima: al menos 2 palabras
    if (name.split(/\s+/).filter(Boolean).length < 2) {
      this.sendMessage(phone, 'Por favor ingresá tu nombre completo (nombre y apellido).');
      return;
    }

    const [firstName, ...lastNames] = name.split(/\s+/).filter(Boolean);

    // Guardar nombre en DB
    await this.prisma.citizen.update({
      where: { phone },
      data: { name: firstName, lastName: lastNames.join(' ') || null },
    });

    // Cargar colonias/barrios disponibles
    const neighborhoods = await this.prisma.neighborhood.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const list = neighborhoods.map((n, i) => `${i + 1}. ${n.name}`).join('\n');

    // Guardar respuesta parcial en sesión Redis
    await this.saveResponse(phone, BotFsmState.INTERESTS, {
      name: firstName,
      lastName: lastNames.join(' ') || undefined,
    });

    this.sendMessage(
      phone,
      `¡Gracias, ${name}! 🏘️\n\n¿En qué colonia vivís?\nRespondé con el número:\n\n${list}`,
    );
  }

  /**
   * Estado INTERESTS: guarda la colonia y pide los temas de interés.
   * Acepta el número de índice de la lista mostrada en NEIGHBORHOOD.
   */
  private async handleInterestsState(
    phone: string,
    text: string,
    _waMessageId: string,
    _session: BotSession,
  ): Promise<void> {
    const neighborhoods = await this.prisma.neighborhood.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const index = parseInt(text.trim(), 10);
    const selected = !isNaN(index) ? neighborhoods[index - 1] : undefined;

    if (!selected) {
      const list = neighborhoods.map((n, i) => `${i + 1}. ${n.name}`).join('\n');
      this.sendMessage(
        phone,
        `No reconocí esa opción. Respondé con el número de tu colonia:\n\n${list}`,
      );
      return;
    }

    // Guardar colonia/barrio en DB
    await this.prisma.citizen.update({
      where: { phone },
      data: { neighborhoodId: selected.id, neighborhood: selected.name },
    });

    // Avanzar estado con colonia guardada
    await this.saveResponse(phone, BotFsmState.AWAITING_INTERESTS, {
      neighborhoodId: selected.id,
    });

    const options = Object.entries(INTEREST_MAP)
      .map(([k, v]) => `${k}. ${v.replace(/_/g, ' ')}`)
      .join('\n');

    this.sendMessage(
      phone,
      `✅ Colonia *${selected.name}* registrada.\n\n` +
        `¿Qué temas te interesan? Respondé con los números separados por coma (ej: 1,3):\n\n${options}`,
    );
  }

  /**
   * Estado AWAITING_INTERESTS: guarda temas de interés y marca al ciudadano como ACTIVE.
   */
  private async handleAwaitingInterestsState(phone: string, text: string): Promise<void> {
    const selectedInterests = text
      .split(',')
      .map((v) => parseInt(v.trim(), 10))
      .filter((v) => Number.isInteger(v) && INTEREST_MAP[v])
      .map((v) => INTEREST_MAP[v]);

    const uniqueInterests = [...new Set(selectedInterests)];

    if (uniqueInterests.length === 0) {
      const options = Object.entries(INTEREST_MAP)
        .map(([k, v]) => `${k}. ${v.replace(/_/g, ' ')}`)
        .join('\n');
      this.sendMessage(
        phone,
        `No reconocí esos temas. Respondé con números separados por coma (ej: 1,3):\n\n${options}`,
      );
      return;
    }

    await this.prisma.citizen.update({
      where: { phone },
      data: {
        interests: uniqueInterests,
        leadStatus: LeadStatus.converted,
      },
    });

    await this.advanceState(phone, BotFsmState.COMPLETED);

    this.sendMessage(
      phone,
      '🎉 ¡Registro completado! Ya podés enviarnos reportes o solicitudes y te vamos a responder por este medio.',
    );
  }

  // ─── Helpers de sesión ────────────────────────────────────────────────────

  /**
   * Leer la sesión FSM desde Redis.
   * Si no existe, retorna estado inicial NAME.
   *
   * @param phone - Número en formato E.164
   */
  async getSession(phone: string): Promise<BotSession> {
    const raw = await this.redis.get(sessionKey(phone));
    if (!raw) return { state: BotFsmState.NAME };

    try {
      return JSON.parse(raw) as BotSession;
    } catch {
      console.warn(`[BotService] Sesión corrupta para ${phone}, reiniciando`);
      return { state: BotFsmState.NAME };
    }
  }

  /**
   * Avanzar el estado FSM en Redis.
   * Solo actualiza el campo `state`, preservando el resto de la sesión.
   *
   * @param phone     - Número en formato E.164
   * @param nextState - Nuevo estado a establecer
   */
  async advanceState(phone: string, nextState: BotFsmState): Promise<void> {
    const current = await this.getSession(phone);
    await this.redis.set(
      sessionKey(phone),
      JSON.stringify({ ...current, state: nextState }),
      SESSION_TTL_SECONDS,
    );
  }

  /**
   * Guardar respuesta parcial y avanzar estado en un solo paso.
   * Útil para guardar datos del ciudadano y transicionar simultáneamente.
   *
   * @param phone    - Número en formato E.164
   * @param newState - Estado al que transicionar
   * @param data     - Datos parciales a mergear en la sesión
   */
  async saveResponse(
    phone: string,
    newState: BotFsmState,
    data: Partial<Omit<BotSession, 'state'>>,
  ): Promise<void> {
    const current = await this.getSession(phone);
    const updated: BotSession = { ...current, ...data, state: newState };
    await this.redis.set(sessionKey(phone), JSON.stringify(updated), SESSION_TTL_SECONDS);
  }

  /**
   * Retornar el texto de respuesta apropiado para un estado dado.
   * Útil para testing o generación de respuestas sin efectos secundarios.
   *
   * @param state - Estado FSM actual
   * @returns Texto de respuesta del bot para ese estado
   */
  getResponseText(state: BotFsmState): string {
    const responses: Record<BotFsmState, string> = {
      [BotFsmState.NAME]: '¿Cuál es tu nombre completo?',
      [BotFsmState.NEIGHBORHOOD]: '¿En qué colonia vivís?',
      [BotFsmState.INTERESTS]: '¿Qué temas te interesan?',
      [BotFsmState.AWAITING_INTERESTS]: '¿Qué temas te interesan?',
      [BotFsmState.COMPLETED]: '¿En qué podemos ayudarte?',
    };
    return responses[state] ?? 'Hola, ¿cómo podemos ayudarte?';
  }

  // ─── Helpers de persistencia ─────────────────────────────────────────────

  /**
   * Persiste un mensaje INBOUND del ciudadano en su conversación activa.
   * Crea o reutiliza una conversación OPEN.
   */
  private async persistInboundMessage(
    phone: string,
    text: string,
    waMessageId: string,
  ): Promise<void> {
    const citizen = await this.prisma.citizen.findUnique({ where: { phone } });
    if (!citizen) return;

    const conversation = await this.ensureOpenConversation(citizen.id);

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.inbound,
        body: text,
        externalMessageId: waMessageId,
      },
    });
  }

  /**
   * Busca una conversación OPEN para el ciudadano, o crea una nueva.
   *
   * @param citizenId - UUID del ciudadano en la DB
   */
  private async ensureOpenConversation(citizenId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { citizenId, status: ConversationStatus.open },
    });

    if (existing) return existing;

    return this.prisma.conversation.create({
      data: { citizenId, status: ConversationStatus.open },
    });
  }

  // ─── Placeholder de envío de mensajes ────────────────────────────────────

  /**
   * Envía un mensaje de texto al ciudadano vía WhatsApp Cloud API.
   *
   * TODO: Implementar llamada HTTP real a:
   * POST https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages
   * Headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` }
   * Body: {
   *   messaging_product: "whatsapp",
   *   to: phone,
   *   type: "text",
   *   text: { body: text }
   * }
   *
   * @param phone - Número destino en formato E.164
   * @param text  - Texto del mensaje a enviar
   */
  private sendMessage(phone: string, text: string): void {
    // TODO: Reemplazar con llamada real a la Graph API de Meta
    console.debug(`[BotService] [→ ${phone}]: ${text.substring(0, 80)}...`);
  }
}
