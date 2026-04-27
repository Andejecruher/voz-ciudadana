import { Router } from 'express';
import { TagsController } from '../controllers/tags.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { paginate } from '../middlewares/pagination';
import { requireRole } from '../middlewares/rbac';
import type { AuditService } from '../services/audit.service';
import type { TagsService } from '../services/tags.service';

const READ_ROLES = ['SUPERADMIN', 'COORDINADOR'] as const;

export function createTagsRouter(tagsService: TagsService, audit: AuditService): Router {
  const router = Router();
  const ctrl = new TagsController(tagsService, audit);

  router.use(authMiddleware);

  /* eslint-disable @typescript-eslint/no-misused-promises */

  router.get('/tags', requireRole([...READ_ROLES]), paginate(), ctrl.list);

  router.post('/tags', requireRole(['SUPERADMIN']), ctrl.create);
  router.patch('/tags/:id', requireRole(['SUPERADMIN']), ctrl.update);
  router.delete('/tags/:id', requireRole(['SUPERADMIN']), ctrl.remove);

  /* eslint-enable @typescript-eslint/no-misused-promises */

  return router;
}
