# be-41 — Clinic-set treatment markers (custom macros, server + portal)

**Status:** needs-review (implemented 2026-08-12 — evidence below; VPS migrate + portal deploy pending owner)  
**Model to implement:** Auto (schema + routes + portal panel); owner reviews marker enum before first real patient  
**Authored by:** Owner + Fable 5 (2026-08-12 chat — customized macros discussion)  
**Depends on:** be-23 (consent/audit), be-25/26 (workspace panel IA + clinicLocale), be-40 (Gemini proxy, for the app half)  
**Pairs with:** `prompts/app/100-200/prompt110.txt` (app half — implement this batch FIRST; the app pulls what this creates)  
**Extended by:** `be-45-clinic-live-macro-bounds.md` § *Markers tab alignment* — marker rows adopt the macro `<` / `>` type select; `SAT_FAT_G` gains **additive** `percentOfEnergy` + `ofEnergy` (`dailyTarget` keeps holding grams, so installed apps are unaffected); catalog gains nullable `kcal_per_gram`; `geminiClinic` percent formatting fixed. Markers stay a separate object; no FLEX, no range in v1. **No migration** — existing marker rows are untouched.

## Evidence (Auto 2026-08-12)

- `server/` `tsc --noEmit` clean
- Schema: `markers_json JSONB` on `clinic_org_overlays` (+ `ALTER … IF NOT EXISTS`)
- Routes: `PUT /v1/clinic/patients/:patientId/markers`, `GET /v1/clinic/marker-catalog`; overlays include `markers`
- Audit actions: `markers.read` / `markers.write`
- Portal: **Treatment markers** tab (clinic-only), max 3, lab provenance hint from snapshot, `clinicLocale` keys (`wsTreat*` + he full / others EN fallback for panel body)
- Max markers locked at **3** (owner agreed 2026-08-12)
- **Still needed for live smoke:** `npm run migrate` (or deploy script) on VPS + website deploy; curl PUT/GET with mentor JWT; portal screenshots en+he

## Problem

Every patient gets the same macro axes (P/C/F/Fi/net), but the number that decides a
treatment's success is usually problem-specific: saturated fat for an LDL patient,
sodium for hypertension, potassium/phosphorus for kidney. Today the nutritionist can
only write these as free-text rules — untracked, untranslated, invisible between
visits. The clinic needs to *set* a small number of structured daily markers and
*see* adherence between visits.

## Why structured beats rules text here

`rules_json.rawText` reaching a Hebrew patient verbatim in English is an open
language-policy problem. A treatment marker is **structured data** — canonical code +
number + direction (`SAT_FAT_G, cap, 15`). Nothing to translate: the portal renders
labels from the `clinicLocale` catalog, the app from `appLocale`. Same trick as lab
codes. Units stay always-English glossary (`g`, `mg`).

## Canonical diet-marker enum (v1 — shared constant, server + app)

| Code | Unit | Typical direction | Linked lab codes (provenance seed) |
|------|------|-------------------|-------------------------------------|
| `SAT_FAT_G` | g | cap | `CHOLESTEROL_LDL`, `CHOLESTEROL` |
| `CHOLESTEROL_MG` | mg | cap | `CHOLESTEROL_LDL`, `CHOLESTEROL` |
| `SOLUBLE_FIBER_G` | g | floor | `CHOLESTEROL_LDL` |
| `OMEGA3_G` | g | floor | `TRIGLYCERIDES` |
| `ADDED_SUGAR_G` | g | cap | `HBA1C`, `GLUCOSE`, `TRIGLYCERIDES` |
| `SODIUM_MG` | mg | cap | — (blood pressure, no lab code yet) |
| `POTASSIUM_MG` | mg | cap or floor | `CREATININE`, `UREA` |
| `PHOSPHORUS_MG` | mg | cap | `CREATININE`, `UREA` |
| `IODINE_MCG` | mcg | floor | `TSH` |

Rules:

- Exact code match only — no name/keyword matching anywhere (lab-code precedent,
  `ai-judgment-not-regex.mdc`).
