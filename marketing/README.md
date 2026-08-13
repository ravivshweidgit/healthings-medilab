# Marketing

**Status:** wedge proposed 2026-08-13 → **clinic-first** ([`002-opus-wedge-2026-08-13.md`](./002-opus-wedge-2026-08-13.md)); awaiting owner acceptance  
**Source of truth for product strength:** [`investor-pov/COMPETITOR-SCORES.md`](../investor-pov/COMPETITOR-SCORES.md) · [`EXECUTIVE-SUMMARY.md`](../investor-pov/EXECUTIVE-SUMMARY.md)

Scores are **ICP-specific**. Casual CGM tip-seekers flip the ranking — do not market to them first.

---

## Personas

| | Who | Why |
|---|-----|-----|
| **Primary** | Clinic-referred metabolic tracker — T2D / lipids / GLP-1, owns CGM + scale, pays a private dietitian, Android, Hebrew | Pays and retains; the referral covers our polish gap (UX 76 vs 88) |
| **Secondary** | Private Israeli clinical dietitian (R.D.) | Repeat distributor; only she unlocks the **91** config and can sponsor credits |

One-pagers, objections, and where each hangs out: [`002-opus-wedge-2026-08-13.md`](./002-opus-wedge-2026-08-13.md).

**Screening rule — Israel / Hebrew first, both paths:**

| Must have | Why |
|-----------|-----|
| CGM (Libre / CareSens / similar) | Glucose → meal decisions, not chart-only |
| Labs that change eating (LDL / lipids, A1c, kidney) + PDF import willingness | Differentiator vs Levels / Nutrisense |
| Food log most days (photo / text OK) | Engine needs meals |
| Optional: Withings (or serious body / energy) | Burn + body → macros |
| Prefer **their own nutritionist** over ~$150–225/mo US coach membership | +clinic score **~91** vs Nutrisense **~60** |

**Job to be done:** daily macro + meal decisions from CGM + scale + food + labs — with optional clinic rules / **treatment markers** (custom caps/floors).

---

## Wedge — clinic-first (next 90 days)

> **3 private Israeli dietitians × 5 screened patients. Install in the clinic room. Clinic sponsors the AI credits.**

D2C solo is a capped **10-seat support stream** (₪0 media), not the wedge — solo ships our weaker configuration (`Choose your real nutritionist` = **0** until an RD links).

**Kill criteria:** day 30 <2 active RDs · day 45 <50% logging on day 14 · day 60 zero rules/markers set · day 90 zero paid packs. Full branches in [`002`](./002-opus-wedge-2026-08-13.md).

---

## Channel bets (3 only)

| # | Bet | Leading indicator (2–4 wks) |
|---|-----|------------------------------|
| 1 | **Founder-led dietitian recruiting** — pilot partner offer, demo = a real patient week | 3 RDs onboarded, ≥1 with a linked patient + a rule set |
| 2 | **Chair-side activation kit** — install in her room; Hebrew A5 + QR + 90-sec video + WhatsApp week 1 | ≥70% log a meal in 24h; ≥60% still logging day 14 |
| 3 | **Founder in 2 Hebrew communities** — sensor/T2D + keto/GLP-1, 10 screened seats | 10 installs, ≥4 self-paid credit packs, ≥1 inbound RD |

**Not this quarter:** paid social, ASO, influencers, SEO content, US market, conferences.

---

## Anti-persona (do not lead with)

- “Just show my glucose” membership shoppers (Levels / Nutrisense easy path) — casual-user score: Healthings ≈ **44**  
- Mass weight-loss / Noom-style behavior apps  
- **Anyone unwilling to photo meals most days** — no passive mode exists  
- **iPhone users whose whole point is the sensor** — no live CGM on iOS yet (`prompt56` open); say so  
- Clinics wanting white-label / EMR now  

---

## Message pillars

| Audience | Hero line (EN) | HE |
|----------|----------------|----|
| Clinic / dietitian | Your patient. Your rules. The whole week is on your screen before they sit down. | המטופלת שלך ממשיכה לפי מה שקבעת גם בין הפגישות — ואת רואה את כל השבוע עוד לפני שהיא נכנסת. |
| Patient (clinic path) | The same picture your dietitian sees — labs, glucose, meals, targets. | הדיאטנית שלכם רואה בדיוק מה שאתם רואים — בדיקות, סוכר, ארוחות ויעדים. הכול בטלפון. |
| Solo power user | Sensor, scale, labs, meals — today's targets come out of them. Pay only for the AI you use. | חיישן הסוכר, המשקל, הבדיקות והארוחות במקום אחד — ומהם יוצאים היעדים של היום. משלמים רק על ה־AI שאתם מפעילים. |

**Banned:** “We beat Nutrisense at everything” · any outcome claim (“lowers your LDL”) · “AI instead of a dietitian” · “no logging needed” · “₪X/mo unlimited AI coaching”. Full list + the two handle-with-care lines: [`002`](./002-opus-wedge-2026-08-13.md).

---

## Pricing frame (pitch)

- **App:** pay-as-you-go AI credits (~$15–25 active month)  
- **Clinic-sponsored credits** (shipped — `be-06` / `be-34`): the clinic can fund a linked patient's AI, so a pilot patient meets **no paywall**  
- **Nutritionist:** pay the clinic when *you* choose — not a standing coach bill  
- Closed loop does the daily work; human visit is optional depth  

---

## Copy gates (do not promise ahead of the build)

| Asset | State |
|-------|-------|
| Clinic-sponsored credits · Hebrew RTL portal · patient web account | **Shipped** — safe to sell |
| **Treatment markers** | `be-41` needs-review, **`prompt110` phone UI backlog** — sell to RDs as a 30-day commitment, **not** in patient copy yet |
| **iPhone live CGM** | Not live — Android for sensor; iPhone = scale, labs, meals, coach |

---

## Which model to ask

| Job | Model |
|-----|--------|
| Wedge / persona / channel strategy | Strong reasoning (e.g. Opus) — send [`001-marketing.md`](./001-marketing.md); model **reads** the linked paths |
| Ads, landing, WhatsApp scripts after ICP is locked | Auto / cheaper |
| Clinical outcome claims in copy | Human / clinician — do not invent |

---

## Docs

- [`002-opus-wedge-2026-08-13.md`](./002-opus-wedge-2026-08-13.md) — **personas, wedge, 3 channels, 90-day plan, banned lines**
- [`001-marketing.md`](./001-marketing.md) — the prompt starter that produced 002
- Next, once the owner accepts the wedge: `copy-bank-he.md` (RD outreach + A5 handout + WhatsApp scripts) — Auto, not Opus

## Open owner decisions (from 002)

Pilot credit budget · RD liability sentence (needs professional review) · `prompt110` build order · iPhone screen-vs-build · founder capacity (3 RDs or 2) · handout/video taste.
