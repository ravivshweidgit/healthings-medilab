import { query } from '../db/pool.js';
import { config } from '../config.js';
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

export type MeterAiUsageOpts = {
  clientEventId?: string | null;
  occurredAt?: string | null;
};

export type MeterAiUsageResult = {
  event: AiUsageEvent | null;
  duplicate: boolean;
};

async function recordAiUsageEvent(
  patientId: string,
  payerUserId: string,
  tokens: number,
  reason: AiUsageReason,
  sponsored: boolean,
  sponsorId: string | null,
  geminiUsage?: GeminiUsage | null,
  opts?: MeterAiUsageOpts,
): Promise<AiUsageEvent | null> {
  const occurredAt = opts?.occurredAt ? new Date(opts.occurredAt) : new Date();
  const clientEventId = opts?.clientEventId ?? null;

  const { rows } = await query<{ id: string; created_at: Date }>(
    clientEventId
      ? `INSERT INTO ai_usage_events (
           patient_id, payer_user_id, sponsor_id, sponsored, tokens, reason,
           gemini_prompt_tokens, gemini_candidates_tokens, gemini_thoughts_tokens,
           gemini_total_tokens, gemini_model, client_event_id, occurred_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (client_event_id) DO NOTHING
         RETURNING id, created_at`
      : `INSERT INTO ai_usage_events (
           patient_id, payer_user_id, sponsor_id, sponsored, tokens, reason,
           gemini_prompt_tokens, gemini_candidates_tokens, gemini_thoughts_tokens,
           gemini_total_tokens, gemini_model, occurred_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, created_at`,
    clientEventId
      ? [
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
          clientEventId,
          occurredAt.toISOString(),
        ]
      : [
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
          occurredAt.toISOString(),
        ],
  );

  if (!rows[0]) return null;

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
  const event = await recordAiUsageEvent(
    patientId,
    payerUserId,
    tokens,
    reason,
    false,
    null,
    geminiUsage,
  );
  if (!event) throw new Error('Failed to record AI usage event');
  return event;
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

/**
 * Phone AI — insert-first when clientEventId is set (exactly-once on flush retry),
 * then debit payer via sponsorship. Without clientEventId: legacy debit-then-insert.
 */
export async function meterAiUsageResult(
  patientId: string,
  reason: AiUsageReason,
  tokensOverride?: number,
  geminiUsage?: GeminiUsage | null,
  opts?: MeterAiUsageOpts,
): Promise<MeterAiUsageResult> {
  const tokens = tokensForReason(reason, tokensOverride);
  const payer = await resolveAiPayer(patientId);
  const sponsorId = payer.sponsored ? payer.payerUserId : null;

  if (opts?.clientEventId) {
    // Insert first so a retried flush cannot double-debit.
    const event = await recordAiUsageEvent(
      patientId,
      payer.payerUserId,
      tokens,
      reason,
      payer.sponsored,
      sponsorId,
      geminiUsage,
      opts,
    );
    if (!event) return { event: null, duplicate: true };
    await debitAiUsageForPatient(patientId, tokens, reason);
    const { rows: balRows } = await query<{ balance_tokens: number }>(
      `SELECT balance_tokens FROM wallets WHERE user_id = $1`,
      [payer.payerUserId],
    );
    return {
      event: { ...event, balanceAfter: balRows[0]?.balance_tokens ?? event.balanceAfter },
      duplicate: false,
    };
  }

  await debitAiUsageForPatient(patientId, tokens, reason);
  const event = await recordAiUsageEvent(
    patientId,
    payer.payerUserId,
    tokens,
    reason,
    payer.sponsored,
    sponsorId,
    geminiUsage,
    opts,
  );
  if (!event) throw new Error('Failed to record AI usage event');
  return { event, duplicate: false };
}

/** Log usage and debit payer via sponsorship (phone app AI). Auto-reloads card when balance low. */
export async function meterAiUsage(
  patientId: string,
  reason: AiUsageReason,
  tokensOverride?: number,
  geminiUsage?: GeminiUsage | null,
  opts?: MeterAiUsageOpts,
): Promise<AiUsageEvent> {
  const { event, duplicate } = await meterAiUsageResult(
    patientId,
    reason,
    tokensOverride,
    geminiUsage,
    opts,
  );
  if (duplicate || !event) {
    throw new Error('Duplicate client_event_id');
  }
  return event;
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

export type MarginRow = {
  /** YYYY-MM-DD (UTC) for day rows; reason code for reason rows. */
  key: string;
  events: number;
  eventsWithGemini: number;
  credits: number;
  revenueCents: number;
  promptTokens: number;
  outputTokens: number;
  cogsCents: number;
  marginCents: number;
};

export type MarginReport = {
  days: MarginRow[];
  byReason: MarginRow[];
  totals: MarginRow;
  rates: {
    inputCentsPerMtok: number;
    outputCentsPerMtok: number;
    creditPriceCents: number;
  };
};

type MarginAggRow = {
  key: string;
  events: string;
  events_with_gemini: string;
  credits: string;
  prompt_tokens: string;
  output_tokens: string;
};

function toMarginRow(r: MarginAggRow): MarginRow {
  const credits = Number(r.credits);
  const promptTokens = Number(r.prompt_tokens);
  const outputTokens = Number(r.output_tokens);
  const creditPriceCents = config.TOKEN_PACK_PRICE_CENTS / config.TOKEN_PACK_SIZE;
  const revenueCents = credits * creditPriceCents;
  const cogsCents =
    (promptTokens * config.GEMINI_INPUT_COST_PER_MTOK_CENTS +
      outputTokens * config.GEMINI_OUTPUT_COST_PER_MTOK_CENTS) /
    1_000_000;
  return {
    key: r.key,
    events: Number(r.events),
    eventsWithGemini: Number(r.events_with_gemini),
    credits,
    revenueCents: Math.round(revenueCents * 100) / 100,
    promptTokens,
    outputTokens,
    cogsCents: Math.round(cogsCents * 100) / 100,
    marginCents: Math.round((revenueCents - cogsCents) * 100) / 100,
  };
}

const MARGIN_AGG_SELECT = `
  COUNT(*)::text AS events,
  COUNT(gemini_total_tokens)::text AS events_with_gemini,
  COALESCE(SUM(tokens), 0)::text AS credits,
  COALESCE(SUM(gemini_prompt_tokens), 0)::text AS prompt_tokens,
  COALESCE(SUM(COALESCE(gemini_candidates_tokens, 0) + COALESCE(gemini_thoughts_tokens, 0)), 0)::text AS output_tokens
`;

/**
 * Revenue (credits at list price) vs estimated Gemini COGS (be-35, be-37).
 * `payerUserId = null` → all payers (platform-wide; admin-only at the route).
 * Pure math over stored usage — rates come from config, never live billing.
 */
export async function getMarginReport(
  payerUserId: string | null,
  days = 30,
): Promise<MarginReport> {
  const boundedDays = Math.min(Math.max(days, 1), 90);
  const where = `($1::uuid IS NULL OR payer_user_id = $1)
     AND created_at >= NOW() - ($2 || ' days')::interval`;

  const { rows: dayRows } = await query<MarginAggRow>(
    `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS key, ${MARGIN_AGG_SELECT}
     FROM ai_usage_events
     WHERE ${where}
     GROUP BY 1
     ORDER BY 1 DESC`,
    [payerUserId, String(boundedDays)],
  );

  const { rows: reasonRows } = await query<MarginAggRow>(
    `SELECT reason AS key, ${MARGIN_AGG_SELECT}
     FROM ai_usage_events
     WHERE ${where}
     GROUP BY 1
     ORDER BY SUM(tokens) DESC`,
    [payerUserId, String(boundedDays)],
  );

  const { rows: totalRows } = await query<MarginAggRow>(
    `SELECT 'total' AS key, ${MARGIN_AGG_SELECT}
     FROM ai_usage_events
     WHERE ${where}`,
    [payerUserId, String(boundedDays)],
  );

  return {
    days: dayRows.map(toMarginRow),
    byReason: reasonRows.map(toMarginRow),
    totals: toMarginRow(totalRows[0]!),
    rates: {
      inputCentsPerMtok: config.GEMINI_INPUT_COST_PER_MTOK_CENTS,
      outputCentsPerMtok: config.GEMINI_OUTPUT_COST_PER_MTOK_CENTS,
      creditPriceCents: config.TOKEN_PACK_PRICE_CENTS / config.TOKEN_PACK_SIZE,
    },
  };
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

/** Platform-wide active patients from ai_usage_events (admin console). */
export type ActiveUsageRow = {
  patientId: string;
  patientEmail: string;
  firstName: string | null;
  lastName: string | null;
  eventCount: number;
  totalTokens: number;
  sponsoredEvents: number;
  firstAt: string;
  lastAt: string;
};

export async function getActiveUsageByPatient(from: Date, to: Date): Promise<ActiveUsageRow[]> {
  const { rows } = await query<{
    patient_id: string;
    patient_email: string;
    first_name: string | null;
    last_name: string | null;
    event_count: number;
    total_tokens: number;
    sponsored_events: number;
    first_at: Date;
    last_at: Date;
  }>(
    `SELECT e.patient_id,
            p.email AS patient_email,
            p.first_name,
            p.last_name,
            COUNT(*)::int AS event_count,
            COALESCE(SUM(e.tokens), 0)::int AS total_tokens,
            COUNT(*) FILTER (WHERE e.sponsored)::int AS sponsored_events,
            MIN(e.created_at) AS first_at,
            MAX(e.created_at) AS last_at
     FROM ai_usage_events e
     JOIN users p ON p.id = e.patient_id
     WHERE e.created_at >= $1 AND e.created_at <= $2
     GROUP BY e.patient_id, p.email, p.first_name, p.last_name
     ORDER BY last_at DESC`,
    [from.toISOString(), to.toISOString()],
  );
  return rows.map((r) => ({
    patientId: r.patient_id,
    patientEmail: r.patient_email,
    firstName: r.first_name,
    lastName: r.last_name,
    eventCount: r.event_count,
    totalTokens: r.total_tokens,
    sponsoredEvents: r.sponsored_events,
    firstAt: r.first_at.toISOString(),
    lastAt: r.last_at.toISOString(),
  }));
}
