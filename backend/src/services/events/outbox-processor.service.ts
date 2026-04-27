/**
 * OutboxProcessorService — Worker que consume la queue de eventos outbound y los envía a Meta.
 */
import * as crypto from 'crypto';
import { WaOutboundMessage } from '../../types/whatsapp.types';
import { PrismaService } from '../prisma.service';
import { QueueItem, RedisQueueService } from '../queue/redis-queue.service';
import { RedisService } from '../redis.service';
import { WhatsAppProvider } from '../whatsapp/whatsapp.provider';

interface OutboxQueuePayload {
  outboxEventId: string;
  phone: string;
  waPayload: WaOutboundMessage;
}

export class OutboxProcessorService {
  private readonly queue: RedisQueueService;
  private isRunning = false;
  private intervalHandle: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    redis: RedisService,
    private readonly whatsappProvider: WhatsAppProvider,
  ) {
    this.queue = new RedisQueueService(redis);
  }

  /**
   * Persiste un OutboxEvent en DB y lo encola en Redis.
   */
  async enqueue(
    phone: string,
    waPayload: WaOutboundMessage,
    idempotencyKey: string,
    conversationId?: string,
  ): Promise<void> {
    // Idempotencia: si ya existe el outbox event, ignorar
    const existing = await this.prisma.outboxEvent.findUnique({ where: { idempotencyKey } });
    if (existing) {
      console.debug(`[OutboxProcessor] Outbox event ${idempotencyKey} ya existe, ignorando`);
      return;
    }

    const outboxEvent = await this.prisma.outboxEvent.create({
      data: {
        phone,
        payload: waPayload as object,
        idempotencyKey,
        conversationId,
      },
    });

    const item: QueueItem<OutboxQueuePayload> = {
      id: crypto.randomUUID(),
      payload: { outboxEventId: outboxEvent.id, phone, waPayload },
      retryCount: 0,
      enqueuedAt: new Date().toISOString(),
      correlationId: idempotencyKey,
    };

    await this.queue.enqueueOutbox(item);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalHandle = setInterval(() => {
      this.processNextBatch().catch((err: unknown) => {
        console.error('[OutboxProcessor] Error en batch:', err);
      });
      this.queue.promoteRetryItems('outbox').catch(() => undefined);
    }, 200);
    console.log('[OutboxProcessor] Worker iniciado');
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
    this.isRunning = false;
  }

  private async processNextBatch(): Promise<void> {
    const items: QueueItem<OutboxQueuePayload>[] = [];
    for (let i = 0; i < 20; i++) {
      const item = await this.queue.dequeueOutbox<OutboxQueuePayload>();
      if (!item) break;
      items.push(item);
    }
    await Promise.allSettled(items.map((item) => this.processItem(item)));
  }

  private async processItem(item: QueueItem<OutboxQueuePayload>): Promise<void> {
    const { outboxEventId, waPayload } = item.payload;

    try {
      await this.prisma.outboxEvent.update({
        where: { id: outboxEventId },
        data: { status: 'sending' },
      });

      const response = await this.whatsappProvider.send(waPayload);
      const wamid = response.messages?.[0]?.id;

      await this.prisma.outboxEvent.update({
        where: { id: outboxEventId },
        data: { status: 'sent', sentAt: new Date(), wamid },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[OutboxProcessor] Error enviando ${outboxEventId}:`, errorMsg);

      const retryCount = item.retryCount + 1;
      await this.prisma.outboxEvent.update({
        where: { id: outboxEventId },
        data: {
          retryCount: { increment: 1 },
          lastError: errorMsg,
          status: retryCount > 5 ? 'dead_lettered' : 'failed',
        },
      });

      await this.queue.retryWithBackoff(item, 'outbox');
    }
  }
}
