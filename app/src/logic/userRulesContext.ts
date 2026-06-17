/**
 * Shared My Rules text — same source as mentor coach/chat USER DATA header.
 */

import type { UserRules } from '../services/TargetService';

/** Lines injected into coach panel and chat (matches RulesStrip / GeminiService). */
export function formatUserRulesLines(rules: UserRules): string[] {
  const lines: string[] = [];
  lines.push(
    rules.summary
      ? `My Rules — AI understood (${rules.summary}):`
      : 'My Rules — AI understood:',
  );
  if (rules.constraints.length > 0) {
    lines.push(...rules.constraints.map((c) => `- ${c}`));
    if (rules.rawText?.trim()) {
      lines.push(`- Original: ${rules.rawText.trim().replace(/"/g, "'")}`);
    }
    return lines;
  }
  if (rules.aiContext) {
    lines.push(`- ${rules.aiContext}`);
    return lines;
  }
  const raw = rules.rawText?.trim();
  if (raw) lines.push(`- ${raw.replace(/"/g, "'")}`);
  return lines;
}

export function formatUserRulesBlock(rules: UserRules): string {
  return formatUserRulesLines(rules).join('\n');
}
