/**
 * Activity log persistence — twin of FoodLogService.
 * Keys: activity_log_days · activity_log_YYYY-MM-DD · healthings:activityFavorites
 * Manual/favorite sessions only; wearable WorkoutSession stays in metricsStore.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type ActivitySource = 'manual' | 'favorite';

export type ActivityFavorite = {
  id: string;
  name: string;
  defaultMinutes: number;
  /** Kcal at defaultMinutes (AI or manual). Older favorites may omit → estimate. */
  defaultKcal?: number;
  /** Dumbbell / bar load used in the workout (kg), not body weight. */
  equipmentWeightKg?: number;
  note?: string;
  youtubeUrl?: string;
  createdAt: number;
  updatedAt: number;
};

export type ActivityEntry = {
  id: string;
  timestamp: number;
  name: string;
  minutes: number;
  note?: string;
  youtubeUrl?: string;
  /** Dumbbell / bar load used in the workout (kg), not body weight. */
  equipmentWeightKg?: number;
  /** Estimated or user-edited active kcal for this session. */
  activityKcal: number;
  source: ActivitySource;
  favoriteId?: string;
};

const KEY_INDEX = 'activity_log_days';
const KEY_FAVORITES = 'healthings:activityFavorites';

/** ~5 kcal/min moderate general activity — user can edit on save. */
export function estimateActivityKcal(minutes: number): number {
  const m = Math.max(0, Math.round(minutes));
  return Math.round(m * 5);
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function storageKey(dk: string): string {
  return `activity_log_${dk}`;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getDayKeys(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_INDEX);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function addDayKey(dk: string): Promise<void> {
  const keys = await getDayKeys();
  if (!keys.includes(dk)) {
    keys.push(dk);
    keys.sort();
    await AsyncStorage.setItem(KEY_INDEX, JSON.stringify(keys));
  }
}

export async function getActivitiesForDay(dk: string): Promise<ActivityEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(dk));
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

/** Sorted day keys that have ≥1 manual/favorite session. */
export async function getActivityDayKeys(): Promise<string[]> {
  return getDayKeys();
}

/**
 * Past-picker landing day: yesterday if it has sessions; else most recent logged day
 * before today; else yesterday (empty state).
 */
export async function resolvePastActivityBrowseDayKey(): Promise<string> {
  const today = dayKey(Date.now());
  const y = new Date();
  y.setHours(0, 0, 0, 0);
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y.getTime());
  const yList = await getActivitiesForDay(yesterday);
  if (yList.length > 0) return yesterday;
  const prior = (await getDayKeys()).filter((k) => k < today).sort();
  return prior.length ? prior[prior.length - 1]! : yesterday;
}

