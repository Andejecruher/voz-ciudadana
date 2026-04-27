import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { createEventsRouter } from '../../routes/events.routes';
import { AppError } from '../../utils/app-error';
import { createTestApp } from '../setup/test-app';

// ── Auth mock ─────────────────────────────────────────────────────────────────

jest.mock('../../middlewares/auth.middleware', () => ({
  authMiddleware: (
    req: { headers: Record<string, string | undefined>; user?: unknown },
    res: { status: (code: number) => { json: (payload: Record<string, unknown>) => void } },
    next: () => void,
  ) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice('Bearer '.length);
    if (!token.startsWith('role:')) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const roles = token
      .slice('role:'.length)
      .split(',')
      .filter((role) => role.length > 0);

    req.user = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'admin@vozciudadana.gob',
      fullName: 'Admin Test',
      roles,
    };

    next();
  },
}));

// ── Tipos helper ──────────────────────────────────────────────────────────────

type AsyncFn<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

// ── Stubs ─────────────────────────────────────────────────────────────────────

const EVENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REGISTRATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CITIZEN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const mockEvent = {
  id: EVENT_ID,
  title: 'Asamblea vecinal',
  slug: 'asamblea-vecinal',
  description: undefined,
  eventType: 'townhall',
  status: 'published',
  startsAt: new Date('2026-05-10T18:00:00.000Z'),
  endsAt: undefined,
  locationName: 'Salón Municipal',
  address: undefined,
  latitude: undefined,
  longitude: undefined,
  capacity: undefined,
  organizerUserId: undefined,
  createdAt: new Date('2026-04-27T00:00:00.000Z'),
  updatedAt: new Date('2026-04-27T00:00:00.000Z'),
};

const mockRegistration = {
  id: REGISTRATION_ID,
  eventId: EVENT_ID,
  citizenId: CITIZEN_ID,
  registrationStatus: 'registered',
  attendanceStatus: 'pending',
  checkedInAt: undefined,
  sourceChannel: 'web',
  notes: undefined,
  createdAt: new Date('2026-04-27T00:00:00.000Z'),
  updatedAt: new Date('2026-04-27T00:00:00.000Z'),
  citizen: { id: CITIZEN_ID, name: 'Ana García', phone: '+5491123456789' },
};

const mockListResult = {
  items: [mockEvent],
  meta: { nextCursor: undefined, hasNextPage: false, count: 1 },
};

const mockRegistrationListResult = {
  items: [mockRegistration],
  meta: { nextCursor: undefined, hasNextPage: false, count: 1 },
};

// ── Service stubs ─────────────────────────────────────────────────────────────

const eventService = {
  list: jest.fn<AsyncFn<[unknown], typeof mockListResult>>(),
  create: jest.fn<AsyncFn<[unknown], typeof mockEvent>>(),
  getById: jest.fn<AsyncFn<[string], typeof mockEvent>>(),
  update: jest.fn<AsyncFn<[string, unknown], typeof mockEvent>>(),
  invite: jest.fn<AsyncFn<[string, unknown], { queued: number; alreadyInvited: number }>>(),
};

const attendanceService = {
  register: jest.fn<AsyncFn<[string, unknown], typeof mockRegistration>>(),
  confirm: jest.fn<AsyncFn<[string, string], typeof mockRegistration>>(),
  checkIn:
    jest.fn<AsyncFn<[string, string, unknown, string | undefined], typeof mockRegistration>>(),
  listRegistrations: jest.fn<AsyncFn<[unknown], typeof mockRegistrationListResult>>(),
  listAttendees: jest.fn<AsyncFn<[unknown], typeof mockRegistrationListResult>>(),
};

const auditService = {
  logFromRequest: jest
    .fn<AsyncFn<[unknown, Record<string, unknown>], void>>()
    .mockResolvedValue(undefined),
};

// ── App ───────────────────────────────────────────────────────────────────────

const app = createTestApp((_, router) => {
  router.use(
    '/api/v1/admin',
    createEventsRouter(
      eventService as unknown as never,
      attendanceService as unknown as never,
      auditService as unknown as never,
    ),
  );
});

const SUPERADMIN = 'Bearer role:SUPERADMIN';
const COORDINADOR = 'Bearer role:COORDINADOR';
const OPERADOR = 'Bearer role:OPERADOR_CHAT';

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  auditService.logFromRequest.mockResolvedValue(undefined);
});

