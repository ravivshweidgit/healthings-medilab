/**
 * Clinic-opt-in past meal marker fill (prompt110 / be-41 extension).
 * Phone only runs when overlay.markersBackfill.status === 'pending'.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from './AuthApiService';
import {
  entryMarkerTotals,
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

/** Soft caps — clinic picks days; phone bounds cost. */
export const MARKERS_BACKFILL_MAX_MEALS = 80;
export const MARKERS_BACKFILL_BATCH = 4;

function entryNeedsMarkers(entry: FoodEntry, codes: DietMarkerCode[]): boolean {
  if (!entry.items?.length) return false;
  const have = entryMarkerTotals(entry);
  return codes.some((c) => have[c] == null);
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
  await AsyncStorage.setItem(LAST_ACK_KEY, body.id);
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
    const need = recent
      .filter((e) => entryNeedsMarkers(e, codes))
      .slice(-MARKERS_BACKFILL_MAX_MEALS);

    for (let i = 0; i < need.length; i += MARKERS_BACKFILL_BATCH) {
      const batch = need.slice(i, i + MARKERS_BACKFILL_BATCH);
      const estimated = await estimateMarkersForSavedMeals(
        batch.map((e) => ({ id: e.id, items: e.items })),
        markers,
      );
      for (const entry of batch) {
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
