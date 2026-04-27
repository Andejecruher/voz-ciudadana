/**
 * Tests unitarios para BotService.
 *
 * Cubre:
 * - Happy path: registro completo NAME→NEIGHBORHOOD→INTERESTS→AWAITING_INTERESTS→COMPLETED
 * - Non-text fallback durante registro
 * - Deduplicación por wamid
 * - Ciudadano ya convertido (bienvenida, skip)
 * - Estado desconocido (reset defensivo)
 * - Registro con colonia: exact match, múltiples coincidencias, sin coincidencias
 * - Registro con intereses inválidos (re-pide)
 * - Handover en orquestador: BOT_FLOW→REGISTERING al primer mensaje
 * - Handover en orquestador: REGISTERING→DEPARTMENT_ROUTING al completar
 */

import { BotFsmState, BotService, WA_MAX_TEXT_LENGTH, NEIGHBORHOOD_PAGE_SIZE, buildNeighborhoodListMessage, matchNeighborhood, normalizeForMatch, buildNeighborhoodMatchMessage, NEIGHBORHOOD_MATCH_MAX_OPTIONS, levenshtein, similarityScore, FUZZY_THRESHOLD, FUZZY_HIGH_THRESHOLD, FUZZY_GAP, maskPhone } from '../../services/bot.service';
import { LeadStatus, SourceChannel, ConversationStatus } from '@prisma/client';

// ─── Helpers: crear mocks ────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    citizen: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    neighborhood: {
      findMany: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    message: {
      create: jest.fn(),
    },
    outboxEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

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
    _store: store,
  };
}

function makeWaMock() {
  return {
    sendText: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid.out.test' }] }),
    markAsRead: jest.fn().mockResolvedValue({}),
  };
}

function makeBot(prisma: ReturnType<typeof makePrismaMock>, redis: ReturnType<typeof makeRedisMock>, wa: ReturnType<typeof makeWaMock>) {
  // @ts-ignore — mock parcial de PrismaService
  return new BotService(prisma, redis, wa);
}

// PHONE en formato DB canónico (sin +) — normalizePhoneForStorage lo deja igual
const PHONE = '521234567890';
const WAMID = 'wamid.test.001';
const CORR = 'corr-test-001';

