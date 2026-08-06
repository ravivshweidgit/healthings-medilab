# Tools

## Required (already installed)

| Purpose | Tool | Notes |
|---------|------|-------|
| Render | **ffmpeg / ffprobe** | Needs libass for burned subtitles |
| Voice | **ElevenLabs** | Key resolved by `elevenlabs/_key.py` |
| Vector → PNG | `npx @resvg/resvg-js-cli` | Rasterises the frame, cards, loop diagrams |
| Python | 3.11+ | Standard library only, no packages to install |

## Capture

| Purpose | Tool |
|---------|------|
| Phone screen video | Android built-in recorder, or `scrcpy --record ...` over USB |
| Clinic portal | OBS, or Win+Alt+R |

Record phone captures at **1080×2400** so they fit the phone frame without changes.

## Editing brand art

The frame, cards, and loop diagrams are SVG in `assets/illustrations/`, drawn against
the website tokens (see `brand-notes.md`). After editing:

```powershell
python FB/videos/production/build_art.py            # all
python FB/videos/production/build_art.py card-end   # one, by stem
```

Call `build_art.py` rather than resvg directly — it passes `--font-dir assets/fonts`,
without which Montserrat silently falls back to a system face and the type stops
matching the site.

Keep SVG text **ASCII** — use `&#183;` for the middle dot. Raw high-bytes have been
written as cp1252 before now, and the rasteriser rejects the file as non-UTF-8.

If you move the screen cutout in `phone-frame.svg`, update `SCREEN_*` and `SHOT_CROP`
in `production/render_clip.py` to match — the crop aspect has to equal the cutout
aspect or the screenshot stretches.

## Aspects

`--aspect 9x16` (default, social) and `--aspect 16x9` (website). Each has its own
`Layout` in `render_clip.py` and its own art: `find_shot` prefers `<name>-16x9.png`
when rendering landscape and falls back to the portrait file. Screenshots are shared —
they sit inside the phone, so they are shape-agnostic.

In landscape the handset deliberately **runs off the bottom of the frame**. A whole
19.5:9 phone fitted inside 16:9 shrinks to about 215px once the page scales the video
down, and the app UI — the entire reason for the shot — stops being readable.

## Publishing the website cut

```powershell
python FB/videos/production/render_clip.py --clip 06-what-is-healthings `
  --aspect 16x9 --no-subs --crf 24

Copy-Item FB/videos/assets/exports/06-what-is-healthings-en-16x9.mp4 website/videos/how-it-works.mp4
Copy-Item FB/videos/assets/exports/06-what-is-healthings-en.vtt      website/videos/how-it-works.en.vtt
Copy-Item FB/videos/assets/exports/06-what-is-healthings-he.vtt      website/videos/how-it-works.he.vtt
ffmpeg -ss 11.5 -i website/videos/how-it-works.mp4 -frames:v 1 -vf scale=1280:-2 -q:v 4 `
  -update 1 -y website/videos/how-it-works-poster.jpg
```

Do not burn subtitles into the website cut. The site is path-locale, so captions have
to come from `<track>` — burned pixels would put Hebrew on `/en/`.

## Music

`render_clip.py --music <file>` loops a bed and ducks it under the voice
(sidechain compression), then normalises the mix to -14 LUFS. No track is committed —
the Tanzania safari bed belongs to that project's licence, so source a separate one.

## Not needed

Stock footage libraries, 3D medical animation, paid AI video generators, or a
timeline editor. The films are reproducible from the specs.
