/**
 * BotService — Servicio principal del bot de registro ciudadano.
 *
 * Implementa una FSM (Finite State Machine) para guiar al ciudadano
 * a través del proceso de registro vía WhatsApp.
 *
 * Estados FSM de registro:
 * ┌────────────────────────────────────────────────────────────────────┐
 * │  NAME → NEIGHBORHOOD → INTERESTS → AWAITING_INTERESTS → COMPLETED │
 * │                                                                    │
 * │  • NAME               → esperando nombre completo del ciudadano   │
 * │  • NEIGHBORHOOD       → esperando selección de colonia/barrio     │
 * │  • INTERESTS          → esperando número de colonia               │
 * │  • AWAITING_INTERESTS → esperando números de intereses            │
 * │  • COMPLETED          → registro finalizado                       │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * El estado se persiste en Redis (ioredis) con TTL de 24 horas.
 * Los datos permanentes se guardan en PostgreSQL via Prisma.
 * Los mensajes outbound se envían via WhatsAppProvider (real).
 */
import {
  ConversationStatus,
  LeadStatus,
  MessageDirection,
  MessageType,
  SourceChannel,
} from '@prisma/client';
import * as crypto from 'crypto';
import { WhatsAppTextMessage, WhatsAppWebhookPayload } from '../types/types';
import { WaTextOutbound } from '../types/whatsapp.types';
import { normalizePhone, normalizePhoneForStorage } from '../utils/phone-normalizer';
import { OutboxProcessorService } from './events/outbox-processor.service';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { MessageRepository } from './repositories/message.repository';
import { WhatsAppProvider } from './whatsapp/whatsapp.provider';

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
  /** Registro completado */
  COMPLETED = 'COMPLETED',
}

/**
 * Candidato pendiente de confirmación fuzzy.
 * Se guarda en sesión cuando el top fuzzy score es alto pero no exacto.
 */
