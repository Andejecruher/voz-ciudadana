/**
 * Messages routes — envío de mensajes outbound desde el dashboard.
 * Requiere JWT auth.
 */
import { Router } from 'express';
import { MessagesController } from '../controllers/messages.controller';
import { jwtMiddleware } from '../middlewares/jwt.middleware';

export function createMessagesRouter(controller: MessagesController): Router {
  const router = Router();

  // Todos los endpoints requieren autenticación JWT
  router.use(jwtMiddleware);

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/text', controller.sendText);

  return router;
}
