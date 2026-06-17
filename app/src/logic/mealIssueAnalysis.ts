/**
 * Pure local meal-issue detector for save-time nutritionist alerts (prompt20 Phase 3).
 */

import type { FoodItem } from '../services/GeminiService';
import type { DailyMacroTarget, UserRules } from '../services/TargetService';

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
  userRules: UserRules | null;
  mealTimestamp: number;
};

type RuleKeywordGroup = {
  ruleTerms: string[];
  foodTerms: string[];
};

const RULE_KEYWORD_GROUPS: RuleKeywordGroup[] = [
  { ruleTerms: ['red meat', 'beef'], foodTerms: ['beef', 'steak', 'burger', 'lamb', 'veal', 'bison', 'hamburger'] },
  { ruleTerms: ['pork'], foodTerms: ['pork', 'bacon', 'ham', 'prosciutto', 'sausage', 'chorizo'] },
  { ruleTerms: ['shellfish', 'shrimp', 'prawn'], foodTerms: ['shrimp', 'prawn', 'lobster', 'crab', 'shellfish', 'mussel'] },
  { ruleTerms: ['dairy', 'lactose', 'milk', 'cheese'], foodTerms: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'dairy', 'paneer'] },
  { ruleTerms: ['gluten', 'wheat', 'bread'], foodTerms: ['wheat', 'bread', 'pasta', 'pita', 'flour', 'gluten', 'bagel', 'croissant'] },
  { ruleTerms: ['sugar', 'sweet', 'dessert'], foodTerms: ['sugar', 'cake', 'candy', 'chocolate', 'syrup', 'honey', 'cookie', 'ice cream'] },
  { ruleTerms: ['fried', 'deep fried'], foodTerms: ['fried', 'fries', 'tempura', 'fry'] },
  { ruleTerms: ['alcohol', 'wine', 'beer'], foodTerms: ['alcohol', 'wine', 'beer', 'vodka', 'whiskey', 'cocktail'] },
  { ruleTerms: ['egg'], foodTerms: ['egg', 'omelet', 'omelette', 'shakshuka'] },
  { ruleTerms: ['fish'], foodTerms: ['fish', 'salmon', 'tuna', 'sardine', 'mackerel', 'trout'] },
];

const NEGATION_PATTERN =
  /(?:^|\b)(?:no|avoid|without|skip|exclude|don't|do not|never|limit|reduce)\s+([a-z\u0590-\u05FF][a-z\u0590-\u05FF\s-]{1,48})/gi;

function itemDisplayName(item: FoodItem): string {
  return item.name_local ?? item.name;
}

function itemSearchText(item: FoodItem): string {
  return `${item.name} ${item.name_local ?? ''}`.toLowerCase();
}

function matchesTerm(text: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (t.length < 3) return false;
  return text.includes(t);
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

function extractForbiddenTerms(constraint: string): string[] {
  const terms: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(NEGATION_PATTERN.source, NEGATION_PATTERN.flags);
  while ((match = re.exec(constraint)) !== null) {
    const chunk = match[1]?.trim();
    if (chunk && chunk.length >= 3) terms.push(chunk);
  }
  return terms;
}

function findRuleConflicts(items: FoodItem[], userRules: UserRules | null): MealIssue[] {
  if (!userRules?.constraints?.length) return [];

  const issues: MealIssue[] = [];
  const constraintsLower = userRules.constraints.map((c) => c.toLowerCase());

  for (const item of items) {
    const label = itemSearchText(item);
    const display = itemDisplayName(item);
    const hits: string[] = [];

    for (const constraint of constraintsLower) {
      for (const term of extractForbiddenTerms(constraint)) {
        if (matchesTerm(label, term) || matchesTerm(constraint, display.toLowerCase())) {
          hits.push(constraint);
        }
      }

      for (const group of RULE_KEYWORD_GROUPS) {
        const ruleHit = group.ruleTerms.some((t) => constraint.includes(t));
        if (!ruleHit) continue;
        if (group.foodTerms.some((food) => matchesTerm(label, food))) {
          hits.push(constraint);
        }
      }
    }

    if (hits.length > 0) {
      const uniqueHit = [...new Set(hits)][0];
      issues.push({
        id: `rule-${display}`,
        severity: 'critical',
        code: 'rule_conflict',
        message: `"${display}" may conflict with your rule: ${uniqueHit}`,
        itemNames: [display],
      });
    }
  }

  return issues;
}

export function analyzeMealIssues(input: MealIssueInput): MealIssue[] {
  const { items, dayTotalsBeforeMeal, macroTarget, userRules, mealTimestamp } = input;
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

  issues.push(...findRuleConflicts(items, userRules));
  return issues;
}

export function flaggedItemIndices(items: FoodItem[], issues: MealIssue[]): Set<number> {
  const flaggedNames = new Set(
    issues.flatMap((issue) => issue.itemNames ?? []).map((n) => n.toLowerCase()),
  );
  if (flaggedNames.size === 0) return new Set();

  const indices = new Set<number>();
  items.forEach((item, index) => {
    const names = [item.name, item.name_local ?? ''].map((n) => n.toLowerCase());
    if (names.some((n) => flaggedNames.has(n))) indices.add(index);
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
    })),
  );
}

export function issueModalBody(issues: MealIssue[]): string {
  return issues
    .slice(0, 3)
    .map((i) => i.message)
    .join('\n');
}
