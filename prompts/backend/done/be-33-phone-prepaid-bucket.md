# be-33 — Phone prepaid bucket: local credit gate + batch usage upload

**Status:** done
**Model to implement:** Fable 5 (Cursor) — cross-cutting server + app batch
**Authored by:** Owner + agent (design locked in be-32 review, 2026-07-28)
**Depends on:** be-32 (invoices, `gemini_*` columns, `/v1/usage/events`); app prompt series (Gemini stays on-device)
**Shipped:** 2026-07-28 — phone-tested (`bi`); batch flush verified live (10 events, `client_event_id`)

## Problem

The phone calls Gemini directly (owner decision: no server proxy — server load), but it
reports usage with a fire-and-forget `POST /v1/usage/ai` on **every** AI call and has **no
gate at all**: a patient with an empty wallet still gets AI forever. When `BILLING_LIVE`
turns on, that becomes free service; and per-call reporting is exactly the chatter the
owner wants off the server.

## Goal

The locked prepaid-bucket model from be-32:

1. **Buy bucket** → server grants pack + `HT-…` invoice (be-32) → phone stores `creditsLeft`.
2. **Each AI call** gates on **local** `creditsLeft` — no wallet API hit in the hot path.
   Gemini is still called directly from the phone. On success: append a local usage row,
   `creditsLeft -= cost`.
3. **Flush the local log** when any of: queue ≥ **10 events** · app foreground and last
   flush ≥ **24 h** · before buy-pack · on logout.
4. **Server settles**: writes `ai_usage_events` (credits + Gemini metadata), debits the
   resolved payer, returns the authoritative `creditsLeft` — which the phone adopts.
5. Local counter is a **soft gate only**; wallet and packs stay server-side truth
   (uninstall / second device must not mint credits).

## Files to touch

### Server

- `server/src/routes/usage.ts` — new `POST /v1/usage/ai/batch`:
  - body `{ events: [{ clientEventId, reason, tokens?, gemini?, occurredAt }] }`, max 200 rows
  - patient role only (same as `/v1/usage/ai`); meters each event via `meterAiUsage`
  - response `{ recorded, duplicates, wallet }` where `wallet` is the payer-aware
    `getWalletForUser` view — the phone adopts `balanceTokens` as `creditsLeft`
- `server/src/db/schema.sql` — `ai_usage_events.client_event_id UUID` + partial unique
  index (idempotency: a retried flush must not double-debit); `occurred_at TIMESTAMPTZ`
  (event time on the phone; `created_at` stays upload time)
- `server/src/services/usage.ts` — `meterAiUsage` accepts `clientEventId` / `occurredAt`;
  duplicate insert → skip debit, count as `duplicates`

### App

- `app/src/services/UsageQueueService.ts` (new) — AsyncStorage keys
  `usage_queue_v1` (pending rows) and `usage_credits_left_v1`; enqueue, flush (with the
  four triggers), adopt server balance after flush and after `GET /v1/wallet` on login/open
- `app/src/services/UsageApiService.ts` — `reportAiUsage` becomes enqueue-only
  (delete the per-call `POST /v1/usage/ai`; the route stays for old app versions)
- `app/src/services/GeminiService.ts` — before each Gemini call
  (`ai_meal` ~881, `ai_coach` ~2176, `ai_chat` ~2613): if not sponsored and
  `creditsLeft <= 0` → throw a typed `OutOfCreditsError`; callers show
  "Out of AI credits" + buy-pack path instead of the generic failure toast
- `app/src/services/ShareExportService.ts` + `LocalBackupService` — add both new keys to
  the **shared** ephemeral-exclusion list (billing telemetry, not health data; update both
  per persistence-parity)

### Do not touch

- Gemini call transport (stays phone-direct — owner decision)
- Web chat metering (`meterClinicChat` / `meterPatientSelfChat` — server-side, immediate)
- Pack/invoice flow (be-32)

## Implementation notes

- **Sponsored patients**: gate is bypassed when the last wallet sync says `sponsored: true`
  (clinic pays; clinic-side grace/pause lands in the `BILLING_LIVE=true` batch). Stale
  sponsorship on the phone self-corrects at the next flush — payer is resolved server-side
  at upload time.
- **Alpha behavior unchanged in practice**: server auto-reload comps packs while
  `BILLING_LIVE=false`, so the returned `creditsLeft` rarely hits 0. The gate becomes real
  the day the flag flips — that is the point of shipping it now.
- **Crash safety**: persist the queue row *before* decrementing `creditsLeft`; flush is
  at-least-once, `client_event_id` makes it exactly-once on the server.
- **Clock**: `occurredAt` from the phone is display/analytics only — never billing order.
- No `Platform.OS` in keys; one canonical key set (persistence-parity rule).

## Acceptance criteria

- [ ] Phone AI works offline-queue: airplane-mode chat → row queued, credits decremented locally
- [ ] Flush at 10 events / 24 h foreground / before buy-pack / logout — verified in logs
- [ ] Retried flush does not double-debit (`duplicates` > 0, wallet unchanged)
- [ ] `creditsLeft` adopts server value after flush (drift heals)
- [ ] Zero local credits + not sponsored → AI blocked with buy-pack UX; sponsored → not blocked
- [ ] `ai_usage_events` rows from phone carry `gemini_*` metadata (be-32 columns)
- [ ] Old app versions (per-call `POST /v1/usage/ai`) keep working
- [ ] Clinic AI usage panel shows phone events after flush

## Out of scope

- Real PSP / `BILLING_LIVE=true`, grace + pause-coverage dunning (own batch; decisions in be-32)
- Buy-pack purchase UI polish beyond a working path to add a pack
- Subscription plans (owner: prepaid stays the meter)
- COGS/margin dashboard

## Review by owner (after implementation)

**Evidence to capture**

- Log excerpt of one full cycle: queue → flush → server `recorded/duplicates/wallet` → adopted balance
- DB rows for a phone flush showing `client_event_id`, `occurred_at`, `gemini_total_tokens`
- Screenshot of blocked-AI UX at zero credits

**Judgment calls to check**

- Is 10-events/24 h the right flush cadence for real usage, or too chatty / too stale?
- Does the out-of-credits screen read as a purchase prompt, not an error?
- Phone-tested (`bi`) on Android before TestFlight (crash-debug-android-first).

## What shipped (code)

### Server
- `schema.sql` — `client_event_id`, `occurred_at`, unique index
- `services/usage.ts` — `meterAiUsageResult` insert-first + ON CONFLICT for idempotent flush
- `routes/usage.ts` — `POST /v1/usage/ai/batch` → `{ recorded, duplicates, wallet }`; legacy `/v1/usage/ai` kept

### App
- `UsageQueueService.ts` — queue, soft credits, flush triggers, `OutOfCreditsError`
- `UsageApiService.ts` — `reportAiUsage` → enqueue only
- `GeminiService.ts` — gate before meal / coach / chat
- `App.tsx` — foreground `flushUsageQueueIfDue`
- `AuthApiService.logoutAuth` — flush before clearing tokens
- `ShareApiService.addTokenPack` — flush then grant; ClinicLinkStrip “Add AI token pack”
- Backup/export exclusion lists updated (parity)

## Agent checklist

- [x] Status → in_progress
- [x] Server endpoint + schema; typecheck (`tsc` ok)
- [x] Deploy + migrate on VPS
- [x] App queue/gate
- [x] `bi` phone test + evidence (10-event batch flush on live API)
- [x] Status → needs-review
- [x] Owner acceptance → done/
