# Screen inventory

Stills copied from `UI-snapshots/` (July review, English UI, light theme). Good enough to
publish; live Hebrew screen video is the upgrade path (`../../SESSION.md`).

Files prefixed **`_reject-`** carry Android system junk (volume slider, "Refreshing SIM
data" toast) and must not be used on screen.

| File | Shows | Used by |
|------|-------|---------|
| `a1-dashboard.jpg` | Dashboard: Withings + CGM marks, weight/muscle/fat/BMR | 05, 06, 01, 03 |
| `a2-food-log-strip.jpg` | Food Log strip: kcal in/out, deficit, macros | 05, 06, 02, 04 |
| `a3-food-log.jpg` | Log Meal sheet (camera / gallery / describe) | 06, 04 |
| `a3b-food-log-flow.jpg` | Edit Meal with per-item macros | spare (has volume pill) |
| `a4-my-rules-targets.jpg` | Quick Start targets + Rules applied | 05, 06, 01, 02 |
| `a4b-rules-candidate.jpg` | Alternate rules frame | spare |
| `a5-gear-qs2.jpg` | Quick Start starting weight | spare |
| `a5-gear-qs3.jpg` | Allow Health Connect (steps, HR, glucose) | 03 gear |
| `a6-coach.jpg` | My mentors chat with a data-grounded reply | 05, 06, 02, 04 |
| `a6b-coach-open.jpg` | Chat, alternate frame | 04 |
| `a6c-mentors-alt.jpg` | Mentors with midday nudge | spare |
| `a8-quick-start-candidate.jpg` | Quick Start step | spare |
| `a9-activity-*.jpg` | Activity Log strip / AI calc / load | 07 |
| `a10-food-strip-*.jpg` | Food Log strip summary / expanded | 08 |
| `a10-meal-edit-*-en.jpg` | Edit Meal English items + totals | 08 |
| `a10-meal-grams-*.jpg` / `.mp4` | Edit item grams slider (stills + motion) | 08 |
| `a11-food-strip-open.jpg` | Food Log expanded (Meal entry) | 09 |
| `a11-log-meal-idle.jpg` | Log Meal: Camera / Gallery / describe / past | 09 |
| `a11-meal-photo-analyzing.jpg` | Plate photo + Analyzing… | 09 |
| `a11-meal-from-photo.jpg` | AI item list after gallery photo | spare |
| `a11-meal-from-text.jpg` | AI result from describe text | 09 |
| `a11-meal-chat-correct.jpg` | Correction chat field on result | 09 |
| `a11-past-meal-picker.jpg` | From past meal day browser | 09 |
| `a11-meal-from-past.jpg` | Reused past meal prefilled | spare |
| `clinic-labs-import.jpg` | Import lab PDF / nutritionist session PDF | 06, 01, 02 (portal stand-in) |
| `cover-cholesterol-trend.png` | Cholesterol trend chart (not 9:16) | FB post cover only |

B-roll under `broll/`: `yt-arms-15s.mp4`, `yt-upper-15s.mp4` — clip 07.

## Missing — worth capturing

| Shot | Why it matters |
|------|----------------|
| Clinic portal worklist + Rules tab | Reel 01–02 currently lean on lab-import |
| Visit report share | Proves the clinic actually receives the week |
| Profile → Gear / Your setup | Dedicated gear screen instead of dashboard + HC permission |
| Native 1080×2400 Activity Log stills | Clip 07 polish (unlock + adb) |
| Hebrew UI versions of all of the above | Matches the Hebrew subtitles |

## Frame geometry

`render_clip.py` crops 1080×2400 captures to 1080×2160 (drops the status and nav bars)
and fits them to the 680×1360 cutout in `illustrations/phone-frame.svg`. Keep new
captures at 1080×2400 so they drop in without changes.
