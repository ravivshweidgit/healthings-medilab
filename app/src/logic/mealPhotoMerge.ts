/**
 * Local merge of photo-derived food items into an existing meal (no AI).
 */

import type { FoodItem } from '../services/GeminiService';

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]/g, '');
}

function itemNamesMatch(a: FoodItem, b: FoodItem): boolean {
  const namesA = [a.name, a.name_local].filter(Boolean) as string[];
  const namesB = [b.name, b.name_local].filter(Boolean) as string[];
  for (const na of namesA) {
    for (const nb of namesB) {
      const aa = normalizeName(na);
      const bb = normalizeName(nb);
      if (!aa || !bb) continue;
      if (aa === bb || aa.includes(bb) || bb.includes(aa)) return true;
    }
  }
  return false;
}

/** Append all photo items to the meal. */
export function addPhotoItemsToMeal(meal: FoodItem[], photoItems: FoodItem[]): FoodItem[] {
  return [...meal, ...photoItems.map((p) => ({ ...p }))];
}

/** Remove meal lines that match any photo item (photo = food NOT eaten / to subtract). */
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
  const before = [...meal];
  const after =
    mode === 'add' ? addPhotoItemsToMeal(meal, photoItems) : removePhotoItemsFromMeal(meal, photoItems);
  return { mode, before, after };
}
