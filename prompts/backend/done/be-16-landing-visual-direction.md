# be-16 — Landing visual direction (2026 level)

**Status:** done — owner signed off 2026-07-26 (“it looks ok”)
**Model to implement:** Opus 5 (built it directly; see "What shipped")
**Authored by:** Opus 5 (website UX pack)
**Findings:** W23 (no product imagery), W24 (card monotony), W25 (timid type scale), W26 (differentiator buried), W27 (no dark mode on web), W28 (no motion)
**Depends on:** be-10 (tokens), be-11 (landing corrective fixes). Run **after** both — this is the
ceiling-raiser, and it is much cheaper on top of clean tokens and an un-boxed logo.

## Problem

be-11 makes the landing page *correct*. It does not make it *good*. After be-11 the page is a
competent 2019 layout: one column, a centered hero, three identical white rounded cards on a
gradient, no imagery, and a 32px H1. It reads as functional and unfinished — a working alpha rather
than a product.

Five specific absences, all measured on the live page:

1. **Zero product imagery.** No screenshot of the app anywhere on the site. For a product whose
   entire claim is that it turns data into decisions, showing none of it is the biggest single gap.
2. **Card monotony.** `.card` is the only sectioning device on the page. Three of them in a row, same
   fill, same radius, same shadow, same padding — so nothing has hierarchy and the eye has no path.
3. **Timid type.** H1 at 32px desktop / 26.4px mobile, lead at 16.8px. There is no scale contrast
   anywhere; the largest and smallest text differ by about 2×.
4. **The differentiator is fine print.** "Your health data stays on your phone" is the one claim
   competitors structurally cannot make, and it appears only in `privacy.html`.
5. **No dark mode and no motion**, while the app ships dark mode. The site does not look like it
   belongs to the same product as the app.

## Goal

Someone who lands on `healthings.ai` on a phone in 2026 should, within one screen, see the product,
understand the claim, and believe it was built by people who care. The page should feel calm and
clinical — not growth-hacked — while clearly being contemporary.

## Files to touch

- `website/index.html`
- `website/styles.css`
- `website/tokens.css` (extend with dark-scheme values and scale tokens)
- `website/images/app/` — **already populated, see "Available screenshots" below.** Use these; do
  not re-export, re-crop, or re-compress them
- Do **not** touch: help generator, privacy page, clinic pages
- Do **not** add a framework, bundler, or build step. This is a static site on nginx and stays one.

## Design rules (from Opus)

**Hard constraint — do not produce a generic AI-startup landing page.** No purple-to-blue gradient
mesh, no floating glassmorphic cards, no "Trusted by" logo wall, no fake testimonials, no emoji
bullets, no animated gradient text. This is a health product handling lab results. Restraint reads
as competence here; visual noise reads as a scam. The existing sky-to-gray palette and Montserrat
stay.

**Show the product, honestly.** Real screenshots of the real app. No invented UI, no idealized
mockups with fake perfect data. If a screen looks bad in a screenshot, fix the screen.

**Earn every animation.** Entrance transitions only. No parallax, no scroll-jacking, no counters
spinning up. If `prefers-reduced-motion: reduce` is set, everything must render immediately in its
final state.

## Implementation notes

**1. Two-column hero with a phone (≥1024px).** Copy left, phone frame right. Below 1024 it stacks,
phone first. The site already has phone-frame CSS — `.phone-frame`, `.phone-notch`, `.phone-screen`
in `clinic-dashboard.css`, currently used only by the clinic mirror. **Lift those rules into
`styles.css`** rather than writing new ones, so the phone chrome is identical in both places.

Use `app-coach` for the hero — see "Available screenshots". Ship WebP with the PNG as fallback via
`<picture>`, set `width="640" height="1422"` to avoid layout shift, and `loading="eager"` for this
one image only. Every other screenshot on the page is `loading="lazy"`.

## Available screenshots (captured 2026-07-25, Android release build)

In `website/images/app/`, every file `640x1422` (2x for a ~320px phone frame), each as `.webp`
plus a same-size `.png` fallback. Real data from a real account — no seeded or invented values.

| Base name | Screen | Use |
|---|---|---|
| `app-coach` | AI mentors, coach tip in English | **Hero.** The only frame showing the product reasoning rather than displaying |
| `app-trend-dark` | 32-day weight / fat / muscle / visceral + energy panels | Second feature. Shows outcome: −2.5 kg with +1.1 kg muscle |
| `app-chart` | Glucose + heart rate, 12H, meal and workout markers | The CGM claim |
| `app-dashboard` | Top of dashboard: brand, coach strip, body metrics, food log | Overview / "what you open to" |
| `app-foodlog` | Eaten / activity / burned with kcal deficit | The energy-balance claim |
| `app-chart-dark`, `app-dashboard-dark` | Dark variants of the above | Use when the section is on a dark surface, and for the dark-mode pass |

