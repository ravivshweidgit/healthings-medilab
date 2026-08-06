# Healthings short video explainers

Short clips that show how **clinic → rules → gear → AI → clinic** form one closed metabolic cycle,
plus how-to films (Activity Log / YouTube workouts).
Rendered from a spec + ElevenLabs voiceover by script — no timeline editor required.

## Current films

| # | Clip | Length | For | Export folder |
|---|------|--------|-----|---------------|
| 001 | **05 Closed loop** | ~27s | Warm audience | `assets/exports/001-closed-loop/` |
| 002 | **06 What is Healthings** | ~49s | New users / cold | `assets/exports/002-what-is-healthings/` |
| 003 | **07 Activity YouTube** | ~32s | YouTube / TV workouts | `assets/exports/003-activity-youtube/` |
| — | **06 — website cut** | ~49s | healthings.ai How it works | `website/videos/how-it-works.mp4` |

Social cuts are 1080×1920, **English voice** (ElevenLabs Daniel) with **burned Hebrew
subtitles**, normalised to -14 LUFS. The website cut is 1920×1080 with **no burned
subtitles**. Every render writes `.srt` and `.vtt` sidecars for both languages.

## Render a clip

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 07-activity-youtube
python FB/videos/production/render_clip.py  --clip 07-activity-youtube
```

Website cut (clip 06):

```powershell
python FB/videos/production/render_clip.py --clip 06-what-is-healthings `
  --aspect 16x9 --no-subs --crf 24
```

Add a music bed when you have a licensed track:

```powershell
python FB/videos/production/render_clip.py --clip 07-activity-youtube --music "C:\path\bed.mp3"
```

Regenerate the voice after editing a spec: add `--force` to `gen_clip_vo.py`.

## How it works

1. `clips/<id>.json` holds the segments — each one an **English VO line**, a **Hebrew subtitle**, and a **shot**. Optional `"export_dir": "003-…"` sends the mp4 into a numbered folder.
2. `gen_clip_vo.py` speaks the whole script in one take and stores ElevenLabs character-level timings.
3. `render_clip.py` composites screenshots inside the branded phone frame (or full-bleed `broll` mp4), burns subtitles, mixes and normalises audio.

## Folder layout

```
FB/videos/
  README.md          PLAN.md   SESSION.md   NEXT.md   brand-notes.md
  clips/             ← spec per film (the thing you edit)
  elevenlabs/        ← voice settings, auditions, VO + timings
  production/        ← render_clip.py, checklist, tools
  storyboards/       ← narrative intent per clip
  assets/
    screens/stills/  ← app screenshots
    screens/broll/   ← short YouTube cuts for explainers
    illustrations/   ← loop diagrams, phone frame, cards
    audio/           ← VO, auditions, alignment JSON
    raw/youtube/     ← full source downloads (local)
    exports/
      001-closed-loop/
      002-what-is-healthings/
      003-activity-youtube/
```

## Still to improve

- **Music bed** — no licensed track yet; `--music` is wired
- **Native Activity Log stills** at full phone resolution (unlock + adb) for clip 07 polish
- Clips 00–04 can be given specs the same way

## Related

- Alpha recruit copy: `FB/post-alpha-recruit-he.txt`
- Product framing: `investor-pov/EXECUTIVE-SUMMARY.md`
- UI capture reference: `UI-snapshots/`
