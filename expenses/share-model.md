# Investor / founder share model (money + time)

**Purpose:** Estimate each person’s **economic share** from **cash in** and **time in**, on the same scale.  
**Not legal advice** — a planning worksheet before lawyers/cap table tools (Pulley, Carta, etc.).  
**Agent rule:** `.cursor/rules/share-model-investors.mdc` (applies under `expenses/**` and when discussing investors / ownership).

**As of:** 2026-08-19  
**Company books currency:** **USD** · ILS→USD FX locked at **3.0 ₪ per $1** (source ₪ kept as footnotes only)  
**Inputs (per person, by `YYYY-WW`):** [Raviv](./Raviv/) · [Shai](./Shai/) · [Michal](./Michal/) — each has `expenses/YYYY-WW/` + `working-hours/YYYY-WW/` (ISO week **01–54**); Raviv baseline locked as [2026-00](./Raviv/working-hours/2026-00/README.md) (~544 h, before week 33) · Index: [README.md](./README.md)

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
| Hardware bought **for the product** (scales, watches, test phone, CGMs) if the group agrees it is company asset | Daily protocol field tests (bike/walk) if agreed as company QA |
| Play / Apple / Expo / Cursor / VPS paid for the product | Clinic/portal ops, releases, investor materials |

| Usually **exclude** (or put in a side note) |
|-----------------------------------------------|
| Personal living costs |
| Speculative “thinking” with no deliverable |
| Hours after someone left (unless vesting credit) |

**Founder hardware:** either (a) count full $ as Cash contribution, or (b) keep hardware personal and don’t count it — **pick one** and apply to all. Current ledger uses **(a)** receipt + phone totals.

### 3b. Advisors / nutritionist (paid sessions vs equity)

| Situation | Whose **Cash**? | Whose **Hours**? |
|-----------|-----------------|------------------|
| Founder pays her **$133** (or ₪) session fee | **Founder** | Only if she also logs agreed unpaid product/clinical hours |
| Partner (e.g. Shai) pays her session fee for alpha / clinical work | **That partner** | Same — fee paid ≠ her Hours |
| She works and **waives the fee** for equity | $0 cash from her (or fee forgone can be noted as her Cash at list price — **agree explicitly**) | Her Hours × R **or** forgone-fee-as-cash — pick one, don’t double-count |
| She wires money into the company | **Her** Cash | Separate |
| She is allocated unpaid weekly Hours for equity | $0 from the allocation alone | **Her** Hours as logged |

**List price** ($133/session) is a **rate card**, not automatic equity.  
**Already paid by founder:** **$266.66** (2 × ₪400 @ 3.0) to **Michal (the clinic)** → [Raviv/expenses/2026-00](./Raviv/expenses/2026-00/README.md) (**Raviv’s Cash**, not Michal equity):  
- Bit **2026-07-01** — **יעוץ תזונה** / nutrition counseling (**$133.33**)  
- Bit **2026-07-31** — session for **נטלי / Natali** (**$133.33**)  
**Paid by Shai Ivanir:** **$666.67** (source **₪2,000** @ 3.0) to **Michal (the clinic)** on **2026-08-19** → [Shai/expenses/2026-34](./Shai/expenses/2026-34/README.md) (**Shai’s Cash**, not Michal equity). Covers the 2 alpha-tester sessions that had been noted at ₪800; that amount was **not transferred in week 33**.  
**Michal:** clinic; **no expenses**; **15 h** logged — [2026-33](./Michal/working-hours/2026-33/README.md) **10** + [2026-34](./Michal/working-hours/2026-34/README.md) **5** (allocation 10 h/week).

---

## 4. Worked example — current pool

**Current max rate on the project:** nutritionist **\$133 / patient session**.  
Until session length is agreed, treat **1 session = 1 hour** → **\(R = \$133/h\)** (equal-effort).  
If sessions are shorter/longer, recalculate \(R = 133 / \text{hours per session}\).

### Raviv Cash

| Component | Source | Amount |
|-----------|--------|-------:|
| Hardware + Cursor + phone + Expo/hosting + clinic sessions | [Raviv/expenses](./Raviv/expenses/README.md) = `2026-00` **$4,417.77** + `2026-33` **$2,097.55** | **$6,515.32** |
| **Cash subtotal** | | **$6,515.32** |

