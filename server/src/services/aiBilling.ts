import { config } from '../config.js';

export type AiUsageReason = 'ai_meal' | 'ai_chat' | 'ai_coach' | 'ai_macro' | 'ai_rules' | 'ai_lab' | 'ai_other';

const TOKEN_COST: Record<AiUsageReason, number> = {
  ai_meal: config.AI_TOKENS_PER_MEAL,
  ai_chat: config.AI_TOKENS_PER_CHAT_TURN,
  ai_coach: config.AI_TOKENS_PER_CHAT_TURN,
  ai_macro: 1,
  ai_rules: 1,
  ai_lab: 2,
  ai_other: 1,
};

export function tokensForReason(reason: AiUsageReason, override?: number): number {
  if (override != null && override > 0) return override;
  return TOKEN_COST[reason] ?? 1;
}
