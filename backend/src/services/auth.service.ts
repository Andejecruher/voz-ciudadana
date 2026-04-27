/**
 * Servicio de autenticación y gestión de sesiones admin.
 *
 * Estrategia de refresh token multi-sesión por dispositivo:
 * - Cada sesión se identifica por {userId}:{deviceId}:{jti}.
 * - `deviceId` proviene del header `x-device-id` o del body, o se genera un fallback
 *   estable por request (documentado en AuthController).
 * - Se almacena SHA-256(refreshToken) en Redis: `auth:session:{userId}:{deviceId}:{jti}`
 *   con TTL = refresh expiry.
 * - El set `auth:sessions:{userId}` lleva el catálogo de claves de sesión activas.
 * - Al superar AUTH_MAX_SESSIONS_PER_USER se invalida la sesión más antigua (FIFO).
 * - Al rotar, se elimina la clave anterior y se escribe la nueva (single-use).
 * - Logout individual invalida solo la sesión identificada por jti+deviceId.
 * - logoutAll invalida todas las sesiones del usuario.
 */
import { z } from 'zod';
import { env } from '../config/env.config';
import type { AuthenticatedUser, PanelRole } from '../types/auth.types';
import { AppError } from '../utils/app-error';
import { comparePassword, hashPassword } from '../utils/password.util';
import { logSecurityEvent } from '../utils/security-logger';
import {
  hashToken,
  parseExpiresInSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/token.util';
import type { LockoutService } from './lockout.service';
import type { PrismaService } from './prisma.service';
import type { RedisService } from './redis.service';

// ── Esquemas de validación ────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().trim().optional(),
});

export const RegisterAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().trim().min(2),
  roles: z.array(z.string()).min(1),
});

// ── Tipos de respuesta ────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends AuthTokens {
  user: AuthenticatedUser;
}

// ── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Clave Redis para el hash del refresh token de una sesión específica.
 * Formato: `auth:session:{userId}:{deviceId}:{jti}`
 */
const sessionKey = (userId: string, deviceId: string, jti: string): string =>
  `auth:session:${userId}:${deviceId}:${jti}`;

/**
 * Clave del Set Redis que cataloga las sesiones activas de un usuario.
 * Formato: `auth:sessions:{userId}`
 */
const sessionsSetKey = (userId: string): string => `auth:sessions:${userId}`;

