/**
 * Middleware de idempotencia para replay protection en webhooks de Meta.
 *
 * Meta puede reenviar el mismo webhook múltiples veces si no recibe 200 OK rápido.
 * Este middleware usa Redis para recordar los wamid ya procesados (TTL 24h)
 * y responde 200 inmediatamente si el evento ya fue procesado.
 */
import { NextFunction, Request, Response } from 'express';
import { QUEUE_CONFIG, REDIS_KEYS } from '../config/messaging.constants';
import { RedisService } from '../services/redis.service';
import { WaWebhookPayload } from '../types/whatsapp.types';

interface RequestWithRedis extends Request {
  redis?: RedisService;
}

/**
 * Crea el middleware de idempotencia con el RedisService inyectado.
 *
 * @param redis - Instancia de RedisService
 */
export function createIdempotencyMiddleware(redis: RedisService) {
  return async function idempotencyMiddleware(
    req: RequestWithRedis,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const payload = req.body as WaWebhookPayload | undefined;

      if (!payload?.entry) {
        next();
        return;
      }

      // Recolectar todos los wamid del payload
      const wamids: string[] = [];
      for (const entry of payload.entry) {
        for (const change of entry.changes ?? []) {
          for (const msg of change.value?.messages ?? []) {
            if (msg.id) wamids.push(msg.id);
          }
        }
      }

      if (wamids.length === 0) {
        next();
        return;
      }

      // Verificar si TODOS ya fueron procesados
      const checks = await Promise.all(wamids.map((id) => redis.get(REDIS_KEYS.WAMID_DEDUPE(id))));

      const allProcessed = checks.every((v) => v !== null);

      if (allProcessed) {
        // Replay detectado — responder 200 sin reprocessar
        res.status(200).json({ status: 'already_processed' });
        return;
      }

      // Marcar wamids nuevos como "en proceso" (se confirmarán en el worker)
      await Promise.all(
        wamids.map((id, i) =>
          checks[i] === null
            ? redis.set(
                REDIS_KEYS.WAMID_DEDUPE(id),
                'processing',
                QUEUE_CONFIG.WAMID_DEDUPE_TTL_SECONDS,
              )
            : Promise.resolve(),
        ),
      );

      next();
    } catch (err) {
      // Si Redis falla, dejar pasar (fail-open) para no perder mensajes
      console.error('[IdempotencyMiddleware] Error verificando idempotencia:', err);
      next();
    }
  };
}
