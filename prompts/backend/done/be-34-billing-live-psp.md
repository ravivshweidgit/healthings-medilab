# be-34 — BILLING_LIVE=true: real Stripe charges, grace floor, pause-coverage dunning

**Status:** done — owner accepted dark deploy 2026-07-28 (Add card → expected “Stripe not configured”)
**Model to implement:** Fable 5 (Cursor)
**Authored by:** Owner + agent (decisions locked in be-32 review, 2026-07-28)
**Depends on:** be-32 (invoices, `BILLING_LIVE`, auto-reload branches), be-33 (phone bucket flush), be-06 (wallet)
**Shipped:** 2026-07-28 — deployed dark (`BILLING_LIVE=false`); flag flip waits on Stripe onboarding
**Note:** Live card charges / grace / pause-coverage are implemented but inert until keys + `BILLING_LIVE=true`.

## Problem

The billing pipeline is production-shaped but two gaps block flipping `BILLING_LIVE=true`:

1. **No real card capture.** `payment-method/simulate` fakes a card; there is no Stripe
   Checkout, so `chargeStripePack` has nothing real to charge.
2. **Card failure degrades clinical state.** In the live branch today, a failed
   auto-reload grants no tokens but the debit still lands — the balance goes negative
   silently, forever. be-32 locked the fix: failure must degrade **payment routing**,
   never sponsorships or data shares.

## Goal (locked in be-32 — do not re-derive)

- **Prepaid everywhere, no subscription.** Clinics = prepaid + auto-reload on saved card
  (the Cursor/OpenAI credits model). No end-of-month surprise invoices.
- **Grace floor:** balance may go ~1 pack negative (`-TOKEN_PACK_SIZE`). While in grace:
  AI keeps working, email dunning + card retry for a few days.
- **Grace exhausted → pause coverage, never unsponsor:** sponsorship rows keep their
  expiry dates; `resolveAiPayer` falls back to the patient's own wallet until the clinic
  settles, then coverage resumes automatically. Data shares are untouched.
- A failed live charge grants **no** tokens and issues a `failed` invoice (shipped in be-32).

## Files to touch

### Server

- `server/src/config.ts` — `STRIPE_WEBHOOK_SECRET`, `BILLING_GRACE_TOKENS`
  (default `TOKEN_PACK_SIZE`), `BILLING_RETRY_SCHEDULE_DAYS` (default `1,3,5`)
- `server/src/db/schema.sql` — dunning state on `wallets`:
  `delinquent_since TIMESTAMPTZ`, `charge_attempts INT DEFAULT 0`,
  `coverage_paused BOOLEAN DEFAULT FALSE` (idempotent ALTERs for live DB)
- `server/src/services/payments.ts`
  - **Card capture:** `POST /v1/billing/checkout-session` → Stripe Checkout `mode=setup`
    (customer + saved payment method); success/cancel URLs back to the portal billing panel
  - **Webhook:** `POST /v1/billing/stripe/webhook` (raw body + signature verify) —
    `checkout.session.completed` stores `stripe_customer_id` / `stripe_payment_method_id` /
    brand / last4 into `payment_methods`; `payment_intent.payment_failed` marks the attempt
  - `chargeStripePack`: charge **off-session** with the saved payment method
    (`payment_method`, `off_session=true`, `customer`) — not `automatic_payment_methods`
  - On failed charge: set `delinquent_since` (first failure), increment `charge_attempts`,
    send dunning email (existing SMTP mailer), schedule retry per `BILLING_RETRY_SCHEDULE_DAYS`
  - On successful charge while delinquent: clear dunning state, `coverage_paused = false`,
    send "payment recovered" email
- `server/src/services/wallet.ts` `debitAiUsage` / `debitAiUsageForPatient`
  - allow debit down to `-BILLING_GRACE_TOKENS` (grace); below the floor with
    `BILLING_LIVE=true` → set `coverage_paused = true` on the payer wallet
- `server/src/services/sponsor.ts` `resolveAiPayer`
  - if sponsor wallet has `coverage_paused = true` → return the patient's own wallet
    (`sponsored: false` for payment; sponsorship row untouched)
- Retry driver: reuse the daily place we already run periodic work — if none exists, a
  `setInterval` sweep in `index.ts` (hourly) selecting delinquent wallets due for retry.
  Do **not** add a cron dependency for this.

### Web (clinic portal)

- Billing panel: **Add card** button → checkout-session redirect; replace/hide
  `payment-method/simulate` outside `?dev=1`
- Delinquency banner when `delinquent_since` is set: amount due, retry date, "Update card"
- New i18n keys ×10 locales in `clinic-i18n.js` (catalog, no inline strings — language-policy)

