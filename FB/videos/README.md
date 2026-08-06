# Healthings short video explainers

Short clips that show how **clinic → rules → gear → AI → clinic** form one closed metabolic cycle.
Rendered from a spec + ElevenLabs voiceover by script — no timeline editor required.

## Current films

| Clip | Length | For | File |
|------|--------|-----|------|
| **06 What is Healthings** | ~49s | New users / cold audience | `assets/exports/06-what-is-healthings-en-subhe-9x16.mp4` |
| **05 Closed loop** | ~27s | Warm audience, already saw the product | `assets/exports/05-closed-loop-en-subhe-9x16.mp4` |
| **06 — website cut** | ~49s | healthings.ai "How it works" | `website/videos/how-it-works.mp4` |

Social cuts are 1080×1920, **English voice** (ElevenLabs Daniel) with **burned Hebrew
subtitles**, normalised to -14 LUFS. The website cut is 1920×1080 with **no burned
subtitles** — the page attaches `.vtt` tracks so the browser can caption in the
visitor's own language. Every render writes `.srt` and `.vtt` sidecars for both
languages regardless.

## Render a clip

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 06-what-is-healthings
python FB/videos/production/render_clip.py  --clip 06-what-is-healthings
```

Website cut — landscape, unburned, and compressed harder because it is served from
the repo rather than re-encoded by a platform:

```powershell
python FB/videos/production/render_clip.py --clip 06-what-is-healthings `
  --aspect 16x9 --no-subs --crf 24
```

Add a music bed when you have a licensed track:

```powershell
python FB/videos/production/render_clip.py --clip 06-what-is-healthings --music "C:\path\bed.mp3"
```

Regenerate the voice after editing a spec: add `--force` to `gen_clip_vo.py`.

## How it works

1. `clips/<id>.json` holds the segments — each one an **English VO line**, a **Hebrew subtitle**, and a **shot**.
2. `gen_clip_vo.py` speaks the whole script in one take and stores ElevenLabs
   character-level timings, so every shot change and subtitle lands on real speech.
3. `render_clip.py` composites screenshots inside the branded phone frame, adds the
   open/end cards, burns the subtitles, mixes and normalises the audio.

Change a line or swap a screenshot in the spec, re-run both commands, and the whole
film re-cuts itself.

## Folder layout

```
FB/videos/
  README.md          PLAN.md   SESSION.md   NEXT.md   brand-notes.md
  clips/             ← spec per film (the thing you edit)
  elevenlabs/        ← voice settings, auditions, VO + timings
  production/        ← render_clip.py, checklist, tools
  storyboards/       ← narrative intent per clip
  scripts/ captions/ ← older per-language text (specs supersede for rendered clips)
  shot-lists/        ← what to record on phone + portal
  assets/
    screens/stills/  ← app screenshots (`_reject-` prefix = do not use)
    illustrations/   ← loop diagrams, phone frame, cards (SVG + PNG, per aspect)
    fonts/           ← Montserrat (OFL) — the site's display face
    audio/           ← VO, auditions, alignment JSON
    exports/         ← finished films (gitignored)
```

Published web copies live in `website/videos/` and **are** tracked, so the site
deploys with them.

## Still to improve

- **Music bed** — no licensed track yet; `--music` is wired and ducks under the voice
- **Live screen video** instead of stills (`SESSION.md`)
- **Clinic portal footage** for the clinic beats
- Clips 00–04 can be given specs the same way

## Related

- Alpha recruit copy: `FB/post-alpha-recruit-he.txt`
- Product framing: `investor-pov/EXECUTIVE-SUMMARY.md`
- UI capture reference: `UI-snapshots/`
