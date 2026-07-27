import { createHmac, timingSafeEqual } from 'node:crypto';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { createInvoice } from './invoices.js';
import { findUserById } from './users.js';
import { sendBillingDunningEmail, sendBillingRecoveredEmail } from './email.js';

export type PaymentMethodView = {
  onFile: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
};

export type WalletBillingState = {
  delinquentSince: string | null;
  chargeAttempts: number;
  coveragePaused: boolean;
  nextRetryAt: string | null;
};

type PaymentMethodRow = {
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  card_last4: string | null;
  card_brand: string | null;
};

type WalletBillingRow = {
  delinquent_since: Date | null;
  charge_attempts: number;
  coverage_paused: boolean;
  next_retry_at: Date | null;
};

async function stripeForm(
  path: string,
  params: URLSearchParams,
  opts?: { idempotencyKey?: string },
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  if (!config.STRIPE_SECRET_KEY) {
    return { ok: false, status: 0, json: {} };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (opts?.idempotencyKey) {
    headers['Idempotency-Key'] = opts.idempotencyKey.slice(0, 255);
  }
  try {
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      method: 'POST',
      headers,
      body: params.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: {} };
  }
}

export async function getPaymentMethod(userId: string): Promise<PaymentMethodView> {
  const { rows } = await query<PaymentMethodRow>(
    `SELECT stripe_customer_id, stripe_payment_method_id, card_last4, card_brand
     FROM payment_methods WHERE user_id = $1`,
    [userId],
  );
  const row = rows[0];
  const onFile = Boolean(row?.stripe_payment_method_id);
  return {
    onFile,
    cardBrand: row?.card_brand ?? null,
    cardLast4: row?.card_last4 ?? null,
  };
}

export async function getWalletBillingState(userId: string): Promise<WalletBillingState> {
  const { rows } = await query<WalletBillingRow>(
    `SELECT delinquent_since, charge_attempts, coverage_paused, next_retry_at
     FROM wallets WHERE user_id = $1`,
    [userId],
  );
  const row = rows[0];
  return {
    delinquentSince: row?.delinquent_since?.toISOString() ?? null,
    chargeAttempts: row?.charge_attempts ?? 0,
    coveragePaused: row?.coverage_paused ?? false,
    nextRetryAt: row?.next_retry_at?.toISOString() ?? null,
  };
}

export async function isCoveragePaused(userId: string): Promise<boolean> {
  if (!config.BILLING_LIVE) return false;
  const { rows } = await query<{ coverage_paused: boolean }>(
    `SELECT coverage_paused FROM wallets WHERE user_id = $1`,
    [userId],
  );
  return Boolean(rows[0]?.coverage_paused);
}

/** Alpha / test: mark a default card on file (Stripe Checkout replaces this). */
export async function attachSimulatedPaymentMethod(userId: string): Promise<PaymentMethodView> {
  await query(
    `INSERT INTO payment_methods (user_id, stripe_customer_id, stripe_payment_method_id, card_last4, card_brand, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_payment_method_id = EXCLUDED.stripe_payment_method_id,
       card_last4 = EXCLUDED.card_last4,
       card_brand = EXCLUDED.card_brand,
       updated_at = NOW()`,
    [userId, `cus_sim_${userId.slice(0, 8)}`, `pm_sim_${userId.slice(0, 8)}`, '4242', 'visa'],
  );
  return getPaymentMethod(userId);
}

async function ensureStripeCustomer(userId: string, email: string): Promise<string | null> {
  const { rows } = await query<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM payment_methods WHERE user_id = $1`,
    [userId],
  );
  const existing = rows[0]?.stripe_customer_id;
  if (existing && !existing.startsWith('cus_sim_')) return existing;

  const params = new URLSearchParams({
    email,
    'metadata[healthings_user_id]': userId,
  });
  const res = await stripeForm('/customers', params);
  const id = typeof res.json.id === 'string' ? res.json.id : null;
  if (!res.ok || !id) return null;

  await query(
    `INSERT INTO payment_methods (user_id, stripe_customer_id, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       updated_at = NOW()`,
    [userId, id],
  );
  return id;
}

/**
 * Stripe Checkout in setup mode — saves a card for off-session auto-reload.
 * Returns null when Stripe is not configured (alpha dark path).
 */
export async function createCheckoutSession(userId: string): Promise<{ url: string } | null> {
  if (!config.STRIPE_SECRET_KEY) return null;
  const user = await findUserById(userId);
  if (!user) return null;

  const customerId = await ensureStripeCustomer(userId, user.email);
  if (!customerId) return null;

  const base = config.PUBLIC_WEB_BASE_URL.replace(/\/$/, '');
  const params = new URLSearchParams({
    mode: 'setup',
    customer: customerId,
    'payment_method_types[0]': 'card',
    success_url: `${base}/clinic/?billing=card_ok`,
    cancel_url: `${base}/clinic/?billing=card_cancel`,
    'metadata[healthings_user_id]': userId,
  });

  const res = await stripeForm('/checkout/sessions', params, {
    idempotencyKey: `checkout_setup_${userId}_${Math.floor(Date.now() / 60_000)}`,
  });
  const url = typeof res.json.url === 'string' ? res.json.url : null;
  if (!res.ok || !url) return null;
  return { url };
}

async function persistStripePaymentMethod(params: {
  userId: string;
  customerId: string;
  paymentMethodId: string;
  brand?: string | null;
  last4?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO payment_methods
       (user_id, stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_payment_method_id = EXCLUDED.stripe_payment_method_id,
       card_brand = EXCLUDED.card_brand,
       card_last4 = EXCLUDED.card_last4,
       updated_at = NOW()`,
    [
      params.userId,
      params.customerId,
      params.paymentMethodId,
      params.brand ?? null,
      params.last4 ?? null,
    ],
  );
}

