# Healthings MediLab — Investor POV

Internal positioning memo. Not a pitch deck. Update when traction, ICP, or GTM changes.

**Send to advisors:** [EXECUTIVE-SUMMARY.md](./EXECUTIVE-SUMMARY.md) · [key-rule.md](./key-rule.md) (ICP + dual channels) · [COMPETITOR-SCORES.md](./COMPETITOR-SCORES.md) · [Nutricence-medilab.md](./Nutricence-medilab.md)

**Product repo:** [../readme.md](../readme.md) · **Shipped specs:** [../prompts/app/done/README.md](../prompts/app/done/README.md)

---

## Snapshot (June 2026)

| Topic | Status |
|-------|--------|
| **Founder POC** | ✅ Success — daily use; personal targets achieved |
| **Venture scale** | Not yet — advisor view: lifestyle / niche first |
| **Israel SAM (advisor est.)** | ~500k users, growing — validate independently |
| **Offerable wedge** | Closed-loop CGM + food + scale + labs → macro/meal decisions + human confirm |
| **Next step** | Clinic alpha — RD enrolls **metabolic + motivated to track** only |

---

## One-liner

**AI-native metabolic coach that closes the loop between CGM, food, scale, and labs — for people optimizing weight, lipids, and glucose, not just viewing charts.**

Category overlap: CGM lifestyle (Levels, Nutrisense) · nutrition tracking (Cronometer) · longevity labs (InsideTracker). Position as **metabolic OS** or **clinical nutrition copilot**.

---

## Problem

People with CGM and smart scales see **numbers in silos** but not **what to do next**:

- Glucose apps show spikes, not meal-specific fixes tied to their rules and labs.
- Macro apps ignore CGM response and clinical context (LDL, kidney, glycemic labs).
- Coaching apps (Noom) lack biomarker-grounded daily targets.
- Lab reports sit in PDFs, disconnected from daily eating decisions.

---

## Solution (what exists today)

A single Android app (React Native) that correlates:

| Pillar | Capability |
|--------|------------|
| **CGM** | Health Connect / xDrip+ pipeline; tiered chat (qualitative default, deep dive on ask); `/7` period reviews with meal–glucose pairing |
| **Nutrition** | Food log, `/macros` revision, `/recipe` / `/eat` recipe cards, My Rules |
| **Body** | Withings scale (weight, fat, muscle, visceral); guarded auto macro revision on weigh-in |
| **Labs** | PDF import; kidney / lipid / glycemic guidance in macro brain |
| **Coaching** | Multi-mentor chat (coach, nutritionist, endocrinologist) |
| **Safety** | Human confirm on macro changes; outlier guards on scale auto-apply (prompt42) |

**Daily loop (target habit):** weigh-in → macro check → log meals → chat/recipe → weekly `/7` review.

---

## Differentiation vs market

Most competitors own **one pillar**. MediLab stitches the full loop in code:

| vs Competitor type | MediLab edge |
|--------------------|--------------|
| CGM apps (Levels, Nutrisense, Signos) | Labs + clinical macro engine + food log history + multi-mentor |
| Food trackers (MFP, Cronometer) | CGM-native coaching and period reviews |
| Weight coaches (Noom) | Biomarker-driven targets, not generic calories |
| Lab dashboards (InsideTracker) | Daily CGM + meal loop, not one-off reports |

**Moat hypothesis (to prove):** longitudinal user model (food + glucose + scale + labs) + rule-based clinical macro pipeline — not generic LLM chat.

**Bilingual:** English commands + Hebrew UX/content — relevant for Israel and diaspora ICP.

---

## Traction & stage (honest)

| Signal | Status |
|--------|--------|
| Product depth | Strong — 40+ shipped feature specs, phone-tested iterations |
| Commercial entity / GTM | TBD |
| Paying users | TBD |
| Retention / outcomes data | TBD |
| iOS | TBD (Android-first today) |

**Stage:** Pre-seed prototype with **founder–product fit** and deep integration; not yet venture-scale without users and revenue.

---

## Business model options (to pick one wedge)

1. **D2C subscription** — $15–40/mo metabolic membership (CGM-adjacent users).
2. **B2B2C dietitian / clinic** — white-label coach + patient dashboard.
3. **Employer wellness** — cardiometabolic cohort (LDL, pre-diabetes, GLP-1 adjacency).
4. **Regional** — Hebrew-first metabolic health (labs, rules, mentors).

Investors will ask: **Who pays, CAC, churn after month 3, and one outcome metric.**

---

## Comparable landscape (narrative, not valuation)

