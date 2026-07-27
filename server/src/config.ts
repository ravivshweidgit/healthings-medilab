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
  /** Stripe webhook signing secret (`whsec_…`). Required for live webhook verify. */
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /**
   * Public website origin for Stripe Checkout return URLs
   * (e.g. https://healthings.ai → /clinic/?billing=…).
   */
  PUBLIC_WEB_BASE_URL: z.string().default('https://healthings.ai'),
  /**
   * Max negative balance (tokens) while card is failing — ~1 pack.
   * Empty/unset → TOKEN_PACK_SIZE.
   */
  BILLING_GRACE_TOKENS: z.coerce.number().int().positive().optional(),
  /** Comma-separated day offsets from first failure for card retries (be-34). */
  BILLING_RETRY_SCHEDULE_DAYS: z.string().default('1,3,5'),
  GEMINI_API_KEY: z.string().optional(),
  /** When true and Stripe absent: simulate card charge + grant pack on auto-reload. */
  AUTO_RELOAD_SIMULATE: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  /**
   * Master card-billing switch. Off (alpha): the full billing pipeline runs —
   * packs, ledger, invoices — but every invoice is issued at 0 charged and no
   * PSP is contacted. On: same flow charges the saved card via the PSP.
   */
  BILLING_LIVE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const retryScheduleDays = parsed.data.BILLING_RETRY_SCHEDULE_DAYS.split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n >= 0);

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()),
  isDev: parsed.data.NODE_ENV === 'development',
  BILLING_GRACE_TOKENS: parsed.data.BILLING_GRACE_TOKENS ?? parsed.data.TOKEN_PACK_SIZE,
  BILLING_RETRY_SCHEDULE_DAYS: retryScheduleDays.length ? retryScheduleDays : [1, 3, 5],
};

export const OTP = {
  length: 6,
  ttlMinutes: 10,
  maxAttempts: 5,
  requestWindowMinutes: 15,
  maxRequestsPerWindow: 50,
} as const;

export const JWT = {
  accessTtlSeconds: 15 * 60,
  refreshTtlDays: 30,
} as const;
