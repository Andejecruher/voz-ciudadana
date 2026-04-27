import { Router } from 'express';
import { DepartmentsController } from '../controllers/departments.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { paginate } from '../middlewares/pagination';
import { requireRole } from '../middlewares/rbac';
import type { AuditService } from '../services/audit.service';
import type { DepartmentsService } from '../services/departments.service';

const READ_ROLES = ['SUPERADMIN', 'COORDINADOR'] as const;

export function createDepartmentsRouter(
  departmentsService: DepartmentsService,
  audit: AuditService,
): Router {
  const router = Router();
  const ctrl = new DepartmentsController(departmentsService, audit);

  router.use(authMiddleware);

  /* eslint-disable @typescript-eslint/no-misused-promises */

  router.get('/departments', requireRole([...READ_ROLES]), paginate(), ctrl.list);

  router.post('/departments', requireRole(['SUPERADMIN']), ctrl.create);
  router.patch('/departments/:id', requireRole(['SUPERADMIN']), ctrl.update);
  router.delete('/departments/:id', requireRole(['SUPERADMIN']), ctrl.remove);

  /* eslint-enable @typescript-eslint/no-misused-promises */

  return router;
}
