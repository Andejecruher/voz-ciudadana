/**
 * Centraliza el registro de rutas de la API.
 * Mantiene el server.ts enfocado en la inicializacion.
 */
import { Router, type Express, type Request, type Response } from 'express';

import { WebhookController } from '../controllers/webhook.controller';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { BotService } from '../services/bot.service';
import { LockoutService } from '../services/lockout.service';
import { PrismaService } from '../services/prisma.service';
import { RedisService } from '../services/redis.service';
import { createAdminRouter } from './admin.routes';
import { createAuthRouter } from './auth.routes';
import { createWebhookRouter } from './webhook.routes';

type RouteDependencies = {
  prisma: PrismaService;
  redis: RedisService;
};

export function registerRoutes(app: Express, deps: RouteDependencies): void {
  // Router base para agrupar endpoints versionados.
  const apiRouter = Router();

  // ── Servicios ──────────────────────────────────────────────────────────────
  const botService = new BotService(deps.prisma, deps.redis);
  const lockoutService = new LockoutService(deps.redis);
  const auditService = new AuditService(deps.prisma);
  const authService = new AuthService(deps.prisma, deps.redis, lockoutService);

  // ── Controllers ────────────────────────────────────────────────────────────
  const webhookController = new WebhookController(botService);

  // ── Rutas ──────────────────────────────────────────────────────────────────

  // Webhook de WhatsApp/Meta
  apiRouter.use('/webhook', createWebhookRouter(webhookController));

  // Autenticación del panel admin
  apiRouter.use('/auth', createAuthRouter(authService, auditService, lockoutService));

  // Gestión de usuarios admin (solo SUPERADMIN)
  apiRouter.use('/admin', createAdminRouter(deps.prisma, auditService));

  // Healthcheck fuera del router versionado para acceso simple.
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // Registrar router versionado.
  app.use('/api/v1', apiRouter);
}
