/**
 * Middleware de autorización RBAC.
 *
 * Uso:
 *   router.get('/admin/config', authMiddleware, checkRole(['SUPERADMIN']), handler)
 *
 * Requiere que authMiddleware haya corrido antes (req.user poblado).
 */
import { NextFunction, Request, Response } from 'express';
import type { PanelRole } from '../types/auth.types';

/**
 * Genera un middleware que verifica que el usuario tenga al menos uno de los roles requeridos.
 *
 * @param allowedRoles - Lista de roles con acceso permitido
 * @returns Middleware Express
 */
export function checkRole(allowedRoles: PanelRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // authMiddleware debería haber bloqueado antes, pero check defensivo
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userRoles = req.user.roles;
    const hasAccess = userRoles.some((role) => allowedRoles.includes(role));

    if (!hasAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Se requiere uno de los roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
