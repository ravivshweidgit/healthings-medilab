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
