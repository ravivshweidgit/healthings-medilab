# Fonts

Montserrat — the site's `--font-display` (`website/tokens.css`). Vendored because it
is not installed on Windows, and the SVG rasteriser needs the actual files.

| File | Weight | Used by |
|------|--------|---------|
| `Montserrat-Regular.ttf` | 400 | rasteriser default family |
| `Montserrat-Medium.ttf` | 500 | card taglines, node subtitles |
| `Montserrat-Bold.ttf` | 700 | wordmark, headings, badges |

Licensed under the SIL Open Font License 1.1 — see `OFL.txt`. Source:
[JulietaUla/Montserrat](https://github.com/JulietaUla/Montserrat).

`production/build_art.py` passes this folder to resvg with `--font-dir`. Subtitles do
**not** use Montserrat — it has no Hebrew glyphs, so burned captions fall back to Arial.
