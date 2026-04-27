/**
 * Integration tests: Webhook flow end-to-end con mocks.
 *
 * Cubre:
 * 1. Replay protection (wamid duplicado)
 * 2. Handover completo: ciudadano nuevo → registro → HUMAN_FLOW
 * 3. Non-text durante registro → fallback
 * 4. Completion handover: REGISTERING → DEPARTMENT_ROUTING → HUMAN_FLOW
 */
import { BotFsmState, BotService } from '../../services/bot.service';
import { LeadStatus, SourceChannel, ConversationStatus } from '@prisma/client';

// ─── Shared mocks ─────────────────────────────────────────────────────────────

function makeRedisMock() {
  const store: Record<string, string> = {};
  return {
    get: jest.fn(async (key: string) => store[key] ?? null),
    set: jest.fn(async (key: string, value: string, _ttl?: number) => { store[key] = value; }),
    del: jest.fn(async (key: string) => { delete store[key]; }),
    incr: jest.fn(async (_key: string, _ttl?: number) => 1),
    _store: store,
  };
}

function makePrismaMock() {
  return {
    citizen: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    neighborhood: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'n1', name: 'Centro' },
        { id: 'n2', name: 'Norte' },
      ]),
    },
    conversation: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'conv1', status: ConversationStatus.open }),
    },
    message: { create: jest.fn() },
    outboxEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'outbox1' }),
      update: jest.fn(),
    },
  };
}

function makeWaMock() {
  return {
    sendText: jest.fn().mockResolvedValue({ messages: [{ id: 'out-wamid-001' }] }),
    markAsRead: jest.fn().mockResolvedValue({}),
  };
}

// ─── Helper: crear BotService ─────────────────────────────────────────────────

function makeBot(
  prisma: ReturnType<typeof makePrismaMock>,
  redis: ReturnType<typeof makeRedisMock>,
  wa: ReturnType<typeof makeWaMock>,
) {
  // @ts-ignore — mock parcial
  return new BotService(prisma, redis, wa);
}

const PHONE = '+521999888777';
const BASE_WAMID = 'wamid.integration';

// ─── Test 1: Replay protection ────────────────────────────────────────────────

describe('Replay protection (wamid duplicado)', () => {
  it('segundo mensaje con mismo wamid debe ser ignorado (no-op)', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const bot = makeBot(prisma, redis, wa);

    prisma.citizen.findUnique.mockResolvedValue(null);
    prisma.citizen.upsert.mockResolvedValue({ id: 'cit1', phone: PHONE });

    // Primer procesamiento
    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-dup`, 'corr-1');
    const callsAfterFirst = wa.sendText.mock.calls.length;

    // Segundo procesamiento con mismo wamid
    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-dup`, 'corr-2');
    
    // No deben haber más llamadas
    expect(wa.sendText).toHaveBeenCalledTimes(callsAfterFirst);
  });
});

// ─── Test 2: Happy path completo ──────────────────────────────────────────────

