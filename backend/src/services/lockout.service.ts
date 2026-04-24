/**
 * Servicio de rate limiting y lockout progresivo para login y refresh.
 *
 * Estrategia de claves Redis:
 *
 * Rate limit por IP (login):
 *   `rl:login:ip:{ip}` → contador de intentos  (TTL: AUTH_RATE_LIMIT_WINDOW_SECONDS)
 *
 * Rate limit por IP (refresh) — ventana más corta para detectar refresh flood:
 *   `rl:refresh:ip:{ip}` → contador de intentos  (TTL: AUTH_REFRESH_RATE_LIMIT_WINDOW_SECONDS)
 *
 * Lockout por identidad (email normalizado):
 *   `lo:fails:{email}` → contador de fallos    (TTL: duración del lockout actual)
 *   `lo:lock:{email}`  → marca de lockout activo (TTL: duración del lockout)
 *   `lo:level:{email}` → nivel de lockout (0,1,2,3...) sin TTL propio (se limpia en login OK)
 *
 * Lockout progresivo (niveles configurable via AUTH_LOCKOUT_DURATIONS):
 *   Nivel 0 → durations[0] (ej: 60s)
 *   Nivel 1 → durations[1] (ej: 300s)
 *   Nivel N >= durations.length → durations[last]
 */
import { env } from '../config/env.config';
import { AppError } from '../utils/app-error';
import { logSecurityEvent } from '../utils/security-logger';
import type { RedisService } from './redis.service';

// ── Configuración ─────────────────────────────────────────────────────────────

/** Parsea la cadena de duraciones de lockout en array de números */
function parseLockoutDurations(): number[] {
  return env.AUTH_LOCKOUT_DURATIONS.split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
}

// ── Claves Redis ──────────────────────────────────────────────────────────────

const keys = {
  ipRateLimit: (ip: string) => `rl:login:ip:${ip}`,
  ipRefreshRateLimit: (ip: string) => `rl:refresh:ip:${ip}`,
  lockoutFails: (email: string) => `lo:fails:${email}`,
  lockoutActive: (email: string) => `lo:lock:${email}`,
  lockoutLevel: (email: string) => `lo:level:${email}`,
} as const;

// ── Servicio ──────────────────────────────────────────────────────────────────

export class LockoutService {
  private readonly durations: number[];

  constructor(private readonly redis: RedisService) {
    this.durations = parseLockoutDurations();
  }

  /**
   * Verifica si la IP está sobre el rate limit de login.
   * @throws AppError 429 si está limitada.
   */
  async checkIpRateLimit(ip: string): Promise<void> {
    const key = keys.ipRateLimit(ip);
    const count = await this.redis.incr(key, env.AUTH_RATE_LIMIT_WINDOW_SECONDS);

    if (count > env.AUTH_RATE_LIMIT_MAX) {
      const ttl = await this.redis.ttl(key);
      logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        ip,
        detail: `login rate limit excedido: ${count} intentos en ventana`,
        metadata: { endpoint: 'login', count, ttlSeconds: ttl },
      });
      throw new AppError(
        `Demasiados intentos de inicio de sesión. Intentá nuevamente en ${Math.ceil(ttl / 60)} minutos.`,
        429,
        'RATE_LIMITED',
      );
    }
  }

  /**
   * Verifica si la IP está sobre el rate limit de refresh token.
   * Ventana más corta: 60 req / 5 min por IP (configurable).
   * @throws AppError 429 si está limitada.
   */
  async checkRefreshRateLimit(ip: string): Promise<void> {
    const windowSeconds = env.AUTH_REFRESH_RATE_LIMIT_WINDOW_SECONDS;
    const max = env.AUTH_REFRESH_RATE_LIMIT_MAX;

    const key = keys.ipRefreshRateLimit(ip);
    const count = await this.redis.incr(key, windowSeconds);

    if (count > max) {
      const ttl = await this.redis.ttl(key);
      logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        ip,
        detail: `refresh rate limit excedido: ${count} intentos en ventana`,
        metadata: { endpoint: 'refresh', count, ttlSeconds: ttl },
      });
      throw new AppError(
        `Demasiados intentos de renovación de sesión. Intentá nuevamente en ${Math.ceil(ttl / 60)} minutos.`,
        429,
        'RATE_LIMITED',
      );
    }
  }

  /**
   * Verifica si la identidad (email) está bloqueada.
   * @throws AppError 429 si hay lockout activo.
   */
  async checkLockout(email: string, context?: { ip?: string; userAgent?: string }): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const lockKey = keys.lockoutActive(normalizedEmail);
    const locked = await this.redis.get(lockKey);

    if (locked) {
      const ttl = await this.redis.ttl(lockKey);
      const wait = ttl > 0 ? ` Intentá nuevamente en ${Math.ceil(ttl / 60)} minutos.` : '';
      logSecurityEvent({
        type: 'ACCOUNT_LOCKED',
        email: normalizedEmail,
        ip: context?.ip,
        userAgent: context?.userAgent,
        detail: 'intento de login en cuenta bloqueada',
        metadata: { ttlSeconds: ttl },
      });
      throw new AppError(
        `Cuenta temporalmente bloqueada por múltiples intentos fallidos.${wait}`,
        429,
        'ACCOUNT_LOCKED',
      );
    }
  }

  /**
   * Registra un intento fallido de login para la identidad.
   * Si supera AUTH_LOCKOUT_MAX_ATTEMPTS, activa el lockout progresivo.
   */
  async recordFailure(email: string, context?: { ip?: string; userAgent?: string }): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const failsKey = keys.lockoutFails(normalizedEmail);
    const levelKey = keys.lockoutLevel(normalizedEmail);

    // Incrementar contador de fallos (sin TTL fijo — lo maneja el lockout)
    const fails = await this.redis.incr(failsKey);

    if (fails >= env.AUTH_LOCKOUT_MAX_ATTEMPTS) {
      // Determinar nivel de lockout actual
      const levelStr = await this.redis.get(levelKey);
      const currentLevel = levelStr ? parseInt(levelStr, 10) : 0;
      const duration = this.durations[Math.min(currentLevel, this.durations.length - 1)] ?? 60;

      // Activar lockout
      await this.redis.set(keys.lockoutActive(normalizedEmail), '1', duration);

      // Incrementar nivel para el próximo lockout
      await this.redis.set(levelKey, String(currentLevel + 1));

      // Resetear contador de fallos con TTL igual a la duración del lockout
      await this.redis.set(failsKey, '0', duration);

      logSecurityEvent({
        type: 'ACCOUNT_LOCKED',
        email: normalizedEmail,
        ip: context?.ip,
        userAgent: context?.userAgent,
        detail: `cuenta bloqueada tras ${fails} intentos fallidos`,
        metadata: { lockoutLevel: currentLevel, durationSeconds: duration },
      });

      console.warn(
        `[LockoutService] Cuenta bloqueada: ${normalizedEmail} | nivel: ${currentLevel} | duración: ${duration}s`,
      );
    }
  }

  /**
   * Limpia todos los contadores de lockout para la identidad.
   * Llamar al login exitoso.
   */
  async clearFailures(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    await this.redis.del(
      keys.lockoutFails(normalizedEmail),
      keys.lockoutActive(normalizedEmail),
      keys.lockoutLevel(normalizedEmail),
    );
  }
}
