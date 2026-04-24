/**
 * Rutas de administración de usuarios del panel.
 * Base: /api/v1/admin/users
 * Acceso restringido: SUPERADMIN en todos los endpoints.
 */
import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkRole } from '../middlewares/role.middleware';
import type { PrismaService } from '../services/prisma.service';
import type { AuditService } from '../services/audit.service';

export function createAdminRouter(prisma: PrismaService, audit: AuditService): Router {
  const router = Router();
  const ctrl = new UserController(prisma, audit);

  // Todas las rutas de admin requieren auth + rol SUPERADMIN
  router.use(authMiddleware, checkRole(['SUPERADMIN']));

  /* eslint-disable @typescript-eslint/no-misused-promises */

  /** GET /admin/users — lista usuarios */
  router.get('/users', ctrl.list);

  /** POST /admin/users — crea usuario */
  router.post('/users', ctrl.create);

  /** PATCH /admin/users/:id — actualiza usuario */
  router.patch('/users/:id', ctrl.update);

  /** DELETE /admin/users/:id — desactiva usuario (soft delete) */
  router.delete('/users/:id', ctrl.deactivate);

  /* eslint-enable @typescript-eslint/no-misused-promises */

  /**
   * GET /admin/config — ruta ejemplo de configuración solo SUPERADMIN
   * Reemplazar con lógica real de configuración del sistema.
   */
  router.get('/config', (_req, res) => {
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

  return router;
}
