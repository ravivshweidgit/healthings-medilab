# NEXT

## Where we are

Two finished films render end-to-end from a spec:

- `assets/exports/06-what-is-healthings-en-subhe-9x16.mp4` — ~49s, **new-user explainer**
- `assets/exports/05-closed-loop-en-subhe-9x16.mp4` — ~27s, warm audience

English voice (ElevenLabs Daniel), burned Hebrew subtitles, branded phone frame,
open/end cards, -14 LUFS, `.srt` sidecars.

Both now carry the **website's design system** — see `brand-notes.md`. Art is rebuilt
with `python production/build_art.py` after any SVG edit.

## Decisions locked

| Question | Answer |
|----------|--------|
| VO language | English — Hebrew ElevenLabs pass was rejected |
| Subtitles | Hebrew, burned (most FB views are muted) |
| Founder 13-day POC | Post text only, never in the film |
| Voice | Daniel `onwK4e9ZLuTAKqWW03F9` |
| Palette / type | `website/tokens.css` + Montserrat — never a video-only palette |
| Transitions | `xfade` dissolves centred on the VO word boundary |

## Three ways to raise quality further

1. **Music bed.** The single biggest remaining gap. `--music` already ducks a track
   under the voice; it needs a licensed file. Do not reuse the Tanzania safari track —
   that licence belongs to the other project.
2. **Live screen video** instead of stills. Follow `SESSION.md`; the specs reference
   files by name, so dropping in `.mp4` shots is a spec edit, not a re-edit.
3. **Clinic portal footage** for beats 4 and 8 — right now the clinic is represented by
   the lab-import screen, which is the weakest link in the story.

## Editing a film

Change `clips/06-what-is-healthings.json`, then:

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 06-what-is-healthings --force
python FB/videos/production/render_clip.py  --clip 06-what-is-healthings
```

## On the website

Clip 06 is embedded in the **How it works** section of `website/index.html` as a 16:9
cut with no burned subtitles: `website/videos/how-it-works.mp4`, 5.1 MB,
`preload="none"` behind a 23 KB poster so it costs the install CTA nothing until
someone clicks. Captions come from `<track>` in English and Hebrew.

It is deliberately **not** in the hero — the hero screenshot is the LCP element and
the page's job is install conversion.

## Backlog

- Specs for clips 00–04 (storyboards already written)
- Square 1:1 variant for feed
- More caption languages for the site — the app ships 10, the site video has 2
- Clinic-portal footage to replace the lab-import screen in beat 4
