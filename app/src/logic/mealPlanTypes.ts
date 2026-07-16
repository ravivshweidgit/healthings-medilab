/**
 * Structured meal / recipe plans for nutritionist chat (prompt40).
 */

import type { FoodItem } from '../services/GeminiService';
import { formatEnergy, type EnergyUnit } from './unitConvert';

export type RecipeIngredient = {
  name: string;
  name_local?: string;
  /** Kitchen measure in English (canonical). */
  amount_display: string;
  /** Kitchen measure in the user's app language — shown in UI. */
  amount_display_local?: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
};

export type RecipePlan = {
  title: string;
  title_local?: string;
  servings: number;
  items: RecipeIngredient[];
  steps?: string[];
  total_kcal: number;
  total_protein_g: number;
  total_carb_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  confidence: 'high' | 'medium' | 'low';
  source_note?: string;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function sumRecipeItems(items: RecipeIngredient[]): Pick<
  RecipePlan,
  'total_kcal' | 'total_protein_g' | 'total_carb_g' | 'total_fat_g' | 'total_fiber_g'
> {
  return items.reduce(
    (acc, i) => ({
      total_kcal: acc.total_kcal + (i.kcal ?? 0),
      total_protein_g: acc.total_protein_g + (i.protein_g ?? 0),
      total_carb_g: acc.total_carb_g + (i.carb_g ?? 0),
      total_fat_g: acc.total_fat_g + (i.fat_g ?? 0),
      total_fiber_g: acc.total_fiber_g + (i.fiber_g ?? 0),
    }),
    { total_kcal: 0, total_protein_g: 0, total_carb_g: 0, total_fat_g: 0, total_fiber_g: 0 },
  );
}

export function finalizeRecipePlan(raw: Partial<RecipePlan> & { items: RecipeIngredient[] }): RecipePlan {
  const items = raw.items.map((i) => ({
    ...i,
    grams: Math.round(i.grams ?? 0),
    kcal: Math.round(i.kcal ?? 0),
    protein_g: round1(i.protein_g ?? 0),
    carb_g: round1(i.carb_g ?? 0),
    fat_g: round1(i.fat_g ?? 0),
    fiber_g: round1(i.fiber_g ?? 0),
    amount_display: (i.amount_display || '').trim(),
    amount_display_local: i.amount_display_local?.trim() || undefined,
    name_local: i.name_local?.trim() || undefined,
  }));
  const totals = sumRecipeItems(items);
  const conf = raw.confidence === 'high' || raw.confidence === 'low' ? raw.confidence : 'medium';
  return {
    title: (raw.title || 'Recipe').trim(),
    title_local: raw.title_local?.trim() || undefined,
    servings: Math.max(1, Math.round(raw.servings ?? 1)),
    items,
    steps: raw.steps?.filter(Boolean),
    ...totals,
    total_kcal: Math.round(totals.total_kcal),
    total_protein_g: round1(totals.total_protein_g),
    total_carb_g: round1(totals.total_carb_g),
    total_fat_g: round1(totals.total_fat_g),
    total_fiber_g: round1(totals.total_fiber_g),
    confidence: conf,
    source_note: raw.source_note?.trim() || undefined,
  };
}

export function recipePlanToFoodItems(plan: RecipePlan): FoodItem[] {
  return plan.items.map((i) => ({
    name: i.name,
    name_local: i.name_local || i.name,
    grams: i.grams,
    kcal: i.kcal,
    protein_g: i.protein_g,
    carb_g: i.carb_g,
    fat_g: i.fat_g,
    fiber_g: i.fiber_g,
    rule_conflict: false,
    rule_message: '',
  }));
}

export function recipeDisplayTitle(plan: RecipePlan, rtl?: boolean): string {
  if (rtl && plan.title_local?.trim()) return plan.title_local.trim();
  return plan.title;
}

export function recipeMacroSummary(plan: RecipePlan, energyUnit: EnergyUnit = 'kcal'): string {
  return `${formatEnergy(plan.total_kcal, energyUnit)} · P${Math.round(plan.total_protein_g)} · C${Math.round(plan.total_carb_g)} · F${Math.round(plan.total_fat_g)} · Fi${Math.round(plan.total_fiber_g)}`;
}

/** UI: show AI-provided local kitchen unit; grams in parentheses for food log. */
export function ingredientAmountDisplay(item: RecipeIngredient, rtl?: boolean): string {
  const kitchen =
    rtl && item.amount_display_local?.trim()
      ? item.amount_display_local.trim()
      : item.amount_display?.trim() || (item.grams > 0 ? `${item.grams}g` : '');
  if (item.grams > 0 && kitchen) return `${kitchen} (${Math.round(item.grams)}g)`;
  return kitchen;
}
