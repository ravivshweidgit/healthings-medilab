# Dark theme reference

Visual north star for the Healthings dark theme (see `prompt96` — dark mode).
Reference app: **Withings** (approved 2026-07-24). Drop additional dark-theme
references (ours or competitors') in this folder.

## Why this reference

- **Near-black background + dark-grey elevated cards** — premium depth, not flat
  pure-grey. Cards read as "raised" against an almost-black canvas.
- **High-contrast text** — white primary, muted grey secondary (still legible).
- **Cool periwinkle-blue data-viz** on dark — charts stay vivid without glare.
- **Semantic accents survive**: green "connected" dots, gold badges — proof that
  success/alert/brand hues still work on dark (our rule: green = success only).

## Files

| File | Screen | What to copy |
|------|--------|--------------|
| `withings-dark-home.png` | Home / metrics feed | card elevation, chart line color, muted section labels |
| `withings-dark-activity.png` | Activity / steps chart | bar chart on dark, axis + gridline treatment, progress ring |
| `withings-dark-workout-hr.png` | Workout / heart-rate chart | multi-tone line chart, HR-zone bars, table rows on dark |
| `withings-dark-device-settings.png` | Device settings | pill tabs, connected state (green), pure-black hero area |

## Palette we'll derive from it (draft — finalize in prompt96 Phase 3)

| Token | Dark value | Notes |
|-------|-----------|-------|
| `background` | `#0E0F11` | near-black canvas (not pure #000) |
| `surface` (card) | `#1C1F24` | elevated card |
| `surfaceRaised` | `#262A30` | nested/raised tiles, pill tabs |
| `textPrimary` | `#F2F3F5` | ~white |
| `textSecondary` | `#9BA1AA` | muted, still AA on card |
| `gridLine` | `#2A2E35` | borders + chart grid |
| `accentBlue` | `#8E9BFF` | periwinkle data-viz / primary accent |
| `accentGreen` | `#5FD068` | success only (connected/OK) |
| `accentRed` | `#FF6B6B` | alerts |
| `primaryTier` (navy→steel) | `#3E6EA5` | primary-tier left accent, lifted for dark |
| gold/amber badge | `#C9A227` | optional highlight (matches Withings) |

## Hard rules (carry into implementation)

- **Exports stay light** — clinic/printable HTML+SVG never inherit dark.
- Semantic map preserved: green = success, red = alert, steel/navy = primary tier.
- Contrast must meet WCAG AA for text on `surface`.
- Tokens live in the theme layer (`useTheme()`), not scattered hexes.
