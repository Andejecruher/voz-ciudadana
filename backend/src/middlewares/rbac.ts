/**
 * Middleware RBAC (Role-Based Access Control).
 *
 * Re-exporta `checkRole` desde role.middleware.ts y agrega `requireRole`
 * como alias semánticamente más claro para rutas nuevas.
 *
 * Uso:
 *   router.get('/admin/config', authMiddleware, requireRole(['SUPERADMIN']), handler)
 *   router.get('/reportes',     authMiddleware, requireRole(['SUPERADMIN', 'ANALISTA']), handler)
 *
 * El middleware requiere que `authMiddleware` haya corrido antes (req.user poblado).
 * Responde con AppError para que el errorHandler global lo serialice.
 */
import { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PanelRole } from '../types/auth.types';
import { ForbiddenError, UnauthorizedError } from '../utils/app-error';

// Re-exportar checkRole para retrocompatibilidad
export { checkRole } from './role.middleware';

/**
 * Factory que devuelve un middleware que exige al menos uno de los roles indicados.
 * Lanza AppError (en lugar de escribir directo al Response) para que el
 * errorHandler global produzca la respuesta { success: false, ... } uniforme.
 *
 * @param allowedRoles - Uno o más roles que tienen acceso
 */
export function requireRole(allowedRoles: PanelRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const hasAccess = req.user.roles.some((role) => allowedRoles.includes(role));

    if (!hasAccess) {
      next(
        new ForbiddenError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        ),
      );
      return;
    }

    next();
  };
}
