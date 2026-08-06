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

English voice (ElevenLabs Daniel), burned Hebrew subtitles, branded phone frame,
open/end cards, -14 LUFS, `.srt` / `.vtt` sidecars.

**Reel series** posts as 01 → 02 → 03 → 04 (Clinic → Rules → Gear → App+AI), then
optionally 05 closed-loop as the warm closer.

Clip **07** adds full-bleed YouTube B-roll (`shot.type: "broll"`) plus Activity Log
phone stills (paste link → AI calc → load 5→15 kg).

Both website-branded films (05/06) carry the **website's design system** — see
`brand-notes.md`. Art is rebuilt with `python production/build_art.py` after any SVG edit.

## Decisions locked

| Question | Answer |
|----------|--------|
| VO language | English — Hebrew ElevenLabs pass was rejected |
| Subtitles | Hebrew, burned (most FB views are muted) |
| Founder 13-day POC | Post text only, never in the film |
| Voice | Daniel `onwK4e9ZLuTAKqWW03F9` |
| Palette / type | `website/tokens.css` + Montserrat — never a video-only palette |
| Transitions | `xfade` dissolves centred on the VO word boundary |
| Export layout | One numbered directory per film (`001` …) |

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
