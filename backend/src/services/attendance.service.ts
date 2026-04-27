/**
 * AttendanceService — lógica de negocio para registros y asistencia a eventos.
 *
 * Responsabilidades:
 *  - Registrar un ciudadano en un evento (register)
 *  - Confirmar asistencia de un ciudadano (confirm)
 *  - Registrar check-in de un ciudadano el día del evento (checkIn)
 *  - Listar registros de un evento (listRegistrations)
 *  - Listar asistentes confirmados/chequeados (listAttendees)
 *
 * Reglas de dominio:
 *  - No se puede registrar en eventos cancelled/completed.
 *  - No se puede registrar el mismo ciudadano dos veces (409 Conflict).
 *  - Si el evento tiene capacity y ya está lleno → registrar como 'waitlist'.
 *  - Check-in sólo para registros en estado registered/confirmed.
 *  - Check-in: actualiza attendanceStatus → attended + checkedInAt + crea EventCheckin.
 */
import { AttendanceStatus, EventStatus, Prisma, RegistrationStatus } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../utils/app-error';
import type { PrismaService } from './prisma.service';

// ── Selects ───────────────────────────────────────────────────────────────────

const registrationSelect = {
  id: true,
  eventId: true,
  citizenId: true,
  registrationStatus: true,
  attendanceStatus: true,
  checkedInAt: true,
  sourceChannel: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  citizen: {
    select: { id: true, name: true, phone: true },
  },
} as const;

type RegistrationRecord = Prisma.EventRegistrationGetPayload<{ select: typeof registrationSelect }>;

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const EventIdParamSchema = z.object({ id: z.string().uuid() });

export const RegistrationParamSchema = z.object({
  id: z.string().uuid(),
  registrationId: z.string().uuid(),
});

export const RegisterBodySchema = z.object({
  citizenId: z.string().uuid(),
  notes: z.string().trim().min(1).max(1000).optional(),
});

export const CheckInBodySchema = z.object({
  notes: z.string().trim().min(1).max(1000).optional(),
});