/** Local midnight ms for a YYYY-MM-DD key. */
export function activityDayKeyToMs(dk: string): number {
  const parts = dk.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return Date.now();
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

export async function saveActivity(
  entry: Omit<ActivityEntry, 'id'> & { id?: string },
): Promise<ActivityEntry> {
  const dk = dayKey(entry.timestamp);
  const saved: ActivityEntry = { ...entry, id: entry.id ?? makeId() };
  const list = await getActivitiesForDay(dk);
  const idx = list.findIndex((e) => e.id === saved.id);
  if (idx >= 0) list[idx] = saved;
  else list.push(saved);
  list.sort((a, b) => a.timestamp - b.timestamp);
  await AsyncStorage.setItem(storageKey(dk), JSON.stringify(list));
  await addDayKey(dk);
  return saved;
}

export async function deleteActivity(entryId: string, timestamp: number): Promise<void> {
  const dk = dayKey(timestamp);
  const list = await getActivitiesForDay(dk);
  const filtered = list.filter((e) => e.id !== entryId);
  if (filtered.length === 0) {
    await AsyncStorage.removeItem(storageKey(dk));
    const keys = (await getDayKeys()).filter((k) => k !== dk);
    await AsyncStorage.setItem(KEY_INDEX, JSON.stringify(keys));
  } else {
    await AsyncStorage.setItem(storageKey(dk), JSON.stringify(filtered));
  }
}

export async function getDailyActivityKcal(dk: string): Promise<number> {
  const entries = await getActivitiesForDay(dk);
  return entries.reduce((sum, e) => sum + (Number.isFinite(e.activityKcal) ? e.activityKcal : 0), 0);
}

/** Sum manual/favorite activity kcal for every stored day (burn wiring). */
export async function getAllActivityKcalByDay(): Promise<Record<string, number>> {
  const keys = await getDayKeys();
  const result: Record<string, number> = {};
  await Promise.all(
    keys.map(async (dk) => {
      result[dk] = await getDailyActivityKcal(dk);
    }),
  );
  return result;
}

export async function getFavorites(): Promise<ActivityFavorite[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_FAVORITES);
    const list = raw ? (JSON.parse(raw) as ActivityFavorite[]) : [];
    return list.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function writeFavorites(list: ActivityFavorite[]): Promise<void> {
  await AsyncStorage.setItem(KEY_FAVORITES, JSON.stringify(list));
}

export async function saveFavorite(
  fav: Omit<ActivityFavorite, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    createdAt?: number;
  },
): Promise<ActivityFavorite> {
  const now = Date.now();
  const list = await getFavorites();
  const mins = Math.max(1, Math.round(fav.defaultMinutes));
  const defaultKcal =
    fav.defaultKcal != null && Number.isFinite(fav.defaultKcal) && fav.defaultKcal > 0
      ? Math.round(fav.defaultKcal)
      : estimateActivityKcal(mins);
  const equipmentWeightKg =
    fav.equipmentWeightKg != null &&
    Number.isFinite(fav.equipmentWeightKg) &&
    fav.equipmentWeightKg > 0
      ? Math.round(fav.equipmentWeightKg * 10) / 10
      : undefined;
  const saved: ActivityFavorite = {
    id: fav.id ?? makeId(),
    name: fav.name.trim(),
    defaultMinutes: mins,
    defaultKcal,
    equipmentWeightKg,
    note: fav.note?.trim() || undefined,
    youtubeUrl: fav.youtubeUrl?.trim() || undefined,
    createdAt: fav.createdAt ?? now,
    updatedAt: now,
  };
  const idx = list.findIndex((f) => f.id === saved.id);
  if (idx >= 0) list[idx] = saved;
  else list.push(saved);
  await writeFavorites(list);
  return saved;
}

export async function deleteFavorite(id: string): Promise<void> {
  const list = (await getFavorites()).filter((f) => f.id !== id);
  await writeFavorites(list);
}

export { dayKey as activityLogDayKey, KEY_INDEX as ACTIVITY_LOG_DAYS_KEY, KEY_FAVORITES as ACTIVITY_FAVORITES_KEY };

export function isActivityDayKey(key: string): boolean {
  return /^activity_log_\d{4}-\d{2}-\d{2}$/.test(key);
}

export function activityDayFromKey(key: string): string | null {
  const m = key.match(/^activity_log_(\d{4}-\d{2}-\d{2})$/);
  return m?.[1] ?? null;
}

/** Default timestamp when adding on a calendar day (local). Today = now; past = 12:00. */
export function defaultActivityTimestampForDay(dk: string): number {
  if (dk === dayKey(Date.now())) return Date.now();
  const parts = dk.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return Date.now();
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
}

/** Device activity richness for export assert / fingerprint. */
export async function countDeviceActivityRichness(): Promise<{
  activityDays: number;
  activityEntries: number;
  activityFavorites: number;
  dayKeys: string[];
}> {
  const [dayKeys, favorites] = await Promise.all([getDayKeys(), getFavorites()]);
  let activityEntries = 0;
  for (const dk of dayKeys) {
    activityEntries += (await getActivitiesForDay(dk)).length;
  }
  return {
    activityDays: dayKeys.length,
    activityEntries,
    activityFavorites: favorites.length,
    dayKeys,
  };
}
