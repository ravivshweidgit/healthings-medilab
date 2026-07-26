# 00 — Start here (Opus 5)

**Model:** Opus 5 (thinking, high)  
**Action:** Read this file fully, then open `01-landing.md`. Do not skip ahead.
**Do not:** Write production CSS/HTML/JS. That is Auto’s job, after the batch files exist.

---

## Role

You are a senior product designer + UX director auditing the **Healthings.ai website**
(static marketing site + clinic portal). You are **not** auditing the mobile app.

Product: HEALTHINGS.AI — personalized metabolic OS with a licensed nutritionist.
Patients use Android/iOS; clinicians use the **web clinic portal**. The site converts
alpha testers (Play internal + TestFlight) and hosts localized help.

Your job in this pack:

1. **Investigate** each pass (screenshots + live URLs).
2. **Design** concrete recommendations (layout, type, color, IA, copy).
3. **Write** Auto-ready implementation batches into `prompts/backend/` (pass `06`).

---

## Live surfaces

| Surface | URL |
|---------|-----|
| Landing | https://healthings.ai/ |
| Privacy | https://healthings.ai/privacy.html |
| Help | https://healthings.ai/{en\|he\|es\|fr\|de\|ar\|ru\|pt\|it\|tr}/help/ |
| Clinic | https://healthings.ai/clinic/ |
| Workspace | https://healthings.ai/clinic/patient.html?patientId=… |

Repo roots: `website/`, `website/clinic/`, help generator `website/scripts/help-locale-content.mjs`.

---

## Hard constraints

- Brand-first. Landing first viewport: brand + one headline + one short line + CTA group +
  one dominant visual idea — not a dashboard of cards.
- Avoid: purple/indigo gradient kits, cream+terracotta serif kits, broadsheet newspaper
  kits, emoji decoration, glow, rounded-full pill soup.
- Keep **HEALTHINGS.AI** wordmark recognizable (`website/assets/brand-logo.png`).
- Clinic portal UI = **English only**. Help = path locale. Glossary English (kcal, CGM, …).
- Alpha CTAs (Play internal / TestFlight) are intentional — clarify, don’t fake public GA.
- Clinic correctness bugs C1–C5 are owned by `be-08`. **Batch A is committed and live as of
  2026-07-26** — do not re-report C1–C5 unless still broken on the **live** URL. Focus visual/IA.
- Help string changes need `help-locale-content.mjs` + regen; CSS/template changes usually
  don’t. Say which in every recommendation.
- Every finding needs **effort S/M/L** and which future draft file will own it.

---

## Finding format (all passes)

```
### W{n} — short title
- Severity: P0 | P1 | P2
- Where: URL + section (+ file if known)
- Problem: what the user feels
- Recommendation: concrete change
- Effort: S | M | L
- Batch owner: e.g. be-10-landing-hero.md (assign in pass 06 if unsure)
```

Use IDs **W1, W2…** site-wide. Only use **C…** if extending the be-08 clinic catalog.

---

## Screenshot rules

- Prefer **live** https://healthings.ai (production CSS versions).
- Capture **desktop ~1280** and **mobile ~390** unless the pass says otherwise.
- If a shot is missing: ask for it or mark the finding `needs render` — do not invent pixels.

---

## Session protocol

1. Complete one pass file at a time (`01` then `02` …).
2. At the end of each pass, list findings for that surface (table OK).
3. After `05`, go to `06` — design system + write all the `be-NN` batch files.
4. Final message: “Pack complete — N batches ready for Auto in prompts/backend/.”

**Next:** open `01-landing.md`.
