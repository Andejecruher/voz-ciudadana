/**
 * Utilidad para respuestas API uniformes.
 *
 * Todas las respuestas del panel siguen este contrato:
 * - Éxito:    { success: true,  data: T,      meta?: PaginationMeta }
 * - Error:    { success: false, error: string, code?: string }
 *
 * No usar `null` — ausencia de dato se expresa con `undefined` (campo omitido).
 */
import type { Response } from 'express';

// ── Tipos de respuesta ────────────────────────────────────────────────────────

export interface PaginationMeta {
  /** Cursor opaco para la próxima página */
  nextCursor: string | undefined;
  /** Cursor opaco para la página anterior */
  prevCursor: string | undefined;
  /** Cantidad de items en la respuesta actual */
  count: number;
  /** Indica si hay más páginas hacia adelante */
  hasNextPage: boolean;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// ── Helpers de construcción ───────────────────────────────────────────────────

/**
 * Construye el objeto de respuesta exitosa.
 * Uso: `res.status(200).json(ok(data))`
 */
export function ok<T>(data: T, meta?: PaginationMeta): SuccessResponse<T> {
  const response: SuccessResponse<T> = { success: true, data };
  if (meta !== undefined) {
    response.meta = meta;
  }
  return response;
}

/**
 * Construye el objeto de respuesta de error.
 * Uso: `res.status(400).json(fail('Mensaje', 'ERROR_CODE'))`
 */
export function fail(error: string, code?: string): ErrorResponse {
  const response: ErrorResponse = { success: false, error };
  if (code !== undefined) {
    response.code = code;
  }
  return response;
}

// ── Helpers de envío directo ──────────────────────────────────────────────────

/**
 * Envía una respuesta 200 exitosa con datos.
 */
export function sendOk<T>(res: Response, data: T, meta?: PaginationMeta): void {
  res.status(200).json(ok(data, meta));
}

/**
 * Envía una respuesta 201 Created con datos.
 */
export function sendCreated<T>(res: Response, data: T): void {
  res.status(201).json(ok(data));
}

/**
 * Envía una respuesta 204 No Content (sin body).
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}
