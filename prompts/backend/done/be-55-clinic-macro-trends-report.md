# be-55 — Clinic macro trends report (Target vs Actual) Phase 1

**Status:** done (2026-08-28 — shipped & owner accepted; deployed to VPS)  
**Model to implement:** Auto (portal client calculation + Gemini chat integration + i18n + CSS)  
**Authored by:** Owner (2026-08-28 — clinic-wide macro progress & trends report)  
**Depends on:** be-45 (clinic live macros overlay), be-41 (treatment markers overlay), be-39 (clinic AI chat)  
**Pairs with:** `website/clinic/index.html`, `website/clinic/clinic-portal.css`, `website/clinic/clinic-i18n.js`

## Evidence (Auto 2026-08-28)

- `website/clinic/index.html` — `#macro-report-panel` with 7d/14d range toggle, AI summary checkbox (default unchecked), progress bar, patient cards grid with compact chip styling (green on-target/flex, red over/under, neutral gray calories under floor, 2% tolerance margin, percentage-to-gram conversion, excluding current day).
- `website/clinic/clinic-portal.css` — CSS styling with dark/light variables and RTL/LTR support, full chip coloring, compact vertical card height.
- `website/clinic/clinic-i18n.js` — translations in English and Hebrew (and all 10 locales).
- Client-side calculation: downloads active snapshots, parses with `ClinicWorkspace.parseSnapshot`, calculates logged day averages for Kcal, Protein, Carbs, Fat (Flex Fill), Fiber, Sat Fat, Soluble Fiber, and evaluates against targets (floor/ceiling/strength) with 2% tolerance.
- Gemini integration: runs `POST /v1/clinic/patients/:id/chat` with concise prompt: `"עבור 7 הימים האחרונים (לא כולל היום הנוכחי): תן סיכום לכל מקרו , הכי תמציתי שאפשר : יעד | ממוצע בפועל"`.

## Problem

Clinicians and dietitians managing multiple alpha/active patients needed a quick, clinic-level report to immediately see which patients are adhering to their nutritional targets and which need attention, without having to manually open each patient workspace one by one.

## Goal

- Provide a dedicated **Macro trends report (Target vs Actual)** view in the clinic portal (`website/clinic/index.html`).
- Support 7-day and 14-day lookback windows (excluding current partial day).
- Automatically calculate daily logged averages vs target bounds for:
  - Energy (Kcal)
  - Protein (g)
  - Carbohydrates (g)
  - Fat (g) (Flex Fill treated as on-target unless explicit clinic bounds set)
  - Fiber (g)
  - Active treatment markers (e.g. Saturated Fat `SAT_FAT_G`, Soluble Fiber `SOLUBLE_FIBER_G`, `IODINE_MCG`, `SELENIUM_MCG`).
- Visual badges indicating status: `On target` (green), `Over ceiling` (soft red), `Under floor` (soft red for macros, neutral gray for kcal), with 2% (min 1g/10kcal) tolerance margin.
- Run AI mentor summary per patient (collapsible by default, with rerun button).

## Files

| File | Purpose |
|---|---|
| `website/clinic/index.html` | Macro trends report UI view, data loading loop, calculation engine, AI runner |
| `website/clinic/clinic-portal.css` | Panel styling, responsive metrics grid, status badges, chip background coloring |
| `website/clinic/clinic-i18n.js` | Translations for report headers, metrics, badges, and progress states |

## Verification Checklist

- [x] `#macro-report-panel` rendered in clinic portal view
- [x] 7-day / 14-day radio selector
- [x] Progress indicator showing current patient being loaded/analyzed
- [x] Accurate averaging over days with logged meals (excluding current day)
- [x] Comparison against `overlay.macros` bounds and `overlay.markers` targets with 2% tolerance
- [x] Percentage targets resolved to grams
- [x] Status badges and colored chips for each metric
- [x] AI summary prompt execution via `/v1/clinic/patients/:id/chat`
- [x] Per-patient Rerun AI button
- [x] Direct link from report card to patient workspace (`patient.html?patientId=...&name=...`)
