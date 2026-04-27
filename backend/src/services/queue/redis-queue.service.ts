/**
 * RedisQueueService — Queue FIFO usando Redis Lists.
 *
 * Implementa inbox y outbox queues con:
 * - LPUSH para encolar
 * - BRPOP para consumir (blocking pop)
 * - Retries exponenciales con ZADD (sorted set por timestamp)
 * - Dead Letter Queue (DLQ)
 */
import { QUEUE_CONFIG, REDIS_KEYS } from '../../config/messaging.constants';
import { RedisService } from '../redis.service';

export interface QueueItem<T = unknown> {
  id: string;
  payload: T;
  retryCount: number;
  enqueuedAt: string;
  correlationId: string;
}

export class RedisQueueService {
  constructor(private readonly redis: RedisService) {}

  // ─── Inbox Queue ───────────────────────────────────────────────────────────

  /** Encola un evento de webhook recibido */
  async enqueueInbox<T>(item: QueueItem<T>): Promise<void> {
    await this.redis.client.lpush(REDIS_KEYS.INBOX_QUEUE, JSON.stringify(item));
  }

  /** Consume el siguiente item del inbox (non-blocking) */
  async dequeueInbox<T>(): Promise<QueueItem<T> | undefined> {
    const raw = await this.redis.client.rpop(REDIS_KEYS.INBOX_QUEUE);
    if (!raw) return undefined;
    return JSON.parse(raw) as QueueItem<T>;
  }

  /** Consume un batch de items del inbox */
  async dequeueInboxBatch<T>(
    size: number = QUEUE_CONFIG.INBOX_BATCH_SIZE,
  ): Promise<QueueItem<T>[]> {
    const items: QueueItem<T>[] = [];
    for (let i = 0; i < size; i++) {
      const item = await this.dequeueInbox<T>();
      if (!item) break;
      items.push(item);
    }
    return items;
  }

  /** Retorna la longitud actual del inbox */
  async inboxLength(): Promise<number> {
    return this.redis.client.llen(REDIS_KEYS.INBOX_QUEUE);
  }

  // ─── Outbox Queue ──────────────────────────────────────────────────────────

  /** Encola un mensaje a enviar a Meta */
  async enqueueOutbox<T>(item: QueueItem<T>): Promise<void> {
    await this.redis.client.lpush(REDIS_KEYS.OUTBOX_QUEUE, JSON.stringify(item));
  }

  /** Consume el siguiente item del outbox */
  async dequeueOutbox<T>(): Promise<QueueItem<T> | undefined> {
    const raw = await this.redis.client.rpop(REDIS_KEYS.OUTBOX_QUEUE);
    if (!raw) return undefined;
    return JSON.parse(raw) as QueueItem<T>;
  }

  /** Retorna la longitud actual del outbox */
  async outboxLength(): Promise<number> {
    return this.redis.client.llen(REDIS_KEYS.OUTBOX_QUEUE);
  }

  // ─── Retry con backoff exponencial ────────────────────────────────────────

  /**
   * Reencola un item con delay exponencial.
   * Usa Redis ZADD con score = timestamp futuro para diferir el reintento.
   */
  async retryWithBackoff<T>(item: QueueItem<T>, queue: 'inbox' | 'outbox'): Promise<void> {
    const retryCount = item.retryCount + 1;

    if (retryCount > QUEUE_CONFIG.MAX_RETRIES) {
      await this.sendToDLQ(item, queue);
      return;
    }

    const delaySeconds = QUEUE_CONFIG.RETRY_DELAYS_SECONDS[retryCount - 1] ?? 600;
    const retryAt = Date.now() + delaySeconds * 1000;

    const retryKey = queue === 'inbox' ? 'queue:inbox:retry' : 'queue:outbox:retry';
    const retryItem: QueueItem<T> = { ...item, retryCount };

    await this.redis.client.zadd(retryKey, retryAt, JSON.stringify(retryItem));
  }

  /**
   * Mueve items maduros de la retry sorted set a la queue principal.
   * Llamar periódicamente (cada 5s) desde el worker.
   */
  async promoteRetryItems(queue: 'inbox' | 'outbox'): Promise<number> {
    const retryKey = queue === 'inbox' ? 'queue:inbox:retry' : 'queue:outbox:retry';
    const mainKey = queue === 'inbox' ? REDIS_KEYS.INBOX_QUEUE : REDIS_KEYS.OUTBOX_QUEUE;

    const now = Date.now();
    const items = await this.redis.client.zrangebyscore(retryKey, '-inf', now);

    if (items.length === 0) return 0;

    // Mover items maduros a la queue principal
    const pipeline = this.redis.client.pipeline();
    for (const raw of items) {
      pipeline.lpush(mainKey, raw);
      pipeline.zrem(retryKey, raw);
    }
    await pipeline.exec();

    return items.length;
  }

  // ─── Dead Letter Queue ─────────────────────────────────────────────────────

  async sendToDLQ<T>(item: QueueItem<T>, queue: 'inbox' | 'outbox'): Promise<void> {
    const dlqKey = queue === 'inbox' ? REDIS_KEYS.INBOX_DLQ : REDIS_KEYS.OUTBOX_DLQ;
    await this.redis.client.lpush(
      dlqKey,
      JSON.stringify({ ...item, dlqAt: new Date().toISOString() }),
    );
    console.error(
      `[RedisQueueService] Item ${item.id} enviado a DLQ (${queue}) después de ${item.retryCount} intentos`,
    );
  }

  async dlqLength(queue: 'inbox' | 'outbox'): Promise<number> {
    const dlqKey = queue === 'inbox' ? REDIS_KEYS.INBOX_DLQ : REDIS_KEYS.OUTBOX_DLQ;
    return this.redis.client.llen(dlqKey);
  }

  // ─── Conversation locking ──────────────────────────────────────────────────

  /**
   * Adquiere un lock de conversación para ownership.
   * Usa SET NX EX para atomicidad.
   * @returns true si adquirió el lock, false si ya estaba tomado
   */
  async acquireConversationLock(conversationId: string, ownerId: string): Promise<boolean> {
    const key = REDIS_KEYS.CONVERSATION_LOCK(conversationId);
    const result = await this.redis.client.set(
      key,
      ownerId,
      'EX',
      QUEUE_CONFIG.CONVERSATION_LOCK_TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  /** Libera el lock de una conversación si somos el owner */
  async releaseConversationLock(conversationId: string, ownerId: string): Promise<void> {
    const key = REDIS_KEYS.CONVERSATION_LOCK(conversationId);
    const current = await this.redis.get(key);
    if (current === ownerId) {
      await this.redis.del(key);
    }
  }

  /** Verifica quién tiene el lock de una conversación */
  async getConversationLockOwner(conversationId: string): Promise<string | null> {
    return this.redis.get(REDIS_KEYS.CONVERSATION_LOCK(conversationId));
  }
}
