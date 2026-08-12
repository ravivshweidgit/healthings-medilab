# be-42 — Clinic-gated past meal marker backfill

**Status:** needs-review (implemented 2026-08-12)  
**Model:** Auto  
**Depends on:** be-41 (markers_json), prompt110 (meal marker estimates)  
**Pairs with:** app `MarkersBackfillService` + Clinic overlay pull

## Problem

Past meals logged before markers existed have no estimates. Auto-backfill for every
patient would burn AI credits. Clinic must opt in and choose the day window.

## What ships

- `markers_json.backfill` on org overlay: `{ id, days, requestedAt, requestedBy, status, … }`
- `POST /v1/clinic/patients/:id/markers/backfill` `{ days: 1–90 }` (default 14) — mentor only; requires saved markers; 409 if already pending
- `POST /v1/clinic/overlays/markers-backfill/ack` — patient phone reports done/failed
- Overlay includes `markersBackfill` (patient sees **pending** only; mentor sees full status)
- Audit: `markers.backfill.request` / `markers.backfill.ack`
- Portal Treatment markers: days select + **Fill past meals on phone**
- Phone: on overlay pull, if pending → estimate missing markers (batch, max 80 meals) → ack

## Caps

| Cap | Value |
|-----|-------|
| Days | 1–90 (clinic picks) |
| Unit of work | **One Gemini call per calendar day** (all meals that day still missing markers) |
| Meal-count cap | **None** — full window |
| Pace | ~3.5s between days (+ 429 retries) |
| Default off | No request → no past work |

## Evidence

- `server/` `tsc --noEmit` clean
- No new DB column — nested in existing `markers_json`

## Deploy

VPS pull/build/restart + website clinic static deploy. Then portal → Fill past → open phone.
