/**
 * Handover routes — gestión de handover bot↔humano.
 * Requiere JWT auth.
 */
import { Router } from 'express';
import { HandoverController } from '../controllers/handover.controller';
import { jwtMiddleware } from '../middlewares/jwt.middleware';

export function createHandoverRouter(controller: HandoverController): Router {
  const router = Router();

  router.use(jwtMiddleware);

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/take', controller.take);

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/release', controller.release);

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/escalate', controller.escalate);

  return router;
}
