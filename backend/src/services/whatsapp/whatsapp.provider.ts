/**
 * WhatsApp Provider — Cliente HTTP para Meta WhatsApp Business Cloud API.
 *
 * Implementa todos los tipos de mensajes outbound con:
 * - Rate limiting
 * - Error mapping
 * - Template fallback cuando estamos fuera de la ventana 24h
 * - App Secret Proof
 */
import { QUEUE_CONFIG, REDIS_KEYS } from '../../config/messaging.constants';
import { metaConfig } from '../../config/meta.config';
import {
  WaContact,
  WaContactsOutbound,
  WaInteractiveOutbound,
  WaLocationOutbound,
  WaMediaOutbound,
  WaMediaUploadResponse,
  WaOutboundMessage,
  WaReactionOutbound,
  WaReadReceipt,
  WaSendMessageResponse,
  WaTemplateOutbound,
  WaTextOutbound,
} from '../../types/whatsapp.types';
import { generateAppSecretProof } from '../../utils/hmac-validator';
import {
  isMetaErrorResponse,
  isOutsideConversationWindow,
  parseMetaError,
} from '../../utils/meta-error-parser';
import { RedisService } from '../redis.service';
import { maskPhone } from '../bot.service';

function log(
  level: 'info' | 'warn' | 'error' | 'debug',
  event: string,
  data?: Record<string, unknown>,
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'WhatsAppProvider',
    event,
    ...data,
  };
  // eslint-disable-next-line no-console
  console[level](JSON.stringify(entry));
}

export class WhatsAppProvider {
  private readonly baseUrl = metaConfig.messagesUrl;
  private readonly headers: Record<string, string>;
  private readonly appSecretProof: string;

