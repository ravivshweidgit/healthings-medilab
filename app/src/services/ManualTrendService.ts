/**
 * Manual-mode trend + energy timeline (scale off).
 * Weight / BMR / fat / muscle: merge metricsStore (Withings) with manual weigh-ins.
 * Policy: Withings wins same-day; manual fills gaps only — never destroys scale data.
 * Activity steps still come from stepTotalsByDay (HC/HK) when provided.
 */

import { fatKgFromPct, mifflinStJeorKcal } from '../logic/bmrEstimate';
import { localDayKeyFromMs, type MetabolicTrend7dDay } from '../logic/metabolicTrend7d';
import type { Gender } from './TargetService';
import { stepsToActiveKcal } from './SamsungStepsAdapter';
import type { ManualBodySnapshot } from './ManualBodyService';

function dayKeysBack(count: number): string[] {
  const keys: string[] = [];
  const d = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const x = new Date(d);
    x.setDate(x.getDate() - i);
    keys.push(localDayKeyFromMs(x.getTime()));
  }
  return keys;
}

function localDayKeyFromSnapshot(s: ManualBodySnapshot): string {
  return s.measuredAt.slice(0, 10);
}

/** Last snapshot on or before dayKey (by measuredAt). */
function weightForDay(history: ManualBodySnapshot[], dayKey: string): ManualBodySnapshot | null {
  if (history.length === 0) return null;
  const endMs = Date.parse(`${dayKey}T23:59:59.999`);
  let best: ManualBodySnapshot | null = null;
  let bestMs = -1;
  for (const h of history) {
    const ms = Date.parse(h.measuredAt);
    if (Number.isNaN(ms) || ms > endMs) continue;
    if (ms >= bestMs) {
      bestMs = ms;
      best = h;
    }
  }
  return best ?? null;
}

/** Manual weigh-in recorded on this calendar day only (not carry-forward). */
function manualOnDay(history: ManualBodySnapshot[], dayKey: string): ManualBodySnapshot | null {
  let best: ManualBodySnapshot | null = null;
  let bestMs = -1;
  for (const h of history) {
    if (localDayKeyFromSnapshot(h) !== dayKey) continue;
    const ms = Date.parse(h.measuredAt);
    if (Number.isNaN(ms)) continue;
    if (ms >= bestMs) {
      bestMs = ms;
      best = h;
    }
  }
  return best;
}

function positiveBmrKcal(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return Math.round(v);
}

/**
 * Anchor BMR when a day has none: explicit Profile override, else earliest
 * user-entered BMR in history (first inserted). Carry-forward in the series is better
 * than stamping every empty day with the first value alone — see fillBmrGaps.
 */
export function resolveUserBmrAnchor(
  history: ManualBodySnapshot[],
  bmrOverrideKcal?: number | null,
): number | null {
  const override = positiveBmrKcal(bmrOverrideKcal);
  if (override != null) return override;
  let earliest: { ms: number; bmr: number } | null = null;
  for (const h of history) {
    const bmr = positiveBmrKcal(h.bmr_kcal);
    if (bmr == null) continue;
    const ms = Date.parse(h.measuredAt);
    if (Number.isNaN(ms)) continue;
    if (!earliest || ms < earliest.ms) {
      earliest = { ms, bmr };
    }
  }
  return earliest?.bmr ?? null;
}

/**
 * First usable BMR for energy-history backfill.
 * Prefer an explicit profile/manual anchor, then any live body-scan (Withings first
 * weigh-in), then the earliest point already on the trend series.
 */
export function resolveTrendBmrSeed(
  days: MetabolicTrend7dDay[],
  opts?: {
    profileAnchorKcal?: number | null;
    bodyScanBmrKcal?: number | null;
    manualSnapBmrKcal?: number | null;
  },
): number | null {
  const fromProfile = positiveBmrKcal(opts?.profileAnchorKcal);
  if (fromProfile != null) return fromProfile;
  const fromScan = positiveBmrKcal(opts?.bodyScanBmrKcal);
  if (fromScan != null) return fromScan;
  const fromManual = positiveBmrKcal(opts?.manualSnapBmrKcal);
  if (fromManual != null) return fromManual;
  for (const d of days) {
    const bmr = positiveBmrKcal(d.bmrKcalDay);
    if (bmr != null) return bmr;
  }
  return null;
}

/**
 * When the latest Withings/manual BMR landed on the body card but not yet on any
 * trend day (first scale day, or getmeas trend lag), stamp it onto today so
 * fillBmrGaps has a measured point to carry backward across meal/activity history.
 */