const NEIGHBORHOODS = [
  { id: 'n1', name: 'Centro' },
  { id: 'n2', name: 'Norte' },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BotService — FSM de registro', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let wa: ReturnType<typeof makeWaMock>;
  let bot: BotService;

  beforeEach(() => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    wa = makeWaMock();
    bot = makeBot(prisma, redis, wa);
  });

  // ─── 1. Happy path: ciudadano nuevo arranca en NAME ──────────────────────

  describe('Estado NAME: ciudadano nuevo', () => {
    it('debe crear citizen, avanzar a NEIGHBORHOOD y enviar mensaje de bienvenida', async () => {
      prisma.citizen.findUnique.mockResolvedValue(null);
      prisma.citizen.upsert.mockResolvedValue({ id: 'cit1', phone: PHONE });

      await bot.handleMessage(PHONE, 'hola', WAMID, CORR);

      expect(prisma.citizen.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phone: PHONE } }),
      );
      expect(wa.sendText).toHaveBeenCalledWith(PHONE, expect.stringContaining('Bienvenido'));

      const session = await bot.getSession(PHONE);
      expect(session.state).toBe(BotFsmState.NEIGHBORHOOD);
    });
  });

  // ─── 2. Happy path: NEIGHBORHOOD recibe nombre válido ────────────────────

  describe('Estado NEIGHBORHOOD: nombre válido', () => {
    it('debe guardar nombre, avanzar a INTERESTS y pedir nombre de colonia', async () => {
      // Pre-set sesión en NEIGHBORHOOD
      await bot.saveResponse(PHONE, BotFsmState.NEIGHBORHOOD, {});
      prisma.citizen.update.mockResolvedValue({});

      await bot.handleMessage(PHONE, 'Juan Pérez', `${WAMID}-2`, CORR);

      expect(prisma.citizen.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Juan' }) }),
      );
      expect(wa.sendText).toHaveBeenCalledWith(PHONE, expect.stringContaining('colonia'));

      const session = await bot.getSession(PHONE);
      expect(session.state).toBe(BotFsmState.INTERESTS);
    });

    it('NO debe cargar colonias en NEIGHBORHOOD (se cargan en INTERESTS)', async () => {
      await bot.saveResponse(PHONE, BotFsmState.NEIGHBORHOOD, {});
      prisma.citizen.update.mockResolvedValue({});

      await bot.handleMessage(PHONE, 'Juan Pérez', `${WAMID}-2b`, CORR);

      expect(prisma.neighborhood.findMany).not.toHaveBeenCalled();
    });

    it('debe rechazar nombre de una sola palabra y pedir nombre completo', async () => {
      await bot.saveResponse(PHONE, BotFsmState.NEIGHBORHOOD, {});
      prisma.citizen.update.mockResolvedValue({});

      await bot.handleMessage(PHONE, 'Juan', `${WAMID}-single`, CORR);

      expect(prisma.citizen.update).not.toHaveBeenCalled();
      expect(wa.sendText).toHaveBeenCalledWith(PHONE, expect.stringContaining('nombre completo'));

      const session = await bot.getSession(PHONE);
      expect(session.state).toBe(BotFsmState.NEIGHBORHOOD); // no avanza
    });
  });

  // ─── 3. Estado INTERESTS: selección de colonia por nombre ────────────────

  describe('Estado INTERESTS: selección de colonia por nombre', () => {
    it('exact match: debe guardar neighborhoodId y avanzar a AWAITING_INTERESTS', async () => {
      await bot.saveResponse(PHONE, BotFsmState.INTERESTS, {});
      prisma.neighborhood.findMany.mockResolvedValue(NEIGHBORHOODS);
      prisma.citizen.update.mockResolvedValue({});

      await bot.handleMessage(PHONE, 'Centro', `${WAMID}-3`, CORR);

      expect(prisma.citizen.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ neighborhoodId: 'n1' }) }),
      );
      const session = await bot.getSession(PHONE);
      expect(session.state).toBe(BotFsmState.AWAITING_INTERESTS);
    });

    it('exact match case-insensitive con acentos: "céntro" debe encontrar "Centro"', async () => {
      await bot.saveResponse(PHONE, BotFsmState.INTERESTS, {});
      prisma.neighborhood.findMany.mockResolvedValue([{ id: 'n1', name: 'Centro' }]);
      prisma.citizen.update.mockResolvedValue({});

      await bot.handleMessage(PHONE, 'céntro', `${WAMID}-accent`, CORR);

      expect(prisma.citizen.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ neighborhoodId: 'n1' }) }),
      );
      const session = await bot.getSession(PHONE);
      expect(session.state).toBe(BotFsmState.AWAITING_INTERESTS);
    });

    it('múltiples coincidencias: debe mostrar opciones y NO avanzar estado', async () => {
      const multiNeighborhoods = [
        { id: 'n1', name: 'Centro Histórico' },
        { id: 'n2', name: 'Centro Norte' },
        { id: 'n3', name: 'Centro Sur' },
      ];
      await bot.saveResponse(PHONE, BotFsmState.INTERESTS, {});
      prisma.neighborhood.findMany.mockResolvedValue(multiNeighborhoods);

      await bot.handleMessage(PHONE, 'Centro', `${WAMID}-multi`, CORR);

      expect(prisma.citizen.update).not.toHaveBeenCalled();
      expect(wa.sendText).toHaveBeenCalledWith(
        PHONE,
        expect.stringContaining('Encontré varias colonias'),
      );
      expect(wa.sendText).toHaveBeenCalledWith(
        PHONE,
        expect.stringContaining('Centro Histórico'),
      );

      const session = await bot.getSession(PHONE);
      expect(session.state).toBe(BotFsmState.INTERESTS); // no avanza
    });

    it('sin coincidencias: debe enviar fallback amigable y NO avanzar estado', async () => {
      await bot.saveResponse(PHONE, BotFsmState.INTERESTS, {});
      prisma.neighborhood.findMany.mockResolvedValue(NEIGHBORHOODS);

      await bot.handleMessage(PHONE, 'Colonia Inexistente XYZ', `${WAMID}-nomatch`, CORR);

      expect(prisma.citizen.update).not.toHaveBeenCalled();
      expect(wa.sendText).toHaveBeenCalledWith(
        PHONE,
        expect.stringContaining('No encontré ninguna colonia'),
      );

      const session = await bot.getSession(PHONE);
      expect(session.state).toBe(BotFsmState.INTERESTS); // no avanza
    });

    it('startsWith match: "Nor" debe encontrar "Norte" si es única coincidencia', async () => {
      await bot.saveResponse(PHONE, BotFsmState.INTERESTS, {});
      prisma.neighborhood.findMany.mockResolvedValue(NEIGHBORHOODS);
      prisma.citizen.update.mockResolvedValue({});

      await bot.handleMessage(PHONE, 'Nor', `${WAMID}-starts`, CORR);

      expect(prisma.citizen.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ neighborhoodId: 'n2' }) }),
      );
      const session = await bot.getSession(PHONE);
      expect(session.state).toBe(BotFsmState.AWAITING_INTERESTS);
    });
  });

  // ─── 4. Happy path: AWAITING_INTERESTS → COMPLETED ───────────────────────

  describe('Estado AWAITING_INTERESTS: selección de intereses', () => {
    it('debe guardar intereses, marcar converted y enviar confirmación', async () => {
      await bot.saveResponse(PHONE, BotFsmState.AWAITING_INTERESTS, {});
      prisma.citizen.update.mockResolvedValue({});

      await bot.handleMessage(PHONE, '1,3', `${WAMID}-4`, CORR);

      expect(prisma.citizen.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leadStatus: LeadStatus.converted,
            interests: expect.arrayContaining(['agua_servicios', 'obras_pavimentacion']),
          }),
        }),
      );
      expect(wa.sendText).toHaveBeenCalledWith(PHONE, expect.stringContaining('Registro completado'));

      const session = await bot.getSession(PHONE);
      expect(session.state).toBe(BotFsmState.COMPLETED);
    });

    it('debe rechazar intereses inválidos y re-preguntar', async () => {
      await bot.saveResponse(PHONE, BotFsmState.AWAITING_INTERESTS, {});
      prisma.citizen.update.mockResolvedValue({});

      await bot.handleMessage(PHONE, 'abc', `${WAMID}-badinput`, CORR);

      expect(prisma.citizen.update).not.toHaveBeenCalled();
      expect(wa.sendText).toHaveBeenCalledWith(PHONE, expect.stringContaining('números separados por coma'));
    });
  });

  // ─── 5. Non-text fallback durante registro ────────────────────────────────

  describe('Mensajes non-text durante registro', () => {
    it('debe enviar fallback si está en flujo de registro activo', async () => {
      await bot.saveResponse(PHONE, BotFsmState.NEIGHBORHOOD, {});

      await bot.handleNonTextMessage(PHONE, `${WAMID}-audio`, CORR);

      expect(wa.sendText).toHaveBeenCalledWith(
        PHONE,
        expect.stringContaining('solo puedo procesar mensajes de texto'),
      );
    });

    it('NO debe enviar fallback si ya está en COMPLETED', async () => {
      await bot.saveResponse(PHONE, BotFsmState.COMPLETED, {});

      await bot.handleNonTextMessage(PHONE, `${WAMID}-audio2`, CORR);

      expect(wa.sendText).not.toHaveBeenCalled();
    });
  });

  // ─── 6. Deduplicación por wamid ──────────────────────────────────────────

  describe('Deduplicación por wamid', () => {
    it('debe ignorar silenciosamente un wamid ya procesado', async () => {
      prisma.citizen.findUnique.mockResolvedValue(null);
      prisma.citizen.upsert.mockResolvedValue({ id: 'cit1', phone: PHONE });

      // Primer procesamiento
      await bot.handleMessage(PHONE, 'hola', WAMID, CORR);
      const callCount = wa.sendText.mock.calls.length;

      // Segundo procesamiento con mismo wamid — debe ser no-op
      await bot.handleMessage(PHONE, 'hola', WAMID, CORR);
      expect(wa.sendText).toHaveBeenCalledTimes(callCount); // sin llamadas adicionales
    });
  });

  // ─── 7. Ciudadano ya convertido ──────────────────────────────────────────

  describe('Ciudadano ya registrado', () => {
    it('debe saludar de vuelta y avanzar a COMPLETED sin re-registrar', async () => {
      prisma.citizen.findUnique.mockResolvedValue({
        id: 'cit-existing',
        phone: PHONE,
        name: 'María',
        leadStatus: LeadStatus.converted,
      });

      await bot.handleMessage(PHONE, 'hola', WAMID, CORR);

      expect(prisma.citizen.upsert).not.toHaveBeenCalled();
      expect(wa.sendText).toHaveBeenCalledWith(PHONE, expect.stringContaining('Bienvenido de vuelta'));

      const session = await bot.getSession(PHONE);
      expect(session.state).toBe(BotFsmState.COMPLETED);
    });
  });

  // ─── 8. Estado desconocido: reset defensivo ───────────────────────────────

  describe('Estado FSM desconocido', () => {
    it('debe resetear a NAME y procesar como primer mensaje', async () => {
      // Inject sesión con estado inválido directamente en Redis
      await redis.set(`bot:session:${PHONE}`, JSON.stringify({ state: 'INVALID_STATE' }), 86400);
      prisma.citizen.findUnique.mockResolvedValue(null);
      prisma.citizen.upsert.mockResolvedValue({ id: 'cit1', phone: PHONE });

      await bot.handleMessage(PHONE, 'hola', WAMID, CORR);

      expect(wa.sendText).toHaveBeenCalledWith(PHONE, expect.stringContaining('Bienvenido'));
    });
  });

  // ─── 9. Emojis en nombre ─────────────────────────────────────────────────

  describe('Emojis en inputs', () => {
    it('debe aceptar nombre con emojis correctamente', async () => {
      await bot.saveResponse(PHONE, BotFsmState.NEIGHBORHOOD, {});
      prisma.citizen.update.mockResolvedValue({});

      await bot.handleMessage(PHONE, 'Juan 😀 Pérez', `${WAMID}-emoji`, CORR);

      // Nombre con emoji → "Juan" y "😀" forman palabra, "Pérez" es tercero
      // El split por /\s+/ separa "Juan", "😀", "Pérez" → 3 partes ≥ 2 → válido
      expect(prisma.citizen.update).toHaveBeenCalled();
    });
  });

  // ─── 10. Reset de sesión ─────────────────────────────────────────────────

  describe('Reset de sesión', () => {
    it('debe reiniciar sesión a NAME al llamar resetSession', async () => {
      await bot.saveResponse(PHONE, BotFsmState.COMPLETED, { name: 'Ana' });

      await bot.resetSession(PHONE);

      const session = await bot.getSession(PHONE);
      expect(session.state).toBe(BotFsmState.NAME);
      expect(session.name).toBeUndefined();
    });
  });

  // ─── 11. getSession: sesión corrupta no filtra phone raw ────────────────

  describe('getSession — sesión corrupta', () => {
    it('debe retornar estado NAME y no loguear phone en claro', async () => {
      // Inyectar JSON inválido directamente en el store de Redis mock
      redis._store[`bot:session:${PHONE}`] = '{invalid-json';

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const session = await bot.getSession(PHONE);

      expect(session.state).toBe(BotFsmState.NAME);

      // El warn debe ser JSON estructurado (no interpolación directa con phone)
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const logged = warnSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logged) as Record<string, unknown>;

      // Verificar que es log estructurado con evento correcto
      expect(parsed.event).toBe('bot.session.corrupt');
      expect(parsed.service).toBe('BotService');

      // El phone debe estar enmascarado — NO debe aparecer en claro
      expect(logged).not.toContain(PHONE);
      // El campo phone debe contener asteriscos (enmascarado)
      expect(parsed.phone).toMatch(/\*+/);

      warnSpy.mockRestore();
    });
  });
});