  constructor(private readonly redis: RedisService) {
    this.appSecretProof = generateAppSecretProof(metaConfig.accessToken, metaConfig.appSecret);
    this.headers = {
      Authorization: `Bearer ${metaConfig.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  // ─── Rate limiter helper ───────────────────────────────────────────────────

  private async checkRateLimit(phone: string): Promise<void> {
    const key = REDIS_KEYS.RATE_LIMIT_OUTBOUND(phone);
    const count = await this.redis.incr(key, 1); // TTL de 1 segundo
    if (count > QUEUE_CONFIG.OUTBOUND_RATE_PER_SECOND) {
      throw new Error(`Rate limit exceeded for phone ${phone}: ${count} msgs/s`);
    }
  }

  // ─── HTTP helper ──────────────────────────────────────────────────────────

  /**
   * Método público para enviar un payload ya construido directamente a la API de Meta.
   * Útil para OutboxProcessor que tiene el WaOutboundMessage completo persistido.
   */
  async send(payload: WaOutboundMessage): Promise<WaSendMessageResponse> {
    return this.post(payload);
  }

  private async post(payload: WaOutboundMessage | WaReadReceipt): Promise<WaSendMessageResponse> {
    const url = `${this.baseUrl}?appsecret_proof=${this.appSecretProof}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), metaConfig.httpTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body: unknown = await response.json();

      if (!response.ok) {
        if (isMetaErrorResponse(body)) {
          throw parseMetaError(body);
        }
        throw new Error(`Meta API error: ${response.status}`);
      }

      return body as WaSendMessageResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Mensajes de texto ────────────────────────────────────────────────────

  async sendText(to: string, body: string, previewUrl = false): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaTextOutbound = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body, preview_url: previewUrl },
    };
    return this.post(payload);
  }

  // ─── Mensajes de media ────────────────────────────────────────────────────

  async sendImage(
    to: string,
    opts: { id?: string; link?: string; caption?: string },
  ): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaMediaOutbound = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: opts,
    };
    return this.post(payload);
  }

  async sendVideo(
    to: string,
    opts: { id?: string; link?: string; caption?: string },
  ): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaMediaOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'video',
      video: opts,
    };
    return this.post(payload);
  }

  async sendAudio(
    to: string,
    opts: { id?: string; link?: string },
  ): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaMediaOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'audio',
      audio: opts,
    };
    return this.post(payload);
  }

  async sendDocument(
    to: string,
    opts: { id?: string; link?: string; caption?: string; filename?: string },
  ): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaMediaOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: opts,
    };
    return this.post(payload);
  }

  async sendSticker(
    to: string,
    opts: { id?: string; link?: string },
  ): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaMediaOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'sticker',
      sticker: opts,
    };
    return this.post(payload);
  }

  // ─── Location ─────────────────────────────────────────────────────────────

  async sendLocation(
    to: string,
    lat: number,
    lon: number,
    name?: string,
    address?: string,
  ): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaLocationOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'location',
      location: { latitude: lat, longitude: lon, name, address },
    };
    return this.post(payload);
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────

  async sendContact(to: string, contacts: WaContact[]): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaContactsOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'contacts',
      contacts,
    };
    return this.post(payload);
  }

  // ─── Reaction ─────────────────────────────────────────────────────────────

  async sendReaction(to: string, messageId: string, emoji: string): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaReactionOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'reaction',
      reaction: { message_id: messageId, emoji },
    };
    return this.post(payload);
  }

  // ─── Interactive ──────────────────────────────────────────────────────────

  async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    opts?: { header?: string; footer?: string },
  ): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaInteractiveOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(opts?.header ? { header: { type: 'text', text: opts.header } } : {}),
        body: { text: bodyText },
        ...(opts?.footer ? { footer: { text: opts.footer } } : {}),
        action: {
          buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
        },
      },
    };
    return this.post(payload);
  }

  async sendInteractiveList(
    to: string,
    bodyText: string,
    buttonLabel: string,
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    opts?: { header?: string; footer?: string },
  ): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaInteractiveOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        ...(opts?.header ? { header: { type: 'text', text: opts.header } } : {}),
        body: { text: bodyText },
        ...(opts?.footer ? { footer: { text: opts.footer } } : {}),
        action: { button: buttonLabel, sections },
      },
    };
    return this.post(payload);
  }

  async sendInteractiveFlow(
    to: string,
    bodyText: string,
    flowId: string,
    flowToken: string,
    flowCta: string,
    opts?: { footer?: string },
  ): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaInteractiveOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: bodyText },
        ...(opts?.footer ? { footer: { text: opts.footer } } : {}),
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: flowToken,
            flow_id: flowId,
            flow_cta: flowCta,
            flow_action: 'navigate',
          },
        },
      },
    };
    return this.post(payload);
  }

  async sendLocationRequest(to: string, bodyText: string): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaInteractiveOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { text: bodyText },
        action: { name: 'send_location' },
      },
    };
    return this.post(payload);
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components?: WaTemplateOutbound['template']['components'],
  ): Promise<WaSendMessageResponse> {
    await this.checkRateLimit(to);
    const payload: WaTemplateOutbound = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };
    return this.post(payload);
  }

  /**
   * Intenta enviar texto; si falla con error 131047 (fuera de ventana 24h),
   * usa template como fallback.
   */
  async sendTextWithTemplateFallback(
    to: string,
    body: string,
    fallbackTemplate: { name: string; languageCode: string },
  ): Promise<WaSendMessageResponse> {
    try {
      return await this.sendText(to, body);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err) {
        const code = (err as { code: number }).code;
        if (isOutsideConversationWindow(code)) {
          log('warn', 'whatsapp.outside_window', { to: maskPhone(to) });
          return this.sendTemplate(to, fallbackTemplate.name, fallbackTemplate.languageCode);
        }
      }
      throw err;
    }
  }

  // ─── Mark as Read ─────────────────────────────────────────────────────────

  async markAsRead(messageId: string): Promise<WaSendMessageResponse> {
    const payload: WaReadReceipt = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };
    return this.post(payload);
  }

  // ─── Media ────────────────────────────────────────────────────────────────

  async uploadMedia(
    fileBuffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<WaMediaUploadResponse> {
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', new Blob([fileBuffer], { type: mimeType }), filename);

    const url = `${metaConfig.mediaUrl}?appsecret_proof=${this.appSecretProof}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${metaConfig.accessToken}` },
      body: formData,
    });

    const body: unknown = await response.json();
    if (!response.ok) {
      if (isMetaErrorResponse(body)) throw parseMetaError(body);
      throw new Error(`Media upload failed: ${response.status}`);
    }

    return body as WaMediaUploadResponse;
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    // Primero obtener la URL de descarga
    const urlResponse = await fetch(
      `https://graph.facebook.com/v20.0/${mediaId}?appsecret_proof=${this.appSecretProof}`,
      { headers: this.headers },
    );

    const urlData = (await urlResponse.json()) as { url: string };
    if (!urlData.url) throw new Error(`No URL for media ${mediaId}`);

    // Descargar el contenido
    const mediaResponse = await fetch(urlData.url, { headers: this.headers });
    if (!mediaResponse.ok) throw new Error(`Media download failed: ${mediaResponse.status}`);

    const arrayBuffer = await mediaResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
