# be-32 — Usage tracking + zero-charge invoices (BILLING_LIVE)

**Status:** done — owner accepted 2026-07-28 (“looks good invoice 0”, “all is good”, “commit”)
**Model to implement:** Fable 5 (Cursor)
**Authored by:** Owner + agent (same session as the be-06 web-chat/two-layer notes)
**Builds on:** be-06 (wallet, `ai_usage_events`, sponsorships), be-15 (`/account/`), be-26 (portal i18n, 10 locales)
**Deployed:** api.healthings.ai · healthings.ai clinic + account
**Implemented:** 2026-07-27…2026-07-28 — `c6bc449`

## Problem

Alpha has real users but no owner-visible usage or billing surface. The owner wants to
**start tracking AI usage now** and run billing **exactly as production will** — invoices
issued per token pack from day one — while charging nobody until a real credit-card PSP
is integrated. One switch must separate the two worlds.

## Design decision — one flag, two layers, no third state

- **`BILLING_LIVE`** (server env, default `false`) is the master card-billing switch.
  - **Off (alpha, now):** the full production flow runs — auto-reload, wallet credit,
    ledger entry, **invoice** — but no PSP is ever contacted and every invoice lands as
    `charged_cents = 0`, `status = 'comped_alpha'`.
  - **On (later):** the *same* code path charges the saved card via Stripe
    (`status 'paid'` with payment-intent ref, or `'failed'` — and a failed live charge
    grants **no** tokens). Flipping the flag requires no schema or flow change, only
    the real PSP onboarding.
- **Two prices on every invoice:** `amount_cents` (list) vs `charged_cents` (actual).
  They differ exactly while alpha comps — that is the point, not a bug.
- Credits (`ai_usage_events.tokens`) stay customer billing; `gemini_*` columns stay
  COGS analytics (be-06 note). Invoices never read Gemini tokens.

## What shipped

### Server

| Piece | Detail |
|-------|--------|
| Schema | `invoices` table + `invoice_number_seq` (`HT-YYYY-000001`), `idx_invoices_user_created`; status ∈ `comped_alpha/paid/failed/pending`, provider ∈ `none/simulated/stripe/manual` |
| Config | `BILLING_LIVE` in `config.ts` + `server/.env.example` (default false) |
| Service | `services/invoices.ts` — `createInvoice`, `listInvoicesForUser` |
| Auto-reload | `payments.ts` `autoReloadTokenPack`: live branch (Stripe charge → paid/failed invoice, no tokens on fail) vs alpha branch (comped invoice, provider `simulated` when a test card is on file, else `none`); `chargeStripePack` now returns the payment-intent id |
| Manual pack | `POST /v1/wallet/add-pack` issues a `manual` comped invoice (admin grant — never charged, even live) |
| Endpoints | `GET /v1/billing/invoices` (returns `billingLive`), `GET /v1/usage/events?limit=` — payer-scoped per-event list (mentor: all covered patients; patient: self) with credits + `gemini_*` per row |

### Web

| Surface | Detail |
|---------|--------|
| Clinic portal | Two always-visible collapsible panels: **AI usage** (summary + per-event table: when, patient, type, model, Gemini tokens, credits) and **Billing & invoices** (balance, payment method, alpha note, invoice table). Old dev-only wallet buttons moved inside the billing panel, still `?dev=1` |
| `/account/` | New **Usage & billing** tab — patient's own credits balance, events, invoices. `selfOnly: true` in `ALL_TABS`: on the clinic patient page the payer-scoped endpoint would show the mentor's whole-clinic ledger, so the tab is account-only |
| i18n | 27 new keys × 10 locales in `clinic-i18n.js` (single source; a stale 7-locale draft in `clinic-workspace-i18n.js` was removed). Reason codes render verbatim (`ai_chat`) — glossary, not translated |
| Locale switch | Usage/billing panels cached in `billingState` and re-painted by `applyLocale` → `paintBillingPanels` |
| Account locale | `/account/` uses `healthings_account_locale` (independent of clinic); language picker on gate + app chrome; defaults to browser language |
| CSS | `.usage-table` in `clinic-portal.css`; dark-theme polish (filters, row actions, sponsor chip green ink, name/email cells) |

### Files

`server/src/db/schema.sql` · `server/src/config.ts` · `server/src/services/invoices.ts` (new) ·
`server/src/services/payments.ts` · `server/src/services/usage.ts` · `server/src/routes/wallet.ts` ·
`server/src/routes/usage.ts` · `website/clinic/index.html` · `website/clinic/clinic-i18n.js` ·
`website/clinic/clinic-workspace.js` · `website/clinic/clinic-portal.css` · `website/account/index.html` ·
`website/clinic/patient.html` (cache bust only)

