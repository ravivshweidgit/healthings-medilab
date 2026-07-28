# be-35 — COGS / margin glance (credits revenue vs Gemini cost)

**Status:** done (2026-07-28) — owner accepted live `?dev=1` margin panel with real usage
**Model to implement:** Fable 5 (Cursor)
**Authored by:** Owner + agent (deferred item from be-32; first live data point flagged thin margin)
**Depends on:** be-32 (`gemini_*` columns, usage panel), be-33 (phone events now carry Gemini metadata)

## Problem

The owner's first live data point: one web chat turn ≈ 70k Gemini tokens (a few cents of
real Google cost) against $0.05 of credit revenue — thin margin, driven by prompt size.
All the raw data is already in `ai_usage_events`; there is no view that turns it into
revenue vs COGS vs margin. The owner needs this glance **before** `BILLING_LIVE=true`
makes the numbers real money.

## Goal

A dev-gated (`?dev=1`) margin block in the clinic portal:

- Per-day (last 30 days): events, credits, revenue, estimated Gemini COGS, margin
- Per-reason breakdown (`ai_chat`, `ai_coach`, `ai_meal`, …) — shows which surface eats margin
- Totals row

**Dev-gated on purpose:** margin is Healthings' unit economics, not the clinic's. A real
clinic must not see our cost structure; the owner's mentor account with `?dev=1` does.

## Design

- **Revenue** = credits × `TOKEN_PACK_PRICE_CENTS / TOKEN_PACK_SIZE` (list price; alpha comps
  are "revenue at list" — that is what the margin will be when live).
- **COGS estimate** = `gemini_prompt_tokens` × input rate + (`candidates` + `thoughts`) × output
  rate. Thoughts bill as output at Google. Rates are config, not code:
  `GEMINI_INPUT_COST_PER_MTOK_CENTS` (default 30 = $0.30/M) and
  `GEMINI_OUTPUT_COST_PER_MTOK_CENTS` (default 250 = $2.50/M) — Gemini 2.5 Flash list.
- Pure math on stored numbers — no AI judgment, no name parsing (ai-judgment-not-regex is
  trivially respected; the boundary is noted anyway).
- Events without Gemini metadata (old app builds) count toward revenue with 0 COGS — the
  view marks how many events lacked metadata so the estimate's coverage is visible.

## What shipped

- `server/src/config.ts` — the two rate envs
- `server/src/services/usage.ts` — `getMarginForPayer(payerUserId, days)`
- `server/src/routes/usage.ts` — `GET /v1/usage/margin?days=` (auth, payer-scoped)
- `website/clinic/index.html` — dev-only margin block inside the AI usage panel; cached in
  `billingState`, repainted on locale switch
- `website/clinic/clinic-i18n.js` — 12 keys × 10 locales
- `server/.env.example` — document the rates

## Acceptance criteria

- [x] `?dev=1` mentor: margin table shows days with data; revenue/COGS/margin consistent with events
- [x] Non-dev portal: block absent (`dev-only` class + render guard both hide it)
- [x] Events missing `gemini_*` counted, flagged in a coverage line (live: 15 of 41)
- [x] Locale switch repaints the block (wired through `paintBillingPanels`)
- [x] tsc clean; deployed; endpoint 401 unauthenticated

## Out of scope

- Charts; CSV export
- Live Google billing reconciliation (rates are estimates)
- Prompt-size optimization itself (this view is what justifies that batch)

## Agent checklist

- [x] Server endpoint + config; typecheck
- [x] Portal dev block + i18n (12 keys × 10 locales)
- [x] Deploy + verify; owner review with real usage
