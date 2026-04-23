/**
 * FSM del bot de registro ciudadano vía WhatsApp.
 * Orquesta los estados de conversación, persiste en Prisma y carga estado desde Redis.
 */
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { BotFsmState, BotSessionData } from '../config/types';
import { normalizePhone } from '../utils/hmac.util';
import { CitizenStatus, ConversationStatus, MessageDirection } from '@prisma/client';

/** TTL de la sesión en Redis: 24 horas */
const SESSION_TTL_SECONDS = 60 * 60 * 24;

/** Prefijo de clave de sesión en Redis */
const SESSION_KEY = (phone: string) => `bot:state:${phone}`;

export class WhatsAppBotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Punto de entrada principal ─────────────────────────────────────────────

  /**
   * Recibe un mensaje de texto de un ciudadano y lo procesa según el estado FSM.
   */
  async handleMessage(
    phone: string,
    text: string,
    waMessageId: string,
  ): Promise<void> {
    const session = await this.getSession(phone);

    // Si el ciudadano ya completó el registro, solo persistimos el mensaje
    if (session.state === BotFsmState.COMPLETE) {
      await this.persistInboundMessage(phone, text, waMessageId);
      // TODO: derivar mensaje a departamento/agente según intereses o keywords
      return;
    }

    switch (session.state) {
      case BotFsmState.START:
        await this.handleStart(phone, text, waMessageId, session);
        break;

      case BotFsmState.AWAITING_NAME:
        await this.handleAwaitingName(phone, text, waMessageId, session);
        break;

      case BotFsmState.AWAITING_COLONY:
        await this.handleAwaitingColony(phone, text, waMessageId, session);
        break;

      case BotFsmState.AWAITING_INTERESTS:
        await this.handleAwaitingInterests(phone, text, waMessageId, session);
        break;

      default:
        console.warn(`[WhatsAppBotService] Estado FSM desconocido para ${phone}: ${session.state}`);
    }
  }

  // ─── Handlers por estado ─────────────────────────────────────────────────────

  /**
   * START: Si el ciudadano no existe, saluda y pide nombre.
   * Si ya existe y está ACTIVE, lo transiciona a COMPLETE directamente.
   */
  private async handleStart(
    phone: string,
    text: string,
    waMessageId: string,
    session: BotSessionData,
  ): Promise<void> {
    const existing = await this.prisma.citizen.findUnique({ where: { phone } });

    if (existing && existing.status === CitizenStatus.ACTIVE) {
      await this.ensureOpenConversation(existing.id);
      await this.saveSession(phone, { state: BotFsmState.COMPLETE });
      await this.sendMessage(phone, `¡Bienvenido de vuelta, ${existing.fullName ?? 'ciudadano'}! ¿En qué podemos ayudarte hoy?`);
      return;
    }

    // Ciudadano nuevo — iniciar registro
    await this.prisma.citizen.upsert({
      where: { phone },
      update: {},
      create: { phone, status: CitizenStatus.PENDING },
    });

    await this.saveSession(phone, { ...session, state: BotFsmState.AWAITING_NAME });
    await this.sendMessage(
      phone,
      '👋 ¡Hola! Bienvenido a *Voz Ciudadana*, el canal oficial del municipio.\n\nPor favor, ¿cuál es tu nombre completo?',
    );
  }

  /**
   * AWAITING_NAME: Guarda el nombre del ciudadano y pide colonia.
   */
  private async handleAwaitingName(
    phone: string,
    text: string,
    waMessageId: string,
    session: BotSessionData,
  ): Promise<void> {
    const name = text.trim();

    // Validación mínima — al menos 2 palabras
    if (name.split(' ').filter(Boolean).length < 2) {
      await this.sendMessage(phone, 'Por favor ingresa tu nombre completo (nombre y apellido).');
      return;
    }

    await this.prisma.citizen.update({
      where: { phone },
      data: { fullName: name },
    });

    const colonies = await this.prisma.colony.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const coloniesList = colonies.map((c, i) => `${i + 1}. ${c.name}`).join('\n');

    await this.saveSession(phone, {
      ...session,
      state: BotFsmState.AWAITING_COLONY,
      fullName: name,
    });

    await this.sendMessage(
      phone,
      `Gracias, ${name}! 🏘️\n\n¿En qué colonia vives?\nResponde con el *número* de tu colonia:\n\n${coloniesList}`,
    );
  }

  /**
   * AWAITING_COLONY: Valida la elección de colonia y pide intereses.
   */
  private async handleAwaitingColony(
    phone: string,
    text: string,
    waMessageId: string,
    session: BotSessionData,
  ): Promise<void> {
    const colonies = await this.prisma.colony.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const index = parseInt(text.trim(), 10);
    const selected = isNaN(index) ? null : colonies[index - 1];

    if (!selected) {
      const coloniesList = colonies.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
      await this.sendMessage(
        phone,
        `No reconocí esa opción. Por favor responde con el número de tu colonia:\n\n${coloniesList}`,
      );
      return;
    }

    await this.prisma.citizen.update({
      where: { phone },
      data: { colonyId: selected.id },
    });

    await this.saveSession(phone, {
      ...session,
      state: BotFsmState.AWAITING_INTERESTS,
      colonyId: selected.id,
    });

    const interestOptions = [
      '1. Agua y servicios',
      '2. Seguridad pública',
      '3. Obras y pavimentación',
      '4. Salud y bienestar',
      '5. Educación',
      '6. Medio ambiente',
      '7. Trámites y gestiones',
    ].join('\n');

    await this.sendMessage(
      phone,
      `¡Excelente! Colonia *${selected.name}* registrada ✅\n\n¿Qué temas te interesan? Responde con los números separados por coma (ej: 1,3,5):\n\n${interestOptions}`,
    );
  }

  /**
   * AWAITING_INTERESTS: Guarda intereses, completa registro y abre conversación.
   */
  private async handleAwaitingInterests(
    phone: string,
    text: string,
    waMessageId: string,
    session: BotSessionData,
  ): Promise<void> {
    const interestMap: Record<number, string> = {
      1: 'agua_servicios',
      2: 'seguridad_publica',
      3: 'obras_pavimentacion',
      4: 'salud_bienestar',
      5: 'educacion',
      6: 'medio_ambiente',
      7: 'tramites_gestiones',
    };

    // Parsear selección defensiva: "1, 3, 5" → [1, 3, 5]
    const selectedNumbers = text
      .split(/[,\s]+/)
      .map((n) => parseInt(n.trim(), 10))
      .filter((n) => !isNaN(n) && interestMap[n]);

    if (selectedNumbers.length === 0) {
      await this.sendMessage(phone, 'Por favor responde con números separados por coma, ej: 1,3');
      return;
    }

    const interests = selectedNumbers.map((n) => interestMap[n]);

    const citizen = await this.prisma.citizen.update({
      where: { phone },
      data: { interests, status: CitizenStatus.ACTIVE },
    });

    const conversation = await this.ensureOpenConversation(citizen.id);

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        body: text,
        waMessageId,
      },
    });

    await this.saveSession(phone, { ...session, state: BotFsmState.COMPLETE, interests });

    await this.sendMessage(
      phone,
      `¡Registro completo! 🎉\n\nYa podés comunicarte con el municipio por este medio. ¿En qué podemos ayudarte hoy?`,
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Busca conversación OPEN del ciudadano o crea una nueva.
   */
  private async ensureOpenConversation(citizenId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { citizenId, status: ConversationStatus.OPEN },
    });

    if (existing) return existing;

    return this.prisma.conversation.create({
      data: { citizenId, status: ConversationStatus.OPEN },
    });
  }

  /**
   * Persiste un mensaje inbound del ciudadano en su conversación activa.
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
        direction: MessageDirection.INBOUND,
        body: text,
        waMessageId,
      },
    });
  }

  /**
   * Leer sesión FSM desde Redis.
   * Si no existe, retorna estado START.
   */
  private async getSession(phone: string): Promise<BotSessionData> {
    const raw = await this.redis.get(SESSION_KEY(phone));
    if (!raw) return { state: BotFsmState.START };

    try {
      return JSON.parse(raw) as BotSessionData;
    } catch {
      console.warn(`[WhatsAppBotService] Sesión corrupta para ${phone}, reiniciando`);
      return { state: BotFsmState.START };
    }
  }

  /**
   * Guardar sesión FSM en Redis con TTL.
   */
  private async saveSession(phone: string, data: BotSessionData): Promise<void> {
    await this.redis.set(SESSION_KEY(phone), JSON.stringify(data), SESSION_TTL_SECONDS);
  }

  /**
   * Envía un mensaje de texto al ciudadano vía WhatsApp Cloud API.
   * TODO: Implementar llamada real a https://graph.facebook.com/v18.0/{phone_number_id}/messages
   */
  private async sendMessage(phone: string, text: string): Promise<void> {
    // TODO: Reemplazar este log con la llamada HTTP real a Meta Graph API
    console.debug(`[WhatsAppBotService] [SEND → ${phone}]: ${text.substring(0, 80)}`);
  }
}
