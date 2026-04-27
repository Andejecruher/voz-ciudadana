/**
 * Parser de payloads de webhook de Meta WhatsApp.
 * Extrae y normaliza mensajes, statuses y contactos del payload crudo.
 */
import { WaInboundMessage, WaStatus, WaWebhookPayload } from '../types/whatsapp.types';

export interface ParsedWebhookMessage {
  wamid: string;
  phone: string; // número del remitente normalizado
  timestamp: string;
  profileName?: string;
  phoneNumberId: string;
  message: WaInboundMessage;
}

export interface ParsedWebhookStatus {
  wamid: string;
  recipientPhone: string;
  status: WaStatus['status'];
  timestamp: string;
  errorCode?: number;
  errorTitle?: string;
}

export interface ParsedWebhookResult {
  messages: ParsedWebhookMessage[];
  statuses: ParsedWebhookStatus[];
  phoneNumberId: string;
  businessAccountId: string;
}

/**
 * Parsea un payload completo del webhook de Meta.
 * Retorna mensajes y statuses separados.
 */
export function parseWebhookPayload(payload: WaWebhookPayload): ParsedWebhookResult {
  const messages: ParsedWebhookMessage[] = [];
  const statuses: ParsedWebhookStatus[] = [];
  let phoneNumberId = '';
  const businessAccountId = payload.entry[0]?.id ?? '';

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      phoneNumberId = value.metadata?.phone_number_id ?? '';

      // Procesar mensajes inbound
      for (const msg of value.messages ?? []) {
        const profileName = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;

        messages.push({
          wamid: msg.id,
          phone: msg.from,
          timestamp: msg.timestamp,
          profileName,
          phoneNumberId,
          message: msg,
        });
      }

      // Procesar delivery statuses
      for (const status of value.statuses ?? []) {
        statuses.push({
          wamid: status.id,
          recipientPhone: status.recipient_id,
          status: status.status,
          timestamp: status.timestamp,
          errorCode: status.errors?.[0]?.code,
          errorTitle: status.errors?.[0]?.title,
        });
      }
    }
  }

  return { messages, statuses, phoneNumberId, businessAccountId };
}

/**
 * Extrae el texto de un mensaje inbound (si aplica).
 */
export function extractMessageText(msg: WaInboundMessage): string | undefined {
  switch (msg.type) {
    case 'text':
      return msg.text.body;
    case 'interactive':
      return msg.interactive.button_reply?.title ?? msg.interactive.list_reply?.title;
    default:
      return undefined;
  }
}

/**
 * Sanitiza el contenido de un mensaje para logs (elimina PII).
 */
export function sanitizeForLog(msg: WaInboundMessage): Record<string, unknown> {
  return {
    type: msg.type,
    id: msg.id,
    from: `${msg.from.slice(0, 5)}****`,
    timestamp: msg.timestamp,
  };
}
