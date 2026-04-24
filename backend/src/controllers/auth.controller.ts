/**
 * Controlador de autenticación.
 * Rutas: POST /auth/login, POST /auth/refresh, GET /auth/me, POST /auth/logout
 *
 * Device binding:
 *   El `deviceId` se resuelve en el middleware `loginRateLimitMiddleware`
 *   (inyectado como `req.resolvedDeviceId`) para /login.
 *   Para /refresh y /logout se extrae del header `x-device-id` o body.
 */
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuditService } from '../services/audit.service';
import { extractIp, extractUserAgent } from '../services/audit.service';
import { LoginSchema, RegisterAdminSchema, type AuthService } from '../services/auth.service';
import { AppError } from '../utils/app-error';

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly audit: AuditService,
  ) {}

  /**
   * POST /auth/login
   * Body: { email: string, password: string, deviceId?: string }
   * Header opcional: x-device-id
   *
   * El deviceId final lo determina el middleware loginRateLimitMiddleware
   * y se expone en req.resolvedDeviceId.
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = LoginSchema.parse(req.body);

      // deviceId resuelto por el middleware (x-device-id > body.deviceId > UUID random)
      const deviceId = req.resolvedDeviceId ?? crypto.randomUUID();

      const result = await this.authService.login(email, password, deviceId);

      await this.audit.logFromRequest(req, {
        actorId: result.user.id,
        action: 'auth.login',
        targetType: 'User',
        targetId: result.user.id,
        metadata: { deviceId },
      });

      res.json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /auth/refresh
   * Body: { refreshToken: string, deviceId?: string }
   * Header opcional: x-device-id
   */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken, deviceId: bodyDeviceId } = req.body as {
        refreshToken?: string;
        deviceId?: string;
      };

      if (!refreshToken || typeof refreshToken !== 'string') {
        throw AppError.badRequest('refreshToken es requerido');
      }

      // deviceId para validar la sesión — el payload del token tiene prioridad
      const deviceIdHeader = req.headers['x-device-id'];
      const deviceId =
        (typeof deviceIdHeader === 'string' ? deviceIdHeader.trim() : undefined) ??
        (typeof bodyDeviceId === 'string' ? bodyDeviceId.trim() : undefined) ??
        'unknown';

      const tokens = await this.authService.refresh(refreshToken, deviceId, {
        ip: extractIp(req) ?? undefined,
        userAgent: extractUserAgent(req) ?? undefined,
      });
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /auth/me
   * Requiere: authMiddleware
   */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const user = await this.authService.me(req.user.id);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /auth/logout
   * Body opcional: { refreshToken?: string, logoutAll?: boolean }
   * Requiere: authMiddleware
   *
   * - Sin `logoutAll`: invalida solo la sesión actual (identificada por el refreshToken).
   * - Con `logoutAll: true`: invalida TODAS las sesiones del usuario.
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const { refreshToken, logoutAll } = req.body as {
        refreshToken?: string;
        logoutAll?: boolean;
      };

      if (logoutAll) {
        await this.authService.logoutAll(req.user.id);
        await this.audit.logFromRequest(req, {
          actorId: req.user.id,
          action: 'auth.logout_all',
          targetType: 'User',
          targetId: req.user.id,
        });
        res.json({ message: 'Todas las sesiones cerradas correctamente' });
        return;
      }

      await this.authService.logout(req.user.id, refreshToken);
      await this.audit.logFromRequest(req, {
        actorId: req.user.id,
        action: 'auth.logout',
        targetType: 'User',
        targetId: req.user.id,
      });
      res.json({ message: 'Sesión cerrada correctamente' });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /auth/register (solo SUPERADMIN)
   * Requiere: authMiddleware + checkRole(['SUPERADMIN'])
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const data = RegisterAdminSchema.parse(req.body);
      const newUser = await this.authService.registerAdmin(data, req.user.roles);

      await this.audit.logFromRequest(req, {
        actorId: req.user.id,
        action: 'user.create',
        targetType: 'User',
        targetId: newUser.id,
        metadata: { roles: data.roles },
      });

      res.status(201).json({ user: newUser });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };
}
