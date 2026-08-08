# Brand & claims notes (video)

## Visual system — inherited from the website, not invented here

The films must read as the same product as [healthings.ai](https://healthings.ai/).
`website/tokens.css` is the source of truth; the video art copies it rather than
defining a palette of its own. When a token changes on the site, change it here too
and re-run `production/build_art.py`.

| Role | Token | Value |
|------|-------|-------|
| Page background | `--bg-page` | `#F0F4F8` |
| Sky wash (top of frame) | `--bg-sky` → `--bg-accent` | `#B8DAF0` → `#D6EBF8` |
| Headings, subtitles | `--navy` | `#1A2B4A` |
| Secondary copy | `--muted` | `#5C6B7A` |
| Accent — loop ring, badges | `--accent` | `#3D9DD6` |
| Accent text (URL) | `--accent-ink` | `#1B6B96` |
| Cards | `--surface` / `--line` | `#FFFFFF` on `#E2E8F0` |
| Badge pill | `--accent-light` | `#E8F4FC`, border `#3D9DD6` @ 35% |
| Brand EKG | — | `#00A8C0` |
| Brand heart | — | `#E53935` → `#B71C1C` |

The vertical gradient is the site's `body` background rescaled to 1080×1920:
sky at 0%, `--bg-accent` at 14%, `--bg-page` from 32% down.

**Light, not dark.** An earlier cut used a dark teal/gold palette. It looked like a
different company. Every card, diagram and frame background is the light page
gradient, and the phone mockup is the site's own dark handset
(`linear-gradient(145deg, #2A2A2A, #111)`, 58px radius) sitting on top of it.

### Type

Display is **Montserrat** 500/700 — the site's `--font-display`. It is not installed
on Windows, so a copy lives in `assets/fonts/` (SIL OFL) and `build_art.py` points the
rasteriser at it. Burned subtitles use **Noto Sans Hebrew** (HE) / **Noto Sans** (Latin)
from the same folder — outline style, not a dark band.

Shape language follows the site: 20px card radius, 999px pills, `0 8px 32px
rgba(26,43,74,0.08)` shadow.

## Always-English on screen (glossary)

Keep as English even in Hebrew videos: **Healthings**, **CGM**, **AI**, **kcal**, **mg/dL**, **kg**, device names (**Withings**, CareSens), slash commands if shown (`/7`, `/macros`).

Hebrew narration can say “קלוריות” while the UI shows kcal.

## Positioning lines (safe)

| Use | Line (EN) | Line (HE) |
|-----|-----------|-----------|
| Thesis | Clinic directs. App executes. Devices measure. Loop closes. | הקליניקה מכוונת. האפליקציה מיישמת. המכשירים מודדים. המעגל נסגר. |
| Differentiator | Not another food diary — clinical rules that run every day. | לא עוד יומן אוכל — כללים קליניים שרצים כל יום. |
| Roles | Deep visit with a licensed nutritionist; daily follow-through by the app. | מפגש מעמיק עם תזונאית קלינית עם רישיון; הליווי השוטף באפליקציה. |

## Do not say

- Guaranteed weight / LDL / drug-free outcomes for viewers
- “AI doctor” / “replaces your clinician”
- That Healthings diagnoses disease
- That every user will match the founder’s 13-day lab story

## Founder POC (only with disclaimer)

Allowed as **personal story**, same spirit as `FB/post-alpha-recruit-he.txt`:

> התוצאה שלי אישית; לא הבטחה לכולם.

English: *My personal result; not a promise for everyone.*

Prefer keeping POC in the FB post caption, not burned into every Reel — or one end-card variant only.

## Privacy

- Screen recordings: demo / own account only
- Blur emails, full names, clinic IDs if any real data slips in
- Portal clips: demo patient or synthetic labels

## Music / voice

- Soft, non-medical-drama underscore; keep voice clear over music
- Captions burned in — most FB views are silent
