import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { createAuthRouter } from '../../routes/auth.routes';
import { createUsersRouter } from '../../routes/users.routes';
import { AppError } from '../../utils/app-error';
import { createTestApp } from '../setup/test-app';

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
  jwtMiddleware: (
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

type AsyncFn<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
};

const authService = {
  login: jest.fn<AsyncFn<[string, string, string], LoginResult>>(),
  refresh:
    jest.fn<
      AsyncFn<[string, string, { ip?: string; userAgent?: string }?], Record<string, unknown>>
    >(),
  me: jest.fn<AsyncFn<[string], Record<string, unknown>>>(),
  logout: jest.fn<AsyncFn<[string, string?], void>>(),
  logoutAll: jest.fn<AsyncFn<[string], void>>(),
  registerAdmin: jest.fn<AsyncFn<[Record<string, unknown>, string[]], Record<string, unknown>>>(),
};

const lockoutService = {
  checkIpRateLimit: jest.fn<AsyncFn<[string], void>>().mockResolvedValue(undefined),
  checkLockout: jest
    .fn<AsyncFn<[string, { ip?: string; userAgent?: string }?], void>>()
    .mockResolvedValue(undefined),
  checkRefreshRateLimit: jest.fn<AsyncFn<[string], void>>().mockResolvedValue(undefined),
};

const userService = {
  listUsers: jest.fn<AsyncFn<[], Array<Record<string, unknown>>>>(),
  getUserById: jest.fn<AsyncFn<[string], Record<string, unknown>>>(),
  createUser: jest.fn<AsyncFn<[Record<string, unknown>], Record<string, unknown>>>(),
  updateUser: jest.fn<AsyncFn<[string, Record<string, unknown>], Record<string, unknown>>>(),
  assignRole: jest.fn<AsyncFn<[string, string], Record<string, unknown>>>(),
  removeRole: jest.fn<AsyncFn<[string, string], Record<string, unknown>>>(),
};

const auditService = {
  logFromRequest: jest
    .fn<AsyncFn<[unknown, Record<string, unknown>], void>>()
    .mockResolvedValue(undefined),
};

const app = createTestApp((_, router) => {
  router.use(
    '/api/v1/auth',
    createAuthRouter(
      authService as unknown as never,
      auditService as unknown as never,
      lockoutService as unknown as never,
    ),
  );

  router.use(
    '/api/v1/admin',
    createUsersRouter(userService as unknown as never, auditService as unknown as never),
  );
});

const USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const ROLE_ID = '550e8400-e29b-41d4-a716-446655440003';

describe('Auth + RBAC integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lockoutService.checkIpRateLimit.mockResolvedValue(undefined);
    lockoutService.checkLockout.mockResolvedValue(undefined);
    lockoutService.checkRefreshRateLimit.mockResolvedValue(undefined);
  });

  it('POST /api/v1/auth/login debe responder 200 en credenciales válidas', async () => {
    authService.login.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: USER_ID,
        email: 'admin@vozciudadana.gob',
        fullName: 'Admin',
        roles: ['SUPERADMIN'],
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('x-device-id', 'test-device')
      .send({
        email: 'admin@vozciudadana.gob',
        password: 'PasswordSeguro123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('access-token');
    expect(res.body.refreshToken).toBe('refresh-token');
    expect(authService.login).toHaveBeenCalledWith(
      'admin@vozciudadana.gob',
      'PasswordSeguro123!',
      'test-device',
    );
  });

  it('POST /api/v1/auth/login debe responder 401 en credenciales inválidas', async () => {
    authService.login.mockRejectedValue(AppError.unauthorized('Credenciales inválidas'));

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@vozciudadana.gob',
      password: 'incorrecta',
    });

    expect(res.status).toBe(401);
  });

  it('GET /api/v1/admin/users debe permitir lectura a COORDINADOR', async () => {
    userService.listUsers.mockResolvedValue([
      {
        id: USER_ID,
        email: 'coord@vozciudadana.gob',
        fullName: 'Coord Test',
        isActive: true,
        createdAt: new Date().toISOString(),
        roles: [{ id: ROLE_ID, name: 'COORDINADOR' }],
      },
    ]);

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', 'Bearer role:COORDINADOR');

    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as { users: unknown[] }).users)).toBe(true);
    expect(userService.listUsers).toHaveBeenCalledTimes(1);
  });

  it('GET /api/v1/admin/users/:id debe permitir lectura a COORDINADOR', async () => {
    userService.getUserById.mockResolvedValue({
      id: USER_ID,
      email: 'coord@vozciudadana.gob',
      fullName: 'Coord Test',
      isActive: true,
      createdAt: new Date().toISOString(),
      roles: [{ id: ROLE_ID, name: 'COORDINADOR' }],
    });

    const res = await request(app)
      .get(`/api/v1/admin/users/${USER_ID}`)
      .set('Authorization', 'Bearer role:COORDINADOR');

    expect(res.status).toBe(200);
    expect((res.body as { user: { id: string } }).user.id).toBe(USER_ID);
  });

  it('POST /api/v1/admin/users debe bloquear a COORDINADOR (403)', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', 'Bearer role:COORDINADOR')
      .send({
        email: 'nuevo@vozciudadana.gob',
        password: 'PasswordSeguro123!',
        fullName: 'Nuevo Usuario',
      });

    expect(res.status).toBe(403);
    expect(userService.createUser).not.toHaveBeenCalled();
  });

  it('POST /api/v1/admin/users debe permitir SUPERADMIN', async () => {
    userService.createUser.mockResolvedValue({
      id: USER_ID,
      email: 'nuevo@vozciudadana.gob',
      fullName: 'Nuevo Usuario',
      isActive: true,
      createdAt: new Date().toISOString(),
      roles: [],
    });

    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', 'Bearer role:SUPERADMIN')
      .send({
        email: 'nuevo@vozciudadana.gob',
        password: 'PasswordSeguro123!',
        fullName: 'Nuevo Usuario',
      });

    expect(res.status).toBe(201);
    expect(userService.createUser).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/admin/users/:id/roles/:roleId debe permitir SUPERADMIN', async () => {
    userService.assignRole.mockResolvedValue({
      id: USER_ID,
      email: 'nuevo@vozciudadana.gob',
      fullName: 'Nuevo Usuario',
      isActive: true,
      createdAt: new Date().toISOString(),
      roles: [{ id: ROLE_ID, name: 'ANALISTA' }],
    });

    const res = await request(app)
      .post(`/api/v1/admin/users/${USER_ID}/roles/${ROLE_ID}`)
      .set('Authorization', 'Bearer role:SUPERADMIN');

    expect(res.status).toBe(200);
    expect(userService.assignRole).toHaveBeenCalledWith(USER_ID, ROLE_ID);
  });

  it('DELETE /api/v1/admin/users/:id/roles/:roleId debe permitir SUPERADMIN', async () => {
    userService.removeRole.mockResolvedValue({
      id: USER_ID,
      email: 'nuevo@vozciudadana.gob',
      fullName: 'Nuevo Usuario',
      isActive: true,
      createdAt: new Date().toISOString(),
      roles: [],
    });

    const res = await request(app)
      .delete(`/api/v1/admin/users/${USER_ID}/roles/${ROLE_ID}`)
      .set('Authorization', 'Bearer role:SUPERADMIN');

    expect(res.status).toBe(200);
    expect(userService.removeRole).toHaveBeenCalledWith(USER_ID, ROLE_ID);
  });

  it('GET /api/v1/admin/users debe responder 401 sin token', async () => {
    const res = await request(app).get('/api/v1/admin/users');

    expect(res.status).toBe(401);
  });
});
