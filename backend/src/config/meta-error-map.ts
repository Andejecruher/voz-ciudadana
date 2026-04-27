/**
 * Mapa de códigos de error de Meta Graph API a mensajes internos.
 * Referencia: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */

export interface MetaErrorInfo {
  code: number;
  title: string;
  retryable: boolean;
  userMessage?: string;
}

export const META_ERROR_MAP: Record<number, MetaErrorInfo> = {
  // Auth
  0: { code: 0, title: 'AuthException', retryable: false },
  190: { code: 190, title: 'Invalid OAuth Access Token', retryable: false },

  // Rate limits
  4: { code: 4, title: 'Application Request Limit', retryable: true },
  80007: { code: 80007, title: 'Rate Limit', retryable: true },
  130429: { code: 130429, title: 'Rate limit hit', retryable: true },
  131048: { code: 131048, title: 'Spam rate limit hit', retryable: true },
  131056: { code: 131056, title: 'Pair rate limit hit', retryable: true },

  // Template
  132000: { code: 132000, title: 'Template param count mismatch', retryable: false },
  132001: { code: 132001, title: 'Template does not exist', retryable: false },
  132005: { code: 132005, title: 'Template hydrated text too long', retryable: false },
  132007: { code: 132007, title: 'Template format char policy violated', retryable: false },
  132012: { code: 132012, title: 'Template param format mismatch', retryable: false },
  132015: { code: 132015, title: 'Template paused', retryable: false },
  132016: { code: 132016, title: 'Template disabled', retryable: false },

  // Messaging
  130472: { code: 130472, title: 'User number part of experiment', retryable: false },
  131000: { code: 131000, title: 'Generic error', retryable: true },
  131005: { code: 131005, title: 'Access denied', retryable: false },
  131008: { code: 131008, title: 'Required parameter missing', retryable: false },
  131009: { code: 131009, title: 'Parameter value invalid (e.g. text.body exceeds 4096 chars)', retryable: false, userMessage: 'El mensaje era demasiado largo para enviarse.' },
  131016: { code: 131016, title: 'Service unavailable', retryable: true },
  131021: { code: 131021, title: 'Recipient not in allowed list', retryable: false },
  131026: {
    code: 131026,
    title: 'Message undeliverable',
    retryable: false,
    userMessage: 'No se pudo entregar el mensaje al destinatario.',
  },
  131042: { code: 131042, title: 'Business eligibility payment issue', retryable: false },
  131045: { code: 131045, title: 'Pre-verification blocked', retryable: false },
  131047: {
    code: 131047,
    title: 'Re-engagement message outside window',
    retryable: false,
    userMessage: 'La ventana de 24h ha cerrado. Se requiere template.',
  },
  131051: { code: 131051, title: 'Unsupported message type', retryable: false },
  131052: { code: 131052, title: 'Media download error', retryable: true },
  131053: { code: 131053, title: 'Media upload error', retryable: true },

  // Internal
  1: { code: 1, title: 'Internal error', retryable: true },
  2: { code: 2, title: 'Service unavailable', retryable: true },
  100: { code: 100, title: 'Invalid parameter', retryable: false },
  200: { code: 200, title: 'Permission error', retryable: false },
};

/** Retorna info del error; fallback genérico si no está mapeado */
export function getMetaErrorInfo(code: number): MetaErrorInfo {
  return (
    META_ERROR_MAP[code] ?? {
      code,
      title: 'Unknown Meta error',
      retryable: code >= 131000, // heurístico: errores 131xxx internos pueden reintentarse
    }
  );
}
