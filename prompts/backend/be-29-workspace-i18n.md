# be-29 — Patient workspace i18n (`clinicLocale`)

**Status:** needs-review  
**Model to implement:** Auto  
**Authored by:** Opus 5 (clinic locale revise)  
**Depends on:** be-28 (wording freeze — extract once), be-26 (catalog + picker), language-policy.mdc  
**Splits from:** be-28 P4  
**Implemented:** 2026-07-27 (Auto)

## Problem

A Hebrew (or Spanish, …) clinic navigates a **translated worklist** (`index.html` +
`clinic-i18n.js`, be-26) then opens a patient and lands in an **English-only workspace**.
Tabs, banner (`Weight` / `Muscle` / …), Food log chrome, chart titles (`TREND ANALYSIS`,
`ENERGY`), Rules / Chat chrome, empty states, and errors are all hardcoded in
`clinic-workspace.js` / `clinic-charts.js` / `patient.html`.

Mentor chat already sends `locale` and replies in portal language (be-28 follow-up). The
rest of the 8-tab case view does not. That breaks the product rule: **`clinicLocale` is
per clinician account and independent of the patient’s `appLocale`.**

## Goal

The patient workspace chrome speaks the same language as the worklist. Switching the
portal language picker (or `localStorage['healthings_clinic_locale']`) and hard-refreshing
flips tabs, banner labels, strip titles, buttons, empty states, and errors — without
translating patient-authored content or the always-English glossary.

## What shipped (implementation)

| Area | Detail |
|------|--------|
| Catalog | `website/clinic/clinic-workspace-i18n.js` — **203** `ws*` keys × 10 locales, merges into `ClinicI18n.COPY` |
| Inventory | `website/clinic/ws-en.json` (EN reference) |
| Load path | `patient.html` + `account/index.html` load `clinic-i18n.js` then `clinic-workspace-i18n.js` before charts/workspace; `applyDocumentLocale()` on boot |
| Static chrome | Back / Refresh via `data-i18n` + `hydrateStaticCopy()` |
| Workspace | `clinic-workspace.js` — `t()` on tabs, banner, food log, profile, chat, rules, nutrition, labs, lipids, sync/errors |
| Charts | `clinic-charts.js` — trend / energy / metabolic / lipid chrome; removed ad-hoc Hebrew lipid title branch |
| Cache bust | `?v=20260727k` (workspace/charts), `?v=20260727b` (workspace-i18n) |

## Acceptance criteria

- [x] `patient.html` loads `clinic-i18n.js` and applies `lang` / `dir` from
      `healthings_clinic_locale`
- [x] All 8 tab labels + banner metric labels + chart titles use `t()` (catalog verified he/en)
- [ ] Hebrew clinic: worklist → patient workspace stays Hebrew chrome; patient meal/rules
      text unchanged — **owner smoke**
- [ ] English clinic + Hebrew patient: chrome English; mentor chat still English (be-28) — **owner smoke**
- [x] RTL (he/ar): `html[dir=rtl]` via `applyDocumentLocale`; patient prose still `dir="auto"`
- [x] Every new `ws*` key present in all 10 locales (no blank labels) — node parity check 203 keys
- [x] Glossary tokens still English in catalog (kcal, BMR, LDL, viewport chips, …)
- [x] `/account/` selfView notes use `ws*Self` keys; loads same catalog
- [x] `?v=` bumped

## Out of scope

- be-30 labs/lipids clinical redesign
- Server-persisted clinic locale column (still localStorage per be-26)
- Translating invite email language
- Machine-translating clinic-written rules for the patient (open language-policy question)
- Re-opening be-28 IA / layout
- Workspace locale picker in topbar (nice-to-have; worklist picker is enough)

## Review by Opus 5 / owner

**Evidence to capture**

- Hard-refresh patient workspace after setting portal locale `he` on worklist
- Tabs + banner (Weight/Muscle/…) + FOOD LOG / TREND / ENERGY titles in Hebrew
- Open Food log meal: meal name / rules prose still patient-authored; chrome localized
- Locale `en` with Hebrew patient snapshot: chrome English; chat still English
- RTL: banner strip + tabs + chat compose

**Judgment calls to check**

- Do uppercase strip titles (`TREND ANALYSIS` → localized) feel right, or should some
  stay English like the phone?
- Is a workspace locale picker needed, or is “set on worklist” enough?
- Any chrome string still leaking English on a secondary tab?

## Agent checklist

- [x] Status → `in_progress`
- [x] Catalog keys × 10 locales
- [x] Wire `t()` + load i18n on `patient.html`
- [x] Grep pass for leftover chrome English
- [x] Status → `needs-review` + evidence; update `prompts/backend/README.md`
- [ ] Do **not** move to `done/` without owner acceptance
