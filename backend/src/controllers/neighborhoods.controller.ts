import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuditService } from '../services/audit.service';
import {
    CreateNeighborhoodSchema,
    NeighborhoodIdParamSchema,
    NeighborhoodListFiltersSchema,
    type NeighborhoodsService,
    UpdateNeighborhoodSchema,
} from '../services/neighborhoods.service';

export class NeighborhoodsController {
  constructor(
    private readonly neighborhoodsService: NeighborhoodsService,
    private readonly audit: AuditService,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = NeighborhoodListFiltersSchema.parse(req.query);
      const result = await this.neighborhoodsService.list({
        cursor: req.pagination.cursor,
        limit: req.pagination.limit,
        filters,
      });

      res.json({ neighborhoods: result.items, meta: result.meta });
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
      const data = CreateNeighborhoodSchema.parse(req.body);
      const neighborhood = await this.neighborhoodsService.create(data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'neighborhood.create',
        targetType: 'Neighborhood',
        targetId: neighborhood.id,
        metadata: {
          name: neighborhood.name,
          zone: neighborhood.zone,
        },
      });

      res.status(201).json({ neighborhood });
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
      const { id } = NeighborhoodIdParamSchema.parse(req.params);
      const data = UpdateNeighborhoodSchema.parse(req.body);
      const neighborhood = await this.neighborhoodsService.update(id, data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'neighborhood.update',
        targetType: 'Neighborhood',
        targetId: id,
        metadata: {
          name: data.name,
          description: data.description,
          zone: data.zone,
        },
      });

      res.json({ neighborhood });
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
      const { id } = NeighborhoodIdParamSchema.parse(req.params);
      const neighborhood = await this.neighborhoodsService.deleteNeighborhood(id);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'neighborhood.delete',
        targetType: 'Neighborhood',
        targetId: id,
        metadata: { name: neighborhood.name },
      });

      res.json({
        message: 'Barrio eliminado correctamente',
        neighborhood,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };
}
