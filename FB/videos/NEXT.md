# NEXT

## Where we are

Three finished films render end-to-end from a spec. Exports are numbered:

| # | Folder | File |
|---|--------|------|
| 001 | `assets/exports/001-closed-loop/` | `05-closed-loop-en-subhe-9x16.mp4` (~27s) |
| 002 | `assets/exports/002-what-is-healthings/` | `06-what-is-healthings-en-subhe-9x16.mp4` (~49s) |
| 003 | `assets/exports/003-activity-youtube/` | `07-activity-youtube-en-subhe-9x16.mp4` (~32s) |

English voice (ElevenLabs Daniel), burned Hebrew subtitles, branded phone frame,
open/end cards, -14 LUFS, `.srt` / `.vtt` sidecars.

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

Change `clips/07-activity-youtube.json`, then:

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 07-activity-youtube --force
python FB/videos/production/render_clip.py  --clip 07-activity-youtube
```

## On the website

Clip 06 is embedded in the **How it works** section of `website/index.html` as a 16:9
cut with no burned subtitles: `website/videos/how-it-works.mp4`.

## Backlog

- Unlock phone and recapture native 1080×2400 Activity Log strip stills (current 07 UI shots are padded from modal screenshots)
- Specs for clips 00–04 (storyboards already written)
- Square 1:1 variant for feed
- Music bed (licensed) — `--music` already ducks under VO
- Clinic-portal footage for older loop explainers
