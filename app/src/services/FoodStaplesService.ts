/**
 * Saved food staples — one-tap re-add of frequent items (prompt108).
 * Key: healthings:foodStaples — included in local/clinic backup dumps.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FoodItem } from './GeminiService';

export const FOOD_STAPLES_KEY = 'healthings:foodStaples';

export type FoodStaple = {
  id: string;
  name: string;
  name_local?: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  createdAt: number;
  updatedAt: number;
};

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeItem(item: FoodItem): Omit<FoodStaple, 'id' | 'createdAt' | 'updatedAt'> {
  const name = (item.name_local ?? item.name)?.trim() || item.name.trim() || 'Food';
  return {
    name: item.name?.trim() || name,
    name_local: item.name_local?.trim() || undefined,
    grams: Math.max(0, Math.round(Number(item.grams) || 0)),
    kcal: Math.max(0, Math.round(Number(item.kcal) || 0)),
    protein_g: Math.round((Number(item.protein_g) || 0) * 10) / 10,
    carb_g: Math.round((Number(item.carb_g) || 0) * 10) / 10,
    fat_g: Math.round((Number(item.fat_g) || 0) * 10) / 10,
    fiber_g: Math.round((Number(item.fiber_g) || 0) * 10) / 10,
  };
}

export async function getFoodStaples(): Promise<FoodStaple[]> {
  try {
    const raw = await AsyncStorage.getItem(FOOD_STAPLES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as FoodStaple[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string')
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [];
  }
}

async function writeAll(list: FoodStaple[]): Promise<void> {
  await AsyncStorage.setItem(FOOD_STAPLES_KEY, JSON.stringify(list));
}

/** Save or refresh a staple from a meal line (match by display name, case-insensitive). */
export async function saveFoodStapleFromItem(item: FoodItem): Promise<FoodStaple> {
  const now = Date.now();
  const normalized = normalizeItem(item);
  const list = await getFoodStaples();
  const label = (normalized.name_local ?? normalized.name).toLowerCase();
  const existing = list.find(
    (s) => (s.name_local ?? s.name).toLowerCase() === label || s.name.toLowerCase() === normalized.name.toLowerCase(),
  );
  if (existing) {
    const updated: FoodStaple = {
      ...existing,
      ...normalized,
      updatedAt: now,
    };
    await writeAll(list.map((s) => (s.id === existing.id ? updated : s)));
    return updated;
  }
  const created: FoodStaple = {
    id: makeId(),
    ...normalized,
    createdAt: now,
    updatedAt: now,
  };
  await writeAll([created, ...list].slice(0, 40));
  return created;
}

export async function deleteFoodStaple(id: string): Promise<void> {
  const list = await getFoodStaples();
  await writeAll(list.filter((s) => s.id !== id));
}

export function stapleToFoodItem(staple: FoodStaple): FoodItem {
  return {
    name: staple.name,
    name_local: staple.name_local,
    grams: staple.grams,
    kcal: staple.kcal,
    protein_g: staple.protein_g,
    carb_g: staple.carb_g,
    fat_g: staple.fat_g,
    fiber_g: staple.fiber_g,
    rule_conflict: false,
    rule_message: '',
  };
}
