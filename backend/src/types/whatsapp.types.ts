/**
 * Tipos discriminados completos para Meta WhatsApp Cloud API.
 * Inbound (webhook) y outbound (envío de mensajes).
 *
 * Referencia: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */

// ─── Inbound: tipos de mensajes recibidos ─────────────────────────────────────

export interface WaTextContent {
  body: string;
  preview_url?: boolean;
}

export interface WaMediaContent {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  filename?: string; // solo document
}

export interface WaLocationContent {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WaContactPhone {
  phone: string;
  type?: string;
  wa_id?: string;
}

export interface WaContactName {
  formatted_name: string;
  first_name?: string;
  last_name?: string;
}

export interface WaContact {
  name: WaContactName;
  phones?: WaContactPhone[];
}

export interface WaReactionContent {
  message_id: string;
  emoji: string;
}

export interface WaInteractiveReply {
  type: 'button_reply' | 'list_reply';
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

export interface WaStickerContent {
  id: string;
  mime_type?: string;
  sha256?: string;
  animated?: boolean;
}

// Discriminated union para mensajes inbound
export type WaInboundMessage =
  | { type: 'text'; id: string; from: string; timestamp: string; text: WaTextContent }
  | { type: 'image'; id: string; from: string; timestamp: string; image: WaMediaContent }
  | { type: 'video'; id: string; from: string; timestamp: string; video: WaMediaContent }
  | { type: 'audio'; id: string; from: string; timestamp: string; audio: WaMediaContent }
  | { type: 'document'; id: string; from: string; timestamp: string; document: WaMediaContent }
  | { type: 'sticker'; id: string; from: string; timestamp: string; sticker: WaStickerContent }
  | { type: 'location'; id: string; from: string; timestamp: string; location: WaLocationContent }
  | { type: 'contacts'; id: string; from: string; timestamp: string; contacts: WaContact[] }
  | { type: 'reaction'; id: string; from: string; timestamp: string; reaction: WaReactionContent }
  | { type: 'interactive'; id: string; from: string; timestamp: string; interactive: WaInteractiveReply }
  | { type: 'unsupported'; id: string; from: string; timestamp: string };

// ─── Inbound: status de mensajes outbound (delivery receipts) ─────────────────

export interface WaStatusError {
  code: number;
  title: string;
  message?: string;
  error_data?: { details: string };
}

export interface WaStatus {
  id: string;           // wamid del mensaje original
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin?: { type: string };
  };
  errors?: WaStatusError[];
}

// ─── Inbound: estructura del webhook completo ─────────────────────────────────

export interface WaWebhookValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{ wa_id: string; profile: { name: string } }>;
  messages?: WaInboundMessage[];
  statuses?: WaStatus[];
  errors?: WaStatusError[];
}

export interface WaWebhookChange {
  value: WaWebhookValue;
  field: string;
}

export interface WaWebhookEntry {
  id: string;
  changes: WaWebhookChange[];
}

export interface WaWebhookPayload {
  object: string;
  entry: WaWebhookEntry[];
}

// ─── Outbound: payloads de envío a Meta API ───────────────────────────────────

export interface WaOutboundBase {
  messaging_product: 'whatsapp';
  recipient_type?: 'individual';
  to: string;
}

export interface WaTextOutbound extends WaOutboundBase {
  type: 'text';
  text: { body: string; preview_url?: boolean };
}

export interface WaMediaOutbound extends WaOutboundBase {
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  image?: { id?: string; link?: string; caption?: string };
  video?: { id?: string; link?: string; caption?: string };
  audio?: { id?: string; link?: string };
  document?: { id?: string; link?: string; caption?: string; filename?: string };
  sticker?: { id?: string; link?: string };
}

export interface WaLocationOutbound extends WaOutboundBase {
  type: 'location';
  location: { latitude: number; longitude: number; name?: string; address?: string };
}

export interface WaContactsOutbound extends WaOutboundBase {
  type: 'contacts';
  contacts: WaContact[];
}