describe('Happy path: registro completo end-to-end', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let wa: ReturnType<typeof makeWaMock>;
  let bot: BotService;

  beforeEach(() => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    wa = makeWaMock();
    bot = makeBot(prisma, redis, wa);
    prisma.citizen.findUnique.mockResolvedValue(null);
    prisma.citizen.upsert.mockResolvedValue({ id: 'cit1', phone: PHONE });
    prisma.citizen.update.mockResolvedValue({ id: 'cit1' });
  });

  it('1: primer mensaje → estado NAME → avanza a NEIGHBORHOOD, envía bienvenida', async () => {
    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-1`, 'corr-hp1');
    const session = await bot.getSession(PHONE);
    expect(session.state).toBe(BotFsmState.NEIGHBORHOOD);
    expect(wa.sendText).toHaveBeenCalledWith(PHONE, expect.stringContaining('Bienvenido'));
  });

  it('2: nombre completo → estado NEIGHBORHOOD → avanza a INTERESTS, muestra colonias', async () => {
    await bot.saveResponse(PHONE, BotFsmState.NEIGHBORHOOD, {});
    await bot.handleMessage(PHONE, 'Carlos López', `${BASE_WAMID}-2`, 'corr-hp2');
    const session = await bot.getSession(PHONE);
    expect(session.state).toBe(BotFsmState.INTERESTS);
    expect(wa.sendText).toHaveBeenCalledWith(PHONE, expect.stringContaining('colonia'));
  });

  it('3: índice de colonia → estado INTERESTS → avanza a AWAITING_INTERESTS', async () => {
    await bot.saveResponse(PHONE, BotFsmState.INTERESTS, {});
    await bot.handleMessage(PHONE, '1', `${BASE_WAMID}-3`, 'corr-hp3');
    const session = await bot.getSession(PHONE);
    expect(session.state).toBe(BotFsmState.AWAITING_INTERESTS);
  });

  it('4: intereses → AWAITING_INTERESTS → COMPLETED, leadStatus = converted', async () => {
    await bot.saveResponse(PHONE, BotFsmState.AWAITING_INTERESTS, {});
    await bot.handleMessage(PHONE, '1,2,3', `${BASE_WAMID}-4`, 'corr-hp4');
    
    expect(prisma.citizen.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leadStatus: LeadStatus.converted }),
      }),
    );
    const session = await bot.getSession(PHONE);
    expect(session.state).toBe(BotFsmState.COMPLETED);
    expect(wa.sendText).toHaveBeenCalledWith(PHONE, expect.stringContaining('Registro completado'));
  });
});

// ─── Test 3: Non-text durante registro ───────────────────────────────────────

describe('Non-text fallback durante registro', () => {
  it('debe enviar mensaje de fallback cuando recibe audio/imagen en flujo activo', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const bot = makeBot(prisma, redis, wa);

    // Simular que está en medio del registro
    await bot.saveResponse(PHONE, BotFsmState.NEIGHBORHOOD, {});
    
    await bot.handleNonTextMessage(PHONE, `${BASE_WAMID}-audio`, 'corr-nt1');
    
    expect(wa.sendText).toHaveBeenCalledWith(
      PHONE,
      expect.stringContaining('solo puedo procesar mensajes de texto'),
    );
  });

  it('NO debe enviar fallback si ya completó el registro (COMPLETED)', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const bot = makeBot(prisma, redis, wa);

    await bot.saveResponse(PHONE, BotFsmState.COMPLETED, {});
    
    await bot.handleNonTextMessage(PHONE, `${BASE_WAMID}-audio2`, 'corr-nt2');
    
    expect(wa.sendText).not.toHaveBeenCalled();
  });
});

// ─── Test 4: Completion handover ──────────────────────────────────────────────

describe('Completion handover: FSM Redis vs flowState DB', () => {
  it('sesión Redis debe estar en COMPLETED tras registro exitoso', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const bot = makeBot(prisma, redis, wa);

    prisma.citizen.update.mockResolvedValue({});
    
    await bot.saveResponse(PHONE, BotFsmState.AWAITING_INTERESTS, {});
    await bot.handleMessage(PHONE, '1,4', `${BASE_WAMID}-handover`, 'corr-ho1');
    
    const session = await bot.getSession(PHONE);
    expect(session.state).toBe(BotFsmState.COMPLETED);
    
    // Verificar que se marcó leadStatus.converted en DB
    expect(prisma.citizen.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadStatus: LeadStatus.converted,
        }),
      }),
    );
  });

  it('ciudadano ya convertido debe ir directo a COMPLETED al contactar', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = makeWaMock();
    const bot = makeBot(prisma, redis, wa);

    prisma.citizen.findUnique.mockResolvedValue({
      id: 'cit-existing',
      phone: PHONE,
      name: 'Ana',
      leadStatus: LeadStatus.converted,
    });

    await bot.handleMessage(PHONE, 'hola', `${BASE_WAMID}-existing`, 'corr-ex1');

    const session = await bot.getSession(PHONE);
    expect(session.state).toBe(BotFsmState.COMPLETED);
    expect(wa.sendText).toHaveBeenCalledWith(PHONE, expect.stringContaining('Bienvenido de vuelta'));
  });
});