### Hours & sweat

| Person | Hours | Sweat (= Hours × 133) |
|--------|------:|----------------------:|
| Raviv (baseline ~544 + week 33 ~32 + week 34 **22**) | 598 ([working-hours](./Raviv/working-hours/README.md)) | **$79,534** |
| Michal (week 33 **10** + week 34 **5**) | 15 ([working-hours](./Michal/working-hours/README.md)) | **$1,995** |
| Shai | 1 ([working-hours](./Shai/working-hours/README.md)) | **$133** |

### Contributions

| Person | Cash ($) | Hours | Sweat | Contribution | Share % |
|--------|--------:|------:|------:|-------------:|--------:|
| Raviv | 6,515.32 | 598 | 79,534 | **86,049.32** | **96.9%** |
| Michal | 0 | 15 | 1,995 | **1,995.00** | **2.2%** |
| Shai Ivanir | 666.67 | 1 | 133 | **799.67** | **0.9%** |
| **Total** | **7,181.99** | **614** | **81,662** | **88,843.99** | **100%** |

---

## 5. People table (active)

Copy a row per person. Same \(R\) for all.

| Person | Role | Cash ($) | Hours | Sweat (= Hours × R) | Contribution | Share % |
|--------|------|--------:|------:|--------------------:|-------------:|--------:|
| Raviv | Founder | 6,515.32 | 598 | 79,534 | 86,049.32 | **96.9%** |
| Michal | Clinic | 0 | 15 | 1,995 | 1,995.00 | **2.2%** |
| Shai Ivanir | Partner | 666.67 | 1 | 133 | 799.67 | **0.9%** |
| **Total** | | **7,181.99** | **614** | **81,662** | **88,843.99** | **100%** |

Sessions **someone else** pays ($133 list / ₪ invoices) increase **that payer’s** Cash, not Michal’s. Fill her Cash/Hours only when she invests or waives fees for equity (§3b), or logs her allocated unpaid Hours. All Hours use **same \(R\)** (= max rate on the project).

**Share %** = Contribution ÷ Total × 100.

### Mini example (illustrative)

\(R = 133\) (nutritionist max rate). Investor A puts **$20,000** cash, **0** hours.

| Person | Cash | Sweat | Contribution | Share |
|--------|-----:|------:|-------------:|------:|
| Raviv | 6,515.32 | 79,534 | 86,049.32 | **~81.1%** |
| Investor A | 20,000 | 0 | 20,000 | **~18.9%** |
| **Total** | | | **106,049.32** | 100% |

(Ignore Shai’s small row in this toy example.) If Investor A also works **100 h**: sweat = \(100 \times 133 = \$13,300\) → contribution \$33,300 → share rises accordingly.

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

