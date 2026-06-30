/**
 * Meal-issue helpers — local macro math + Gemini rule markers on FoodItem.
 * My Rules violations come from Gemini (analyzeFood rule_conflict + save-time check).
 */

import type { FoodItem } from '../services/GeminiService';
import type { DailyMacroTarget } from '../services/TargetService';

export type MealIssueCode = 'carb_over' | 'kcal_over' | 'protein_low' | 'rule_conflict';

export type MealIssue = {
  id: string;
  severity: 'warning' | 'critical';
  code: MealIssueCode;
  message: string;
  itemNames?: string[];
};

export type DayMacroTotals = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
};

export type MealIssueInput = {
  items: FoodItem[];
  dayTotalsBeforeMeal: DayMacroTotals;
  macroTarget: DailyMacroTarget | null;
  mealTimestamp: number;
};

function itemDisplayName(item: FoodItem): string {
  return item.name_local ?? item.name;
}

function mealTotals(items: FoodItem[]): DayMacroTotals {
  return items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      protein_g: acc.protein_g + item.protein_g,
      carb_g: acc.carb_g + item.carb_g,
      fat_g: acc.fat_g + item.fat_g,
    }),
    { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 },
  );
}

function projectedDayTotals(before: DayMacroTotals, meal: DayMacroTotals): DayMacroTotals {
  return {
    kcal: before.kcal + meal.kcal,
    protein_g: before.protein_g + meal.protein_g,
    carb_g: before.carb_g + meal.carb_g,
    fat_g: before.fat_g + meal.fat_g,
  };
}

function carbContributors(items: FoodItem[]): string[] {
  return items.filter((i) => i.carb_g >= 5).map(itemDisplayName);
}

function kcalContributors(items: FoodItem[]): string[] {
  const sorted = [...items].sort((a, b) => b.kcal - a.kcal);
  const top = sorted.filter((i) => i.kcal >= 80);
  return (top.length > 0 ? top : sorted.slice(0, 2)).map(itemDisplayName);
}

export function mergeMealRuleIssues(...groups: MealIssue[][]): MealIssue[] {
  const seen = new Set<string>();
  const out: MealIssue[] = [];
  for (const group of groups) {
    for (const issue of group) {
      const key = `${issue.code}::${(issue.itemNames ?? []).join('|').toLowerCase()}::${issue.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(issue);
    }
  }
  return out;
}

export function mealIssuesFromFoodItems(items: FoodItem[]): MealIssue[] {
  return items
    .filter((item) => item.rule_conflict)
    .map((item, index) => ({
      id: `item-rule-${index}-${itemDisplayName(item)}`,
      severity: 'critical' as const,
      code: 'rule_conflict' as const,
      message: item.rule_message?.trim() || `"${itemDisplayName(item)}" conflicts with your dietary rules.`,
      itemNames: [itemDisplayName(item)],
    }));
}

export function mealIssuesFromGeminiRules(geminiIssues: Array<{
  itemName: string;
  severity: 'warning' | 'critical';
  message: string;
}>): MealIssue[] {
  return geminiIssues.map((issue, index) => ({
    id: `gemini-rule-${index}-${issue.itemName}`,
    severity: issue.severity,
    code: 'rule_conflict' as const,
    message: issue.message,
    itemNames: [issue.itemName],
  }));
}

export function analyzeMacroMealIssues(input: MealIssueInput): MealIssue[] {
  const { items, dayTotalsBeforeMeal, macroTarget, mealTimestamp } = input;
  if (items.length === 0) return [];

  const issues: MealIssue[] = [];
  const meal = mealTotals(items);
  const projected = projectedDayTotals(dayTotalsBeforeMeal, meal);

  if (macroTarget) {
    if (projected.carb_g > macroTarget.carb_g + 0.5) {
      const over = Math.round(projected.carb_g - macroTarget.carb_g);
      issues.push({
        id: 'carb-over',
        severity: 'critical',
        code: 'carb_over',
        message: `Today's carbs would reach ${Math.round(projected.carb_g)}g (${over}g over your ${Math.round(macroTarget.carb_g)}g target).`,
        itemNames: carbContributors(items),
      });
    }

    if (projected.kcal > macroTarget.kcal + 5) {
      const over = Math.round(projected.kcal - macroTarget.kcal);
      issues.push({
        id: 'kcal-over',
        severity: 'critical',
        code: 'kcal_over',
        message: `Today's calories would reach ${Math.round(projected.kcal)} kcal (${over} over your ${Math.round(macroTarget.kcal)} target).`,
        itemNames: kcalContributors(items),
      });
    }

    const mealDate = new Date(mealTimestamp);
    const hoursIntoDay = mealDate.getHours() + mealDate.getMinutes() / 60;
    const paceFraction = Math.max(0.35, hoursIntoDay / 24);
    const expectedProtein = macroTarget.protein_g * paceFraction;
    if (hoursIntoDay >= 12 && projected.protein_g < expectedProtein * 0.65) {
      const short = Math.round(expectedProtein - projected.protein_g);
      issues.push({
        id: 'protein-low',
        severity: 'warning',
        code: 'protein_low',
        message: `Protein is behind pace for today (${Math.round(projected.protein_g)}g vs ~${Math.round(expectedProtein)}g expected by now, ~${short}g short).`,
      });
    }
  }

  return issues;
}

