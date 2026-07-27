import { query } from '../db/pool.js';
import { config } from '../config.js';
import { getSponsorDisplayName, resolveAiPayer } from './sponsor.js';
import { getSponsorshipViewForPatient } from './sponsorships.js';
import {
  ensurePayerBalance,
  enforceGraceFloor,
  getPaymentMethod,
  getWalletBillingState,
} from './payments.js';

export type WalletView = {
  balanceTokens: number;
  ownBalanceTokens: number | null;
  sponsored: boolean;
  sponsoredBy: string | null;
  sponsorshipExpiresAt: string | null;
  sponsorshipActive: boolean;
  autoReload: boolean;
  paymentMethodOnFile: boolean;
  tokenPackSize: number;
  /** Pack list price in minor units — for money-led balance UI (be-22). */
  tokenPackPriceCents: number;
  /** ISO 4217 lower-case, from STRIPE_CURRENCY. */
  currency: string;
  billingLive: boolean;
  delinquentSince: string | null;
  chargeAttempts: number;
  coveragePaused: boolean;
  nextRetryAt: string | null;
};

export async function getBalance(userId: string): Promise<number> {
  const { rows } = await query<{ balance_tokens: number }>(
    `SELECT balance_tokens FROM wallets WHERE user_id = $1`,
    [userId],
  );
  return rows[0]?.balance_tokens ?? 0;
}

/** Create wallet with starter credit on first access. */
export async function ensureWallet(userId: string): Promise<number> {
  const inserted = await query<{ balance_tokens: number }>(
    `INSERT INTO wallets (user_id, balance_tokens)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING balance_tokens`,
    [userId, config.INITIAL_TOKEN_GRANT],
  );
  if (inserted.rows[0]) {
    await query(
      `INSERT INTO wallet_ledger (user_id, delta, reason, ref_type, payer_user_id)
       VALUES ($1, $2, 'initial_grant', 'signup', $1)`,
      [userId, config.INITIAL_TOKEN_GRANT],
    );
    return inserted.rows[0].balance_tokens;
  }
  return getBalance(userId);
}

export async function getWalletForUser(userId: string, role: 'patient' | 'mentor'): Promise<WalletView> {
  const ownBalance = await ensureWallet(userId);
  const tokenPackSize = config.TOKEN_PACK_SIZE;
  const tokenPackPriceCents = config.TOKEN_PACK_PRICE_CENTS;
  const currency = config.STRIPE_CURRENCY;
  const ownPm = await getPaymentMethod(userId);
  const ownBilling = await getWalletBillingState(userId);

  if (role === 'mentor') {
    return {
      balanceTokens: ownBalance,
      ownBalanceTokens: null,
      sponsored: false,
      sponsoredBy: null,
      sponsorshipExpiresAt: null,
      sponsorshipActive: false,
      autoReload: true,
      paymentMethodOnFile: ownPm.onFile,
      tokenPackSize,
      tokenPackPriceCents,
      currency,
      billingLive: config.BILLING_LIVE,
      delinquentSince: ownBilling.delinquentSince,
      chargeAttempts: ownBilling.chargeAttempts,
      coveragePaused: ownBilling.coveragePaused,
      nextRetryAt: ownBilling.nextRetryAt,
    };
  }

  const payer = await resolveAiPayer(userId);
  const payerBalance = payer.payerUserId === userId ? ownBalance : await ensureWallet(payer.payerUserId);
  const sponsorship = await getSponsorshipViewForPatient(userId);
  const sponsoredBy = payer.sponsored ? await getSponsorDisplayName(userId) : null;
  const payerPm = payer.payerUserId === userId ? ownPm : await getPaymentMethod(payer.payerUserId);
  const payerBilling =
    payer.payerUserId === userId ? ownBilling : await getWalletBillingState(payer.payerUserId);

  return {
    balanceTokens: payerBalance,
    ownBalanceTokens: payer.sponsored ? ownBalance : null,
    sponsored: payer.sponsored,
    sponsoredBy,
    sponsorshipExpiresAt: sponsorship?.expiresAt ?? null,
    sponsorshipActive: sponsorship?.active ?? false,
    autoReload: true,
    paymentMethodOnFile: payerPm.onFile,
    tokenPackSize,
    tokenPackPriceCents,
    currency,
    billingLive: config.BILLING_LIVE,
    delinquentSince: payerBilling.delinquentSince,
    chargeAttempts: payerBilling.chargeAttempts,
    coveragePaused: payerBilling.coveragePaused,
    nextRetryAt: payerBilling.nextRetryAt,
  };
}

export async function grantTokenPack(userId: string, tokens: number, reason: string): Promise<number> {
  if (tokens <= 0) throw new Error('Pack size must be positive');
  await ensureWallet(userId);
  await query(
    `UPDATE wallets SET balance_tokens = balance_tokens + $1, updated_at = NOW() WHERE user_id = $2`,
    [tokens, userId],
  );
  await query(
    `INSERT INTO wallet_ledger (user_id, delta, reason, ref_type, payer_user_id)
     VALUES ($1, $2, $3, 'pack', $1)`,
    [userId, tokens, reason],
  );
  return getBalance(userId);
}

/** Debit payer; at zero auto-charges saved card and loads a token pack (never blocks AI upstream). */
export async function debitAiUsage(
  payerUserId: string,
  patientId: string,
  tokens: number,
  reason: string,
): Promise<void> {
  if (tokens <= 0) return;

  await ensureWallet(payerUserId);
  await ensurePayerBalance(payerUserId, tokens);

  await query(
    `UPDATE wallets SET balance_tokens = balance_tokens - $1, updated_at = NOW() WHERE user_id = $2`,
    [tokens, payerUserId],
  );

  await query(
    `INSERT INTO wallet_ledger (user_id, delta, reason, ref_type, ref_id, payer_user_id)
     VALUES ($1, $2, $3, 'patient', $4, $5)`,
    [payerUserId, -tokens, reason, patientId, payerUserId],
  );

  await enforceGraceFloor(payerUserId);
}

export async function debitAiUsageForPatient(
  patientId: string,
  tokens: number,
  reason: string,
): Promise<void> {
  const payer = await resolveAiPayer(patientId);
  await debitAiUsage(payer.payerUserId, patientId, tokens, reason);
}
