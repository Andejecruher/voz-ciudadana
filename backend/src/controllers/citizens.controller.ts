import type { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import type { AuditService } from '../services/audit.service';
import {
  CitizenIdParamSchema,
  CitizenListFiltersSchema,
  CreateCitizenSchema,
  UpdateCitizenSchema,
  type CitizensService,
} from '../services/citizens.service';

export class CitizensController {
  constructor(
    private readonly citizensService: CitizensService,
    private readonly audit: AuditService,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = CitizenListFiltersSchema.parse(req.query);
      const result = await this.citizensService.list({
        cursor: req.pagination.cursor,
        limit: req.pagination.limit,
        filters,
      });

      res.json({ citizens: result.items, meta: result.meta });
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
      const data = CreateCitizenSchema.parse(req.body);
      const citizen = await this.citizensService.create(data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'citizen.create',
        targetType: 'Citizen',
        targetId: citizen.id,
        metadata: { phone: citizen.phone, name: citizen.name },
      });

      res.status(201).json({ citizen });
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
      const { id } = CitizenIdParamSchema.parse(req.params);
      const citizen = await this.citizensService.getById(id);
      res.json({ citizen });
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
      const { id } = CitizenIdParamSchema.parse(req.params);
      const data = UpdateCitizenSchema.parse(req.body);
      const citizen = await this.citizensService.update(id, data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'citizen.update',
        targetType: 'Citizen',
        targetId: id,
        metadata: data,
      });

      res.json({ citizen });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = CitizenIdParamSchema.parse(req.params);
      const citizen = await this.citizensService.deleteCitizen(id);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'citizen.delete',
        targetType: 'Citizen',
        targetId: id,
        metadata: { phone: citizen.phone },
      });

      res.json({ message: 'Ciudadano eliminado correctamente', citizen });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  assignTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, tagId } = z
        .object({ id: z.string().uuid(), tagId: z.string().uuid() })
        .parse(req.params);
      const created = await this.citizensService.assignTag(id, tagId, req.user?.id);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'citizen.tag.assign',
        targetType: 'Citizen',
        targetId: id,
        metadata: { tagId },
      });

      res.status(201).json({ assigned: created });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  removeTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, tagId } = z
        .object({ id: z.string().uuid(), tagId: z.string().uuid() })
        .parse(req.params);
      const removed = await this.citizensService.removeTag(id, tagId);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'citizen.tag.remove',
        targetType: 'Citizen',
        targetId: id,
        metadata: { tagId },
      });

      res.json({ removed });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  profile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = CitizenIdParamSchema.parse(req.params);
      const profile = await this.citizensService.getProfile(id);
      res.json(profile);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };
}
