import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../utils/app-error';
import type { PrismaService } from './prisma.service';

const departmentSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  isActive: true,
  keywords: true,
  createdAt: true,
  updatedAt: true,
} as const;

type DepartmentRecord = Prisma.DepartmentGetPayload<{ select: typeof departmentSelect }>;

const SlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug inválido');

const KeywordSchema = z.string().trim().min(1).max(100);

const BooleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => (typeof value === 'boolean' ? value : value === 'true'));

export const CreateDepartmentSchema = z.object({
  slug: SlugSchema,
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().min(1).max(4000).optional(),
  isActive: z.boolean().optional(),
  keywords: z.array(KeywordSchema).max(50).optional(),
});

export const UpdateDepartmentSchema = z
  .object({
    slug: SlugSchema.optional(),
    name: z.string().trim().min(2).max(255).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    isActive: z.boolean().optional(),
    keywords: z.array(KeywordSchema).max(50).optional(),
  })
  .refine(
    (data) =>
      data.slug !== undefined ||
      data.name !== undefined ||
      data.description !== undefined ||
      data.isActive !== undefined ||
      data.keywords !== undefined,
    { message: 'Al menos un campo debe ser enviado' },
  );

export const DepartmentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const DepartmentListFiltersSchema = z.object({
  search: z.string().trim().min(1).max(255).optional(),
  isActive: BooleanQuerySchema.optional(),
});

type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;
type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;
type DepartmentListFilters = z.infer<typeof DepartmentListFiltersSchema>;

export type DepartmentResponse = {
  id: string;
  slug: string;
  name: string;
  description: string | undefined;
  isActive: boolean;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type DepartmentListResult = {
  items: DepartmentResponse[];
  meta: {
    nextCursor: string | undefined;
    hasNextPage: boolean;
    count: number;
  };
};

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeKeywords(keywords: string[] | undefined): string[] | undefined {
  if (keywords === undefined) {
    return undefined;
  }

  const normalized = keywords
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  return [...new Set(normalized)];
}

export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    cursor: string | undefined;
    limit: number;
    filters: DepartmentListFilters;
  }): Promise<DepartmentListResult> {
    const where: Prisma.DepartmentWhereInput = {};

    if (params.filters.isActive !== undefined) {
      where.isActive = params.filters.isActive;
    }

    if (params.filters.search !== undefined) {
      const search = params.filters.search.trim();
      const token = search.toLowerCase();

      where.OR = [
        { slug: { contains: token, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { keywords: { has: token } },
      ];
    }

    const rows = await this.prisma.department.findMany({
      where,
      orderBy: { id: 'asc' },
      take: params.limit + 1,
      ...(params.cursor !== undefined ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: departmentSelect,
    });

    const hasNextPage = rows.length > params.limit;
    const items = hasNextPage ? rows.slice(0, params.limit) : rows;

    return {
      items: items.map((item) => this.toResponse(item)),
      meta: {
        nextCursor: hasNextPage ? items[items.length - 1]?.id : undefined,
        hasNextPage,
        count: items.length,
      },
    };
  }

  async create(input: CreateDepartmentInput): Promise<DepartmentResponse> {
    const existing = await this.prisma.department.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });

    if (existing) {
      throw AppError.conflict('Ya existe un departamento con ese slug');
    }

    const created = await this.prisma.department.create({
      data: {
        slug: input.slug,
        name: normalizeName(input.name),
        description: input.description,
        isActive: input.isActive ?? true,
        keywords: normalizeKeywords(input.keywords) ?? [],
      },
      select: departmentSelect,
    });

    return this.toResponse(created);
  }

  async update(id: string, input: UpdateDepartmentInput): Promise<DepartmentResponse> {
    const existing = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });

    if (!existing) {
      throw AppError.notFound('Departamento no encontrado');
    }

    if (existing.slug === 'general' && input.slug !== undefined && input.slug !== 'general') {
      throw AppError.badRequest('No se puede cambiar el slug del departamento general');
    }

    if (input.slug !== undefined && input.slug !== existing.slug) {
      const duplicate = await this.prisma.department.findUnique({
        where: { slug: input.slug },
        select: { id: true },
      });

      if (duplicate) {
        throw AppError.conflict('Ya existe un departamento con ese slug');
      }
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.name !== undefined ? { name: normalizeName(input.name) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.keywords !== undefined
          ? { keywords: normalizeKeywords(input.keywords) ?? [] }
          : {}),
      },
      select: departmentSelect,
    });

    return this.toResponse(updated);
  }

  async deactivate(id: string): Promise<DepartmentResponse> {
    const existing = await this.prisma.department.findUnique({
      where: { id },
      select: departmentSelect,
    });

    if (!existing) {
      throw AppError.notFound('Departamento no encontrado');
    }

    if (existing.slug === 'general') {
      throw AppError.badRequest('No se puede desactivar el departamento general');
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: { isActive: false },
      select: departmentSelect,
    });

    return this.toResponse(updated);
  }

  private toResponse(item: DepartmentRecord): DepartmentResponse {
    return {
      id: item.id,
      slug: item.slug,
      name: item.name,
      description: item.description ?? undefined,
      isActive: item.isActive,
      keywords: item.keywords,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