/** Normaliza roles del usuario a PanelRole[] */
function extractRoles(userRoles: Array<{ role: { name: string } }>): PanelRole[] {
  return userRoles.map((ur) => ur.role.name as PanelRole);
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly lockout: LockoutService,
  ) {}

  /**
   * Login de usuario admin.
   * Valida credenciales, usuario activo, aplica rate-limit/lockout y emite tokens.
   *
   * @param email    Email del usuario
   * @param password Contraseña en texto plano
   * @param deviceId Identificador de dispositivo. Si no se provee, se genera un UUID
   *                 random (sesión anónima que no persiste entre requests).
   *                 Para multi-sesión real el cliente DEBE enviar x-device-id o deviceId.
   */
  async login(email: string, password: string, deviceId: string): Promise<LoginResult> {
    const normalizedEmail = email.toLowerCase().trim();

    // Lockout check (antes de consultar DB — evita timing attacks de enumeración)
    await this.lockout.checkLockout(normalizedEmail);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      await this.lockout.recordFailure(normalizedEmail);
      throw AppError.unauthorized('Credenciales inválidas');
    }

    if (!user.isActive) {
      // No registrar como fallo — usuario deshabilitado no es un intento de adivinar contraseña
      throw AppError.unauthorized('Usuario inactivo');
    }

    const passwordValid = await comparePassword(password, user.hashedPassword);
    if (!passwordValid) {
      await this.lockout.recordFailure(normalizedEmail);
      throw AppError.unauthorized('Credenciales inválidas');
    }

    // Login exitoso — limpiar contadores
    await this.lockout.clearFailures(normalizedEmail);

    const roles = extractRoles(user.userRoles);
    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName ?? null,
      roles,
    };

    const tokens = await this._issueTokens(authUser, deviceId);

    return { ...tokens, user: authUser };
  }

  /**
   * Renovación de access token mediante refresh token.
   * Rotación: invalida el anterior, emite uno nuevo.
   *
   * @param refreshToken Token de refresco
   * @param deviceId     ID del dispositivo (fallback si no está en payload)
   * @param context      Contexto del request para logs de seguridad
   */
  async refresh(
    refreshToken: string,
    deviceId: string,
    context?: { ip?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    // 1. Verificar firma y expiración
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw AppError.unauthorized('Refresh token inválido o expirado');
    }

    if (payload.type !== 'refresh') {
      throw AppError.unauthorized('Token inválido');
    }

    const userId = payload.sub ?? '';
    const jti = payload.jti ?? '';
    // El deviceId del payload tiene prioridad — si se proveyó en el request se usa como fallback
    const tokenDeviceId = payload.deviceId ?? deviceId;

    // 2. Validar hash en Redis
    const key = sessionKey(userId, tokenDeviceId, jti);
    const storedHash = await this.redis.get(key);

    if (!storedHash) {
      logSecurityEvent({
        type: 'SESSION_EXPIRED',
        userId,
        deviceId: tokenDeviceId,
        ip: context?.ip,
        userAgent: context?.userAgent,
        detail: 'refresh token no encontrado en Redis — sesión expirada o ya invalidada',
      });
      throw AppError.unauthorized('Sesión expirada, iniciá sesión nuevamente');
    }

    const incomingHash = hashToken(refreshToken);
    if (storedHash !== incomingHash) {
      // Posible replay attack — invalidar TODA la sesión de este dispositivo
      await this.redis.del(key);
      await this.redis.srem(sessionsSetKey(userId), key);
      logSecurityEvent({
        type: 'REFRESH_REPLAY_DETECTED',
        userId,
        deviceId: tokenDeviceId,
        ip: context?.ip,
        userAgent: context?.userAgent,
        detail: 'hash de refresh token no coincide — posible replay attack',
        metadata: { jti },
      });
      throw AppError.unauthorized('Refresh token ya utilizado');
    }

    // 3. Detectar mismatch de deviceId (si el request tiene device-id header diferente al payload)
    if (deviceId !== 'unknown' && payload.deviceId && deviceId !== payload.deviceId) {
      logSecurityEvent({
        type: 'DEVICE_MISMATCH',
        userId,
        deviceId: tokenDeviceId,
        ip: context?.ip,
        userAgent: context?.userAgent,
        detail: 'deviceId del request no coincide con el del token',
        metadata: { tokenDeviceId: payload.deviceId, requestDeviceId: deviceId },
      });
      // No bloquear — continuar con el deviceId del token (más confiable)
      // pero registrar la anomalía para análisis
    }

    // 4. Obtener usuario actualizado
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      await this.redis.del(key);
      await this.redis.srem(sessionsSetKey(userId), key);
      throw AppError.unauthorized('Usuario no disponible');
    }

    // 5. Rotar tokens — invalidar sesión anterior, emitir nueva
    await this.redis.del(key);
    await this.redis.srem(sessionsSetKey(userId), key);

    const roles = extractRoles(user.userRoles);
    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName ?? null,
      roles,
    };

    return this._issueTokens(authUser, tokenDeviceId);
  }

  /**
   * Devuelve el perfil del usuario autenticado.
   */
  async me(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      throw AppError.unauthorized('Usuario no disponible');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName ?? null,
      roles: extractRoles(user.userRoles),
    };
  }

  /**
   * Logout de la sesión actual (por jti + deviceId del payload).
   * Si el refreshToken no se provee, no hace nada (sesión ya inválida).
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      // Token inválido/expirado → no hay sesión que invalidar
      return;
    }

    const jti = payload.jti ?? '';
    const deviceId = payload.deviceId ?? 'unknown';
    const key = sessionKey(userId, deviceId, jti);

    await this.redis.del(key);
    await this.redis.srem(sessionsSetKey(userId), key);
  }

  /**
   * Logout global: invalida TODAS las sesiones del usuario (todos los dispositivos).
   */
  async logoutAll(userId: string): Promise<void> {
    const setKey = sessionsSetKey(userId);
    const sessionKeys = await this.redis.smembers(setKey);

    if (sessionKeys.length > 0) {
      await this.redis.del(...sessionKeys);
    }
    await this.redis.del(setKey);
  }

  /**
   * Registra un nuevo usuario admin.
   * SOLO puede ser llamado por un SUPERADMIN (validación defensiva adicional aquí).
   */
  async registerAdmin(
    data: z.infer<typeof RegisterAdminSchema>,
    requestingUserRoles: PanelRole[],
  ): Promise<AuthenticatedUser> {
    const normalizedEmail = data.email.toLowerCase().trim();

    // Check defensivo — la capa de middleware ya debería haber bloqueado
    if (!requestingUserRoles.includes('SUPERADMIN')) {
      throw AppError.forbidden('Solo SUPERADMIN puede registrar administradores');
    }

    // Verificar que no exista
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw AppError.conflict(`El email ${normalizedEmail} ya está registrado`);
    }

    // Verificar que los roles sean válidos
    const roles = await this.prisma.role.findMany({
      where: { name: { in: data.roles } },
    });
    if (roles.length !== data.roles.length) {
      throw AppError.badRequest('Uno o más roles no existen');
    }

    const hashedPassword = await hashPassword(data.password);

    const newUser = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        hashedPassword,
        fullName: data.fullName,
        isActive: true,
        userRoles: {
          create: roles.map((r) => ({ roleId: r.id })),
        },
      },
      include: { userRoles: { include: { role: true } } },
    });

    return {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName ?? null,
      roles: extractRoles(newUser.userRoles),
    };
  }

  // ── Privados ────────────────────────────────────────────────────────────────

  /**
   * Emite un nuevo par de tokens y persiste la sesión en Redis.
   * Si se supera AUTH_MAX_SESSIONS_PER_USER, invalida la sesión más antigua.
   */
  private async _issueTokens(user: AuthenticatedUser, deviceId: string): Promise<AuthTokens> {
    const { token: refreshToken, jti } = signRefreshToken(user.id, deviceId);
    const accessToken = signAccessToken(user);

    const ttl = parseExpiresInSeconds(env.JWT_REFRESH_EXPIRES_IN);
    const key = sessionKey(user.id, deviceId, jti);

    // Persistir hash del refresh token
    await this.redis.set(key, hashToken(refreshToken), ttl);

    // Gestión del catálogo de sesiones
    const setKey = sessionsSetKey(user.id);
    const existing = await this.redis.smembers(setKey);

    // Evicción de sesión más antigua si se supera el límite
    if (existing.length >= env.AUTH_MAX_SESSIONS_PER_USER) {
      const oldest = existing[0];
      if (oldest) {
        await this.redis.del(oldest);
        await this.redis.srem(setKey, oldest);
      }
    }

    await this.redis.sadd(setKey, key, ttl);

    return { accessToken, refreshToken };
  }
}