### Do not touch

- Sponsorship rows, `account_shares`, sync/consent — payment must never mutate clinical state
- Payer routing rules (phone → sponsor if covered; clinic chat → mentor; `/account/` → patient)
- Invoice schema (be-32 covers paid/failed already)

## Prerequisites (owner, not agent)

- Stripe account onboarding (business details, bank account)
- Live keys into `server/.env` on the VPS: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Webhook endpoint registered in the Stripe dashboard → `https://api.healthings.ai/v1/billing/stripe/webhook`
- Only after a test charge works: `BILLING_LIVE=true` + restart

Until then, everything in this batch runs dark: code paths guarded by `BILLING_LIVE` /
key presence, deployable without behavior change.

## Implementation notes

- **Webhook signature**: verify `Stripe-Signature` HMAC against raw body — Fastify needs a
  raw-body route config for this one route.
- **Idempotency**: pass an `Idempotency-Key` on payment-intent creation
  (`payer_user_id + invoice window`) so a retried sweep never double-charges.
- **Dunning emails**: reuse the OTP mailer; plain factual copy (amount, retry date, card
  update link). No marketing tone.
- **Grace math is pure code** (floor comparison) — no AI judgment involved; this respects
  ai-judgment-not-regex trivially but note the boundary anyway.
- Alpha behavior (`BILLING_LIVE=false`) must remain byte-identical: comped invoices,
  simulated reload, no grace/dunning state changes.

## Acceptance criteria

- [ ] `BILLING_LIVE=false`: full regression — auto-reload comps, no dunning rows, no PSP calls
- [ ] Checkout setup flow saves a real card (Stripe test mode) and shows brand/last4 in the panel
- [ ] Off-session charge succeeds → `paid` invoice with intent ref, tokens granted
- [ ] Declined test card → `failed` invoice, no tokens, `delinquent_since` set, dunning email sent
- [ ] Balance floors at `-BILLING_GRACE_TOKENS`; below floor → `coverage_paused = true`
- [ ] Paused clinic: patient's phone AI debits the **patient** wallet; sponsorship row unchanged
- [ ] Successful retry → state cleared, coverage resumes, recovery email
- [ ] Webhook rejects bad signatures (400)

## Out of scope

- Flipping `BILLING_LIVE=true` in production (owner action after Stripe onboarding)
- Invoice PDF / email delivery; VAT/tax fields (be-32 deferred list)
- COGS/margin dashboard
- Patient-side card capture on the phone (web checkout link is enough for alpha)

## Review by owner (after implementation)

**Evidence to capture**

- Stripe test-mode screenshots: saved card, succeeded intent, declined intent
- DB rows: `failed` + `paid` invoices, wallet dunning columns through a full fail→recover cycle
- Log of a paused-coverage AI call showing patient-wallet debit with sponsorship intact

**Judgment calls to check**

- Is 1 pack the right grace depth for a real clinic, or should it scale with patient count?
- Dunning email copy — factual and calm, or does it read like a threat?
- Retry cadence 1/3/5 days vs Stripe Smart Retries — worth delegating to Stripe later?

## What shipped (code)

### Server
- `schema.sql` — wallet dunning columns + retry index
- `config.ts` — `STRIPE_WEBHOOK_SECRET`, `PUBLIC_WEB_BASE_URL`, `BILLING_GRACE_TOKENS`, `BILLING_RETRY_SCHEDULE_DAYS`
- `payments.ts` — Checkout setup session, webhook HMAC, off-session charge, delinquency/grace, hourly retry sweep
- `wallet.ts` — grace floor after debit; wallet view exposes dunning fields
- `sponsor.ts` — `coverage_paused` → patient pays, sponsorship row untouched
- `email.ts` — dunning + recovered mail
- `routes/billing.ts` — `POST /v1/billing/checkout-session`, `POST /v1/billing/stripe/webhook`
- `.env.example` updated

### Web
- Clinic billing panel: **Add / Update card**, delinquency banner, return-query flash
- i18n keys ×10 locales

## Agent checklist

- [x] Status → in_progress
- [x] Server: schema + checkout + webhook + grace/dunning; typecheck (`tsc` ok)
- [x] Portal: Add card + delinquency banner + i18n ×10
- [x] Deploy dark (flag off) — VPS migrate + restart; BILLING_LIVE=false; checkout 401 / webhook 503
- [x] Owner smoke: portal Add card → expected Stripe-not-configured message
- [x] Status → done/ (flag flip remains owner Stripe onboarding)
