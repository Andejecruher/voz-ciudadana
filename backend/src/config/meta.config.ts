/**
 * Configuración específica de Meta WhatsApp Business Cloud API.
 * Lee valores del env ya validado en env.config.ts.
 */
import { env } from './env.config';

export const META_API_VERSION = 'v20.0';
export const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export const metaConfig = {
  appId: env.WHATSAPP_APP_ID,
  appSecret: env.WHATSAPP_APP_SECRET,
  accessToken: env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
  businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  verifyToken: env.WHATSAPP_VERIFY_TOKEN,

  /** URL base para envío de mensajes */
  messagesUrl: `${META_GRAPH_BASE_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,

  /** URL base para subir media */
  mediaUrl: `${META_GRAPH_BASE_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/media`,

  /** Timeout HTTP para llamadas a Meta API (ms) */
  httpTimeoutMs: 10_000,

  /** Tiempo de vida de la ventana de conversación activa (24h en segundos) */
  conversationWindowSeconds: 86_400,
} as const;

export type MetaConfig = typeof metaConfig;
