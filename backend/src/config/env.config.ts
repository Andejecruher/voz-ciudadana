import { config } from 'dotenv';
import { z } from 'zod';

config();

const requiredString = (name: string) =>
  z
    .string({ message: `${name} is required` })
    .trim()
    .min(1, `${name} cannot be empty`);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  CORS_ORIGIN: z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z.string().trim().default('*'),
  ),

  DATABASE_URL: requiredString('DATABASE_URL'),
  REDIS_URL: requiredString('REDIS_URL'),

  JWT_SECRET: requiredString('JWT_SECRET'),
  JWT_REFRESH_SECRET: z
    .string()
    .trim()
    .optional()
    .transform((v) => v ?? ''),
  JWT_ACCESS_EXPIRES_IN: z.string().trim().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().trim().default('7d'),

  // ── Rate limiting / Lockout ────────────────────────────────────────────────
  /**
   * Cantidad máxima de requests a /auth/login por IP en la ventana configurada.
   * Default: 10 intentos cada 15 minutos.
   */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(900), // 15 min

  /**
   * Rate limit para /auth/refresh por IP.
   * Más agresivo que login para detectar refresh flooding.
   * Default: 60 intentos cada 5 minutos.
   */
  AUTH_REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(60),
  AUTH_REFRESH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(300), // 5 min

  /**
   * Lockout progresivo por identidad (email normalizado).
   * Máximo de intentos fallidos antes del primer lockout.
   */
  AUTH_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  /**
   * Duración de lockouts progresivos en segundos, separados por coma.
   * Nivel 1: 60s, Nivel 2: 300s, Nivel 3: 900s, Nivel 4+: 3600s
   */
  AUTH_LOCKOUT_DURATIONS: z.string().trim().default('60,300,900,3600'),

  // ── Multi-sesión (refresh token por dispositivo) ───────────────────────────
  /**
   * Número máximo de sesiones simultáneas por usuario (dispositivos).
   * Al superar el límite se invalida la sesión más antigua.
   * Default: 5.
   */
  AUTH_MAX_SESSIONS_PER_USER: z.coerce.number().int().min(1).default(5),

  SUPERADMIN_EMAIL: z.string().email().optional(),
  SUPERADMIN_PASSWORD: z.string().min(8).optional(),
  SUPERADMIN_FULL_NAME: z.string().trim().optional(),

  WHATSAPP_VERIFY_TOKEN: requiredString('WHATSAPP_VERIFY_TOKEN'),
  WHATSAPP_APP_ID: requiredString('WHATSAPP_APP_ID'),
  WHATSAPP_APP_SECRET: requiredString('WHATSAPP_APP_SECRET'),
  WHATSAPP_ACCESS_TOKEN: requiredString('WHATSAPP_ACCESS_TOKEN'),
  WHATSAPP_PHONE_NUMBER_ID: requiredString('WHATSAPP_PHONE_NUMBER_ID'),
  WHATSAPP_BUSINESS_ACCOUNT_ID: requiredString('WHATSAPP_BUSINESS_ACCOUNT_ID'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => {
      const key = issue.path.join('.') || 'ENV';
      return `- ${key}: ${issue.message}`;
    })
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsedEnv.data;
export type AppEnv = z.infer<typeof envSchema>;
