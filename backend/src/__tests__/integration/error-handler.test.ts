/**
 * Integration tests: errorHandler middleware + api-response format
 *
 * Levanta una mini-app Express (sin Prisma/Redis/bot) para verificar
 * que el error handler produce el contrato { success: false, error, code? }.
 */
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { ErrorResponse, SuccessResponse } from '../../utils/api-response';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/app-error';
import { createTestApp } from '../setup/test-app';

const app = createTestApp((_, router) => {
  // Ruta que lanza AppError
  router.get('/test/app-error', () => {
    throw new AppError('Custom error', 422, 'CUSTOM_CODE');
  });

  // Ruta que lanza ValidationError
  router.get('/test/validation-error', () => {
    throw new ValidationError('Validation failed', [
      { path: 'email', message: 'Invalid email format' },
    ]);
  });

  // Ruta que lanza NotFoundError
  router.get('/test/not-found', () => {
    throw new NotFoundError('Resource not found');
  });

  // Ruta que lanza ForbiddenError
  router.get('/test/forbidden', () => {
    throw new ForbiddenError('Access denied');
  });

  // Ruta que lanza un Error genérico (no AppError)
  router.get('/test/generic-error', () => {
    throw new Error('Some unhandled error');
  });

  // Ruta que responde correctamente
  router.get('/test/ok', (_, res) => {
    res.status(200).json({ success: true, data: { message: 'hello' } });
  });
});

describe('errorHandler middleware', () => {
  it('debe responder 422 con { success: false, error, code } para AppError', async () => {
    const res = await request(app).get('/test/app-error');
    const body = res.body as ErrorResponse;
    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Custom error');
    expect(body.code).toBe('CUSTOM_CODE');
  });

  it('debe responder 400 con issues para ValidationError', async () => {
    const res = await request(app).get('/test/validation-error');
    const body = res.body as ErrorResponse & { issues: Array<{ path: string; message: string }> };
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues[0]).toMatchObject({ path: 'email', message: 'Invalid email format' });
  });

  it('debe responder 404 para NotFoundError', async () => {
    const res = await request(app).get('/test/not-found');
    const body = res.body as ErrorResponse;
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('debe responder 403 para ForbiddenError', async () => {
    const res = await request(app).get('/test/forbidden');
    const body = res.body as ErrorResponse;
    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it('debe responder 500 para Error genérico sin exponer detalles', async () => {
    const res = await request(app).get('/test/generic-error');
    const body = res.body as ErrorResponse;
    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Internal server error');
    // No debe exponer el mensaje interno
    expect(body.error).not.toContain('Some unhandled error');
  });

  it('rutas que responden OK no deben ser interceptadas', async () => {
    const res = await request(app).get('/test/ok');
    const body = res.body as SuccessResponse<{ message: string }>;
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
