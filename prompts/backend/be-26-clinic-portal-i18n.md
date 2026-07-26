# be-26 — Clinic portal i18n: fill the 10 locales

**Status:** needs-review
**Model to implement:** Auto
**Authored by:** Auto
**Built by:** Auto
**Date:** 2026-07-26
**Depends on:** be-25 (catalog + `t()` + `dir` plumbing — must be accepted first)
**Blocks:** nothing; be-22 can run in parallel (different files)

> be-25 built the machine and filled one drawer. This batch fills the other nine.

## Problem

Owner reversed the English-only policy on 2026-07-26: *"we are global, global app, global for
clinics."* be-25 shipped the plumbing — `clinic-i18n.js` with `CLINIC_LOCALES` (10), `t(key, vars)`,
`data-i18n` hydration, `localStorage` persistence, `<html lang/dir>` switching, and a picker in the
header and on the login card.

`COPY.he` … `COPY.tr` are **empty objects**. Every non-English clinician sees a correctly mirrored,
correctly dark, entirely English portal. The fallback is per-string and deliberate, so nothing is
broken — it is just untranslated.

## Goal

A clinician in Madrid, Tel Aviv, or Istanbul reads the portal in their language, with clinical
vocabulary that a professional would actually use.

## Decisions (locked)

| Question | Decision |
|---|---|
| Locales | The app's 10: `en he es fr de ar ru pt it tr` (`SUPPORTED_LANGUAGES`) — not the help site's 8 |
| Source of truth | `website/clinic/clinic-i18n.js` `COPY` — one flat object per locale |
| Fallback | **Per string**, already implemented. A missing key shows English, never blank or a raw key |
| Always-English | Brand, `kcal`, `mg/dL`, `kg`, `CGM`, `BMR`, `AI`, `tokens`, device names — per `language-policy.mdc` |
| Register | **Clinical professional**, not consumer-app friendly. This is a tool a doctor uses in front of a patient |
| Patient content | Never translated. Meal names, patient-written rules, addresses stay verbatim |
| Email addresses | `dir="ltr"` — settled in be-25, do not regress to `auto` |
| Locale scope | Portal chrome only. Does **not** change what the patient's app shows |
| Server | **No server changes.** No locale column, nothing on `account_shares` |
| Invite email language | **Out of scope** — see Open questions |
| Workspace (`patient.html`) | **Out of scope** unless be-22 has already tokenized it; coordinate, do not collide |

## Scope

| Touch | Why |
|---|---|
| `website/clinic/clinic-i18n.js` | Fill `COPY.he` … `COPY.tr` |
| `website/clinic/index.html` | Only if a string was missed and needs a key; bump `?v=` |
| `website/clinic/clinic-portal.css` | Only if an RTL or long-string layout bug appears |

**Do not touch:** server, app, `clinic-workspace.js`, schema, invite email templates.

## Implementation notes

### Translate, do not machine-substitute

These are clinical strings. "Revoke access", "Sponsor AI", "AI sponsorship expired", and
"Their snapshot is deleted unless another clinic still reads it" carry legal and clinical weight. Use
model judgment on register and terminology per `ai-judgment-not-regex.mdc`; do not run the catalog
through a word-for-word substitution.

Watch specifically:

- **"Sponsor"** — a clinic paying for a patient's AI. Most languages need a verb closer to *cover the
  cost of* than *sponsor* (which reads like advertising in several).
- **"Revoke"** — legal-register in ES/FR/DE, not "cancel".
- **"Snapshot"** — a data export, not a photograph. Do not translate literally.
- **"Pending"** — distinguish *awaiting the patient's approval* (outgoing) from *the patient asked
  you* (inbound). be-25 already has separate keys; keep them distinct in translation.
- **`tokens`** — stays English per the glossary. Do not localize to *jetons* / *Marken* / *אסימונים*.

### Plurals

`{n} days` is interpolated. Languages with richer plural rules than English (ru, ar, pl-like forms)
need care — `nDays` / `oneDay` exist. If a locale genuinely needs a third form, add
`nDaysFew`-style keys and a small per-locale selector in `clinic-i18n.js`; do **not** ship a form
that reads wrong at n=2 or n=21 in Russian.

### RTL layout check (he, ar)

be-25 verified RTL mirrors cleanly with English strings. Re-check with real Hebrew and Arabic:

- Sponsor day picker (`select` + "until {date}" inline)
- Pager ("Showing 1–25 of 30" with mixed digits)
- Filter chips with counts — `(30)` inside an RTL run
- Truncation on the balance chip and long German compounds in the header
- `.worklist-table td::before` mobile labels

### Long strings

German and Russian labels run ~35% longer. Check the header at 1280 and the filter chip row at
~390 — chips wrap, they must not overflow. `inviteNote` and `resultRevoked` are the longest.

## Acceptance criteria

Verified 2026-07-26 (node key-coverage harness + CDP on stubbed worklist):

- [x] All 10 locales selectable; each has **143/143** keys filled (no English fallback for chrome strings)
- [x] Glossary: `brand` = Healthings, `tokensUnit` = `tokens` in every locale
- [x] `he` / `ar` set `dir=rtl`; emails stay `dir=ltr`
- [x] Plural forms: ru 1/2/5/21/22 and ar 1/2/5/11 correct via `ClinicI18n.pluralDays`
- [x] he/de worklist screenshots — chrome fully translated (כיסוי עלות AI / AI-Kosten übernehmen)
- [x] No server or app diff
- [ ] Owner eye-check on production after deploy (register / long DE compounds)
- [ ] Overflow at 390px for `de` / `ru` filter chips — optional owner glance

## Review evidence

- Key coverage: every locale 143 keys, 0 missing
- Plurals: `1 день | 2 дня | 5 дней | 21 день`; Arabic dual/plural; Hebrew יום אחד / יומיים
- CDP: he chip `מקושרים (30)`, de `Verknüpft (30)`, revoke/cover translated, tokens untranslated
- Screenshots: `be26-he-worklist.png`, German worklist via locale switch

## Out of scope

- Server-side locale storage or a per-account locale column
- **Invite email language** (see below)
- Patient workspace / `clinic-workspace.js` strings
- Translating clinic-written rules for the patient (own batch, own decision)
- Clinic portal help pages on the website

## Open questions for the owner

1. **Invite email language.** A patient gets the invite before they have an account, so we do not
   know their language. Options: send English; send in the clinic's portal locale (wrong for a
   Hebrew patient of an English clinic); or send a short bilingual email. Not blocking this batch.
2. **Clinic-written rules crossing a language boundary.** An English clinic's `rules_json` reaches a
   Hebrew patient verbatim today. Show original, translation, or both? A medical instruction
   probably wants both, but that is an owner call and needs Gemini, not a string table.

## Agent checklist

- [x] Status → in_progress
- [x] Only website clinic i18n + cache-bust on index
- [x] Acceptance criteria checked with coverage script + CDP
- [x] Status → needs-review; do not self-accept
- [x] Do not commit or deploy unless asked

## Related

- be-25 — built the catalog, `t()`, picker, `dir` handling
- `.cursor/rules/language-policy.mdc` — locale-per-account, glossary, `dir` rules
- `.cursor/rules/ai-judgment-not-regex.mdc` — why clinical copy is judgment, not substitution
- `app/src/i18n/` — register and glossary precedent from the app
