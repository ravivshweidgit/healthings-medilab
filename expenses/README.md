# Healthings — cash expense report

**As of:** 2026-07-29  
**Repo start (initial commit):** 2026-05-08 (`278d9f8`)

Hardware and Expo figures are owner-stated. Cursor amounts are from Cursor Billing invoices (paid lines). Platform/hosting rows are ballpark unless replaced with receipts.

**Also see:** [human-hours.md](./human-hours.md) (time effort) · [share-model.md](./share-model.md) (full internal model) · [share-model-partners.md](./share-model-partners.md) / [share-model-partners.html](./share-model-partners.html) (**EN**) · [share-model-partners.he.md](./share-model-partners.he.md) / [share-model-partners.he.html](./share-model-partners.he.html) (**HE**) · [cursor-invoices.md](./cursor-invoices.md)

Internal only — do **not** deploy share-model docs to healthings.ai.

---

## 1. Hardware (owner figures)

| Item | Calc | USD |
|------|------|----:|
| Watches ×3 | 3 × 500 | 1,500 |
| Phone | 1 × 1,000 | 1,000 |
| Scales ×2 | 2 × 700 | 1,400 |
| **Hardware subtotal** | | **3,900** |

---

## 2. Cursor (invoices)

| Date | Description | Status | USD |
|------|-------------|--------|----:|
| 2026-03-09 | (subscription) | paid | 20.06 |
| 2026-04-09 | (subscription) | paid | 20.00 |
| 2026-05-09 | (subscription) | paid | 20.00 |
| 2026-06-03 | Usage cycle from 2026-05-09 (mid-month) | paid | 20.29 |
| 2026-06-07 | Usage cycle from 2026-05-09 (mid-month) | paid | 40.26 |
| 2026-06-09 | (subscription) | refunded (−4.87 noted) | 20.00 *not counted* |
| 2026-06-10 | Usage cycle from 2026-05-09 | paid | 32.87 |
| 2026-07-02 | (plan) | refunded (−19.39 noted) | 60.00 *not counted* |
| 2026-07-24 | (Ultra / plan) | paid | 200.00 |

| Cursor rollup | USD |
|---------------|----:|
| All **paid** invoice lines | **353.48** |
| After noted refunds (−4.87 −19.39) | **~329.22** |
| **Since repo (2026-05-08)** paid only | **313.42** |
| Since repo, after those refunds | **~289.16** |

---

## 3. Expo / EAS (owner figures)

| Item | Notes | USD |
|------|-------|----:|
| Plan | ~19 / month | *fill months × 19* |
| Extra builds | ~2 each beyond quota | *fill count × 2* |

*(Replace with Expo billing export when available.)*

---

## 4. Clinical / nutritionist (owner-paid)

List price she quotes: **$133 / patient session**.  
**Who pays matters for the share model** — see [share-model.md](./share-model.md) §3b.

| Date / note | Description | Amount | USD (approx.) |
|-------------|-------------|-------:|--------------:|
| Paid already (owner) | Nutritionist sessions (project / clinical input) | **400 ₪** | **~108** (@ ~3.70 ₪/USD) |
| Rate card (reference) | Her stated fee per patient session | $133 | 133 |

| Clinical rollup | |
|-----------------|--:|
| Owner-paid to date (USD approx.) | **~108** |
| Still owed / future sessions | *add rows when paid* |

When the **founder pays** the invoice → that cash is **founder’s Cash** contribution.  
It does **not** count as the nutritionist investing money. Her share only grows if **she** puts in Cash and/or agreed Hours (or she forgoes fee for equity — document that explicitly).

---

## 5. Stores & hosting (ballpark — replace with receipts)

| Item | Notes | USD |
|------|-------|----:|
| Google Play Developer | one-time | 25 |
| Apple Developer | ~99 / year | ~99 |
| Hetzner VPS | ~5–15 / month | *TBD* |
| Domain + DNS | ~10–20 / year | *TBD* |
| Email (Resend / SMTP) | often free tier | *TBD* |

---

## 6. Totals (order of magnitude)

| Scope | ~USD |
|-------|-----:|
| Hardware only | **3,900** |
| + Cursor (all paid) | **~4,253** |
| + Nutritionist (400 ₪) | **~4,360** |
| + Cursor since repo only + nutritionist | **~4,320** |
| + Expo + Apple + Play + hosting (guess) | **~4,500–4,800** |

**Not included:** owner time, Gemini API, Stripe (not live), tax, shipping, Withings accessories beyond watches/scales, unpaid nutritionist list-price ($133×N).

---

## How to update

1. Add new rows under the right section when invoices arrive.  
2. Prefer receipt totals over ballpark rows in §3–5.  
3. Keep “since repo” as amounts on/after **2026-05-08**.  
4. Nutritionist: log **₪ + who paid**; convert to USD in the table when FX is known.