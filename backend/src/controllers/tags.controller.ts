import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuditService } from '../services/audit.service';
import {
    CreateTagSchema,
    TagIdParamSchema,
    TagListFiltersSchema,
    type TagsService,
    UpdateTagSchema,
} from '../services/tags.service';

export class TagsController {
  constructor(
    private readonly tagsService: TagsService,
    private readonly audit: AuditService,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = TagListFiltersSchema.parse(req.query);
      const result = await this.tagsService.list({
        cursor: req.pagination.cursor,
        limit: req.pagination.limit,
        filters,
      });

      res.json({ tags: result.items, meta: result.meta });
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
      const data = CreateTagSchema.parse(req.body);
      const tag = await this.tagsService.create(data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'tag.create',
        targetType: 'Tag',
        targetId: tag.id,
        metadata: {
          name: tag.name,
          color: tag.color,
        },
      });

      res.status(201).json({ tag });
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
      const { id } = TagIdParamSchema.parse(req.params);
      const data = UpdateTagSchema.parse(req.body);
      const tag = await this.tagsService.update(id, data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'tag.update',
        targetType: 'Tag',
        targetId: id,
        metadata: {
          name: data.name,
          description: data.description,
          color: data.color,
        },
      });

      res.json({ tag });
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
      const { id } = TagIdParamSchema.parse(req.params);
      const tag = await this.tagsService.deleteTag(id);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'tag.delete',
        targetType: 'Tag',
        targetId: id,
        metadata: { name: tag.name },
      });

      res.json({
        message: 'Etiqueta eliminada correctamente',
        tag,
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
