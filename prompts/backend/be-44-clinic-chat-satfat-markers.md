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
| `geminiClinic.ts` food format | Item + meal + **day** lines include **all** logged treatment-marker amounts (`SatF`, `Chol`, `SolFi`, …) |
| Day total | Same resolve as phone: sum item markers, else meal.markers |
| Clinic ESTIMATE HARD | **Any** clinic treatment-marker amount in the Food log = USER DATA; never estimate / re-ask |
| Targets | HARD daily targets from clinic overlay (+ phone snapshot fallback) in PATIENT DATA |

## Acceptance

- [ ] Clinic chat food block shows marker bits on days that have logged amounts (any clinic-set code)
- [ ] Mentor cites those day totals — no "הערכה מפירוט מזונות" when present
- [ ] Days without that marker omit it (honest gap; estimate only then if asked)

## Deploy

VPS: `git pull` → `npm ci` → `build` → `restart healthings-api` (no migrate).
