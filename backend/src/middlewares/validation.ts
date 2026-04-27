/**
 * Middleware de validación con Zod.
 *
 * Uso:
 *   router.post('/usuarios', validate({ body: CreateUserSchema }), handler)
 *   router.get('/usuarios', validate({ query: ListUsersQuerySchema }), handler)
 *
 * Valida `body`, `query` y/o `params` según los schemas provistos.
 * En caso de error, lanza ValidationError con los issues de Zod para que
 * el errorHandler global los serialice correctamente.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/app-error';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Genera un middleware que valida las partes de la Request indicadas.
 * Muta `req.body`, `req.query` y `req.params` con los valores parseados por Zod
 * (esto aplica defaults, coerción y stripping de campos extra).
 *
 * @param schemas - Schemas Zod para body, query y/o params
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body !== undefined) {
        req.body = schemas.body.parse(req.body);
      }

      if (schemas.query !== undefined) {
        // express-serve-static-core define query como ParsedQs — hacer cast
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }

      if (schemas.params !== undefined) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));

        next(new ValidationError('Validation failed', issues));
        return;
      }

      next(err);
    }
  };
}
