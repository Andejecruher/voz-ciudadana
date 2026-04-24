/**
 * Utilidades para generación y verificación de JWT (access + refresh).
 *
 * Estrategia de refresh token:
 * - El refresh token lleva un `jti` (UUID) único.
 * - El hash del token se almacena en Redis con TTL igual a la expiración.
 * - Al renovar, se valida el hash en Redis y se invalida el token anterior (rotación).
 * - Esto permite logout desde server side (revocar jti en Redis).
 */
import crypto from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { env } from '../config/env.config';
import type { AccessTokenPayload, AuthenticatedUser, RefreshTokenPayload } from '../types/auth.types';

// ── Helpers internos ─────────────────────────────────────────────────────────

/** Secreto del refresh token — fallback al JWT_SECRET si no está configurado */
function getRefreshSecret(): string {
  const s = env.JWT_REFRESH_SECRET;
  return s && s.length > 0 ? s : env.JWT_SECRET + '_refresh';
}

// ── Access token ──────────────────────────────────────────────────────────────

/** Genera un access token firmado para el usuario */
export function signAccessToken(user: AuthenticatedUser): string {
  const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    type: 'access',
  };

  // jsonwebtoken@9 types use StringValue from `ms` — cast needed for plain string env var
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const accessToken: string = (sign as any)(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
  return accessToken;
}

/** Verifica y decodifica un access token */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

// ── Refresh token ─────────────────────────────────────────────────────────────

/** Genera un refresh token con jti único y deviceId del dispositivo */
export function signRefreshToken(userId: string, deviceId: string): { token: string; jti: string } {
  const jti = crypto.randomUUID();

  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    sub: userId,
    type: 'refresh',
    jti,
    deviceId,
  };

  // jsonwebtoken@9 types use StringValue from `ms` — cast needed for plain string env var
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const token: string = (sign as any)(payload, getRefreshSecret(), { expiresIn: env.JWT_REFRESH_EXPIRES_IN });

  return { token, jti };
}

/** Verifica y decodifica un refresh token */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return verify(token, getRefreshSecret()) as RefreshTokenPayload;
}

/**
 * Hashea el token para almacenarlo en Redis.
 * Nunca persistir el token raw — solo el hash SHA-256.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Parsea la expiración en segundos de un formato como '7d', '15m', '1h' */
export function parseExpiresInSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 604800; // default 7 días

  const [, num, unit] = match;
  const n = parseInt(num, 10);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (multipliers[unit] ?? 1);
}
