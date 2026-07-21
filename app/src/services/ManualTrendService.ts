/**
 * Manual-mode trend + energy timeline (no Withings BIA).
 * Weight from weigh-in history; BMR from Mifflin; activity from Health Connect steps.
 */

import { mifflinStJeorKcal } from '../logic/bmrEstimate';
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

/** Last snapshot on or before dayKey (by measuredAt date). */
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
  return best ?? history[0] ?? null;
}

export function buildManualTrendDays(opts: {
  lookbackDays: number;
  heightCm: number;
  ageYears: number;
  gender: Gender | null;
  history: ManualBodySnapshot[];
  stepTotalsByDay: Map<string, number>;
  /** When set (user override), use for every day instead of Mifflin. */
  bmrOverrideKcal?: number | null;
}): MetabolicTrend7dDay[] {
  const { lookbackDays, heightCm, ageYears, gender, history, stepTotalsByDay, bmrOverrideKcal } = opts;
  if (history.length === 0 || heightCm <= 0 || ageYears < 13 || !gender) return [];

  const keys = dayKeysBack(Math.max(2, lookbackDays));
  return keys.map((dayKey) => {
    const snap = weightForDay(history, dayKey);
    const weightKg = snap?.weight_kg ?? null;
    const mifflin =
      weightKg != null && gender
        ? mifflinStJeorKcal(gender, weightKg, heightCm, ageYears)
        : null;
    const bmr =
      bmrOverrideKcal != null && Number.isFinite(bmrOverrideKcal) && bmrOverrideKcal > 0
        ? Math.round(bmrOverrideKcal)
        : mifflin ?? snap?.bmr_kcal ?? null;
    const steps = stepTotalsByDay.get(dayKey) ?? 0;
    // Explicit 0 when no steps — Food Log must still show "0 activity" + burned (BMR + 0).
    const activityKcalDay =
      weightKg != null && steps > 0
        ? stepsToActiveKcal(steps, weightKg, heightCm, gender)
        : steps > 0 && snap
          ? stepsToActiveKcal(steps, snap.weight_kg, heightCm, gender)
          : weightKg != null || snap
            ? 0
            : null;

    return {
      dayKey,
      weightKg,
      fatMassKg: null,
      muscleMassKg: null,
      visceralFatIndex: null,
      bmrKcalDay: bmr,
      activityKcalDay,
      distanceM: null,
      steps: null,
    };
  });
}
