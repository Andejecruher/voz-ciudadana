import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../utils/app-error';
import type { PrismaService } from './prisma.service';

const neighborhoodSelect = {
  id: true,
  name: true,
  description: true,
  zone: true,
  createdAt: true,
  updatedAt: true,
} as const;

type NeighborhoodRecord = Prisma.NeighborhoodGetPayload<{ select: typeof neighborhoodSelect }>;

export const CreateNeighborhoodSchema = z.object({
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().min(1).max(4000).optional(),
  zone: z.string().trim().min(1).max(100).optional(),
});

export const UpdateNeighborhoodSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    zone: z.string().trim().min(1).max(100).optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.description !== undefined || data.zone !== undefined,
    { message: 'Al menos un campo debe ser enviado' },
  );

export const NeighborhoodIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const NeighborhoodListFiltersSchema = z.object({
  search: z.string().trim().min(1).max(255).optional(),
  zone: z.string().trim().min(1).max(100).optional(),
});

type CreateNeighborhoodInput = z.infer<typeof CreateNeighborhoodSchema>;
type UpdateNeighborhoodInput = z.infer<typeof UpdateNeighborhoodSchema>;
type NeighborhoodListFilters = z.infer<typeof NeighborhoodListFiltersSchema>;

export type NeighborhoodResponse = {
  id: string;
  name: string;
  description: string | undefined;
  zone: string | undefined;
  createdAt: Date;
  updatedAt: Date;
};

export type NeighborhoodListResult = {
  items: NeighborhoodResponse[];
  meta: {
    nextCursor: string | undefined;
    hasNextPage: boolean;
    count: number;
  };
};

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function toLowerToken(value: string): string {
  return normalizeName(value).toLowerCase();
}

export class NeighborhoodsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    cursor: string | undefined;
    limit: number;
    filters: NeighborhoodListFilters;
  }): Promise<NeighborhoodListResult> {
    const where: Prisma.NeighborhoodWhereInput = {};

    if (params.filters.zone !== undefined) {
      where.zone = { contains: params.filters.zone, mode: 'insensitive' };
    }

    if (params.filters.search !== undefined) {
      const search = normalizeName(params.filters.search);
      const searchLower = toLowerToken(params.filters.search);
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameLower: { contains: searchLower } },
      ];
    }

    const rows = await this.prisma.neighborhood.findMany({
      where,
      orderBy: { id: 'asc' },
      take: params.limit + 1,
      ...(params.cursor !== undefined ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: neighborhoodSelect,
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

  async create(input: CreateNeighborhoodInput): Promise<NeighborhoodResponse> {
    const name = normalizeName(input.name);
    const nameLower = toLowerToken(input.name);

    const existing = await this.prisma.neighborhood.findFirst({
      where: { nameLower },
      select: { id: true },
    });

    if (existing) {
      throw AppError.conflict('Ya existe un barrio con ese nombre');
    }

    const created = await this.prisma.neighborhood.create({
      data: {
        name,
        nameLower,
        description: input.description,
        zone: input.zone,
      },
      select: neighborhoodSelect,
    });

    return this.toResponse(created);
  }

  async update(id: string, input: UpdateNeighborhoodInput): Promise<NeighborhoodResponse> {
    const existing = await this.prisma.neighborhood.findUnique({
      where: { id },
      select: { id: true, nameLower: true },
    });

    if (!existing) {
      throw AppError.notFound('Barrio no encontrado');
    }

    const nextNameLower = input.name !== undefined ? toLowerToken(input.name) : undefined;

    if (nextNameLower !== undefined && nextNameLower !== existing.nameLower) {
      const duplicate = await this.prisma.neighborhood.findFirst({
        where: {
          nameLower: nextNameLower,
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw AppError.conflict('Ya existe un barrio con ese nombre');
      }
    }

    const updated = await this.prisma.neighborhood.update({
      where: { id },
      data: {
        ...(input.name !== undefined
          ? { name: normalizeName(input.name), nameLower: toLowerToken(input.name) }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.zone !== undefined ? { zone: input.zone } : {}),
      },
      select: neighborhoodSelect,
    });

    return this.toResponse(updated);
  }

  async deleteNeighborhood(id: string): Promise<NeighborhoodResponse> {
    const existing = await this.prisma.neighborhood.findUnique({
      where: { id },
      select: neighborhoodSelect,
    });

    if (!existing) {
      throw AppError.notFound('Barrio no encontrado');
    }

    const citizensCount = await this.prisma.citizen.count({
      where: { neighborhoodId: id },
    });

    if (citizensCount > 0) {
      throw AppError.conflict('No se puede eliminar un barrio que está en uso por ciudadanos');
    }

    await this.prisma.neighborhood.delete({ where: { id } });
    return this.toResponse(existing);
  }

  private toResponse(item: NeighborhoodRecord): NeighborhoodResponse {
    return {
      id: item.id,
      name: item.name,
      description: item.description ?? undefined,
      zone: item.zone ?? undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
