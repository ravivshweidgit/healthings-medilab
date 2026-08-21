# be-53 — Clinic meal-photo lightbox + snapshot size for 30-day thumbs

**Status:** ready  
**Model to implement:** Auto (caps + portal modal). Chart mark placement is taste — owner in the portal.  
**Authored by:** owner request 2026-08-22  
**Depends on:** prompt116 (phone writes thumbs + injects `healthings:mealPhotos` on Share)

## Problem

The clinic metabolic chart already shows orange kcal triangles (same 24H strip as the phone).
Tapping a meal chip opens item macros. There is no plate. After prompt116, Share can include
~15 MB of JPEG thumbs (5 camera meals/day × 30 days × ~100 KB). Today clinic upload is
**15 MB gzipped** (`server/src/services/sync.ts`) — JPEGs do not gzip, so the existing cap
would reject a full window. Cloud backup is **25 MB** and has the same problem.

## Goal

Clinician taps the triangle or the meal chip → the existing meal card shows the plate on top
when a thumb exists. Camera mark only when a photo is in the snapshot. Payload limits allow
a worst-case 30-day thumb set plus the current health blob.

## Files to touch

- `server/src/services/sync.ts` — gzip upload cap (today 15 MB)
- `server/src/services/cloudBackup.ts` — cloud cap (today 25 MB)
- `website/clinic/clinic-workspace.js` — `showMealModal` plate; meal-chip camera hint
- `website/clinic/clinic-charts.js` — clickable meal triangle when photo exists; camera mark
- `website/clinic/clinic-workspace.css` — modal image, chip hint (existing portal tokens)
- `website/clinic/clinic-workspace-i18n.js` — short strings (Photo / Open plate) in 10 locales
- Parser that builds `ctx.parsed.meals` — attach `photoId` / lookup into `healthings:mealPhotos`
- Do **not** touch: Gemini clinic prompts (no auto-attach of JPEGs), public `/the-clinic/` page

## Design rules

- **Lazy:** do not decode every thumb on workspace load. Lookup by meal `photoId` when the
  modal opens (or when the chart hit-target is built).
- **One plate per meal.** Missing map entry = no camera mark (older than 30d or text meal).
- Meal names, rules, chat stay patient-authored (`dir=auto`). Emails/IDs stay `dir=ltr`.
- Always-English glossary: kcal stays kcal. Do not machine-translate the plate.
- Do not tile photos under the calorie strip. Mark + tap only (same as prompt116).
- Inflated snapshot already allows 64 MB; **gzipped** upload is the constraint. Raise gzip
  clinic upload to **32 MB** (headroom over ~15 MB JPEG + existing blob). Raise cloud backup
  to **40 MB** so restore can carry the same sidecar. If a later owner wants object storage
  instead of inline base64, that is a new batch — not this one.

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
