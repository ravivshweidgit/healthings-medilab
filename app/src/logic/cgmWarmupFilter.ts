/**
 * CareSens / CGM sensor warm-up: first ~24h after install often reads falsely low.
 * Detect session starts (serial change, sequence reset, or long gap) and exclude warm-up.
 */

import type { TimePoint } from '../services/HealthConnectService';

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
  // Explicit list (including empty) — do not invent gap sessions. Empty is how xDrip /
  // prepareGlucoseSeries says “no CareSens warm-up”; `hints.length > 0` used to fall
  // through to gap detection and hide the live HC tail for 24h after any >24h hole.
  if (hints !== undefined) {
    return [...hints].sort((a, b) => a.startMs - b.startMs);
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

/** Warm-up applies only to CareSens CSV sessions (serial). Gap-based starts are metadata only — applying warm-up after a CSV→HC gap was hiding live HC readings. */
export function warmupSessionStarts(
  knownSessionStarts: CgmSessionStart[] | undefined,
  _gapStarts?: CgmSessionStart[],
): CgmSessionStart[] {
  return (knownSessionStarts ?? []).filter((s) => s.serial);
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
  // Pass-through undefined → gap detect; pass [] / serial starts → use exactly that list.
  const starts = detectCgmSessionStarts(glucose, sessionStarts);
  if (starts.length === 0) return glucose;
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
