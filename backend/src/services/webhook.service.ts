/**
 * Servicio de dominio para el webhook de WhatsApp.
 * Valida la firma HMAC y delega el procesamiento al bot FSM.
 */
import { validateWebhookSignature } from '../utils/hmac.util';
import { WhatsAppWebhookPayload, WhatsAppTextMessage } from '../config/types';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { normalizePhone } from '../utils/hmac.util';
import { getEnv } from '../config/env.config';

export class WebhookService {
  private readonly appSecret: string;

  constructor(private readonly botService: WhatsAppBotService) {
    this.appSecret = getEnv('WA_APP_SECRET');
  }

  /**
   * Valida la firma X-Hub-Signature-256 enviada por Meta.
   * Delega la lógica criptográfica a utils/hmac.util.ts
   */
  validateSignature(rawBody: Buffer, signature: string | undefined): void {
    validateWebhookSignature(rawBody, signature, this.appSecret);
  }

  /**
   * Procesa el payload del webhook de WhatsApp.
   * Extrae mensajes de texto e inicia el flujo de la FSM del bot.
   */
  async handleIncomingPayload(payload: WhatsAppWebhookPayload): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') {
      console.debug('[WebhookService] Ignorando payload no-WhatsApp');
      return;
    }

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;

        const messages: WhatsAppTextMessage[] = change.value?.messages ?? [];

        for (const msg of messages) {
          // Solo procesamos mensajes de texto por ahora
          if (msg.type !== 'text' || !msg.text?.body) {
            console.debug(`[WebhookService] Ignorando mensaje tipo: ${msg.type}`);
            continue;
          }

          const phone = normalizePhone(msg.from);
          const text = msg.text.body.trim();
          const waMessageId = msg.id;

          console.log(`[WebhookService] Mensaje entrante de ${phone}: "${text.substring(0, 50)}"`);

          try {
            await this.botService.handleMessage(phone, text, waMessageId);
          } catch (err) {
            console.error(`[WebhookService] Error en bot para ${phone}:`, err);
          }
        }
      }
    }
  }
}
