# be-31 — Clinic + account dark theme (app tokens + Appearance)

**Status:** needs-review  
**Model to implement:** Auto  
**Authored by:** Owner + Auto (from Cursor plan)  
**Depends on:** be-25/be-22 (`theme-auto` plumbing), be-26 (locale picker pattern), app prompt96 (`darkColors`)  
**Related:** be-29 (workspace i18n — picker labels)

## Problem

Clinic and `/account/` already darken via OS `theme-auto`, but the palette is cool
blue-grey (`#0d1117` / `#4aa8e0`), not the app’s warm graphite `darkColors`. Clinicians
on shared PCs also cannot force light/dark independently of the OS.

## Goal

Clinic worklist, patient workspace, and account self-view use the **same dark chrome as
the phone app**, with an Appearance picker (`system` | `light` | `dark`) in
`localStorage`. Landing / help keep the existing cool `theme-auto` dark.

## Scope

### Theme classes (clinic + account only)

| Pref | `<html>` class |
|------|----------------|
| light | `theme-pref-light` |
| dark | `theme-pref-dark` |
| system | `theme-pref-system` |

App dark vars under `.theme-pref-dark` and `@media (prefers-color-scheme: dark) { .theme-pref-system }`.  
Do **not** remap landing’s `.theme-auto` block in `tokens.css`.

### Appearance picker

- Storage key: `healthings_theme_pref`
- UI next to language on clinic login + worklist header; compact on patient topbar; on account gate/header
- FOUC: apply class before paint (inline boot or sync head script)

### Token source

Hex from `app/src/theme/tokens.ts` `darkColors` / `chart.*` — static CSS remap, not a JS import.

## Files to touch

- `website/clinic/clinic-theme.css` (new) — app dark var remaps
- `website/clinic/clinic-theme.js` (new) — pref get/set/apply + pickers
- `website/clinic/clinic-portal.css` — retarget dark portal tints to pref classes
- `website/clinic/clinic-workspace.css` — retarget `--ws-chart-*` dark to pref classes + app chart hex
- `website/clinic/clinic-charts.js` — SVG colors from CSS vars
- `website/clinic/clinic-i18n.js` — `appearanceLabel`, `themeSystem`, `themeLight`, `themeDark` × 10
- `website/clinic/index.html`, `patient.html`, `website/account/index.html` — boot + pickers
- Bump `?v=`

**Do not touch:** landing `tokens.css` dark `.theme-auto` palette; help/privacy; server.

## Acceptance criteria

- [ ] Appearance = Dark → warm graphite (app-like), not cool `#0d1117`
- [ ] Appearance = Light → forced light when OS is dark
- [ ] Appearance = System → follows OS; app palette when dark
- [ ] Pref persists worklist ↔ patient ↔ account
- [ ] Landing dark unchanged
- [ ] Charts readable in dark (grids/zones not light-only)
- [ ] Picker labels localized on clinic (10 locales)

## Out of scope

- be-30 labs redesign
- Server-persisted theme
- Syncing theme with the phone app
- Help / privacy / landing palette

## Review (after Auto marks needs-review)

**Evidence**

- Clinic Dark / Light / System screenshots (worklist + Dashboard charts)
- Account self-view Dark
- Landing still cool dark with OS dark + no clinic pref

**Judgment**

- Does graphite match the phone closely enough?
- Is the picker discoverable without crowding the header?

## Implementation notes (shipped)

| Piece | Path |
|-------|------|
| App dark remap | `clinic-theme.css` (`.theme-pref-dark` + system+OS dark) |
| Pref API | `clinic-theme.js` + FOUC `clinic-theme-boot.js` |
| Pickers | clinic login/header, patient topbar, account gate/app |
| Charts | `clinic-charts.js` → `chartPalette()` / CSS vars |
| Storage | `localStorage.healthings_theme_pref` |

## Agent checklist

- [x] Status → `in_progress`
- [x] Theme CSS/JS + pickers + chart vars
- [x] Status → `needs-review` + deploy; update README
- [ ] Do **not** move to `done/` without owner acceptance
