import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  EventIdParamSchema as AttendanceEventIdSchema,
  CheckInBodySchema,
  RegisterBodySchema,
  RegistrationListFiltersSchema,
  RegistrationParamSchema,
  type AttendanceService,
} from '../services/attendance.service';
import type { AuditService } from '../services/audit.service';
import {
  CreateEventSchema,
  EventIdParamSchema,
  EventListFiltersSchema,
  InviteBodySchema,
  UpdateEventSchema,
  type EventService,
} from '../services/event.service';

export class EventsController {
  constructor(
    private readonly eventService: EventService,
    private readonly attendanceService: AttendanceService,
    private readonly audit: AuditService,
  ) {}

  // ── Eventos CRUD ─────────────────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = EventListFiltersSchema.parse(req.query);
      const result = await this.eventService.list({
        cursor: req.pagination.cursor,
        limit: req.pagination.limit,
        filters,
      });
      res.json({ events: result.items, meta: result.meta });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = CreateEventSchema.parse(req.body);
      const event = await this.eventService.create(data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'event.create',
        targetType: 'Event',
        targetId: event.id,
        metadata: { title: event.title, slug: event.slug },
      });

      res.status(201).json({ event });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = EventIdParamSchema.parse(req.params);
      const event = await this.eventService.getById(id);
      res.json({ event });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = EventIdParamSchema.parse(req.params);
      const data = UpdateEventSchema.parse(req.body);
      const event = await this.eventService.update(id, data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'event.update',
        targetType: 'Event',
        targetId: event.id,
        metadata: { title: event.title },
      });

      res.json({ event });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  // ── Invitaciones ─────────────────────────────────────────────────────────────

  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = EventIdParamSchema.parse(req.params);
      const body = InviteBodySchema.parse(req.body);
      const result = await this.eventService.invite(id, body);
      res.json({ result });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  // ── Registros / Asistencia ───────────────────────────────────────────────────

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = AttendanceEventIdSchema.parse(req.params);
      const body = RegisterBodySchema.parse(req.body);
      const registration = await this.attendanceService.register(id, body);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'citizen.register_event',
        targetType: 'EventRegistration',
        targetId: registration.id,
        metadata: { eventId: id, citizenId: body.citizenId },
      });

      res.status(201).json({ registration });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  confirm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, registrationId } = RegistrationParamSchema.parse(req.params);
      const registration = await this.attendanceService.confirm(id, registrationId);
      res.json({ registration });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  checkIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, registrationId } = RegistrationParamSchema.parse(req.params);
      const body = CheckInBodySchema.parse(req.body);
      const registration = await this.attendanceService.checkIn(
        id,
        registrationId,
        body,
        req.user?.id,
      );

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'citizen.checkin_event',
        targetType: 'EventRegistration',
        targetId: registrationId,
        metadata: { eventId: id, citizenId: registration.citizenId },
      });

      res.json({ registration });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  listRegistrations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = AttendanceEventIdSchema.parse(req.params);
      const filters = RegistrationListFiltersSchema.parse(req.query);
      const result = await this.attendanceService.listRegistrations({
        eventId: id,
        cursor: req.pagination.cursor,
        limit: req.pagination.limit,
        filters,
      });
      res.json({ registrations: result.items, meta: result.meta });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  listAttendees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = AttendanceEventIdSchema.parse(req.params);
      const result = await this.attendanceService.listAttendees({
        eventId: id,
        cursor: req.pagination.cursor,
        limit: req.pagination.limit,
      });
      res.json({ attendees: result.items, meta: result.meta });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };
}
