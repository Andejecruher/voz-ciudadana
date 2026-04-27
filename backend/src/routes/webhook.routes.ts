/**
 * Rutas del webhook de WhatsApp Cloud API.
 *
 * GET  /webhook → verifyWebhookChallenge
 * POST /webhook → correlationId → metaSignature → idempotency → receiveWebhookMessage
 */
import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { correlationIdMiddleware } from '../middlewares/correlationId.middleware';
import { createIdempotencyMiddleware } from '../middlewares/idempotency.middleware';
import { metaSignatureMiddleware } from '../middlewares/metaSignature.middleware';
import { RedisService } from '../services/redis.service';

export function createWebhookRouter(controller: WebhookController, redis: RedisService): Router {
  const router = Router();
  const idempotencyMiddleware = createIdempotencyMiddleware(redis);

  /** GET /webhook — verificación de suscripción por Meta */
  router.get('/', controller.verifyWebhookChallenge);

  /**
   * POST /webhook
   * Pipeline de middlewares:
   * 1. correlationId   → genera X-Correlation-Id
   * 2. metaSignature   → valida HMAC-SHA256
   * 3. idempotency     → replay protection por wamid
   * 4. controller      → persiste InboxEvent + encola
   */
  router.post(
    '/',
    correlationIdMiddleware,
    metaSignatureMiddleware,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    idempotencyMiddleware,
    controller.receiveWebhookMessage,
  );

  return router;
}