export function stampBmrIfMissing(
  days: MetabolicTrend7dDay[],
  bmrKcal: number | null | undefined,
  todayKey: string,
): MetabolicTrend7dDay[] {
  const bmr = positiveBmrKcal(bmrKcal);
  if (bmr == null || days.length === 0) return days;
  if (days.some((d) => positiveBmrKcal(d.bmrKcalDay) != null)) return days;

  let stampKey = days.find((d) => d.dayKey === todayKey)?.dayKey ?? null;
  if (stampKey == null) {
    for (let i = days.length - 1; i >= 0; i -= 1) {
      if (days[i].dayKey <= todayKey) {
        stampKey = days[i].dayKey;
        break;
      }
    }
  }
  if (stampKey == null) return days;
  return days.map((d) => (d.dayKey === stampKey ? { ...d, bmrKcalDay: bmr } : d));
}

/**
 * Forward-fill empty BMR days for energy charts (128d deep window).
 * Measured / prior BMR wins and updates the carry; seed covers leading gaps
 * (first scale day → flat BMR + total-burn history behind meal/activity days).
 */
export function fillBmrGaps(
  days: MetabolicTrend7dDay[],
  opts?: { seedBmrKcal?: number | null },
): MetabolicTrend7dDay[] {
  let last: number | null = positiveBmrKcal(opts?.seedBmrKcal);
  if (last == null) {
    for (const d of days) {
      const bmr = positiveBmrKcal(d.bmrKcalDay);
      if (bmr != null) {
        last = bmr;
        break;
      }
    }
  }
  if (last == null) return days;
  return days.map((d) => {
    const measured = positiveBmrKcal(d.bmrKcalDay);
    if (measured != null) {
      last = measured;
      return { ...d, bmrKcalDay: measured };
    }
    return { ...d, bmrKcalDay: last };
  });
}

/**
 * Distinct weigh-in days for chart hints: Withings weight days + manual days
 * that do not already have Withings (manual never counts over scale).
 */
export function countMergedWeighInDays(
  priorTrendDays: MetabolicTrend7dDay[] | null | undefined,
  history: ManualBodySnapshot[],
): number {
  const withingsKeys = new Set<string>();
  for (const d of priorTrendDays ?? []) {
    if (d.weightKg != null && Number.isFinite(d.weightKg)) withingsKeys.add(d.dayKey);
  }
  let n = withingsKeys.size;
  const seenManual = new Set<string>();
  for (const h of history) {
    const k = localDayKeyFromSnapshot(h);
    if (withingsKeys.has(k) || seenManual.has(k)) continue;
    seenManual.add(k);
    n += 1;
  }
  return n;
}

