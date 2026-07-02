/**
 * Active nutritionist directive — verbatim text injected before My Rules in AI context.
 */

import type { NutritionDirective } from '../services/NutritionDirectiveService';

export function formatActiveDirectiveBlock(directive: NutritionDirective): string {
  const datePart = directive.sessionDate
    ? directive.sessionDate.slice(0, 10)
    : directive.importedAt.slice(0, 10);
  return [
    '=== NUTRITIONIST DIRECTIVE (active — authoritative over My Rules on conflict) ===',
    `${directive.title} · ${datePart}`,
    '',
    directive.fullText.trim(),
  ].join('\n');
}

/** Meal / macro checks — directive block first, then My Rules. */
export function formatDirectiveAndRulesForChecks(
  directiveBlock: string | null | undefined,
  rulesBlock: string,
): string {
  if (!directiveBlock?.trim()) return rulesBlock;
  return `${directiveBlock.trim()}\n\n${rulesBlock}\n\nOn conflict, NUTRITIONIST DIRECTIVE wins over My Rules.`;
}
