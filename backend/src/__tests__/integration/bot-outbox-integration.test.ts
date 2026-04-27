/**
 * Integration tests: Bot outbox delivery wiring + citizen/conversation bootstrap.
 *
 * Cubre los bugs corregidos:
 * B1 — Bot responses ahora van por OutboxProcessorService (no direct sendText)
 * B2 — OutboxEvent se persiste en DB para cada respuesta del bot
 * B3 — Message(direction=outbound) se persiste en la conversación
 * B4 — ensureOpenConversation crea ConversationMeta cuando falta
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConversationStatus, LeadStatus, MessageDirection, MessageType } from '@prisma/client';
import { BotFsmState, BotService } from '../../services/bot.service';

type AsyncFn<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

// ─── Fábricas de mocks ────────────────────────────────────────────────────────

function makeRedisMock() {
  const store: Record<string, string> = {};
  return {
    get: jest.fn(async (key: string) => store[key] ?? null),
    set: jest.fn(async (key: string, value: string, _ttl?: number) => {
      store[key] = value;
    }),
    del: jest.fn(async (key: string) => {
      delete store[key];
    }),
    incr: jest.fn(async (_key: string, _ttl?: number) => 1),
    lpush: jest.fn<AsyncFn<unknown[], number>>().mockResolvedValue(1),
    rpop: jest.fn<AsyncFn<unknown[], string | null>>().mockResolvedValue(null),
    zadd: jest.fn<AsyncFn<unknown[], number>>().mockResolvedValue(1),
    _store: store,
  };
}

function makePrismaMock() {
  return {
    citizen: {
      findUnique: jest
        .fn<AsyncFn<unknown[], Record<string, unknown> | null>>()
        .mockResolvedValue(null),
      upsert: jest.fn<AsyncFn<unknown[], Record<string, unknown>>>().mockResolvedValue({
        id: 'cit1',
        phone: '521999888777',
      }),
      update: jest
        .fn<AsyncFn<unknown[], Record<string, unknown>>>()
        .mockResolvedValue({ id: 'cit1' }),
    },
    neighborhood: {
      findMany: jest
        .fn<AsyncFn<unknown[], Array<{ id: string; name: string }>>>()
        .mockResolvedValue([
          { id: 'n1', name: 'Centro' },
          { id: 'n2', name: 'Norte' },
        ]),
    },
    conversation: {
      findFirst: jest.fn<AsyncFn<unknown[], Record<string, unknown> | null>>().mockResolvedValue({
        id: 'conv1',
        status: ConversationStatus.open,
        meta: { flowState: 'BOT_FLOW', version: 0 },
      }),
      create: jest
        .fn<AsyncFn<unknown[], { id: string; status: ConversationStatus }>>()
        .mockResolvedValue({ id: 'conv1', status: ConversationStatus.open }),
    },
    conversationMeta: {
      create: jest.fn<AsyncFn<unknown[], Record<string, unknown>>>().mockResolvedValue({}),
    },
    message: {
      create: jest.fn<AsyncFn<unknown[], { id: string }>>().mockResolvedValue({ id: 'msg1' }),
    },
    outboxEvent: {
      findUnique: jest
        .fn<AsyncFn<unknown[], Record<string, unknown> | null>>()
        .mockResolvedValue(null),
      create: jest.fn<AsyncFn<unknown[], { id: string }>>().mockResolvedValue({ id: 'outbox1' }),
      update: jest.fn<AsyncFn<unknown[], Record<string, unknown>>>().mockResolvedValue({}),
    },
  };
}

function makeWaMock() {
  return {
    sendText: jest
      .fn<AsyncFn<unknown[], { messages: Array<{ id: string }> }>>()
      .mockResolvedValue({ messages: [{ id: 'wa-out-001' }] }),
    markAsRead: jest.fn<AsyncFn<unknown[], Record<string, never>>>().mockResolvedValue({}),
  };
}

function makeOutboxProcessorMock() {
  return {
    enqueue: jest.fn<AsyncFn<unknown[], void>>().mockResolvedValue(undefined),
    start: jest.fn(),
    stop: jest.fn(),
  };
}

function makeMessageRepoMock() {
  return {
    create: jest.fn<AsyncFn<unknown[], { id: string }>>().mockResolvedValue({ id: 'msg-out-1' }),
  };
}

function makeBot(
  prisma: ReturnType<typeof makePrismaMock>,
  redis: ReturnType<typeof makeRedisMock>,
  wa: ReturnType<typeof makeWaMock>,
  outbox?: ReturnType<typeof makeOutboxProcessorMock>,
  msgRepo?: ReturnType<typeof makeMessageRepoMock>,
) {
  // @ts-ignore — mocks parciales
  return new BotService(prisma, redis, wa, outbox, msgRepo);
}

const PHONE = '+521999888777';
const PHONE_NORM = '521999888777';
// Formato E.164 con +: es el valor correcto en el campo `to` del payload outbound.
const PHONE_E164 = '+521999888777';
const BASE_WAMID = 'wamid.outbox-int';

// ─── B1: sendMessage usa outbox en lugar de sendText directo ──────────────────

describe('B1 — Bot responses se encolan en OutboxProcessorService', () => {
  it('al responder en estado NAME, llama outboxProcessor.enqueue en lugar de wa.sendText', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const outbox = makeOutboxProcessorMock();
    const msgRepo = makeMessageRepoMock();

    const bot = makeBot(prisma, redis, wa, outbox, msgRepo);

    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-1`, 'corr-b1a');

    // outbox.enqueue debe haberse llamado
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);

    // wa.sendText NO debe haberse llamado (ya no es la ruta de producción)
    expect(wa.sendText).not.toHaveBeenCalled();
  });

  it('sin outboxProcessor (modo legacy/test), sigue usando wa.sendText', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();

    const bot = makeBot(prisma, redis, wa); // sin outbox

    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-2`, 'corr-b1b');

    expect(wa.sendText).toHaveBeenCalledTimes(1);
    expect(wa.sendText).toHaveBeenCalledWith(PHONE_NORM, expect.stringContaining('Bienvenido'));
  });
});

// ─── B2: OutboxEvent se crea para respuestas del bot ─────────────────────────

describe('B2 — outboxProcessor.enqueue recibe el payload correcto', () => {
  it('el payload enviado al outbox es un WaTextOutbound válido', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const outbox = makeOutboxProcessorMock();
    const msgRepo = makeMessageRepoMock();
    const bot = makeBot(prisma, redis, wa, outbox, msgRepo);

    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-3`, 'corr-b2');

    const [phone, payload, _idempotencyKey] = outbox.enqueue.mock.calls[0] as [
      string,
      { messaging_product: string; type: string; to: string; text: { body: string } },
      string,
    ];

    expect(phone).toBe(PHONE_NORM);
    expect(payload.messaging_product).toBe('whatsapp');
    expect(payload.type).toBe('text');
    // R2: payload.to debe estar en E.164 con + para la Meta Cloud API
    expect(payload.to).toBe(PHONE_E164);
    expect(payload.text.body).toContain('Bienvenido');
  });

  it('conversationId se pasa al enqueue cuando existe conversación activa', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const outbox = makeOutboxProcessorMock();
    const msgRepo = makeMessageRepoMock();

    // conversación ya existe
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-known',
      status: ConversationStatus.open,
    });

    const bot = makeBot(prisma, redis, wa, outbox, msgRepo);
    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-4`, 'corr-b2-conv');

    const callArgs = outbox.enqueue.mock.calls[0] as [string, unknown, string, string | undefined];
    expect(callArgs[3]).toBe('conv-known');
  });
});

// ─── B3: Message(outbound) se persiste en historial de conversación ───────────

describe('B3 — messageRepo.create persiste outbound Message', () => {
  it('al responder, persiste un Message con direction=outbound', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const outbox = makeOutboxProcessorMock();
    const msgRepo = makeMessageRepoMock();

    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv1',
      status: ConversationStatus.open,
    });

    const bot = makeBot(prisma, redis, wa, outbox, msgRepo);
    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-5`, 'corr-b3');

    expect(msgRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv1',
        direction: MessageDirection.outbound,
        messageType: MessageType.text,
        meta: expect.objectContaining({ source: 'bot' }),
      }),
    );
  });

  it('sin messageRepo, no lanza error (graceful degradation)', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const outbox = makeOutboxProcessorMock();

    const bot = makeBot(prisma, redis, wa, outbox); // sin msgRepo

    // No debe lanzar excepción
    await expect(
      bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-6`, 'corr-b3-no-repo'),
    ).resolves.not.toThrow();
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });
});

// ─── B4: estado COMPLETED no genera escrituras en DB (el orquestador gestiona meta) ────

describe('B4 — COMPLETED state no hace escrituras DB (sin persistInboundMessage)', () => {
  it('ciudadano en COMPLETED: no llama a message.create ni conversationMeta.create', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const outbox = makeOutboxProcessorMock();
    const msgRepo = makeMessageRepoMock();
    const bot = makeBot(prisma, redis, wa, outbox, msgRepo);

    await bot.saveResponse(PHONE, BotFsmState.COMPLETED, {});
    await bot.handleMessage(PHONE, 'consulta', `${BASE_WAMID}-b4`, 'corr-b4');

    // El orquestador es responsable de persistir el mensaje inbound y la meta.
    // El bot en COMPLETED solo loguea — ninguna escritura en DB.
    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(prisma.conversationMeta.create).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(wa.sendText).not.toHaveBeenCalled();
  });

  it('ciudadano en COMPLETED: no llama a conversation.create', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const outbox = makeOutboxProcessorMock();
    const msgRepo = makeMessageRepoMock();
    const bot = makeBot(prisma, redis, wa, outbox, msgRepo);

    await bot.saveResponse(PHONE, BotFsmState.COMPLETED, {});
    await bot.handleMessage(PHONE, 'consulta', `${BASE_WAMID}-b4b`, 'corr-b4b');

    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });
});

// ─── Flujo completo: citizen autocreate + conversation bootstrap + bot reply ──

describe('Flujo end-to-end: ciudadano nuevo → bot responde vía outbox', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let wa: ReturnType<typeof makeWaMock>;
  let outbox: ReturnType<typeof makeOutboxProcessorMock>;
  let msgRepo: ReturnType<typeof makeMessageRepoMock>;
  let bot: BotService;

  beforeEach(() => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    wa = makeWaMock();
    outbox = makeOutboxProcessorMock();
    msgRepo = makeMessageRepoMock();
    bot = makeBot(prisma, redis, wa, outbox, msgRepo);

    prisma.citizen.findUnique.mockResolvedValue(null);
    prisma.citizen.upsert.mockResolvedValue({ id: 'cit1', phone: PHONE_NORM });
    prisma.citizen.update.mockResolvedValue({ id: 'cit1' });
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv1',
      status: ConversationStatus.open,
    });
  });

  it('mensaje inicial: bot avanza a NEIGHBORHOOD y encola respuesta de bienvenida', async () => {
    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-e2e-1`, 'corr-e2e1');

    const session = await bot.getSession(PHONE);
    expect(session.state).toBe(BotFsmState.NEIGHBORHOOD);

    // Respuesta encolada en outbox (no en sendText directo)
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(wa.sendText).not.toHaveBeenCalled();

    // Mensaje outbound persistido
    expect(msgRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ direction: MessageDirection.outbound }),
    );
  });

  it('flujo completo NAME→NEIGHBORHOOD→INTERESTS→AWAITING→COMPLETED: outbox llamado en cada paso', async () => {
    // Paso 1: primer mensaje → NAME
    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-step1`, 'corr-s1');
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);

    // Paso 2: nombre → NEIGHBORHOOD
    await bot.handleMessage(PHONE, 'Carlos López', `${BASE_WAMID}-step2`, 'corr-s2');
    expect(outbox.enqueue).toHaveBeenCalledTimes(2);

    // Paso 3: colonia → INTERESTS
    await bot.handleMessage(PHONE, 'Centro', `${BASE_WAMID}-step3`, 'corr-s3');
    expect(outbox.enqueue).toHaveBeenCalledTimes(3);

    // Paso 4: intereses → COMPLETED
    await bot.handleMessage(PHONE, '1,3', `${BASE_WAMID}-step4`, 'corr-s4');
    expect(outbox.enqueue).toHaveBeenCalledTimes(4);

    const session = await bot.getSession(PHONE);
    expect(session.state).toBe(BotFsmState.COMPLETED);

    // Nunca se llamó sendText directo
    expect(wa.sendText).not.toHaveBeenCalled();
  });

  it('ciudadano ya registrado (converted): va directo a COMPLETED, encola bienvenida de vuelta', async () => {
    prisma.citizen.findUnique.mockResolvedValue({
      id: 'cit-existing',
      phone: PHONE_NORM,
      name: 'Ana',
      leadStatus: LeadStatus.converted,
    });

    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-existing`, 'corr-existing');

    const session = await bot.getSession(PHONE);
    expect(session.state).toBe(BotFsmState.COMPLETED);

    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    const [, payload] = outbox.enqueue.mock.calls[0] as [
      string,
      { text: { body: string } },
      string,
    ];
    expect(payload.text.body).toContain('Bienvenido de vuelta');
  });
});

// ─── Idempotencia: wamid duplicado no encola segunda vez ─────────────────────

describe('Idempotencia con outbox: wamid duplicado no genera doble OutboxEvent', () => {
  it('segundo procesamiento del mismo wamid no llama a outbox.enqueue', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const outbox = makeOutboxProcessorMock();
    const msgRepo = makeMessageRepoMock();
    const bot = makeBot(prisma, redis, wa, outbox, msgRepo);

    prisma.citizen.findUnique.mockResolvedValue(null);
    prisma.citizen.upsert.mockResolvedValue({ id: 'cit1', phone: PHONE_NORM });

    const WAMID = `${BASE_WAMID}-dup`;

    await bot.handleMessage(PHONE, 'hola', WAMID, 'corr-dup-1');
    const enqueueCallsAfterFirst = outbox.enqueue.mock.calls.length;

    // Segundo procesamiento con mismo wamid → NO enqueue adicional
    await bot.handleMessage(PHONE, 'hola', WAMID, 'corr-dup-2');
    expect(outbox.enqueue).toHaveBeenCalledTimes(enqueueCallsAfterFirst);
  });
});