export function buildManualTrendDays(opts: {
  lookbackDays: number;
  heightCm: number;
  ageYears: number;
  gender: Gender | null;
  history: ManualBodySnapshot[];
  stepTotalsByDay: Map<string, number>;
  /** Explicit user BMR override only — do not pass last manual snap BMR here. */
  bmrOverrideKcal?: number | null;
  /**
   * Prior store trend (usually Withings). Same-day weight / BMR / fat / muscle from here
   * wins over manual. Manual only fills days with no scale weight.
   */
  priorTrendDays?: MetabolicTrend7dDay[] | null;
}): MetabolicTrend7dDay[] {
  const {
    lookbackDays,
    heightCm,
    ageYears,
    gender,
    history,
    stepTotalsByDay,
    bmrOverrideKcal,
    priorTrendDays,
  } = opts;

  const priorByDay = new Map<string, MetabolicTrend7dDay>();
  for (const d of priorTrendDays ?? []) {
    priorByDay.set(d.dayKey, d);
  }
  const hasPriorWeight = [...priorByDay.values()].some(
    (d) => d.weightKg != null && Number.isFinite(d.weightKg),
  );

  if ((!history.length && !hasPriorWeight) || heightCm <= 0 || ageYears < 13 || !gender) {
    return [];
  }

  const keys = dayKeysBack(Math.max(2, lookbackDays));

  let lastWeightKg: number | null = null;
  // BMR carry: override / first user BMR seeds leading gaps; measured values update it.
  let lastBmrKcal: number | null = resolveUserBmrAnchor(history, bmrOverrideKcal);
  const firstKey = keys[0];
  if (firstKey) {
    const priorBefore = [...priorByDay.values()]
      .filter((d) => d.dayKey < firstKey && d.weightKg != null)
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    const lastPrior = priorBefore[priorBefore.length - 1];
    if (lastPrior?.weightKg != null) {
      lastWeightKg = lastPrior.weightKg;
    }
    if (lastPrior?.bmrKcalDay != null && lastPrior.bmrKcalDay > 0) {
      lastBmrKcal = Math.round(lastPrior.bmrKcalDay);
    }
    const manualBefore = weightForDay(history, firstKey);
    if (lastWeightKg == null && manualBefore) {
      lastWeightKg = manualBefore.weight_kg;
    }
    if (
      (lastBmrKcal == null || lastBmrKcal <= 0)
      && manualBefore
      && manualBefore.bmr_kcal > 0
    ) {
      lastBmrKcal = Math.round(manualBefore.bmr_kcal);
    }
  }

  const built = keys.map((dayKey) => {
    const prior = priorByDay.get(dayKey);
    const priorW =
      prior?.weightKg != null && Number.isFinite(prior.weightKg) ? prior.weightKg : null;
    const manualDay = manualOnDay(history, dayKey);

    let weightKg: number | null;
    let fatMassKg: number | null = null;
    let muscleMassKg: number | null = null;
    let visceralFatIndex: number | null = null;
    let bmrKcalDay: number | null = null;

    if (priorW != null) {
      // Withings (or store) wins — copy scale composition / BMR when present.
      weightKg = priorW;
      lastWeightKg = weightKg;
      if (prior?.fatMassKg != null && Number.isFinite(prior.fatMassKg)) {
        fatMassKg = prior.fatMassKg;
      }
      if (prior?.muscleMassKg != null && Number.isFinite(prior.muscleMassKg)) {
        muscleMassKg = prior.muscleMassKg;
      }
      if (prior?.visceralFatIndex != null && Number.isFinite(prior.visceralFatIndex)) {
        visceralFatIndex = prior.visceralFatIndex;
      }
      if (prior?.bmrKcalDay != null && Number.isFinite(prior.bmrKcalDay) && prior.bmrKcalDay > 0) {
        bmrKcalDay = Math.round(prior.bmrKcalDay);
      }
    } else if (manualDay) {
      weightKg = manualDay.weight_kg;
      lastWeightKg = weightKg;
      // Gap-only: user-entered composition may fill; never touch Withings days.
      if (manualDay.fat_pct_source === 'user' && manualDay.fat_pct > 0) {
        fatMassKg = fatKgFromPct(weightKg, manualDay.fat_pct);
      }
      if (manualDay.muscle_mass_kg > 0) {
        muscleMassKg = manualDay.muscle_mass_kg;
      }
      if (manualDay.bmr_kcal > 0) {
        bmrKcalDay = Math.round(manualDay.bmr_kcal);
      }
    } else {
      weightKg = lastWeightKg;
    }

    if (bmrKcalDay != null && bmrKcalDay > 0) {
      lastBmrKcal = bmrKcalDay;
    } else if (lastBmrKcal != null && lastBmrKcal > 0) {
      bmrKcalDay = lastBmrKcal;
    } else if (bmrKcalDay == null && weightKg != null && gender && priorW == null) {
      // Mifflin only on non-scale days so energy chart keeps Withings BMR points intact.
      bmrKcalDay = mifflinStJeorKcal(gender, weightKg, heightCm, ageYears);
      if (bmrKcalDay > 0) lastBmrKcal = bmrKcalDay;
    }

    const steps = stepTotalsByDay.get(dayKey) ?? 0;
    // Fresh phone steps win; otherwise the persisted store value (HC/HK history written
    // by sync) — the shallow step map must not zero out older days.
    const priorActivity =
      prior?.activityKcalDay != null && Number.isFinite(prior.activityKcalDay)
        ? prior.activityKcalDay
        : null;
    const activityKcalDay =
      weightKg != null && steps > 0
        ? stepsToActiveKcal(steps, weightKg, heightCm, gender)
        : priorActivity ?? (weightKg != null ? 0 : null);

    return {
      dayKey,
      weightKg,
      fatMassKg,
      muscleMassKg,
      visceralFatIndex,
      bmrKcalDay,
      activityKcalDay,
      distanceM: prior?.distanceM ?? null,
      steps: prior?.steps ?? null,
    };
  });

  return fillBmrGaps(built, { seedBmrKcal: resolveUserBmrAnchor(history, bmrOverrideKcal) });
}
