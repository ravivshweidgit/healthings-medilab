import { query } from '../db/pool.js';
import { resolveAiPayer } from './sponsor.js';
import { tokensForReason, type AiUsageReason } from './aiBilling.js';
import { debitAiUsage, debitAiUsageForPatient } from './wallet.js';
import type { GeminiUsage } from './geminiClinic.js';

export type AiUsageEvent = {
  id: string;
  patientId: string;
  payerUserId: string;
  sponsorId: string | null;
  sponsored: boolean;
  tokens: number;
  reason: AiUsageReason;
  createdAt: string;
  balanceAfter: number;
};

export type { GeminiUsage };

export type UsageSummaryRow = {
  patientId: string;
  patientEmail: string;
  totalTokens: number;
  eventCount: number;
};

export { type AiUsageReason };

async function recordAiUsageEvent(
  patientId: string,
  payerUserId: string,
  tokens: number,
  reason: AiUsageReason,
  sponsored: boolean,
  sponsorId: string | null,
  geminiUsage?: GeminiUsage | null,
): Promise<AiUsageEvent> {
  const { rows } = await query<{ id: string; created_at: Date }>(
    `INSERT INTO ai_usage_events (
       patient_id, payer_user_id, sponsor_id, sponsored, tokens, reason,
       gemini_prompt_tokens, gemini_candidates_tokens, gemini_thoughts_tokens,
       gemini_total_tokens, gemini_model
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, created_at`,
    [
      patientId,
      payerUserId,
      sponsorId,
      sponsored,
      tokens,
      reason,
      geminiUsage?.promptTokens ?? null,
      geminiUsage?.candidatesTokens ?? null,
      geminiUsage?.thoughtsTokens ?? null,
      geminiUsage?.totalTokens ?? null,
      geminiUsage?.model ?? null,
    ],
  );

  const { rows: balRows } = await query<{ balance_tokens: number }>(
    `SELECT balance_tokens FROM wallets WHERE user_id = $1`,
    [payerUserId],
  );

  const row = rows[0];
  return {
    id: row.id,
    patientId,
    payerUserId,
    sponsorId,
    sponsored,
    tokens,
    reason,
    createdAt: row.created_at.toISOString(),
    balanceAfter: balRows[0]?.balance_tokens ?? 0,
  };
}

/**
 * Debit an explicit payer (not sponsorship resolution).
 * Used by clinic portal chat (mentor wallet) and /account/ chat (patient wallet).
 */
export async function meterAiUsageForPayer(
  payerUserId: string,
  patientId: string,
  reason: AiUsageReason,
  tokensOverride?: number,
  geminiUsage?: GeminiUsage | null,
): Promise<AiUsageEvent> {
  const tokens = tokensForReason(reason, tokensOverride);
  await debitAiUsage(payerUserId, patientId, tokens, reason);
  return recordAiUsageEvent(patientId, payerUserId, tokens, reason, false, null, geminiUsage);
}

/** Clinic portal mentor chat — always the acting mentor's wallet. */
export async function meterClinicChat(
  mentorId: string,
  patientId: string,
  geminiUsage?: GeminiUsage | null,
): Promise<AiUsageEvent> {
  return meterAiUsageForPayer(mentorId, patientId, 'ai_chat', undefined, geminiUsage);
}

/**
 * Patient /account/ AI chat — always the patient's wallet.
 * Ignores ai_sponsorships so clinic balance is not charged for web self-chat.
 */
export async function meterPatientSelfChat(
  patientId: string,
  geminiUsage?: GeminiUsage | null,
): Promise<AiUsageEvent> {
  return meterAiUsageForPayer(patientId, patientId, 'ai_chat', undefined, geminiUsage);
}

/** Log usage and debit payer via sponsorship (phone app AI). Auto-reloads card when balance low. */
export async function meterAiUsage(
  patientId: string,
  reason: AiUsageReason,
  tokensOverride?: number,
  geminiUsage?: GeminiUsage | null,
): Promise<AiUsageEvent> {
  const tokens = tokensForReason(reason, tokensOverride);
  const payer = await resolveAiPayer(patientId);
  const sponsorId = payer.sponsored ? payer.payerUserId : null;

  await debitAiUsageForPatient(patientId, tokens, reason);

  return recordAiUsageEvent(
    patientId,
    payer.payerUserId,
    tokens,
    reason,
    payer.sponsored,
    sponsorId,
    geminiUsage,
  );
}

