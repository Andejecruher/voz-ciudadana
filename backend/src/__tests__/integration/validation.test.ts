/**
 * Integration tests: validation middleware con Zod
 */
import request from 'supertest';
import { z } from 'zod';
import { createTestApp } from '../setup/test-app';
import { validate } from '../../middlewares/validation';
import type { ErrorResponse, SuccessResponse } from '../../utils/api-response';

const CreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const app = createTestApp((_, router) => {
  router.post('/test/validate-body', validate({ body: CreateSchema }), (req, res) => {
    res.status(200).json({ success: true, data: req.body as BodyData });
  });

  router.get('/test/validate-params/:id', validate({ params: IdParamSchema }), (req, res) => {
    res.status(200).json({ success: true, data: req.params });
  });
});

type BodyData = { name: string; email: string };
type ParamData = { id: string };

describe('validate() middleware', () => {
  it('debe pasar con body válido y parsear el resultado', async () => {
    const res = await request(app)
      .post('/test/validate-body')
      .send({ name: 'Juan', email: 'juan@test.com' });

    const body = res.body as SuccessResponse<BodyData>;
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ name: 'Juan', email: 'juan@test.com' });
  });

  it('debe rechazar body inválido con 400 y issues', async () => {
    const res = await request(app)
      .post('/test/validate-body')
      .send({ name: '', email: 'not-an-email' });

    const body = res.body as ErrorResponse;
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(Array.isArray((res.body as Record<string, unknown>)['issues'])).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(((res.body as Record<string, unknown>)['issues'] as unknown[]).length).toBeGreaterThan(0);
  });

  it('debe rechazar body vacío (campos requeridos faltantes)', async () => {
    const res = await request(app).post('/test/validate-body').send({});

    const body = res.body as ErrorResponse;
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('debe rechazar params con UUID inválido', async () => {
    const res = await request(app).get('/test/validate-params/not-a-uuid');

    const body = res.body as ErrorResponse;
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('debe aceptar params con UUID válido', async () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app).get(`/test/validate-params/${validUuid}`);

    const body = res.body as SuccessResponse<ParamData>;
    expect(res.status).toBe(200);
    expect(body.data.id).toBe(validUuid);
  });
});
