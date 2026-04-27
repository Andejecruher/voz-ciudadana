import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuditService } from '../services/audit.service';
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserIdParamSchema,
  UserRoleParamSchema,
  type UserService,
} from '../services/user.service';

export class UsersController {
  constructor(
    private readonly userService: UserService,
    private readonly audit: AuditService,
  ) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.userService.listUsers();
      res.json({ users });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = UserIdParamSchema.parse(req.params);
      const user = await this.userService.getUserById(id);
      res.json({ user });
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
      const data = CreateUserSchema.parse(req.body);
      const user = await this.userService.createUser(data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'user.create',
        targetType: 'User',
        targetId: user.id,
        metadata: {
          email: user.email,
          roleIds: data.roleIds ?? [],
        },
      });

      res.status(201).json({ user });
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
      const { id } = UserIdParamSchema.parse(req.params);
      const data = UpdateUserSchema.parse(req.body);

      const user = await this.userService.updateUser(id, data);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'user.update',
        targetType: 'User',
        targetId: id,
        metadata: {
          fullName: data.fullName,
          isActive: data.isActive,
          passwordChanged: data.password !== undefined,
        },
      });

      res.json({ user });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, roleId } = UserRoleParamSchema.parse(req.params);
      const user = await this.userService.assignRole(id, roleId);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'role.assign',
        targetType: 'User',
        targetId: id,
        metadata: { roleId },
      });

      res.json({ user });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  removeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, roleId } = UserRoleParamSchema.parse(req.params);
      const user = await this.userService.removeRole(id, roleId);

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'role.remove',
        targetType: 'User',
        targetId: id,
        metadata: { roleId },
      });

      res.json({ user });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };
}
