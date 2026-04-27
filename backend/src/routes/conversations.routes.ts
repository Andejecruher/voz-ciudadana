import { Router } from 'express';
import { ConversationsController } from '../controllers/conversations.controller';
import { jwtMiddleware } from '../middlewares/jwt.middleware';

export function createConversationsRouter(controller: ConversationsController) {
  const router = Router();

  router.use(jwtMiddleware);

  // Listar conversaciones
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', controller.list);

  // Obtener conversación
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id', controller.getById);

  // Acciones
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/assign', controller.assign);
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/transfer', controller.transfer);
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/handover', controller.handover);
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/close', controller.close);
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/:id/reopen', controller.reopen);

  return router;
}