export const RegistrationListFiltersSchema = z.object({
  registrationStatus: z.nativeEnum(RegistrationStatus).optional(),
  attendanceStatus: z.nativeEnum(AttendanceStatus).optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────────

type RegisterBody = z.infer<typeof RegisterBodySchema>;
type CheckInBody = z.infer<typeof CheckInBodySchema>;
type RegistrationListFilters = z.infer<typeof RegistrationListFiltersSchema>;

export type RegistrationResponse = {
  id: string;
  eventId: string;
  citizenId: string;
  registrationStatus: string;
  attendanceStatus: string;
  checkedInAt: Date | undefined;
  sourceChannel: string;
  notes: string | undefined;
  createdAt: Date;
  updatedAt: Date;
  citizen: { id: string; name: string | null; phone: string };
};

export type RegistrationListResult = {
  items: RegistrationResponse[];
  meta: {
    nextCursor: string | undefined;
    hasNextPage: boolean;
    count: number;
  };
};

// ── Service ───────────────────────────────────────────────────────────────────

export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un ciudadano en un evento.
   *
   * - Si el evento tiene capacity y los registros activos >= capacity → waitlist.
   * - Si ya existe un registro no cancelado → 409 Conflict.
   * - Si existe un registro cancelado → reutilizar (update a registered).
   */
  async register(eventId: string, input: RegisterBody): Promise<RegistrationResponse> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, status: true, capacity: true },
    });
    if (!event) throw AppError.notFound('Evento no encontrado');

    if (event.status === EventStatus.cancelled) {
      throw AppError.badRequest('No se puede registrar en un evento cancelado');
    }
    if (event.status === EventStatus.completed) {
      throw AppError.badRequest('No se puede registrar en un evento ya completado');
    }

    // Verificar ciudadano
    const citizen = await this.prisma.citizen.findUnique({
      where: { id: input.citizenId },
      select: { id: true },
    });
    if (!citizen) throw AppError.notFound('Ciudadano no encontrado');

    // Registro existente
    const existing = await this.prisma.eventRegistration.findUnique({
      where: {
        eventId_citizenId: {
          eventId,
          citizenId: input.citizenId,
        },
      },
      select: { id: true, registrationStatus: true },
    });

    const ACTIVE_STATUSES: RegistrationStatus[] = [
      RegistrationStatus.invited,
      RegistrationStatus.registered,
      RegistrationStatus.confirmed,
      RegistrationStatus.waitlist,
    ];

    if (existing && ACTIVE_STATUSES.includes(existing.registrationStatus)) {
      throw AppError.conflict('El ciudadano ya tiene un registro activo en este evento');
    }

    // Determinar si hay lugar o va a waitlist
    let targetStatus: RegistrationStatus = RegistrationStatus.registered;
    if (event.capacity !== null) {
      const activeCount = await this.prisma.eventRegistration.count({
        where: {
          eventId,
          registrationStatus: {
            in: [RegistrationStatus.registered, RegistrationStatus.confirmed],
          },
        },
      });
      if (activeCount >= event.capacity) {
        targetStatus = RegistrationStatus.waitlist;
      }
    }

    let registration: RegistrationRecord;

    if (existing) {
      // Reutilizar registro cancelado
      registration = await this.prisma.eventRegistration.update({
        where: { id: existing.id },
        data: {
          registrationStatus: targetStatus,
          notes: input.notes,
          attendanceStatus: AttendanceStatus.pending,
          checkedInAt: null,
        },
        select: registrationSelect,
      });
    } else {
      registration = await this.prisma.eventRegistration.create({
        data: {
          eventId,
          citizenId: input.citizenId,
          registrationStatus: targetStatus,
          notes: input.notes,
          sourceChannel: 'web',
        },
        select: registrationSelect,
      });
    }

    return this.toResponse(registration);
  }

  /**
   * Confirma la asistencia de un ciudadano (invited/registered → confirmed).
   */
  async confirm(eventId: string, registrationId: string): Promise<RegistrationResponse> {
    const registration = await this.findRegistration(eventId, registrationId);

    const confirmableStatuses: RegistrationStatus[] = [
      RegistrationStatus.invited,
      RegistrationStatus.registered,
    ];
    if (!confirmableStatuses.includes(registration.registrationStatus)) {
      throw AppError.badRequest(
        `No se puede confirmar un registro en estado '${registration.registrationStatus}'`,
      );
    }

    const updated = await this.prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { registrationStatus: RegistrationStatus.confirmed },
      select: registrationSelect,
    });

    return this.toResponse(updated);
  }

  /**
   * Registra el check-in de un ciudadano el día del evento.
   *
   * - Solo para registered/confirmed.
   * - Actualiza attendanceStatus → attended y registra checkedInAt.
   * - Crea un EventCheckin para trazabilidad.
   */
  async checkIn(
    eventId: string,
    registrationId: string,
    input: CheckInBody,
    checkedInByUserId: string | undefined,
  ): Promise<RegistrationResponse> {
    const registration = await this.findRegistration(eventId, registrationId);

    const checkableStatuses: RegistrationStatus[] = [
      RegistrationStatus.registered,
      RegistrationStatus.confirmed,
    ];
    if (!checkableStatuses.includes(registration.registrationStatus)) {
      throw AppError.badRequest(
        `No se puede hacer check-in de un registro en estado '${registration.registrationStatus}'`,
      );
    }

    const now = new Date();

    const [updated] = await this.prisma.$transaction([
      this.prisma.eventRegistration.update({
        where: { id: registrationId },
        data: {
          attendanceStatus: AttendanceStatus.attended,
          checkedInAt: now,
        },
        select: registrationSelect,
      }),
      this.prisma.eventCheckin.create({
        data: {
          eventId,
          registrationId,
          checkedInBy: checkedInByUserId,
          notes: input.notes,
        },
      }),
    ]);

    return this.toResponse(updated);
  }

  /**
   * Lista todos los registros de un evento con paginación por cursor.
   */
  async listRegistrations(params: {
    eventId: string;
    cursor: string | undefined;
    limit: number;
    filters: RegistrationListFilters;
  }): Promise<RegistrationListResult> {
    // Verificar que el evento exista
    const event = await this.prisma.event.findUnique({
      where: { id: params.eventId },
      select: { id: true },
    });
    if (!event) throw AppError.notFound('Evento no encontrado');

    const where: Prisma.EventRegistrationWhereInput = {
      eventId: params.eventId,
    };
    if (params.filters.registrationStatus !== undefined) {
      where.registrationStatus = params.filters.registrationStatus;
    }
    if (params.filters.attendanceStatus !== undefined) {
      where.attendanceStatus = params.filters.attendanceStatus;
    }

    const rows = await this.prisma.eventRegistration.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: params.limit + 1,
      ...(params.cursor !== undefined ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: registrationSelect,
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

  /**
   * Lista solo los asistentes que hicieron check-in.
   */
  async listAttendees(params: {
    eventId: string;
    cursor: string | undefined;
    limit: number;
  }): Promise<RegistrationListResult> {
    return this.listRegistrations({
      ...params,
      filters: { attendanceStatus: AttendanceStatus.attended },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findRegistration(
    eventId: string,
    registrationId: string,
  ): Promise<RegistrationRecord> {
    const registration = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      select: registrationSelect,
    });
    if (!registration) throw AppError.notFound('Registro no encontrado');
    return registration;
  }

  private toResponse(item: RegistrationRecord): RegistrationResponse {
    return {
      id: item.id,
      eventId: item.eventId,
      citizenId: item.citizenId,
      registrationStatus: item.registrationStatus,
      attendanceStatus: item.attendanceStatus,
      checkedInAt: item.checkedInAt ?? undefined,
      sourceChannel: item.sourceChannel,
      notes: item.notes ?? undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      citizen: {
        id: item.citizen.id,
        name: item.citizen.name,
        phone: item.citizen.phone,
      },
    };
  }
}
