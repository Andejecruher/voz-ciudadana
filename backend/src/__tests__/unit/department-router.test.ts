/**
 * Unit tests: DepartmentRouterStrategy + MetaErrorParser
 * Cubre: FallbackRoutingStrategy, keyword routing, meta error parsing.
 */
import {
  FallbackRoutingStrategy,
  DepartmentRouterStrategy,
} from '../../services/orchestrator/department-router.strategy';
import {
  parseMetaError,
  isMetaErrorResponse,
  isOutsideConversationWindow,
} from '../../utils/meta-error-parser';

function buildCtx(text?: string) {
  return {
    message: {
      type: 'text' as const,
      id: 'test-id',
      from: '5219612345678',
      timestamp: '1700000000',
      text: { body: text ?? 'hola' },
    },
    citizenId: 'citizen-uuid',
    conversationId: 'conv-uuid',
    citizenInterests: [],
  };
}

describe('FallbackRoutingStrategy', () => {
  it('debe retornar "general" siempre', async () => {
    const strategy = new FallbackRoutingStrategy();
    const result = await strategy.route(buildCtx());
    expect(result).toBe('general');
  });
});

describe('DepartmentRouterStrategy — con mock de prisma', () => {
  it('debe usar fallback "general" cuando no hay keyword match', async () => {
    const mockPrisma = {
      department: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    // @ts-ignore mock parcial
    const router = new DepartmentRouterStrategy(mockPrisma);
    const result = await router.route(buildCtx('algo sin keywords'));
    expect(result).toBe('general');
  });
});

describe('isMetaErrorResponse', () => {
  it('debe detectar un body de error Meta válido', () => {
    const errorBody = {
      error: { message: 'Test error', type: 'OAuthException', code: 190, fbtrace_id: 'trace' },
    };
    expect(isMetaErrorResponse(errorBody)).toBe(true);
  });

  it('debe retornar false para body sin campo error', () => {
    expect(isMetaErrorResponse({ data: 'ok' })).toBe(false);
  });

  it('debe retornar false para null', () => {
    expect(isMetaErrorResponse(null)).toBe(false);
  });
});

describe('parseMetaError', () => {
  it('debe parsear código 131047 como error fuera de ventana', () => {
    const errorBody = {
      error: {
        message: 'Re-engagement message outside window',
        type: 'OAuthException',
        code: 131047,
        fbtrace_id: 'trace123',
      },
    };
    const parsed = parseMetaError(errorBody);
    expect(parsed.code).toBe(131047);
    expect(parsed.retryable).toBe(false);
  });
});

describe('isOutsideConversationWindow', () => {
  it('debe retornar true para código 131047', () => {
    expect(isOutsideConversationWindow(131047)).toBe(true);
  });

  it('debe retornar false para otros códigos', () => {
    expect(isOutsideConversationWindow(131000)).toBe(false);
    expect(isOutsideConversationWindow(190)).toBe(false);
  });
});
