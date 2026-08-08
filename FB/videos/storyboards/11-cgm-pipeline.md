# 11 — CGM pipeline (live glucose)

**Length:** 40–55s · **Job:** CGM Yes is not “install CareSens and done” — teach the **writer → store → Healthings reader** path, especially Android live vs end-of-day.

**Id (prompt107):** `cgm-pipeline`  
**Quick Start surface:** CGM Yes → phone-health / Gear CGM; Help `cgm`; CareSens status chip.

## Teaching points (must land)

1. Healthings **reads** glucose from Health Connect (Android) or Apple Health (iPhone) — same pattern as activity.
2. **Android CareSens for live charts:** CareSens Air → **xDrip+** → Health Connect → Healthings. xDrip is what writes continuous values into the store.
3. **Without xDrip on Android:** relying on Samsung Health (or similar) often means **end-of-day** write — not live meal-impact / in-day CGM. Say this plainly so users don’t think Healthings is “broken.”
4. **CSV Import** remains a backup (historical / catch-up) — does not replace the live pipeline.
5. **iOS:** CareSens (or Libre, etc.) must **share Blood Glucose** into Apple Health; Healthings Allow Blood Glucose read.
6. Permissions again: CGM/bridge apps **write**; Healthings **reads**.

## Beats (draft)

| t | Visual | VO intent (EN) |
|---|--------|----------------|
| 0–6s | CGM Yes in Quick Start | Tracking glucose? Healthings charts what your phone health store holds. |
| 6–20s | Android path diagram | CareSens → xDrip+ → Health Connect → Healthings. That chain is live. |
| 20–32s | Contrast card | Skip xDrip and wait on Samsung Health? Often once a day — not live. |
| 32–42s | iOS path | Share Blood Glucose to Apple Health → Allow in Healthings. |
| 42–50s | Status chip OK + chart | After Allow + Sync, the CareSens / CGM row turns OK and the chart fills. |
| 50–55s | Import as backup | CSV Import helps history — live still needs the write path. |

## Platform notes

- Lead with **Android + xDrip** (ICP CareSens pain). iOS second half or split cut.
- Never imply Healthings talks BLE directly to CareSens (out of scope / false).
- Glossary: CGM, CareSens, xDrip+, Health Connect, Apple Health.

## Assets needed

- xDrip+ → HC settings stills (scrub)
- CareSens status chip states (OK / allow / no data)
- Simple 3-box pipeline graphic
- Optional: “end of day” clock vs “live” pulse metaphor

## VO

`scripts/en/11-cgm-pipeline.txt` · `scripts/he/11-cgm-pipeline.txt` — not written yet.
