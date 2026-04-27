/**
 * Centraliza el registro de rutas de la API.
 * Mantiene el server.ts enfocado en la inicialización.
 */
import { Router, type Express, type Request, type Response } from 'express';

import { ConversationsController } from '../controllers/conversations.controller';
import { HandoverController } from '../controllers/handover.controller';
import { MessagesController } from '../controllers/messages.controller';
import { WebhookController } from '../controllers/webhook.controller';
import { AttendanceService } from '../services/attendance.service';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { BotService } from '../services/bot.service';
import { CitizensService } from '../services/citizens.service';
import { ConversationsService } from '../services/conversations.service';
import { DepartmentsService } from '../services/departments.service';
import { EventService } from '../services/event.service';
import { InboxProcessorService } from '../services/events/inbox-processor.service';
import { OutboxProcessorService } from '../services/events/outbox-processor.service';
import { LockoutService } from '../services/lockout.service';
import { MessageService } from '../services/message.service';
import { NeighborhoodsService } from '../services/neighborhoods.service';
import { ConversationStateMachine } from '../services/orchestrator/conversation-state-machine';
import { PrismaService } from '../services/prisma.service';
import { RedisService } from '../services/redis.service';
import { ConversationRepository } from '../services/repositories/conversation.repository';
import { MessageRepository } from '../services/repositories/message.repository';
import { SystemService } from '../services/system.service';
import { TagsService } from '../services/tags.service';
import { UserService } from '../services/user.service';
import { WebhookParserService } from '../services/whatsapp/webhook-parser.service';
import { WhatsAppProvider } from '../services/whatsapp/whatsapp.provider';
import { createAuthRouter } from './auth.routes';
import { createCitizensRouter } from './citizens.routes';
import { createConversationsRouter } from './conversations.routes';
import { createDepartmentsRouter } from './departments.routes';
import { createEventsRouter } from './events.routes';
import { createHandoverRouter } from './handover.routes';
import { createMessagesRouter } from './messages.routes';
import { createNeighborhoodsRouter } from './neighborhoods.routes';
import { createSystemRouter } from './system.routes';
import { createTagsRouter } from './tags.routes';
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
  const lockoutService = new LockoutService(deps.redis);
  const auditService = new AuditService(deps.prisma);
  const authService = new AuthService(deps.prisma, deps.redis, lockoutService);
  const userService = new UserService(deps.prisma);
  const neighborhoodsService = new NeighborhoodsService(deps.prisma);
  const tagsService = new TagsService(deps.prisma);
  const systemService = new SystemService(deps.prisma, deps.redis);
  const citizensService = new CitizensService(deps.prisma);
  const departmentsService = new DepartmentsService(deps.prisma);
  const attendanceService = new AttendanceService(deps.prisma);

  // ── Messaging Core ─────────────────────────────────────────────────────────
  const webhookParser = new WebhookParserService();
  const messageRepo = new MessageRepository(deps.prisma);
  const conversationRepo = new ConversationRepository(deps.prisma);
  const stateMachine = new ConversationStateMachine(conversationRepo);

  // outboxProcessor se crea antes de botService para inyectarlo como dep
  const outboxProcessor = new OutboxProcessorService(deps.prisma, deps.redis, whatsappProvider);

  const botService = new BotService(
    deps.prisma,
    deps.redis,
    whatsappProvider,
    outboxProcessor,
    messageRepo,
  );

  const inboxProcessor = new InboxProcessorService(
    deps.prisma,
    deps.redis,
    whatsappProvider,
    botService,
  );

  // Iniciar workers
  inboxProcessor.start();
  outboxProcessor.start();

  const eventService = new EventService(deps.prisma, outboxProcessor);

  // ── MessageService ─────────────────────────────────────────────────────────
  const messageService = new MessageService(deps.prisma, messageRepo, outboxProcessor, deps.redis);

  // ── Controllers ────────────────────────────────────────────────────────────
  const webhookController = new WebhookController(
    deps.prisma,
    inboxProcessor,
    webhookParser,
    messageRepo,
  );
  const messagesController = new MessagesController(outboxProcessor, messageService);
  const handoverController = new HandoverController(stateMachine, conversationRepo);
  const conversationsService = new ConversationsService(
    deps.prisma,
    conversationRepo,
    stateMachine,
  );
  const conversationsController = new ConversationsController(
    conversationsService,
    auditService,
    messageService,
  );

  // ── Rutas ──────────────────────────────────────────────────────────────────

  apiRouter.use('/webhook', createWebhookRouter(webhookController, deps.redis));
  apiRouter.use('/auth', createAuthRouter(authService, auditService, lockoutService));
  apiRouter.use('/admin', createUsersRouter(userService, auditService));
  apiRouter.use('/admin', createNeighborhoodsRouter(neighborhoodsService, auditService));
  apiRouter.use('/admin', createTagsRouter(tagsService, auditService));
  apiRouter.use('/citizens', createCitizensRouter(citizensService, auditService));
  apiRouter.use('/admin', createDepartmentsRouter(departmentsService, auditService));
  apiRouter.use('/admin', createEventsRouter(eventService, attendanceService, auditService));
  apiRouter.use('/messages', createMessagesRouter(messagesController));
  apiRouter.use('/handover', createHandoverRouter(handoverController));
  apiRouter.use('/conversations', createConversationsRouter(conversationsController));
  apiRouter.use('/system', createSystemRouter(systemService));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  app.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'Bienvenido a la API de Voz Ciudadana', version: '1.0.0' });
  });

  app.use('/api/v1', apiRouter);
}
