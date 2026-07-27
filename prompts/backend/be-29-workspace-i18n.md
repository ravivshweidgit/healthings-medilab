# be-29 — Patient workspace i18n (`clinicLocale`)

**Status:** ready  
**Model to implement:** Auto  
**Authored by:** Opus 5 (clinic locale revise)  
**Depends on:** be-28 (wording freeze — extract once), be-26 (catalog + picker), language-policy.mdc  
**Splits from:** be-28 P4

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

## Scope — this batch

### Load the catalog on the workspace page

1. `patient.html` loads `clinic-i18n.js` **before** `clinic-workspace.js` / charts.
2. On boot call the same locale apply path as `index.html` (`lang` + `dir` on `<html>` for
   he/ar). Optional: a compact locale picker in the workspace topbar (reuse worklist
   control) — nice-to-have; reading `healthings_clinic_locale` is enough if the clinician
   already set language on the worklist.
3. Static topbar strings → `data-i18n` / `data-i18n-aria`.
4. Every JS-built chrome string → `ClinicI18n.t('…')` (or destructured `t`).

### Surfaces to translate (~150–180 keys, not 3,200 unique strings)

| Surface | Examples |
|---------|----------|
| Topbar | Back to portal, Patient workspace, Clinic view, Refresh snapshot, relative sync, Clinic rules active, load/refresh errors |
| Banner | Weight / Muscle / Fat / BMR / Body / No scan, Profile incomplete, rule-count chips, You / Patient fallbacks |
| Tabs | Dashboard, Profile, Lipids, Food log, Nutrition reports, Labs, Clinic chat, Rules (+ Live chip stays English glossary if owner prefers — default: translate “Live” UI chrome, keep `LIVE` acronym style optional) |
| Profile | Snapshot note, row titles (Profile / Targets / Care team / Dietary rules / Macro targets / Coach summary), DL keys, empties, mentor labels, Wins / Improve |
| Food log | FOOD LOG, energy lines, Today, meal-slot fallbacks (Breakfast…), view, modal chrome |
| Nutrition / Labs | Tab intros, Active badge, table headers Test / Value / Flag, empties |
| Chat / Rules | Privacy note, Send, Mentor thinking, Retry, Live rules, Save, Version history, source hints |
| Charts | TREND ANALYSIS, ENERGY, strip captions, legends (Glucose / Heart rate / …), empties, lipid chart title/disclaimer (remove hardcoded HE branch → `t()`) |

SelfView (`/account/` workspace chrome that shares these modules): **same keys**, with
paired clinic vs self notes where copy differs today
(`wsFoodNoteClinic` / `wsFoodNoteSelf`). Account **gate** (sign-in / delete) stays out
unless owner expands scope.

### Always-English glossary (do not translate)

`kcal`, `mg/dL`, `kg`, `g`, `ml`, `cm`, `%`, `CGM`, `BMR`, `AI`, `P` / `C` / `F` / `Fi` /
`C-Fi` / `H2O`, `Healthings`, `Withings`, lab codes (`LDL` `HDL` `TG` `TOTAL`), viewport
chips (`6H`…`32D`, `8D`…`128D`).

### Never translate (patient-authored / vendor)

Meal `name_local` / `name`, notes, rules prose, coach summary text, nutrition `fullText`,
chat message bodies, lab test names from PDF, workout `activityLabel`. Keep `dir="auto"`
on free-form patient prose; `dir="ltr"` on emails / IDs / numbers+units
(language-policy.mdc).

## Files to touch

- `website/clinic/clinic-i18n.js` — add `ws*` (or `workspace*`) key block × **all 10** locales
- `website/clinic/patient.html` — script tag, `data-i18n` on static chrome, boot apply
- `website/clinic/clinic-workspace.js` — replace chrome literals with `t()`
- `website/clinic/clinic-charts.js` — replace chrome literals with `t()`
- `website/account/index.html` — load `clinic-i18n.js` if shared workspace chrome is shown
- Bump `?v=` on every touched asset

**Do not touch:** `server/` (chat locale already wired), snapshot schema, ShareExport,
worklist keys unless a sync-relative string is intentionally unified.

## Implementation notes

- Reuse be-26 patterns: flat `COPY[locale].key`, `{n}` interpolate, per-string English
  fallback for missing keys during fill — but **acceptance requires all 10 locales filled**
  for new `ws*` keys (same bar as be-26).
- Relative sync: either extend existing `syncJustNow` / `syncMinutesAgo` or add
  `wsSyncedMinutesAgo: 'Synced {n} min ago'` — do not leave workspace on a parallel English
  formatter.
- Lipid chart: delete the ad-hoc Hebrew string branch; one catalog key per line.
- Mentor chrome icons stay Lucide; only the **labels** translate.
- After extracting keys, grep the three JS/HTML files for leftover user-facing English
  chrome (spot-check list in Acceptance).

## Acceptance criteria

- [ ] `patient.html` loads `clinic-i18n.js` and applies `lang` / `dir` from
      `healthings_clinic_locale`
- [ ] All 8 tab labels + banner metric labels + chart titles use `t()` in he and en smoke
- [ ] Hebrew clinic: worklist → patient workspace stays Hebrew chrome; patient meal/rules
      text unchanged
- [ ] English clinic + Hebrew patient: chrome English; mentor chat still English (be-28)
- [ ] RTL (he/ar): `html[dir=rtl]`; patient prose still `dir="auto"`; emails/IDs `dir="ltr"`
- [ ] Every new `ws*` key present in all 10 locales (no blank labels)
- [ ] Glossary tokens still English in every locale
- [ ] `/account/` selfView notes still first-person via self keys
- [ ] `?v=` bumped; hard-refresh shows new copy

## Out of scope

- be-30 labs/lipids clinical redesign
- Server-persisted clinic locale column (still localStorage per be-26)
- Translating invite email language
- Machine-translating clinic-written rules for the patient (open language-policy question)
- Re-opening be-28 IA / layout

## Review by Opus 5 (after Auto marks needs-review)

**Evidence to capture**

- Screenshots: worklist he → workspace Dashboard / Profile / Food log / Rules (he)
- Same four tabs with portal locale `en` and a Hebrew-patient snapshot
- RTL check: banner stats + tab bar + chat compose

**Judgment calls to check**

- Do uppercase strip titles (`TREND ANALYSIS`) feel right when localized, or should some
  stay English like the phone?
- Is a workspace locale picker needed, or is “set on worklist” enough?
- Any chrome string still leaking English on a secondary tab?

## Agent checklist

- [ ] Status → `in_progress`
- [ ] Catalog keys × 10 locales
- [ ] Wire `t()` + load i18n on `patient.html`
- [ ] Grep pass for leftover chrome English
- [ ] Status → `needs-review` + evidence; update `prompts/backend/README.md`
- [ ] Do **not** move to `done/` without owner acceptance
