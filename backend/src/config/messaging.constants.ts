/**
 * Constantes del sistema de mensajería.
 */

// ─── Redis key prefixes ───────────────────────────────────────────────────────
export const REDIS_KEYS = {
  /** Deduplicación de wamid inbound */
  WAMID_DEDUPE: (wamid: string) => `msg:dedupe:${wamid}`,

  /** Lock de conversación para ownership */
  CONVERSATION_LOCK: (conversationId: string) => `conv:lock:${conversationId}`,

  /** Idempotency key de webhook */
  WEBHOOK_IDEMPOTENCY: (key: string) => `wh:idem:${key}`,

  /** Queue inbox principal */
  INBOX_QUEUE: 'queue:inbox',

  /** Dead letter queue inbox */
  INBOX_DLQ: 'queue:inbox:dlq',

  /** Queue outbox principal */
  OUTBOX_QUEUE: 'queue:outbox',

  /** Dead letter queue outbox */
  OUTBOX_DLQ: 'queue:outbox:dlq',

  /** Rate limit por phone number (outbound) */
  RATE_LIMIT_OUTBOUND: (phone: string) => `rate:out:${phone}`,

  /** Bot session key */
  BOT_SESSION: (phone: string) => `bot:session:${phone}`,

  /** Estado de conversación en orquestador */
  CONV_STATE: (conversationId: string) => `conv:state:${conversationId}`,

  /** Idempotencia de mensajes outbound desde el dashboard (TTL 24h) */
  MSG_IDEMPOTENCY: (key: string) => `msg:idem:${key}`,
} as const;

// ─── Queue / Retry config ─────────────────────────────────────────────────────
export const QUEUE_CONFIG = {
  /** Intentos máximos antes de DLQ */
  MAX_RETRIES: 5,

  /** Delays exponenciales en segundos: 1s, 5s, 30s, 2min, 10min */
  RETRY_DELAYS_SECONDS: [1, 5, 30, 120, 600],

  /** TTL de wamid dedupe en segundos (24h) */
  WAMID_DEDUPE_TTL_SECONDS: 86_400,

  /** TTL de idempotency key (10 min) */
  IDEMPOTENCY_TTL_SECONDS: 600,

  /** TTL lock de conversación (5 min) */
  CONVERSATION_LOCK_TTL_SECONDS: 300,

  /** Máx mensajes outbound por teléfono por segundo */
  OUTBOUND_RATE_PER_SECOND: 10,

  /** Tamaño del batch del worker de inbox */
  INBOX_BATCH_SIZE: 10,

  /** Tamaño del batch del worker de outbox */
  OUTBOX_BATCH_SIZE: 20,
} as const;

// ─── Ventana de 24h ───────────────────────────────────────────────────────────
export const WINDOW_24H_SECONDS = 86_400;

// ─── Localización / Municipio ─────────────────────────────────────────────────
export const CINTALAPA_BOUNDS = {
  /** Bounding box aproximado del municipio de Cintalapa, Chiapas */
  lat: { min: 16.3, max: 16.9 },
  lon: { min: -93.9, max: -93.4 },
} as const;