**Why `app-coach` is the hero rather than a dashboard shot:** the draft originally asked for chart
plus today's targets in one frame. That frame does not exist yet — the dashboard is taller than one
screen, so the chart and the targets strip cannot both be captured together without a scroll
composite, which would be an invented UI. The coach tip is the honest alternative and arguably the
stronger one: it is legible at 390px (large text, short paragraph), where a chart screenshot at that
width is decoration. Put `app-chart` in the first feature section instead, where it can be shown
larger.

Do **not** compose, mock up, or stitch screenshots to manufacture the missing frame.

**2. Type scale with real contrast.**

```css
--step-hero: clamp(2.5rem, 6vw, 4.25rem);   /* H1 */
--step-h2:   clamp(1.5rem, 3vw, 2.25rem);
--step-lead: clamp(1.05rem, 1.6vw, 1.3rem);
```

H1 gets `letter-spacing: -0.03em` and `line-height: 1.05`. The lead caps at `34rem`. Cards keep their
current sizes — the contrast comes from the hero, not from inflating everything.

**3. Section rhythm — three treatments, not one.** Alternate down the page so no two adjacent
sections share a treatment:

| Section | Treatment |
|---|---|
| Hero | Gradient, no container — content floats on the background |
| "One system, not four apps" | Full-bleed tinted band (`--accent-light`), edge to edge, content constrained |
| "How it works" | Plain background, no card — numbered timeline carries the structure |
| "Who it's for" + install | Card group, as today |

The full-bleed band requires `.wrap` to stop being the outermost container. Move the width constraint
to an inner `.wrap` per section so bands can break out.

**4. Make local-first the hero claim.** A dedicated section directly under the hero, visually the
second-loudest thing on the page: **"Your health data never leaves your phone."** Support it with a
simple inline-SVG diagram — phone holding the data, server receiving only an email address, an
explicit break in the line between them — plus one sentence on the optional, revocable clinic
handoff, linking to `privacy.html#clinic-sharing` (anchor added in be-13).

Pair it with the honesty that is already in the privacy policy and currently hidden: not a medical
device, alpha, no diagnosis. Stated confidently as a trust signal rather than buried as a disclaimer,
this reads as integrity — which for a health product is a feature.

**5. Dark mode.** `@media (prefers-color-scheme: dark)` in `tokens.css`, remapping the same token
names to the app's dark palette so the site and app agree. Surfaces become near-black per the app's
convention, text inverts, the sky gradient becomes a deep navy wash. Verify the store badges and the
phone screenshot still read on dark — badges may need a light plate behind them.

**6. Use the viewport.** `.wrap` caps at 960px, so at 1600px there is ~440px of dead margin each
side while the CTA sits at 520px. Raise the content cap to 1120px for the hero row; keep prose
sections at `--measure` regardless — wide containers must not produce wide text.

**7. Motion.** One `IntersectionObserver` adding `.is-in` to sections; CSS transitions opacity and a
12px rise over 240ms with a 60ms stagger. Roughly 15 lines of vanilla JS, no dependency. Wrap the
whole thing in a `prefers-reduced-motion` guard.

## Acceptance criteria

- [ ] Mobile (~390): product screenshot and the local-first claim both visible within the first two
      screens; hero H1 ≥ 40px
- [ ] Desktop (~1280 and ~1600): two-column hero, no dead margin band, prose still ≤68ch
- [ ] No two adjacent sections use the same visual treatment
- [ ] Dark mode: every surface, text color, and badge legible; nothing hardcoded white survives
- [ ] `prefers-reduced-motion: reduce`: all content renders immediately, no transitions
- [ ] Lighthouse performance ≥ 90 on mobile; no CLS from the screenshot
- [ ] No framework, no build step, no third-party requests added
- [ ] Real screenshots only — no invented UI, no fake data
- [ ] No regression: store links work, footer links work, be-11's fixes intact

## Out of scope

- Help, privacy, and clinic pages — they inherit tokens and dark mode, nothing more
- Copywriting beyond section labels; the H1 and lead were settled in `61e76a2`
- Illustration commissions or a new logo
- Localizing the landing page

## Review by Opus 5 (after Auto marks done)

This is the one batch where the acceptance criteria matter least and the judgment matters most. A
page can satisfy every checkbox above and still look mediocre.

**Evidence to capture**

- Full-page screenshots at 390, 820, 1280, 1600 — light **and** dark
- The hero alone at 390 and 1280
- Lighthouse mobile report
- A screen recording or 3-frame sequence of the entrance motion

**Judgment calls to check**

- **Does it look like a 2026 product?** Compare honestly against two or three current health-app
  landing pages. Not "is it better than before" — it will be — but "would a stranger assume this
  team ships quality software".
- Does it still read as **calm and clinical**, or has it drifted toward generic startup? If any of
  the banned patterns crept in, name them.
- Is the phone screenshot doing real work, or is it decoration? A screenshot nobody can read at
  390px wide is decoration.
- Does the local-first claim land as **confidence** or as defensiveness? The line between "we
  protect your data" and "please trust us" is tone, and tone is the whole point here.
- Dark mode: does it look designed, or like light mode with inverted colors?
- Is the motion invisible in the right way — felt, not noticed? If you can see it working, it is
  too much.