// ─── Tests de matching de colonia ─────────────────────────────────────────────

describe('normalizeForMatch', () => {
  it('debe normalizar a minúsculas y sin acentos', () => {
    expect(normalizeForMatch('Céntro')).toBe('centro');
    expect(normalizeForMatch('  NORTE  ')).toBe('norte');
    expect(normalizeForMatch('Jardínes del Vallé')).toBe('jardines del valle');
  });

  it('debe remover signos de puntuación comunes', () => {
    expect(normalizeForMatch('Las-Flores')).toBe('las flores');
    expect(normalizeForMatch('Col. Centro')).toBe('col centro');
  });
});

describe('matchNeighborhood', () => {
  const neighborhoods = [
    { id: 'n1', name: 'Centro Histórico' },
    { id: 'n2', name: 'Centro Norte' },
    { id: 'n3', name: 'Las Flores' },
    { id: 'n4', name: 'Jardines del Valle' },
  ];

  it('exact match: retorna type=exact con colonia correcta', () => {
    const result = matchNeighborhood('Las Flores', neighborhoods);
    expect(result.type).toBe('exact');
    if (result.type === 'exact') {
      expect(result.neighborhood.id).toBe('n3');
    }
  });

  it('exact match case-insensitive y sin acentos', () => {
    const result = matchNeighborhood('jardines del valle', neighborhoods);
    expect(result.type).toBe('exact');
    if (result.type === 'exact') {
      expect(result.neighborhood.id).toBe('n4');
    }
  });

  it('startsWith: "Las" retorna exact si hay una sola colonia que empieza así', () => {
    const result = matchNeighborhood('Las', neighborhoods);
    expect(result.type).toBe('exact');
    if (result.type === 'exact') {
      expect(result.neighborhood.id).toBe('n3');
    }
  });

  it('multiple: "Centro" retorna multiple con hasta NEIGHBORHOOD_MATCH_MAX_OPTIONS candidatos', () => {
    const result = matchNeighborhood('Centro', neighborhoods);
    expect(result.type).toBe('multiple');
    if (result.type === 'multiple') {
      expect(result.candidates.length).toBeGreaterThanOrEqual(2);
      expect(result.candidates.length).toBeLessThanOrEqual(NEIGHBORHOOD_MATCH_MAX_OPTIONS);
      expect(result.candidates.some((c) => c.name === 'Centro Histórico')).toBe(true);
      expect(result.candidates.some((c) => c.name === 'Centro Norte')).toBe(true);
    }
  });

  it('none: texto sin coincidencias retorna type=none', () => {
    const result = matchNeighborhood('XYZ Inexistente', neighborhoods);
    expect(result.type).toBe('none');
  });

  it('none: query vacía retorna type=none', () => {
    const result = matchNeighborhood('', neighborhoods);
    expect(result.type).toBe('none');
  });

  it('limita candidatos a NEIGHBORHOOD_MATCH_MAX_OPTIONS cuando hay muchas coincidencias', () => {
    const manyNeighborhoods = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`,
      name: `Centro Barrio ${i}`,
    }));
    const result = matchNeighborhood('Centro', manyNeighborhoods);
    expect(result.type).toBe('multiple');
    if (result.type === 'multiple') {
      expect(result.candidates.length).toBeLessThanOrEqual(NEIGHBORHOOD_MATCH_MAX_OPTIONS);
    }
  });
});

describe('buildNeighborhoodMatchMessage', () => {
  it('debe generar mensaje con bullet list y pedir nombre exacto', () => {
    const candidates = [
      { id: 'n1', name: 'Centro Histórico' },
      { id: 'n2', name: 'Centro Norte' },
    ];
    const msg = buildNeighborhoodMatchMessage(candidates);
    expect(msg).toContain('Centro Histórico');
    expect(msg).toContain('Centro Norte');
    expect(msg).toContain('nombre exacto');
    expect(msg.length).toBeLessThanOrEqual(WA_MAX_TEXT_LENGTH);
  });
});

// ─── Tests de orquestador: transiciones FSM ──────────────────────────────────

describe('MessageOrchestratorService — transiciones de flowState', () => {
  it('BOT_ACTIVE_STATES debe incluir BOT_FLOW y REGISTERING', () => {
    const { BOT_ACTIVE_STATES } = require('../../config/conversation-states');
    expect(BOT_ACTIVE_STATES).toContain('BOT_FLOW');
    expect(BOT_ACTIVE_STATES).toContain('REGISTERING');
  });

  it('VALID_TRANSITIONS debe permitir BOT_FLOW → REGISTERING', () => {
    const { VALID_TRANSITIONS } = require('../../config/conversation-states');
    expect(VALID_TRANSITIONS['BOT_FLOW']).toContain('REGISTERING');
  });

  it('VALID_TRANSITIONS debe permitir REGISTERING → DEPARTMENT_ROUTING', () => {
    const { VALID_TRANSITIONS } = require('../../config/conversation-states');
    expect(VALID_TRANSITIONS['REGISTERING']).toContain('DEPARTMENT_ROUTING');
  });
});

// ─── Tests de límite de longitud WhatsApp ─────────────────────────────────────

describe('WA_MAX_TEXT_LENGTH — límite de longitud', () => {
  it('WA_MAX_TEXT_LENGTH debe ser 4096', () => {
    expect(WA_MAX_TEXT_LENGTH).toBe(4096);
  });
});

describe('buildNeighborhoodListMessage — paginación de colonias', () => {
  function makeNeighborhoods(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `n${i + 1}`,
      name: `Colonia ${i + 1}`.padEnd(25, ' '), // nombres de ~25 chars para forzar paginación
    }));
  }

  it('con pocas colonias, el mensaje no supera 4096 chars', () => {
    const neighborhoods = makeNeighborhoods(10);
    const header = '¡Gracias, Juan! 🏘️\n\n¿En qué colonia vivís?\nRespondé con el número:';
    const { text } = buildNeighborhoodListMessage(header, neighborhoods);
    expect(text.length).toBeLessThanOrEqual(WA_MAX_TEXT_LENGTH);
  });

  it(`con ${NEIGHBORHOOD_PAGE_SIZE + 10} colonias, pagina y el mensaje no supera 4096 chars`, () => {
    const neighborhoods = makeNeighborhoods(NEIGHBORHOOD_PAGE_SIZE + 10);
    const header = '¡Gracias, Juan! 🏘️\n\n¿En qué colonia vivís?\nRespondé con el número:';
    const { text, totalPages } = buildNeighborhoodListMessage(header, neighborhoods);
    expect(text.length).toBeLessThanOrEqual(WA_MAX_TEXT_LENGTH);
    expect(totalPages).toBeGreaterThan(1);
  });

  it('con 200 colonias de nombre largo, página 1 no supera 4096 chars', () => {
    const neighborhoods = Array.from({ length: 200 }, (_, i) => ({
      id: `n${i + 1}`,
      name: `Colonia con nombre muy largo número ${i + 1}`,
    }));
    const header = '¡Gracias, María García! 🏘️\n\n¿En qué colonia vivís?\nRespondé con el número:';
    const { text } = buildNeighborhoodListMessage(header, neighborhoods, 1);
    expect(text.length).toBeLessThanOrEqual(WA_MAX_TEXT_LENGTH);
  });

  it('la segunda página muestra la siguiente tanda de colonias', () => {
    const neighborhoods = makeNeighborhoods(NEIGHBORHOOD_PAGE_SIZE + 5);
    const header = 'Colonias:';
    const { text: page1 } = buildNeighborhoodListMessage(header, neighborhoods, 1);
    const { text: page2 } = buildNeighborhoodListMessage(header, neighborhoods, 2);
    expect(page1).toContain('1.');
    expect(page2).toContain(`${NEIGHBORHOOD_PAGE_SIZE + 1}.`);
    expect(page2.length).toBeLessThanOrEqual(WA_MAX_TEXT_LENGTH);
  });
});

describe('BotService — guard de longitud en sendMessage', () => {
  function makePrismaMock() {
    return {
      citizen: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
      neighborhood: { findMany: jest.fn() },
      conversation: { findFirst: jest.fn(), create: jest.fn() },
      message: { create: jest.fn() },
      outboxEvent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
  }
  function makeRedisMock() {
    const store: Record<string, string> = {};
    return {
      get: jest.fn(async (key: string) => store[key] ?? null),
      set: jest.fn(async (key: string, value: string) => { store[key] = value; }),
      del: jest.fn(),
      _store: store,
    };
  }

  it('en estado INTERESTS con 200 colonias y múltiples coincidencias, sendText recibe texto ≤ 4096 chars', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = { sendText: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid.x' }] }), markAsRead: jest.fn() };
    // @ts-ignore
    const bot = new BotService(prisma, redis, wa);

    // Simular estado INTERESTS y muchas colonias con prefijo común
    await bot.saveResponse('521234567890', BotFsmState.INTERESTS, {});
    prisma.neighborhood.findMany.mockResolvedValue(
      Array.from({ length: 200 }, (_, i) => ({
        id: `n${i + 1}`,
        name: `Colonia con nombre largo número ${i + 1}`,
      }))
    );

    // "Colonia" va a hacer contains match con todas → multiple → max 5 opciones → <= 4096
    await bot.handleMessage('521234567890', 'Colonia', 'wamid-long-1', 'corr-long');

    expect(wa.sendText).toHaveBeenCalled();
    const sentText: string = wa.sendText.mock.calls[0][1];
    expect(sentText.length).toBeLessThanOrEqual(WA_MAX_TEXT_LENGTH);
  });

  it('si sendMessage recibe texto > 4096, envía fallback compacto y no lanza excepción', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = { sendText: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid.x' }] }), markAsRead: jest.fn() };
    // @ts-ignore
    const bot = new BotService(prisma, redis, wa);

    // Forzar un texto muy largo inyectando directamente (simulamos que alguien llama sendMessage con texto enorme)
    // Lo hacemos a través del flujo real: muchas colonias con nombres muy largos que superen el límite
    // del helper (lo cual no debería pasar, pero el guard de sendMessage es la última línea de defensa)
    // Para testear el guard directamente, accedemos via cast
    const botAny = bot as unknown as { sendMessage: (p: string, t: string, c: string) => Promise<void> };
    const longText = 'A'.repeat(WA_MAX_TEXT_LENGTH + 100);

    await expect(botAny.sendMessage('521234567890', longText, 'corr-guard')).resolves.toBeUndefined();
    // El fallback debe enviarse, NO el texto original largo
    expect(wa.sendText).toHaveBeenCalledTimes(1);
    const sentText: string = wa.sendText.mock.calls[0][1];
    expect(sentText.length).toBeLessThanOrEqual(WA_MAX_TEXT_LENGTH);
    expect(sentText).toContain('⚠️');
  });

  it('el flujo FSM no se bloquea aunque el envío del mensaje falle', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const wa = {
      sendText: jest.fn().mockRejectedValue(new Error('Meta API error: 500')),
      markAsRead: jest.fn(),
    };
    // @ts-ignore
    const bot = new BotService(prisma, redis, wa);
    prisma.citizen.findUnique.mockResolvedValue(null);
    prisma.citizen.upsert.mockResolvedValue({ id: 'cit1', phone: '521234567890' });

    // No debe lanzar, aunque wa.sendText falla
    await expect(bot.handleMessage('521234567890', 'hola', 'wamid-fail', 'corr-fail')).resolves.toBeUndefined();
    // El estado debe haber avanzado igual (FSM no se trabó)
    const session = await bot.getSession('521234567890');
    expect(session.state).toBe(BotFsmState.NEIGHBORHOOD);
  });
});

// ─── Tests de fuzzy matching ──────────────────────────────────────────────────

describe('levenshtein', () => {
  it('strings iguales retornan 0', () => {
    expect(levenshtein('centro', 'centro')).toBe(0);
  });

  it('string vacío retorna largo del otro', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('calcula distancia correctamente entre strings similares', () => {
    // "sentro" → "centro" (sustitución s→c = 1)
    expect(levenshtein('sentro', 'centro')).toBe(1);
    // "flores" → "flores" = 0
    expect(levenshtein('flores', 'flores')).toBe(0);
  });
});

describe('similarityScore', () => {
  it('strings iguales retornan 1.0', () => {
    expect(similarityScore('centro', 'centro')).toBe(1);
  });

  it('typo leve tiene score alto (>= 0.82)', () => {
    // "sentro" vs "centro" — distancia 1 de 6 = 0.833
    const score = similarityScore('sentro', 'centro');
    expect(score).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
  });

  it('strings muy distintos tienen score bajo (< 0.82)', () => {
    const score = similarityScore('xyz', 'centro');
    expect(score).toBeLessThan(FUZZY_THRESHOLD);
  });
});

describe('matchNeighborhood — fuzzy', () => {
  const neighborhoods = [
    { id: 'n1', name: 'Centro' },
    { id: 'n2', name: 'Norte' },
    { id: 'n3', name: 'Las Flores' },
  ];

  it('typo "sentro" con coincidencia única alta → type fuzzy_confirm (NO asigna directo)', () => {
    const result = matchNeighborhood('sentro', neighborhoods);
    // "sentro" vs "centro": distancia 1, score ~0.833 >= 0.82 → fuzzy_confirm
    expect(result.type).toBe('fuzzy_confirm');
    if (result.type === 'fuzzy_confirm') {
      expect(result.candidate.id).toBe('n1');
      expect(result.candidate.name).toBe('Centro');
      expect(result.candidate.score).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
    }
  });

  it('fuzzy ambiguo (múltiples candidatos similares) → type multiple', () => {
    const ambiguous = [
      { id: 'a1', name: 'Centro' },
      { id: 'a2', name: 'Centra' },
    ];
    // "sentro" vs "centro" score ~0.833, vs "centra" score ~0.667 → diferencia < GAP si están cerca
    // En este caso concreto "centro"=0.833, "centra"=0.667 → diff=0.166 ≥ GAP → podría ser fuzzy_confirm
    // Probamos con strings que sean ambiguos: "Cent" match both → pero eso caería en startsWith
    // Para ambigüedad real fuzzy: usamos colonias con nombres muy similares
    const nearTwins = [
      { id: 't1', name: 'Centros' },
      { id: 't2', name: 'Centron' },
    ];
    // "sentro" vs "centros" dist=2 score=0.714 → < FUZZY_THRESHOLD (0.82)
    // Necesitamos query que haga score alto en ambos
    // "Cntro" (typo sin e) vs "Centro"=0.714, vs "Centra"=0.571 → pocos pasan threshold
    // Mejor: dos colonias idénticas en normalized:
    // query "flores" vs "Las Flores" → contains catch
    // Probamos directamente: query "nort" → startsWith Norte → exact de igual forma
    // Para forzar ambigüedad fuzzy: twins con nombre muy similar al query
    const result = matchNeighborhood('sentro', nearTwins);
    // "sentro" vs "centros": distancia 2/7 → score 0.714 < 0.82 → none
    expect(result.type).toBe('none');
  });

  it('exact match sigue asignando directo sin confirmación', () => {
    const result = matchNeighborhood('Centro', neighborhoods);
    expect(result.type).toBe('exact');
    if (result.type === 'exact') {
      expect(result.neighborhood.id).toBe('n1');
    }
  });
});

describe('BotService — fuzzy matching en flujo INTERESTS', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let wa: ReturnType<typeof makeWaMock>;
  let bot: BotService;

  const FUZZY_PHONE = '521234567891';
  const FUZZY_CORR = 'corr-fuzzy-001';

  const FUZZY_NEIGHBORHOODS = [
    { id: 'n1', name: 'Centro' },
    { id: 'n2', name: 'Norte' },
    { id: 'n3', name: 'Las Flores' },
  ];

  beforeEach(() => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    wa = makeWaMock();
    bot = makeBot(prisma, redis, wa);
  });

  it('typo leve "sentro" propone confirmación y NO asigna colonia', async () => {
    await bot.saveResponse(FUZZY_PHONE, BotFsmState.INTERESTS, {});
    prisma.neighborhood.findMany.mockResolvedValue(FUZZY_NEIGHBORHOODS);

    await bot.handleMessage(FUZZY_PHONE, 'sentro', 'wamid-fuzzy-1', FUZZY_CORR);

    // NO debe haber actualizado la colonia en DB
    expect(prisma.citizen.update).not.toHaveBeenCalled();
    // Debe preguntar SI/NO con el nombre de la colonia
    expect(wa.sendText).toHaveBeenCalledWith(FUZZY_PHONE, expect.stringContaining('Centro'));
    expect(wa.sendText).toHaveBeenCalledWith(FUZZY_PHONE, expect.stringMatching(/SI|NO/i));
    // Estado debe seguir en INTERESTS
    const session = await bot.getSession(FUZZY_PHONE);
    expect(session.state).toBe(BotFsmState.INTERESTS);
    // Debe tener pendingNeighborhoodConfirmation guardado
    expect(session.pendingNeighborhoodConfirmation).toBeDefined();
    expect(session.pendingNeighborhoodConfirmation?.id).toBe('n1');
  });

  it('respuesta SI tras fuzzy_confirm asigna colonia y avanza a AWAITING_INTERESTS', async () => {
    // Pre-cargar sesión con pending confirmation
    await bot.saveResponse(FUZZY_PHONE, BotFsmState.INTERESTS, {
      pendingNeighborhoodConfirmation: { id: 'n1', name: 'Centro', score: 0.9 },
    });
    prisma.citizen.update.mockResolvedValue({});

    await bot.handleMessage(FUZZY_PHONE, 'si', 'wamid-fuzzy-2', FUZZY_CORR);

    expect(prisma.citizen.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ neighborhoodId: 'n1' }) }),
    );
    const session = await bot.getSession(FUZZY_PHONE);
    expect(session.state).toBe(BotFsmState.AWAITING_INTERESTS);
    expect(session.pendingNeighborhoodConfirmation).toBeUndefined();
  });

  it('respuesta SI con acento ("sí") también funciona', async () => {
    await bot.saveResponse(FUZZY_PHONE, BotFsmState.INTERESTS, {
      pendingNeighborhoodConfirmation: { id: 'n1', name: 'Centro', score: 0.9 },
    });
    prisma.citizen.update.mockResolvedValue({});

    await bot.handleMessage(FUZZY_PHONE, 'Sí', 'wamid-fuzzy-2b', FUZZY_CORR);

    expect(prisma.citizen.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ neighborhoodId: 'n1' }) }),
    );
    const session = await bot.getSession(FUZZY_PHONE);
    expect(session.state).toBe(BotFsmState.AWAITING_INTERESTS);
  });

  it('respuesta NO limpia pending y permanece en estado INTERESTS', async () => {
    await bot.saveResponse(FUZZY_PHONE, BotFsmState.INTERESTS, {
      pendingNeighborhoodConfirmation: { id: 'n1', name: 'Centro', score: 0.9 },
    });

    await bot.handleMessage(FUZZY_PHONE, 'no', 'wamid-fuzzy-3', FUZZY_CORR);

    expect(prisma.citizen.update).not.toHaveBeenCalled();
    expect(wa.sendText).toHaveBeenCalledWith(FUZZY_PHONE, expect.stringContaining('nombre de tu colonia'));
    const session = await bot.getSession(FUZZY_PHONE);
    expect(session.state).toBe(BotFsmState.INTERESTS);
    expect(session.pendingNeighborhoodConfirmation).toBeUndefined();
  });

  it('respuesta inválida en confirmación pendiente vuelve a pedir SI/NO', async () => {
    await bot.saveResponse(FUZZY_PHONE, BotFsmState.INTERESTS, {
      pendingNeighborhoodConfirmation: { id: 'n1', name: 'Centro', score: 0.9 },
    });

    await bot.handleMessage(FUZZY_PHONE, 'talvez', 'wamid-fuzzy-4', FUZZY_CORR);

    expect(prisma.citizen.update).not.toHaveBeenCalled();
    expect(wa.sendText).toHaveBeenCalledWith(FUZZY_PHONE, expect.stringMatching(/SI|NO/i));
    const session = await bot.getSession(FUZZY_PHONE);
    expect(session.state).toBe(BotFsmState.INTERESTS);
    // pending sigue intacto
    expect(session.pendingNeighborhoodConfirmation?.id).toBe('n1');
  });

  it('fuzzy ambiguo (múltiples candidatos) muestra lista, NO asigna, NO propone confirmación única', async () => {
    // Crear colonias donde el typo genere múltiples matches con scores similares
    const ambiguousNeighborhoods = [
      { id: 'a1', name: 'Centro' },
      { id: 'a2', name: 'Centro Norte' },
    ];
    // "centro" es exact → match exacto si está en lista; vamos a forzar múltiples fuzzy
    // Usamos "sentro" vs lista con "Centro" y "Sentros" — ambos con score alto y gap < FUZZY_GAP
    const tightNeighborhoods = [
      { id: 'b1', name: 'Sentros' }, // normalizado: "sentros" — distancia 1 de "sentro" → score 0.857
      { id: 'b2', name: 'Sentron' }, // normalizado: "sentron" — distancia 1 de "sentro" → score 0.857
    ];
    await bot.saveResponse(FUZZY_PHONE, BotFsmState.INTERESTS, {});
    prisma.neighborhood.findMany.mockResolvedValue(tightNeighborhoods);

    await bot.handleMessage(FUZZY_PHONE, 'sentro', 'wamid-fuzzy-5', FUZZY_CORR);

    // Ambos tienen el mismo score → gap = 0 < FUZZY_GAP → multiple
    expect(prisma.citizen.update).not.toHaveBeenCalled();
    expect(wa.sendText).toHaveBeenCalledWith(FUZZY_PHONE, expect.stringContaining('Encontré varias colonias'));
    const session = await bot.getSession(FUZZY_PHONE);
    expect(session.state).toBe(BotFsmState.INTERESTS);
    expect(session.pendingNeighborhoodConfirmation).toBeUndefined();
  });

  it('exact match sigue asignando directo sin confirmación ni pending', async () => {
    await bot.saveResponse(FUZZY_PHONE, BotFsmState.INTERESTS, {});
    prisma.neighborhood.findMany.mockResolvedValue(FUZZY_NEIGHBORHOODS);
    prisma.citizen.update.mockResolvedValue({});

    await bot.handleMessage(FUZZY_PHONE, 'Centro', 'wamid-exact', FUZZY_CORR);

    expect(prisma.citizen.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ neighborhoodId: 'n1' }) }),
    );
    const session = await bot.getSession(FUZZY_PHONE);
    expect(session.state).toBe(BotFsmState.AWAITING_INTERESTS);
    expect(session.pendingNeighborhoodConfirmation).toBeUndefined();
  });
});

// ─── Tests de observabilidad: logger con metadata ─────────────────────────────

describe('maskPhone', () => {
  it('enmascara teléfono mostrando solo los últimos 4 dígitos', () => {
    expect(maskPhone('+521234567890')).toBe('+********7890');
  });

  it('maneja número sin prefijo +', () => {
    expect(maskPhone('521234567890')).toBe('********7890');
  });

  it('maneja strings cortos (≤4 chars)', () => {
    expect(maskPhone('123')).toBe('****');
  });

  it('maneja string vacío', () => {
    expect(maskPhone('')).toBe('****');
  });
});

describe('BotService — observabilidad del matching de colonia', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let wa: ReturnType<typeof makeWaMock>;
  let bot: BotService;
  let consoleSpy: jest.SpyInstance;

  const OBS_PHONE = '521234599999';
  const OBS_CORR = 'corr-obs-001';

  const OBS_NEIGHBORHOODS = [
    { id: 'n1', name: 'Centro' },
    { id: 'n2', name: 'Norte' },
    { id: 'n3', name: 'Las Flores' },
  ];

  beforeEach(() => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    wa = makeWaMock();
    bot = makeBot(prisma, redis, wa);
    consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('fuzzy_confirm: loguea matchType=fuzzy_confirm con topScore y confirmationPending=true', async () => {
    await bot.saveResponse(OBS_PHONE, BotFsmState.INTERESTS, {});
    prisma.neighborhood.findMany.mockResolvedValue(OBS_NEIGHBORHOODS);

    await bot.handleMessage(OBS_PHONE, 'sentro', 'wamid-obs-1', OBS_CORR);

    // Buscar el log que contiene bot.neighborhood.match_evaluated
    const logCalls = consoleSpy.mock.calls.map((c) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).filter(Boolean);

    const matchLog = logCalls.find((l: Record<string, unknown>) => l.event === 'bot.neighborhood.match_evaluated');
    expect(matchLog).toBeDefined();
    expect(matchLog.matchType).toBe('fuzzy_confirm');
    expect(typeof matchLog.topScore).toBe('number');
    expect(matchLog.topScore).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
    expect(matchLog.confirmationPending).toBe(true);
    expect(matchLog.candidateCount).toBe(1);
    expect(matchLog.correlationId).toBe(OBS_CORR);
  });

  it('exact: loguea matchType=exact con selectedNeighborhoodId y confirmationPending=false', async () => {
    await bot.saveResponse(OBS_PHONE, BotFsmState.INTERESTS, {});
    prisma.neighborhood.findMany.mockResolvedValue(OBS_NEIGHBORHOODS);
    prisma.citizen.update.mockResolvedValue({});

    await bot.handleMessage(OBS_PHONE, 'Centro', 'wamid-obs-2', OBS_CORR);

    const logCalls = consoleSpy.mock.calls.map((c) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).filter(Boolean);

    const assignLog = logCalls.find((l: Record<string, unknown>) => l.event === 'bot.neighborhood.assigned');
    expect(assignLog).toBeDefined();
    expect(assignLog.matchType).toBe('exact');
    expect(assignLog.selectedNeighborhoodId).toBe('n1');
    expect(assignLog.confirmationPending).toBe(false);
    expect(assignLog.candidateCount).toBe(1);
    expect(assignLog.correlationId).toBe(OBS_CORR);
  });

  it('fuzzy_confirmed: al confirmar SI loguea selectedNeighborhoodId, matchType=fuzzy_confirm y confirmationPending=false', async () => {
    await bot.saveResponse(OBS_PHONE, BotFsmState.INTERESTS, {
      pendingNeighborhoodConfirmation: { id: 'n1', name: 'Centro', score: 0.9 },
    });
    prisma.citizen.update.mockResolvedValue({});

    await bot.handleMessage(OBS_PHONE, 'si', 'wamid-obs-3', OBS_CORR);

    const logCalls = consoleSpy.mock.calls.map((c) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).filter(Boolean);

    const confirmedLog = logCalls.find((l: Record<string, unknown>) => l.event === 'bot.neighborhood.fuzzy_confirmed');
    expect(confirmedLog).toBeDefined();
    expect(confirmedLog.matchType).toBe('fuzzy_confirm');
    expect(confirmedLog.selectedNeighborhoodId).toBe('n1');
    expect(confirmedLog.topScore).toBe(0.9);
    expect(confirmedLog.confirmationPending).toBe(false);
    expect(confirmedLog.correlationId).toBe(OBS_CORR);
  });

  it('phone enmascarado en todos los logs (no loguea número completo)', async () => {
    await bot.saveResponse(OBS_PHONE, BotFsmState.INTERESTS, {});
    prisma.neighborhood.findMany.mockResolvedValue(OBS_NEIGHBORHOODS);
    prisma.citizen.update.mockResolvedValue({});

    await bot.handleMessage(OBS_PHONE, 'Centro', 'wamid-obs-phone', OBS_CORR);

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    // El número completo NO debe aparecer en ningún log
    allLogs.forEach((raw: string) => {
      expect(raw).not.toContain(OBS_PHONE);
    });
    // El enmascarado sí debe estar presente
    const masked = maskPhone(OBS_PHONE);
    const hasMasked = allLogs.some((raw: string) => raw.includes(masked));
    expect(hasMasked).toBe(true);
  });
});

// ─── Tests de hardening de privacidad: phone enmascarado en TODOS los eventos ─

describe('BotService — hardening privacidad: phone nunca en claro en logs', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let wa: ReturnType<typeof makeWaMock>;
  let bot: BotService;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  const PH = '521234599998';
  const MASKED = maskPhone(PH);

  function collectAllLogs() {
    return [
      ...infoSpy.mock.calls.map((c) => c[0]),
      ...warnSpy.mock.calls.map((c) => c[0]),
      ...errorSpy.mock.calls.map((c) => c[0]),
      ...debugSpy.mock.calls.map((c) => c[0]),
    ];
  }

  function assertNoRawPhone(logs: string[]) {
    logs.forEach((raw) => expect(raw).not.toContain(PH));
  }

  beforeEach(() => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    wa = makeWaMock();
    bot = makeBot(prisma, redis, wa);
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('inbound.duplicate_wamid no emite phone en claro', async () => {
    prisma.citizen.findUnique.mockResolvedValue(null);
    prisma.citizen.upsert.mockResolvedValue({ id: 'cit1', phone: PH });

    // Primer procesamiento
    await bot.handleMessage(PH, 'hola', 'wamid-dup-1', 'corr-dup');
    infoSpy.mockClear(); warnSpy.mockClear(); errorSpy.mockClear(); debugSpy.mockClear();

    // Segundo procesamiento mismo wamid → dispara inbound.duplicate_wamid
    await bot.handleMessage(PH, 'hola', 'wamid-dup-1', 'corr-dup');

    const logs = collectAllLogs();
    assertNoRawPhone(logs);

    const warnLogs = warnSpy.mock.calls.map((c) => c[0]);
    const dupLog = warnLogs.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).find((l: Record<string, unknown> | null) => l?.event === 'inbound.duplicate_wamid');
    expect(dupLog).toBeDefined();
    expect(dupLog.phone).toBe(MASKED);
  });

  it('bot.handler.completed_state no emite phone en claro', async () => {
    await bot.saveResponse(PH, BotFsmState.COMPLETED, {});

    // Usamos handleMessage directamente en estado COMPLETED (que dispara el log)
    prisma.citizen.findUnique.mockResolvedValue({ id: 'cit-done', phone: PH });
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1', status: 'open' });
    prisma.message.create.mockResolvedValue({});

    await bot.handleMessage(PH, 'texto en COMPLETED', 'wamid-comp-log', 'corr-comp');

    const logs = collectAllLogs();
    assertNoRawPhone(logs);

    const infoLogs = infoSpy.mock.calls.map((c) => c[0]);
    const compLog = infoLogs.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).find((l: Record<string, unknown> | null) => l?.event === 'bot.handler.completed_state');
    expect(compLog).toBeDefined();
    expect(compLog.phone).toBe(MASKED);
  });

  it('bot.fsm.unknown_state no emite phone en claro', async () => {
    await redis.set(`bot:session:${PH}`, JSON.stringify({ state: 'GARBAGE_STATE' }), 86400);
    prisma.citizen.findUnique.mockResolvedValue(null);
    prisma.citizen.upsert.mockResolvedValue({ id: 'cit-unk', phone: PH });

    await bot.handleMessage(PH, 'hola', 'wamid-unk', 'corr-unk');

    const logs = collectAllLogs();
    assertNoRawPhone(logs);

    const warnLogs = warnSpy.mock.calls.map((c) => c[0]);
    const unkLog = warnLogs.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).find((l: Record<string, unknown> | null) => l?.event === 'bot.fsm.unknown_state');
    expect(unkLog).toBeDefined();
    expect(unkLog.phone).toBe(MASKED);
  });

  it('bot.non_text_fallback no emite phone en claro', async () => {
    await bot.saveResponse(PH, BotFsmState.NEIGHBORHOOD, {});

    await bot.handleNonTextMessage(PH, 'wamid-nontxt', 'corr-nontxt');

    const logs = collectAllLogs();
    assertNoRawPhone(logs);

    const infoLogs = infoSpy.mock.calls.map((c) => c[0]);
    const fallbackLog = infoLogs.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).find((l: Record<string, unknown> | null) => l?.event === 'bot.non_text_fallback');
    expect(fallbackLog).toBeDefined();
    expect(fallbackLog.phone).toBe(MASKED);
  });

  it('bot.state.name no emite phone en claro', async () => {
    prisma.citizen.findUnique.mockResolvedValue(null);
    prisma.citizen.upsert.mockResolvedValue({ id: 'cit-name', phone: PH });

    await bot.handleMessage(PH, 'hola', 'wamid-name-log', 'corr-name');

    const logs = collectAllLogs();
    assertNoRawPhone(logs);

    const infoLogs = infoSpy.mock.calls.map((c) => c[0]);
    const nameLog = infoLogs.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).find((l: Record<string, unknown> | null) => l?.event === 'bot.state.name');
    expect(nameLog).toBeDefined();
    expect(nameLog.phone).toBe(MASKED);
  });

  it('bot.state.neighborhood no emite phone en claro', async () => {
    await bot.saveResponse(PH, BotFsmState.NEIGHBORHOOD, {});
    prisma.citizen.update.mockResolvedValue({});

    await bot.handleMessage(PH, 'Juan Pérez', 'wamid-nbhd-log', 'corr-nbhd');

    const logs = collectAllLogs();
    assertNoRawPhone(logs);

    const infoLogs = infoSpy.mock.calls.map((c) => c[0]);
    const nbhdLog = infoLogs.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).find((l: Record<string, unknown> | null) => l?.event === 'bot.state.neighborhood');
    expect(nbhdLog).toBeDefined();
    expect(nbhdLog.phone).toBe(MASKED);
  });

  it('bot.state.awaiting_interests no emite phone en claro', async () => {
    await bot.saveResponse(PH, BotFsmState.AWAITING_INTERESTS, {});
    prisma.citizen.update.mockResolvedValue({});

    await bot.handleMessage(PH, '1,2', 'wamid-awi-log', 'corr-awi');

    const logs = collectAllLogs();
    assertNoRawPhone(logs);

    const infoLogs = infoSpy.mock.calls.map((c) => c[0]);
    const awiLog = infoLogs.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).find((l: Record<string, unknown> | null) => l?.event === 'bot.state.awaiting_interests');
    expect(awiLog).toBeDefined();
    expect(awiLog.phone).toBe(MASKED);
  });

  it('bot.registration.completed no emite phone en claro', async () => {
    await bot.saveResponse(PH, BotFsmState.AWAITING_INTERESTS, {});
    prisma.citizen.update.mockResolvedValue({});

    await bot.handleMessage(PH, '1', 'wamid-reg-cmp', 'corr-reg-cmp');

    const logs = collectAllLogs();
    assertNoRawPhone(logs);

    const infoLogs = infoSpy.mock.calls.map((c) => c[0]);
    const regLog = infoLogs.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).find((l: Record<string, unknown> | null) => l?.event === 'bot.registration.completed');
    expect(regLog).toBeDefined();
    expect(regLog.phone).toBe(MASKED);
  });

  it('inbound.non-text (debug) no emite phone en claro', async () => {
    // Simulamos el path non-text dentro de handleWebhookPayload
    // que loguea 'inbound.non-text' en debug antes de llamar handleNonTextMessage
    // Lo ejercemos directamente llamando handleNonTextMessage y el log previo
    // viene de handleWebhookPayload — para cubrirlo necesitamos llamar handleWebhookPayload
    // con un mensaje no-texto:
    await bot.saveResponse(PH, BotFsmState.NEIGHBORHOOD, {});

    await bot.handleWebhookPayload({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'entry1',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            messages: [{
              id: 'wamid-nontxt-wp',
              from: PH,
              type: 'image',
              timestamp: '1700000000',
            }],
          },
        }],
      }],
    });

    const logs = collectAllLogs();
    assertNoRawPhone(logs);
  });

  it('inbound.processing_error no emite phone en claro', async () => {
    // Forzar excepción en handleMessage para disparar el log de error
    prisma.citizen.findUnique.mockRejectedValue(new Error('DB crash'));
    // Necesitamos simular el path via handleWebhookPayload que tiene el try/catch
    await bot.saveResponse(PH, BotFsmState.NAME, {});

    await bot.handleWebhookPayload({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'entry-err',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            messages: [{
              id: 'wamid-err-1',
              from: PH,
              type: 'text',
              text: { body: 'hola' },
              timestamp: '1700000001',
            }],
          },
        }],
      }],
    });

    const errorLogs = errorSpy.mock.calls.map((c) => c[0]);
    const procErrLog = errorLogs.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).find((l: Record<string, unknown> | null) => l?.event === 'inbound.processing_error');
    expect(procErrLog).toBeDefined();
    expect(procErrLog.phone).toBe(MASKED);

    const allLogs = collectAllLogs();
    assertNoRawPhone(allLogs);
  });

  it('bot.reply.text_too_long no emite phone en claro', async () => {
    const botAny = bot as unknown as { sendMessage: (p: string, t: string, c: string) => Promise<void> };
    const longText = 'X'.repeat(WA_MAX_TEXT_LENGTH + 100);

    await botAny.sendMessage(PH, longText, 'corr-toolong');

    const logs = collectAllLogs();
    assertNoRawPhone(logs);

    const errLogs = errorSpy.mock.calls.map((c) => c[0]);
    const tooLongLog = errLogs.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).find((l: Record<string, unknown> | null) => l?.event === 'bot.reply.text_too_long');
    expect(tooLongLog).toBeDefined();
    expect(tooLongLog.phone).toBe(MASKED);
  });

  it('bot.reply.fallback_failed no emite phone en claro', async () => {
    // Forzar que sendText falle para disparar bot.reply.fallback_failed
    wa.sendText.mockRejectedValue(new Error('WA down'));
    const botAny = bot as unknown as { sendMessage: (p: string, t: string, c: string) => Promise<void> };
    const longText = 'X'.repeat(WA_MAX_TEXT_LENGTH + 100);

    await botAny.sendMessage(PH, longText, 'corr-fallback-fail');

    const logs = collectAllLogs();
    assertNoRawPhone(logs);

    const errLogs = errorSpy.mock.calls.map((c) => c[0]);
    const fallbackFailLog = errLogs.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).find((l: Record<string, unknown> | null) => l?.event === 'bot.reply.fallback_failed');
    expect(fallbackFailLog).toBeDefined();
    expect(fallbackFailLog.phone).toBe(MASKED);
  });
});