function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(',').map((p) => p.trim());
  let timestamp = '';
  const signatures: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v ?? '';
    if (k === 'v1' && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 300) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  return signatures.some((sig) => {
    const got = Buffer.from(sig, 'utf8');
    return got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf);
  });
}

async function handleCheckoutSessionCompleted(session: Record<string, unknown>): Promise<void> {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  const userId = meta.healthings_user_id;
  if (!userId) return;

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : typeof (session.customer as { id?: string } | null)?.id === 'string'
        ? (session.customer as { id: string }).id
        : null;

  let setupIntentId =
    typeof session.setup_intent === 'string'
      ? session.setup_intent
      : typeof (session.setup_intent as { id?: string } | null)?.id === 'string'
        ? (session.setup_intent as { id: string }).id
        : null;

  if (!setupIntentId || !customerId || !config.STRIPE_SECRET_KEY) return;

  const res = await fetch(`https://api.stripe.com/v1/setup_intents/${setupIntentId}`, {
    headers: { Authorization: `Bearer ${config.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return;
  const intent = (await res.json()) as {
    payment_method?: string | { id?: string };
  };
  const pmId =
    typeof intent.payment_method === 'string'
      ? intent.payment_method
      : intent.payment_method?.id ?? null;
  if (!pmId) return;

  let brand: string | null = null;
  let last4: string | null = null;
  const pmRes = await fetch(`https://api.stripe.com/v1/payment_methods/${pmId}`, {
    headers: { Authorization: `Bearer ${config.STRIPE_SECRET_KEY}` },
  });
  if (pmRes.ok) {
    const pm = (await pmRes.json()) as { card?: { brand?: string; last4?: string } };
    brand = pm.card?.brand ?? null;
    last4 = pm.card?.last4 ?? null;
  }

  await persistStripePaymentMethod({
    userId,
    customerId,
    paymentMethodId: pmId,
    brand,
    last4,
  });
}

/**
 * Stripe webhook handler. Returns false when signature is invalid.
 * Attaches raw body string (not parsed JSON) for HMAC verify.
 */
export async function handleStripeWebhook(
  rawBody: string,
  signatureHeader: string | undefined,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!config.STRIPE_WEBHOOK_SECRET) {
    return { ok: false, status: 503, error: 'Webhook secret not configured' };
  }
  if (!signatureHeader || !verifyStripeSignature(rawBody, signatureHeader, config.STRIPE_WEBHOOK_SECRET)) {
    return { ok: false, status: 400, error: 'Invalid signature' };
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' };
  }

  const type = event.type ?? '';
  const obj = event.data?.object ?? {};

  // Card-save only. Failed auto-reload charges are recorded in autoReloadTokenPack
  // (avoid double-counting attempts if Stripe also sends payment_intent.payment_failed).
  if (type === 'checkout.session.completed') {
    await handleCheckoutSessionCompleted(obj);
  }

  return { ok: true };
}

