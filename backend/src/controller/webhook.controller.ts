/**
 * Controller HTTP para los endpoints del webhook de WhatsApp.
 * Expone funciones handler de Express — sin decorators ni frameworks.
 *
 * GET  /webhook — verificación de desafío por Meta
 * POST /webhook — recepción de mensajes entrantes
 */
import { Request, Response } from 'express';
import { WebhookService } from '../services/webhook.service';
import { WebhookAuthError } from '../utils/hmac.util';
import { WhatsAppWebhookPayload } from '../config/types';
import { getEnv } from '../config/env.config';

export class WebhookController {
  private readonly verifyToken: string;

  constructor(private readonly webhookService: WebhookService) {
    this.verifyToken = getEnv('WA_VERIFY_TOKEN');
  }

  /**
   * GET /webhook — verificación del webhook por parte de Meta.
   * Meta envía hub.mode, hub.verify_token y hub.challenge.
   *
   * @openapi
   * /webhook:
   *   get:
   *     summary: Verificación del webhook de WhatsApp
   *     description: >
   *       Meta llama a este endpoint para verificar que el servidor es dueño del webhook.
   *       Retorna el challenge como texto plano si el token coincide.
   *     tags: [Webhook]
   *     parameters:
   *       - in: query
   *         name: hub.mode
   *         required: true
   *         schema:
   *           type: string
   *           example: subscribe
   *       - in: query
   *         name: hub.verify_token
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: hub.challenge
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Verificación exitosa — retorna hub.challenge como texto plano
   *       403:
   *         description: Token inválido
   */
  verifyChallenge = (req: Request, res: Response): void => {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    if (mode === 'subscribe' && token === this.verifyToken) {
      console.log('[WebhookController] Verificación del webhook exitosa');
      res.status(200).send(challenge);
    } else {
      console.warn('[WebhookController] Verificación fallida — token inválido');
      res.status(403).send('Forbidden');
    }
  };

  /**
   * POST /webhook — recibe mensajes entrantes de WhatsApp.
   * Valida firma HMAC antes de procesar.
   *
   * @openapi
   * /webhook:
   *   post:
   *     summary: Recepción de mensajes entrantes de WhatsApp
   *     description: >
   *       Meta envía los mensajes entrantes firmados con HMAC-SHA256 usando el App Secret.
   *       El header X-Hub-Signature-256 se valida antes de procesar el payload.
   *       Siempre responde 200 OK a Meta (el procesamiento es asíncrono).
   *     tags: [Webhook]
   *     security:
   *       - hubSignature: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               object:
   *                 type: string
   *                 example: whatsapp_business_account
   *               entry:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       200:
   *         description: Payload recibido y encolado para procesamiento
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: ok
   *       401:
   *         description: Firma HMAC inválida o ausente
   *       400:
   *         description: Cuerpo de la request no disponible
   */
  handleIncoming = async (req: Request, res: Response): Promise<void> => {
    // rawBody fue capturado por el middleware en server.ts (verify callback de express.json)
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    if (!rawBody) {
      res.status(400).json({ error: 'Raw body not available' });
      return;
    }

    const signature = req.headers['x-hub-signature-256'] as string | undefined;

    try {
      this.webhookService.validateSignature(rawBody, signature);
    } catch (err) {
      if (err instanceof WebhookAuthError) {
        res.status(401).json({ error: err.message });
        return;
      }
      throw err;
    }

    // Parseo defensivo del payload — puede llegar malformado
    const payload = req.body as WhatsAppWebhookPayload;

    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    await this.webhookService.handleIncomingPayload(payload);

    // Meta requiere 200 OK inmediato — el procesamiento es async
    res.status(200).json({ status: 'ok' });
  };
}
