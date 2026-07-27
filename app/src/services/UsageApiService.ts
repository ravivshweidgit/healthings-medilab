import { authFetch } from './AuthApiService';
import { loadAuthTokens } from './AuthTokenStore';

export type AiUsageReason =
  | 'ai_meal'
  | 'ai_chat'
  | 'ai_coach'
  | 'ai_macro'
  | 'ai_rules'
  | 'ai_lab'
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

/** After successful Gemini — debit payer; server auto-reloads card if balance low. */
export function reportAiUsage(
  reason: AiUsageReason,
  tokens?: number,
  gemini?: GeminiUsageReport | null,
): void {
  void (async () => {
    try {
      const t = await loadAuthTokens();
      if (!t?.accessToken) return;
      await authFetch('/v1/usage/ai', {
        method: 'POST',
        body: JSON.stringify({ reason, tokens, gemini: gemini ?? undefined }),
      });
    } catch {
      /* non-fatal */
    }
  })();
}