export interface PendingNeighborhoodConfirmation {
  id: string;
  name: string;
  score: number;
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
  /** wamid del último mensaje procesado (deduplicación por mensaje) */
  lastProcessedWamid?: string;
  /**
   * Candidato fuzzy pendiente de confirmación explícita del ciudadano.
   * Presente cuando el bot preguntó "¿Te referís a 'X'? Respondé SI o NO".
   */
  pendingNeighborhoodConfirmation?: PendingNeighborhoodConfirmation;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Tiempo de vida de la sesión en Redis: 24 horas */
const SESSION_TTL_SECONDS = 60 * 60 * 24;

/**
 * Límite de caracteres de WhatsApp Cloud API para mensajes de texto.
 * Ref: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
 */
export const WA_MAX_TEXT_LENGTH = 4096;

/**
 * Máximo de colonias a mostrar por página en el menú de selección.
 * Garantiza que el mensaje nunca supere WA_MAX_TEXT_LENGTH.
 */
export const NEIGHBORHOOD_PAGE_SIZE = 50;

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

// ─── Logger estructurado ──────────────────────────────────────────────────────

/**
 * Enmascara un número de teléfono para logs: muestra solo los últimos 4 dígitos.
 * Ej: +521234567890 → +52*****7890
 *
 * @param phone - Número en formato E.164 u otro
 * @returns     - Número enmascarado
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length <= 4) return '****';
  const clean = phone.replace(/\D/g, '');
  const last4 = clean.slice(-4);
  const prefix = phone.startsWith('+') ? '+' : '';
  return `${prefix}${'*'.repeat(Math.max(0, clean.length - 4))}${last4}`;
}

function log(
  level: 'info' | 'warn' | 'error' | 'debug',
  event: string,
  correlationId: string,
  data?: Record<string, unknown>,
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'BotService',
    event,
    correlationId,
    ...data,
  };
  // eslint-disable-next-line no-console
  console[level](JSON.stringify(entry));
}

// ─── Helpers de construcción de mensajes ──────────────────────────────────────

/**
 * Construye el mensaje de selección de colonia/barrio paginado.
 * Si la lista completa supera WA_MAX_TEXT_LENGTH, muestra solo la primera página
 * e indica cuántas quedan. El usuario puede escribir un número de la lista visible.
 *
 * @param header        - Texto introductorio (ej: "¡Gracias, Juan! 🏘️\n\n¿En qué colonia vivís?...")
 * @param neighborhoods - Lista completa de colonias
 * @param page          - Página a mostrar (1-indexed, default 1)
 * @returns             - Texto del mensaje listo para enviar y página actual
 * @deprecated          - Este helper queda sin uso en el flujo principal.
 *                        El nuevo flujo usa matchNeighborhood + buildNeighborhoodMatchMessage.
 *                        Se mantiene para compatibilidad con tests existentes.
 */
export function buildNeighborhoodListMessage(
  header: string,
  neighborhoods: Array<{ id: string; name: string }>,
  page = 1,
): { text: string; page: number; totalPages: number } {
  const totalPages = Math.ceil(neighborhoods.length / NEIGHBORHOOD_PAGE_SIZE);
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * NEIGHBORHOOD_PAGE_SIZE;
  const slice = neighborhoods.slice(start, start + NEIGHBORHOOD_PAGE_SIZE);

  const list = slice.map((n, i) => `${start + i + 1}. ${n.name}`).join('\n');

  const pagination =
    totalPages > 1
      ? `\n\n_(Página ${safePage} de ${totalPages}. Respondé el número de tu colonia.)_`
      : '';

  const text = `${header}\n\n${list}${pagination}`;

  // Defensa adicional: si aún supera el límite (nombres muy largos), truncar lista
  if (text.length > WA_MAX_TEXT_LENGTH) {
    let truncatedList = '';
    for (const item of slice) {
      const idx = start + slice.indexOf(item) + 1;
      const line = `${idx}. ${item.name}\n`;
      if ((header + '\n\n' + truncatedList + line + pagination).length > WA_MAX_TEXT_LENGTH - 10) {
        break;
      }
      truncatedList += line;
    }
    return {
      text: `${header}\n\n${truncatedList.trimEnd()}${pagination}`,
      page: safePage,
      totalPages,
    };
  }

  return { text, page: safePage, totalPages };
}

// ─── Helpers de matching de colonia por nombre ────────────────────────────────

/**
 * Normaliza un texto para matching: minúsculas, trim, sin acentos, sin signos comunes.
 * Permite comparación robusta entre lo que escribe el ciudadano y los nombres en DB.
 *
 * @param text - Texto a normalizar
 * @returns    - Texto normalizado
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remover diacríticos (acentos)
    .replace(/[.,;:!¡?¿()'"]/g, '') // remover signos de puntuación (sin guión)
    .replace(/[-_]/g, ' ') // guión y guión bajo → espacio
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resultado del matching de colonia.
 * - `exact`: una sola coincidencia clara (asignar directo)
 * - `multiple`: entre 2 y N coincidencias (mostrar opciones)
 * - `fuzzy_confirm`: un candidato fuzzy con score alto — requiere confirmación explícita
 * - `none`: sin coincidencias (fallback amigable)
 */
export type NeighborhoodMatchResult =
  | { type: 'exact'; neighborhood: { id: string; name: string } }
  | { type: 'multiple'; candidates: Array<{ id: string; name: string }> }
  | { type: 'fuzzy_confirm'; candidate: { id: string; name: string; score: number } }
  | { type: 'none' };

/**
 * Máximo de opciones a mostrar cuando hay múltiples coincidencias.
 * Garantiza que el mensaje de respuesta no supere WA_MAX_TEXT_LENGTH.
 */
export const NEIGHBORHOOD_MATCH_MAX_OPTIONS = 5;

/**
 * Umbral mínimo de similitud fuzzy para proponer confirmación.
 * Scores por debajo de este valor se descartan (type: 'none').
 */
export const FUZZY_THRESHOLD = 0.82;

/**
 * Umbral alto de similitud fuzzy para propuesta de confirmación única
 * (en lugar de listar múltiples opciones).
 * El top candidato debe superar este umbral Y superar al segundo por al menos FUZZY_GAP.
 */
export const FUZZY_HIGH_THRESHOLD = 0.9;

/**
 * Diferencia mínima de score entre el primero y el segundo candidato fuzzy
 * para que se considere una coincidencia clara (se propone confirmación en lugar de lista).
 */
export const FUZZY_GAP = 0.08;

/**
 * Calcula la distancia de edición Levenshtein entre dos strings.
 * Implementación iterativa con espacio O(min(a,b)).
 *
 * @param a - Primer string
 * @param b - Segundo string
 * @returns - Número de operaciones de edición mínimas
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Garantizar que a sea el más corto para optimizar espacio
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const alen = a.length;
  const blen = b.length;
  let prev = Array.from({ length: alen + 1 }, (_, i) => i);

  for (let j = 1; j <= blen; j++) {
    const curr = [j];
    for (let i = 1; i <= alen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1, // inserción
        prev[i] + 1, // eliminación
        prev[i - 1] + cost, // sustitución
      );
    }
    prev = curr;
  }

  return prev[alen];
}

/**
 * Calcula similitud normalizada entre dos strings (0..1) basada en Levenshtein.
 * Fórmula: 1 - (distancia / max(len_a, len_b))
 *
 * @param a - Primer string (normalizado)
 * @param b - Segundo string (normalizado)
 * @returns - Score de similitud entre 0.0 y 1.0
 */
export function similarityScore(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Busca colonias por nombre usando estrategia progresiva:
 * 1. Exact match normalizado
 * 2. StartsWith normalizado
 * 3. Contains normalizado
 * 4. Fuzzy (Levenshtein) con umbral configurable — solo si no hubo match fuerte arriba
 *
 * @param query         - Texto ingresado por el ciudadano
 * @param neighborhoods - Lista completa de colonias de la DB
 * @returns             - Resultado del matching
 */
export function matchNeighborhood(
  query: string,
  neighborhoods: Array<{ id: string; name: string }>,
): NeighborhoodMatchResult {
  const q = normalizeForMatch(query);

  if (!q) return { type: 'none' };

  const normalizedNeighborhoods = neighborhoods.map((n) => ({
    ...n,
    _normalized: normalizeForMatch(n.name),
  }));

  // 1. Exact match
  const exactMatches = normalizedNeighborhoods.filter((n) => n._normalized === q);
  if (exactMatches.length === 1) {
    return { type: 'exact', neighborhood: { id: exactMatches[0].id, name: exactMatches[0].name } };
  }
  if (exactMatches.length > 1) {
    const candidates = exactMatches
      .slice(0, NEIGHBORHOOD_MATCH_MAX_OPTIONS)
      .map((n) => ({ id: n.id, name: n.name }));
    return { type: 'multiple', candidates };
  }

  // 2. StartsWith match
  const startsWithMatches = normalizedNeighborhoods.filter((n) => n._normalized.startsWith(q));
  if (startsWithMatches.length === 1) {
    return {
      type: 'exact',
      neighborhood: { id: startsWithMatches[0].id, name: startsWithMatches[0].name },
    };
  }
  if (startsWithMatches.length > 1) {
    const candidates = startsWithMatches
      .slice(0, NEIGHBORHOOD_MATCH_MAX_OPTIONS)
      .map((n) => ({ id: n.id, name: n.name }));
    return { type: 'multiple', candidates };
  }

  // 3. Contains match
  const containsMatches = normalizedNeighborhoods.filter((n) => n._normalized.includes(q));
  if (containsMatches.length === 1) {
    return {
      type: 'exact',
      neighborhood: { id: containsMatches[0].id, name: containsMatches[0].name },
    };
  }
  if (containsMatches.length > 1) {
    const candidates = containsMatches
      .slice(0, NEIGHBORHOOD_MATCH_MAX_OPTIONS)
      .map((n) => ({ id: n.id, name: n.name }));
    return { type: 'multiple', candidates };
  }

  // 4. Fuzzy match (Levenshtein) — solo si no hubo match exacto/parcial arriba
  const scored = normalizedNeighborhoods
    .map((n) => ({ id: n.id, name: n.name, score: similarityScore(q, n._normalized) }))
    .filter((n) => n.score >= FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, NEIGHBORHOOD_MATCH_MAX_OPTIONS);

  if (scored.length === 0) return { type: 'none' };

  const top = scored[0];
  const second = scored[1];

  // Si el top supera umbral alto y tiene ventaja clara vs el segundo → pedir confirmación única
  if (top.score >= FUZZY_HIGH_THRESHOLD && (!second || top.score - second.score >= FUZZY_GAP)) {
    return {
      type: 'fuzzy_confirm',
      candidate: { id: top.id, name: top.name, score: top.score },
    };
  }

  // Solo UN candidato fuzzy (sin segundo) → pedir confirmación aunque no llegue a high threshold
  if (!second) {
    return {
      type: 'fuzzy_confirm',
      candidate: { id: top.id, name: top.name, score: top.score },
    };
  }

  // Múltiples fuzzy similares → mostrar lista y pedir más específico
  const candidates = scored.map((n) => ({ id: n.id, name: n.name }));
  return { type: 'multiple', candidates };
}

/**
 * Construye el mensaje de respuesta cuando hay múltiples coincidencias.
 * Muestra hasta NEIGHBORHOOD_MATCH_MAX_OPTIONS opciones con formato claro.
 *
 * @param candidates - Lista de colonias candidatas (max 5)
 * @returns          - Texto del mensaje listo para enviar
 */
export function buildNeighborhoodMatchMessage(
  candidates: Array<{ id: string; name: string }>,
): string {
  const list = candidates.map((n) => `• ${n.name}`).join('\n');
  return (
    `Encontré varias colonias que coinciden:\n\n${list}\n\n` +
    'Escribí el nombre exacto de tu colonia para continuar.'
  );
}

// ─── BotService ───────────────────────────────────────────────────────────────

export class BotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly whatsappProvider: WhatsAppProvider,
    private readonly outboxProcessor?: OutboxProcessorService,
    private readonly messageRepo?: MessageRepository,
  ) {}

