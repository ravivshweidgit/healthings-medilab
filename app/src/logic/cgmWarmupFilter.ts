/**
 * CareSens / CGM sensor warm-up: first ~24h after install often reads falsely low.
 * Detect session starts (serial change, sequence reset, or long gap) and exclude warm-up.
 */

import type { TimePoint } from '../services/SamsungHealthService';

export const CGM_WARMUP_HOURS = 24;
export const CGM_SESSION_GAP_HOURS = 24;

const WARMUP_MS = CGM_WARMUP_HOURS * 60 * 60 * 1000;
const SESSION_GAP_MS = CGM_SESSION_GAP_HOURS * 60 * 60 * 1000;

export type CgmSessionStart = {
  startMs: number;
  /** CareSens serial when known (CSV import). */
  serial?: string;
};

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

/** Detect each new sensor session from sorted timestamps + optional CSV hints. */
export function detectCgmSessionStarts(
  glucose: TimePoint[],
  hints?: CgmSessionStart[],
): CgmSessionStart[] {
  if (hints != null && hints.length > 0) {
    return hints.sort((a, b) => a.startMs - b.startMs);
  }

  const sorted = [...glucose]
    .map((p) => ({ ms: toMs(p.timestamp), iso: p.timestamp }))
    .filter((p) => !Number.isNaN(p.ms))
    .sort((a, b) => a.ms - b.ms);

  if (sorted.length === 0) return [];

  // Health Connect / xDrip may start mid-sensor — do not treat the first reading as a new
  // session (that would hide 24h of live data). Only gaps imply a new sensor without CSV hints.
  const starts: CgmSessionStart[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].ms - sorted[i - 1].ms > SESSION_GAP_MS) {
      starts.push({ startMs: sorted[i].ms });
    }
  }
  return starts;
}

/** Warm-up applies only to CareSens CSV sessions (serial) and gap-detected new sensors — not HC stream anchors. */
export function warmupSessionStarts(
  knownSessionStarts: CgmSessionStart[] | undefined,
  gapStarts: CgmSessionStart[],
): CgmSessionStart[] {
  const serialStarts = (knownSessionStarts ?? []).filter((s) => s.serial);
  const merged = [...serialStarts, ...gapStarts];
  const map = new Map<number, CgmSessionStart>();
  for (const s of merged) map.set(s.startMs, s);
  return [...map.values()].sort((a, b) => a.startMs - b.startMs);
}

export function sanitizePersistedSessionStarts(
  knownSessionStarts: CgmSessionStart[] | undefined,
  gapStarts: CgmSessionStart[],
): CgmSessionStart[] {
  return warmupSessionStarts(knownSessionStarts, gapStarts);
}

export function isCgmWarmupMs(ms: number, sessionStarts: CgmSessionStart[]): boolean {
  if (Number.isNaN(ms)) return false;
  return sessionStarts.some((s) => ms >= s.startMs && ms < s.startMs + WARMUP_MS);
}

/** Drop warm-up readings — use for chart, mentors, and period stats. */
export function excludeCgmWarmupReadings(
  glucose: TimePoint[],
  sessionStarts?: CgmSessionStart[],
): TimePoint[] {
  if (glucose.length === 0) return [];
  const starts = detectCgmSessionStarts(glucose, sessionStarts);
  return glucose.filter((p) => !isCgmWarmupMs(toMs(p.timestamp), starts));
}

export function formatCgmSessionLines(sessionStarts: CgmSessionStart[]): string[] {
  return sessionStarts.map((s) => {
    const start = new Date(s.startMs);
    const end = new Date(s.startMs + WARMUP_MS);
    const serialPart = s.serial ? ` serial ${s.serial}` : '';
    return `CGM session start${serialPart}: ${start.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })} | warm-up until ${end.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })} — excluded from stats/chart`;
  });
}

/** @deprecated use detectCgmSessionStarts — first session only for backward compat. */
export function firstCgmSessionStart(glucose: TimePoint[]): CgmSessionStart | null {
  const starts = detectCgmSessionStarts(glucose);
  return starts[0] ?? null;
}
