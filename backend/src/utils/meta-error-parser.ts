/**
 * Parser de errores de Meta Graph API.
 * Transforma las respuestas de error de la API en errores internos estructurados.
 */
import { getMetaErrorInfo } from '../config/meta-error-map';
import { WaApiError } from '../types/whatsapp.types';

export class MetaApiError extends Error {
  readonly code: number;
  readonly subcode?: number;
  readonly retryable: boolean;
  readonly fbtrace_id?: string;

  constructor(
    message: string,
    code: number,
    subcode?: number,
    retryable?: boolean,
    fbtrace_id?: string,
  ) {
    super(message);
    this.name = 'MetaApiError';
    this.code = code;
    this.subcode = subcode;
    const info = getMetaErrorInfo(code);
    this.retryable = retryable ?? info.retryable;
    this.fbtrace_id = fbtrace_id;
  }
}

/**
 * Parsea una respuesta de error de Meta y retorna un MetaApiError.
 */
export function parseMetaError(errorResponse: WaApiError): MetaApiError {
  const { error } = errorResponse;
  return new MetaApiError(
    error.message,
    error.code,
    error.error_subcode,
    undefined,
    error.fbtrace_id,
  );
}

/**
 * Verifica si un objeto desconocido es una respuesta de error de Meta.
 */
export function isMetaErrorResponse(body: unknown): body is WaApiError {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as WaApiError).error?.code === 'number'
  );
}

/**
 * Verifica si el error indica que estamos fuera de la ventana de 24h.
 */
export function isOutsideConversationWindow(code: number): boolean {
  return code === 131047;
}