export interface WaReactionOutbound extends WaOutboundBase {
  type: 'reaction';
  reaction: { message_id: string; emoji: string };
}

export interface WaReadReceipt {
  messaging_product: 'whatsapp';
  status: 'read';
  message_id: string;
}

// Interactive types
export interface WaButtonAction {
  buttons: Array<{ type: 'reply'; reply: { id: string; title: string } }>;
}

export interface WaListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WaListSection {
  title?: string;
  rows: WaListRow[];
}

export interface WaListAction {
  button: string;
  sections: WaListSection[];
}

export interface WaInteractiveBody {
  text: string;
}

export interface WaInteractiveHeader {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  image?: { id?: string; link?: string };
  video?: { id?: string; link?: string };
  document?: { id?: string; link?: string; filename?: string };
}

export interface WaInteractiveFooter {
  text: string;
}

export type WaInteractiveOutbound = WaOutboundBase & {
  type: 'interactive';
  interactive:
    | {
        type: 'button';
        header?: WaInteractiveHeader;
        body: WaInteractiveBody;
        footer?: WaInteractiveFooter;
        action: WaButtonAction;
      }
    | {
        type: 'list';
        header?: WaInteractiveHeader;
        body: WaInteractiveBody;
        footer?: WaInteractiveFooter;
        action: WaListAction;
      }
    | {
        type: 'cta_url';
        body: WaInteractiveBody;
        footer?: WaInteractiveFooter;
        action: { name: 'cta_url'; parameters: { display_text: string; url: string } };
      }
    | {
        type: 'location_request_message';
        body: WaInteractiveBody;
        action: { name: 'send_location' };
      }
    | {
        type: 'flow';
        body: WaInteractiveBody;
        footer?: WaInteractiveFooter;
        action: {
          name: 'flow';
          parameters: {
            flow_message_version: '3';
            flow_token: string;
            flow_id: string;
            flow_cta: string;
            flow_action: 'navigate' | 'data_exchange';
            flow_action_payload?: unknown;
          };
        };
      };
};

// Template types
export type WaTemplateComponentType = 'header' | 'body' | 'button';
export type WaTemplateParameterType = 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';

export interface WaTemplateParameter {
  type: WaTemplateParameterType;
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { id?: string; link?: string };
  document?: { id?: string; link?: string; filename?: string };
  video?: { id?: string; link?: string };
}

export interface WaTemplateComponent {
  type: WaTemplateComponentType;
  sub_type?: 'quick_reply' | 'url';
  index?: number;
  parameters?: WaTemplateParameter[];
}

export interface WaTemplateOutbound extends WaOutboundBase {
  type: 'template';
  template: {
    name: string;
    language: { code: string; policy?: 'deterministic' };
    components?: WaTemplateComponent[];
  };
}

// Union de todos los tipos outbound
export type WaOutboundMessage =
  | WaTextOutbound
  | WaMediaOutbound
  | WaLocationOutbound
  | WaContactsOutbound
  | WaReactionOutbound
  | WaInteractiveOutbound
  | WaTemplateOutbound;

// ─── Respuesta de la API de Meta al enviar mensajes ───────────────────────────

export interface WaSendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface WaMediaUploadResponse {
  id: string;
}

// ─── Error response de Meta API ───────────────────────────────────────────────

export interface WaApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    error_data?: { messaging_product: string; details: string };
    fbtrace_id?: string;
  };
}

// ─── Tipos de flujo de conversación (state machine) ──────────────────────────

export type ConversationFlowState =
  | 'BOT_FLOW'
  | 'REGISTERING'
  | 'DEPARTMENT_ROUTING'
  | 'HUMAN_FLOW'
  | 'ESCALATED'
  | 'CLOSED';

export interface ConversationContext {
  conversationId: string;
  citizenPhone: string;
  citizenId: string;
  flowState: ConversationFlowState;
  departmentSlug?: string;
  assignedUserId?: string;
  version: number;
}
