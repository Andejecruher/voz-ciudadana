/**
 * Middleware de paginación cursor-based.
 *
 * Lee `cursor` y `limit` del query string, los valida y los inyecta en
 * `req.pagination` para que los controllers los pasen a los servicios.
 *
 * Estrategia cursor-based (vs offset):
 * - No sufre el problema de "skipped rows" al insertar/eliminar registros
 * - Eficiente en tablas grandes (usa índice del cursor en lugar de OFFSET)
 * - Ideal para feeds y listas paginadas en tiempo real
 *
 * Uso:
 *   router.get('/conversaciones', paginate(), handler)
 *   router.get('/leads',          paginate({ maxLimit: 50 }), handler)
 *
 * En el handler:
 *   const { cursor, limit } = req.pagination;
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../utils/app-error';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PaginationParams {
  /** Cursor opaco para la posición actual (undefined = primera página) */
  cursor: string | undefined;
  /** Cantidad de items a devolver (default: 20, max: configurable) */
  limit: number;
}

// Extender Request de Express globalmente para tipado en controllers
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      pagination: PaginationParams;
    }
  }
}

// ── Opciones ──────────────────────────────────────────────────────────────────

export interface PaginateOptions {
  /** Límite por defecto si no se provee en query (default: 20) */
  defaultLimit?: number;
  /** Límite máximo permitido (default: 100) */
  maxLimit?: number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Genera un middleware que parsea y valida los parámetros de paginación.
 * Inyecta `req.pagination` con los valores listos para usar.
 */
export function paginate(options: PaginateOptions = {}): RequestHandler {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;

  return (req: Request, _res: Response, next: NextFunction): void => {
    // ── cursor ────────────────────────────────────────────────────────────────
    const rawCursor = req.query['cursor'];
    const cursor = typeof rawCursor === 'string' && rawCursor.length > 0 ? rawCursor : undefined;

    // ── limit ─────────────────────────────────────────────────────────────────
    const rawLimit = req.query['limit'];
    let limit = defaultLimit;

    if (rawLimit !== undefined) {
      const parsed = Number(rawLimit);

      if (!Number.isInteger(parsed) || parsed < 1) {
        next(new AppError('limit must be a positive integer', 400, 'INVALID_PAGINATION'));
        return;
      }

      if (parsed > maxLimit) {
        next(
          new AppError(`limit cannot exceed ${maxLimit}`, 400, 'PAGINATION_LIMIT_EXCEEDED'),
        );
        return;
      }

      limit = parsed;
    }

    req.pagination = { cursor, limit };
    next();
  };
}
