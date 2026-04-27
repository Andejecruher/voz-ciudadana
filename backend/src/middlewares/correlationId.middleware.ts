/**
 * Middleware de Correlation ID.
 *
 * Agrega un ID único a cada request para trazabilidad end-to-end.
 * Si la request ya trae X-Correlation-Id lo propaga; si no, genera uno nuevo.
 * Lo expone en res.locals.correlationId para uso en servicios y logs.
 */
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      correlationId: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers['x-correlation-id'];
  const correlationId =
    typeof existing === 'string' && existing.length > 0
      ? existing
      : crypto.randomUUID();

  res.locals.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  next();
}
