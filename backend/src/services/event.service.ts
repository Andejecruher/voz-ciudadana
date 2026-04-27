/**
 * EventService — lógica de negocio para eventos ciudadanos.
 *
 * Responsabilidades:
 *  - CRUD de eventos (create, list, get, update)
 *  - Invitaciones masivas segmentadas por tags y/o barrios
 *    → resuelve ciudadanos, crea/actualiza registros como 'invited'
 *    → encola envío WhatsApp via OutboxProcessorService
 *
 * Reglas de dominio:
 *  - Eventos en estado cancelled/completed no aceptan nuevos registros.
 *  - Slug debe ser único; se genera automáticamente desde el título si no se provee.
 *  - El organizer_user_id es opcional (referencia a users).
 */
import { EventStatus, EventType, Prisma, RegistrationStatus } from '@prisma/client';
import { z } from 'zod';

import { WaTextOutbound } from '../types/whatsapp.types';
import { AppError } from '../utils/app-error';
import { OutboxProcessorService } from './events/outbox-processor.service';
import type { PrismaService } from './prisma.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 255);
}

// ── Selects ───────────────────────────────────────────────────────────────────

const eventSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  eventType: true,
  status: true,
  startsAt: true,
  endsAt: true,
  locationName: true,
  address: true,
  latitude: true,
  longitude: true,
  capacity: true,
  organizerUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type EventRecord = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

// ── Zod schemas ───────────────────────────────────────────────────────────────

const SlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug inválido — solo minúsculas, números y guiones')
  .optional();

const IsoDateSchema = z.coerce.date();

export const CreateEventSchema = z.object({
  title: z.string().trim().min(2).max(255),
  slug: SlugSchema,
  description: z.string().trim().min(1).max(10_000).optional(),
  eventType: z.nativeEnum(EventType).optional(),
  status: z.nativeEnum(EventStatus).optional(),
  startsAt: IsoDateSchema,
  endsAt: IsoDateSchema.optional(),
  locationName: z.string().trim().min(1).max(255).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  capacity: z.number().int().positive().optional(),
  organizerUserId: z.string().uuid().optional(),
});

