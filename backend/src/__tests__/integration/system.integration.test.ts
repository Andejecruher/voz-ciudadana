/**
 * Tests de integración para los endpoints del sistema operacional.
 *
 * Rutas probadas:
 *   GET  /api/v1/system/audit-logs
 *   GET  /api/v1/system/inbox-events
 *   GET  /api/v1/system/outbox-events
 *   POST /api/v1/system/outbox-events/:id/retry
 *   POST /api/v1/system/inbox-events/:id/reprocess
 *
 * Todos requieren SUPERADMIN. Se mockea authMiddleware con el mismo
 * patrón del resto de tests de integración del proyecto.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { createSystemRouter } from '../../routes/system.routes';
import { AppError, NotFoundError } from '../../utils/app-error';
import { createTestApp } from '../setup/test-app';

jest.mock('../../middlewares/auth.middleware', () => ({
  authMiddleware: (
    req: { headers: Record<string, string | undefined>; user?: unknown },
    res: { status: (code: number) => { json: (payload: Record<string, unknown>) => void } },
    next: () => void,
  ) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice('Bearer '.length);
    if (!token.startsWith('role:')) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const roles = token
      .slice('role:'.length)
      .split(',')
      .filter((role) => role.length > 0);

    req.user = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'admin@vozciudadana.gob',
      fullName: 'Admin Test',
      roles,
    };

    next();
  },
}));

// ── Tipos helpers ─────────────────────────────────────────────────────────────

type AsyncFn<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

// ── Mock del servicio ─────────────────────────────────────────────────────────

const systemService = {
  listAuditLogs: jest.fn<
    AsyncFn<
      [{ cursor: string | undefined; limit: number; filters: Record<string, unknown> }],
      {
        items: unknown[];
        meta: { nextCursor: string | undefined; hasNextPage: boolean; count: number };
      }
    >
  >(),
  listInboxEvents: jest.fn<
    AsyncFn<
      [{ cursor: string | undefined; limit: number; filters: Record<string, unknown> }],
      {
        items: unknown[];
        meta: { nextCursor: string | undefined; hasNextPage: boolean; count: number };
      }
    >
  >(),
  listOutboxEvents: jest.fn<
    AsyncFn<
      [{ cursor: string | undefined; limit: number; filters: Record<string, unknown> }],
      {
        items: unknown[];
        meta: { nextCursor: string | undefined; hasNextPage: boolean; count: number };
      }
    >
  >(),
  retryOutboxEvent: jest.fn<AsyncFn<[string], Record<string, unknown>>>(),
  reprocessInboxEvent: jest.fn<AsyncFn<[string], Record<string, unknown>>>(),
};

const app = createTestApp((_, router) => {
  router.use('/api/v1/system', createSystemRouter(systemService as unknown as never));
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AUDIT_LOG_FIXTURE = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  actorId: '550e8400-e29b-41d4-a716-446655440001',
  action: 'user.create',
  targetType: 'User',
  targetId: '550e8400-e29b-41d4-a716-446655440002',
  metadata: {},
  ip: '127.0.0.1',
  userAgent: 'test-agent',
  createdAt: new Date().toISOString(),
};

const INBOX_EVENT_FIXTURE = {
  id: '550e8400-e29b-41d4-a716-446655440020',
  wamid: 'wamid_test_001',
  phone: '+5491123456789',
  status: 'failed',
  retryCount: 3,
  lastError: 'Connection timeout',
  lastErrorAt: new Date().toISOString(),
  idempotencyKey: 'wamid_test_001',
  createdAt: new Date().toISOString(),
  processedAt: undefined,
};

const OUTBOX_EVENT_FIXTURE = {
  id: '550e8400-e29b-41d4-a716-446655440030',
  conversationId: '550e8400-e29b-41d4-a716-446655440003',
  phone: '+5491187654321',
  status: 'failed',
  retryCount: 5,
  nextRetryAt: undefined,
  lastError: 'Meta API error 500',
  wamid: undefined,
  idempotencyKey: 'idem_outbox_001',
  createdAt: new Date().toISOString(),
  sentAt: undefined,
};

const LIST_META_EMPTY = { nextCursor: undefined, hasNextPage: false, count: 0 };
const LIST_META_SINGLE = { nextCursor: undefined, hasNextPage: false, count: 1 };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('System operational APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /audit-logs ────────────────────────────────────────────────────────

  describe('GET /api/v1/system/audit-logs', () => {
    it('devuelve 401 sin token', async () => {
      const res = await request(app).get('/api/v1/system/audit-logs');
      expect(res.status).toBe(401);
    });

    it('devuelve 403 a COORDINADOR', async () => {
      const res = await request(app)
        .get('/api/v1/system/audit-logs')
        .set('Authorization', 'Bearer role:COORDINADOR');
      expect(res.status).toBe(403);
      expect(systemService.listAuditLogs).not.toHaveBeenCalled();
    });

    it('devuelve 200 con lista vacía a SUPERADMIN', async () => {
      systemService.listAuditLogs.mockResolvedValue({ items: [], meta: LIST_META_EMPTY });

      const res = await request(app)
        .get('/api/v1/system/audit-logs')
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(200);
      expect((res.body as { auditLogs: unknown[] }).auditLogs).toEqual([]);
    });

    it('devuelve 200 con auditorías y meta correcta', async () => {
      systemService.listAuditLogs.mockResolvedValue({
        items: [AUDIT_LOG_FIXTURE],
        meta: LIST_META_SINGLE,
      });

      const res = await request(app)
        .get('/api/v1/system/audit-logs')
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(200);
      const body = res.body as { auditLogs: unknown[]; meta: { count: number } };
      expect(body.auditLogs).toHaveLength(1);
      expect(body.meta.count).toBe(1);
    });

    it('pasa filtros action, targetType y dateFrom/dateTo al servicio', async () => {
      systemService.listAuditLogs.mockResolvedValue({ items: [], meta: LIST_META_EMPTY });

      await request(app)
        .get(
          '/api/v1/system/audit-logs?action=user.create&targetType=User&dateFrom=2024-01-01&dateTo=2024-12-31&limit=10',
        )
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(systemService.listAuditLogs).toHaveBeenCalledWith({
        cursor: undefined,
        limit: 10,
        filters: {
          action: 'user.create',
          targetType: 'User',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        },
      });
    });

    it('pasa cursor y actorId al servicio', async () => {
      systemService.listAuditLogs.mockResolvedValue({ items: [], meta: LIST_META_EMPTY });

      const actorId = '550e8400-e29b-41d4-a716-446655440001';
      const cursor = '550e8400-e29b-41d4-a716-446655440099';

      await request(app)
        .get(`/api/v1/system/audit-logs?actorId=${actorId}&cursor=${cursor}`)
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(systemService.listAuditLogs).toHaveBeenCalledWith({
        cursor,
        limit: 20,
        filters: { actorId },
      });
    });

    it('devuelve 400 con actorId inválido (no UUID)', async () => {
      const res = await request(app)
        .get('/api/v1/system/audit-logs?actorId=no-es-uuid')
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(400);
      expect(systemService.listAuditLogs).not.toHaveBeenCalled();
    });

    it('devuelve 400 con dateFrom no ISO', async () => {
      const res = await request(app)
        .get('/api/v1/system/audit-logs?dateFrom=not-a-date')
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(400);
    });
  });

  // ── GET /inbox-events ──────────────────────────────────────────────────────

  describe('GET /api/v1/system/inbox-events', () => {
    it('devuelve 401 sin token', async () => {
      const res = await request(app).get('/api/v1/system/inbox-events');
      expect(res.status).toBe(401);
    });

    it('devuelve 403 a OPERADOR_CHAT', async () => {
      const res = await request(app)
        .get('/api/v1/system/inbox-events')
        .set('Authorization', 'Bearer role:OPERADOR_CHAT');
      expect(res.status).toBe(403);
    });

    it('devuelve 200 con inbox events a SUPERADMIN', async () => {
      systemService.listInboxEvents.mockResolvedValue({
        items: [INBOX_EVENT_FIXTURE],
        meta: LIST_META_SINGLE,
      });

      const res = await request(app)
        .get('/api/v1/system/inbox-events')
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(200);
      const body = res.body as { inboxEvents: unknown[] };
      expect(body.inboxEvents).toHaveLength(1);
    });

    it('pasa filtros status, phone, retryCount al servicio', async () => {
      systemService.listInboxEvents.mockResolvedValue({ items: [], meta: LIST_META_EMPTY });

      await request(app)
        .get(
          '/api/v1/system/inbox-events?status=failed&phone=5491123456789&retryCountGte=2&retryCountLte=5',
        )
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(systemService.listInboxEvents).toHaveBeenCalledWith({
        cursor: undefined,
        limit: 20,
        filters: {
          status: 'failed',
          phone: '5491123456789',
          retryCountGte: 2,
          retryCountLte: 5,
        },
      });
    });

    it('devuelve 400 con status inválido', async () => {
      const res = await request(app)
        .get('/api/v1/system/inbox-events?status=enviado')
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(400);
      expect(systemService.listInboxEvents).not.toHaveBeenCalled();
    });

    it('devuelve 400 con retryCountGte no numérico', async () => {
      const res = await request(app)
        .get('/api/v1/system/inbox-events?retryCountGte=abc')
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(400);
    });
  });

  // ── GET /outbox-events ─────────────────────────────────────────────────────

  describe('GET /api/v1/system/outbox-events', () => {
    it('devuelve 401 sin token', async () => {
      const res = await request(app).get('/api/v1/system/outbox-events');
      expect(res.status).toBe(401);
    });

    it('devuelve 403 a ANALISTA', async () => {
      const res = await request(app)
        .get('/api/v1/system/outbox-events')
        .set('Authorization', 'Bearer role:ANALISTA');
      expect(res.status).toBe(403);
    });

    it('devuelve 200 con outbox events a SUPERADMIN', async () => {
      systemService.listOutboxEvents.mockResolvedValue({
        items: [OUTBOX_EVENT_FIXTURE],
        meta: LIST_META_SINGLE,
      });

      const res = await request(app)
        .get('/api/v1/system/outbox-events')
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(200);
      const body = res.body as { outboxEvents: unknown[] };
      expect(body.outboxEvents).toHaveLength(1);
    });

    it('pasa filtros status, phone, retryCount y rango de fecha', async () => {
      systemService.listOutboxEvents.mockResolvedValue({ items: [], meta: LIST_META_EMPTY });

      await request(app)
        .get(
          '/api/v1/system/outbox-events?status=dead_lettered&phone=5491187654321&retryCountGte=3&dateFrom=2024-06-01&dateTo=2024-06-30&limit=5',
        )
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(systemService.listOutboxEvents).toHaveBeenCalledWith({
        cursor: undefined,
        limit: 5,
        filters: {
          status: 'dead_lettered',
          phone: '5491187654321',
          retryCountGte: 3,
          dateFrom: '2024-06-01',
          dateTo: '2024-06-30',
        },
      });
    });

    it('devuelve 400 con status de outbox inválido', async () => {
      const res = await request(app)
        .get('/api/v1/system/outbox-events?status=procesado')
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(400);
    });
  });

  // ── POST /outbox-events/:id/retry ─────────────────────────────────────────

  describe('POST /api/v1/system/outbox-events/:id/retry', () => {
    const OUTBOX_ID = '550e8400-e29b-41d4-a716-446655440030';

    it('devuelve 401 sin token', async () => {
      const res = await request(app).post(`/api/v1/system/outbox-events/${OUTBOX_ID}/retry`);
      expect(res.status).toBe(401);
    });

    it('devuelve 403 a no-SUPERADMIN', async () => {
      const res = await request(app)
        .post(`/api/v1/system/outbox-events/${OUTBOX_ID}/retry`)
        .set('Authorization', 'Bearer role:COORDINADOR');
      expect(res.status).toBe(403);
      expect(systemService.retryOutboxEvent).not.toHaveBeenCalled();
    });

    it('devuelve 400 con id no UUID', async () => {
      const res = await request(app)
        .post('/api/v1/system/outbox-events/no-es-uuid/retry')
        .set('Authorization', 'Bearer role:SUPERADMIN');
      expect(res.status).toBe(400);
      expect(systemService.retryOutboxEvent).not.toHaveBeenCalled();
    });

    it('devuelve 200 con evento reintentado', async () => {
      systemService.retryOutboxEvent.mockResolvedValue({
        ...OUTBOX_EVENT_FIXTURE,
        status: 'pending',
        retryCount: 0,
        lastError: undefined,
      });

      const res = await request(app)
        .post(`/api/v1/system/outbox-events/${OUTBOX_ID}/retry`)
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(200);
      expect(systemService.retryOutboxEvent).toHaveBeenCalledWith(OUTBOX_ID);
      const body = res.body as { outboxEvent: { status: string } };
      expect(body.outboxEvent.status).toBe('pending');
    });

    it('devuelve 404 si el evento no existe', async () => {
      systemService.retryOutboxEvent.mockRejectedValue(
        new NotFoundError('OutboxEvent no encontrado'),
      );

      const res = await request(app)
        .post(`/api/v1/system/outbox-events/${OUTBOX_ID}/retry`)
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(404);
    });

    it('devuelve 400 si el evento no está en estado fallido', async () => {
      systemService.retryOutboxEvent.mockRejectedValue(
        AppError.badRequest("OutboxEvent debe estar en estado 'failed' o 'dead_lettered'"),
      );

      const res = await request(app)
        .post(`/api/v1/system/outbox-events/${OUTBOX_ID}/retry`)
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(400);
    });
  });

  // ── POST /inbox-events/:id/reprocess ──────────────────────────────────────

  describe('POST /api/v1/system/inbox-events/:id/reprocess', () => {
    const INBOX_ID = '550e8400-e29b-41d4-a716-446655440020';

    it('devuelve 401 sin token', async () => {
      const res = await request(app).post(`/api/v1/system/inbox-events/${INBOX_ID}/reprocess`);
      expect(res.status).toBe(401);
    });

    it('devuelve 403 a no-SUPERADMIN', async () => {
      const res = await request(app)
        .post(`/api/v1/system/inbox-events/${INBOX_ID}/reprocess`)
        .set('Authorization', 'Bearer role:ANALISTA');
      expect(res.status).toBe(403);
      expect(systemService.reprocessInboxEvent).not.toHaveBeenCalled();
    });

    it('devuelve 400 con id no UUID', async () => {
      const res = await request(app)
        .post('/api/v1/system/inbox-events/no-es-uuid/reprocess')
        .set('Authorization', 'Bearer role:SUPERADMIN');
      expect(res.status).toBe(400);
      expect(systemService.reprocessInboxEvent).not.toHaveBeenCalled();
    });

    it('devuelve 200 con evento reprocesado', async () => {
      systemService.reprocessInboxEvent.mockResolvedValue({
        ...INBOX_EVENT_FIXTURE,
        status: 'pending',
        retryCount: 0,
        lastError: undefined,
        lastErrorAt: undefined,
        processedAt: undefined,
      });

      const res = await request(app)
        .post(`/api/v1/system/inbox-events/${INBOX_ID}/reprocess`)
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(200);
      expect(systemService.reprocessInboxEvent).toHaveBeenCalledWith(INBOX_ID);
      const body = res.body as { inboxEvent: { status: string } };
      expect(body.inboxEvent.status).toBe('pending');
    });

    it('devuelve 404 si el inbox event no existe', async () => {
      systemService.reprocessInboxEvent.mockRejectedValue(
        new NotFoundError('InboxEvent no encontrado'),
      );

      const res = await request(app)
        .post(`/api/v1/system/inbox-events/${INBOX_ID}/reprocess`)
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(404);
    });

    it('devuelve 400 si el evento no está en estado fallido', async () => {
      systemService.reprocessInboxEvent.mockRejectedValue(
        AppError.badRequest("InboxEvent debe estar en estado 'failed' o 'dead_lettered'"),
      );

      const res = await request(app)
        .post(`/api/v1/system/inbox-events/${INBOX_ID}/reprocess`)
        .set('Authorization', 'Bearer role:SUPERADMIN');

      expect(res.status).toBe(400);
    });
  });
});
