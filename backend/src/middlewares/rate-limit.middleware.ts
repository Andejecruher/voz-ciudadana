/**
 * Middlewares de rate limiting para endpoints de autenticación.
 *
 * Login middleware verifica:
 * 1. Rate limit por IP — limita la cantidad de requests en una ventana de tiempo.
 * 2. Lockout por identidad — bloquea la cuenta tras múltiples fallos.
 *
 * Refresh middleware verifica:
 * 1. Rate limit por IP — ventana más corta para detectar refresh flooding.
 *
 * El deviceId se resuelve en el middleware de login y se inyecta en req para
 * que el controlador lo pase al servicio:
 *
 *   Prioridad: header `x-device-id` > body.deviceId > UUID generado por request
 *
 * NOTA: El UUID generado por request NO persiste entre requests del mismo cliente.
 * Para multi-sesión real, el cliente DEBE enviar `x-device-id` (recomendado)
 * o `deviceId` en el body. Sin él, cada login crea una sesión distinta.
 */
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { LockoutService } from '../services/lockout.service';
import { AppError } from '../utils/app-error';

// Extender Request con deviceId resuelto
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** deviceId resuelto por el middleware loginRateLimitMiddleware */
      resolvedDeviceId?: string;
    }
  }
}

/** Resuelve la IP del cliente considerando proxies */
function resolveIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  return forwarded
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])?.trim() ?? 'unknown'
    : (req.socket?.remoteAddress ?? 'unknown');
}

/** Factory que retorna el middleware de login configurado con el LockoutService */
export function createLoginRateLimitMiddleware(lockout: LockoutService) {
  return async function loginRateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const ip = resolveIp(req);
      const ua = req.headers['user-agent'] ?? 'unknown';

      // ── Resolución de deviceId ───────────────────────────────────────────
      const deviceIdHeader = req.headers['x-device-id'];
      const deviceIdBody = (req.body as { deviceId?: string })?.deviceId;
      const resolvedDeviceId =
        (typeof deviceIdHeader === 'string' ? deviceIdHeader.trim() : undefined) ??
        (typeof deviceIdBody === 'string' ? deviceIdBody.trim() : undefined) ??
        crypto.randomUUID(); // fallback: UUID random por request (sesión anónima)

      req.resolvedDeviceId = resolvedDeviceId;

      // ── Rate limit por IP ────────────────────────────────────────────────
      await lockout.checkIpRateLimit(ip);

      // ── Lockout por identidad (si se proveyó email) ──────────────────────
      const email = (req.body as { email?: string })?.email;
      if (email && typeof email === 'string') {
        await lockout.checkLockout(email, { ip, userAgent: ua });
      }

      next();
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          error: err.message,
          ...(err.code ? { code: err.code } : {}),
        });
        return;
      }
      next(err);
    }
  };
}

/** Factory que retorna el middleware de rate-limit para refresh token */
export function createRefreshRateLimitMiddleware(lockout: LockoutService) {
  return async function refreshRateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const ip = resolveIp(req);
      await lockout.checkRefreshRateLimit(ip);
      next();
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          error: err.message,
          ...(err.code ? { code: err.code } : {}),
        });
        return;
      }
      next(err);
    }
  };
}