export function flaggedItemIndices(items: FoodItem[], issues: MealIssue[]): Set<number> {
  const indices = foodItemRuleConflictIndices(items);
  const flaggedNames = new Set(
    issues.flatMap((issue) => issue.itemNames ?? []).map((n) => n.toLowerCase()),
  );
  if (flaggedNames.size === 0) return indices;

  items.forEach((item, index) => {
    const names = [item.name, item.name_local ?? ''].map((n) => n.toLowerCase());
    if (names.some((n) => flaggedNames.has(n))) indices.add(index);
  });
  return indices;
}

export function foodItemRuleConflictIndices(items: FoodItem[]): Set<number> {
  const indices = new Set<number>();
  items.forEach((item, index) => {
    if (item.rule_conflict) indices.add(index);
  });
  return indices;
}

export function mealItemsSnapshotKey(items: FoodItem[]): string {
  return JSON.stringify(
    items.map((i) => ({
      name: i.name,
      name_local: i.name_local,
      grams: i.grams,
      kcal: i.kcal,
      protein_g: i.protein_g,
      carb_g: i.carb_g,
      fat_g: i.fat_g,
      fiber_g: i.fiber_g,
      rule_conflict: i.rule_conflict,
      rule_message: i.rule_message,
    })),
  );
}

/** Meal composition only — for re-checking rules when items change (ignores stale rule flags). */
export function mealItemsCompositionKey(items: FoodItem[]): string {
  return JSON.stringify(
    items.map((i) => ({
      name: i.name,
      name_local: i.name_local,
      grams: i.grams,
      kcal: i.kcal,
      protein_g: i.protein_g,
      carb_g: i.carb_g,
      fat_g: i.fat_g,
      fiber_g: i.fiber_g,
    })),
  );
}

function namesMatchItem(itemName: string, item: FoodItem): boolean {
  const key = itemName.toLowerCase().trim();
  if (!key) return false;
  const labels = [item.name_local, item.name].filter(Boolean).map((n) => n!.toLowerCase().trim());
  return labels.some((label) => label === key || label.includes(key) || key.includes(label));
}

/** Re-apply Gemini rule check results onto items (clears stale rule_conflict from saved meals). */
export function syncFoodItemRuleFlags(
  items: FoodItem[],
  geminiIssues: Array<{ itemName: string; message: string }>,
): FoodItem[] {
  return items.map((item) => {
    const hit = geminiIssues.find((issue) => namesMatchItem(issue.itemName, item));
    return {
      ...item,
      rule_conflict: Boolean(hit),
      rule_message: hit?.message?.trim() || undefined,
    };
  });
}

export function issueModalBody(issues: MealIssue[]): string {
  return issues
    .slice(0, 3)
    .map((i) => i.message)
    .join('\n');
}
