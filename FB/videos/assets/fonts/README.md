# Fonts

## Display (open / end cards, diagrams)

**Montserrat** — the site's `--font-display` (`website/tokens.css`). Vendored because it
is not installed on Windows, and the SVG rasteriser needs the actual files.

| File | Weight | Used by |
|------|--------|---------|
| `Montserrat-Regular.ttf` | 400 | rasteriser default family |
| `Montserrat-Medium.ttf` | 500 | card taglines, node subtitles |
| `Montserrat-Bold.ttf` | 700 | wordmark, headings, badges |

Licensed under the SIL Open Font License 1.1 — see `OFL.txt`. Source:
[JulietaUla/Montserrat](https://github.com/JulietaUla/Montserrat).

`production/build_art.py` passes this folder to resvg with `--font-dir`.

## Burned subtitles (libass)

Montserrat has **no Hebrew**. Burned captions use **Noto** from this same folder
(`render_clip.py` → `fontsdir=assets/fonts`).

| File | Family | Use |
|------|--------|-----|
| `NotoSansHebrew-*.ttf` | Noto Sans Hebrew | Default when `subs_lang=he` |
| `NotoSans-*.ttf` | Noto Sans | Latin burns (FR/DE VO cuts, EN-only) |

Style: outline only (navy fill + white edge) — no full-width opacity band.
Source: [googlefonts/noto-fonts](https://github.com/googlefonts/noto-fonts) (OFL).
