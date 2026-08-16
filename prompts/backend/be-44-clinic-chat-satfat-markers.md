# be-44 — Clinic chat: include all clinic treatment markers in food log

**Status:** needs-review  
**Model:** Auto  
**Builds on:** be-39 (128d food), be-41 (treatment markers), prompt110  
**Shipped:** 2026-08-17

## Problem

Clinic nutrition mentor treated clinic-set treatment markers (SatF and any other
custom daily marker the clinic configured) as missing and answered with
**"הערכה מפירוט מזונות"** — forbidden when the phone already has calculated day
totals from item `markers.*`. Root cause: food-log lines sent only P/C/F/Fi, and
the ESTIMATE HARD prompt treated everything beyond macros as unstored.

## Fix

| Piece | Change |
|-------|--------|
| `geminiClinic.ts` food format | Item + meal + **day** lines include **all** logged treatment-marker amounts |
| Day total | Same resolve as phone: sum item markers, else meal.markers |
| Clinic HARD | Default cite logged day totals; **estimate OK when staff ask**; **rely on daily macros/markers OK when staff ask** — do not volunteer food-detail estimates instead of present totals |
| Targets | HARD daily targets from clinic overlay (+ phone snapshot fallback) in PATIENT DATA |

## Acceptance

- [ ] Clinic chat food block shows marker bits on days that have logged amounts
- [ ] Default answer cites logged day totals (no unsolicited "הערכה מפירוט")
- [ ] Explicit "estimate from foods" → estimate labeled as such
- [ ] Explicit "use the daily logged SatF/markers" → uses USER DATA totals

## Deploy

VPS: `git pull` → `npm ci` → `build` → `restart healthings-api` (no migrate).
