import { Router } from 'express';
import { NeighborhoodsController } from '../controllers/neighborhoods.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { paginate } from '../middlewares/pagination';
import { requireRole } from '../middlewares/rbac';
import type { AuditService } from '../services/audit.service';
import type { NeighborhoodsService } from '../services/neighborhoods.service';

const READ_ROLES = ['SUPERADMIN', 'COORDINADOR'] as const;

export function createNeighborhoodsRouter(
  neighborhoodsService: NeighborhoodsService,
  audit: AuditService,
): Router {
  const router = Router();
  const ctrl = new NeighborhoodsController(neighborhoodsService, audit);

  router.use(authMiddleware);

  /* eslint-disable @typescript-eslint/no-misused-promises */

  router.get('/neighborhoods', requireRole([...READ_ROLES]), paginate(), ctrl.list);

  router.post('/neighborhoods', requireRole(['SUPERADMIN']), ctrl.create);
  router.patch('/neighborhoods/:id', requireRole(['SUPERADMIN']), ctrl.update);
  router.delete('/neighborhoods/:id', requireRole(['SUPERADMIN']), ctrl.remove);

  /* eslint-enable @typescript-eslint/no-misused-promises */

  return router;
}
