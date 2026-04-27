import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { createDepartmentsRouter } from '../../routes/departments.routes';
import { createNeighborhoodsRouter } from '../../routes/neighborhoods.routes';
import { createTagsRouter } from '../../routes/tags.routes';
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
}));

type AsyncFn<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

const neighborhoodsService = {
  list: jest.fn<
    AsyncFn<
      [
        {
          cursor: string | undefined;
          limit: number;
          filters: { search?: string; zone?: string };
        },
      ],
      {
        items: Array<Record<string, unknown>>;
        meta: { nextCursor: string | undefined; hasNextPage: boolean; count: number };
      }
    >
  >(),
  create: jest.fn<AsyncFn<[Record<string, unknown>], Record<string, unknown>>>(),
  update: jest.fn<AsyncFn<[string, Record<string, unknown>], Record<string, unknown>>>(),
  deleteNeighborhood: jest.fn<AsyncFn<[string], Record<string, unknown>>>(),
};

const tagsService = {
  list: jest.fn<
    AsyncFn<
      [
        {
          cursor: string | undefined;
          limit: number;
          filters: { search?: string; color?: string };
        },
      ],
      {
        items: Array<Record<string, unknown>>;
        meta: { nextCursor: string | undefined; hasNextPage: boolean; count: number };
      }
    >
  >(),
  create: jest.fn<AsyncFn<[Record<string, unknown>], Record<string, unknown>>>(),
  update: jest.fn<AsyncFn<[string, Record<string, unknown>], Record<string, unknown>>>(),
  deleteTag: jest.fn<AsyncFn<[string], Record<string, unknown>>>(),
};

const departmentsService = {
  list: jest.fn<
    AsyncFn<
      [
        {
          cursor: string | undefined;
          limit: number;
          filters: { search?: string; isActive?: boolean };
        },
      ],
      {
        items: Array<Record<string, unknown>>;
        meta: { nextCursor: string | undefined; hasNextPage: boolean; count: number };
      }
    >
  >(),
  create: jest.fn<AsyncFn<[Record<string, unknown>], Record<string, unknown>>>(),
  update: jest.fn<AsyncFn<[string, Record<string, unknown>], Record<string, unknown>>>(),
  deactivate: jest.fn<AsyncFn<[string], Record<string, unknown>>>(),
};

const auditService = {
  logFromRequest: jest
    .fn<AsyncFn<[unknown, Record<string, unknown>], void>>()
    .mockResolvedValue(undefined),
};

const app = createTestApp((_, router) => {
  router.use(
    '/api/v1/admin',
    createNeighborhoodsRouter(
      neighborhoodsService as unknown as never,
      auditService as unknown as never,
    ),
  );
  router.use(
    '/api/v1/admin',
    createTagsRouter(tagsService as unknown as never, auditService as never),
  );
  router.use(
    '/api/v1/admin',
    createDepartmentsRouter(
      departmentsService as unknown as never,
      auditService as unknown as never,
    ),
  );
});

const ITEM_ID = '550e8400-e29b-41d4-a716-446655440002';

