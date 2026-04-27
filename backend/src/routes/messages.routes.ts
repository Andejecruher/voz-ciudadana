/**
 * Messages routes — envío de mensajes outbound y gestión de attachments.
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

  // POST /messages/:id/attachments — registrar attachment sobre un mensaje existente
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/attachments', controller.addAttachment);

  return router;
}
