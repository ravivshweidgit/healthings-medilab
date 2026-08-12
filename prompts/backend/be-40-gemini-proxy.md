# be-40 — Gemini proxy: get the API key out of the APK

**Status:** needs-review (implemented 2026-08-11 — evidence below; not deployed, key not rotated)  
**Model to implement:** Auto (mechanical wiring) + Opus/strong model for the rollout/rotation call  
**Authored by:** Owner + agent (security review, 2026-08-11 chat)  
**Depends on:** be-06 (wallet / `resolveAiPayer`), be-32 (usage events), be-36 (`geminiTextWithUsage`)

## Problem

`GEMINI_API_KEY` is compiled into every APK/TestFlight build via `@env`
(`app/src/services/GeminiService.ts` line 2; endpoint constant ~line 523 puts it in the
URL query string). Anyone can unzip the APK and grep `index.android.bundle` for `AIza`,
or MITM their own phone, and get the global key. With the key, they call Google
directly — bypassing `assertCanSpendCredits`, the wallet, sponsorship, and all COGS
metering. Obfuscation, heap-loading, or fetching the key per call do **not** fix this:
anything the client holds is readable on rooted hardware. The key must never reach the
client.

## Goal

- App makes **zero** direct calls to `generativelanguage.googleapis.com`.
- New authenticated endpoint `POST /v1/ai/generate` on `api.healthings.ai` forwards
  Gemini requests using the server key (already in `server/.env` for clinic chat).
- Wallet debits become **server-enforced** (reuse `resolveAiPayer` + wallet service);
  client `assertCanSpendCredits` stays as a fast precheck only.
- Old key **rotated** after pilot phones are on the proxied build.

## Files to touch

- `server/src/routes/ai.ts` (new) — `POST /v1/ai/generate`
- `server/src/services/geminiProxy.ts` (new) — thin forwarder; reuse the fetch/usage
  plumbing from `server/src/services/geminiClinic.ts` (`geminiTextWithUsage`)
- `server/src/index.ts` (or router registration) — mount route, raise JSON body limit
  **for this route only** (meal photos are inline base64, allow ~10 MB)
- `app/src/services/GeminiService.ts` — `GEMINI_ENDPOINT` → `authFetch('/v1/ai/generate')`
- `app/src/logic/recipePlanService.ts` — second `GEMINI_API_KEY` consumer, same swap
- `app/.env.example`, `app/env.d.ts` — remove `GEMINI_API_KEY`
- Do **not** touch: clinic portal chat (`geminiClinic.ts` flows), `/account/` patient
  web chat — they are already server-side.

## Implementation notes

### Server contract

```
POST /v1/ai/generate      (JWT required — same middleware as /v1/usage)
{
  "reason": "ai_chat" | "ai_meal" | "ai_help" | "ai_other",   // wallet reason
  "body": { contents, generationConfig, ... }                  // raw Gemini request
}
→ 200: raw Gemini response JSON (pass-through)
→ 402: { error: "out_of_credits" }   → app maps to OutOfCreditsError
→ 429: rate limited
```

- **Whitelist, don't trust:** server pins the model (`gemini-2.5-flash`), caps
  `maxOutputTokens` (≤ 8192) and inline image bytes; reject anything else. The proxy
  must not be a general-purpose Gemini gateway.
- **Debit before forward:** `resolveAiPayer(userId)` → check balance → forward →
  write `ai_usage_events` with real `usageMetadata` (same two-layer scheme as be-06
  note 2026-07-27). Insufficient balance → 402 without calling Google.
- **Rate limit:** per-user, generous for alpha (e.g. 30 req/min) — abuse brake, not UX.
- **Privacy — transit only:** prompt bodies contain health data (meals, metrics, rules).
  The proxy must never log or persist request/response bodies — only usage metadata
  (`ai_usage_events`). Keeps the "server never reads health JSON" principle true in
  practice. Prompt building stays on the phone (local-first); moving it server-side is
  explicitly rejected.
- App side: one shared helper replaces the ~15 `fetch(GEMINI_ENDPOINT, …)` call sites;
  keep request/response shapes identical so no per-feature changes. `OutOfCreditsError`
  now also thrown on 402.
- Keep client `assertCanSpendCredits` precheck (saves a round-trip when clearly empty),
  but it is no longer the enforcement point.

## Rollout & key rotation (order matters)

1. Ship server endpoint; deploy to `api.healthings.ai` (old direct path still works).
2. Ship proxied app build; **bi** + TestFlight; confirm chat, meal photo, Help, macro
   ask, and lab PDF import all work through the proxy.
3. Tell pilot users to update (one WhatsApp message); allow ~a day of overlap.
4. **Rotate the Gemini key** in Google Cloud console. Old builds lose AI → they update.
5. Until step 4: stopgap in console — restrict key to Generative Language API + hard
   quota cap (5 minutes, do immediately, no code).

