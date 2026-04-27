/**
 * Centraliza el registro de rutas de la API.
 * Mantiene el server.ts enfocado en la inicialización.
 */
import { Router, type Express, type Request, type Response } from 'express';

import { HandoverController } from '../controllers/handover.controller';
import { MessagesController } from '../controllers/messages.controller';
import { WebhookController } from '../controllers/webhook.controller';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { BotService } from '../services/bot.service';
import { InboxProcessorService } from '../services/events/inbox-processor.service';
import { OutboxProcessorService } from '../services/events/outbox-processor.service';
import { LockoutService } from '../services/lockout.service';
import { ConversationStateMachine } from '../services/orchestrator/conversation-state-machine';
import { PrismaService } from '../services/prisma.service';
import { RedisService } from '../services/redis.service';
import { ConversationRepository } from '../services/repositories/conversation.repository';
import { MessageRepository } from '../services/repositories/message.repository';
import { UserService } from '../services/user.service';
import { WebhookParserService } from '../services/whatsapp/webhook-parser.service';
import { WhatsAppProvider } from '../services/whatsapp/whatsapp.provider';
import { createAuthRouter } from './auth.routes';
import { createHandoverRouter } from './handover.routes';
import { createMessagesRouter } from './messages.routes';
import { createUsersRouter } from './users.routes';
import { createWebhookRouter } from './webhook.routes';

type RouteDependencies = {
  prisma: PrismaService;
  redis: RedisService;
};

export function registerRoutes(app: Express, deps: RouteDependencies): void {
  const apiRouter = Router();

  // ── Servicios base ─────────────────────────────────────────────────────────
  const whatsappProvider = new WhatsAppProvider(deps.redis);
  const botService = new BotService(deps.prisma, deps.redis, whatsappProvider);
  const lockoutService = new LockoutService(deps.redis);
  const auditService = new AuditService(deps.prisma);
  const authService = new AuthService(deps.prisma, deps.redis, lockoutService);
  const userService = new UserService(deps.prisma);

  // ── Messaging Core ─────────────────────────────────────────────────────────
  const webhookParser = new WebhookParserService();
  const messageRepo = new MessageRepository(deps.prisma);
  const conversationRepo = new ConversationRepository(deps.prisma);
  const stateMachine = new ConversationStateMachine(conversationRepo);

  const inboxProcessor = new InboxProcessorService(
    deps.prisma,
    deps.redis,
    whatsappProvider,
    botService,
  );
  const outboxProcessor = new OutboxProcessorService(deps.prisma, deps.redis, whatsappProvider);

  // Iniciar workers
  inboxProcessor.start();
  outboxProcessor.start();

  // ── Controllers ────────────────────────────────────────────────────────────
  const webhookController = new WebhookController(
    deps.prisma,
    inboxProcessor,
    webhookParser,
    messageRepo,
  );
  const messagesController = new MessagesController(outboxProcessor);
  const handoverController = new HandoverController(stateMachine, conversationRepo);

  // ── Rutas ──────────────────────────────────────────────────────────────────

  apiRouter.use('/webhook', createWebhookRouter(webhookController, deps.redis));
  apiRouter.use('/auth', createAuthRouter(authService, auditService, lockoutService));
  apiRouter.use('/admin', createUsersRouter(userService, auditService));
  apiRouter.use('/messages', createMessagesRouter(messagesController));
  apiRouter.use('/handover', createHandoverRouter(handoverController));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  app.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'Bienvenido a la API de Voz Ciudadana', version: '1.0.0' });
  });

  app.use('/api/v1', apiRouter);
}