export type UsageEventRow = {
  id: string;
  patientId: string;
  patientEmail: string;
  tokens: number;
  reason: string;
  geminiPromptTokens: number | null;
  geminiCandidatesTokens: number | null;
  geminiThoughtsTokens: number | null;
  geminiTotalTokens: number | null;
  geminiModel: string | null;
  sponsored: boolean;
  createdAt: string;
};

/** Recent AI events paid by this user (mentor: all covered patients; patient: self). */
export async function getUsageEventsForPayer(
  payerUserId: string,
  limit = 50,
): Promise<UsageEventRow[]> {
  const { rows } = await query<{
    id: string;
    patient_id: string;
    patient_email: string;
    tokens: number;
    reason: string;
    gemini_prompt_tokens: number | null;
    gemini_candidates_tokens: number | null;
    gemini_thoughts_tokens: number | null;
    gemini_total_tokens: number | null;
    gemini_model: string | null;
    sponsored: boolean;
    created_at: Date;
  }>(
    `SELECT e.id, e.patient_id, p.email AS patient_email, e.tokens, e.reason,
            e.gemini_prompt_tokens, e.gemini_candidates_tokens, e.gemini_thoughts_tokens,
            e.gemini_total_tokens, e.gemini_model, e.sponsored, e.created_at
     FROM ai_usage_events e
     JOIN users p ON p.id = e.patient_id
     WHERE e.payer_user_id = $1
     ORDER BY e.created_at DESC
     LIMIT $2`,
    [payerUserId, Math.min(Math.max(limit, 1), 200)],
  );
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientEmail: r.patient_email,
    tokens: r.tokens,
    reason: r.reason,
    geminiPromptTokens: r.gemini_prompt_tokens,
    geminiCandidatesTokens: r.gemini_candidates_tokens,
    geminiThoughtsTokens: r.gemini_thoughts_tokens,
    geminiTotalTokens: r.gemini_total_tokens,
    geminiModel: r.gemini_model,
    sponsored: r.sponsored,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function getMentorUsageSummary(
  mentorId: string,
  from?: Date,
  to?: Date,
): Promise<UsageSummaryRow[]> {
  const params: unknown[] = [mentorId];
  let sql = `
    SELECT e.patient_id,
           p.email AS patient_email,
           COALESCE(SUM(e.tokens), 0)::int AS total_tokens,
           COUNT(*)::int AS event_count
    FROM ai_usage_events e
    JOIN users p ON p.id = e.patient_id
    WHERE e.payer_user_id = $1
  `;
  if (from) {
    params.push(from.toISOString());
    sql += ` AND e.created_at >= $${params.length}`;
  }
  if (to) {
    params.push(to.toISOString());
    sql += ` AND e.created_at <= $${params.length}`;
  }
  sql += ` GROUP BY e.patient_id, p.email ORDER BY total_tokens DESC`;

  const { rows } = await query<{
    patient_id: string;
    patient_email: string;
    total_tokens: number;
    event_count: number;
  }>(sql, params);

  return rows.map((r) => ({
    patientId: r.patient_id,
    patientEmail: r.patient_email,
    totalTokens: r.total_tokens,
    eventCount: r.event_count,
  }));
}

export async function getPatientUsageTotal(patientId: string, from?: Date, to?: Date): Promise<number> {
  const params: unknown[] = [patientId];
  let sql = `SELECT COALESCE(SUM(tokens), 0)::int AS total FROM ai_usage_events WHERE patient_id = $1`;
  if (from) {
    params.push(from.toISOString());
    sql += ` AND created_at >= $${params.length}`;
  }
  if (to) {
    params.push(to.toISOString());
    sql += ` AND created_at <= $${params.length}`;
  }
  const { rows } = await query<{ total: number }>(sql, params);
  return rows[0]?.total ?? 0;
}
