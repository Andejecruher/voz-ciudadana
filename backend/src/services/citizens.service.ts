import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../utils/app-error';
import { normalizePhoneForStorage } from '../utils/phone-normalizer';
import type { PrismaService } from './prisma.service';

const citizenSelect = {
  id: true,
  phone: true,
  name: true,
  lastName: true,
  email: true,
  sourceChannel: true,
  leadStatus: true,
  consentGiven: true,
  consentAt: true,
  neighborhood: true,
  neighborhoodId: true,
  interests: true,
  createdAt: true,
  updatedAt: true,
} as const;

type CitizenRecord = Prisma.CitizenGetPayload<{ select: typeof citizenSelect }>;

export const CreateCitizenSchema = z.object({
  phone: z.string().trim().min(6).max(30),
  name: z.string().trim().min(1).max(255).optional(),
  lastName: z.string().trim().min(1).max(255).optional(),
  email: z.string().email().optional(),
  neighborhoodId: z.string().uuid().optional(),
  interests: z.array(z.string().trim()).optional(),
  consentGiven: z.boolean().optional(),
});

export const UpdateCitizenSchema = z
  .object({
    phone: z.string().trim().min(6).max(30).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    lastName: z.string().trim().min(1).max(255).optional(),
    email: z.string().email().optional(),
    neighborhoodId: z.string().uuid().optional(),
    interests: z.array(z.string().trim()).optional(),
    consentGiven: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Al menos un campo debe ser enviado',
  });

export const CitizenIdParamSchema = z.object({ id: z.string().uuid() });

export const CitizenListFiltersSchema = z.object({
  search: z.string().trim().min(1).max(255).optional(),
  leadStatus: z.string().trim().min(1).max(50).optional(),
  sourceChannel: z.string().trim().min(1).max(50).optional(),
  neighborhoodId: z.string().uuid().optional(),
});

type CreateCitizenInput = z.infer<typeof CreateCitizenSchema>;
type UpdateCitizenInput = z.infer<typeof UpdateCitizenSchema>;
type CitizenListFilters = z.infer<typeof CitizenListFiltersSchema>;

