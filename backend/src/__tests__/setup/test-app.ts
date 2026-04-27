/**
 * Test helpers para crear una app Express mínima en tests de integración.
 *
 * Permite montar middlewares y rutas específicas sin levantar el servidor completo
 * (sin Prisma, sin Redis, sin bot) — ideal para tests de errorHandler y validation.
 *
 * Uso:
 *   import { createTestApp } from '../setup/test-app';
 *   const app = createTestApp((app) => {
 *     app.get('/test', (req, res) => res.json({ ok: true }));
 *   });
 *   const res = await request(app).get('/test');
 */
import express, { Application, Router } from 'express';
import { errorHandler } from '../../middlewares/errorHandler';

export type AppBuilder = (app: Application, router: Router) => void;

/**
 * Crea una app Express de test con:
 * - JSON body parser
 * - Las rutas/middlewares que provea el builder
 * - errorHandler global al final
 */
export function createTestApp(builder?: AppBuilder): Application {
  const app = express();
  const router = Router();

  app.use(express.json());

  if (builder !== undefined) {
    builder(app, router);
    app.use(router);
  }

  app.use(errorHandler);

  return app;
}
