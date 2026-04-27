/**
 * InboxProcessorService — Worker que consume la queue de eventos inbound y los procesa.
 *
 * Flujo:
 * InboxEvent(DB) → Redis queue → worker → MessageOrchestratorService
 */
import * as crypto from 'crypto';
import { REDIS_KEYS } from '../../config/messaging.constants';
import { ParsedWebhookMessage } from '../../utils/wa-message-parser';
import { BotService } from '../bot.service';
import { ConversationStateMachine } from '../orchestrator/conversation-state-machine';
import { DepartmentRouterStrategy } from '../orchestrator/department-router.strategy';
import { MessageOrchestratorService } from '../orchestrator/message-orchestrator.service';
import { PrismaService } from '../prisma.service';
import { QueueItem, RedisQueueService } from '../queue/redis-queue.service';
import { RedisService } from '../redis.service';
import { CitizenRepository } from '../repositories/citizen.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { MessageRepository } from '../repositories/message.repository';
import { WhatsAppProvider } from '../whatsapp/whatsapp.provider';

interface InboxQueuePayload {
  parsedMessage: ParsedWebhookMessage;
  inboxEventId: string;
}

export class InboxProcessorService {
  private readonly queue: RedisQueueService;
  private isRunning = false;
  private intervalHandle: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly whatsappProvider: WhatsAppProvider,
    private readonly botService: BotService,
  ) {
    this.queue = new RedisQueueService(redis);
  }

  /**
   * Encola un mensaje inbound para procesamiento asíncrono.
   */
  async enqueue(parsedMessage: ParsedWebhookMessage, inboxEventId: string): Promise<void> {
    const item: QueueItem<InboxQueuePayload> = {
      id: crypto.randomUUID(),
      payload: { parsedMessage, inboxEventId },
      retryCount: 0,
      enqueuedAt: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
    };
    await this.queue.enqueueInbox(item);
  }

  /**
   * Inicia el worker poll loop (cada 500ms).
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalHandle = setInterval(() => {
      this.processNextBatch().catch((err: unknown) => {
        console.error('[InboxProcessor] Error en batch:', err);
      });
      // Promover retries maduros
      this.queue.promoteRetryItems('inbox').catch(() => undefined);
    }, 500);
    console.log('[InboxProcessor] Worker iniciado');
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
    this.isRunning = false;
    console.log('[InboxProcessor] Worker detenido');
  }

  private async processNextBatch(): Promise<void> {
    const items = await this.queue.dequeueInboxBatch<InboxQueuePayload>();
    for (const item of items) {
      await this.processItem(item);
    }
  }

  private async processItem(item: QueueItem<InboxQueuePayload>): Promise<void> {
    const { parsedMessage, inboxEventId } = item.payload;

    try {
      // Marcar evento en DB como processing
      await this.prisma.inboxEvent.update({
        where: { id: inboxEventId },
        data: { status: 'processing' },
      });

      const orchestrator = this.buildOrchestrator(item.correlationId);
      await orchestrator.handleInboundMessage(
        parsedMessage.phone,
        parsedMessage.message,
        parsedMessage.profileName,
      );

      // Marcar como procesado
      await this.prisma.inboxEvent.update({
        where: { id: inboxEventId },
        data: { status: 'processed', processedAt: new Date() },
      });

      // Confirmar wamid en Redis como procesado
      await this.redis.set(
        REDIS_KEYS.WAMID_DEDUPE(parsedMessage.wamid),
        'processed',
        86_400, // 24h
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[InboxProcessor] Error procesando ${parsedMessage.wamid}:`, errorMsg);

      await this.prisma.inboxEvent.update({
        where: { id: inboxEventId },
        data: {
          retryCount: { increment: 1 },
          lastError: errorMsg,
          lastErrorAt: new Date(),
          status: item.retryCount >= 4 ? 'dead_lettered' : 'failed',
        },
      });

      await this.queue.retryWithBackoff(item, 'inbox');
    }
  }

  private buildOrchestrator(correlationId: string): MessageOrchestratorService {
    const citizenRepo = new CitizenRepository(this.prisma);
    const conversationRepo = new ConversationRepository(this.prisma);
    const messageRepo = new MessageRepository(this.prisma);
    const stateMachine = new ConversationStateMachine(conversationRepo);
    const deptRouter = new DepartmentRouterStrategy(this.prisma);

    return new MessageOrchestratorService(
      citizenRepo,
      conversationRepo,
      messageRepo,
      stateMachine,
      deptRouter,
      this.botService,
      this.whatsappProvider,
      correlationId,
    );
  }
}
