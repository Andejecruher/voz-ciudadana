import { Router } from 'express';
import { CitizensController } from '../controllers/citizens.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { paginate } from '../middlewares/pagination';
import { requireRole } from '../middlewares/rbac';
import type { AuditService } from '../services/audit.service';
import type { CitizensService } from '../services/citizens.service';

const READ_ROLES = ['SUPERADMIN', 'COORDINADOR'] as const;

export function createCitizensRouter(citizensService: CitizensService, audit: AuditService) {
  const router = Router();
  const ctrl = new CitizensController(citizensService, audit);

  router.use(authMiddleware);

  /* eslint-disable @typescript-eslint/no-misused-promises */

  router.get('/citizens', requireRole([...READ_ROLES]), paginate(), ctrl.list);

  router.post('/citizens', requireRole(['SUPERADMIN']), ctrl.create);
  router.get('/citizens/:id', requireRole([...READ_ROLES]), ctrl.get);
  router.patch('/citizens/:id', requireRole(['SUPERADMIN']), ctrl.update);
  router.delete('/citizens/:id', requireRole(['SUPERADMIN']), ctrl.remove);

  router.post('/citizens/:id/tags/:tagId', requireRole([...READ_ROLES]), ctrl.assignTag);
  router.delete('/citizens/:id/tags/:tagId', requireRole([...READ_ROLES]), ctrl.removeTag);

  router.get('/citizens/:id/profile', requireRole([...READ_ROLES]), ctrl.profile);

  /* eslint-enable @typescript-eslint/no-misused-promises */

  return router;
}
