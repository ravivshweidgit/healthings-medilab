/**
 * Local merge of photo-derived food items into an existing meal.
 * Name equality only (trim + lower) — no fuzzy/substring regex. Ambiguous cases → AI meal edit.
 */

import type { FoodItem } from '../services/GeminiService';

function normLabel(name: string): string {
  return name.trim().toLowerCase();
}

function itemNamesMatch(a: FoodItem, b: FoodItem): boolean {
  const namesA = [a.name, a.name_local].filter(Boolean) as string[];
  const namesB = [b.name, b.name_local].filter(Boolean) as string[];
  for (const na of namesA) {
    for (const nb of namesB) {
      const aa = normLabel(na);
      const bb = normLabel(nb);
      if (aa && bb && aa === bb) return true;
    }
  }
  return false;
}

/** Append all photo items to the meal. */
export function addPhotoItemsToMeal(meal: FoodItem[], photoItems: FoodItem[]): FoodItem[] {
  return [...meal, ...photoItems.map((p) => ({ ...p }))];
}

/** Remove meal lines that exactly match any photo item name / name_local. */
export function removePhotoItemsFromMeal(meal: FoodItem[], photoItems: FoodItem[]): FoodItem[] {
  if (photoItems.length === 0) return [...meal];
  return meal.filter((m) => !photoItems.some((p) => itemNamesMatch(m, p)));
}

export type MealMergePreview = {
  mode: 'add' | 'remove';
  before: FoodItem[];
  after: FoodItem[];
};

export function buildMealMergePreview(
  mode: 'add' | 'remove',
  meal: FoodItem[],
  photoItems: FoodItem[],
): MealMergePreview {
  const after =
    mode === 'add' ? addPhotoItemsToMeal(meal, photoItems) : removePhotoItemsFromMeal(meal, photoItems);
  return { mode, before: [...meal], after };
}
