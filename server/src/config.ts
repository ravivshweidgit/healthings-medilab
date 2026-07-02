import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SMTP_MODE: z.enum(['console', 'smtp']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Healthings <noreply@healthings.ai>'),
  CORS_ORIGINS: z.string().default('*'),
  /** Starter AI credit per account ($ pack mapped to tokens — see TOKEN_PACK_SIZE). */
  INITIAL_TOKEN_GRANT: z.coerce.number().default(100),
  TOKEN_PACK_SIZE: z.coerce.number().default(100),
  AI_TOKENS_PER_MEAL: z.coerce.number().default(1),
  AI_TOKENS_PER_CHAT_TURN: z.coerce.number().default(1),
  /** Default sponsorship length when mentor omits expiresAt (days). */
  SPONSORSHIP_DEFAULT_DAYS: z.coerce.number().default(90),
  TOKEN_PACK_PRICE_CENTS: z.coerce.number().default(500),
  STRIPE_CURRENCY: z.string().default('usd'),
  STRIPE_SECRET_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  /** When true and Stripe absent: simulate card charge + grant pack on auto-reload. */
  AUTO_RELOAD_SIMULATE: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()),
  isDev: parsed.data.NODE_ENV === 'development',
};

export const OTP = {
  length: 6,
  ttlMinutes: 10,
  maxAttempts: 5,
  requestWindowMinutes: 15,
  maxRequestsPerWindow: 3,
} as const;

export const JWT = {
  accessTtlSeconds: 15 * 60,
  refreshTtlDays: 30,
} as const;