export type CitizenResponse = {
  id: string;
  phone: string;
  name: string | undefined;
  lastName: string | undefined;
  email: string | undefined;
  sourceChannel: string;
  leadStatus: string;
  consentGiven: boolean;
  consentAt: Date | null | undefined;
  neighborhood: string | undefined;
  neighborhoodId: string | undefined;
  interests: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type CitizenListResult = {
  items: CitizenResponse[];
  meta: {
    nextCursor: string | undefined;
    hasNextPage: boolean;
    count: number;
  };
};

export class CitizensService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    cursor: string | undefined;
    limit: number;
    filters: CitizenListFilters;
  }): Promise<CitizenListResult> {
    const where: Prisma.CitizenWhereInput = {};

    if (params.filters.leadStatus !== undefined) {
      where.leadStatus = params.filters.leadStatus as any;
    }

    if (params.filters.sourceChannel !== undefined) {
      where.sourceChannel = params.filters.sourceChannel as any;
    }

    if (params.filters.neighborhoodId !== undefined) {
      where.neighborhoodId = params.filters.neighborhoodId;
    }

    if (params.filters.search !== undefined) {
      const s = params.filters.search.trim();
      const phoneSearch = normalizePhoneForStorage(s);
      where.OR = [
        { phone: { contains: phoneSearch } },
        { name: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.citizen.findMany({
      where,
      orderBy: { id: 'asc' },
      take: params.limit + 1,
      ...(params.cursor !== undefined ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: citizenSelect,
    });

    const hasNextPage = rows.length > params.limit;
    const items = hasNextPage ? rows.slice(0, params.limit) : rows;

    return {
      items: items.map((r) => this.toResponse(r)),
      meta: {
        nextCursor: hasNextPage ? items[items.length - 1]?.id : undefined,
        hasNextPage,
        count: items.length,
      },
    };
  }

  async create(input: CreateCitizenInput): Promise<CitizenResponse> {
    const phone = normalizePhoneForStorage(input.phone);

    const existing = await this.prisma.citizen.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (existing) throw AppError.conflict('Ya existe un ciudadano con ese teléfono');

    const created = await this.prisma.citizen.create({
      data: {
        phone,
        name: input.name,
        lastName: input.lastName,
        email: input.email,
        neighborhoodId: input.neighborhoodId,
        interests: input.interests ?? [],
        consentGiven: input.consentGiven ?? false,
      },
      select: citizenSelect,
    });

    return this.toResponse(created);
  }

  async getById(id: string): Promise<CitizenResponse> {
    const existing = await this.prisma.citizen.findUnique({ where: { id }, select: citizenSelect });
    if (!existing) throw AppError.notFound('Ciudadano no encontrado');
    return this.toResponse(existing);
  }

  async update(id: string, input: UpdateCitizenInput): Promise<CitizenResponse> {
    const existing = await this.prisma.citizen.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw AppError.notFound('Ciudadano no encontrado');

    if (input.phone !== undefined) {
      const phone = normalizePhoneForStorage(input.phone);
      const dup = await this.prisma.citizen.findFirst({
        where: { phone, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw AppError.conflict('El teléfono ya está en uso por otro ciudadano');
      input.phone = phone as any;
    }

    const updated = await this.prisma.citizen.update({
      where: { id },
      data: {
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.neighborhoodId !== undefined ? { neighborhoodId: input.neighborhoodId } : {}),
        ...(input.interests !== undefined ? { interests: input.interests } : {}),
        ...(input.consentGiven !== undefined ? { consentGiven: input.consentGiven } : {}),
      },
      select: citizenSelect,
    });

    return this.toResponse(updated);
  }

  async deleteCitizen(id: string): Promise<CitizenResponse> {
    const existing = await this.prisma.citizen.findUnique({ where: { id }, select: citizenSelect });
    if (!existing) throw AppError.notFound('Ciudadano no encontrado');

    await this.prisma.citizen.delete({ where: { id } });
    return this.toResponse(existing);
  }

  async assignTag(citizenId: string, tagId: string, assignedById?: string) {
    const citizen = await this.prisma.citizen.findUnique({
      where: { id: citizenId },
      select: { id: true },
    });
    if (!citizen) throw AppError.notFound('Ciudadano no encontrado');

    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      select: { id: true, name: true, description: true, color: true, createdAt: true },
    });
    if (!tag) throw AppError.notFound('Etiqueta no encontrada');

    const existing = await this.prisma.citizenTag.findFirst({ where: { citizenId, tagId } });
    if (existing) throw AppError.conflict('Etiqueta ya asignada al ciudadano');

    const created = await this.prisma.citizenTag.create({
      data: { citizenId, tagId, assignedById },
      include: {
        tag: { select: { id: true, name: true, description: true, color: true, createdAt: true } },
      },
    });

    return created;
  }

  async removeTag(citizenId: string, tagId: string) {
    const existing = await this.prisma.citizenTag.findFirst({ where: { citizenId, tagId } });
    if (!existing) throw AppError.notFound('Etiqueta no asignada a ese ciudadano');

    await this.prisma.citizenTag.delete({ where: { id: existing.id } });
    return existing;
  }

  async getProfile(id: string) {
    const citizen = await this.prisma.citizen.findUnique({
      where: { id },
      include: {
        citizenTags: {
          include: {
            tag: {
              select: { id: true, name: true, description: true, color: true, createdAt: true },
            },
          },
        },
      },
    });

    if (!citizen) throw AppError.notFound('Ciudadano no encontrado');

    const totalConversations = await this.prisma.conversation.count({ where: { citizenId: id } });
    const openConversations = await this.prisma.conversation.count({
      where: { citizenId: id, status: 'open' },
    });

    const lastConv = await this.prisma.conversation.findFirst({
      where: { citizenId: id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        channel: true,
        updatedAt: true,
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { body: true, createdAt: true },
        },
      },
    });

    const conversationSummary = {
      totalConversations,
      openConversations,
      lastConversation: lastConv
        ? {
            id: lastConv.id,
            status: lastConv.status,
            channel: lastConv.channel,
            updatedAt: lastConv.updatedAt,
            lastMessage: lastConv.messages?.[0]?.body ?? undefined,
          }
        : null,
    };

    return {
      citizen: this.toResponse(citizen as any),
      tags: citizen.citizenTags.map((ct) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        description: ct.tag.description ?? undefined,
        color: ct.tag.color ?? undefined,
        createdAt: ct.tag.createdAt,
      })),
      conversationSummary,
    };
  }

  private toResponse(item: CitizenRecord): CitizenResponse {
    return {
      id: item.id,
      phone: item.phone,
      name: item.name ?? undefined,
      lastName: item.lastName ?? undefined,
      email: item.email ?? undefined,
      sourceChannel: item.sourceChannel,
      leadStatus: item.leadStatus,
      consentGiven: item.consentGiven,
      consentAt: item.consentAt ?? undefined,
      neighborhood: item.neighborhood ?? undefined,
      neighborhoodId: item.neighborhoodId ?? undefined,
      interests: item.interests ?? [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
