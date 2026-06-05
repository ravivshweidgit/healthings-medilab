/**
 * CoachService — event-driven proactive mentor coaching.
 * Wraps frequency gating + AI generation into two clean entry points.
 */

import {
  getMentorFrequency,
  getCoachMessage,
  saveCoachMessage,
  type CoachMessage,
  type CoachActionItem,
} from './TargetService';
import { generateCoachMessage, type CoachContext, type CoachTriggerEvent } from './GeminiService';

// ─── Auto-check helper ────────────────────────────────────────────────────────

type AutoCheckData = {
  todayCarb_g: number | null;
  todayProtein_g: number | null;
  todayEaten: number | null;
  todayBurn: number | null;
  mealCount: number;
  macroTargetCarb_g: number | null;
  macroTargetProtein_g: number | null;
};

/**
 * Evaluates auto-check rules against live data.
 * Returns the updated action items array (new array, does not mutate).
 */
export function applyAutoChecks(
  items: CoachActionItem[],
  data: AutoCheckData,
): CoachActionItem[] {
  return items.map((item) => {
    if (item.done) return item; // already ticked — never un-tick automatically
    let done = item.done;
    switch (item.autoCheckType) {
      case 'carbs_under_target':
        if (data.todayCarb_g != null && data.macroTargetCarb_g != null) {
          done = data.todayCarb_g <= data.macroTargetCarb_g;
        }
        break;
      case 'protein_over_target':
        if (data.todayProtein_g != null && data.macroTargetProtein_g != null) {
          done = data.todayProtein_g >= data.macroTargetProtein_g * 0.9;
        }
        break;
      case 'calorie_deficit':
        if (data.todayEaten != null && data.todayBurn != null) {
          done = data.todayEaten < data.todayBurn;
        }
        break;
      case 'meal_logged':
        // The message stores mealCountAtGeneration; need caller to pass current
        // meal count — we use data.mealCount here as the "current" snapshot.
        // The comparison is done in the caller with mealCountAtGeneration.
        break;
      default:
        break;
    }
    return done !== item.done ? { ...item, done } : item;
  });
}

/**
 * Applies auto-checks + 'meal_logged' special case, persists if changed.
 */
export async function runAutoChecksAndPersist(
  msg: CoachMessage,
  data: AutoCheckData,
): Promise<CoachMessage> {
  const updated = applyAutoChecks(msg.actionItems, data).map((item) => {
    if (item.autoCheckType === 'meal_logged' && !item.done) {
      return { ...item, done: data.mealCount > msg.mealCountAtGeneration };
    }
    return item;
  });

  const changed = updated.some((item, i) => item.done !== msg.actionItems[i].done);
  if (!changed) return msg;

  const newMsg = { ...msg, actionItems: updated };
  await saveCoachMessage(newMsg);
  return newMsg;
}

// ─── Frequency gate ───────────────────────────────────────────────────────────

export type CoachReviewGate =
  | { allowed: true }
  | { allowed: false; waitHours: number; minGapHours: number };

/** Minimum gap since last coach message (ignores meal-toggle — for manual refresh). */
export async function checkCoachReviewGate(): Promise<CoachReviewGate> {
  const freq = await getMentorFrequency();
  const lastMsg = await getCoachMessage();

  if (lastMsg && !lastMsg.dismissedAt) {
    const hoursSinceLast =
      (Date.now() - new Date(lastMsg.generatedAt).getTime()) / 3_600_000;
    if (hoursSinceLast < freq.minGapHours) {
      return {
        allowed: false,
        waitHours: Math.max(1, Math.ceil(freq.minGapHours - hoursSinceLast)),
        minGapHours: freq.minGapHours,
      };
    }
  }
  return { allowed: true };
}

export type CoachRefreshResult =
  | { ok: true; message: CoachMessage }
  | { ok: false; reason: 'too_soon'; waitHours: number; minGapHours: number };

// ─── Trigger with frequency gate ──────────────────────────────────────────────

/**
 * Call after every relevant event (meal saved, body scan synced, workout synced).
 * Checks frequency rules — returns null if the review is skipped (too soon).
 */
export async function triggerCoachReview(
  event: CoachTriggerEvent,
  context: CoachContext,
): Promise<CoachMessage | null> {
  const freq = await getMentorFrequency();

  if (event === 'meal' && !freq.afterEachMeal) return null; // meal events disabled

  const gate = await checkCoachReviewGate();
  if (!gate.allowed) return null;

  const msg = await generateCoachMessage({ ...context, event });
  await saveCoachMessage(msg);
  return msg;
}

/**
 * Manual refresh — regenerates coach text + action items.
 * Respects min-gap setting only (not the meal toggle).
 */
export async function refreshCoachReview(
  context: CoachContext,
  event: CoachTriggerEvent = 'day-close',
): Promise<CoachRefreshResult> {
  const gate = await checkCoachReviewGate();
  if (!gate.allowed) {
    return {
      ok: false,
      reason: 'too_soon',
      waitHours: gate.waitHours,
      minGapHours: gate.minGapHours,
    };
  }

  const msg = await generateCoachMessage({ ...context, event });
  await saveCoachMessage(msg);
  return { ok: true, message: msg };
}

// ─── Force review (bypasses frequency gate) ───────────────────────────────────

/**
 * Same as triggerCoachReview() but skips the frequency gate.
 * Used for manual user-initiated reviews.
 */
export async function forceCoachReview(
  context: CoachContext,
): Promise<CoachMessage> {
  const msg = await generateCoachMessage(context);
  await saveCoachMessage(msg);
  return msg;
}
