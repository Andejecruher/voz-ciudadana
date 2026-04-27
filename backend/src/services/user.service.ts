import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../utils/app-error';
import { hashPassword } from '../utils/password.util';
import type { PrismaService } from './prisma.service';

const userWithRolesSelect = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  createdAt: true,
  userRoles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

type UserWithRoles = Prisma.UserGetPayload<{ select: typeof userWithRolesSelect }>;

export const CreateUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  fullName: z.string().trim().min(2),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

export const UpdateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).optional(),
    password: z.string().min(8).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.fullName !== undefined || data.password !== undefined || data.isActive !== undefined,
    {
      message: 'Al menos un campo debe ser enviado',
    },
  );

export const UserIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const UserRoleParamSchema = z.object({
  id: z.string().uuid(),
  roleId: z.string().uuid(),
});

export type UserResponse = {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  createdAt: Date;
  roles: Array<{ id: string; name: string }>;
};

type CreateUserInput = z.infer<typeof CreateUserSchema>;
type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(input: CreateUserInput): Promise<UserResponse> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw AppError.conflict(`El email ${normalizedEmail} ya está registrado`);
    }

    const roleIds = input.roleIds ?? [];
    if (roleIds.length > 0) {
      const rolesCount = await this.prisma.role.count({ where: { id: { in: roleIds } } });
      if (rolesCount !== new Set(roleIds).size) {
        throw AppError.badRequest('Uno o más roleIds no existen');
      }
    }

    const hashedPassword = await hashPassword(input.password);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          hashedPassword,
          fullName: input.fullName,
          isActive: input.isActive ?? true,
        },
        select: { id: true },
      });

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId: user.id, roleId })),
          skipDuplicates: true,
        });
      }

      return tx.user.findUnique({
        where: { id: user.id },
        select: userWithRolesSelect,
      });
    });

    if (!created) {
      throw AppError.notFound('No se pudo crear el usuario');
    }

    return this.toResponse(created);
  }

  async listUsers(): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      select: userWithRolesSelect,
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.toResponse(user));
  }

  async getUserById(id: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userWithRolesSelect,
    });

    if (!user) {
      throw AppError.notFound('Usuario no encontrado');
    }

    return this.toResponse(user);
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<UserResponse> {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw AppError.notFound('Usuario no encontrado');
    }

    const hashedPassword = input.password ? await hashPassword(input.password) : undefined;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(hashedPassword !== undefined ? { hashedPassword } : {}),
      },
      select: userWithRolesSelect,
    });

    return this.toResponse(updated);
  }

  async assignRole(userId: string, roleId: string): Promise<UserResponse> {
    await this.ensureUserExists(userId);
    await this.ensureRoleExists(roleId);

    try {
      await this.prisma.userRole.create({
        data: {
          userId,
          roleId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.conflict('El rol ya está asignado al usuario');
      }
      throw error;
    }

    return this.getUserById(userId);
  }

  async removeRole(userId: string, roleId: string): Promise<UserResponse> {
    await this.ensureUserExists(userId);

    const existingAssignment = await this.prisma.userRole.findFirst({
      where: { userId, roleId },
      select: { id: true },
    });

    if (!existingAssignment) {
      throw AppError.notFound('El rol no está asignado al usuario');
    }

    await this.prisma.userRole.delete({ where: { id: existingAssignment.id } });

    return this.getUserById(userId);
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw AppError.notFound('Usuario no encontrado');
    }
  }

  private async ensureRoleExists(roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
    if (!role) {
      throw AppError.notFound('Rol no encontrado');
    }
  }

  private toResponse(user: UserWithRoles): UserResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roles: user.userRoles.map((userRole) => ({
        id: userRole.role.id,
        name: userRole.role.name,
      })),
    };
  }
}