- [x] Agree \(R\) and whether hardware counts as Cash  
- [x] Write their Cash and expected Hours (or “cash only”) — Michal 10 h/wk; Shai **$666.67** Cash (from ₪2,000) + **1 h** week 34  
- [x] Compute Share % with the table  
- [ ] Agree vesting / cliff for sweat (and cash if any)  
- [ ] Paper: SAFE, SPA, or advisor agreement — **not** this markdown alone  
- [x] Update this file + each person’s `expenses/` and `working-hours/` under [README.md](./README.md)

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
| 2026-08-10 | **133** | Hours refresh: ~470 → **~547 h** (daily effort continued; sweat ~\$72.8k) |
| 2026-08-14 | **133** | Receipt hardware ~\$3,092 (Tradeinn + CareSens + phone); Raviv hours **~581**; Michal joins **10 h/wk** (0 logged); Shai Cash **800 ₪** (~\$216) for alpha sessions → pool **~\$81.2k**, Raviv **99.7%**, Shai **0.3%**, Michal **0%** until Hours log |
| 2026-08-14 | **133** | + DHL customs **₪331.60** (~\$90, waybill 7727088574) → Raviv Cash **~\$3,753**, pool **~\$81.2k** (shares unchanged at rounding) |
| 2026-08-14 | **133** | + DHL customs **₪296.60** (~\$80, waybill 5598297412) → Raviv Cash **~\$3,833**, pool **~\$81.3k** |
| 2026-08-14 | **133** | Hours split: **baseline ~544 h** (before week 33) + week **2026-33 ~32 h** → **~576 h** total; sweat **~\$76.6k**; pool **~\$80.7k** |
| 2026-08-14 | **133** | Michal **10 h** logged week **2026-33** (sweat \$1,330) → pool **~\$82.0k**; Raviv **98.1%**, Michal **1.6%**, Shai **0.3%** |
| 2026-08-14 | **133** | Company books **USD only**; FX **3.70 ₪/$**; Shai Cash booked **\$216.22** (source ₪800) |
| 2026-08-14 | **133** | + Tradeinn scale **\$505.34** (2026-05-07, inv 54670258) into `2026-00` → Raviv Cash **\$4,338.59**, pool **~\$82.5k** |
| 2026-08-14 | **133** | + Tradeinn ScanWatch 2 Black **\$397.20** (2026-05-12, inv 54802034) into `2026-00` → Raviv Cash **\$4,735.79**, pool **~\$82.9k** |
| 2026-08-14 | **133** | + Tradeinn ScanWatch 2 White **\$384.79** (2026-07-09, inv 56427571) into `2026-00` → Raviv Cash **\$5,120.58**, pool **~\$83.3k** |
| 2026-08-14 | **133** | + Tradeinn ScanWatch 2 White **\$385.83** (2026-07-10, inv 56449481) into `2026-00` → Raviv Cash **\$5,506.41**, pool **~\$83.7k** |
| 2026-08-14 | **133** | + DHL customs **₪342.60** (**\$92.59**, waybill 1476256121, 2026-07-22) into `2026-00` → Raviv Cash **\$5,599.00**, pool **~\$83.8k** |
| 2026-08-14 | **133** | + DHL customs **₪294.60** (**\$79.62**, waybill 3063336942, 2026-07-11) into `2026-00` → Raviv Cash **\$5,678.62**, pool **~\$83.8k** |
| 2026-08-14 | **133** | + DHL customs **₪295.60** (**\$79.89**, waybill 7837738871, 2026-07-11) into `2026-00` → Raviv Cash **\$5,758.51**, pool **~\$83.9k** |
| 2026-08-14 | **133** | + DHL customs **₪294.60** (**\$79.62**, waybill 6268782413, 2026-05-14) into `2026-00` → Raviv Cash **\$5,838.13**, pool **~\$84.0k** |
| 2026-08-14 | **133** | FX rebook **3.70 → 3.0 ₪/$**; + May 9 DHL **₪340.60** (**\$113.53**); Raviv Cash **\$6,169.59**, Shai **\$266.67**, pool **~\$84.4k**; shares **~98.1% / 1.6% / 0.3%** |
| 2026-08-14 | **133** | Receipt: Raviv→Michal Bit **₪400** (**\$133.33**, 2026-07-31) for **Natali** session — was already in `2026-00` Cash; now dated + attached |
| 2026-08-14 | **133** | + Raviv→Michal Bit **₪400** (**\$133.33**, 2026-07-01, יעוץ תזונה) → Raviv Cash **\$6,302.92**, pool **~\$84.5k** |
| 2026-08-19 | **133** | Shai **₪2,000** transferred this day (week **2026-34**); week-33 ₪800 was **not** a transfer and is removed. Shai Cash **\$666.67**, pool **~\$84.9k**; shares **~97.6% / 1.6% / 0.8%** |
| 2026-08-19 | **133** | + DHL customs **15 Aug**: **₪296.60** (waybill **7892401263**) + **₪340.60** (waybill **9229202382**) → Raviv Cash **\$6,515.32**, week 33 **\$2,097.55**, pool **~\$85.1k**; shares still **~97.6% / 1.6% / 0.8%** |
| 2026-08-19 | **133** | Week **2026-34** hours (through Wed): Raviv **22 h** + Michal **5 h** + Shai **1 h** → pool **~\$88.8k**; shares **~96.9% / 2.2% / 0.9%** |
