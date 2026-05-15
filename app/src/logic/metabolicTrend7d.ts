/**
 * Seven-day body-composition trend: local calendar buckets, Withings (weight, fat mass, muscle mass, visceral index).
 */

export type MetabolicTrend7dDay = {
  dayKey: string;
  weightKg: number | null;
  fatMassKg: number | null;
  muscleMassKg: number | null;
  visceralFatIndex: number | null;
};

/** One Withings scale session with full BIA (weight + fat + muscle). */
export type CompositionSession = {
  dateMs: number;
  dayKey: string;
  weightKg: number;
  fatMassKg: number;
  muscleMassKg: number;
  visceralFatIndex: number | null;
};

export type CompositionPeriodAnchor = {
  start: CompositionSession;
  end: CompositionSession;
};

export type BodyCompositionTrendDebug = {
  sessions: CompositionSession[];
  periodStart: CompositionSession | null;
  periodEnd: CompositionSession | null;
  lookbackDays: number;
};

export type BodyCompositionTrendPayload = {
  days: MetabolicTrend7dDay[];
  periodAnchor: CompositionPeriodAnchor | null;
  debug: BodyCompositionTrendDebug;
};

export function localDayKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localDayKeyFromIso(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return localDayKeyFromMs(t);
}

/** First and last non-null values in a series (oldest → newest). */
export function periodEndpointsKg(values: (number | null)[]): { start: number; end: number } | null {
  let start: number | null = null;
  let end: number | null = null;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    if (start === null) start = v;
    end = v;
  }
  if (start === null || end === null) return null;
  return { start, end };
}

/** Change from first to last reading in the window (matches Withings week summary cards). */
export function periodDeltaKg(values: (number | null)[]): number | null {
  const ends = periodEndpointsKg(values);
  if (!ends) return null;
  return ends.end - ends.start;
}

export function isCompositionDay(d: MetabolicTrend7dDay): boolean {
  return (
    d.fatMassKg != null &&
    d.muscleMassKg != null &&
    Number.isFinite(d.fatMassKg) &&
    Number.isFinite(d.muscleMassKg)
  );
}

/** First day in the window with fat + muscle from the same scale session. */
export function firstCompositionDayIndex(days: MetabolicTrend7dDay[]): number {
  return days.findIndex(isCompositionDay);
}

/** Indices of days with full BIA (oldest → newest). */
export function compositionDayIndices(days: MetabolicTrend7dDay[]): number[] {
  const out: number[] = [];
  days.forEach((d, i) => {
    if (isCompositionDay(d)) out.push(i);
  });
  return out;
}

/**
 * Fat/muscle value to plot on the trend chart at `dayIndex`.
 * Withings treats the first in-window BIA day as calibration: that column shows the 2nd day's kg.
 */
export function withingsChartCompositionKg(
  days: MetabolicTrend7dDay[],
  dayIndex: number,
  field: 'fatMassKg' | 'muscleMassKg'
): number | null {
  const compIdx = compositionDayIndices(days);
  const rank = compIdx.indexOf(dayIndex);
  if (rank < 0) return null;

  if (rank === 0 && compIdx.length >= 2) {
    const second = days[compIdx[1]][field];
    return second != null && Number.isFinite(second) ? second : null;
  }

  const v = days[dayIndex][field];
  return v != null && Number.isFinite(v) ? v : null;
}

/** Week change using only full composition days (first BIA → last BIA). */
export function periodDeltaKgFromCompositionDays(
  days: MetabolicTrend7dDay[],
  field: 'fatMassKg' | 'muscleMassKg'
): number | null {
  const vals = days.filter(isCompositionDay).map((d) => d[field]);
  return periodDeltaKg(vals);
}

export function compositionBaselines(days: MetabolicTrend7dDay[]): { fatKg: number; muscleKg: number } | null {
  const i = firstCompositionDayIndex(days);
  if (i < 0) return null;
  const d = days[i];
  if (d.fatMassKg == null || d.muscleMassKg == null) return null;
  return { fatKg: d.fatMassKg, muscleKg: d.muscleMassKg };
}

export function dayKeyStartMs(dayKey: string): number {
  const parts = dayKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return NaN;
  const [y, mo, da] = parts;
  const d = new Date(y, mo - 1, da);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Latest full BIA per calendar day inside the chart window, in day order (oldest → newest). */
export function compositionSessionsPerDayInWindow(
  sessions: CompositionSession[],
  windowDayKeys: string[]
): CompositionSession[] {
  if (windowDayKeys.length === 0) return [];

  const windowStart = dayKeyStartMs(windowDayKeys[0]);
  const windowEndExclusive =
    dayKeyStartMs(windowDayKeys[windowDayKeys.length - 1]) + 24 * 60 * 60 * 1000;

  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEndExclusive)) return [];

  const inWindow = sessions.filter((s) => s.dateMs >= windowStart && s.dateMs < windowEndExclusive);
  const latestByDay = new Map<string, CompositionSession>();
  for (const s of inWindow) {
    const prev = latestByDay.get(s.dayKey);
    if (!prev || s.dateMs >= prev.dateMs) latestByDay.set(s.dayKey, s);
  }

  const ordered: CompositionSession[] = [];
  for (const dayKey of windowDayKeys) {
    const s = latestByDay.get(dayKey);
    if (s) ordered.push(s);
  }
  return ordered;
}

