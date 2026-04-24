/**
 * Controlador de gestión de usuarios admin.
 * Solo accesible para SUPERADMIN.
 * Registra auditoría en todas las operaciones de mutación.
 */
import { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '../utils/app-error';
import { hashPassword } from '../utils/password.util';
import type { PrismaService } from '../services/prisma.service';
import type { AuditService } from '../services/audit.service';
import type { PanelRole } from '../types/auth.types';

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().trim().min(2),
  roles: z.array(z.string()).min(1),
});

const UpdateUserSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  roles: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
});

// ── Controlador ───────────────────────────────────────────────────────────────

export class UserController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * GET /admin/users
   * Lista todos los usuarios admin con sus roles.
   */
  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          fullName: true,
          isActive: true,
          createdAt: true,
          userRoles: {
            select: {
              role: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const result = users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        isActive: u.isActive,
        createdAt: u.createdAt,
        roles: u.userRoles.map((ur) => ur.role.name as PanelRole),
      }));

      res.json({ users: result });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /admin/users
   * Crea un nuevo usuario admin.
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = CreateUserSchema.parse(req.body);

      // Verificar duplicado
      const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        throw AppError.conflict(`El email ${data.email} ya está registrado`);
      }

      // Verificar roles
      const roles = await this.prisma.role.findMany({ where: { name: { in: data.roles } } });
      if (roles.length !== data.roles.length) {
        throw AppError.badRequest('Uno o más roles no existen');
      }

      const hashedPassword = await hashPassword(data.password);

      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          hashedPassword,
          fullName: data.fullName,
          isActive: true,
          userRoles: {
            create: roles.map((r) => ({ roleId: r.id })),
          },
        },
        include: { userRoles: { include: { role: true } } },
      });

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'user.create',
        targetType: 'User',
        targetId: user.id,
        metadata: { email: data.email, roles: data.roles },
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isActive: user.isActive,
          roles: user.userRoles.map((ur) => ur.role.name),
        },
      });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  /**
   * PATCH /admin/users/:id
   * Actualiza fullName, roles o isActive de un usuario.
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = UpdateUserSchema.parse(req.body);

      const existing = await this.prisma.user.findUnique({ where: { id } });
      if (!existing) {
        throw AppError.notFound('Usuario no encontrado');
      }

      // Actualizar campos básicos
      await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.fullName !== undefined && { fullName: data.fullName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      // Actualizar roles si se proporcionaron
      let updatedRoles: string[] | undefined;
      if (data.roles !== undefined) {
        const roles = await this.prisma.role.findMany({ where: { name: { in: data.roles } } });
        if (roles.length !== data.roles.length) {
          throw AppError.badRequest('Uno o más roles no existen');
        }

        // Reemplazar roles: borrar existentes y crear nuevos
        await this.prisma.userRole.deleteMany({ where: { userId: id } });
        await this.prisma.userRole.createMany({
          data: roles.map((r) => ({ userId: id, roleId: r.id })),
        });
        updatedRoles = roles.map((r) => r.name);
      }

      const updated = await this.prisma.user.findUnique({
        where: { id },
        include: { userRoles: { include: { role: true } } },
      });

      // Auditoría de update — incluir qué cambió
      const auditMeta: Record<string, unknown> = {};
      if (data.fullName !== undefined) auditMeta.fullName = data.fullName;
      if (data.isActive !== undefined) auditMeta.isActive = data.isActive;
      if (updatedRoles !== undefined) auditMeta.roles = updatedRoles;

      const action = data.roles !== undefined ? 'role.assign' : 'user.update';
      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action,
        targetType: 'User',
        targetId: id,
        metadata: auditMeta,
      });

      res.json({
        user: {
          id: updated!.id,
          email: updated!.email,
          fullName: updated!.fullName,
          isActive: updated!.isActive,
          roles: updated!.userRoles.map((ur) => ur.role.name),
        },
      });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues });
        return;
      }
      next(err);
    }
  };

  /**
   * DELETE /admin/users/:id  (deactivate, no hard delete)
   */
  deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      // No permitir auto-desactivación
      if (req.user?.id === id) {
        throw AppError.badRequest('No podés desactivarte a vos mismo');
      }

      const existing = await this.prisma.user.findUnique({ where: { id } });
      if (!existing) {
        throw AppError.notFound('Usuario no encontrado');
      }

      await this.prisma.user.update({ where: { id }, data: { isActive: false } });

      await this.audit.logFromRequest(req, {
        actorId: req.user?.id,
        action: 'user.deactivate',
        targetType: 'User',
        targetId: id,
        metadata: { email: existing.email },
      });

      res.json({ message: 'Usuario desactivado correctamente' });
    } catch (err) {
      next(err);
    }
  };
}
