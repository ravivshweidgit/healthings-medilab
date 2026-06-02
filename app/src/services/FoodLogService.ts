/**
 * Food log persistence — AsyncStorage CRUD + JSON export/import.
 * Key per day: food_log_2026-06-01 → FoodEntry[]
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import type { FoodItem } from './GeminiService';

export type { FoodItem };

export type FoodEntry = {
  id: string;
  timestamp: number;
  items: FoodItem[];
  totalKcal: number;
  totalProtein_g: number;
  totalCarb_g: number;
  totalFat_g: number;
  note?: string;
  source: 'camera-ai' | 'text-ai' | 'manual';
};

export type DailyMacros = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  entries: FoodEntry[];
};

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
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.totalKcal,
      protein_g: acc.protein_g + e.totalProtein_g,
      carb_g: acc.carb_g + e.totalCarb_g,
      fat_g: acc.fat_g + e.totalFat_g,
      entries: [...acc.entries, e],
    }),
    { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, entries: [] as FoodEntry[] }
  );
}

export async function getTodayMacros(): Promise<DailyMacros> {
  return getDailyMacros(dayKey(Date.now()));
}

export { dayKey as foodLogDayKey };

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
