/**
 * SystemService — Operaciones de observabilidad de infraestructura.
 *
 * Expone acceso de solo lectura a audit_logs, inbox_events y outbox_events,
 * más acciones de control operativo (retry/reprocess) para eventos fallidos.
 *
 * Restricciones de diseño:
 * - Append-only para audit_logs: sin writes.
 * - Retry/Reprocess: solo para eventos en estado 'failed' o 'dead_lettered'.
 * - Re-encola directamente a Redis sin pasar por el flow de idempotencia
 *   de los processors (ya que el evento ya existe en DB).
 */
import * as crypto from 'crypto';

import { Prisma } from '@prisma/client';
import { z } from 'zod';

import type { WaOutboundMessage } from '../types/whatsapp.types';
import { AppError, NotFoundError } from '../utils/app-error';
import type { ParsedWebhookMessage } from '../utils/wa-message-parser';
import type { PrismaService } from './prisma.service';
import { RedisQueueService, type QueueItem } from './queue/redis-queue.service';
import type { RedisService } from './redis.service';

// ── Selects ───────────────────────────────────────────────────────────────────

const auditLogSelect = {
  id: true,
  actorId: true,
  action: true,
  targetType: true,
  targetId: true,
  metadata: true,
  ip: true,
  userAgent: true,
  createdAt: true,
} as const;

const inboxEventSelect = {
  id: true,
  wamid: true,
  phone: true,
  status: true,
  retryCount: true,
  lastError: true,
  lastErrorAt: true,
  idempotencyKey: true,
  createdAt: true,
  processedAt: true,
} as const;

const outboxEventSelect = {
  id: true,
  conversationId: true,
  phone: true,
  status: true,
  retryCount: true,
  nextRetryAt: true,
  lastError: true,
  wamid: true,
  idempotencyKey: true,
  createdAt: true,
  sentAt: true,
} as const;

// ── Zod schemas ───────────────────────────────────────────────────────────────

const IsoDateSchema = z
  .string()
  .refine((v) => !isNaN(Date.parse(v)), { message: 'Debe ser una fecha ISO válida' });

export const AuditLogFiltersSchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z.string().trim().min(1).max(100).optional(),
  targetType: z.string().trim().min(1).max(50).optional(),
  dateFrom: IsoDateSchema.optional(),
  dateTo: IsoDateSchema.optional(),
});

export const InboxEventFiltersSchema = z.object({
  status: z.enum(['pending', 'processing', 'processed', 'failed', 'dead_lettered']).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  dateFrom: IsoDateSchema.optional(),
  dateTo: IsoDateSchema.optional(),
  retryCountGte: z.coerce.number().int().min(0).optional(),
  retryCountLte: z.coerce.number().int().min(0).optional(),
});

export const OutboxEventFiltersSchema = z.object({
  status: z.enum(['pending', 'sending', 'sent', 'failed', 'dead_lettered']).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  dateFrom: IsoDateSchema.optional(),
  dateTo: IsoDateSchema.optional(),
  retryCountGte: z.coerce.number().int().min(0).optional(),
  retryCountLte: z.coerce.number().int().min(0).optional(),
});

export const SystemEventIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ── Types ─────────────────────────────────────────────────────────────────────

type AuditLogRecord = Prisma.AuditLogGetPayload<{ select: typeof auditLogSelect }>;
type InboxEventRecord = Prisma.InboxEventGetPayload<{ select: typeof inboxEventSelect }>;
type OutboxEventRecord = Prisma.OutboxEventGetPayload<{ select: typeof outboxEventSelect }>;

export type AuditLogFilters = z.infer<typeof AuditLogFiltersSchema>;
export type InboxEventFilters = z.infer<typeof InboxEventFiltersSchema>;
export type OutboxEventFilters = z.infer<typeof OutboxEventFiltersSchema>;

export type AuditLogResponse = {
  id: string;
  actorId: string | undefined;
  action: string;
  targetType: string;
  targetId: string | undefined;
  metadata: Record<string, unknown>;
  ip: string | undefined;
  userAgent: string | undefined;
  createdAt: Date;
};

export type InboxEventResponse = {
  id: string;
  wamid: string;
  phone: string;
  status: string;
  retryCount: number;
  lastError: string | undefined;
  lastErrorAt: Date | undefined;
  idempotencyKey: string | undefined;
  createdAt: Date;
  processedAt: Date | undefined;
};

export type OutboxEventResponse = {
  id: string;
  conversationId: string | undefined;
  phone: string;
  status: string;
  retryCount: number;
  nextRetryAt: Date | undefined;
  lastError: string | undefined;
  wamid: string | undefined;
  idempotencyKey: string;
  createdAt: Date;
  sentAt: Date | undefined;
};

export type SystemListResult<T> = {
  items: T[];
  meta: {
    nextCursor: string | undefined;
    hasNextPage: boolean;
    count: number;
  };
};

