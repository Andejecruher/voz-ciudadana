/**
 * Middleware global de manejo de errores para Express.
 *
 * Captura TODOS los errores no manejados en la cadena de middlewares/rutas.
 * Normaliza la respuesta a { success: false, error, code? }.
 *
 * Orden de procesamiento:
 * 1. AppError (y subclases) → statusCode + code del error
 * 2. Error genérico de JS   → 500 sin exponer detalles internos
 * 3. Valor desconocido      → 500 fallback
 *
 * IMPORTANTE: Este middleware debe registrarse DESPUÉS de todas las rutas
 * para que Express lo reconozca como error handler (4 parámetros).
 */
import { NextFunction, Request, Response } from 'express';
import { AppError, ValidationError } from '../utils/app-error';
import { fail } from '../utils/api-response';

/**
 * Error handler de 4 parámetros — Express lo identifica por la aridad.
 * El parámetro `_next` es OBLIGATORIO aunque no se use.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // ── ValidationError: incluye issues detallados ────────────────────────────
  if (err instanceof ValidationError) {
    res.status(400).json({
      ...fail(err.message, err.code),
      issues: err.issues,
    });
    return;
  }

  // ── AppError y subclases: usar statusCode + code del error ────────────────
  if (err instanceof AppError) {
    res.status(err.statusCode).json(fail(err.message, err.code));
    return;
  }

  // ── Error estándar JS: loguear pero no exponer stack trace ────────────────
  if (err instanceof Error) {
    console.error('[ErrorHandler] Unhandled error:', err.message, err.stack);
    res.status(500).json(fail('Internal server error', 'INTERNAL_ERROR'));
    return;
  }

  // ── Valor desconocido (string, número, etc.) ──────────────────────────────
  console.error('[ErrorHandler] Unknown thrown value:', err);
  res.status(500).json(fail('Internal server error', 'INTERNAL_ERROR'));
}
