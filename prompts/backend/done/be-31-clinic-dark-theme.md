# be-31 — Clinic + account dark theme (app tokens)

**Status:** done — owner accepted 2026-07-27 (“ok dark mode is working”)  
**Model to implement:** Auto  
**Authored by:** Owner + Auto  
**Depends on:** be-25/be-22 (`theme-auto` plumbing), app prompt96 (`darkColors`)  
**Implemented:** 2026-07-27 — `2e6575e` + follow-up (no Appearance picker)  
**Deployed:** healthings.ai clinic + account

## Problem

Clinic and `/account/` darkened via OS `theme-auto`, but the palette was cool blue-grey
(`#0d1117` / `#4aa8e0`), not the app’s warm graphite `darkColors`.

## What shipped

| Piece | Detail |
|-------|--------|
| Class | `theme-clinic` on clinic + account `<html>` (not landing `.theme-auto`) |
| Dark | OS `prefers-color-scheme: dark` → app graphite + chart vars in `clinic-theme.css` |
| Charts | `clinic-charts.js` `chartPalette()` reads CSS vars; repaint on OS scheme change |
| Control | **OS only** — no Appearance picker (owner: no picker; dark mode working) |
| Landing | Cool `.theme-auto` in `tokens.css` unchanged |

## Acceptance

- [x] Clinic/account dark = warm graphite (app-like), not cool `#0d1117`
- [x] Light OS → light clinic chrome
- [x] Landing dark unchanged
- [x] Charts readable in dark
- [x] No Appearance picker UI

## Out of scope / deferred

- Forced light/dark override picker (explicitly declined)
- Server-persisted theme; sync with phone app
- be-30 labs redesign

## Agent checklist

- [x] Implemented + deployed
- [x] Picker leftovers removed
- [x] Owner accepted → `done/`