## What shipped (2026-07-26)

Built by Opus 5 rather than handed to Auto: the draft's own review section says the checkboxes
matter least here, and the judgment calls below are exactly the ones a checklist cannot settle.
Evidence in `tmp/be-16-review/` — full-page captures at 390 / 820 / 1280 / 1600 in light and dark,
per-section crops at 1280, a Lighthouse report, and the contrast table.

**Files:** `website/index.html`, `website/styles.css`, `website/tokens.css`. Nothing else. No
framework, no build step, no new third-party request.

### Section rhythm as built

| Section | Treatment |
|---|---|
| Hero | Gradient, no container, two columns ≥1024 with `app-coach` in a phone frame |
| Your health data never leaves your phone | Full-bleed inverted band + inline-SVG diagram |
| One system, not four apps | Full-bleed tinted band |
| How it works | Plain background, timeline beside `app-chart` |
| Why trust it with your labs | Surface card, proof chart beside the founder note |
| Who it's for | Plain background |
| Installing the alpha | Surface card |

No two adjacent sections share a treatment.

### Deviations from the draft

- **`--step-hero` capped at 3.5rem, not 4.25rem.** At 68px the 56-character H1 broke into four
  ragged lines at 1280 and dominated the phone beside it. 40px floor is unchanged, so the mobile
  criterion still holds. `text-wrap: pretty`, not `balance` — balance produced a two-word first line.
- **The hero wordmark is gone.** `brand-logo.png` has a tagline baked into the artwork, so it cannot
  shrink into the nav, and at 300px in the hero it put the wordmark on screen twice and pushed the
  H1 down a phone screen. The nav keeps the text wordmark. This resolves be-11's "duplicate
  wordmark" hand-off, and it is one line to reverse if the owner wants the mark back.
- **Dark mode is opt-in via `<html class="theme-auto">`, not `:root`.** `tokens.css` is also loaded
  by `clinic/index.html` and `clinic/patient.html`, whose stylesheets still carry hardcoded light
  surfaces. Flipping tokens globally would have darkened a clinician tool nobody has checked. Help
  and privacy can opt in the moment someone verifies them; the mechanism is already there.
- **`app-chart` sits in a phone frame**, not shown "larger" as a bare image. It is a 640×1422
  portrait shot; unframed at half a 1120px row it would have been 1100px tall.
- **Store badges are repeated in the install card.** "Use the store badges above" is a scroll back
  to the hero once that card is the thing on screen.

### Problems found and fixed during the build

- **The tinted band erased the comparison.** `.compare-after` is filled with `--accent-light`, which
  is also the band — the recommended column lost its panel while the status quo kept one. Inverted:
  the recommended column is now the elevated surface, the status quo a quiet outline.
- **The proof figure floated in an empty card.** A 360px image centered in a 1120px card with the
  founder note stacked below left most of the card blank. Now a two-column split.
- **Entrance motion could have blanked the page.** `.reveal` starts at `opacity: 0`, so any script
  failure would have hidden everything below the hero. Now gated on a `.js` class set before first
  paint, and the observer also reveals sections already scrolled past — otherwise deep-linking to
  `#get-alpha` left everything above it permanently invisible.
- **Dark badge treatment.** A white plate turned two black badges into white buttons; replaced with
  an inset hairline. Deliberately `box-shadow`, not `outline`, which would have swallowed the focus
  ring.
- **Nav wordmark was a 24px tap target.** Given `.u-tap`.

### Measured

| Check | Result |
|---|---|
| Lighthouse mobile | performance **98**, accessibility **100**, best-practices **100**, SEO **100** |
| CLS | 0.044 — from the Google Fonts swap, not the screenshots; all images carry width/height |
| Contrast, 16 pairs, both schemes | all ≥ 4.95:1, AA (`tmp/be-16-review/contrast.py`) |
| `prefers-reduced-motion: reduce` | 6/6 sections opaque, transition-duration 0s |
| Horizontal overflow at 390 | none — `scrollWidth === clientWidth` |
| Help, help article, privacy, clinic sign-in | unchanged; landing CSS is scoped to `.landing` |

### Note for whoever captures evidence next

`chrome --headless=new --screenshot` is not trustworthy on Windows. It opens a real window, the OS
clamps it to about 500px wide and to the screen height, so narrow breakpoints lay out at the wrong
width and every lazy image below the clamped viewport renders blank. Two review rounds were spent on
screenshots that were lying. Use `tmp/be-16-review/shoot.mjs`, which drives CDP directly
(`node shoot.mjs <url> <outDir> [widths] [schemes] [prefix]`) and has neither limit.

## Agent checklist

- [ ] Status → in_progress
- [ ] Used the supplied `website/images/app/` screenshots as-is — none re-exported or composed
- [ ] Phone-frame CSS lifted from `clinic-dashboard.css`, not rewritten
- [ ] Banned-pattern list re-read before finishing
- [ ] Acceptance criteria above
- [ ] Status → `needs-review` with evidence attached — **do not mark done**
- [ ] Update `prompts/backend/README.md` table