function nextRetryAtFrom(delinquentSince: Date, attemptsAfterThisFailure: number): Date | null {
  const schedule = config.BILLING_RETRY_SCHEDULE_DAYS;
  const idx = attemptsAfterThisFailure - 1;
  if (idx < 0 || idx >= schedule.length) return null;
  const days = schedule[idx]!;
  const next = new Date(delinquentSince.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function recordFailedCharge(payerUserId: string, _intentId: string | null): Promise<void> {
  await ensureWalletRow(payerUserId);
  const { rows } = await query<WalletBillingRow>(
    `SELECT delinquent_since, charge_attempts, coverage_paused, next_retry_at
     FROM wallets WHERE user_id = $1`,
    [payerUserId],
  );
  const row = rows[0];
  const wasDelinquent = Boolean(row?.delinquent_since);
  const delinquentSince = row?.delinquent_since ?? new Date();
  const attempts = (row?.charge_attempts ?? 0) + 1;
  const schedule = config.BILLING_RETRY_SCHEDULE_DAYS;
  const exhausted = attempts >= schedule.length;
  const nextRetry = exhausted ? null : nextRetryAtFrom(delinquentSince, attempts);

  await query(
    `UPDATE wallets SET
       delinquent_since = COALESCE(delinquent_since, NOW()),
       charge_attempts = $2,
       coverage_paused = CASE WHEN $3 THEN TRUE ELSE coverage_paused END,
       next_retry_at = $4,
       updated_at = NOW()
     WHERE user_id = $1`,
    [payerUserId, attempts, exhausted, nextRetry?.toISOString() ?? null],
  );

  if (!wasDelinquent || exhausted) {
    const user = await findUserById(payerUserId);
    if (user) {
      void sendBillingDunningEmail(user.email, {
        amountCents: config.TOKEN_PACK_PRICE_CENTS,
        currency: config.STRIPE_CURRENCY,
        nextRetryAt: nextRetry,
        coveragePaused: exhausted,
        updateCardUrl: `${config.PUBLIC_WEB_BASE_URL.replace(/\/$/, '')}/clinic/`,
      }).catch((err) => console.error('[billing dunning email]', err));
    }
  }
}

export async function clearDelinquency(payerUserId: string): Promise<void> {
  const before = await getWalletBillingState(payerUserId);
  await query(
    `UPDATE wallets SET
       delinquent_since = NULL,
       charge_attempts = 0,
       coverage_paused = FALSE,
       next_retry_at = NULL,
       updated_at = NOW()
     WHERE user_id = $1`,
    [payerUserId],
  );
  if (before.delinquentSince) {
    const user = await findUserById(payerUserId);
    if (user) {
      void sendBillingRecoveredEmail(user.email).catch((err) =>
        console.error('[billing recovered email]', err),
      );
    }
  }
}

/** After a debit: if live and below grace floor, pause coverage. */
export async function enforceGraceFloor(payerUserId: string): Promise<void> {
  if (!config.BILLING_LIVE) return;
  const bal = await getBalanceQuick(payerUserId);
  if (bal >= -config.BILLING_GRACE_TOKENS) return;
  await query(
    `UPDATE wallets SET coverage_paused = TRUE, next_retry_at = NULL, updated_at = NOW()
     WHERE user_id = $1 AND coverage_paused = FALSE`,
    [payerUserId],
  );
  const user = await findUserById(payerUserId);
  if (user) {
    void sendBillingDunningEmail(user.email, {
      amountCents: config.TOKEN_PACK_PRICE_CENTS,
      currency: config.STRIPE_CURRENCY,
      nextRetryAt: null,
      coveragePaused: true,
      updateCardUrl: `${config.PUBLIC_WEB_BASE_URL.replace(/\/$/, '')}/clinic/`,
    }).catch((err) => console.error('[billing grace email]', err));
  }
}

async function ensureWalletRow(userId: string): Promise<void> {
  await query(`INSERT INTO wallets (user_id, balance_tokens) VALUES ($1, 0) ON CONFLICT DO NOTHING`, [
    userId,
  ]);
}

async function creditTokens(userId: string, tokens: number, reason: string): Promise<number> {
  await ensureWalletRow(userId);
  await query(
    `UPDATE wallets SET balance_tokens = balance_tokens + $1, updated_at = NOW() WHERE user_id = $2`,
    [tokens, userId],
  );
  await query(
    `INSERT INTO wallet_ledger (user_id, delta, reason, ref_type, payer_user_id)
     VALUES ($1, $2, $3, 'pack', $1)`,
    [userId, tokens, reason],
  );
  return getBalanceQuick(userId);
}

export type AutoReloadResult = {
  reloaded: boolean;
  tokensAdded: number;
  method: 'stripe' | 'simulated' | 'none';
  balanceAfter: number;
};

/**
 * Charge payer's saved card and grant a token pack when balance is low.
 *
 * BILLING_LIVE off (alpha): the same production flow runs — pack, ledger entry,
 * invoice — but the PSP is never contacted and the invoice is issued with
 * charged_cents=0 / status 'comped_alpha'.
 * BILLING_LIVE on: real PSP charge; a failed charge does NOT grant tokens.
 */
export async function autoReloadTokenPack(payerUserId: string): Promise<AutoReloadResult> {
  const pm = await getPaymentMethod(payerUserId);
  const packTokens = config.TOKEN_PACK_SIZE;
  const amountCents = config.TOKEN_PACK_PRICE_CENTS;
  const description = `AI token pack (${packTokens} tokens) — auto-reload`;

  if (config.BILLING_LIVE) {
    if (config.STRIPE_SECRET_KEY && pm.onFile && pm.cardLast4) {
      const charge = await chargeStripePack(payerUserId, pm);
      await createInvoice({
        userId: payerUserId,
        description,
        tokens: charge.ok ? packTokens : 0,
        amountCents,
        chargedCents: charge.ok ? amountCents : 0,
        currency: config.STRIPE_CURRENCY,
        status: charge.ok ? 'paid' : 'failed',
        provider: 'stripe',
        providerRef: charge.intentId,
      });
      if (charge.ok) {
        const balanceAfter = await creditTokens(payerUserId, packTokens, 'stripe_auto_reload');
        await clearDelinquency(payerUserId);
        return { reloaded: true, tokensAdded: packTokens, method: 'stripe', balanceAfter };
      }
      await recordFailedCharge(payerUserId, charge.intentId);
    }
    return {
      reloaded: false,
      tokensAdded: 0,
      method: 'none',
      balanceAfter: await getBalanceQuick(payerUserId),
    };
  }

  if (config.AUTO_RELOAD_SIMULATE) {
    await createInvoice({
      userId: payerUserId,
      description,
      tokens: packTokens,
      amountCents,
      chargedCents: 0,
      currency: config.STRIPE_CURRENCY,
      status: 'comped_alpha',
      provider: pm.onFile ? 'simulated' : 'none',
    });
    const balanceAfter = await creditTokens(payerUserId, packTokens, 'auto_reload_simulated');
    return { reloaded: true, tokensAdded: packTokens, method: 'simulated', balanceAfter };
  }

  return {
    reloaded: false,
    tokensAdded: 0,
    method: 'none',
    balanceAfter: await getBalanceQuick(payerUserId),
  };
}

async function chargeStripePack(
  payerUserId: string,
  _pm: PaymentMethodView,
): Promise<{ ok: boolean; intentId: string | null }> {
  if (!config.STRIPE_SECRET_KEY) return { ok: false, intentId: null };

  const { rows } = await query<{
    stripe_customer_id: string | null;
    stripe_payment_method_id: string | null;
  }>(
    `SELECT stripe_customer_id, stripe_payment_method_id FROM payment_methods WHERE user_id = $1`,
    [payerUserId],
  );
  const customerId = rows[0]?.stripe_customer_id;
  const paymentMethodId = rows[0]?.stripe_payment_method_id;
  if (!customerId || !paymentMethodId || customerId.startsWith('cus_sim_')) {
    return { ok: false, intentId: null };
  }

  const dayBucket = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({
    amount: String(config.TOKEN_PACK_PRICE_CENTS),
    currency: config.STRIPE_CURRENCY,
    customer: customerId,
    payment_method: paymentMethodId,
    confirm: 'true',
    off_session: 'true',
    description: `Healthings AI token pack (${config.TOKEN_PACK_SIZE} tokens)`,
    'metadata[payer_user_id]': payerUserId,
  });

  const res = await stripeForm('/payment_intents', params, {
    idempotencyKey: `pack_${payerUserId}_${dayBucket}_${config.TOKEN_PACK_SIZE}`,
  });
  const intentId = typeof res.json.id === 'string' ? res.json.id : null;
  return { ok: res.ok && res.json.status === 'succeeded', intentId };
}

/** Top up until balance covers `needed` tokens (may charge multiple packs in edge cases). */
export async function ensurePayerBalance(payerUserId: string, needed: number): Promise<void> {
  let balance = await getBalanceQuick(payerUserId);
  let attempts = 0;
  while (balance < needed && attempts < 3) {
    const result = await autoReloadTokenPack(payerUserId);
    if (!result.reloaded) break;
    balance = result.balanceAfter;
    attempts += 1;
  }
}

/**
 * Hourly sweep: retry delinquent wallets that are due; pause when schedule exhausted.
 * No-op while BILLING_LIVE is false.
 */
export async function processDelinquentRetries(): Promise<void> {
  if (!config.BILLING_LIVE) return;

  const { rows } = await query<{ user_id: string }>(
    `SELECT user_id FROM wallets
     WHERE delinquent_since IS NOT NULL
       AND coverage_paused = FALSE
       AND (next_retry_at IS NULL OR next_retry_at <= NOW())
     ORDER BY next_retry_at NULLS FIRST
     LIMIT 50`,
  );

  for (const row of rows) {
    try {
      await autoReloadTokenPack(row.user_id);
    } catch (err) {
      console.error('[billing retry]', row.user_id, err);
    }
  }
}

async function getBalanceQuick(userId: string): Promise<number> {
  const { rows } = await query<{ balance_tokens: number }>(
    `SELECT balance_tokens FROM wallets WHERE user_id = $1`,
    [userId],
  );
  return rows[0]?.balance_tokens ?? 0;
}
