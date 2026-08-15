/**
 * Food log persistence — AsyncStorage CRUD + JSON export/import.
 * Key per day: food_log_2026-06-01 → FoodEntry[]
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import type { FoodItem } from './GeminiService';
import type { DietMarkerCode, MarkerAmounts, TreatmentMarker } from './TreatmentMarkerService';
import { formatMarkerAmountsVsTargets, sumMarkerAmounts } from './TreatmentMarkerService';

export type { FoodItem };

export type FoodEntry = {
  id: string;
  timestamp: number;
  items: FoodItem[];
  totalKcal: number;
  totalProtein_g: number;
  totalCarb_g: number;
  totalFat_g: number;
  totalFiber_g?: number;
  /** Clinic treatment-marker estimates for this meal (prompt110). Absent = no data. */
  markers?: MarkerAmounts;
  note?: string;
  source: 'camera-ai' | 'text-ai' | 'manual';
};

export type DailyMacros = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  entries: FoodEntry[];
};

/** Fiber for a saved meal — sums items when legacy entries lack totalFiber_g. */
export function entryFiber_g(entry: FoodEntry): number {
  if (entry.totalFiber_g != null && Number.isFinite(entry.totalFiber_g)) return entry.totalFiber_g;
  return entry.items.reduce((acc, item) => acc + (item.fiber_g ?? 0), 0);
}

/** Sum treatment markers for a day — missing entry/item markers count as unknown, not zero. */
export function dayMarkerTotals(
  entries: FoodEntry[],
  codes: DietMarkerCode[],
): { totals: MarkerAmounts; hasAny: boolean } {
  const parts: MarkerAmounts[] = [];
  let hasAny = false;
  for (const e of entries) {
    if (e.markers && Object.keys(e.markers).length > 0) {
      parts.push(e.markers);
      hasAny = true;
      continue;
    }
    const fromItems = sumMarkerAmounts(
      e.items.map((it) => it.markers ?? {}).filter((m) => Object.keys(m).length > 0),
    );
    if (Object.keys(fromItems).length > 0) {
      parts.push(fromItems);
      hasAny = true;
    }
  }
  const summed = sumMarkerAmounts(parts);
  const totals: MarkerAmounts = {};
  for (const c of codes) {
    if (summed[c] != null) totals[c] = summed[c];
  }
  return { totals, hasAny };
}

export function entryMarkerTotals(entry: FoodEntry): MarkerAmounts {
  if (entry.markers && Object.keys(entry.markers).length > 0) return entry.markers;
  return sumMarkerAmounts(entry.items.map((it) => it.markers ?? {}));
}

const KEY_INDEX = 'food_log_days';

function dayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function storageKey(dk: string): string {
  return `food_log_${dk}`;
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

export async function getMealsForDay(dk: string): Promise<FoodEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(dk));
    return raw ? (JSON.parse(raw) as FoodEntry[]) : [];
  } catch {
    return [];
  }
}

export async function getTodayMeals(): Promise<FoodEntry[]> {
  return getMealsForDay(dayKey(Date.now()));
}

/**
 * Meals from the last `days` calendar days (including today), oldest first.
 * Used for historical meal markers on the chart when panning back.
 */
export async function getRecentMeals(days: number): Promise<FoodEntry[]> {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (Math.max(1, days) - 1));
  const cutoffKey = dayKey(cutoff.getTime());

  const keys = (await getDayKeys()).filter((dk) => dk >= cutoffKey);
  const all = await Promise.all(keys.map((dk) => getMealsForDay(dk)));
  return all.flat().sort((a, b) => a.timestamp - b.timestamp);
}

