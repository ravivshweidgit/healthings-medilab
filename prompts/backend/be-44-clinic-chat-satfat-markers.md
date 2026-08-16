# be-44 — Clinic chat: include SatF / treatment markers in food log

**Status:** needs-review  
**Model:** Auto  
**Builds on:** be-39 (128d food), be-41 (treatment markers), prompt110  
**Shipped:** 2026-08-17

## Problem

Clinic nutrition mentor replied that daily saturated fat was not in the food log and used
**"הערכה מפירוט מזונות"** — forbidden when the phone already has a calculated day SatF meter
from item `markers.SAT_FAT_G`. Root cause: `formatFoodLogItemLine` / day headers sent only
P/C/F/Fi, and the ESTIMATE HARD prompt treated everything beyond macros as unstored.

## Fix

| Piece | Change |
|-------|--------|
| `geminiClinic.ts` food format | Item + meal + **day** lines include marker bits (`SatF14`, …) from meal/item `markers` |
| Day total | Same resolve as phone: sum item markers, else meal.markers |
| Clinic ESTIMATE HARD | Markers present in Food log = USER DATA; never estimate / re-ask SatF when shown |

## Acceptance

- [ ] Clinic chat food block shows `| SatF…` on days that have logged sat fat
- [ ] Mentor cites that day total — no "הערכה מפירוט מזונות" for SatF when present
- [ ] Days without markers still omit SatF (honest gap; estimate only then if asked)

## Deploy

VPS: `git pull` → `npm ci` → `build` → `restart healthings-api` (no migrate).
