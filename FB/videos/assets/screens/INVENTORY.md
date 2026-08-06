# Screen inventory

Stills copied from `UI-snapshots/` (July review, English UI, light theme). Good enough to
publish; live Hebrew screen video is the upgrade path (`../../SESSION.md`).

Files prefixed **`_reject-`** carry Android system junk (volume slider, "Refreshing SIM
data" toast) and must not be used on screen.

| File | Shows | Used by |
|------|-------|---------|
| `a1-dashboard.jpg` | Dashboard: Withings + CGM marks, weight/muscle/fat/BMR | 06 gear beat, 05 |
| `a2-food-log-strip.jpg` | Food Log strip: kcal in/out, deficit, macros | 06 real-week beat, 05 |
| `a3-food-log.jpg` | Log Meal sheet (camera / gallery / describe) | 06 opening |
| `a3b-food-log-flow.jpg` | Edit Meal with per-item macros | spare (has volume pill) |
| `a4-my-rules-targets.jpg` | Quick Start targets + Rules applied | 06 rules beat, 05 |
| `a4b-rules-candidate.jpg` | Alternate rules frame | spare |
| `a5-gear-qs2.jpg` | Quick Start starting weight | spare |
| `a5-gear-qs3.jpg` | Allow Health Connect (steps, HR, glucose) | spare |
| `a6-coach.jpg` | My mentors chat with a data-grounded reply | 06 meal-check beat, 05 |
| `a6b-coach-open.jpg` | Chat, alternate frame | spare |
| `a6c-mentors-alt.jpg` | Mentors with midday nudge | spare |
| `a8-quick-start-candidate.jpg` | Quick Start step | spare |
| `clinic-labs-import.jpg` | Import lab PDF / nutritionist session PDF | 06 clinic beat |
| `cover-cholesterol-trend.png` | Cholesterol trend chart (not 9:16) | FB post cover only |

## Missing — worth capturing

| Shot | Why it matters |
|------|----------------|
| Clinic portal worklist + Rules tab | The clinic beats currently lean on a lab-import screen |
| Visit report share | Proves the clinic actually receives the week |
| Profile → Gear / Your setup | A dedicated gear screen instead of borrowing the dashboard |
| Hebrew UI versions of all of the above | Matches the Hebrew subtitles |

## Frame geometry

`render_clip.py` crops 1080×2400 captures to 1080×2160 (drops the status and nav bars)
and fits them to the 680×1360 cutout in `illustrations/phone-frame.svg`. Keep new
captures at 1080×2400 so they drop in without changes.
