/**
 * Seven-day metabolic trend helpers: local calendar buckets + daily average glucose.
 */

export type MetabolicTrend7dDay = {
  dayKey: string;
  weightKg: number | null;
  visceralFatIndex: number | null;
  avgGlucoseMgDl: number | null;
};

export type WeightVisceralTrendDay = {
  dayKey: string;
  weightKg: number | null;
  visceralFatIndex: number | null;
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

export function averageDailyGlucoseForDayKeys(
  glucose: { timestamp: string; value: number }[],
  dayKeys: string[]
): (number | null)[] {
  return dayKeys.map((key) => {
    const vals: number[] = [];
    for (const p of glucose) {
      const dk = localDayKeyFromIso(p.timestamp);
      if (dk === key && Number.isFinite(p.value)) vals.push(p.value);
    }
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });
}

export function buildMetabolicTrend7dFromWithings(
  withingsRows: WeightVisceralTrendDay[],
  glucose: { timestamp: string; value: number }[]
): MetabolicTrend7dDay[] {
  const dayKeys = withingsRows.map((r) => r.dayKey);
  const avgs = averageDailyGlucoseForDayKeys(glucose, dayKeys);
  return withingsRows.map((row, i) => ({
    dayKey: row.dayKey,
    weightKg: row.weightKg,
    visceralFatIndex: row.visceralFatIndex,
    avgGlucoseMgDl: avgs[i] ?? null,
  }));
}
