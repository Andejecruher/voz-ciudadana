/**
 * Unit tests: utils/api-response
 *
 * Valida que ok(), fail() y los helpers de envío produzcan el contrato
 * { success, data/error, code?, meta? } correctamente.
 */
import { describe, expect, it } from '@jest/globals';
import type { PaginationMeta } from '../../utils/api-response';
import { fail, ok } from '../../utils/api-response';

// ...existing code...

describe('ok()', () => {
  it('debe retornar success: true con data', () => {
    const result = ok({ id: 1, name: 'test' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1, name: 'test' });
    expect(result.meta).toBeUndefined();
  });

  it('debe incluir meta cuando se provee', () => {
    const meta: PaginationMeta = {
      nextCursor: 'abc123',
      prevCursor: undefined,
      count: 10,
      hasNextPage: true,
    };
    const result = ok([1, 2, 3], meta);
    expect(result.success).toBe(true);
    expect(result.meta).toEqual(meta);
  });

  it('debe funcionar con data vacía (array vacío)', () => {
    const result = ok([]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});

describe('fail()', () => {
  it('debe retornar success: false con message de error', () => {
    const result = fail('Something went wrong');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Something went wrong');
    expect(result.code).toBeUndefined();
  });

  it('debe incluir code cuando se provee', () => {
    const result = fail('Not found', 'NOT_FOUND');
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });
});
