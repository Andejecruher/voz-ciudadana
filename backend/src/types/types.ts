/**
 * Tipos posibles de estado FSM del bot de registro ciudadano.
 * Se persisten en Redis bajo bot:state:{phone}
 */
export enum BotFsmState {
  /** Estado inicial — ciudadano nuevo o sin estado en Redis */
  START = 'START',
  /** Esperando que el ciudadano ingrese su nombre completo */
  AWAITING_NAME = 'AWAITING_NAME',
  /** Esperando que el ciudadano elija su colonia */
  AWAITING_COLONY = 'AWAITING_COLONY',
  /** Esperando que el ciudadano seleccione sus intereses */
  AWAITING_INTERESTS = 'AWAITING_INTERESTS',
  /** Registro completo — flujo de conversación normal */
  COMPLETE = 'COMPLETE',
}

/**
 * Contexto serializado en Redis junto al estado.
 * Permite persistir datos parciales durante el flujo de registro.
 */
export interface BotSessionData {
  state: BotFsmState;
  name?: string;
  lastName?: string;
  neighborhoodId?: string;
  interests?: string[];
}

/**
 * Tipos mínimos para los payloads entrantes de la API de WhatsApp Cloud.
 * Solo se mapean los campos necesarios — el resto se ignora defensivamente.
 */
export interface WhatsAppTextMessage {
  id: string; // waMessageId
  from: string; // número del remitente en formato E.164 sin "+"
  timestamp: string;
  type: string; // 'text' | 'image' | 'audio' | etc.
  text?: {
    body: string;
  };
}

export interface WhatsAppValue {
  messaging_product: string;
  metadata?: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{ wa_id: string; profile: { name: string } }>;
  messages?: WhatsAppTextMessage[];
  statuses?: unknown[];
}

export interface WhatsAppChange {
  value: WhatsAppValue;
  field: string;
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppEntry[];
}