describe('Admin catalogs integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditService.logFromRequest.mockResolvedValue(undefined);
  });

  it('GET /api/v1/admin/neighborhoods permite lectura a COORDINADOR con filtros y cursor', async () => {
    neighborhoodsService.list.mockResolvedValue({
      items: [
        {
          id: ITEM_ID,
          name: 'Centro',
          description: 'Zona centro',
          zone: 'Norte',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      meta: {
        nextCursor: ITEM_ID,
        hasNextPage: true,
        count: 1,
      },
    });

    const res = await request(app)
      .get('/api/v1/admin/neighborhoods?search=centro&zone=norte&limit=5&cursor=abc123')
      .set('Authorization', 'Bearer role:COORDINADOR');

    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as { neighborhoods: unknown[] }).neighborhoods)).toBe(true);
    expect((res.body as { meta: { hasNextPage: boolean } }).meta.hasNextPage).toBe(true);
    expect(neighborhoodsService.list).toHaveBeenCalledWith({
      cursor: 'abc123',
      limit: 5,
      filters: {
        search: 'centro',
        zone: 'norte',
      },
    });
  });

  it('POST /api/v1/admin/neighborhoods bloquea mutación a COORDINADOR', async () => {
    const res = await request(app)
      .post('/api/v1/admin/neighborhoods')
      .set('Authorization', 'Bearer role:COORDINADOR')
      .send({ name: 'Centro' });

    expect(res.status).toBe(403);
    expect(neighborhoodsService.create).not.toHaveBeenCalled();
  });

  it('POST /api/v1/admin/neighborhoods devuelve 400 en payload inválido', async () => {
    const res = await request(app)
      .post('/api/v1/admin/neighborhoods')
      .set('Authorization', 'Bearer role:SUPERADMIN')
      .send({ name: 'A' });

    expect(res.status).toBe(400);
    expect(neighborhoodsService.create).not.toHaveBeenCalled();
  });

  it('DELETE /api/v1/admin/neighborhoods/:id devuelve 409 si el barrio está en uso', async () => {
    neighborhoodsService.deleteNeighborhood.mockRejectedValue(
      AppError.conflict('No se puede eliminar un barrio que está en uso por ciudadanos'),
    );

    const res = await request(app)
      .delete(`/api/v1/admin/neighborhoods/${ITEM_ID}`)
      .set('Authorization', 'Bearer role:SUPERADMIN');

    expect(res.status).toBe(409);
  });

  it('PATCH /api/v1/admin/tags/:id actualiza etiqueta con SUPERADMIN', async () => {
    tagsService.update.mockResolvedValue({
      id: ITEM_ID,
      name: 'infraestructura',
      description: 'Descripción actualizada',
      color: '#0EA5E9',
      createdAt: new Date().toISOString(),
    });

    const res = await request(app)
      .patch(`/api/v1/admin/tags/${ITEM_ID}`)
      .set('Authorization', 'Bearer role:SUPERADMIN')
      .send({ description: 'Descripción actualizada' });

    expect(res.status).toBe(200);
    expect(tagsService.update).toHaveBeenCalledWith(ITEM_ID, {
      description: 'Descripción actualizada',
    });
  });

  it('DELETE /api/v1/admin/tags/:id devuelve 409 si la etiqueta está asignada', async () => {
    tagsService.deleteTag.mockRejectedValue(
      AppError.conflict('No se puede eliminar una etiqueta que está asignada a ciudadanos'),
    );

    const res = await request(app)
      .delete(`/api/v1/admin/tags/${ITEM_ID}`)
      .set('Authorization', 'Bearer role:SUPERADMIN');

    expect(res.status).toBe(409);
  });

  it('GET /api/v1/admin/departments parsea filtro isActive y cursor pagination', async () => {
    departmentsService.list.mockResolvedValue({
      items: [
        {
          id: ITEM_ID,
          slug: 'general',
          name: 'General',
          description: 'Canal general',
          isActive: true,
          keywords: ['general'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      meta: {
        nextCursor: undefined,
        hasNextPage: false,
        count: 1,
      },
    });

    const res = await request(app)
      .get('/api/v1/admin/departments?isActive=true&search=general&limit=10')
      .set('Authorization', 'Bearer role:COORDINADOR');

    expect(res.status).toBe(200);
    expect(departmentsService.list).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 10,
      filters: {
        isActive: true,
        search: 'general',
      },
    });
  });

  it('DELETE /api/v1/admin/departments/:id realiza soft delete (deactivate)', async () => {
    departmentsService.deactivate.mockResolvedValue({
      id: ITEM_ID,
      slug: 'obras',
      name: 'Obras',
      description: 'Área de obras',
      isActive: false,
      keywords: ['bacheo'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .delete(`/api/v1/admin/departments/${ITEM_ID}`)
      .set('Authorization', 'Bearer role:SUPERADMIN');

    expect(res.status).toBe(200);
    expect(departmentsService.deactivate).toHaveBeenCalledWith(ITEM_ID);
    expect((res.body as { department: { isActive: boolean } }).department.isActive).toBe(false);
  });

  it('PATCH /api/v1/admin/departments/:id devuelve 400 si payload es inválido', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/departments/${ITEM_ID}`)
      .set('Authorization', 'Bearer role:SUPERADMIN')
      .send({ slug: 'slug invalido' });

    expect(res.status).toBe(400);
    expect(departmentsService.update).not.toHaveBeenCalled();
  });
});