describe('GET /api/v1/admin/events', () => {
  it('devuelve 401 sin token', async () => {
    const res = await request(app).get('/api/v1/admin/events');
    expect(res.status).toBe(401);
  });

  it('devuelve 403 para rol OPERADOR_CHAT', async () => {
    const res = await request(app).get('/api/v1/admin/events').set('Authorization', OPERADOR);
    expect(res.status).toBe(403);
  });

  it('devuelve 200 con lista para SUPERADMIN', async () => {
    eventService.list.mockResolvedValue(mockListResult);

    const res = await request(app).get('/api/v1/admin/events').set('Authorization', SUPERADMIN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('events');
    expect(res.body.events).toHaveLength(1);
    expect(eventService.list).toHaveBeenCalledTimes(1);
  });

  it('devuelve 200 con lista para COORDINADOR', async () => {
    eventService.list.mockResolvedValue(mockListResult);

    const res = await request(app).get('/api/v1/admin/events').set('Authorization', COORDINADOR);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/admin/events', () => {
  const validBody = {
    title: 'Asamblea vecinal',
    startsAt: '2026-05-10T18:00:00.000Z',
  };

  it('devuelve 400 si faltan campos requeridos', async () => {
    const res = await request(app)
      .post('/api/v1/admin/events')
      .set('Authorization', SUPERADMIN)
      .send({ title: 'Solo título' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('details');
  });

  it('devuelve 409 si el slug ya existe', async () => {
    eventService.create.mockRejectedValue(AppError.conflict('Ya existe un evento con ese slug'));

    const res = await request(app)
      .post('/api/v1/admin/events')
      .set('Authorization', SUPERADMIN)
      .send(validBody);

    expect(res.status).toBe(409);
  });

  it('devuelve 201 y el evento creado', async () => {
    eventService.create.mockResolvedValue(mockEvent);

    const res = await request(app)
      .post('/api/v1/admin/events')
      .set('Authorization', SUPERADMIN)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({ title: 'Asamblea vecinal' });
    expect(auditService.logFromRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'event.create' }),
    );
  });
});

describe('GET /api/v1/admin/events/:id', () => {
  it('devuelve 404 si no existe', async () => {
    eventService.getById.mockRejectedValue(AppError.notFound('Evento no encontrado'));

    const res = await request(app)
      .get(`/api/v1/admin/events/${EVENT_ID}`)
      .set('Authorization', SUPERADMIN);

    expect(res.status).toBe(404);
  });

  it('devuelve 200 con el evento', async () => {
    eventService.getById.mockResolvedValue(mockEvent);

    const res = await request(app)
      .get(`/api/v1/admin/events/${EVENT_ID}`)
      .set('Authorization', SUPERADMIN);

    expect(res.status).toBe(200);
    expect(res.body.event.id).toBe(EVENT_ID);
  });
});

describe('PATCH /api/v1/admin/events/:id', () => {
  it('devuelve 400 si body está vacío', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/events/${EVENT_ID}`)
      .set('Authorization', SUPERADMIN)
      .send({});

    expect(res.status).toBe(400);
  });

  it('devuelve 200 con el evento actualizado', async () => {
    eventService.update.mockResolvedValue({ ...mockEvent, title: 'Nuevo título' });

    const res = await request(app)
      .patch(`/api/v1/admin/events/${EVENT_ID}`)
      .set('Authorization', SUPERADMIN)
      .send({ title: 'Nuevo título' });

    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe('Nuevo título');
    expect(auditService.logFromRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'event.update' }),
    );
  });
});

describe('POST /api/v1/admin/events/:id/invite', () => {
  it('devuelve 400 si falta tagIds y neighborhoodIds', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/events/${EVENT_ID}/invite`)
      .set('Authorization', SUPERADMIN)
      .send({ message: 'Hola' });

    expect(res.status).toBe(400);
  });

  it('devuelve 400 si evento está cancelado', async () => {
    eventService.invite.mockRejectedValue(
      AppError.badRequest('No se pueden enviar invitaciones a un evento cancelado'),
    );

    const res = await request(app)
      .post(`/api/v1/admin/events/${EVENT_ID}/invite`)
      .set('Authorization', SUPERADMIN)
      .send({ message: 'Hola', tagIds: ['dddddddd-dddd-4ddd-8ddd-dddddddddddd'] });

    expect(res.status).toBe(400);
  });

  it('devuelve 200 con resultado de invitaciones', async () => {
    eventService.invite.mockResolvedValue({ queued: 5, alreadyInvited: 2 });

    const res = await request(app)
      .post(`/api/v1/admin/events/${EVENT_ID}/invite`)
      .set('Authorization', SUPERADMIN)
      .send({ message: 'Hola vecinos', neighborhoodIds: ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'] });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ queued: 5, alreadyInvited: 2 });
  });
});

describe('POST /api/v1/admin/events/:id/registrations', () => {
  it('devuelve 400 si falta citizenId', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/events/${EVENT_ID}/registrations`)
      .set('Authorization', SUPERADMIN)
      .send({});

    expect(res.status).toBe(400);
  });

  it('devuelve 409 si ciudadano ya está registrado', async () => {
    attendanceService.register.mockRejectedValue(
      AppError.conflict('El ciudadano ya tiene un registro activo en este evento'),
    );

    const res = await request(app)
      .post(`/api/v1/admin/events/${EVENT_ID}/registrations`)
      .set('Authorization', SUPERADMIN)
      .send({ citizenId: CITIZEN_ID });

    expect(res.status).toBe(409);
  });

  it('devuelve 201 con registro en waitlist cuando evento lleno', async () => {
    const waitlistReg = { ...mockRegistration, registrationStatus: 'waitlist' };
    attendanceService.register.mockResolvedValue(waitlistReg);

    const res = await request(app)
      .post(`/api/v1/admin/events/${EVENT_ID}/registrations`)
      .set('Authorization', SUPERADMIN)
      .send({ citizenId: CITIZEN_ID });

    expect(res.status).toBe(201);
    expect(res.body.registration.registrationStatus).toBe('waitlist');
  });

  it('devuelve 201 con registro normal', async () => {
    attendanceService.register.mockResolvedValue(mockRegistration);

    const res = await request(app)
      .post(`/api/v1/admin/events/${EVENT_ID}/registrations`)
      .set('Authorization', SUPERADMIN)
      .send({ citizenId: CITIZEN_ID });

    expect(res.status).toBe(201);
    expect(auditService.logFromRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'citizen.register_event' }),
    );
  });
});

describe('PATCH /api/v1/admin/events/:id/registrations/:registrationId/confirm', () => {
  it('devuelve 400 si registro está en estado incorrecto', async () => {
    attendanceService.confirm.mockRejectedValue(
      AppError.badRequest("No se puede confirmar un registro en estado 'waitlist'"),
    );

    const res = await request(app)
      .patch(`/api/v1/admin/events/${EVENT_ID}/registrations/${REGISTRATION_ID}/confirm`)
      .set('Authorization', SUPERADMIN);

    expect(res.status).toBe(400);
  });

  it('devuelve 200 con registro confirmado', async () => {
    const confirmed = { ...mockRegistration, registrationStatus: 'confirmed' };
    attendanceService.confirm.mockResolvedValue(confirmed);

    const res = await request(app)
      .patch(`/api/v1/admin/events/${EVENT_ID}/registrations/${REGISTRATION_ID}/confirm`)
      .set('Authorization', SUPERADMIN);

    expect(res.status).toBe(200);
    expect(res.body.registration.registrationStatus).toBe('confirmed');
  });
});

describe('POST /api/v1/admin/events/:id/registrations/:registrationId/checkin', () => {
  it('devuelve 400 si registro está en estado incorrecto para check-in', async () => {
    attendanceService.checkIn.mockRejectedValue(
      AppError.badRequest("No se puede hacer check-in de un registro en estado 'waitlist'"),
    );

    const res = await request(app)
      .post(`/api/v1/admin/events/${EVENT_ID}/registrations/${REGISTRATION_ID}/checkin`)
      .set('Authorization', SUPERADMIN)
      .send({});

    expect(res.status).toBe(400);
  });

  it('devuelve 404 si registro no existe', async () => {
    attendanceService.checkIn.mockRejectedValue(AppError.notFound('Registro no encontrado'));

    const res = await request(app)
      .post(`/api/v1/admin/events/${EVENT_ID}/registrations/${REGISTRATION_ID}/checkin`)
      .set('Authorization', SUPERADMIN)
      .send({});

    expect(res.status).toBe(404);
  });

  it('devuelve 200 con check-in exitoso y audit log', async () => {
    const checkedIn = {
      ...mockRegistration,
      attendanceStatus: 'attended',
      checkedInAt: new Date(),
    } as unknown as typeof mockRegistration;
    attendanceService.checkIn.mockResolvedValue(checkedIn);

    const res = await request(app)
      .post(`/api/v1/admin/events/${EVENT_ID}/registrations/${REGISTRATION_ID}/checkin`)
      .set('Authorization', SUPERADMIN)
      .send({ notes: 'Check-in manual' });

    expect(res.status).toBe(200);
    expect(res.body.registration.attendanceStatus).toBe('attended');
    expect(auditService.logFromRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'citizen.checkin_event' }),
    );
  });
});

describe('GET /api/v1/admin/events/:id/registrations', () => {
  it('devuelve 200 con lista de registros', async () => {
    attendanceService.listRegistrations.mockResolvedValue(mockRegistrationListResult);

    const res = await request(app)
      .get(`/api/v1/admin/events/${EVENT_ID}/registrations`)
      .set('Authorization', SUPERADMIN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('registrations');
    expect(res.body.registrations).toHaveLength(1);
  });
});

describe('GET /api/v1/admin/events/:id/attendees', () => {
  it('devuelve 200 con lista de asistentes', async () => {
    attendanceService.listAttendees.mockResolvedValue(mockRegistrationListResult);

    const res = await request(app)
      .get(`/api/v1/admin/events/${EVENT_ID}/attendees`)
      .set('Authorization', SUPERADMIN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('attendees');
  });
});
