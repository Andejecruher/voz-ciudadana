/**
 * Carga variables de entorno desde .env usando dotenv.
 * Expone una función getEnv() para acceder de forma type-safe a las vars requeridas.
 */
import * as dotenv from 'dotenv';
dotenv.config();

export interface AppEnv {
  /** Puerto HTTP del servidor */
  PORT: number;
  /** Entorno de ejecución (development, production, etc.) */
  NODE_ENV: string;

  // ── WhatsApp Cloud API ────────────────────────────────────────────────────────
  /** Token de verificación del webhook (lo define el operador) */
  WHATSAPP_VERIFY_TOKEN: string;
  /** App ID de Meta para validar firma HMAC X-Hub-Signature-256 */
  WHATSAPP_APP_ID: string;
  /** App Secret para validar firma HMAC X-Hub-Signature-256 */
  WHATSAPP_APP_SECRET: string;
  /** Access token del sistema para la Graph API de Meta */
  WHATSAPP_ACCESS_TOKEN: string;
  /** Phone Number ID de Meta para enviar mensajes */
  WHATSAPP_PHONE_NUMBER_ID: string;
  /** Whatsapp Bussines ID */
  WHATSAPP_BUSINESS_ACCOUNT_ID: string;

  // ── Base de datos ─────────────────────────────────────────────────────────────
  /** URL de conexión de Prisma (PostgreSQL) */
  DATABASE_URL: string;

  // ── Redis ─────────────────────────────────────────────────────────────────────
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
}

/**
 * Retorna el valor de una variable de entorno.
 * Lanza error si la variable no existe y es requerida.
 */
export function getEnv(key: keyof AppEnv, required = true): string {
  const value = process.env[key as string];
  if (!value && required) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ?? '';
}

/**
 * Retorna el PORT configurado, con fallback a 8000.
 */
export function getPort(): number {
  return parseInt(process.env['PORT'] ?? '8000', 10);
}
