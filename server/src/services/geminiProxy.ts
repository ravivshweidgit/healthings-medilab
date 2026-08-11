/**
 * Gemini proxy forwarder (be-40) — the phone never holds the API key.
 *
 * PRIVACY: request bodies contain patient health data (meals, metrics, rules).
 * Transit only — never log or persist contents/response; only usageMetadata
 * flows into ai_usage_events.
 */

import { config } from '../config.js';
import type { GeminiUsage } from './geminiClinic.js';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 90_000;

/** Server-pinned caps — the client cannot raise these. Chat turns legitimately
 * use 32768 output / 8192 thinking (long /30 reviews). */
const MAX_OUTPUT_TOKENS = 32768;
const MAX_THINKING_BUDGET = 8192;

type GenerationConfigIn = {
  temperature?: unknown;
  maxOutputTokens?: unknown;
  responseMimeType?: unknown;
  thinkingConfig?: { thinkingBudget?: unknown } | null;
};

type GeminiRequestIn = {
  contents: unknown[];
  generationConfig?: GenerationConfigIn | null;
};

export type GeminiProxyResult = {
  status: number;
  json: unknown | null;
  usage: GeminiUsage | null;
};

/**
 * Whitelist, don't trust: rebuild the forwarded body from known fields only.
 * Model is pinned by the endpoint; tools/system extensions are dropped.
 */
function sanitizeRequest(input: GeminiRequestIn): Record<string, unknown> {
  const out: Record<string, unknown> = { contents: input.contents };
  const gc = input.generationConfig;
  if (gc && typeof gc === 'object') {
    const cfg: Record<string, unknown> = {};
    if (typeof gc.temperature === 'number' && gc.temperature >= 0 && gc.temperature <= 2) {
      cfg.temperature = gc.temperature;
    }
    if (typeof gc.maxOutputTokens === 'number') {
      cfg.maxOutputTokens = Math.min(Math.max(1, Math.floor(gc.maxOutputTokens)), MAX_OUTPUT_TOKENS);
    }
    if (gc.responseMimeType === 'application/json') {
      cfg.responseMimeType = 'application/json';
    }
    const budget = gc.thinkingConfig?.thinkingBudget;
    if (typeof budget === 'number' && budget >= 0) {
      cfg.thinkingConfig = {
        thinkingBudget: Math.min(Math.floor(budget), MAX_THINKING_BUDGET),
        includeThoughts: false,
      };
    }
    if (Object.keys(cfg).length > 0) out.generationConfig = cfg;
  }
  return out;
}

function usageFromResponse(json: unknown): GeminiUsage | null {
  const um = (json as { usageMetadata?: Record<string, number> } | null)?.usageMetadata;
  if (!um) return null;
  return {
    promptTokens: um.promptTokenCount ?? 0,
    candidatesTokens: um.candidatesTokenCount ?? 0,
    thoughtsTokens: um.thoughtsTokenCount ?? 0,
    totalTokens: um.totalTokenCount ?? 0,
    model: GEMINI_MODEL,
  };
}

export async function forwardGeminiGenerate(input: GeminiRequestIn): Promise<GeminiProxyResult> {
  if (!config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured on server');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sanitizeRequest(input)),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });

  const json = (await response.json().catch(() => null)) as unknown;
  return { status: response.status, json, usage: usageFromResponse(json) };
}