## Acceptance criteria

- [x] `grep -r "generativelanguage" app/src` → no direct endpoint outside a comment
- [x] `grep AIza` on a fresh `index.android.bundle` → nothing (2026-08-11: key bytes and
      `generativelanguage` both absent from `assets/index.android.bundle` in the release APK)
- [x] Phone (2026-08-11, owner): coach/chat, meal photo, Help Q&A, macro reanalyze work through the proxy
- [x] Play internal 1.2.31 (`versionCode` 60) released 2026-08-11 19:42 — available to internal testers (not reviewed; expected on that track)
- [x] Play internal 1.2.32 (`versionCode` 61) released 2026-08-12 03:18 — treatment markers + clinic past-fill; internal testers (not reviewed)
- [ ] Draining wallet to 0 → app shows out-of-credits (server 402), Google not called
- [ ] `ai_usage_events` rows carry real `gemini_*` usage columns for proxied calls
- [ ] Old key revoked; old APK build fails AI calls (proof enforcement is real)

## What shipped (2026-08-11, needs-review)

- **Server** — `server/src/services/geminiProxy.ts` (sanitizing forwarder: model pinned,
  `maxOutputTokens ≤ 32768`, `thinkingBudget ≤ 8192` — chat turns legitimately use both —
  temperature/`responseMimeType` whitelisted, everything else dropped) and
  `server/src/routes/ai.ts` (`POST /v1/ai/generate`, JWT + patient role, 15 MB route
  bodyLimit for meal photos / lab PDFs, 30 req/min per-route rate limit). Registered in
  `index.ts`. Balance gate before Google: `resolveAiPayer` → `ensurePayerBalance`
  (auto-reload, comped while `BILLING_LIVE=false`) → 402 only if reload can't cover.
  Debit after successful forward via `meterAiUsageResult` with `clientEventId`
  (exactly-once on client retry); response carries `{ response, wallet }` so the phone
  adopts authoritative credits. No body logging anywhere on the route.
- **App** — new `app/src/services/GeminiProxyService.ts` (`geminiGenerate(reason, body)`
  mimics the fetch Response surface, throws `OutOfCreditsError` on 402, adopts the
  returned wallet). All 15 `fetch(GEMINI_ENDPOINT)` sites in `GeminiService.ts` plus the
  one in `recipePlanService.ts` swapped, each with its wallet reason. `GEMINI_API_KEY`
  removed from `env.d.ts`, `.env.example`, `eas-write-dotenv.js`.
- **Billing semantics change** — the server now meters **every** Gemini call, including
  auxiliary ones the phone never reported (meal rules check, body targets, gauge repair,
  chat-day summary, blended-reply split). Client-side `reportAiUsage` removed from
  proxied paths; the be-33 queue stays for legacy builds. Per-flow credit burn rises
  slightly and be-35 margin "revenue" now counts these events — retune credit pricing
  before `BILLING_LIVE=true`.
- Server `npx tsc --noEmit` clean; release APK builds; bundle grep clean (see above).

**Remaining before done:** tell Play internal testers to update to 1.2.32; iOS still on
the old TestFlight until `bi-os`; **then** rotate the old key. Local `app/.env` still
holds the old key — harmless (not imported, not bundled) but rotate regardless. Do not
revoke until old APKs / old TestFlight are off pilot phones.

## Out of scope

- Play Integrity / App Check attestation — public-launch item, not alpha
- Streaming responses (app is non-streaming today)
- Firebase AI Logic migration — VPS proxy chosen for wallet enforcement

## Review by Opus 5 (after Auto marks done)

**Evidence to capture**

- `adb`-pulled release bundle grep for `AIza` (before/after)
- Server log of one proxied meal-photo call with usage metadata + wallet debit
- Screenshot of 402 out-of-credits path on phone

**Judgment calls to check**

- Body-size limit: does a worst-case multi-photo meal still fit? Photos must not break
  while text silently works.
- Rotation timing: confirm every active pilot phone updated before revoke — a mid-week
  AI blackout for Michal's patients is the failure mode.
- Is the request whitelist tight enough that a stolen JWT can only spend its own
  wallet, not run arbitrary models/params?
- Confirm no middleware (access logs, error handlers, crash reporters) captures
  request bodies on this route — health data must not land in server logs.

## Agent checklist

- [x] Status → in_progress
- [x] Changes match this draft only (one deviation, documented: server meters every call
      incl. auxiliary ones — see "What shipped")
- [x] Smoke criteria above (compile + bundle grep; phone flows pending deploy)
- [x] Status → `needs-review` and evidence attached — do NOT self-move to done
- [x] Update `prompts/backend/README.md` table
