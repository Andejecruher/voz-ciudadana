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
  REDIS_HOST: z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z.string().trim().default('localhost'),
  ),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z.string().trim().optional(),
  ),

  JWT_SECRET: requiredString('JWT_SECRET'),
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