/**
 * Withings week summary skips the first day that has a body-composition reading in the window
 * (often treated like a calibration / first scale) and uses the 2nd day as the baseline.
 */
export function resolveCompositionPeriodAnchor(
  sessions: CompositionSession[],
  windowDayKeys: string[]
): CompositionPeriodAnchor | null {
  const perDay = compositionSessionsPerDayInWindow(sessions, windowDayKeys);
  if (perDay.length === 0) return null;

  const end = perDay[perDay.length - 1];
  const start = perDay.length >= 2 ? perDay[1] : perDay[0];

  return { start, end };
}

export function periodAnchorBaselines(anchor: CompositionPeriodAnchor | null | undefined): {
  fatKg: number;
  muscleKg: number;
} | null {
  if (!anchor) return null;
  return { fatKg: anchor.start.fatMassKg, muscleKg: anchor.start.muscleMassKg };
}

export function periodAnchorDeltas(anchor: CompositionPeriodAnchor | null | undefined): {
  fatKg: number;
  muscleKg: number;
} | null {
  if (!anchor) return null;
  return {
    fatKg: anchor.end.fatMassKg - anchor.start.fatMassKg,
    muscleKg: anchor.end.muscleMassKg - anchor.start.muscleMassKg,
  };
}

/** Visceral index change over the same anchor window as fat/muscle week deltas. */
export function periodAnchorVisceralDelta(anchor: CompositionPeriodAnchor | null | undefined): number | null {
  if (!anchor) return null;
  const start = anchor.start.visceralFatIndex;
  const end = anchor.end.visceralFatIndex;
  if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  return end - start;
}

/** First → last visceral index in the 7-day chart series (oldest → newest). */
export function visceralWeekDeltaFromChartDays(days: MetabolicTrend7dDay[]): number | null {
  return periodDeltaKg(days.map((d) => d.visceralFatIndex));
}

export type VisceralWeekTrend = {
  deltaIndex: number | null;
  baselineIndex: number | null;
};

/** Week visceral change for legend: anchor when meaningful, else first → last on chart. */
export function resolveVisceralWeekTrend(
  days: MetabolicTrend7dDay[],
  anchor: CompositionPeriodAnchor | null | undefined
): VisceralWeekTrend {
  const anchorDelta = periodAnchorVisceralDelta(anchor);
  const chartFirstLastDelta = visceralWeekDeltaFromChartDays(days);
  const firstChartVisceral =
    days.find((d) => d.visceralFatIndex != null && Number.isFinite(d.visceralFatIndex))?.visceralFatIndex ??
    null;

  if (anchorDelta != null && Math.abs(anchorDelta) >= 0.05) {
    return { deltaIndex: anchorDelta, baselineIndex: anchor?.start.visceralFatIndex ?? null };
  }
  if (chartFirstLastDelta != null) {
    return { deltaIndex: chartFirstLastDelta, baselineIndex: firstChartVisceral };
  }
  if (anchorDelta != null) {
    return { deltaIndex: anchorDelta, baselineIndex: anchor?.start.visceralFatIndex ?? null };
  }
  return { deltaIndex: null, baselineIndex: null };
}

export function visceralPercentChange(deltaIndex: number, baselineIndex: number): number | null {
  if (!Number.isFinite(deltaIndex) || !Number.isFinite(baselineIndex) || baselineIndex === 0) return null;
  return (deltaIndex / baselineIndex) * 100;
}

export function buildDaysFromSessions(dayKeys: string[], sessions: CompositionSession[]): MetabolicTrend7dDay[] {
  const sorted = [...sessions].sort((a, b) => a.dateMs - b.dateMs);
  return dayKeys.map((dayKey) => {
    const daySessions = sorted.filter((s) => s.dayKey === dayKey);
    if (daySessions.length === 0) {
      return { dayKey, weightKg: null, fatMassKg: null, muscleMassKg: null, visceralFatIndex: null };
    }
    const latest = daySessions[daySessions.length - 1];
    return {
      dayKey,
      weightKg: latest.weightKg,
      fatMassKg: latest.fatMassKg,
      muscleMassKg: latest.muscleMassKg,
      visceralFatIndex: latest.visceralFatIndex,
    };
  });
}

/** Oldest → newest (today last), local midnight boundaries. */
export function last7LocalDayKeysOldestFirst(): string[] {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    keys.push(localDayKeyFromMs(d.getTime()));
  }
  return keys;
}
