/**
 * Unit tests: phone normalizer
 */
import { normalizePhone, normalizePhoneForStorage, isMexicanNumber } from '../../utils/phone-normalizer';

describe('normalizePhoneForStorage — formato canónico DB (solo dígitos, sin +)', () => {
  it('quita el + si lo tiene', () => {
    expect(normalizePhoneForStorage('+5219612345678')).toBe('5219612345678');
  });

  it('número sin + queda igual', () => {
    expect(normalizePhoneForStorage('5219612345678')).toBe('5219612345678');
  });

  it('quita espacios, guiones y paréntesis', () => {
    expect(normalizePhoneForStorage('+52 961 234 5678')).toBe('529612345678');
  });

  it('+52... y 52... mismo número producen el mismo resultado', () => {
    expect(normalizePhoneForStorage('+521234567890')).toBe(normalizePhoneForStorage('521234567890'));
  });
});

describe('normalizePhone — E.164 con + para uso outbound/display', () => {
  it('debe agregar + si no lo tiene (formato Meta sin +)', () => {
    expect(normalizePhone('5219612345678')).toBe('+5219612345678');
  });

  it('no debe duplicar + si ya lo tiene', () => {
    expect(normalizePhone('+5219612345678')).toBe('+5219612345678');
  });

  it('debe limpiar espacios', () => {
    expect(normalizePhone('521 961 234 5678')).toBe('+5219612345678');
  });
});

describe('isMexicanNumber', () => {
  it('número mexicano sin + → true', () => {
    expect(isMexicanNumber('5219612345678')).toBe(true);
  });

  it('número mexicano con + → true', () => {
    expect(isMexicanNumber('+5219612345678')).toBe(true);
  });

  it('número USA → false', () => {
    expect(isMexicanNumber('15551234567')).toBe(false);
  });
});

describe('Escenario de duplicados — +52 vs 52 deben unificarse', () => {
  it('normalizePhoneForStorage("+521234567890") === normalizePhoneForStorage("521234567890")', () => {
    const a = normalizePhoneForStorage('+521234567890');
    const b = normalizePhoneForStorage('521234567890');
    expect(a).toBe(b);
    expect(a).toBe('521234567890');
  });
});
