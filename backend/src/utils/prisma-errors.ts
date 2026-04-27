/**
 * Mapeador de errores Prisma → AppError.
 *
 * Prisma lanza tres tipos de errores conocidos:
 *   PrismaClientKnownRequestError   — errores de BD con código P2xxx
 *   PrismaClientValidationError     — tipos TS incorrectos en la query
 *   PrismaClientUnknownRequestError — errores de BD sin código
 *
 * Este módulo normaliza esos errores a AppError para que el error handler
 * global pueda responder con el status HTTP correcto.
 *
 * Referencia de códigos: https://www.prisma.io/docs/reference/api-reference/error-reference
 *
 * NOTA: Se importa desde @prisma/client/runtime/library para ser agnóstico
 * al cliente generado — funciona antes y después de `prisma generate`.
 */
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientUnknownRequestError,
} from '@prisma/client/runtime/library';
import { AppError, ConflictError, NotFoundError } from './app-error';

// ── Mapeo de códigos Prisma ───────────────────────────────────────────────────

/**
 * Convierte un error Prisma conocido en un AppError con el status HTTP apropiado.
 * Si el error no es Prisma, lo devuelve sin modificar.
 */
export function mapPrismaError(err: unknown): unknown {
  // PrismaClientKnownRequestError — errores tipados con código P2xxx
  if (err instanceof PrismaClientKnownRequestError) {
    return mapKnownError(err);
  }

  // PrismaClientValidationError — query mal formada (tipos incorrectos, campos faltantes)
  if (err instanceof PrismaClientValidationError) {
    return new AppError('Invalid query parameters', 400, 'PRISMA_VALIDATION');
  }

  // PrismaClientUnknownRequestError — error de BD sin código tipado
  if (err instanceof PrismaClientUnknownRequestError) {
    return new AppError('Database error', 500, 'DB_ERROR');
  }

  return err;
}

function mapKnownError(err: PrismaClientKnownRequestError): AppError {
  switch (err.code) {
    // Unique constraint violation
    case 'P2002': {
      const target = Array.isArray(err.meta?.['target'])
        ? (err.meta['target'] as string[]).join(', ')
        : 'field';
      return new ConflictError(`Unique constraint failed on: ${target}`);
    }

    // Record not found (findUniqueOrThrow / findFirstOrThrow / update / delete)
    case 'P2025':
      return new NotFoundError(
        typeof err.meta?.['cause'] === 'string' ? err.meta['cause'] : 'Record not found',
      );

    // Foreign key constraint violation
    case 'P2003': {
      const field =
        typeof err.meta?.['field_name'] === 'string' ? err.meta['field_name'] : 'relation';
      return new AppError(`Foreign key constraint failed on: ${field}`, 409, 'FK_CONSTRAINT');
    }

    // Required relation not found
    case 'P2018':
      return new AppError('Required connected records not found', 400, 'RELATION_NOT_FOUND');

    // Value too long for column
    case 'P2000': {
      const col =
        typeof err.meta?.['column_name'] === 'string' ? err.meta['column_name'] : 'column';
      return new AppError(`Value too long for column: ${col}`, 400, 'VALUE_TOO_LONG');
    }

    // Default: error de BD genérico
    default:
      return new AppError(`Database error [${err.code}]`, 500, 'DB_ERROR');
  }
}

/**
 * Convierte el error si es Prisma, o lo relanza tal cual.
 * Útil en bloques catch de servicios.
 *
 * @example
 * try {
 *   return await prisma.user.create({ data });
 * } catch (err) {
 *   throw throwIfPrisma(err);
 * }
 */
export function throwIfPrisma(err: unknown): unknown {
  return mapPrismaError(err);
}
