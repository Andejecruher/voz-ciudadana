/**
 * Unit tests: utils/app-error — jerarquía de errores
 */
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from '../../utils/app-error';

describe('AppError', () => {
  it('debe crear error con statusCode y code', () => {
    const err = new AppError('test error', 422, 'TEST_CODE');
    expect(err.message).toBe('test error');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('TEST_CODE');
    expect(err).toBeInstanceOf(Error);
  });

  it('factory unauthorized() debe producir 401', () => {
    const err = AppError.unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('factory forbidden() debe producir 403', () => {
    const err = AppError.forbidden();
    expect(err.statusCode).toBe(403);
  });

  it('factory notFound() debe producir 404', () => {
    const err = AppError.notFound('Usuario no encontrado');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Usuario no encontrado');
  });

  it('factory badRequest() debe producir 400', () => {
    const err = AppError.badRequest('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('factory conflict() debe producir 409', () => {
    const err = AppError.conflict('Duplicate email');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });
});

describe('ValidationError', () => {
  it('debe ser instancia de AppError con statusCode 400', () => {
    const err = new ValidationError('Validation failed', [
      { path: 'email', message: 'Invalid email' },
    ]);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.issues).toHaveLength(1);
    expect(err.issues[0]?.path).toBe('email');
  });
});

describe('NotFoundError', () => {
  it('debe tener statusCode 404', () => {
    const err = new NotFoundError('Reporte no encontrado');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('ConflictError', () => {
  it('debe tener statusCode 409', () => {
    const err = new ConflictError('Email ya en uso');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(409);
  });
});

describe('UnauthorizedError', () => {
  it('debe tener statusCode 401', () => {
    const err = new UnauthorizedError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });
});

describe('ForbiddenError', () => {
  it('debe tener statusCode 403', () => {
    const err = new ForbiddenError('Access denied. Required roles: SUPERADMIN');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });
});
