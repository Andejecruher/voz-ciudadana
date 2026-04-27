import { Router } from 'express';

import { EventsController } from '../controllers/events.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { paginate } from '../middlewares/pagination';
import { requireRole } from '../middlewares/rbac';
import type { AttendanceService } from '../services/attendance.service';
import type { AuditService } from '../services/audit.service';
import type { EventService } from '../services/event.service';

const READ_WRITE_ROLES = ['SUPERADMIN', 'COORDINADOR'] as const;

export function createEventsRouter(
  eventService: EventService,
  attendanceService: AttendanceService,
  audit: AuditService,
): Router {
  const router = Router();
  const ctrl = new EventsController(eventService, attendanceService, audit);

  router.use(authMiddleware);

  /* eslint-disable @typescript-eslint/no-misused-promises */

  // ── Eventos CRUD ──────────────────────────────────────────────────────────
  router.get('/events', requireRole([...READ_WRITE_ROLES]), paginate(), ctrl.list);
  router.post('/events', requireRole([...READ_WRITE_ROLES]), ctrl.create);
  router.get('/events/:id', requireRole([...READ_WRITE_ROLES]), ctrl.get);
  router.patch('/events/:id', requireRole([...READ_WRITE_ROLES]), ctrl.update);

  // ── Invitaciones masivas ──────────────────────────────────────────────────
  router.post('/events/:id/invite', requireRole([...READ_WRITE_ROLES]), ctrl.invite);

  // ── Registros ─────────────────────────────────────────────────────────────
  router.post('/events/:id/registrations', requireRole([...READ_WRITE_ROLES]), ctrl.register);
  router.get(
    '/events/:id/registrations',
    requireRole([...READ_WRITE_ROLES]),
    paginate(),
    ctrl.listRegistrations,
  );
  router.patch(
    '/events/:id/registrations/:registrationId/confirm',
    requireRole([...READ_WRITE_ROLES]),
    ctrl.confirm,
  );
  router.post(
    '/events/:id/registrations/:registrationId/checkin',
    requireRole([...READ_WRITE_ROLES]),
    ctrl.checkIn,
  );

  // ── Asistentes ────────────────────────────────────────────────────────────
  router.get(
    '/events/:id/attendees',
    requireRole([...READ_WRITE_ROLES]),
    paginate(),
    ctrl.listAttendees,
  );

  /* eslint-enable @typescript-eslint/no-misused-promises */

  return router;
}