// ── Tipos internos de queue ───────────────────────────────────────────────────

interface OutboxQueuePayload {
  outboxEventId: string;
  phone: string;
  waPayload: WaOutboundMessage;
}

interface InboxQueuePayload {
  parsedMessage: ParsedWebhookMessage;
  inboxEventId: string;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export class SystemService {
  private readonly queue: RedisQueueService;

  constructor(
    private readonly prisma: PrismaService,
    redis: RedisService,
  ) {
    this.queue = new RedisQueueService(redis);
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────

  async listAuditLogs(params: {
    cursor: string | undefined;
    limit: number;
    filters: AuditLogFilters;
  }): Promise<SystemListResult<AuditLogResponse>> {
    const where: Prisma.AuditLogWhereInput = {};

    if (params.filters.actorId !== undefined) {
      where.actorId = params.filters.actorId;
    }

    if (params.filters.action !== undefined) {
      where.action = { contains: params.filters.action, mode: 'insensitive' };
    }

    if (params.filters.targetType !== undefined) {
      where.targetType = { equals: params.filters.targetType, mode: 'insensitive' };
    }

    if (params.filters.dateFrom !== undefined || params.filters.dateTo !== undefined) {
      where.createdAt = {
        ...(params.filters.dateFrom !== undefined
          ? { gte: new Date(params.filters.dateFrom) }
          : {}),
        ...(params.filters.dateTo !== undefined ? { lte: new Date(params.filters.dateTo) } : {}),
      };
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.limit + 1,
      ...(params.cursor !== undefined ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: auditLogSelect,
    });

    const hasNextPage = rows.length > params.limit;
    const items = hasNextPage ? rows.slice(0, params.limit) : rows;

    return {
      items: items.map((item) => this.toAuditLogResponse(item)),
      meta: {
        nextCursor: hasNextPage ? items[items.length - 1]?.id : undefined,
        hasNextPage,
        count: items.length,
      },
    };
  }

  // ── Inbox Events ──────────────────────────────────────────────────────────

  async listInboxEvents(params: {
    cursor: string | undefined;
    limit: number;
    filters: InboxEventFilters;
  }): Promise<SystemListResult<InboxEventResponse>> {
    const where: Prisma.InboxEventWhereInput = {};

    if (params.filters.status !== undefined) {
      where.status = params.filters.status;
    }

    if (params.filters.phone !== undefined) {
      where.phone = { contains: params.filters.phone, mode: 'insensitive' };
    }

    if (params.filters.dateFrom !== undefined || params.filters.dateTo !== undefined) {
      where.createdAt = {
        ...(params.filters.dateFrom !== undefined
          ? { gte: new Date(params.filters.dateFrom) }
          : {}),
        ...(params.filters.dateTo !== undefined ? { lte: new Date(params.filters.dateTo) } : {}),
      };
    }

    if (params.filters.retryCountGte !== undefined || params.filters.retryCountLte !== undefined) {
      where.retryCount = {
        ...(params.filters.retryCountGte !== undefined
          ? { gte: params.filters.retryCountGte }
          : {}),
        ...(params.filters.retryCountLte !== undefined
          ? { lte: params.filters.retryCountLte }
          : {}),
      };
    }

    const rows = await this.prisma.inboxEvent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.limit + 1,
      ...(params.cursor !== undefined ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: inboxEventSelect,
    });

    const hasNextPage = rows.length > params.limit;
    const items = hasNextPage ? rows.slice(0, params.limit) : rows;

    return {
      items: items.map((item) => this.toInboxEventResponse(item)),
      meta: {
        nextCursor: hasNextPage ? items[items.length - 1]?.id : undefined,
        hasNextPage,
        count: items.length,
      },
    };
  }

  // ── Outbox Events ─────────────────────────────────────────────────────────

  async listOutboxEvents(params: {
    cursor: string | undefined;
    limit: number;
    filters: OutboxEventFilters;
  }): Promise<SystemListResult<OutboxEventResponse>> {
    const where: Prisma.OutboxEventWhereInput = {};

    if (params.filters.status !== undefined) {
      where.status = params.filters.status;
    }

    if (params.filters.phone !== undefined) {
      where.phone = { contains: params.filters.phone, mode: 'insensitive' };
    }

    if (params.filters.dateFrom !== undefined || params.filters.dateTo !== undefined) {
      where.createdAt = {
        ...(params.filters.dateFrom !== undefined
          ? { gte: new Date(params.filters.dateFrom) }
          : {}),
        ...(params.filters.dateTo !== undefined ? { lte: new Date(params.filters.dateTo) } : {}),
      };
    }

    if (params.filters.retryCountGte !== undefined || params.filters.retryCountLte !== undefined) {
      where.retryCount = {
        ...(params.filters.retryCountGte !== undefined
          ? { gte: params.filters.retryCountGte }
          : {}),
        ...(params.filters.retryCountLte !== undefined
          ? { lte: params.filters.retryCountLte }
          : {}),
      };
    }

    const rows = await this.prisma.outboxEvent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.limit + 1,
      ...(params.cursor !== undefined ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: outboxEventSelect,
    });

    const hasNextPage = rows.length > params.limit;
    const items = hasNextPage ? rows.slice(0, params.limit) : rows;

    return {
      items: items.map((item) => this.toOutboxEventResponse(item)),
      meta: {
        nextCursor: hasNextPage ? items[items.length - 1]?.id : undefined,
        hasNextPage,
        count: items.length,
      },
    };
  }

