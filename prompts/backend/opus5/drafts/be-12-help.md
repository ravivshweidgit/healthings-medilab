# be-12 — Help site (10 locales)

**Status:** ready
**Model to implement:** Auto / Composer
**Authored by:** Opus 5 (website UX pack)
**Findings:** W9 (index regression), W10 (chrome outweighs content), W11 (language switcher), W12 (meta/SEO), W13 (RTL), W14 (orphaned CSS)
**Depends on:** be-10 (tokens — supplies the prose measure fix)

## Problem

160 generated pages across 10 locales, and the chrome is bigger than the content.

1. **The index regressed to an unstyled bullet list.** Committed files use
   `class="card prose help-index"`, but the generator emits `class="card prose"`
   (`gen-help-locales.mjs` line ~105). The live page is the generator's output: 15 default disc
   bullets. The `.help-index` card-grid CSS (`styles.css` lines 682–710) is now **dead code**.
2. **Articles are tiny.** EN bodies average **94 characters**; the longest is 310. On
   `quick-start-units.html` the lead sentence is nearly as long as the body. Every article carries
   the same generic `<h2>What to know</h2>`.
3. **The language switcher is the loudest thing on every page.** Ten links, first in the DOM and
   first in tab order — a keyboard or screen-reader user passes all ten before reaching the H1. It
   occupies the top ~115px on mobile. And the flag emoji **do not render on Windows Chrome**: users
   see letter pairs (`GB EN`, `IL HE`, `SA AR`) instead of flags.
4. **No `meta description` on any of the 160 pages**, no `canonical`, and index pages carry no
   `hreflang` alternates (articles do). No `x-default`.
5. **RTL is one rule.** `body.help-rtl .prose { text-align: right }` and nothing else, so Hebrew and
   Arabic lists keep their left padding.
6. **Dead CSS.** `.help-icon-hero`, `.help-icon-caption`, `.help-brand`, `.help-cgm-label`,
   `.help-card-list` are unused by any generated page.

## Goal

A help page where the content is the largest thing on screen, the language picker is one quiet
control, and the index looks designed rather than defaulted.

## Files to touch

- `website/scripts/gen-help-locales.mjs` (templates, switcher, head)
- `website/scripts/help-locale-content.mjs` (only if grouping labels are added)
- `website/styles.css` (help rules; delete dead selectors)
- Regenerate: `node website/scripts/gen-help-locales.mjs` → all 160 pages
- Do **not** hand-edit generated HTML. Every change goes through the generator.

## Design rules (from Opus)

- Chrome recedes, content leads. On an article the H1 should be the first thing the eye lands on.
- Language pickers use **endonyms**, never flags — a flag is a country, not a language, and Arabic
  is not Saudi Arabia. This also sidesteps the Windows rendering problem.
- Do not pad the articles to look substantial. Short and correct beats long and hedged; the fix is
  presentation, not word count.

## Implementation notes

**Index.** Emit `class="card prose help-index"` from the generator so the existing card grid applies
again. Verify against `styles.css` lines 682–731 — if that CSS no longer matches the markup it
expects, update the CSS rather than deleting it.

**Language switcher.** Replace the 10-link `nav` with a single native `<select>` that navigates on
change, labelled "Language / שפה". One tab stop instead of ten, works without JS if wrapped in a
`<form>` with a submit fallback, and no emoji. Options use endonyms:

```
English · עברית · Español · Français · Deutsch · العربية · Русский · Português · Italiano · Türkçe
```

Move it **after** the `help-nav` row so the H1 is not preceded by a locale control.

**Article template.** Drop the boilerplate `<h2>What to know</h2>` — with a 94-character body it is
pure overhead. Keep the badge, H1, lead, body, glossary line, back link. Add a "Next topic" link
using the `HELP_SLUGS` order so a reader can walk the Quick Start sequence instead of returning to
the index 15 times.

**Head.** Per page, add `<meta name="description">` (use the article's `lead`, truncated to ~155
chars), `<link rel="canonical">` pointing at the page's own locale URL, and `hreflang` alternates on
index pages too, plus `x-default` → `/en/…`.

**Locale-aware home link.** `../../index.html` sends a Hebrew reader to the English landing page.
Until the landing is localized, that is acceptable — but the "Home" label should be the only link
that leaves the locale, and it should be last in the nav row, not first.

**RTL.** Add to the `help-rtl` block: list padding swap (`padding-right: 1.25rem; padding-left: 0`),
and `.help-nav`, `.help-back` alignment. Verify one Hebrew and one Arabic article visually.

**Dead CSS.** Delete the five unused `.help-*` selectors listed above.

**CSS_VER.** `gen-help-locales.mjs` line 18 sets `20260724lang10` but committed pages carry
`20260724e4`. Bump to a fresh value and regenerate so the version string is consistent everywhere.

## Decided: keep 15 separate pages (do not consolidate)

Consolidating into one anchored page per locale looks attractive for content this short, but it was
considered and **rejected**:

- **It saves nothing where the cost actually is.** Every article string lives in
  `help-locale-content.mjs` regardless of how many HTML files come out of the generator. The
  translation burden is identical either way; only the file count changes.
- **It breaks deep links from app versions already in the field.** Quick Start `?` buttons point at
  `/{lang}/help/{slug}`. Builds already on TestFlight and Play would keep requesting those URLs, so
  redirects would be needed permanently — replacing 160 clean pages with 160 redirects plus one
  large page.
- **Anchor scrolling is the fragile option on mobile**, especially in RTL and with browser chrome
  resizing the viewport. A `?` tap should land on the topic, not near it.

The real benefit people want from consolidation — reading the Quick Start straight through — is
delivered instead by the index card grid and the "Next topic" links in this batch.

## Acceptance criteria

- [ ] Help index renders as the styled card grid in all 10 locales, not disc bullets
- [ ] One language control, one tab stop, endonyms, no flag emoji
- [ ] H1 is the first heading a screen reader reaches after the nav row
- [ ] Every generated page has a unique `meta description` and a `canonical`
- [ ] Index pages carry `hreflang` alternates including `x-default`
- [ ] Hebrew and Arabic articles: list bullets sit on the right, text aligns right
- [ ] Article prose measures ≤68ch on desktop (inherited from be-10)
- [ ] `rg 'help-icon-hero|help-card-list|help-cgm-label'` returns nothing
- [ ] All 160 pages regenerate cleanly and the diff contains no hand edits

## Out of scope

- Rewriting or lengthening article content
- Adding a search box (15 short topics do not need one)
- Single-page consolidation — see "Needs a decision"
- Adding new locales (Swahili is a separate discussion)

## Agent checklist

- [ ] Status → in_progress
- [ ] Changes made in the generator, not in generated HTML
- [ ] Regenerated all 160 pages
- [ ] Smoke criteria above
- [ ] Status → done
- [ ] Update `drafts/README.md` table