| Company | Overlap | Gap vs MediLab |
|---------|---------|----------------|
| Levels, Nutrisense, Signos | CGM + lifestyle | Less labs/macro math depth |
| January.ai | Meal prediction | Less rules engine + multi-mentor |
| Cronometer | Macros + food | No native CGM coaching loop |
| Noom | Behavior coaching | No biomarker-closed loop |
| InsideTracker | Labs → advice | No daily CGM + meal execution |

**Acqui-hire / strategic angle (long-term):** tuck-in for CGM ecosystem, insurer, or wellness brand — if retention and unique data asset are proven.

---

## What excites investors

- Real integration depth (not a ChatGPT wrapper on a glucose chart).
- Tailwinds: consumer CGM, GLP-1 awareness, longevity, AI health.
- Clinical-ish macro logic (cholesterol, kidney caps, energy balance) with **human-in-the-loop**.
- Multiple GTM paths (D2C, clinic, employer, regional).
- Builder credibility: documented ship cadence in `prompts/app/done/`.

---

## What worries investors

| Risk | Mitigation direction |
|------|----------------------|
| Feature stack vs one clear habit | Nail one hero loop + one ICP |
| Regulatory / liability | Wellness positioning; confirm cards; disclaimers; no diagnosis |
| Platform deps (Gemini, HC, Withings, xDrip+) | Abstract connectors; document fallbacks |
| Big tech / CGM OEM adds AI | Outcome data + clinical rules as moat |
| No traction metrics | 10–50 paid beta users + 8-week retention |
| Open-source MIT vs commercial | Separate commercial entity + privacy policy when fundraising |

---

## Pre-seed readiness checklist

- [ ] **ICP defined** — e.g. adults 40–60, LDL-focused, Libre + Withings, Israel or EN
- [ ] **10–50 paying beta users** (even low price)
- [ ] **8-week retention** on core loop
- [ ] **One outcome case study** — weight, LDL, TIR, or macro adherence (with disclaimers)
- [ ] **Pitch metric** — e.g. “% days on macro target” or “post-meal spike reduction”
- [ ] **Commercial wrapper** — entity, terms, privacy, support
- [ ] **Distribution hypothesis** — dietitian partners, CGM communities, or paid social test

---

## Suggested pitch framing

**Weak:** “We integrated CGM, Withings, labs, and AI chat.”

**Strong:** “CGM users see numbers but don’t know what to eat. We close the loop: every meal is logged, glucose response informs the coach, and an AI nutritionist revises daily macros from scale and labs — with human confirm before targets change. Early users [metric TBD].”

---

## Technical assets (for diligence)

- **App:** `app/` — React Native, Android release APK workflow
- **Macro brain:** `macroAutoAdjust.ts`, `macroFiberCoupling.ts`, `GeminiService` macro revision prompt
- **CGM:** persistence, period reviews, meal–glucose analysis
- **Specs:** `prompts/app/done/` — prompt35–42 cover macros, CGM chat, recipes, guards

---

## Lifestyle vs venture (advisor consensus)

Classic VC needs paid growth and 10× return. Today this is:

- ✅ **Proven** as a **personal metabolic OS** (founder POC)
- ⚠️ **Unproven** as venture until strangers pay and retain
- ✅ **Plausible** as **Israel niche business** if ~500k SAM estimate holds and 1–2% convert

See [EXECUTIVE-SUMMARY.md](./EXECUTIVE-SUMMARY.md) for friend-facing brief including Israel market table.

---

## What we offer that competitors don’t

**Lead message:** *Others sell dashboards; we sell decisions.*

- One **brain** across CGM + food log + scale + labs (not four apps)
- **Clinical-style macro engine** (energy balance, lipid/kidney/glycemic rules) — not generic AI calories
- **Human confirm** on macro changes; guards against bad auto-updates
- **Meal ↔ glucose** loop (`/eat`, `/recipe`, `/7`, food history)
- **Multi-mentor** chat on one period-review dataset
- **Hebrew + local labs** — regional moat vs US apps

---

## Document history

| Date | Note |
|------|------|
| 2026-06-20 | Initial investor POV memo |
| 2026-06-20 | Executive summary for advisor; POC done; IL market note |
| 2026-06-20 | [COMPETITOR-SCORES.md](./COMPETITOR-SCORES.md) — scores & positioning map |
| 2026-06-20 | [Nutricence-medilab.md](./Nutricence-medilab.md) — Nutrisense battle card |
| 2026-06-20 | [key-rule.md](./key-rule.md) — ICP filter + community / clinic channels |

---

*Internal use. Not medical or investment advice.*