## Going live later (the switch-on plan)

1. Integrate real PSP (Stripe Checkout for card capture replaces `payment-method/simulate`).
2. Set `BILLING_LIVE=true` in `server/.env` on the VPS; restart.
3. Nothing else — invoices, wallet, auto-reload flow are already production-shaped.

## Locked decisions from owner review (2026-07-28) — for the follow-up batches

Settled in the review conversation; recorded here so the next batches do not re-derive them.

### Billing model — prepaid everywhere, no subscription

- **Patients and clinics both run on prepaid packs.** "Subscription limit" in discussion meant
  pack size / remaining credits, not a monthly plan. A plan that *includes* N credits/month may
  land later on top of the same wallet — the meter stays prepaid.
- **Clinic = prepaid + auto-reload on saved card** (pay-as-you-go with automatic top-up, the
  Cursor/OpenAI credits model). No end-of-month surprise invoices for small clinics.

### Card failure must degrade payment routing, never clinical state (BILLING_LIVE batch)

- Failed auto-reload today (live branch): no tokens granted, debit still lands → balance can go
  negative silently. That gap is accepted for alpha and closed in the `BILLING_LIVE=true` batch:
  1. **Grace floor** (~1 pack negative) with email dunning + card retry for a few days.
  2. Grace exhausted → **pause coverage, do not unsponsor**: sponsorship rows keep their expiry
     dates; `resolveAiPayer` falls back to the patient's own wallet until the clinic settles,
     then coverage resumes automatically.
- Payer routing stays as shipped: phone AI → sponsor if covered; clinic portal chat → acting
  mentor always; `/account/` self-chat → patient always (be-15 exception).

### Phone prepaid bucket — Gemini stays on-device (be-33 candidate)

Owner explicitly rejected proxying Gemini through the server (server load). Locked model:

1. Buy bucket → server grants pack + invoice → phone stores `creditsLeft`.
2. Each AI call gates on **local** `creditsLeft` (no per-call wallet API hit); Gemini called
   directly from the phone as today; local usage row appended, `creditsLeft -= cost`.
3. Upload the local log **every N events or daily** (app foreground ≥ 24h, before buy-pack, on
   logout). Server writes `ai_usage_events` (+ Gemini metadata), settles the wallet, and returns
   the authoritative `creditsLeft`, which the phone adopts.
4. Local counter is a **soft gate only** — wallet and pack purchase stay server-side truth
   (uninstall/second device must not mint credits).
5. Until be-33 ships, the current per-call fire-and-forget `POST /v1/usage/ai` stays.

## Acceptance

- [x] Typecheck clean; deployed; `npm run migrate` OK; health OK (`DEPLOY_OK`)
- [x] New endpoints live (401 unauthenticated — routes registered)
- [x] Live pages serve new markup + cache tokens (verified via curl)
- [x] Owner: manual pack (`?dev=1`) produces an `HT-…` invoice at zero charge
- [x] Owner: clinic chat turn appears in AI usage panel with Gemini tokens (screenshot
      2026-07-28 — `ai_chat · gemini-2.5-flash · 73,892 / 72,850 tokens · 1 credit`; DB rows
      confirm payer routing: clinic chat → mentor wallet, account chat → patient wallet)
- [x] Owner: `/account/` Usage & billing tab shows patient-side events
- [x] Owner: account language picker independent of clinic locale

## Out of scope / deferred

- Real PSP integration (Stripe Checkout + webhooks) **+ grace/pause-coverage dunning above** —
  the `BILLING_LIVE=true` batch
- Phone prepaid bucket + batch usage upload — be-33 (locked design above)
- Invoice PDF / email delivery; VAT/tax fields
- Spending/COGS margin view (Gemini cost × pricing) — query exists, no UI yet. First live data
  point: web chat turns run ~70k Gemini tokens ≈ a few cents COGS vs $0.05/credit — thin margin,
  watch prompt size
- Localized human labels for reason codes (`ai_chat` etc. render verbatim)
- Full localization of `/account/` gate sign-in copy (picker + workspace chrome shipped; some gate
  English remains)
- Phone events carry `gemini` usage only after the next APK/TestFlight release (app-side
  code included in this commit)

## Related

- be-06 — wallet + two-layer usage notes (2026-07-27) live in its done spec
- be-15 — `/account/` self-view exceptions (self-chat debits patient)

## Agent checklist

- [x] Implemented + deployed with evidence above
- [x] Owner accepted → moved to `done/`, READMEs updated
- [x] Commit hash noted after commit
