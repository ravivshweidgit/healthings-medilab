/**
 * Clinic-opt-in past meal marker fill (prompt110 / be-41 extension).
 * Phone only runs when overlay.markersBackfill.status === 'pending'.
 *
 * One Gemini call per calendar day (all meals that day that still need markers).
 * Walks the full clinic-requested window (up to 90 days) — no meal-count cap.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from './AuthApiService';
import {
  entryMarkerTotals,
  foodLogDayKey,
  getMealsForDay,
  getRecentMeals,
  saveMeal,
  type FoodEntry,
} from './FoodLogService';
import { estimateMarkersForSavedMeals } from './GeminiService';
import {
  loadTreatmentMarkers,
  type DietMarkerCode,
  type MarkersBackfillRequest,
  type TreatmentMarker,
} from './TreatmentMarkerService';
import { OutOfCreditsError } from './UsageQueueService';

const RUNNING_KEY = 'healthings:markersBackfillRunningId';
const LAST_ACK_KEY = 'healthings:markersBackfillLastAckId';

/** Pause between day prompts to stay under provider rate limits. */
export const MARKERS_BACKFILL_DAY_GAP_MS = 3500;

function entryNeedsMarkers(entry: FoodEntry, codes: DietMarkerCode[]): boolean {
  if (!entry.items?.length) return false;
  const have = entryMarkerTotals(entry);
  return codes.some((c) => have[c] == null);
}

function groupMealsByDay(entries: FoodEntry[]): Map<string, FoodEntry[]> {
  const byDay = new Map<string, FoodEntry[]>();
  for (const e of entries) {
    const dk = foodLogDayKey(e.timestamp);
    const list = byDay.get(dk);
    if (list) list.push(e);
    else byDay.set(dk, [e]);
  }
  return byDay;
}

export async function ackMarkersBackfill(body: {
  id: string;
  status: 'done' | 'failed';
  mealsUpdated?: number;
  error?: string;
}): Promise<void> {
  const res = await authFetch('/v1/clinic/overlays/markers-backfill/ack', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`backfill ack failed ${res.status}: ${err.slice(0, 120)}`);
  }
  if (body.status === 'done') {
    await AsyncStorage.setItem(LAST_ACK_KEY, body.id);
  }
}

/**
 * If clinic queued a pending backfill, estimate missing markers on past meals and ack.
 * Safe to call from overlay pull — no-ops when nothing pending / already running.
 */
export async function runPendingMarkersBackfill(
  request: MarkersBackfillRequest | null | undefined,
  opts?: { onProgress?: (msg: string) => void },
): Promise<{ ran: boolean; mealsUpdated: number; error?: string }> {
  if (!request || request.status !== 'pending' || !request.id) {
    return { ran: false, mealsUpdated: 0 };
  }

  const lastAck = await AsyncStorage.getItem(LAST_ACK_KEY);
  if (lastAck === request.id) {
    return { ran: false, mealsUpdated: 0 };
  }

  const running = await AsyncStorage.getItem(RUNNING_KEY);
  if (running === request.id) {
    return { ran: false, mealsUpdated: 0 };
  }

  const treat = await loadTreatmentMarkers();
  const markers: TreatmentMarker[] = treat?.markers ?? [];
  if (!markers.length) {
    const error = 'No local treatment markers';
    try {
      await ackMarkersBackfill({ id: request.id, status: 'failed', error, mealsUpdated: 0 });
    } catch {
      /* still report */
    }
    return { ran: true, mealsUpdated: 0, error };
  }

  const codes = markers.map((m) => m.marker);
  const days = Math.min(90, Math.max(1, Math.round(Number(request.days) || 14)));

  await AsyncStorage.setItem(RUNNING_KEY, request.id);
  opts?.onProgress?.(`Filling markers · ${days}d…`);

  let mealsUpdated = 0;
  try {
    const recent = await getRecentMeals(days);
    const byDay = groupMealsByDay(recent);
    const dayKeys = [...byDay.keys()].sort();

    let dayIndex = 0;
    for (const dk of dayKeys) {
      const dayMeals = byDay.get(dk) ?? [];
      // All meals that day still missing markers — one prompt for the whole day.
      const need = dayMeals.filter((e) => entryNeedsMarkers(e, codes));
      if (!need.length) continue;

      if (dayIndex > 0) {
        await new Promise((r) => setTimeout(r, MARKERS_BACKFILL_DAY_GAP_MS));
      }
      dayIndex += 1;
      opts?.onProgress?.(`Filling ${dk} (${need.length} meals)…`);

      const estimated = await estimateMarkersForSavedMeals(
        need.map((e) => ({ id: e.id, items: e.items })),
        markers,
      );
      for (const entry of need) {
        const updatedItems = estimated.get(entry.id);
        if (!updatedItems?.length) continue;
        const next: FoodEntry = {
          ...entry,
          items: updatedItems,
        };
        next.markers = entryMarkerTotals(next);
        await saveMeal(next);
        mealsUpdated += 1;
      }
    }

    await ackMarkersBackfill({
      id: request.id,
      status: 'done',
      mealsUpdated,
    });
    opts?.onProgress?.(`Filled ${mealsUpdated} meals`);
    return { ran: true, mealsUpdated };
  } catch (e) {
    const error =
      e instanceof OutOfCreditsError
        ? 'Out of AI credits'
        : e instanceof Error
          ? e.message.slice(0, 400)
          : 'Backfill failed';
    const transient = /429|rate limit/i.test(error);
    if (!transient) {
      try {
        await ackMarkersBackfill({
          id: request.id,
          status: 'failed',
          mealsUpdated,
          error,
        });
      } catch {
        /* phone still has partial saves */
      }
    }
    opts?.onProgress?.(error);
    return { ran: true, mealsUpdated, error };
  } finally {
    const still = await AsyncStorage.getItem(RUNNING_KEY);
    if (still === request.id) await AsyncStorage.removeItem(RUNNING_KEY);
  }
}

/** Re-read a day after backfill (optional helper). */
export async function reloadDayAfterBackfill(dayKey: string): Promise<FoodEntry[]> {
  return getMealsForDay(dayKey);
}
