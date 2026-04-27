import { Router } from 'express';

import { SystemController } from '../controllers/system.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { paginate } from '../middlewares/pagination';
import { requireRole } from '../middlewares/rbac';
import type { SystemService } from '../services/system.service';

export function createSystemRouter(systemService: SystemService): Router {
  const router = Router();
  const ctrl = new SystemController(systemService);

  router.use(authMiddleware);

  /* eslint-disable @typescript-eslint/no-misused-promises */

  // ── Lectura operativa ──────────────────────────────────────────────────────

  router.get('/audit-logs', requireRole(['SUPERADMIN']), paginate(), ctrl.listAuditLogs);
  router.get('/inbox-events', requireRole(['SUPERADMIN']), paginate(), ctrl.listInboxEvents);
  router.get('/outbox-events', requireRole(['SUPERADMIN']), paginate(), ctrl.listOutboxEvents);

  // ── Acciones de control ────────────────────────────────────────────────────

  router.post('/outbox-events/:id/retry', requireRole(['SUPERADMIN']), ctrl.retryOutboxEvent);
  router.post('/inbox-events/:id/reprocess', requireRole(['SUPERADMIN']), ctrl.reprocessInboxEvent);

  /* eslint-enable @typescript-eslint/no-misused-promises */

  return router;
}
