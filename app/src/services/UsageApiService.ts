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

/** After successful Gemini — debit payer; server auto-reloads card if balance low. */
export function reportAiUsage(reason: AiUsageReason, tokens?: number): void {
  void (async () => {
    try {
      const t = await loadAuthTokens();
      if (!t?.accessToken) return;
      await authFetch('/v1/usage/ai', {
        method: 'POST',
        body: JSON.stringify({ reason, tokens }),
      });
    } catch {
      /* non-fatal */
    }
  })();
}
