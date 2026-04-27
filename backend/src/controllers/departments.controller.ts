import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuditService } from '../services/audit.service';
import {
    CreateDepartmentSchema,
    DepartmentIdParamSchema,
    DepartmentListFiltersSchema,
    type DepartmentsService,
    UpdateDepartmentSchema,
} from '../services/departments.service';

export class DepartmentsController {
  constructor(
    private readonly departmentsService: DepartmentsService,
    private readonly audit: AuditService,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = DepartmentListFiltersSchema.parse(req.query);
      const result = await this.departmentsService.list({
        cursor: req.pagination.cursor,
        limit: req.pagination.limit,
        filters,
      });

      res.json({ departments: result.items, meta: result.meta });
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
      const data = CreateDepartmentSchema.parse(req.body);
      const department = await this.departmentsService.create(data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'department.create',
        targetType: 'Department',
        targetId: department.id,
        metadata: {
          slug: department.slug,
          name: department.name,
          isActive: department.isActive,
        },
      });

      res.status(201).json({ department });
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
      const { id } = DepartmentIdParamSchema.parse(req.params);
      const data = UpdateDepartmentSchema.parse(req.body);
      const department = await this.departmentsService.update(id, data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'department.update',
        targetType: 'Department',
        targetId: id,
        metadata: {
          slug: data.slug,
          name: data.name,
          description: data.description,
          isActive: data.isActive,
          keywords: data.keywords,
        },
      });

      res.json({ department });
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
      const { id } = DepartmentIdParamSchema.parse(req.params);
      const department = await this.departmentsService.deactivate(id);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'department.deactivate',
        targetType: 'Department',
        targetId: id,
        metadata: {
          slug: department.slug,
          isActive: department.isActive,
        },
      });

      res.json({
        message: 'Departamento desactivado correctamente',
        department,
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
