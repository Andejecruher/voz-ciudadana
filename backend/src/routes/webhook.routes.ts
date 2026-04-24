/**
 * Rutas del webhook de WhatsApp Cloud API.
 *
 * Monta los endpoints GET y POST /webhook.
 * Las instancias de servicios se reciben por parámetro para facilitar
 * el testing y mantener la inyección de dependencias manual.
 *
 * Diagrama de flujo:
 *   GET  /webhook  → WebhookController.verifyWebhookChallenge
 *   POST /webhook  → MetaSignatureMiddleware → WebhookController.receiveWebhookMessage
 *
 * Supuesto: El middleware de firma (metaSignature) se aplica solo al POST
 * porque Meta solo firma los payloads de mensajes, no la verificación GET.
 */
import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { metaSignatureMiddleware } from '../middlewares/metaSignature.middleware';

/**
 * Crea y retorna el router de webhook con sus dependencias inyectadas.
 *
 * @param controller - Instancia del WebhookController ya construida
 * @returns Router de Express configurado
 */
export function createWebhookRouter(controller: WebhookController): Router {
  const router = Router();

  /**
   * GET /webhook
   * Meta llama a este endpoint para verificar la suscripción al webhook.
   * Valida hub.mode, hub.verify_token y responde con hub.challenge.
   */
  router.get('/', controller.verifyWebhookChallenge);

  /**
   * POST /webhook
   * Recibe mensajes y eventos de WhatsApp.
   * El middleware metaSignature valida la firma HMAC-SHA256 antes del controller.
   *
   * Nota: express no tipea bien promesas en handlers — se castea a RequestHandler.
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/', metaSignatureMiddleware, controller.receiveWebhookMessage);

  return router;
}
