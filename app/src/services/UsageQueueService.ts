/**
 * Phone prepaid-bucket queue (be-33).
 *
 * Local soft gate: creditsLeft + sponsored flag from last wallet sync.
 * Gemini stays on-device; usage rows enqueue here and flush in batches.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from './AuthApiService';
import { loadAuthTokens } from './AuthTokenStore';
import { fetchWallet, type WalletView } from './ShareApiService';
import type { AiUsageReason, GeminiUsageReport } from './UsageApiService';

export const USAGE_QUEUE_KEY = 'usage_queue_v1';
export const USAGE_CREDITS_LEFT_KEY = 'usage_credits_left_v1';
export const USAGE_SPONSORED_KEY = 'usage_sponsored_v1';
export const USAGE_LAST_FLUSH_AT_KEY = 'usage_last_flush_at_v1';

const FLUSH_EVENT_THRESHOLD = 10;
const FLUSH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Mirror server defaults (AI_TOKENS_PER_*). Soft local debit only. */
const CREDITS_PER_REASON: Record<AiUsageReason, number> = {
  ai_meal: 1,
  ai_chat: 1,
  ai_coach: 1,
  ai_macro: 1,
  ai_rules: 1,
  ai_lab: 2,
  ai_help: 1,
  ai_other: 1,
};

export class OutOfCreditsError extends Error {
  constructor(message = 'Out of AI credits. Add a token pack to continue.') {
    super(message);
    this.name = 'OutOfCreditsError';
  }
}

export type QueuedUsageEvent = {
  clientEventId: string;
  reason: AiUsageReason;
  tokens: number;
  gemini?: GeminiUsageReport | null;
  occurredAt: string;
};

type BatchFlushResponse = {
  recorded: number;
  duplicates: number;
  wallet: WalletView;
};

let flushInFlight: Promise<void> | null = null;

export function randomUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function loadQueue(): Promise<QueuedUsageEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(USAGE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedUsageEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedUsageEvent[]): Promise<void> {
  await AsyncStorage.setItem(USAGE_QUEUE_KEY, JSON.stringify(queue));
}

export function creditsForReason(reason: AiUsageReason, override?: number): number {
  if (override != null && override > 0) return override;
  return CREDITS_PER_REASON[reason] ?? 1;
}

export async function getCreditsLeft(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(USAGE_CREDITS_LEFT_KEY);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function isUsageSponsored(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(USAGE_SPONSORED_KEY);
  return raw === '1' || raw === 'true';
}

/** Adopt server wallet as the soft local gate (login / flush / buy-pack). */
export async function adoptWalletCredits(wallet: Pick<WalletView, 'balanceTokens' | 'sponsored'>): Promise<void> {
  await AsyncStorage.multiSet([
    [USAGE_CREDITS_LEFT_KEY, String(wallet.balanceTokens)],
    [USAGE_SPONSORED_KEY, wallet.sponsored ? '1' : '0'],
  ]);
}

/** Pull authoritative wallet (and adopt). Safe to call on foreground / login. */
export async function syncCreditsFromServer(): Promise<WalletView | null> {
  try {
    const t = await loadAuthTokens();
    if (!t?.accessToken) return null;
    const wallet = await fetchWallet();
    // Pending rows are not yet on the server — keep the soft gate honest.
    const queue = await loadQueue();
    const pending = wallet.sponsored
      ? 0
      : queue.reduce((sum, e) => sum + e.tokens, 0);
    await adoptWalletCredits({
      ...wallet,
      balanceTokens: wallet.balanceTokens - pending,
    });
    return wallet;
  } catch {
    return null;
  }
}

/**
 * Soft gate before Gemini. Sponsored patients skip.
 * If never synced (null credits), allow — first sync heals; do not brick offline boot.
 */
export async function assertCanSpendCredits(reason: AiUsageReason = 'ai_other', tokensOverride?: number): Promise<void> {
  if (await isUsageSponsored()) return;
  const left = await getCreditsLeft();
  if (left == null) return;
  const cost = creditsForReason(reason, tokensOverride);
  if (left < cost || left <= 0) {
    throw new OutOfCreditsError();
  }
}

/** Persist queue row first, then soft-debit local credits; flush when threshold hit. */
export async function enqueueUsageEvent(
  reason: AiUsageReason,
  tokensOverride?: number,
  gemini?: GeminiUsageReport | null,
): Promise<void> {
  const tokens = creditsForReason(reason, tokensOverride);
  const row: QueuedUsageEvent = {
    clientEventId: randomUuid(),
    reason,
    tokens,
    gemini: gemini ?? null,
    occurredAt: new Date().toISOString(),
  };

  const queue = await loadQueue();
  queue.push(row);
  await saveQueue(queue);

  if (!(await isUsageSponsored())) {
    const left = await getCreditsLeft();
    if (left != null) {
      await AsyncStorage.setItem(USAGE_CREDITS_LEFT_KEY, String(left - tokens));
    }
  }

  if (queue.length >= FLUSH_EVENT_THRESHOLD) {
    void flushUsageQueue();
  }
}

async function markFlushedAt(): Promise<void> {
  await AsyncStorage.setItem(USAGE_LAST_FLUSH_AT_KEY, new Date().toISOString());
}

async function lastFlushAtMs(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(USAGE_LAST_FLUSH_AT_KEY);
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/** Upload pending rows; adopt returned wallet. Idempotent via clientEventId. */
export async function flushUsageQueue(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    try {
      const t = await loadAuthTokens();
      if (!t?.accessToken) return;

      const queue = await loadQueue();
      if (queue.length === 0) {
        await markFlushedAt();
        return;
      }

      // Send in chunks of 200 (server max).
      let remaining = [...queue];
      let lastWallet: WalletView | null = null;

      while (remaining.length > 0) {
        const chunk = remaining.slice(0, 200);
        const res = await authFetch('/v1/usage/ai/batch', {
          method: 'POST',
          body: JSON.stringify({
            events: chunk.map((e) => ({
              clientEventId: e.clientEventId,
              reason: e.reason,
              tokens: e.tokens,
              gemini: e.gemini ?? undefined,
              occurredAt: e.occurredAt,
            })),
          }),
        });
        if (!res.ok) {
          if (__DEV__) console.warn('[usage] flush failed', res.status);
          return;
        }
        const data = (await res.json()) as BatchFlushResponse;
        lastWallet = data.wallet;
        const sentIds = new Set(chunk.map((e) => e.clientEventId));
        remaining = remaining.filter((e) => !sentIds.has(e.clientEventId));
        await saveQueue(remaining);
      }

      if (lastWallet) await adoptWalletCredits(lastWallet);
      await markFlushedAt();
    } catch (err) {
      if (__DEV__) console.warn('[usage] flush error', err);
    } finally {
      flushInFlight = null;
    }
  })();
  return flushInFlight;
}

/** Foreground trigger: flush when last flush ≥ 24 h (or never). */
export async function flushUsageQueueIfDue(): Promise<void> {
  const queue = await loadQueue();
  if (queue.length === 0) {
    // Still refresh credits from server on open.
    await syncCreditsFromServer();
    return;
  }
  const last = await lastFlushAtMs();
  if (last == null || Date.now() - last >= FLUSH_INTERVAL_MS) {
    await flushUsageQueue();
  } else {
    await syncCreditsFromServer();
  }
}

/** Before buy-pack — settle local usage so server balance is current. */
export async function flushBeforeBuyPack(): Promise<void> {
  await flushUsageQueue();
}

/** On logout — best-effort upload while tokens still present. */
export async function flushOnLogout(): Promise<void> {
  await flushUsageQueue();
}
