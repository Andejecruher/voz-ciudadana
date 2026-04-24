/**
 * Controller HTTP para los endpoints del webhook de WhatsApp.
 *
 * Responsabilidades:
 * - verifyWebhookChallenge: valida hub.mode, hub.verify_token y responde con hub.challenge
 * - receiveWebhookMessage: parsea el payload Meta y delega en BotService
 *
 * Este controller NO contiene lógica de negocio — solo orquesta
 * la capa HTTP ↔ servicios.
 *
 * Nota: El rawBody para la validación HMAC lo captura el middleware
 * metaSignature.middleware.ts ANTES de llegar a receiveWebhookMessage.
 */
import { Request, Response } from 'express';
import { env } from '../config/env.config';
import { BotService } from '../services/bot.service';
import { WhatsAppWebhookPayload } from '../types/types';

export class WebhookController {
  /** Token de verificación configurado en el panel de Meta (env: WHATSAPP_VERIFY_TOKEN) */
  private readonly verifyToken: string;

  constructor(private readonly botService: BotService) {
    this.verifyToken = env.WHATSAPP_VERIFY_TOKEN;
  }

  /**
   * GET /webhook — verificación del webhook por Meta.
   *
   * Meta envía tres query params:
   * - hub.mode      → debe ser "subscribe"
   * - hub.verify_token → debe coincidir con WHATSAPP_VERIFY_TOKEN
   * - hub.challenge  → valor arbitrario que debemos retornar como texto plano
   *
   * Respuesta:
   * - 200 + challenge en texto plano si la verificación es exitosa
   * - 403 si el token no coincide
   */
  verifyWebhookChallenge = (req: Request, res: Response): void => {
    const mode = req.query['hub.mode'] as string | undefined;
    const token = req.query['hub.verify_token'] as string | undefined;
    const challenge = req.query['hub.challenge'] as string | undefined;

    if (mode === 'subscribe' && token === this.verifyToken) {
      console.log('[WebhookController] Verificación de webhook exitosa');
      res.status(200).send(challenge);
      return;
    }

    console.warn('[WebhookController] Verificación fallida — token inválido o modo incorrecto');
    res.status(403).send('Forbidden');
  };

  /**
   * POST /webhook — recibe mensajes y eventos entrantes de WhatsApp.
   *
   * La validación de firma HMAC ya fue realizada por metaSignature.middleware.ts
   * antes de llegar a este handler. Si llegamos aquí, el payload es auténtico.
   *
   * Flujo:
   * 1. Parsear payload Meta
   * 2. Iterar sobre entries y messages
   * 3. Delegar cada mensaje al BotService
   * 4. Responder 200 OK a Meta inmediatamente (Meta requiere < 5 segundos)
   */
  receiveWebhookMessage = (req: Request, res: Response): void => {
    // Parseo defensivo — si el middleware HMAC pasó pero el body está malformado
    const payload = req.body as WhatsAppWebhookPayload | undefined;

    if (!payload || typeof payload !== 'object') {
      console.warn('[WebhookController] Payload inválido recibido');
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    // Ignorar eventos que no son de WhatsApp Business
    if (payload.object !== 'whatsapp_business_account') {
      console.debug('[WebhookController] Ignorando payload no-WhatsApp:', payload.object);
      res.status(200).json({ status: 'ignored' });
      return;
    }

    // Procesar de forma asíncrona sin bloquear la respuesta a Meta
    // Supuesto: el procesamiento es rápido (< 4s); para cargas altas considerar una queue
    this.botService.handleWebhookPayload(payload).catch((err: unknown) => {
      console.error('[WebhookController] Error procesando payload:', err);
    });

    // Meta requiere 200 OK en menos de 5 segundos
    res.status(200).json({ status: 'ok' });
  };
}
