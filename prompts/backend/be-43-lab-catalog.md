# be-43 — Lab PDF catalog (countries / providers / prompt packs)

**Status:** needs-review  
**Model to implement:** Auto  
**Builds on:** prompt112 (IL two-pass), prompt113 (country gate)  
**Authored:** 2026-08-16

## Problem

Lab layout packs cannot stay hardcoded in the APK once the product is global. Ops need to add a
problematic format (provider + prompt version) without a store release.

## Goal

Server DB catalog + authenticated read API. App Lab UI gates import on country; chips use
**`name_native ?? name_en`** (country brand language — **not** `appLocale`).

## Schema

- `lab_countries` — `code`, `name_en`, `name_native`, sort, active  
- `lab_providers` — per country: `code`, `name_en`, `name_native`, sort, active  
- `lab_prompt_packs` — `country_code`, `provider_code` (`''` = country-level), `kind`
  (`identify` | `parse_layout` | `parse_base` | `repair`), `version`, `body`, active  

Seed: IL + US countries; IL HMOs; IL/US prompt bodies (ensure seed on migrate / first GET).

## API

| Method | Path | Auth |
|--------|------|------|
| GET | `/v1/lab/countries` | Bearer |
| GET | `/v1/lab/catalog/:countryCode` | Bearer |

Response includes computed `displayName = name_native ?? name_en`.

## Naming rule (locked)

| Field | Role |
|-------|------|
| `code` | Canonical machine id (`meuhedet`, `quest`) |
| `name_en` | Canonical English for DB / clinicians / logs |
| `name_native` | Brand as locals know it (מאוחדת for IL) — **country language**, not user language |
| UI chips | Always `displayName` from catalog |

Coach language may be English while lab country is IL → chips still show מאוחדת.

## Files

- `server/src/db/schema.sql`, `migrate.ts`
- `server/src/services/labCatalog.ts`
- `server/src/routes/labCatalog.ts`, `index.ts`
- App: `LabCountryService`, `LabCatalogService`, `LabReportModal`, `LabResultsStrip`, `GeminiService`, `labResultsStripCopy`
- `prompts/app/100-200/prompt113.txt`

## Acceptance

- [ ] `npm run migrate` creates tables + IL/US seed
- [ ] GET countries / catalog/:code with JWT
- [ ] Fresh app: no PDF import until country chosen in Lab UI
- [ ] IL: Meuhedet confirm path still works (packs from API or embedded fallback)
- [ ] Provider chip labels from `name_native` for IL, not from appLocale catalog alone
- [ ] VPS migrate + API restart before phone smoke against production

## Evidence (implementer)

- Local: schema appended; routes registered; app gate wired.
- Deploy: owner must run migrate on VPS for live catalog (until then app uses offline IL/US fallback).
