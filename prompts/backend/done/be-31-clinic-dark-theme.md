# be-31 — Clinic + account dark theme (app tokens)

**Status:** done — owner accepted 2026-07-27 (“ok dark mode is working”); Appearance picker **restored** 2026-07-27 on owner request  
**Model to implement:** Auto  
**Authored by:** Owner + Auto  
**Depends on:** be-25/be-22 (`theme-auto` plumbing), app prompt96 (`darkColors`)  
**Implemented:** 2026-07-27 — `2e6575e` + follow-ups  
**Deployed:** healthings.ai clinic + account

## Problem

Clinic and `/account/` darkened via OS `theme-auto`, but the palette was cool blue-grey
(`#0d1117` / `#4aa8e0`), not the app’s warm graphite `darkColors`.

## What shipped

| Piece | Detail |
|-------|--------|
| Pref | `localStorage.healthings_theme_pref` = `system` \| `light` \| `dark` |
| Classes | `theme-pref-system` / `theme-pref-light` / `theme-pref-dark` |
| Dark | App graphite + chart vars in `clinic-theme.css` |
| Picker | Appearance select on clinic login + worklist header, patient topbar, account gate/app |
| Charts | `chartPalette()` CSS vars; repaint on pref / OS change |
| Landing | Cool `.theme-auto` in `tokens.css` unchanged |

## Acceptance

- [x] Dark pref / OS-dark system → warm graphite
- [x] Light pref → forced light when OS is dark
- [x] Landing dark unchanged
- [x] Charts readable in dark
- [x] Appearance picker present and filled (System / Light / Dark)

## Out of scope / deferred

- Server-persisted theme; sync with phone app
- be-30 labs redesign

## Agent checklist

- [x] Implemented + deployed
- [x] Owner accepted dark mode
- [x] Picker restored on owner request → `done/` updated
