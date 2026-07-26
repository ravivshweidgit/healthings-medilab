# be-10 — Shared design system (foundation batch)

**Status:** done (reviewed 2026-07-26 — see "Opus 5 review outcome" below; contrast fix applied)
**Model to implement:** Auto / Composer
**Authored by:** Opus 5 (website UX pack)
**Findings:** W1 (three visual languages), W2 (prose measure), W3 (tap targets)
**Depends on:** none — **implement this first**; be-11/12/13/14 assume these tokens exist

## Problem

The site is three products wearing three skins. Measured, live:

| Token | Landing (`styles.css`) | Workspace (`clinic-workspace.css`) |
|---|---|---|
| Page background | gradient `#b8daf0` → `#d6ebf8` → `#f0f4f8` | flat `#f0f2f5` |
| `--muted` | `#5c6b7a` | `#6b7280` |
| Primary action | `--green` aliased to accent blue `#3d9dd6` | `--green` redefined as navy `#1a2b4a` |
| Radius | `20px` | `12px` |
| Shadow | `0 8px 32px rgba(26,43,74,.08)` | `0 1px 3px rgba(0,0,0,.08)` |
| Font | Montserrat | system stack |

The same variable name `--green` means two different colors in two files. A clinician who signs in
from the landing page crosses two visual identities in one click.

Separately, `.prose` has **no max-width**, so `privacy.html` renders body text at **912px line
length in 14.7px type** (~120 characters per line, against a 45–75 ideal). Help articles inherit the
same rule. And five links on the mobile landing page are **15px tall** — far under the 44px minimum.

## Goal

One token file, imported by every surface. Marketing pages stay warmer and rounder; app surfaces
stay denser — but they share one palette, one type scale, and one set of primitives, so nothing
reads as a different product.

## Files to touch

- `website/tokens.css` (new — single source of truth)
- `website/styles.css` (consume tokens; delete local duplicates)
- `website/clinic/clinic-portal.css` and `website/clinic/clinic-workspace.css` (consume tokens)
- Every HTML head that loads a stylesheet — add `tokens.css` **before** the page stylesheet
- Do **not** restyle individual pages here; that is be-11 through be-14

## Design rules (from Opus)

**Palette** — the landing page is the brand; the app surfaces adopt it.

```css
--bg-page: #f0f4f8;      --bg-sky: #b8daf0;     --bg-accent: #d6ebf8;
--surface: #ffffff;      --line: #e2e8f0;
--text: #1a2b4a;         --muted: #5c6b7a;      /* 4.95:1 on --bg-page — verified AA */
--navy: #1a2b4a;         --accent: #3d9dd6;     --accent-light: #e8f4fc;
--danger: #c0392b;       --warn: #ff9800;       --ok: #2e7d32;
```

Retire the `--green` / `--green-light` / `--green-mid` aliases entirely. They are legacy names from
the wellness-green era, they now mean contradictory things in two files, and every use site should
say what it means: `--accent` for links and emphasis, `--navy` for primary buttons.

**Two fonts, by job.** Montserrat is a geometric display face — good for the brand, poor for a
120-character line of policy text or a dense clinical table.

```css
--font-display: 'Montserrat', 'Segoe UI', system-ui, sans-serif;  /* h1–h3, brand, buttons */
--font-text: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;  /* body, prose, tables */
```

**Radius, by surface.** `--radius-lg: 20px` for marketing cards, `--radius-md: 12px` for app
surfaces, `--radius-pill: 999px` for badges and chips. Both already exist in practice; this just
names the intent instead of letting each file pick.

**Shadow.** `--shadow-lg: 0 8px 32px rgba(26,43,74,.08)` (marketing),
`--shadow-sm: 0 2px 12px rgba(26,43,74,.06)` (app). Note both are tinted navy — the workspace's
neutral `rgba(0,0,0,.08)` reads grayer and colder; drop it.

**Measure and tap targets.**

```css
--measure: 68ch;   /* max-width for any run of body prose */
--tap-min: 44px;   /* min height for any interactive element */
```

## Implementation notes

- `tokens.css` contains **only** `:root` custom properties. No selectors, no resets.
- Add `.prose { max-width: var(--measure); }` in `styles.css`. On centered pages this needs
  `margin-inline: auto` so short text does not hug the left edge of a wide card.
- Add a shared `.u-tap { min-height: var(--tap-min); display: inline-flex; align-items: center; }`
  for inline links that act as buttons. be-11 applies it to the landing footer.
- Body copy switches to `--font-text`; headings keep `--font-display`. The visible change is on
  prose pages and the workspace, and it should read as *more* legible, not different.
- Bump the `?v=` cache-busting string on every changed stylesheet link. Note the help generator's
  `CSS_VER` (`gen-help-locales.mjs` line 18) is already **out of sync** with the committed pages —
  fix it here and regenerate, or the help pages will keep serving a stale version string.

## Acceptance criteria

- [x] `--green*` appears nowhere in the repo (`rg -- '--green'` returns nothing)
      _(website/ clean; draft docs still mention retired names historically)_
