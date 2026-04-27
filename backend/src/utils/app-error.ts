/**
 * Jerarquía de errores de aplicación.
 *
 * AppError — base con statusCode + code
 *   ├── ValidationError  — 400 VALIDATION_ERROR  (falla de schema Zod)
 *   ├── NotFoundError    — 404 NOT_FOUND
 *   ├── ConflictError    — 409 CONFLICT
 *   ├── UnauthorizedError— 401 UNAUTHORIZED
 *   └── ForbiddenError   — 403 FORBIDDEN
 *
 * El error handler global (middlewares/errorHandler.ts) consume esta jerarquía.
 */

// ── Base ──────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    // Mantiene el stack trace correcto en V8
    Error.captureStackTrace(this, this.constructor);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Not found'): AppError {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static badRequest(message: string): AppError {
    return new AppError(message, 400, 'BAD_REQUEST');
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409, 'CONFLICT');
  }
}

// ── Subclases de dominio ──────────────────────────────────────────────────────

/**
 * Error de validación — emitido por el validation middleware cuando un schema Zod falla.
 * `issues` contiene el detalle de cada campo inválido.
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly issues: Array<{ path: string; message: string }>,
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/** Recurso no encontrado */
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/** Conflicto de unicidad o estado */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/** Token ausente o inválido */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/** Autenticado pero sin permiso */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}
