/**
 * Manual daily water intake (ml) + hydration goal.
 * Canonical keys for backup/restore parity (Android ↔ iOS).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_KEY = 'water_log_v1';
const GOAL_KEY = 'water_goal_ml_v1';

export const DEFAULT_WATER_GOAL_ML = 2500;

export type WaterEntry = {
  id: string;
  timestamp: number;
  ml: number;
  label?: string;
};

type WaterLogFileV2 = {
  version: 2;
  days: Record<string, WaterEntry[]>;
};

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function noonMsForDayKey(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0).getTime();
}

async function loadDays(): Promise<Record<string, WaterEntry[]>> {
  const raw = await AsyncStorage.getItem(LOG_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as WaterLogFileV2 | Record<string, number | WaterEntry[]>;
    if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === 2 && parsed.days) {
      return parsed.days;
    }
    if (parsed && typeof parsed === 'object' && !('version' in parsed)) {
      const migrated: Record<string, WaterEntry[]> = {};
      for (const [dk, val] of Object.entries(parsed as Record<string, number | WaterEntry[]>)) {
        if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
          migrated[dk] = [{ id: makeId(), timestamp: noonMsForDayKey(dk), ml: Math.round(val), label: 'Water' }];
        } else if (Array.isArray(val)) {
          migrated[dk] = val.filter(
            (e): e is WaterEntry =>
              e != null &&
              typeof e === 'object' &&
              typeof e.id === 'string' &&
              typeof e.timestamp === 'number' &&
              typeof e.ml === 'number',
          );
        }
      }
      await saveDays(migrated);
      return migrated;
    }
    return {};
  } catch {
    return {};
  }
}

async function saveDays(days: Record<string, WaterEntry[]>): Promise<void> {
  const cleaned: Record<string, WaterEntry[]> = {};
  for (const [dk, entries] of Object.entries(days)) {
    const list = entries
      .filter((e) => e.ml > 0 && Number.isFinite(e.ml))
      .map((e) => ({ ...e, ml: Math.round(e.ml) }));
    if (list.length > 0) cleaned[dk] = list;
  }
  if (Object.keys(cleaned).length === 0) {
    await AsyncStorage.removeItem(LOG_KEY);
  } else {
    const payload: WaterLogFileV2 = { version: 2, days: cleaned };
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(payload));
  }
}

export async function getWaterEntries(dayKey: string): Promise<WaterEntry[]> {
  const days = await loadDays();
  return [...(days[dayKey] ?? [])].sort((a, b) => a.timestamp - b.timestamp);
}

export async function getWaterMl(dayKey: string): Promise<number> {
  const entries = await getWaterEntries(dayKey);
  return entries.reduce((sum, e) => sum + e.ml, 0);
}

/** Log one drink event; returns new day total. */
export async function addWaterMl(dayKey: string, delta: number, label?: string): Promise<number> {
  const ml = Math.round(delta);
  if (!Number.isFinite(ml) || ml <= 0) return getWaterMl(dayKey);
  const days = await loadDays();
  const list = days[dayKey] ?? [];
  list.push({
    id: makeId(),
    timestamp: Date.now(),
    ml,
    label: label?.trim() || undefined,
  });
  days[dayKey] = list;
  await saveDays(days);
  return list.reduce((sum, e) => sum + e.ml, 0);
}

export async function setWaterMl(dayKey: string, ml: number): Promise<void> {
  const rounded = Math.round(ml);
  const days = await loadDays();
  if (!Number.isFinite(rounded) || rounded <= 0) {
    delete days[dayKey];
  } else {
    days[dayKey] = [{ id: makeId(), timestamp: Date.now(), ml: rounded, label: 'Water' }];
  }
  await saveDays(days);
}

export async function deleteWaterEntry(dayKey: string, entryId: string): Promise<number> {
  const days = await loadDays();
  const list = (days[dayKey] ?? []).filter((e) => e.id !== entryId);
  if (list.length === 0) delete days[dayKey];
  else days[dayKey] = list;
  await saveDays(days);
  return list.reduce((sum, e) => sum + e.ml, 0);
}

export async function updateWaterEntry(
  dayKey: string,
  entryId: string,
  ml: number,
  label?: string,
): Promise<number> {
  const rounded = Math.round(ml);
  const days = await loadDays();
  const list = days[dayKey] ?? [];
  const idx = list.findIndex((e) => e.id === entryId);
  if (idx < 0) return getWaterMl(dayKey);
  if (!Number.isFinite(rounded) || rounded <= 0) {
    list.splice(idx, 1);
  } else {
    list[idx] = {
      ...list[idx],
      ml: rounded,
      label: label?.trim() || list[idx].label,
    };
  }
  if (list.length === 0) delete days[dayKey];
  else days[dayKey] = list;
  await saveDays(days);
  return list.reduce((sum, e) => sum + e.ml, 0);
}

export async function getWaterGoalMl(): Promise<number> {
  const raw = await AsyncStorage.getItem(GOAL_KEY);
  if (!raw) return DEFAULT_WATER_GOAL_ML;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_WATER_GOAL_ML;
  return n;
}

export async function setWaterGoalMl(ml: number): Promise<void> {
  const rounded = Math.round(ml);
  if (!Number.isFinite(rounded) || rounded <= 0) {
    await AsyncStorage.removeItem(GOAL_KEY);
    return;
  }
  await AsyncStorage.setItem(GOAL_KEY, String(rounded));
}
