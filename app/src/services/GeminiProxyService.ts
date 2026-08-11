/**
 * Gemini via server proxy (be-40) — the app never holds the API key.
 *
 * The server pins the model, debits the payer wallet per call (exactly-once via
 * clientEventId), and passes the raw generateContent response through. The
 * returned object mimics the fetch Response surface (`ok` / `status` /
 * `json()` / `text()`) so existing call sites keep their control flow.
 */

import { authFetch } from './AuthApiService';
import { adoptWalletCredits, OutOfCreditsError, randomUuid } from './UsageQueueService';
import type { AiUsageReason } from './UsageApiService';

/** Gemini itself can take a minute on big prompts; well above authFetch's 8s default. */
const PROXY_TIMEOUT_MS = 180_000;

export type GeminiProxyResponse = {
  ok: boolean;
  status: number;
  /** Same loose typing as fetch Response.json() so call sites keep their shape. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: () => Promise<any>;
  text: () => Promise<string>;
};

type ProxySuccessBody = {
  response: unknown;
  wallet?: { balanceTokens: number; sponsored: boolean };
};

export async function geminiGenerate(
  reason: AiUsageReason,
  body: unknown,
): Promise<GeminiProxyResponse> {
  const res = await authFetch(
    '/v1/ai/generate',
    {
      method: 'POST',
      body: JSON.stringify({ clientEventId: randomUuid(), reason, body }),
    },
    { timeoutMs: PROXY_TIMEOUT_MS },
  );

  if (res.status === 402) throw new OutOfCreditsError();

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return {
      ok: false,
      status: res.status,
      json: async () => ({}),
      text: async () => errText,
    };
  }

  const data = (await res.json()) as ProxySuccessBody;
  if (data.wallet) {
    void adoptWalletCredits(data.wallet).catch(() => {
      /* non-fatal */
    });
  }
  return {
    ok: true,
    status: res.status,
    json: async () => data.response,
    text: async () => JSON.stringify(data.response ?? {}),
  };
}
