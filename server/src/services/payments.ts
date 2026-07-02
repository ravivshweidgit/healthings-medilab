import { query } from '../db/pool.js';
import { config } from '../config.js';

export type PaymentMethodView = {
  onFile: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
};

type PaymentMethodRow = {
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  card_last4: string | null;
  card_brand: string | null;
};

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

async function creditTokens(userId: string, tokens: number, reason: string): Promise<number> {
  await query(
    `INSERT INTO wallets (user_id, balance_tokens) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
    [userId],
  );
  await query(
    `UPDATE wallets SET balance_tokens = balance_tokens + $1, updated_at = NOW() WHERE user_id = $2`,
    [tokens, userId],
  );
  await query(
    `INSERT INTO wallet_ledger (user_id, delta, reason, ref_type, payer_user_id)
     VALUES ($1, $2, $3, 'pack', $1)`,
    [userId, tokens, reason],
  );
  const { rows } = await query<{ balance_tokens: number }>(
    `SELECT balance_tokens FROM wallets WHERE user_id = $1`,
    [userId],
  );
  return rows[0]?.balance_tokens ?? 0;
}

export type AutoReloadResult = {
  reloaded: boolean;
  tokensAdded: number;
  method: 'stripe' | 'simulated' | 'none';
  balanceAfter: number;
};

/**
 * Charge payer's saved card and grant a token pack when balance is low.
 * Never blocks AI — alpha simulates charge when Stripe is not configured.
 */
export async function autoReloadTokenPack(payerUserId: string): Promise<AutoReloadResult> {
  const pm = await getPaymentMethod(payerUserId);
  const packTokens = config.TOKEN_PACK_SIZE;

  if (config.STRIPE_SECRET_KEY && pm.onFile && pm.cardLast4) {
    const charged = await chargeStripePack(payerUserId, pm);
    if (charged) {
      const balanceAfter = await creditTokens(payerUserId, packTokens, 'stripe_auto_reload');
      return { reloaded: true, tokensAdded: packTokens, method: 'stripe', balanceAfter };
    }
  }

  if (config.AUTO_RELOAD_SIMULATE) {
    const balanceAfter = await creditTokens(payerUserId, packTokens, 'auto_reload_simulated');
    return { reloaded: true, tokensAdded: packTokens, method: 'simulated', balanceAfter };
  }

  const { rows } = await query<{ balance_tokens: number }>(
    `SELECT balance_tokens FROM wallets WHERE user_id = $1`,
    [payerUserId],
  );
  return {
    reloaded: false,
    tokensAdded: 0,
    method: 'none',
    balanceAfter: rows[0]?.balance_tokens ?? 0,
  };
}

async function chargeStripePack(
  payerUserId: string,
  _pm: PaymentMethodView,
): Promise<boolean> {
  if (!config.STRIPE_SECRET_KEY) return false;

  const params = new URLSearchParams({
    amount: String(config.TOKEN_PACK_PRICE_CENTS),
    currency: config.STRIPE_CURRENCY,
    'automatic_payment_methods[enabled]': 'true',
    'automatic_payment_methods[allow_redirects]': 'never',
    confirm: 'true',
    description: `Healthings AI token pack (${config.TOKEN_PACK_SIZE} tokens)`,
    'metadata[payer_user_id]': payerUserId,
  });

  const { rows } = await query<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM payment_methods WHERE user_id = $1`,
    [payerUserId],
  );
  if (rows[0]?.stripe_customer_id) {
    params.set('customer', rows[0].stripe_customer_id);
  }

  try {
    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { status?: string };
    return json.status === 'succeeded';
  } catch {
    return false;
  }
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

async function getBalanceQuick(userId: string): Promise<number> {
  const { rows } = await query<{ balance_tokens: number }>(
    `SELECT balance_tokens FROM wallets WHERE user_id = $1`,
    [userId],
  );
  return rows[0]?.balance_tokens ?? 0;
}