/** Formats today's meals for AI mentor context — full item-level detail. */
export function buildMealsAiContext(
  entries: FoodEntry[],
  treatmentMarkers?: TreatmentMarker[] | null,
): {
  lastMealSummary: string | null;
  todayMealsDetail: string | null;
} {
  if (entries.length === 0) {
    return { lastMealSummary: null, todayMealsDetail: null };
  }

  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const active = treatmentMarkers?.length ? treatmentMarkers : null;

  const formatMeal = (entry: FoodEntry, index: number): string => {
    const time = new Date(entry.timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    const itemLines = entry.items.length > 0
      ? entry.items.map((i) => {
          const name = i.name_local || i.name;
          return `    • ${name}: ${Math.round(i.grams)}g, ${Math.round(i.kcal)} kcal, P${i.protein_g}g C${i.carb_g}g F${i.fat_g}g Fi${i.fiber_g ?? 0}g`;
        }).join('\n')
      : '    • (items not stored — totals only)';
    const mealMarks = entryMarkerTotals(entry);
    const treatLine = active?.length
      ? formatMarkerAmountsVsTargets(mealMarks, active)
      : Object.keys(mealMarks).length > 0
        ? `Treat markers: ${Object.entries(mealMarks)
            .map(([k, v]) => `${k}:${v}`)
            .join(' · ')}`
        : null;
    return [
      `Meal ${index + 1} at ${time}:`,
      itemLines,
      `  Total: ${entry.totalKcal} kcal | P${entry.totalProtein_g}g C${entry.totalCarb_g}g F${entry.totalFat_g}g Fi${entryFiber_g(entry)}g`,
      treatLine ? `  ${treatLine}` : null,
      entry.note ? `  Note: ${entry.note}` : null,
    ].filter(Boolean).join('\n');
  };

  const mealBlocks = sorted.map((e, i) => formatMeal(e, i));
  const last = sorted[sorted.length - 1];

  return {
    lastMealSummary: formatMeal(last, sorted.length - 1).replace(/\n/g, ' | '),
    todayMealsDetail: mealBlocks.join('\n\n'),
  };
}

export async function saveMeal(entry: Omit<FoodEntry, 'id'> & { id?: string }): Promise<FoodEntry> {
  const dk = dayKey(entry.timestamp);
  const saved: FoodEntry = { ...entry, id: entry.id ?? makeId() };
  const meals = await getMealsForDay(dk);
  const idx = meals.findIndex((m) => m.id === saved.id);
  if (idx >= 0) {
    meals[idx] = saved;
  } else {
    meals.push(saved);
  }
  meals.sort((a, b) => a.timestamp - b.timestamp);
  await AsyncStorage.setItem(storageKey(dk), JSON.stringify(meals));
  await addDayKey(dk);
  return saved;
}

export async function deleteMeal(entryId: string, timestamp: number): Promise<void> {
  const dk = dayKey(timestamp);
  const meals = await getMealsForDay(dk);
  const filtered = meals.filter((m) => m.id !== entryId);
  if (filtered.length === 0) {
    await AsyncStorage.removeItem(storageKey(dk));
    const keys = (await getDayKeys()).filter((k) => k !== dk);
    await AsyncStorage.setItem(KEY_INDEX, JSON.stringify(keys));
  } else {
    await AsyncStorage.setItem(storageKey(dk), JSON.stringify(filtered));
  }
}

export async function getDailyMacros(dk: string): Promise<DailyMacros> {
  const entries = await getMealsForDay(dk);
  let kcal = 0;
  let protein_g = 0;
  let carb_g = 0;
  let fat_g = 0;
  let fiber_g = 0;
  for (const e of entries) {
    kcal += e.totalKcal;
    protein_g += e.totalProtein_g;
    carb_g += e.totalCarb_g;
    fat_g += e.totalFat_g;
    fiber_g += entryFiber_g(e);
  }
  return { kcal, protein_g, carb_g, fat_g, fiber_g, entries };
}

export async function getTodayMacros(): Promise<DailyMacros> {
  return getDailyMacros(dayKey(Date.now()));
}

export { dayKey as foodLogDayKey };

/** Default timestamp when adding a meal on a given calendar day (local). Today = now; past days = 23:59. */
export function defaultMealTimestampForDay(dk: string): number {
  if (dk === dayKey(Date.now())) return Date.now();
  const parts = dk.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return Date.now();
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 23, 59, 0, 0).getTime();
}

// ─── Export / Import ──────────────────────────────────────────────────────────