- [x] Landing, help, privacy, clinic portal, and patient workspace all load `tokens.css`
- [x] Privacy body text measures ≤ 68ch at 1600px viewport (was ~120 characters)
- [x] Desktop (~1280) and mobile (~390): landing and clinic portal look unchanged apart from
      typography and the retired green aliases — this batch must not move layout
- [x] No regression: clinic workspace charts still render; `--red` / `--orange` chart series colors
      still resolve (map them onto `--danger` / `--warn`)

## Out of scope

- Per-page layout work — be-11 (landing), be-12 (help), be-13 (privacy), be-14 (workspace)
- Dark mode on web (the app has it; the website does not, and this batch does not add it)

## Review by Opus 5 (after Auto marks done)

The acceptance criteria above are mechanical. These are judgment calls — hand back with the evidence
listed, do not self-certify them.

**Evidence to capture**

- Screenshots at 1280 and 390 of all five surfaces: landing, `/en/help/`, `/privacy.html`,
  `/clinic/`, `/clinic/patient.html?patientId=…`
- The full diff of `styles.css`, `clinic-portal.css`, `clinic-workspace.css`
- Computed contrast of `--muted` on `--bg-page` and on `--surface`

**Judgment calls to check**

- Did retiring `--green*` change any control's **meaning**? A button that was accent blue and is now
  navy (or the reverse) is a semantic regression, not a color tweak — list every button whose color
  changed and why.
- Is the two-font split applied **by role** (display for headings, text for body) rather than by
  file? Check a page where both appear in one card.
- Did `--measure` make short prose look stranded in a wide card, or is `margin-inline: auto` doing
  its job?
- Are the app surfaces still legibly **dense**? Unifying tokens must not inflate the clinic workspace
  to marketing-page spacing — a clinician needs more data per screen, not less.

## Opus 5 review outcome (2026-07-26)

**Accepted, with one fix applied during review.** Verified independently: `--green` returns zero
hits across `website/`; `tokens.css` is `:root` properties only; `.prose` has both `max-width` and
`margin-inline: auto`; `.u-tap` exists; workspace density untouched. The surface-local alias block
(`--red` → `--danger`, `--shadow` → `--shadow-sm`, …) is a better approach than rewriting every
workspace rule, and Auto correctly reported that `clinic-portal.css` — named in the draft above —
does not exist, rather than inventing it.

**Contrast regression, caused by this draft.** The design rule "`--accent` for links and emphasis"
was wrong for small text: `--accent` `#3d9dd6` is only **3.0:1** on white, which is legal for
fills, borders, and text ≥24px but not for labels. Because the workspace previously aliased
`--green` to *navy* (14.1:1), retiring the alias dropped four controls to 3.0:1 — below AA:
`.ws-tab.active`, `.ws-topbar a`, `.macro-updated`, `.nudge-count`. The active tab is the worst
case, since it is how a clinician knows which patient view they are in.

Fixed in review by adding **`--accent-ink: #1b6b96`** (5.85:1 on white) and applying it to those
four rules. `--accent` keeps its existing meaning for fills, borders, and large display type.

**Screenshot evidence was weak, but not Auto's fault.** The captures in `tmp/be-10-review/` are
cropped to ~479px of a 1280px viewport. Opus hit the identical limit when re-shooting: the IDE
browser panel is ~430px wide and `browser_take_screenshot` clips to it even with
`Emulation.setDeviceMetricsOverride` at 1280. The Play badge also renders as a black box because
the external Google URL is unreachable from an offline capture. **Do not ask future batches for
wide screenshots from this tool** — it cannot produce them.

Measured values are the better evidence here, and they verify the batch (`Runtime.evaluate` on
`privacy.html` at a 1280 viewport):

| Property | Value | Meaning |
|---|---|---|
| `.prose` width | 587px (`max-width: 586.5px`) | was ~912px — the 120ch problem is fixed |
| body `font-family` | system stack | `--font-text` applied to prose |
| `h2` `font-family` | Montserrat | `--font-display` retained for headings — split is **by role**, not by file |
| `--accent-ink` | `#1b6b96` | review fix is live |

Structure was confirmed intact via accessibility snapshots of the landing and privacy pages: all
sections, the three-card grid, and every link present. Note this proves layout is **not broken**;
proving it did not *move* would need a before/after diff, which was not run.

**Routed onward, pre-existing and not caused by this batch:**

- Site-wide `a { color: var(--accent) }` in `styles.css` has the same 3.0:1 problem on marketing
  pages. It was already accent-colored before this batch. → **be-11**
- `.prose p, .prose li { color: var(--muted) }` renders all policy and help body text as secondary
  gray. Passes AA at 5.47:1, but body copy should not be muted. → **be-13**

## Agent checklist

- [x] Status → in_progress
- [x] Changes match this draft only
- [x] Smoke criteria above
- [x] Status → needs-review (Opus judgment; evidence in `tmp/be-10-review/`)
- [x] Update `prompts/backend/README.md` table