  // ── Acciones operativas ───────────────────────────────────────────────────

  /**
   * Reintentar un OutboxEvent fallido.
   * Solo válido para status 'failed' | 'dead_lettered'.
   * Resetea counters, limpia error y re-encola en Redis.
   */
  async retryOutboxEvent(id: string): Promise<OutboxEventResponse> {
    const event = await this.prisma.outboxEvent.findUnique({ where: { id } });

    if (!event) {
      throw new NotFoundError(`OutboxEvent ${id} no encontrado`);
    }

    if (event.status !== 'failed' && event.status !== 'dead_lettered') {
      throw AppError.badRequest(
        `OutboxEvent debe estar en estado 'failed' o 'dead_lettered' para reintentar (estado actual: ${event.status})`,
      );
    }

    const updated = await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'pending',
        retryCount: 0,
        lastError: null,
        nextRetryAt: null,
      },
      select: outboxEventSelect,
    });

    const item: QueueItem<OutboxQueuePayload> = {
      id: crypto.randomUUID(),
      payload: {
        outboxEventId: id,
        phone: event.phone,
        waPayload: event.payload as unknown as WaOutboundMessage,
      },
      retryCount: 0,
      enqueuedAt: new Date().toISOString(),
      correlationId: event.idempotencyKey,
    };

    await this.queue.enqueueOutbox(item);

    return this.toOutboxEventResponse(updated);
  }

  /**
   * Reprocesar un InboxEvent fallido.
   * Solo válido para status 'failed' | 'dead_lettered'.
   * Resetea counters, limpia error y re-encola en Redis con el payload original.
   */
  async reprocessInboxEvent(id: string): Promise<InboxEventResponse> {
    const event = await this.prisma.inboxEvent.findUnique({ where: { id } });

    if (!event) {
      throw new NotFoundError(`InboxEvent ${id} no encontrado`);
    }

    if (event.status !== 'failed' && event.status !== 'dead_lettered') {
      throw AppError.badRequest(
        `InboxEvent debe estar en estado 'failed' o 'dead_lettered' para reprocesar (estado actual: ${event.status})`,
      );
    }

    const updated = await this.prisma.inboxEvent.update({
      where: { id },
      data: {
        status: 'pending',
        retryCount: 0,
        lastError: null,
        lastErrorAt: null,
        processedAt: null,
      },
      select: inboxEventSelect,
    });

    const parsedMessage = event.payload as unknown as ParsedWebhookMessage;

    const item: QueueItem<InboxQueuePayload> = {
      id: crypto.randomUUID(),
      payload: { parsedMessage, inboxEventId: id },
      retryCount: 0,
      enqueuedAt: new Date().toISOString(),
      correlationId: event.idempotencyKey ?? crypto.randomUUID(),
    };

    await this.queue.enqueueInbox(item);

    return this.toInboxEventResponse(updated);
  }

  // ── Mappers ───────────────────────────────────────────────────────────────

  private toAuditLogResponse(row: AuditLogRecord): AuditLogResponse {
    return {
      id: row.id,
      actorId: row.actorId ?? undefined,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId ?? undefined,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      ip: row.ip ?? undefined,
      userAgent: row.userAgent ?? undefined,
      createdAt: row.createdAt,
    };
  }

  private toInboxEventResponse(row: InboxEventRecord): InboxEventResponse {
    return {
      id: row.id,
      wamid: row.wamid,
      phone: row.phone,
      status: row.status,
      retryCount: row.retryCount,
      lastError: row.lastError ?? undefined,
      lastErrorAt: row.lastErrorAt ?? undefined,
      idempotencyKey: row.idempotencyKey ?? undefined,
      createdAt: row.createdAt,
      processedAt: row.processedAt ?? undefined,
    };
  }

  private toOutboxEventResponse(row: OutboxEventRecord): OutboxEventResponse {
    return {
      id: row.id,
      conversationId: row.conversationId ?? undefined,
      phone: row.phone,
      status: row.status,
      retryCount: row.retryCount,
      nextRetryAt: row.nextRetryAt ?? undefined,
      lastError: row.lastError ?? undefined,
      wamid: row.wamid ?? undefined,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt,
      sentAt: row.sentAt ?? undefined,
    };
  }
}
