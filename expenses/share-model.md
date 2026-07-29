# Investor / founder share model (money + time)

**Purpose:** Estimate each person’s **economic share** from **cash in** and **time in**, on the same scale.  
**Not legal advice** — a planning worksheet before lawyers/cap table tools (Pulley, Carta, etc.).  
**Agent rule:** `.cursor/rules/share-model-investors.mdc` (applies under `expenses/**` and when discussing investors / ownership).

**As of:** 2026-07-29  
**Inputs:** [README.md](./README.md) (cash) · [human-hours.md](./human-hours.md) (hours)

---

## 1. Idea in one line

\[
\text{Contribution}_i = \text{Cash}_i + (\text{Hours}_i \times R)
\]

\[
\text{Share}_i = \frac{\text{Contribution}_i}{\sum_j \text{Contribution}_j}
\]

- \(\text{Cash}_i\) — money they put in (or company spends that they funded).  
- \(\text{Hours}_i\) — agreed productive hours (product, field tests, ops).  
- \(R\) — **sweat rate** ($/hour) locked by the partners for this round of reckoning.

Everyone’s share is their contribution ÷ **everyone’s** contributions (founders + angels in this pool).

---

## 2. Sweat rate \(R\) — equal-effort rule (locked)

**Rule:** One \(R\) for everyone. It is **not** each person’s own billing rate.

\[
R = \max_i (\text{professional charge rate of participant } i)
\]

Normalize every rate to **\$/hour** first (agree session length if someone bills per visit).

| Why |
|-----|
| Nobody gets cheaper sweat equity because their market rate is lower |
| Nobody gets denser equity because their market rate is higher |
| Time is compared as **equal effort** — same dollars per hour for every Hour in the table |

**Examples**

| Participants’ rates | \(R\) used for all Hours |
|---------------------|-------------------------:|
| Founder (no external rate), nutritionist \$133 / 1h session | **\$133/h** |
| Same, but sessions are 45 min → \$133 / 0.75h | **\$177/h** |
| Angel bills \$200/h consulting + nutritionist \$133/h | **\$200/h** |

**When someone new joins with a higher rate:** raise \(R\) for the **whole table** and **recompute everyone’s Sweat** (Hours × new \(R\)). Log the date in the snapshot. Do not leave old contributors on a lower \(R\).

**When the only rates are cash investors with no hourly rate:** keep the last agreed \(R\), or set \(R\) from the highest advisor/contractor rate already in the project (e.g. nutritionist).

~~Old default \$75/h~~ — superseded by this max-rate rule (2026-07-29).

---

## 3. What counts as Cash / Hours

| Counts as **Cash** | Counts as **Hours** |
|--------------------|---------------------|
| Bank transfer / wire into co or owner-paid company bills | Coding, design, Cursor-led build |
| Hardware bought **for the product** (scales, watches, test phone) if the group agrees it is company asset | Daily protocol field tests (bike/walk) if agreed as company QA |
| Play / Apple / Expo / Cursor / VPS paid for the product | Clinic/portal ops, releases, investor materials |

| Usually **exclude** (or put in a side note) |
|-----------------------------------------------|
| Personal living costs |
| Speculative “thinking” with no deliverable |
| Hours after someone left (unless vesting credit) |

**Founder hardware:** either (a) count full $ as Cash contribution, or (b) keep hardware personal and don’t count it — **pick one** and apply to all.

### 3b. Advisors / nutritionist (paid sessions vs equity)

| Situation | Whose **Cash**? | Whose **Hours**? |
|-----------|-----------------|------------------|
| Founder pays her **$133** (or ₪) session fee | **Founder** | Only if she also logs agreed unpaid product/clinical hours |
| She works and **waives the fee** for equity | $0 cash from her (or fee forgone can be noted as her Cash at list price — **agree explicitly**) | Her Hours × R **or** forgone-fee-as-cash — pick one, don’t double-count |
| She wires money into the company | **Her** Cash | Separate |

**List price** ($133/session) is a **rate card**, not automatic equity.  
**Already paid by founder:** 400 ₪ (~$108) → founder Cash (see expenses README §4).

---

## 4. Worked example — current founder (Raviv) alone

**Current max rate on the project:** nutritionist **\$133 / patient session**.  
Until session length is agreed, treat **1 session = 1 hour** → **\(R = \$133/h\)** (equal-effort).  
If sessions are shorter/longer, recalculate \(R = 133 / \text{hours per session}\).

