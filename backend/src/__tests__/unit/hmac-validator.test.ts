/**
 * Unit tests: HMAC validator, AppSecretProof, IdempotencyKey
 */
import * as crypto from 'crypto';
import {
  validateHmacSignature,
  generateAppSecretProof,
  generateIdempotencyKey,
} from '../../utils/hmac-validator';

describe('validateHmacSignature', () => {
  const appSecret = 'test-secret';
  const body = Buffer.from('{"test":"payload"}');
  const validSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex');

  it('debe retornar true para HMAC válido', () => {
    expect(validateHmacSignature(body, validSignature, appSecret)).toBe(true);
  });

  it('debe retornar false para firma incorrecta', () => {
    expect(validateHmacSignature(body, 'sha256=wrong', appSecret)).toBe(false);
  });

  it('debe retornar false para formato inválido (sin sha256=)', () => {
    expect(validateHmacSignature(body, 'invalid', appSecret)).toBe(false);
  });

  it('debe retornar false si el hash tiene largo diferente', () => {
    expect(validateHmacSignature(body, validSignature + 'extra', appSecret)).toBe(false);
  });
});

describe('generateAppSecretProof', () => {
  it('debe generar el proof HMAC-SHA256 correcto', () => {
    const token = 'access-token';
    const secret = 'app-secret';
    const proof = generateAppSecretProof(token, secret);
    const expected = crypto.createHmac('sha256', secret).update(token).digest('hex');
    expect(proof).toBe(expected);
  });
});

describe('generateIdempotencyKey', () => {
  it('mismo input debe producir misma key', () => {
    const key1 = generateIdempotencyKey('wamid123', '1700000000');
    const key2 = generateIdempotencyKey('wamid123', '1700000000');
    expect(key1).toBe(key2);
  });

  it('diferente wamid debe producir key diferente', () => {
    const key1 = generateIdempotencyKey('wamid123', '1700000000');
    const key3 = generateIdempotencyKey('wamid456', '1700000000');
    expect(key1).not.toBe(key3);
  });

  it('la key debe tener 64 caracteres (SHA-256 hex)', () => {
    const key = generateIdempotencyKey('wamid123', '1700000000');
    expect(key).toHaveLength(64);
  });
});
