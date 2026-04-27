/**
 * Integration tests: capa de mensajes
 *
 * Cubre:
 *  - GET  /conversations/:id/messages  — listar mensajes con paginación
 *  - POST /conversations/:id/messages  — enviar mensaje outbound + idempotencia
 *  - POST /messages/:id/attachments    — registrar attachment
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { ConversationsController } from '../../controllers/conversations.controller';
import { MessagesController } from '../../controllers/messages.controller';
import { createConversationsRouter } from '../../routes/conversations.routes';
import { createMessagesRouter } from '../../routes/messages.routes';
import { AppError } from '../../utils/app-error';
import { createTestApp } from '../setup/test-app';

// ── Auth mock ─────────────────────────────────────────────────────────────────

jest.mock('../../middlewares/auth.middleware', () => ({
  authMiddleware: (
    req: { headers: Record<string, string | undefined>; user?: unknown },
    res: { status: (code: number) => { json: (p: Record<string, unknown>) => void } },
    next: () => void,
  ) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
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
      .filter((r) => r.length > 0);
    req.user = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'agent@vozciudadana.gob',
      fullName: 'Agent Test',
      roles,
    };
    next();
  },
}));

// ── Tipos helper ──────────────────────────────────────────────────────────────

type AsyncFn<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

// ── Stubs de servicios ────────────────────────────────────────────────────────

const messageService = {
  listByConversation: jest.fn<AsyncFn<[Record<string, unknown>], Record<string, unknown>>>(),
  sendMessage: jest.fn<AsyncFn<[Record<string, unknown>], Record<string, unknown>>>(),
  addAttachment: jest.fn<AsyncFn<[Record<string, unknown>], Record<string, unknown>>>(),
};

const conversationsService = {
  list: jest.fn<AsyncFn<[Record<string, unknown>], Record<string, unknown>>>(),
  getById: jest.fn<AsyncFn<[string], Record<string, unknown>>>(),
  assign: jest.fn<AsyncFn<[string, string, string | undefined], Record<string, unknown>>>(),
  transfer: jest.fn<AsyncFn<[string, string, string | undefined], Record<string, unknown>>>(),
  handover: jest.fn<AsyncFn<[string, string], Record<string, unknown>>>(),
  close: jest.fn<AsyncFn<[string, string | undefined], Record<string, unknown>>>(),
  reopen: jest.fn<AsyncFn<[string, string | undefined], Record<string, unknown>>>(),
};

const auditService = {
  logFromRequest: jest
    .fn<AsyncFn<[unknown, Record<string, unknown>], void>>()
    .mockResolvedValue(undefined),
};

const outboxProcessor = {
  enqueue: jest.fn<AsyncFn<[string, unknown, string, string | undefined], void>>(),
};

// ── App de test ───────────────────────────────────────────────────────────────

const CONV_ID = '550e8400-e29b-41d4-a716-446655440002';
const MSG_ID = '550e8400-e29b-41d4-a716-446655440003';
const IDEM_KEY = '550e8400-e29b-41d4-a716-446655440099';

const conversationsController = new ConversationsController(
  conversationsService as unknown as never,
  auditService as unknown as never,
  messageService as unknown as never,
);

const messagesController = new MessagesController(
  outboxProcessor as unknown as never,
  messageService as unknown as never,
);

const app = createTestApp((_, router) => {
  router.use('/api/v1/conversations', createConversationsRouter(conversationsController));
  router.use('/api/v1/messages', createMessagesRouter(messagesController));
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeMessage = (overrides: Record<string, unknown> = {}) => ({
  id: MSG_ID,
  conversationId: CONV_ID,
  body: 'Hola ciudadano',
  direction: 'outbound',
  messageType: 'text',
  externalMessageId: null,
  attachmentId: null,
  meta: {},
  createdAt: new Date().toISOString(),
  statuses: [],
  attachmentsViaMessageId: [],
  ...overrides,
});

const makeAttachment = (overrides: Record<string, unknown> = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440004',
  storageKey: 'uploads/doc.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: '12345',
  originalFilename: 'doc.pdf',
  cdnUrl: 'https://cdn.example.com/doc.pdf',
  messageId: MSG_ID,
  citizenId: null,
  uploadedBy: '550e8400-e29b-41d4-a716-446655440001',
  createdAt: new Date().toISOString(),
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/conversations/:id/messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditService.logFromRequest.mockResolvedValue(undefined);
  });

  it('devuelve lista paginada de mensajes (200)', async () => {
    const msg = makeMessage();
    messageService.listByConversation.mockResolvedValue({
      items: [msg],
      meta: { nextCursor: undefined, hasNextPage: false },
    });

    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/messages`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT');

    expect(res.status).toBe(200);
    expect((res.body as { items: unknown[] }).items).toHaveLength(1);
    expect((res.body as { meta: { hasNextPage: boolean } }).meta.hasNextPage).toBe(false);
    expect(messageService.listByConversation).toHaveBeenCalledWith({
      conversationId: CONV_ID,
      cursor: undefined,
      limit: 20,
    });
  });

  it('respeta cursor y limit del query string', async () => {
    messageService.listByConversation.mockResolvedValue({
      items: [],
      meta: { nextCursor: undefined, hasNextPage: false },
    });

    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/messages?cursor=${MSG_ID}&limit=5`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT');

    expect(res.status).toBe(200);
    expect(messageService.listByConversation).toHaveBeenCalledWith({
      conversationId: CONV_ID,
      cursor: MSG_ID,
      limit: 5,
    });
  });

  it('devuelve 404 cuando la conversación no existe', async () => {
    messageService.listByConversation.mockRejectedValue(
      AppError.notFound('Conversación no encontrada'),
    );

    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/messages`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT');

    expect(res.status).toBe(404);
  });

  it('devuelve 401 sin token', async () => {
    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}/messages`);
    expect(res.status).toBe(401);
    expect(messageService.listByConversation).not.toHaveBeenCalled();
  });

  it('devuelve 400 con UUID inválido', async () => {
    const res = await request(app)
      .get('/api/v1/conversations/not-a-uuid/messages')
      .set('Authorization', 'Bearer role:OPERADOR_CHAT');

    expect(res.status).toBe(400);
    expect(messageService.listByConversation).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/conversations/:id/messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditService.logFromRequest.mockResolvedValue(undefined);
  });

  it('envía mensaje y devuelve 202 en el happy path', async () => {
    const msg = makeMessage();
    messageService.sendMessage.mockResolvedValue({ message: msg, isReplay: false });

    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT')
      .set('Idempotency-Key', IDEM_KEY)
      .send({ body: 'Hola ciudadano' });

    expect(res.status).toBe(202);
    expect((res.body as { idempotencyKey: string }).idempotencyKey).toBe(IDEM_KEY);
    expect(messageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: CONV_ID,
        body: 'Hola ciudadano',
        messageType: 'text',
        idempotencyKey: IDEM_KEY,
      }),
    );
  });

  it('devuelve 200 (replay) con el mismo Idempotency-Key', async () => {
    const msg = makeMessage();
    messageService.sendMessage.mockResolvedValue({ message: msg, isReplay: true });

    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT')
      .set('Idempotency-Key', IDEM_KEY)
      .send({ body: 'Hola ciudadano' });

    expect(res.status).toBe(200);
    expect((res.body as { message: { id: string } }).message.id).toBe(MSG_ID);
  });

  it('genera idempotencyKey automático si no se provee el header', async () => {
    const msg = makeMessage();
    messageService.sendMessage.mockResolvedValue({ message: msg, isReplay: false });

    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT')
      .send({ body: 'Sin header de idempotencia' });

    expect(res.status).toBe(202);
    const body = res.body as { idempotencyKey: string };
    // El key generado es un UUID
    expect(body.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('devuelve 400 con body vacío', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT')
      .send({});

    expect(res.status).toBe(400);
    expect(messageService.sendMessage).not.toHaveBeenCalled();
  });

  it('devuelve 400 con body demasiado largo', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT')
      .send({ body: 'x'.repeat(4097) });

    expect(res.status).toBe(400);
    expect(messageService.sendMessage).not.toHaveBeenCalled();
  });

  it('devuelve 401 sin token', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ body: 'Hola' });

    expect(res.status).toBe(401);
    expect(messageService.sendMessage).not.toHaveBeenCalled();
  });

  it('devuelve 404 cuando la conversación no existe', async () => {
    messageService.sendMessage.mockRejectedValue(AppError.notFound('Conversación no encontrada'));

    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT')
      .send({ body: 'Hola' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/messages/:id/attachments', () => {
  const validPayload = {
    storageKey: 'uploads/2026/04/doc.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: '98765',
    originalFilename: 'documento.pdf',
    cdnUrl: 'https://cdn.example.com/doc.pdf',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('crea attachment y devuelve 201', async () => {
    const att = makeAttachment();
    messageService.addAttachment.mockResolvedValue(att);

    const res = await request(app)
      .post(`/api/v1/messages/${MSG_ID}/attachments`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect((res.body as { attachment: { storageKey: string } }).attachment.storageKey).toBe(
      'uploads/doc.pdf',
    );
    expect(messageService.addAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: MSG_ID,
        storageKey: validPayload.storageKey,
        mimeType: validPayload.mimeType,
        fileSizeBytes: BigInt(validPayload.fileSizeBytes),
      }),
    );
  });

  it('devuelve 404 cuando el mensaje no existe', async () => {
    messageService.addAttachment.mockRejectedValue(AppError.notFound('Mensaje no encontrado'));

    const res = await request(app)
      .post(`/api/v1/messages/${MSG_ID}/attachments`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT')
      .send(validPayload);

    expect(res.status).toBe(404);
  });

  it('devuelve 400 con storageKey ausente', async () => {
    const { storageKey: _omit, ...payload } = validPayload;

    const res = await request(app)
      .post(`/api/v1/messages/${MSG_ID}/attachments`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT')
      .send(payload);

    expect(res.status).toBe(400);
    expect(messageService.addAttachment).not.toHaveBeenCalled();
  });

  it('devuelve 400 con fileSizeBytes no numérico', async () => {
    const res = await request(app)
      .post(`/api/v1/messages/${MSG_ID}/attachments`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT')
      .send({ ...validPayload, fileSizeBytes: 'no-es-numero' });

    expect(res.status).toBe(400);
    expect(messageService.addAttachment).not.toHaveBeenCalled();
  });

  it('devuelve 400 con cdnUrl inválida', async () => {
    const res = await request(app)
      .post(`/api/v1/messages/${MSG_ID}/attachments`)
      .set('Authorization', 'Bearer role:OPERADOR_CHAT')
      .send({ ...validPayload, cdnUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(messageService.addAttachment).not.toHaveBeenCalled();
  });

  it('devuelve 401 sin token', async () => {
    const res = await request(app)
      .post(`/api/v1/messages/${MSG_ID}/attachments`)
      .send(validPayload);

    expect(res.status).toBe(401);
    expect(messageService.addAttachment).not.toHaveBeenCalled();
  });
});
