/**
 * Rutas de administración de usuarios del panel.
 * Base: /api/v1/admin/users
 */
import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac';
import type { AuditService } from '../services/audit.service';
import type { UserService } from '../services/user.service';

const READ_ROLES = ['SUPERADMIN', 'COORDINADOR'] as const;

export function createUsersRouter(userService: UserService, audit: AuditService): Router {
  const router = Router();
  const ctrl = new UsersController(userService, audit);

  router.use(authMiddleware);

  /* eslint-disable @typescript-eslint/no-misused-promises */

  router.get('/users', requireRole([...READ_ROLES]), ctrl.list);
  router.get('/users/:id', requireRole([...READ_ROLES]), ctrl.getById);

  router.post('/users', requireRole(['SUPERADMIN']), ctrl.create);
  router.patch('/users/:id', requireRole(['SUPERADMIN']), ctrl.update);

  router.post('/users/:id/roles/:roleId', requireRole(['SUPERADMIN']), ctrl.assignRole);
  router.delete('/users/:id/roles/:roleId', requireRole(['SUPERADMIN']), ctrl.removeRole);

  router.get('/config', requireRole(['SUPERADMIN']), (_req, res) => {
    res.json({
      message: 'Configuración del sistema (solo SUPERADMIN)',
      features: {
        rbacEnabled: true,
        refreshTokenRotation: true,
        refreshTokenStorage: 'redis',
        multiSession: true,
        auditLog: true,
        rateLimiting: true,
        progressiveLockout: true,
      },
    });
  });

  /* eslint-enable @typescript-eslint/no-misused-promises */

  return router;
}