| Component | Source | Amount |
|-----------|--------|-------:|
| Hardware cash | expenses README | $3,900 |
| Cursor (since repo, paid) | ~$313 | $313 |
| Expo + stores + hosting (guess) | ~$150 | $150 |
| Nutritionist sessions (owner-paid) | 400 ₪ ≈ $108 | $108 |
| **Cash subtotal** | | **~$4,471** |
| Hours (central) | human-hours ~470 h | 470 |
| Sweat \(= 470 \times 133\) | | **$62,510** |
| **Total contribution** | | **~$66,981** |

If Raviv is the **only** contributor so far → **Share = 100%** until someone else adds Cash and/or Hours under the same \(R\).

**Nutritionist today:** $0 contribution from fees the founder already paid. Her Share starts when she invests Cash and/or Hours (or waives fees for equity under §3b).  
If she joins the Hours table, her Hours also use **\(R = \$133/h\)** (same as founder) — equal effort.

---

## 5. When an investor joins — fill this row

Copy a row per person. Same \(R\) for all.

| Person | Role | Cash ($) | Hours | Sweat (= Hours × R) | Contribution | Share % |
|--------|------|--------:|------:|--------------------:|-------------:|--------:|
| Raviv | Founder | 4,471 | 470 | 62,510 | 66,981 | *(auto)* |
| *(Nutritionist)* | Advisor | 0* | | | | |
| *(Investor A)* | Angel | | | | | |
| **Total** | | | | | **Σ** | **100%** |

\*Sessions **you** pay ($133 list / ₪ invoices) increase **Raviv’s** Cash, not hers. Fill her Cash/Hours only when she invests or waives fees for equity (§3b). All Hours use **same \(R\)** (= max rate on the project).

**Share %** = Contribution ÷ Total × 100.

### Mini example (illustrative)

\(R = 133\) (nutritionist max rate). Investor A puts **$20,000** cash, **0** hours.

| Person | Cash | Sweat | Contribution | Share |
|--------|-----:|------:|-------------:|------:|
| Raviv | 4,471 | 62,510 | 66,981 | **77.0%** |
| Investor A | 20,000 | 0 | 20,000 | **23.0%** |
| **Total** | | | **86,981** | 100% |

If Investor A also works **100 h**: sweat = \(100 \times 133 = \$13,300\) → contribution \$33,300 → share ≈ **33%**, Raviv ≈ **67%**.

---

## 6. Guardrails (so the model stays fair)

1. **Cap table ≠ this table forever** — use this to *propose* %; lawyers issue shares/SAFE/options.  
2. **Vesting** — time-based shares usually vest (e.g. 4 years, 1-year cliff) so someone cannot take % and leave. Cash often “invested” immediately; sweat vests.  
3. **Future rounds dilute everyone** — new money increases the pie; old Share % shrinks. Model dilution separately.  
4. **IP / prior invention** — Healthings repo from day one: founders’ pre-money IP can be a **fixed founder %** *before* this contribution pool (optional “Founder pool 60% + Contribution pool 40%”).  
5. **One ledger** — update Cash/Hours monthly; don’t renegotiate \(R\) every week.

### Optional two-pool variant

| Pool | % of company | Split by |
|------|-------------:|----------|
| Founder / IP pool | e.g. 60% | among founders only (fixed split) |
| Contribution pool | e.g. 40% | Cash + Hours × R as above |

Investors who only bring cash compete in the contribution pool (or buy into a priced round outside this model).

---

## 7. Checklist when someone “comes in”

- [ ] Agree \(R\) and whether hardware counts as Cash  
- [ ] Write their Cash and expected Hours (or “cash only”)  
- [ ] Compute Share % with the table  
- [ ] Agree vesting / cliff for sweat (and cash if any)  
- [ ] Paper: SAFE, SPA, or advisor agreement — **not** this markdown alone  
- [ ] Update this file + [README.md](./README.md) / [human-hours.md](./human-hours.md)

---

## 8. Quick formula card

```
R          = max(participants' professional $/hour rates)   // equal-effort
Cash_i     = money they funded
Hours_i    = agreed hours
Sweat_i    = Hours_i * R          // same R for everyone
Contrib_i  = Cash_i + Sweat_i
Share_i    = Contrib_i / sum(Contrib) * 100%
```

Keep one active copy of the people table in §5; archive old snapshots dated below.

### Snapshot log

| Date | R | Note |
|------|--:|------|
| 2026-07-29 | 75 | Initial model (superseded) |
| 2026-07-29 | 75 | + nutritionist §3b; owner-paid 400 ₪ as founder Cash |
| 2026-07-29 | **133** | Equal-effort: R = max charge rate (nutritionist \$133/session ≈ \$133/h until session length agreed) |
