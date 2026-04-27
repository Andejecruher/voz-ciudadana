/**
 * Integration tests: pagination middleware cursor-based
 */
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { PaginationParams } from '../../middlewares/pagination';
import { paginate } from '../../middlewares/pagination';
import type { ErrorResponse, SuccessResponse } from '../../utils/api-response';
import { createTestApp } from '../setup/test-app';

const app = createTestApp((_, router) => {
  router.get('/test/paginate', paginate(), (req, res) => {
    res.status(200).json({ success: true, data: req.pagination });
  });

  router.get('/test/paginate-max50', paginate({ maxLimit: 50, defaultLimit: 10 }), (req, res) => {
    res.status(200).json({ success: true, data: req.pagination });
  });
});

describe('paginate() middleware', () => {
  it('debe usar valores por defecto cuando no se proveen query params', async () => {
    const res = await request(app).get('/test/paginate');
    const body = res.body as SuccessResponse<PaginationParams>;
    expect(res.status).toBe(200);
    expect(body.data.cursor).toBeUndefined();
    expect(body.data.limit).toBe(20);
  });

  it('debe parsear cursor y limit del query string', async () => {
    const res = await request(app).get('/test/paginate?cursor=abc123&limit=5');
    const body = res.body as SuccessResponse<PaginationParams>;
    expect(res.status).toBe(200);
    expect(body.data.cursor).toBe('abc123');
    expect(body.data.limit).toBe(5);
  });

  it('debe rechazar limit no numérico con 400', async () => {
    const res = await request(app).get('/test/paginate?limit=abc');
    const body = res.body as ErrorResponse;
    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_PAGINATION');
  });

  it('debe rechazar limit 0 con 400', async () => {
    const res = await request(app).get('/test/paginate?limit=0');
    const body = res.body as ErrorResponse;
    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_PAGINATION');
  });

  it('debe rechazar limit que supera maxLimit con 400', async () => {
    const res = await request(app).get('/test/paginate-max50?limit=51');
    const body = res.body as ErrorResponse;
    expect(res.status).toBe(400);
    expect(body.code).toBe('PAGINATION_LIMIT_EXCEEDED');
  });

  it('debe usar defaultLimit personalizado', async () => {
    const res = await request(app).get('/test/paginate-max50');
    const body = res.body as SuccessResponse<PaginationParams>;
    expect(res.status).toBe(200);
    expect(body.data.limit).toBe(10);
  });

  it('cursor vacío debe tratarse como undefined (primera página)', async () => {
    const res = await request(app).get('/test/paginate?cursor=');
    const body = res.body as SuccessResponse<PaginationParams>;
    expect(res.status).toBe(200);
    expect(body.data.cursor).toBeUndefined();
  });
});