export const UpdateEventSchema = z
  .object({
    title: z.string().trim().min(2).max(255).optional(),
    slug: SlugSchema,
    description: z.string().trim().min(1).max(10_000).optional(),
    eventType: z.nativeEnum(EventType).optional(),
    status: z.nativeEnum(EventStatus).optional(),
    startsAt: IsoDateSchema.optional(),
    endsAt: IsoDateSchema.optional(),
    locationName: z.string().trim().min(1).max(255).optional(),
    address: z.string().trim().min(1).max(500).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    capacity: z.number().int().positive().optional(),
    organizerUserId: z.string().uuid().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Al menos un campo debe ser enviado' });

export const EventIdParamSchema = z.object({ id: z.string().uuid() });

export const EventListFiltersSchema = z.object({
  search: z.string().trim().min(1).max(255).optional(),
  status: z.nativeEnum(EventStatus).optional(),
  eventType: z.nativeEnum(EventType).optional(),
  organizerUserId: z.string().uuid().optional(),
});

export const InviteBodySchema = z
  .object({
    message: z.string().trim().min(1).max(1024),
    tagIds: z.array(z.string().uuid()).min(1).optional(),
    neighborhoodIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine(
    (d) =>
      (d.tagIds !== undefined && d.tagIds.length > 0) ||
      (d.neighborhoodIds !== undefined && d.neighborhoodIds.length > 0),
    { message: 'Debe especificar al menos tagIds o neighborhoodIds para segmentar la invitación' },
  );

// ── Types ─────────────────────────────────────────────────────────────────────

type CreateEventInput = z.infer<typeof CreateEventSchema>;
type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
type EventListFilters = z.infer<typeof EventListFiltersSchema>;
type InviteBody = z.infer<typeof InviteBodySchema>;

export type EventResponse = {
  id: string;
  title: string;
  slug: string;
  description: string | undefined;
  eventType: string;
  status: string;
  startsAt: Date;
  endsAt: Date | undefined;
  locationName: string | undefined;
  address: string | undefined;
  latitude: string | undefined;
  longitude: string | undefined;
  capacity: number | undefined;
  organizerUserId: string | undefined;
  createdAt: Date;
  updatedAt: Date;
};

export type EventListResult = {
  items: EventResponse[];
  meta: {
    nextCursor: string | undefined;
    hasNextPage: boolean;
    count: number;
  };
};

export type InviteResult = {
  queued: number;
  alreadyInvited: number;
};

// ── Service ───────────────────────────────────────────────────────────────────

export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxProcessor: OutboxProcessorService,
  ) {}

  async create(input: CreateEventInput): Promise<EventResponse> {
    const slug = input.slug ?? toSlug(input.title);

    const existingSlug = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existingSlug) throw AppError.conflict('Ya existe un evento con ese slug');

    const created = await this.prisma.event.create({
      data: {
        title: input.title,
        slug,
        description: input.description,
        eventType: input.eventType,
        status: input.status ?? EventStatus.draft,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        locationName: input.locationName,
        address: input.address,
        latitude: input.latitude !== undefined ? new Prisma.Decimal(input.latitude) : undefined,
        longitude: input.longitude !== undefined ? new Prisma.Decimal(input.longitude) : undefined,
        capacity: input.capacity,
        organizerUserId: input.organizerUserId,
      },
      select: eventSelect,
    });

    return this.toResponse(created);
  }

  async list(params: {
    cursor: string | undefined;
    limit: number;
    filters: EventListFilters;
  }): Promise<EventListResult> {
    const where: Prisma.EventWhereInput = {};

    if (params.filters.status !== undefined) {
      where.status = params.filters.status;
    }
    if (params.filters.eventType !== undefined) {
      where.eventType = params.filters.eventType;
    }
    if (params.filters.organizerUserId !== undefined) {
      where.organizerUserId = params.filters.organizerUserId;
    }
    if (params.filters.search !== undefined) {
      const s = params.filters.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { slug: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { locationName: { contains: s, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.event.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      take: params.limit + 1,
      ...(params.cursor !== undefined ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: eventSelect,
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

  async getById(id: string): Promise<EventResponse> {
    const event = await this.prisma.event.findUnique({ where: { id }, select: eventSelect });
    if (!event) throw AppError.notFound('Evento no encontrado');
    return this.toResponse(event);
  }

  async update(id: string, input: UpdateEventInput): Promise<EventResponse> {
    const existing = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) throw AppError.notFound('Evento no encontrado');

    if (input.slug !== undefined && input.slug !== existing.slug) {
      const dup = await this.prisma.event.findUnique({
        where: { slug: input.slug },
        select: { id: true },
      });
      if (dup) throw AppError.conflict('Ya existe un evento con ese slug');
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.eventType !== undefined ? { eventType: input.eventType } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(input.locationName !== undefined ? { locationName: input.locationName } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.latitude !== undefined ? { latitude: new Prisma.Decimal(input.latitude) } : {}),
        ...(input.longitude !== undefined
          ? { longitude: new Prisma.Decimal(input.longitude) }
          : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.organizerUserId !== undefined ? { organizerUserId: input.organizerUserId } : {}),
      },
      select: eventSelect,
    });

    return this.toResponse(updated);
  }

  /**
   * Invitación masiva segmentada por tags y/o barrios.
   *
   * Flujo:
   * 1. Cargar evento y verificar que esté publicado y no cancelado.
   * 2. Resolver ciudadanos vía tag o barrio (UNION lógica).
   * 3. Para cada ciudadano:
   *    a. Si ya tiene registro activo (invited/registered/confirmed) → skip (alreadyInvited++).
   *    b. Si no tiene registro → crear como 'invited' + encolar outbox.
   *    c. Si tiene registro cancelled → actualizar a 'invited' + encolar outbox.
   * 4. Usar clave de idempotencia estable: `invite:{eventId}:{citizenId}` para evitar
   *    duplicados en retries.
   */
  async invite(eventId: string, input: InviteBody): Promise<InviteResult> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, status: true, startsAt: true, locationName: true },
    });
    if (!event) throw AppError.notFound('Evento no encontrado');
    if (event.status === EventStatus.cancelled) {
      throw AppError.badRequest('No se pueden enviar invitaciones a un evento cancelado');
    }
    if (event.status === EventStatus.completed) {
      throw AppError.badRequest('No se pueden enviar invitaciones a un evento ya completado');
    }

    // Resolver ciudadanos por tags
    const citizenIdsByTag: string[] =
      input.tagIds !== undefined && input.tagIds.length > 0
        ? (
            await this.prisma.citizenTag.findMany({
              where: { tagId: { in: input.tagIds } },
              select: { citizenId: true },
              distinct: ['citizenId'],
            })
          ).map((r) => r.citizenId)
        : [];

    // Resolver ciudadanos por barrios
    const citizenIdsByNeighborhood: string[] =
      input.neighborhoodIds !== undefined && input.neighborhoodIds.length > 0
        ? (
            await this.prisma.citizen.findMany({
              where: { neighborhoodId: { in: input.neighborhoodIds } },
              select: { id: true },
            })
          ).map((r) => r.id)
        : [];

    // UNION deduplicada
    const allCitizenIds = [...new Set([...citizenIdsByTag, ...citizenIdsByNeighborhood])];

    if (allCitizenIds.length === 0) {
      return { queued: 0, alreadyInvited: 0 };
    }

    // Cargar registros existentes y phones en una sola query
    const [existingRegs, citizens] = await Promise.all([
      this.prisma.eventRegistration.findMany({
        where: { eventId, citizenId: { in: allCitizenIds } },
        select: { id: true, citizenId: true, registrationStatus: true },
      }),
      this.prisma.citizen.findMany({
        where: { id: { in: allCitizenIds } },
        select: { id: true, phone: true, name: true },
      }),
    ]);

    const regByCitizen = new Map(existingRegs.map((r) => [r.citizenId, r]));
    const citizenMap = new Map(citizens.map((c) => [c.id, c]));

    let queued = 0;
    let alreadyInvited = 0;

    const ACTIVE_STATUSES: RegistrationStatus[] = [
      RegistrationStatus.invited,
      RegistrationStatus.registered,
      RegistrationStatus.confirmed,
      RegistrationStatus.waitlist,
    ];

    for (const citizenId of allCitizenIds) {
      const citizen = citizenMap.get(citizenId);
      if (!citizen) continue;

      const existing = regByCitizen.get(citizenId);

      if (existing && ACTIVE_STATUSES.includes(existing.registrationStatus)) {
        alreadyInvited++;
        continue;
      }

      // Crear o actualizar registro como 'invited'
      if (existing) {
        await this.prisma.eventRegistration.update({
          where: { id: existing.id },
          data: { registrationStatus: RegistrationStatus.invited },
        });
      } else {
        await this.prisma.eventRegistration.create({
          data: {
            eventId,
            citizenId,
            registrationStatus: RegistrationStatus.invited,
            sourceChannel: 'whatsapp',
          },
        });
      }

      // Encolar invitación WhatsApp con idempotency key estable
      const idempotencyKey = `invite:${eventId}:${citizenId}`;
      const waPayload: WaTextOutbound = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: citizen.phone,
        type: 'text',
        text: {
          body: input.message,
        },
      };

      await this.outboxProcessor.enqueue(citizen.phone, waPayload, idempotencyKey);

      queued++;
    }

    return { queued, alreadyInvited };
  }

  // ── Mapper ──────────────────────────────────────────────────────────────────

  private toResponse(item: EventRecord): EventResponse {
    return {
      id: item.id,
      title: item.title,
      slug: item.slug,
      description: item.description ?? undefined,
      eventType: item.eventType,
      status: item.status,
      startsAt: item.startsAt,
      endsAt: item.endsAt ?? undefined,
      locationName: item.locationName ?? undefined,
      address: item.address ?? undefined,
      latitude: item.latitude?.toString() ?? undefined,
      longitude: item.longitude?.toString() ?? undefined,
      capacity: item.capacity ?? undefined,
      organizerUserId: item.organizerUserId ?? undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