  // ─── Punto de entrada del webhook (legacy) ─────────────────────────────────

  /**
   * Procesa el payload completo del webhook de WhatsApp.
   * Extrae los mensajes de texto y los rutea al handler de FSM.
   * Usado solo por el flujo legacy directo (sin orquestador).
   *
   * @param payload - Payload completo enviado por Meta
   */
  async handleWebhookPayload(payload: WhatsAppWebhookPayload): Promise<void> {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;

        const messages: WhatsAppTextMessage[] = change.value?.messages ?? [];

        for (const msg of messages) {
          const phone = normalizePhoneForStorage(msg.from);
          const waMessageId = msg.id;
          const correlationId = crypto.randomUUID();

          log('info', 'inbound.received', correlationId, {
            phone: maskPhone(phone),
            wamid: waMessageId,
            type: msg.type,
          });

          // Fallback para tipos no-texto durante registro
          if (msg.type !== 'text' || !msg.text?.body) {
            log('debug', 'inbound.non-text', correlationId, {
              phone: maskPhone(phone),
              type: msg.type,
            });
            await this.handleNonTextMessage(phone, waMessageId, correlationId);
            continue;
          }

          const text = msg.text.body.trim();

          try {
            await this.handleMessage(phone, text, waMessageId, correlationId);
          } catch (err) {
            log('error', 'inbound.processing_error', correlationId, {
              phone: maskPhone(phone),
              error: err instanceof Error ? err.message : String(err),
            });
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
   * @param phone         - Número en formato E.164 (ej: +521234567890)
   * @param text          - Texto del mensaje
   * @param waMessageId   - ID único del mensaje en WhatsApp
   * @param correlationId - ID de correlación para trazabilidad
   */
  async handleMessage(
    rawPhone: string,
    text: string,
    waMessageId: string,
    correlationId = '',
  ): Promise<void> {
    // Normalizar a formato DB canónico (sin +) en el punto de entrada
    const phone = normalizePhoneForStorage(rawPhone);
    const session = await this.getSession(phone);

    // Deduplicación por wamid: si ya procesamos este mensaje, skip silencioso
    if (session.lastProcessedWamid === waMessageId) {
      log('warn', 'inbound.duplicate_wamid', correlationId, {
        phone: maskPhone(phone),
        wamid: waMessageId,
      });
      return;
    }

    log('info', 'bot.handler.start', correlationId, {
      phone: maskPhone(phone),
      wamid: waMessageId,
      state: session.state,
    });

    switch (session.state) {
      case BotFsmState.NAME:
        await this.handleNameState(phone, text, waMessageId, session, correlationId);
        break;

      case BotFsmState.NEIGHBORHOOD:
        await this.handleNeighborhoodState(phone, text, waMessageId, session, correlationId);
        break;

      case BotFsmState.INTERESTS:
        await this.handleInterestsState(phone, text, waMessageId, session, correlationId);
        break;

      case BotFsmState.AWAITING_INTERESTS:
        await this.handleAwaitingInterestsState(phone, text, correlationId);
        break;

      case BotFsmState.COMPLETED:
        // Ciudadano ya registrado — el orquestador persiste el mensaje inbound (paso 4).
        // No persistir aquí para evitar duplicados.
        log('info', 'bot.handler.completed_state', correlationId, { phone: maskPhone(phone) });
        break;

      default: {
        // Estado desconocido — reset defensivo a NAME
        const unknownState = session.state as string;
        log('warn', 'bot.fsm.unknown_state', correlationId, {
          phone: maskPhone(phone),
          state: unknownState,
        });
        await this.advanceState(phone, BotFsmState.NAME);
        await this.handleNameState(
          phone,
          text,
          waMessageId,
          { state: BotFsmState.NAME },
          correlationId,
        );
      }
    }

    // Actualizar lastProcessedWamid después de procesar exitosamente
    await this.markWamidProcessed(phone, waMessageId);
  }

  /**
   * Maneja mensajes no-texto (audio, imagen, sticker, etc.) durante el registro.
   * Envía fallback informando al ciudadano que solo se acepta texto en este flujo.
   */
  async handleNonTextMessage(
    rawPhone: string,
    waMessageId: string,
    correlationId = '',
  ): Promise<void> {
    const phone = normalizePhoneForStorage(rawPhone);
    const session = await this.getSession(phone);

    // Solo responder con fallback si estamos en flujo activo de registro
    if (session.state === BotFsmState.COMPLETED || session.lastProcessedWamid === waMessageId) {
      return;
    }

    log('info', 'bot.non_text_fallback', correlationId, {
      phone: maskPhone(phone),
      state: session.state,
    });
    await this.sendMessage(
      phone,
      '⚠️ En este paso del registro solo puedo procesar mensajes de texto. Por favor respondé con texto.',
      correlationId,
    );
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
    correlationId: string,
  ): Promise<void> {
    log('info', 'bot.state.name', correlationId, { phone: maskPhone(phone) });

    const existing = await this.prisma.citizen.findUnique({ where: { phone } });

    if (existing?.leadStatus === LeadStatus.converted) {
      // Ya registrado — saltar a COMPLETED
      await this.saveResponse(phone, BotFsmState.COMPLETED, {});
      await this.sendMessage(
        phone,
        `¡Bienvenido de vuelta, ${existing.name ?? 'ciudadano'}! ¿En qué podemos ayudarte?`,
        correlationId,
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

    await this.sendMessage(
      phone,
      '👋 ¡Hola! Bienvenido a *Voz Ciudadana*, el canal oficial del municipio.\n\n' +
        '¿Cuál es tu nombre completo?',
      correlationId,
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
    correlationId: string,
  ): Promise<void> {
    log('info', 'bot.state.neighborhood', correlationId, { phone: maskPhone(phone) });

    const name = text.trim();

    // Validación mínima: al menos 2 palabras
    if (name.split(/\s+/).filter(Boolean).length < 2) {
      await this.sendMessage(
        phone,
        'Por favor ingresá tu nombre completo (nombre y apellido).',
        correlationId,
      );
      return;
    }

    const [firstName, ...lastNames] = name.split(/\s+/).filter(Boolean);

    // Guardar nombre en DB
    await this.prisma.citizen.update({
      where: { phone },
      data: { name: firstName, lastName: lastNames.join(' ') || null },
    });

    // Guardar respuesta parcial en sesión Redis (ya no necesitamos cargar colonias aquí) (ya no necesitamos cargar colonias aquí)
    await this.saveResponse(phone, BotFsmState.INTERESTS, {
      name: firstName,
      lastName: lastNames.join(' ') || undefined,
    });

    await this.sendMessage(
      phone,
      `¡Gracias, ${name}! 🏘️\n\nEscribí el nombre de tu colonia (por ejemplo: "Centro", "Las Flores", "Jardines del Valle").`,
      correlationId,
    );
  }

  /**
   * Estado INTERESTS: recibe el nombre de colonia del ciudadano y hace matching.
   * Estrategia: exact → startsWith → contains → fuzzy.
   *
   * Si hay una confirmación pendiente (fuzzy_confirm), procesa SI/NO antes del matching.
   *
   * - exact/unique: asigna colonia y avanza a AWAITING_INTERESTS.
   * - fuzzy_confirm: pregunta "¿Te referís a 'X'? Respondé SI o NO" y guarda pending.
   * - multiple: muestra hasta 5 opciones y pide nombre más específico.
   * - none: fallback amigable y permite reintentar.
   */
  private async handleInterestsState(
    phone: string,
    text: string,
    _waMessageId: string,
    session: BotSession,
    correlationId: string,
  ): Promise<void> {
    log('info', 'bot.state.interests', correlationId, {
      phone: maskPhone(phone),
      confirmationPending: !!session.pendingNeighborhoodConfirmation,
    });

    // ── Confirmación pendiente de fuzzy ──────────────────────────────────────
    if (session.pendingNeighborhoodConfirmation) {
      const pending = session.pendingNeighborhoodConfirmation;
      const answer = normalizeForMatch(text);

      log('info', 'bot.neighborhood.pending_confirmation.evaluate', correlationId, {
        phone: maskPhone(phone),
        matchType: 'fuzzy_confirm',
        confirmationPending: true,
        topScore: pending.score,
        selectedNeighborhoodId: pending.id,
        answer,
      });

      if (answer === 'si' || answer === 'sí') {
        // Ciudadano confirmó → asignar colonia y avanzar
        log('info', 'bot.neighborhood.fuzzy_confirmed', correlationId, {
          phone: maskPhone(phone),
          matchType: 'fuzzy_confirm',
          neighborhoodId: pending.id,
          neighborhoodName: pending.name,
          topScore: pending.score,
          confirmationPending: false,
          selectedNeighborhoodId: pending.id,
        });

        await this.prisma.citizen.update({
          where: { phone },
          data: { neighborhoodId: pending.id, neighborhood: pending.name },
        });

        await this.saveResponse(phone, BotFsmState.AWAITING_INTERESTS, {
          neighborhoodId: pending.id,
          pendingNeighborhoodConfirmation: undefined,
        });

        const options = Object.entries(INTEREST_MAP)
          .map(([k, v]) => `${k}. ${v.replace(/_/g, ' ')}`)
          .join('\n');

        await this.sendMessage(
          phone,
          `✅ Colonia *${pending.name}* registrada.\n\n` +
            `¿Qué temas te interesan? Respondé con los números separados por coma (ej: 1,3):\n\n${options}`,
          correlationId,
        );
        return;
      }

      if (answer === 'no') {
        // Ciudadano rechazó → limpiar pending y pedir que reescriba
        log('info', 'bot.neighborhood.fuzzy_rejected', correlationId, {
          phone: maskPhone(phone),
          matchType: 'fuzzy_confirm',
          rejectedId: pending.id,
          confirmationPending: false,
        });

        await this.saveResponse(phone, BotFsmState.INTERESTS, {
          pendingNeighborhoodConfirmation: undefined,
        });

        await this.sendMessage(
          phone,
          'Entendido. Por favor escribí el nombre de tu colonia de nuevo\n' +
            '(por ejemplo: "Centro", "Las Flores", "Jardines del Valle").',
          correlationId,
        );
        return;
      }

      // Respuesta no reconocida → volver a pedir SI/NO
      await this.sendMessage(
        phone,
        `¿Te referís a *${pending.name}*? Respondé *SI* o *NO*.`,
        correlationId,
      );
      return;
    }

    // ── Matching normal ───────────────────────────────────────────────────────
    const neighborhoods = await this.prisma.neighborhood.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const matchResult = matchNeighborhood(text, neighborhoods);

    log('info', 'bot.neighborhood.match_evaluated', correlationId, {
      phone: maskPhone(phone),
      matchType: matchResult.type,
      candidateCount:
        matchResult.type === 'multiple'
          ? matchResult.candidates.length
          : matchResult.type === 'fuzzy_confirm'
            ? 1
            : matchResult.type === 'exact'
              ? 1
              : 0,
      topScore: matchResult.type === 'fuzzy_confirm' ? matchResult.candidate.score : undefined,
      confirmationPending: matchResult.type === 'fuzzy_confirm',
    });

    if (matchResult.type === 'none') {
      log('info', 'bot.neighborhood.no_match', correlationId, {
        phone: maskPhone(phone),
        matchType: 'none',
        candidateCount: 0,
      });
      await this.sendMessage(
        phone,
        'No encontré ninguna colonia con ese nombre 🙁\n\n' +
          'Por favor intentá de nuevo escribiendo el nombre de tu colonia\n' +
          '(por ejemplo: "Centro", "Las Flores", "Jardines del Valle").',
        correlationId,
      );
      return;
    }

    if (matchResult.type === 'fuzzy_confirm') {
      const candidate = matchResult.candidate;
      log('info', 'bot.neighborhood.fuzzy_propose', correlationId, {
        phone: maskPhone(phone),
        matchType: 'fuzzy_confirm',
        topScore: candidate.score,
        candidateCount: 1,
        confirmationPending: true,
        candidateId: candidate.id,
        candidateName: candidate.name,
      });

      // Guardar candidato pendiente en sesión (mantener estado INTERESTS)
      await this.saveResponse(phone, BotFsmState.INTERESTS, {
        pendingNeighborhoodConfirmation: {
          id: candidate.id,
          name: candidate.name,
          score: candidate.score,
        },
      });

      await this.sendMessage(
        phone,
        `¿Te referís a *${candidate.name}*? Respondé *SI* o *NO*.`,
        correlationId,
      );
      return;
    }

    if (matchResult.type === 'multiple') {
      log('info', 'bot.neighborhood.multiple_matches', correlationId, {
        phone: maskPhone(phone),
        matchType: 'multiple',
        candidateCount: matchResult.candidates.length,
        confirmationPending: false,
      });
      const matchMsg = buildNeighborhoodMatchMessage(matchResult.candidates);
      await this.sendMessage(phone, matchMsg, correlationId);
      return;
    }

    // matchResult.type === 'exact'
    const selected = matchResult.neighborhood;

    log('info', 'bot.neighborhood.assigned', correlationId, {
      phone: maskPhone(phone),
      matchType: 'exact',
      candidateCount: 1,
      selectedNeighborhoodId: selected.id,
      confirmationPending: false,
      neighborhoodName: selected.name,
    });

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

    await this.sendMessage(
      phone,
      `✅ Colonia *${selected.name}* registrada.\n\n` +
        `¿Qué temas te interesan? Respondé con los números separados por coma (ej: 1,3):\n\n${options}`,
      correlationId,
    );
  }

  /**
   * Estado AWAITING_INTERESTS: guarda temas de interés y marca al ciudadano como ACTIVE.
   */
  private async handleAwaitingInterestsState(
    phone: string,
    text: string,
    correlationId: string,
  ): Promise<void> {
    log('info', 'bot.state.awaiting_interests', correlationId, { phone: maskPhone(phone) });

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
      await this.sendMessage(
        phone,
        `No reconocí esos temas. Respondé con números separados por coma (ej: 1,3):\n\n${options}`,
        correlationId,
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

    log('info', 'bot.registration.completed', correlationId, { phone: maskPhone(phone) });

    await this.sendMessage(
      phone,
      '🎉 ¡Registro completado! Ya podés enviarnos reportes o solicitudes y un agente te va a responder por este medio.',
      correlationId,
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
    const raw = await this.redis.get(sessionKey(normalizePhoneForStorage(phone)));
    if (!raw) return { state: BotFsmState.NAME };

    try {
      return JSON.parse(raw) as BotSession;
    } catch {
      log('warn', 'bot.session.corrupt', '', { phone: maskPhone(phone) });
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
    const normalized = normalizePhoneForStorage(phone);
    const current = await this.getSession(normalized);
    const updated: BotSession = { ...current, ...data, state: newState };
    await this.redis.set(sessionKey(normalized), JSON.stringify(updated), SESSION_TTL_SECONDS);
  }

  /**
   * Marca el wamid como procesado en la sesión Redis para evitar doble procesamiento.
   */
  private async markWamidProcessed(phone: string, wamid: string): Promise<void> {
    const current = await this.getSession(phone);
    await this.redis.set(
      sessionKey(phone),
      JSON.stringify({ ...current, lastProcessedWamid: wamid }),
      SESSION_TTL_SECONDS,
    );
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

  /**
   * Reinicia la sesión de un ciudadano (ej: para re-registro).
   * Borra la sesión en Redis y regresa al estado NAME.
   */
  async resetSession(phone: string): Promise<void> {
    await this.redis.set(
      sessionKey(phone),
      JSON.stringify({ state: BotFsmState.NAME }),
      SESSION_TTL_SECONDS,
    );
  }

  // ─── Helpers de persistencia ─────────────────────────────────────────────

  /**
   * Persiste un mensaje INBOUND del ciudadano en su conversación activa.
   * Crea o reutiliza una conversación OPEN.
   */
  // private async persistInboundMessage(
  //   phone: string,
  //   text: string,
  //   waMessageId: string,
  // ): Promise<void> {
  //   const citizen = await this.prisma.citizen.findUnique({ where: { phone } });
  //   if (!citizen) return;

  //   const conversation = await this.ensureOpenConversation(citizen.id);

  //   await this.prisma.message.create({
  //     data: {
  //       conversationId: conversation.id,
  //       direction: MessageDirection.inbound,
  //       body: text,
  //       externalMessageId: waMessageId,
  //     },
  //   });
  // }

  /**
   * Busca una conversación OPEN para el ciudadano, o crea una nueva.
   *
   * @param citizenId - UUID del ciudadano en la DB
   */
  // private async ensureOpenConversation(citizenId: string) {
  //   const existing = await this.prisma.conversation.findFirst({
  //     where: { citizenId, status: ConversationStatus.open },
  //     include: { meta: true },
  //   });

  //   if (existing) {
  //     // Crear meta si no existe (B4: conversaciones sin meta causan throws en el orquestador)
  //     if (!existing.meta) {
  //       await this.prisma.conversationMeta.create({
  //         data: { conversationId: existing.id },
  //       });
  //     }
  //     return existing;
  //   }

  //   return this.prisma.conversation.create({
  //     data: {
  //       citizenId,
  //       status: ConversationStatus.open,
  //       meta: { create: { flowState: 'BOT_FLOW' } },
  //     },
  //   });
  // }

  // ─── Envío de mensajes outbound ───────────────────────────────────────────

  /**
   * Envía un mensaje de texto al ciudadano vía WhatsApp Cloud API.
   *
   * Cuando OutboxProcessorService está disponible (producción):
   *   1. Busca la conversación abierta del ciudadano
   *   2. Persiste un Message(direction=outbound) en DB
   *   3. Encola OutboxEvent → el worker maneja el HTTP call con retry
   *
   * Cuando OutboxProcessorService no está disponible (modo legacy/test):
   *   Envía directamente via WhatsAppProvider (comportamiento anterior).
   *
   * @param phone         - Número destino en formato DB canónico (sin +)
   * @param text          - Texto del mensaje a enviar
   * @param correlationId - ID de correlación para trazabilidad
   */
  private async sendMessage(phone: string, text: string, correlationId: string): Promise<void> {
    // ── Guard: WhatsApp Cloud API rechaza mensajes > 4096 chars ──
    if (text.length > WA_MAX_TEXT_LENGTH) {
      log('error', 'bot.reply.text_too_long', correlationId, {
        phone: maskPhone(phone),
        textLength: text.length,
        limit: WA_MAX_TEXT_LENGTH,
        preview: text.substring(0, 120),
      });
      const fallback =
        '⚠️ Tuvimos un problema mostrando la lista completa. Por favor escribí el nombre de tu colonia o escribí "lista" para ver las opciones.';
      try {
        await this.whatsappProvider.sendText(phone, fallback);
      } catch (fallbackErr) {
        log('error', 'bot.reply.fallback_failed', correlationId, {
          phone: maskPhone(phone),
          error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        });
      }
      return;
    }

    log('info', 'bot.reply.generated', correlationId, {
      phone: maskPhone(phone),
      textLength: text.length,
      preview: text.substring(0, 80),
    });

    // ── Ruta producción: outbox + persistencia ────────────────────────────
    if (this.outboxProcessor) {
      // Buscar conversación activa del ciudadano para vincular el mensaje
      const conv = await this.prisma.conversation.findFirst({
        where: { citizen: { phone }, status: ConversationStatus.open },
        select: { id: true },
      });

      // Persistir mensaje outbound en historial de la conversación
      if (this.messageRepo && conv) {
        await this.messageRepo.create({
          conversationId: conv.id,
          body: text,
          direction: MessageDirection.outbound,
          messageType: MessageType.text,
          meta: { source: 'bot' },
        });
      }

      // Construir payload WhatsApp y encolar.
      // normalizePhone garantiza formato E.164 con + requerido por la Meta Cloud API.
      const waPayload: WaTextOutbound = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizePhone(phone),
        type: 'text',
        text: { body: text, preview_url: false },
      };
      const idempotencyKey = `bot:${phone}:${crypto.randomUUID()}`;

      await this.outboxProcessor.enqueue(phone, waPayload, idempotencyKey, conv?.id);

      log('info', 'bot.reply.enqueued', correlationId, {
        phone: maskPhone(phone),
        conversationId: conv?.id,
      });
      return;
    }

    // ── Ruta legacy/test: envío directo (sin outbox) ──────────────────────
    try {
      const result = await this.whatsappProvider.sendText(phone, text);
      log('info', 'bot.reply.sent', correlationId, {
        phone: maskPhone(phone),
        wamid: result.messages?.[0]?.id,
      });
    } catch (err: unknown) {
      log('error', 'bot.reply.send_failed', correlationId, {
        phone: maskPhone(phone),
        error: err instanceof Error ? err.message : String(err),
      });
      // No relanzar: el error de envío no debe romper el procesamiento del mensaje inbound
    }
  }
}