- The linked-lab column is a **suggestion seed** for the portal UI ("patient has an
  LDL result → surface SAT_FAT_G first"), not an auto-set. Every target value is
  **typed by the clinician** — the server never computes or defaults a clinical number.
- Lab-code matching reuses the existing canonical sets (`CHOLESTEROL_LDL`, `HBA1C`,
  `CREATININE`, … — same codes as `LabLogService` / lab import).
- Max **3 active markers** per patient per org (UI space on the phone macro strip +
  photo-AI estimate quality degrades on micro-markers; enforce server-side).

## Data model

New column on the existing overlay row (same delivery path as rules — do NOT invent a
parallel store):

```sql
ALTER TABLE clinic_org_overlays ADD COLUMN markers_json JSONB;
```

```ts
type TreatmentMarker = {
  marker: DietMarkerCode;          // enum above
  direction: 'cap' | 'floor';
  dailyTarget: number;             // clinician-typed, > 0
  unit: 'g' | 'mg';                // fixed per marker code; server validates
  linkedLabCodes: string[];        // canonical lab codes, may be empty
  note?: string;                   // clinician free text (shown verbatim, dir="auto")
  setAt: string;                   // ISO
  setBy: string;                   // mentor user id
};
// markers_json = { markers: TreatmentMarker[], updatedAt: string }
```

## Routes

- `GET /v1/clinic/overlays` (existing patient pull) — response gains
  `overlay.markers: TreatmentMarker[] | null`. No new endpoint; the app already polls
  this (`ClinicOverlayService.pullClinicOverlays`).
- `PUT /v1/clinic/patients/:patientId/markers` (new, mentor JWT) — validate: known
  codes only, unit matches code, ≤ 3 markers, `dailyTarget > 0`. Same
  `assertMentorPatientAccess` + `recordPatientAccess` (`action: 'markers.write'`)
  as the rules PUT.
- `GET /v1/clinic/patients/:patientId/overlay` (existing mentor read) — include
  markers; audit `markers.read` rides the existing `rules.read` record.

## Portal panel (patient workspace)

- New "Treatment markers" card in the workspace, after the rules card.
- Add marker: dropdown of the catalog codes, localized labels from the `clinicLocale`
  catalog (10 languages — extend the same catalog file be-26 filled; **no inline
  strings**). Direction chip (cap/floor), numeric target + fixed unit, optional note.
- If the patient's snapshot has a lab result whose canonical code appears in a
  marker's `linkedLabCodes`, show it inline next to the picker
  ("LDL 148 mg/dL — Jul 2026") so the clinician sets the cap in context. Exact code
  match against the snapshot labs — no fuzzy anything.
- Show which markers are active + who set them + when. Delete = remove from array.

## Adherence view — explicitly phase 2

The patient snapshot the portal already receives contains the food log. Once
prompt110 ships (meal entries carry per-marker estimates), the workspace can sum
daily totals vs cap/floor and overlay them against the linked lab-code trend across
draws ("held SAT_FAT_G cap 80 days → LDL 148 → 122"). **Do not build this in be-41**
— it needs prompt110's data shape to exist first. Leave a stub section in the panel
("Adherence — needs app 1.2.32+").

## Acceptance criteria

- [ ] `PUT …/markers` rejects: unknown code, wrong unit, 4th marker, target ≤ 0, non-mentor JWT
- [ ] `GET /v1/clinic/overlays` returns markers for the patient; `null` when unset
- [ ] Portal panel renders in `clinicLocale` (spot-check he + en; RTL `dir` correct; patient note `dir="auto"`)
- [ ] Audit rows written on read + write (`markers.read` via overlay read, `markers.write`)
- [ ] Existing rules save/pull untouched (regression: portal rules edit still reaches the phone)
- [ ] Multi-org: markers are per-org like rules; patient pull returns the most recently updated org's markers (same deferred multi-clinic decision as rules — document, don't solve)

## Out of scope

- App-side rendering, meal estimates, HARD-constraint wiring → prompt110
- Adherence charting (phase 2, above)
- AI-proposed markers for solo users (phase 2 of prompt110; portal is human-only)
- Marker history/versioning (rules-history pattern exists if needed later; don't build yet)
- Translating clinician `note` text (same open owner decision as rules text)

## Review by owner (after Auto marks needs-review)

**Evidence to capture**

- curl transcript: PUT 2 markers → GET overlays shows them; PUT invalid code → 400
- Portal screenshots (1280 + 390): panel in en + he, marker set for the owner's own patient account with `CHOLESTEROL_LDL` provenance visible

**Judgment calls to check**

- Catalog is 9 seed codes plus clinic-added rows as of be-47 (`diet_marker_catalog`). Further micronutrients are table rows, not APKs.
- Does "most recent org wins" stay acceptable for markers, or does multi-clinic need resolving sooner than it did for rules?

## Agent checklist

- [ ] Status → in_progress
- [ ] Changes match this draft only
- [ ] Acceptance criteria above
- [ ] Update `prompts/backend/README.md` table
- [ ] Status → `needs-review` + evidence; **do not** self-move to done/
