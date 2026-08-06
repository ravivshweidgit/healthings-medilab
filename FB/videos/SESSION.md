# Phase B — capture session (do this on the phone)

**Goal:** Fill the gaps that stills cannot cover, then edit clip **05** (or **00**) in CapCut.

**Defaults:** **English only** VO (ElevenLabs Daniel) + optional burned EN captions · founder POC in **post text only**.  
Hebrew UI capture optional later; EN UI is fine for these explainers.  
VO setup: `elevenlabs/README.md` (same stack as `home-hero-video`).

Time box: **25–40 minutes**.

---

## Before you start (2 min)

- [ ] Own / demo account only
- [ ] Hebrew UI (`App & coach language` → עברית)
- [ ] Light theme
- [ ] Notifications off
- [ ] Phone vertical screen record ON (or adb/scrcpy — see `production/tools.md`)

Save clips into:
`FB/videos/assets/screens/`  
(or dump long take into `assets/raw/` and cut later)

---

## Pass 1 — Phone (15–20 min)

Record short takes (5–12s each). Pause 1.5s on key labels.

| # | Do this | File name | Status vs stills |
|---|---------|-----------|------------------|
| 1 | Dashboard collapsed — show scale/watch/CGM row | `a1-dashboard-he.mp4` | EN still exists; **need HE** |
| 2 | Open Trend & energy | `a2-trend-energy-he.mp4` | candidate still; prefer HE video |
| 3 | Food Log today → Log Meal sheet | `a3-food-log-he.mp4` | EN still exists |
| 4 | Profile → My Rules (full text readable) | `a4-my-rules-he.mp4` | QS targets still only — **need real My Rules** |
| 5 | Profile → Gear / Your setup (scale·watch·CGM) | `a5-gear-he.mp4` | Withings QS still OK as B-roll |
| 6 | AI chat — one short ask (e.g. yesterday summary) | `a6-coach-he.mp4` | EN/HE mix still exists |
| 7 | Reports → share visit report sheet | `a7-report-he.mp4` | **missing — capture** |

Optional B-roll: Quick Start Withings link (already have still `a5-gear-qs1.jpg`).

---

## Pass 2 — Clinic portal (8–12 min)

Demo patient only. Desktop record, crop later to 9:16.

| # | Do this | File name |
|---|---------|-----------|
| 8 | Worklist | `p1-worklist.mp4` |
| 9 | Patient → Rules tab (show edit/save) | `p2-rules.mp4` |
| 10 | Progress / meals or metrics | `p3-progress.mp4` |

If portal access is awkward today → skip and cut clip 05 from phone + loop diagram only; add portal in v2.

---

## Pass 3 — Drop & tick (2 min)

- [ ] Files landed under `assets/screens/`
- [ ] Open `production/edit-clip05-capcut.md`
- [ ] Update `assets/screens/INVENTORY.md` checkboxes

---

## Done when

You can open CapCut and build **clip05** without hunting for missing A4/A7 (and ideally P1–P3).
