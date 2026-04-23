/**
 * AppRouter — configura y exporta el router de Express con todas las rutas.
 *
 * Wiring manual de dependencias:
 *   PrismaService → WhatsAppBotService → WebhookService → WebhookController
 *
 * Las instancias se reciben por parámetro para mantener la composición
 * en server.ts y facilitar el testing futuro.
 */
import { Router } from 'express';
import { WebhookController } from '../controller/webhook.controller';
import { WebhookService } from '../services/webhook.service';
import { WhatsAppBotService } from '../services/whatsapp-bot.service';
import { PrismaService } from '../services/prisma.service';
import { RedisService } from '../services/redis.service';

export interface AppServices {
  prisma: PrismaService;
  redis: RedisService;
}

/**
 * Construye y retorna el router principal de Express.
 * Recibe los servicios de infraestructura ya instanciados.
 */
export function createAppRouter(services: AppServices): Router {
  const router = Router();

  // ── Composición manual de servicios ──────────────────────────────────────────
  const botService = new WhatsAppBotService(services.prisma, services.redis);
  const webhookService = new WebhookService(botService);
  const webhookController = new WebhookController(webhookService);

  // ── Rutas del webhook de WhatsApp ─────────────────────────────────────────────
  router.get('/webhook', webhookController.verifyChallenge);
  router.post('/webhook', webhookController.handleIncoming);

  return router;
}
