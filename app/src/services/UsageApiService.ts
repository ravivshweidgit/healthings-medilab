import { enqueueUsageEvent } from './UsageQueueService';

export type AiUsageReason =
  | 'ai_meal'
  | 'ai_chat'
  | 'ai_coach'
  | 'ai_macro'
  | 'ai_rules'
  | 'ai_lab'
  | 'ai_help'
  | 'ai_other';

/** Real Gemini usageMetadata for the server's COGS analytics — never wallet math. */
export type GeminiUsageReport = {
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  model: string;
};

/** Build a usage report from a raw Gemini generateContent response body. */
export function geminiUsageFromResponse(json: unknown, model: string): GeminiUsageReport | null {
  const um = (json as { usageMetadata?: Record<string, number> } | null)?.usageMetadata;
  if (!um) return null;
  return {
    promptTokens: um.promptTokenCount ?? 0,
    candidatesTokens: um.candidatesTokenCount ?? 0,
    thoughtsTokens: um.thoughtsTokenCount ?? 0,
    totalTokens: um.totalTokenCount ?? 0,
    model,
  };
}

/**
 * After successful Gemini — enqueue locally (be-33 prepaid bucket).
 * No per-call POST; flush happens at 10 events / 24 h / buy-pack / logout.
 */
export function reportAiUsage(
  reason: AiUsageReason,
  tokens?: number,
  gemini?: GeminiUsageReport | null,
): void {
  void enqueueUsageEvent(reason, tokens, gemini).catch(() => {
    /* non-fatal */
  });
}
