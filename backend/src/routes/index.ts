/**
 * Centraliza el registro de rutas de la API.
 * Mantiene el server.ts enfocado en la inicializacion.
 */
import { Router, type Express, type Request, type Response } from 'express';

import { WebhookController } from '../controllers/webhook.controller';
import { BotService } from '../services/bot.service';
import { PrismaService } from '../services/prisma.service';
import { RedisService } from '../services/redis.service';
import { createWebhookRouter } from './webhook.routes';

type RouteDependencies = {
  prisma: PrismaService;
  redis: RedisService;
};

export function registerRoutes(app: Express, deps: RouteDependencies): void {
  // Router base para agrupar endpoints versionados.
  const apiRouter = Router();

  // Wiring del modulo webhook (servicio -> controller -> router).
  const botService = new BotService(deps.prisma, deps.redis);
  const webhookController = new WebhookController(botService);

  // Endpoints del webhook bajo /api/v1/webhook.
  apiRouter.use('/webhook', createWebhookRouter(webhookController));

  // Healthcheck fuera del router versionado para acceso simple.
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // Registrar router versionado.
  app.use('/api/v1', apiRouter);
}
