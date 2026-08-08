# 10 — Phone health (Watch No path)

**Length:** 35–50s · **Job:** When the user has **no Withings watch**, teach the permission model — other apps **write**, Healthings **reads**.

**Id (prompt107):** `phone-health`  
**Quick Start surface:** After Watch = No → phone-health step; Help `phone-health-activity`; Your setup Gear when watch off.

## Teaching points (must land)

1. **Brand does not matter** — Garmin, Samsung, Apple Watch, etc. write steps / heart rate into the phone health store.
2. **Android = Health Connect · iPhone = Apple Health** — that store is the hub.
3. **Healthings only reads** — user must Allow / grant read for steps (and HR when used). Healthings does **not** replace the wearable app.
4. **Do not** push Withings into Health Connect / Apple Health as the activity path when Watch is No (or when Watch is Yes and Withings cloud is the source) — avoid double sources / confusion.
5. **Write vs read** — the wearable app needs permission to **write**; Healthings needs permission to **read**. Two different dialogs, same store.

## Beats (draft)

| t | Visual | VO intent (EN) |
|---|--------|----------------|
| 0–6s | Watch No in Quick Start / Gear | No Withings watch? Phone health still works. |
| 6–18s | Wearable app → HC / Apple Health arrow | Your watch app writes steps and heart rate into Health Connect or Apple Health. |
| 18–32s | Healthings Allow / permission sheet | Healthings asks to **read** that store — not to replace your watch app. |
| 32–45s | Dashboard activity chip from phone | After Allow, pull-to-refresh — activity shows from the phone store. |
| 45–50s | Calm “No Withings needed” | Scale can still be Withings or manual — this clip is only about activity. |

## Platform notes

- Film should show **both** Android (Health Connect) and iOS (Apple Health) for ~half the runtime each, or two short cuts sharing VO with platform-specific B-roll.
- Glossary on screen: Health Connect, Apple Health, Withings (English).

## Assets needed

- Quick Start Watch No + phone-health step stills (Android + iOS)
- Permission dialogs (scrub PII)
- Activity strip chip labeled Health Connect / Apple Health
- Optional: simple diagram “Wearable → Store → Healthings”

## VO

`scripts/en/10-phone-health.txt` · `scripts/he/10-phone-health.txt` — not written yet.
