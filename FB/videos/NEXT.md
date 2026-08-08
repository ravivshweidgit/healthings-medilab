# NEXT

## Where we are

Seven finished films render end-to-end from a spec. Exports are numbered:

| # | Folder | File |
|---|--------|------|
| 001 | `assets/exports/001-closed-loop/` | `05-closed-loop-en-subhe-9x16.mp4` (~27s) |
| 002 | `assets/exports/002-what-is-healthings/` | `06-what-is-healthings-en-subhe-9x16.mp4` (~49s) |
| 003 | `assets/exports/003-activity-youtube/` | `07-activity-youtube-en-subhe-9x16.mp4` (~32s) |
| 004 | `assets/exports/004-clinic/` | `01-clinic-en-subhe-9x16.mp4` (~24s) |
| 005 | `assets/exports/005-rules/` | `02-rules-en-subhe-9x16.mp4` (~23s) |
| 006 | `assets/exports/006-gear/` | `03-gear-en-subhe-9x16.mp4` (~25s) |
| 007 | `assets/exports/007-ai-coach/` | `04-ai-coach-en-subhe-9x16.mp4` (~27s) |
| 008 | `assets/exports/008-meal-logging/` | `08-meal-logging-en-subhe-9x16.mp4` |
| 009 | `assets/exports/009-meal-entry/` | `09-meal-entry-en-subhe-9x16.mp4` |
| 010 | `assets/exports/010-phone-health/` | `10-phone-health-en-subhe-9x16.mp4` (~31s) |
| 011 | `assets/exports/011-cgm-pipeline/` | `11-cgm-pipeline-en-subhe-9x16.mp4` (~41s) |
| 012 | `assets/exports/012-scale-trends/` | `12-scale-trends-en-subhe-9x16.mp4` (~31s) |
| 013 | `assets/exports/013-scale-choice/` | `13-scale-choice-en-subhe-9x16.mp4` (~27s) |

**German catalog (Tier 1 full):** Matilda spoken **DE** + **burned DE subs** (`*-de-subde-9x16.mp4`) for films 01–12 — same-language captions for hearing accessibility. EN masters keep HE burns.

**French (permission only):** `*-fr-subfr-9x16.mp4` for clips 10 + 11. Other app locales — no spoken VO until a named market pull.

| # | DE export |
|---|-----------|
| 001–009 | `0NN-…/<id>-de-subde-9x16.mp4` |
| 010 | `10-phone-health-de-subde-9x16.mp4` (+ `…-fr-subfr-…`) |
| 011 | `11-cgm-pipeline-de-subde-9x16.mp4` (+ `…-fr-subfr-…`) |
| 012 | `12-scale-trends-de-subde-9x16.mp4` |
| 013 | `13-scale-choice-de-subde-9x16.mp4` |

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 10-phone-health --lang de --force
# Native VO burns same-language subs by default (do not pass --no-subs)
python FB/videos/production/render_clip.py --clip 10-phone-health --vo-lang de `
  --music FB/videos/assets/audio/music/gym-max-oazo-bed-novocals.mp3 --music-level 0.18
```

English voice (ElevenLabs **Matilda**, except **06** Daniel / “David BBC”), burned Hebrew subtitles, branded phone frame,
Max Oazo **instrumental** bed ducked under VO, **steady** picture (no Ken Burns),
open/end cards, -14 LUFS, `.srt` / `.vtt` sidecars.

**Reel series** posts as 01 → 02 → 03 → 04 (Clinic → Rules → Gear → App+AI), then
optionally 05 closed-loop as the warm closer.

Clip **07** adds full-bleed YouTube B-roll (`shot.type: "broll"`) plus Activity Log
phone stills (paste link → AI calc → load 5→15 kg).

Clip **08** is Food Log meal items + grams slider (phone stills + in-frame screencap
mp4 for live macro updates).

Clip **09** teaches meal *entry*: Camera/Gallery, AI describe, chat correct, From past
meal — post before 08 (entry → precision).

Both website-branded films (05/06) carry the **website's design system** — see
`brand-notes.md`. Art is rebuilt with `python production/build_art.py` after any SVG edit.

## Decisions locked

| Question | Answer |
|----------|--------|
| VO language | English master; DE catalog spoken; FR spoken on permission films only |
| Subtitles | EN masters → HE burned (muted social). Native VO → **same language burned** (DE/FR) for hearing access |
| Hebrew spoken VO | Rejected — HE burned on EN only |
| Founder 13-day POC | Post text only, never in the film |
| Voice | **Matilda** default; **exception:** `06-what-is-healthings` EN = **Daniel** (“David BBC”) `onwK4e9ZLuTAKqWW03F9`. Remastered to Matilda: gear, meal-entry, meal-grams (2026-08-08). Still Daniel until remaster: clinic/rules/coach/closed-loop/activity-youtube |
| Music bed | `assets/audio/music/gym-max-oazo-bed-novocals.mp3` @ `--music-level 0.18` |
| Picture | Steady film — `--motion 1.0` (no Ken Burns on UI) |
| Palette / type | `website/tokens.css` + Montserrat — never a video-only palette |
| Transitions | `xfade` dissolves centred on the VO word boundary |
| Export layout | One numbered directory per film (`001` …) |
| Agent rule | `.cursor/rules/explainer-video-pipeline.mdc` |

## Editing a film

Change `clips/01-clinic.json` (or any id), then:

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 01-clinic --force
python FB/videos/production/render_clip.py  --clip 01-clinic
```

## On the website

Clip 06 is embedded in the **How it works** section of `website/index.html` as a 16:9
cut with no burned subtitles: `website/videos/how-it-works.mp4`.

## Backlog

- Unlock phone and recapture native 1080×2400 Activity Log strip stills (current 07 UI shots are padded from modal screenshots)
- Clip **00** master closed-cycle spec (~75–90s) — storyboard already written
- Clinic-portal worklist + Rules tab (upgrade 01/02 beyond lab-import)
- Square 1:1 variant for feed
- Music bed (licensed) — `--music` already ducks under VO
- **In-app Watch** — Quick Start: welcome `what-is-healthings` (Daniel exception only); scale `scale-choice`; **watch Yes/No → `phone-health`** (Matilda — never gear/Daniel); CGM/phone-health/meals. `scale-trends` = Help payoff only.
- **`scale-choice` (013)** — QS scale Yes/No routing (“No is fine” / cloud not Bluetooth).
- **`scale-trends` (012)** — composition → Trend & Energy → BMR; Help catalog; live still `a2-trend-energy.jpg`.
- **Locale catalog + host (2026-08-08)** — full DE (`*-de-subde`) for 01–12; FR (`*-fr-subfr`) for permission 10–11.
  - Publish: `python FB/videos/production/publish_explainers.py` → `website/videos/{en,de,fr}/` + `/{loc}/watch/{id}.html`
  - App: `explainerWatchUrl` + Help strip Watch list + Quick Start Watch on scale/watch/CGM/phone-health/meals
  - Deploy: publish on the deploy machine, then `bash server/scripts/deploy-website.sh` (mp4s gitignored)
