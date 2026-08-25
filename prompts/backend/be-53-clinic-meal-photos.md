# be-53 — Clinic meal-photo lightbox + snapshot size for 30-day thumbs

**Status:** blocked — prompt116 thumbs pulled 2026-08-25 for phone performance; revisit with 116  
**Model to implement:** Auto (blob route + portal modal). Chart mark placement is taste — owner in the portal.  
**Authored by:** owner request 2026-08-22  
**Depends on:** prompt116 Phase 2 (phone uploads each JPEG as binary, keyed by `photoId`)

> **Cap raise is void (2026-08-25).** The sections below were written when the phone injected
> base64 thumbs into the gzipped snapshot, and the 32 MB / 40 MB raises existed to make that
> fit. That transport is what got pulled. **Do not raise either cap** — a request to do so
> means file bytes reached the JSON again (`render-path-reads-memory.mdc`). Photos now arrive
> on their own binary route and the portal fetches one image by id when the lightbox opens.

## Problem

The clinic metabolic chart already shows orange kcal triangles (same 24H strip as the phone).
Tapping a meal chip opens item macros. There is no plate. The snapshot carries `photoId` on
each meal but no way to see the picture.

## Goal

Clinician taps the triangle or the meal chip → the existing meal card shows the plate on top
when one exists. Camera mark from `photoId` presence in the snapshot. The snapshot itself stays
the size it is today.

## Files to touch

- `server/src/routes/mealPhotos.ts` — new: `PUT /v1/meal-photos/:photoId` (octet-stream,
  per-route `bodyLimit` ~2 MB), `POST /v1/meal-photos/missing`, `GET /v1/meal-photos/:photoId`
  for the portal behind the same share authorization as the snapshot
- `server/src/db/schema.sql` — `meal_photos` (`patient_id` FK ON DELETE CASCADE, `photo_id`,
  `bytes BYTEA`, `UNIQUE (patient_id, photo_id)`), following the `sync_blobs` pattern. Cascade
  gives be-19 account deletion for free; unshare/purge still needs an explicit sweep (be-17)
- Do **not** touch `server/src/services/sync.ts` or `cloudBackup.ts` caps — see the note above
- `website/clinic/clinic-workspace.js` — `showMealModal` plate; meal-chip camera hint
- `website/clinic/clinic-charts.js` — clickable meal triangle when photo exists; camera mark
- `website/clinic/clinic-workspace.css` — modal image, chip hint (existing portal tokens)
- `website/clinic/clinic-workspace-i18n.js` — short strings (Photo / Open plate) in 10 locales
- Parser that builds `ctx.parsed.meals` — attach `photoId` / lookup into `healthings:mealPhotos`
- Do **not** touch: Gemini clinic prompts (no auto-attach of JPEGs), public `/the-clinic/` page

## Design rules

- **Lazy:** nothing image-related on workspace load. Set the `<img src>` to the blob URL when
  the modal opens — the browser fetches and decodes it, and never for meals nobody taps.
- **One plate per meal.** No `photoId` = no camera mark (text meal). `photoId` present but the
  blob 404s = the phone purged it past 30 days before a Share; degrade quietly, no broken icon.
- Meal names, rules, chat stay patient-authored (`dir=auto`). Emails/IDs stay `dir=ltr`.
- Always-English glossary: kcal stays kcal. Do not machine-translate the plate.
- Do not tile photos under the calorie strip. Mark + tap only (same as prompt116).
- **Caps unchanged.** Clinic upload stays **15 MB gzipped**, cloud backup **25 MB**. The
  snapshot gains one sha string per camera meal, so there is nothing to raise.
- Blobs follow the snapshot's lifecycle: same share authorization, and deletion on unshare /
  account delete / snapshot purge (be-17, be-19). A revoked clinic must not keep plate URLs.

## Implementation notes

- Snapshot key `healthings:mealPhotos`: `{ [photoId]: "<jpeg-base64>" }` (prompt116).
  JPEG data URLs in the modal: `data:image/jpeg;base64,…`
- Chart: reuse meal timestamp hit area; cursor pointer when photo exists. Tap opens
  `showMealModal` for that meal (same card as the chip).
- Meal chip: small camera affordance when `photoId` is in the map; chip click still opens
  the same modal (photo on top, then items).
- Copy: keep short (localize-speak-like-a-person). Example intent: “Plate” / “No photo for
  this meal” — not a privacy essay.

## Acceptance criteria

- [ ] Share with camera meals from the last 30 days: clinic modal shows the plate
- [ ] Text-only meal: modal unchanged, no camera mark
- [ ] Meal older than 30d (numbers in food log, no sidecar): no mark, items still show
- [ ] 24H chart stays readable; tap 579-style triangle opens that meal
- [ ] Worst-case ~15 MB thumbs + current snapshot uploads (no 413) after cap bump
- [ ] Cloud backup restore on a new phone still has remaining thumbs (with prompt116)
- [ ] Desktop (~1280) and clinic workspace on a laptop: modal image fits the card, close still works
- [ ] he/ar portal: photo on top, item names `dir=auto`
- [ ] No regression: Share with zero photos; existing meal modal macros

## Out of scope

- Phone UI (prompt116)
- Clinic AI attaching the JPEG
- Full-res originals, galleries, printing
- Changing the 30-day window

## Review (after Auto marks needs-review)

**Evidence to capture**

- Screenshot: 24H chart with camera mark on one triangle, none on a text meal
- Screenshot: meal modal with plate + items
- Log or note: gzipped blob size for a share that includes thumbs
- Confirm 413 is gone at ~16–20 MB gzipped

**Judgment calls to check**

- Does the mark read as “there is a plate”, not extra clutter on Walk / kcal?
- Does the modal still feel like the current meal card, not a new app?

## Agent checklist

- [ ] Status → in_progress
- [ ] Changes match this draft only
- [ ] Caps + portal smoke above
- [ ] Status → needs-review (do not move to `done/`)
- [ ] Update `prompts/backend/README.md` table
- [ ] Evidence attached for owner
