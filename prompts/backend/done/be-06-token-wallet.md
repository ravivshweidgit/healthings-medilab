# Backend Phase 5 — Token wallet & clinic-sponsored AI

**Status: done** — shipped; header corrected 2026-07-26 (the "backlog" label was stale for weeks).
Live artifacts: `wallets`, `wallet_ledger`, `payment_methods` in `server/src/db/schema.sql`,
`server/src/routes/wallet.ts`, `server/src/services/sponsor.ts` (`resolveAiPayer`). Charging stays
off in alpha (`BILLING_ENFORCE=false`). The tokens-vs-currency display problem this spec created is
tracked in `../be-22-clinic-portal-visual.md`.  
**Builds on:** `be-03-account-shares.md` (`resolveAiPayer`) · `be-01-vision.md` § pricing.

---

## Problem

AI (Gemini meal log + mentor chat) is the recurring cost. We need:

- **Patients** buy token packs for self-serve use
- **Clinics** fund AI for **approved, sponsored** linked patients
- **`resolveAiPayer(patientId)`** from be-03 picks who gets debited

MVP alpha may run with **`PAYMENTS_ENABLED=false`** — log usage + balances in DB without Stripe.

---

## Billing model (MVP)

| Scenario | Payer | `sponsored` |
|----------|-------|-------------|
| Solo patient | Patient wallet | false |
| Patient + approved clinic link (`sponsor_ai`) | **Mentor wallet** | true |
| No tokens | Block AI calls; manual logging still OK | — |

- **Non-AI features free:** viewing synced data in clinic portal, charts, export — not token-gated (per be-01).
- **$5 minimum top-up** when Stripe enabled (post-alpha).
- **No subscription** — prepaid token buckets only.

> **Note:** be-03 supersedes be-01 “transfer tokens to client wallet” for MVP — clinic wallet debited directly via `resolveAiPayer`, not peer transfer.

> **Web chat (2026-07-27):** Clinic portal chat always debits the **acting mentor** (`meterClinicChat`). `/account/` AI chat always debits the **patient** (`meterPatientSelfChat`) and ignores sponsorship — deliberate exception vs phone `resolveAiPayer`. See be-15.

> **Two-layer usage (2026-07-27):** `ai_usage_events.tokens` stays the **Healthings prepaid credit** charged (wallet math). New `gemini_prompt_tokens / gemini_candidates_tokens / gemini_thoughts_tokens / gemini_total_tokens / gemini_model` columns record **real Google usageMetadata** per event — COGS/margin analytics only, never wallet debits. Server chat fills them from `geminiTextWithUsage`; the phone sends them on `POST /v1/usage/ai` (`gemini` body field, optional). Monthly totals are indexed `SUM`s over events — no rollup table.

> **Zero-charge invoices + BILLING_LIVE (2026-07-27):** `invoices` table + `invoice_number_seq` (`HT-YYYY-000001`). Every token pack — auto-reload or manual — issues a production-shaped invoice with `amount_cents` (list) vs `charged_cents` (actual). Master env switch **`BILLING_LIVE`** (default `false`): off = full flow runs, PSP never contacted, invoices land as `charged_cents=0 / status='comped_alpha'`; on = same flow charges the saved card via Stripe (`status 'paid'/'failed'`, failed charge grants **no** tokens). Flipping the flag needs no schema or flow change — only the PSP integration. Surfaced at `GET /v1/billing/invoices` (returns `billingLive`), `GET /v1/usage/events` (payer-scoped per-event list), clinic portal “AI usage” + “Billing & invoices” panels, and the `/account/` **Usage & billing** tab (account-only `usage` tab, `selfOnly` in `ALL_TABS`).

---

## What ships

### Database

```sql
wallets (user_id PK FK, balance_tokens INT NOT NULL DEFAULT 0, updated_at)
wallet_ledger (
  id uuid PK, user_id FK, delta INT, reason text,
  ref_type text, ref_id uuid, payer_user_id uuid NULL,
  created_at
)
```

- **`payer_user_id`** — when mentor pays for patient AI, ledger entry on mentor wallet with patient ref
- Reasons: `purchase`, `ai_meal`, `ai_chat`, `admin_grant`, `refund`

### Helper (contract from be-03)

```ts
resolveAiPayer(patientId): { payerUserId: uuid, sponsored: boolean }
debitAiUsage(payerUserId, patientId, tokens, reason): void  // throws if insufficient
```

Call from app proxy or server-side Gemini gateway (future) before each billable AI call.

### Endpoints

| Endpoint | Method | Auth | Role | Purpose |
|----------|--------|------|------|---------|
| `/v1/wallet` | GET | Bearer | any | `{ balanceTokens, sponsoredBy?: clinicName }` |
| `/v1/wallet/ledger` | GET | Bearer | self | recent entries |
| `/v1/wallet/grant` | POST | Bearer | **admin** | alpha manual top-up |
| `/v1/wallet/checkout` | POST | Bearer | self | Stripe session (deferred) |

**Patient app UI:** show balance or “AI sponsored by &lt;clinic&gt;” (from `/v1/wallet` + share display name).

**Clinic portal:** show mentor balance + usage this month (ledger filter).

### Alpha mode

```env
PAYMENTS_ENABLED=false
AI_TOKENS_PER_MEAL=1
AI_TOKENS_PER_CHAT_TURN=1
```

- Unlimited AI OR fixed high grant on signup for testers — config flag
- Still write **ledger rows** so sponsor attribution works before Stripe

### Stripe (deferred sub-prompt)

- Checkout for `$5 / $10 / $20` packs
- Webhook → credit `wallets`
- Clinic buys packs from portal; debits on sponsored patient AI

---

## Primary files

| Path | Purpose |
|------|---------|
| `server/src/db/schema.sql` | wallets + ledger |
| `server/src/services/wallet.ts` | balance, debit, grant |
| `server/src/services/sponsor.ts` | `resolveAiPayer` (from be-03) |
| `server/src/routes/wallet.ts` | REST |
| App / portal UI | balance + sponsored badge |

---

## Phone-tested checklist

- [ ] Solo patient — AI debits own wallet; blocks at 0
- [ ] Linked sponsored patient — AI debits **mentor** wallet
- [ ] Revoke share — patient back to own wallet
- [ ] Clinic portal shows usage attributed to patients
- [ ] Alpha: grants work without Stripe

---

## Deferred

- Stripe Checkout + webhooks
- Dashboard subscription (CRM fee separate from AI)
- Token gifting / transfer between users
- Gemini proxy on server (today app calls Gemini direct — migrate for central billing)

---

## Related

- **`be-03-account-shares.md`** — `sponsor_ai`, `resolveAiPayer`
- **`be-05-clinic-dashboard.md`** — clinic balance UI
- **`prompt49.txt`** — sponsored badge in app
- **`be-01-vision.md`** — pricing principles
