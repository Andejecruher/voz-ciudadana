import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  AuditLogFiltersSchema,
  InboxEventFiltersSchema,
  OutboxEventFiltersSchema,
  SystemEventIdParamSchema,
  type SystemService,
} from '../services/system.service';

export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  listAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = AuditLogFiltersSchema.parse(req.query);
      const result = await this.systemService.listAuditLogs({
        cursor: req.pagination.cursor,
        limit: req.pagination.limit,
        filters,
      });
      res.json({ auditLogs: result.items, meta: result.meta });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  listInboxEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = InboxEventFiltersSchema.parse(req.query);
      const result = await this.systemService.listInboxEvents({
        cursor: req.pagination.cursor,
        limit: req.pagination.limit,
        filters,
      });
      res.json({ inboxEvents: result.items, meta: result.meta });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  listOutboxEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = OutboxEventFiltersSchema.parse(req.query);
      const result = await this.systemService.listOutboxEvents({
        cursor: req.pagination.cursor,
        limit: req.pagination.limit,
        filters,
      });
      res.json({ outboxEvents: result.items, meta: result.meta });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  retryOutboxEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = SystemEventIdParamSchema.parse(req.params);
      const event = await this.systemService.retryOutboxEvent(id);
      res.json({ outboxEvent: event });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  reprocessInboxEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = SystemEventIdParamSchema.parse(req.params);
      const event = await this.systemService.reprocessInboxEvent(id);
      res.json({ inboxEvent: event });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };
}
