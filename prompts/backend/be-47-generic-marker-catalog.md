# be-47 — Generic treatment-marker catalog (table, not enum)

**Status:** needs-review (implemented 2026-08-20 — evidence below; VPS migrate + website deploy pending owner)  
**Model to implement:** Auto (schema + overlay hydrate + generic phone; catalog copy is not a clinical number)  
**Authored by:** Owner (2026-08-20 — iodine should not require an APK)  
**Depends on:** be-41 (markers overlay), prompt110 (phone meters + meal estimates)  
**Pairs with:** phone `TreatmentMarkerService` in this batch (generic overlay list)

## Evidence (Auto 2026-08-20)

- `server/` `tsc --noEmit` clean
- Table `diet_marker_catalog` in `schema.sql`; seed 9 codes incl. `IODINE_MCG`
- `GET`/`POST /v1/clinic/marker-catalog`; overlay GET hydrates labels + `estimateGuidance`
- Phone: `isDietMarkerCode` is a format check, not an allowlist
- Portal picker loads the catalog; “Add to catalog” form for new codes
- **Still needed:** `npm run migrate` on VPS + website deploy + one phone build (generic after that)

## Problem

Every new nutrient (iodine, then iron, …) was a **git enum** in three places: server,
portal picker, phone allowlist. Unknown codes were dropped on the phone, so a clinic
could not add a marker without an app release.

## Goal

- Catalog lives in Postgres (`diet_marker_catalog`). Seed the existing 9 codes
  (incl. `IODINE_MCG`).
- Clinic **picks** from the table and types the daily number (max 3).
- **Operators only** may add a catalog row (`ADMIN_EMAILS` — canonical `CODE_G|_MG|_MCG`
  + labels + optional AI estimate hint). Clinics only pick + type the daily number.
- Phone treats the overlay list as opaque: meter, persist, send to Gemini. Do not
  filter by a hardcoded enum.
- Overlay GET hydrates **labels** + **estimateGuidance** from the live catalog so
  meal AI gets definitions without TypeScript `if (IODINE_MCG)`.

## Files

- `server/src/db/schema.sql` — table
- `server/src/data/dietMarkerCatalogSeed.ts` — seed rows
- `server/src/services/treatmentMarkers.ts` — seed, list, POST, hydrate, validate
- `server/src/routes/clinic.ts` — GET/POST `/v1/clinic/marker-catalog`
- `server/src/services/clinicOverlay.ts` — hydrate on mentor + patient GET
- `website/clinic/clinic-workspace.js` + i18n — fetch catalog + add-row form
- `app/src/services/TreatmentMarkerService.ts` — format check, not allowlist
- `app/src/i18n/treatmentMarkersCopy.ts` — `markerUiLabel` prefers overlay labels

## Design rules

- Max **3** active markers per patient (unchanged).
- Units always-English: `g` | `mg` | `mcg`. Code suffix must match unit on catalog insert.
- Clinic types the **number**; catalog owns code/unit/labels/guidance.
- No parsing My Rules for “150 mcg iodine” (`ai-judgment-not-regex`).
- Seeded rows upsert on migrate; clinic-added rows (`seeded = false`) are insert-only.

## Acceptance criteria

- [ ] `GET /v1/clinic/marker-catalog` returns seed incl. `IODINE_MCG` after migrate
- [ ] `POST /v1/clinic/marker-catalog` with `IRON_MG` + EN label → 200; duplicate → 409; `IRON` without suffix → 400
- [ ] `PUT …/markers` rejects a code not in the table
- [ ] Patient overlay markers include `labels` + `estimateGuidance` when the catalog has them
- [ ] Phone `applyClinicMarkersFromOverlay` keeps an unknown-to-git code if the shape is valid
- [ ] Portal picker lists catalog rows; “Add to catalog” appears without a new APK

## Out of scope

- Per-org catalogs / owner-only ACL beyond mentor JWT
- Editing or deleting seed rows from the portal
- Raising max-3
- Deploy / VPS migrate (owner)

## Review by owner

**Evidence**

- `npm run migrate` on a DB with the new table
- Portal: iodine in the picker; add a dummy code on staging if willing

**Judgment**

- Is mentor POST-to-catalog acceptable, or should only the owner insert rows?
  → **Owner 2026-08-20:** operator (`ADMIN_EMAILS`) only; clinics pick from the list.

## Agent checklist

- [x] Status → in_progress
- [x] Changes match this draft
- [x] Acceptance criteria coded
- [x] Update `prompts/backend/README.md` table
- [x] Status → `needs-review` + evidence; **do not** self-move to done/