type ExportPayload = {
  version: 1;
  exportedAt: string;
  days: Record<string, FoodEntry[]>;
};

/**
 * Collects all stored days and saves a JSON file to a folder the user picks
 * (Storage Access Framework — works without native rebuild).
 */
export async function exportFoodLog(): Promise<void> {
  const keys = await getDayKeys();
  const days: Record<string, FoodEntry[]> = {};
  for (const dk of keys) {
    const meals = await getMealsForDay(dk);
    if (meals.length > 0) days[dk] = meals;
  }
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    days,
  };
  const json = JSON.stringify(payload, null, 2);
  const filename = `food_log_${dayKey(Date.now())}.json`;

  // Ask the user to pick a folder (e.g. Downloads), then write the file there.
  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return; // user cancelled
  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    perm.directoryUri,
    filename,
    'application/json',
  );
  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: 'utf8' });
}

/**
 * Picks a previously exported JSON file and merges its entries into AsyncStorage.
 * Existing entries with the same id are overwritten; new ones are added.
 * Returns the number of meals imported.
 */
export async function importFoodLog(): Promise<number> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return 0;
  const uri = result.assets[0].uri;
  const raw = await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' });
  const payload = JSON.parse(raw) as ExportPayload;
  if (payload.version !== 1 || typeof payload.days !== 'object') {
    throw new Error('Invalid food log file format');
  }
  let count = 0;
  for (const [dk, entries] of Object.entries(payload.days)) {
    const existing = await getMealsForDay(dk);
    const merged = [...existing];
    for (const entry of entries) {
      const idx = merged.findIndex((m) => m.id === entry.id);
      if (idx >= 0) {
        merged[idx] = entry;
      } else {
        merged.push(entry);
        count++;
      }
    }
    merged.sort((a, b) => a.timestamp - b.timestamp);
    await AsyncStorage.setItem(storageKey(dk), JSON.stringify(merged));
    await addDayKey(dk);
  }
  return count;
}

// ─── Dev mock data ────────────────────────────────────────────────────────────

export async function seedMockFoodLog(): Promise<void> {
  const dk = dayKey(Date.now());
  const existing = await getMealsForDay(dk);
  if (existing.length > 0) return;

  const now = Date.now();
  const base = new Date();
  base.setHours(8, 0, 0, 0);

  const mockEntries: Omit<FoodEntry, 'id'>[] = [
    {
      timestamp: base.getTime(),
      items: [
        { name: 'Greek yogurt', grams: 200, kcal: 130, protein_g: 17.0, carb_g: 9.0, fat_g: 0.7 },
        { name: 'Banana', grams: 120, kcal: 107, protein_g: 1.3, carb_g: 27.0, fat_g: 0.4 },
      ],
      totalKcal: 237, totalProtein_g: 18.3, totalCarb_g: 36.0, totalFat_g: 1.1,
      note: 'Breakfast',
      source: 'manual',
    },
    {
      timestamp: base.getTime() + 4 * 60 * 60 * 1000,
      items: [
        { name: 'Shakshuka', name_local: 'שקשוקה', grams: 300, kcal: 280, protein_g: 18.0, carb_g: 14.0, fat_g: 16.0 },
        { name: 'Pita bread', name_local: 'פיתה', grams: 80, kcal: 216, protein_g: 7.2, carb_g: 43.5, fat_g: 1.8 },
      ],
      totalKcal: 496, totalProtein_g: 25.2, totalCarb_g: 57.5, totalFat_g: 17.8,
      note: 'Lunch',
      source: 'camera-ai',
    },
    {
      timestamp: base.getTime() + 9 * 60 * 60 * 1000,
      items: [
        { name: 'Almonds', grams: 30, kcal: 173, protein_g: 6.0, carb_g: 6.1, fat_g: 15.0 },
      ],
      totalKcal: 173, totalProtein_g: 6.0, totalCarb_g: 6.1, totalFat_g: 15.0,
      note: 'Snack',
      source: 'text-ai',
    },
  ];

  for (const entry of mockEntries) {
    await saveMeal(entry);
  }
}
