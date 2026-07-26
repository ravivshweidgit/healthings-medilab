# be-12 — Help site (10 locales)

**Status:** done — reviewed by Opus 5 on 2026-07-26, two fixes applied during review
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

- [x] Help index renders as the styled card grid in all 10 locales, not disc bullets
- [x] One language control, one tab stop, endonyms, no flag emoji
- [x] H1 is the first heading a screen reader reaches after the nav row
- [x] Every generated page has a unique `meta description` and a `canonical`
- [x] Index pages carry `hreflang` alternates including `x-default`
- [x] Hebrew and Arabic articles: list bullets sit on the right, text aligns right
- [x] Article prose measures ≤68ch on desktop (inherited from be-10)
- [x] `rg 'help-icon-hero|help-card-list|help-cgm-label'` returns nothing
- [x] All 160 pages regenerate cleanly and the diff contains no hand edits

## Out of scope

- Rewriting or lengthening article content
- Adding a search box (15 short topics do not need one)
- Single-page consolidation — see "Needs a decision"
- Adding new locales (Swahili is a separate discussion)

## Review by Opus 5 (after Auto marks done)

**Evidence to capture**

- Screenshots at 1280 and 390 of: `/en/help/`, one EN article, one HE article, one AR article
- The first five focusable elements in tab order on an article page
- One generated `<head>` from EN and the matching HE file

**Judgment calls to check**

- Is the index card grid actually **better** than the bullet list, or only different? Fifteen cards
  can be worse than fifteen bullets if the cards are mostly padding.
- Has the `<select>` language control become **invisible**? It was far too loud before; the failure
  mode now is a multilingual user who cannot find their language at all. Check it at 390.
- With `What to know` removed, does a 94-character article read as complete or as **truncated**? If
  truncated, the answer is better content, not restoring the boilerplate heading.
- Are the HE and AR pages genuinely **mirrored**, or merely right-aligned? Look at list bullets, the
  back-link arrow, and the nav row.
- Does the "Next topic" sequence follow a logical Quick Start order, or does `HELP_SLUGS` order
  produce odd jumps (e.g. CGM before Link Withings)?

## Opus 5 review outcome (2026-07-26)

**Accepted.** The cleanest batch of the pack. Scope was disciplined — two generator files,
`styles.css`, and 160 regenerated pages, with no hand-edited HTML. `CSS_VER` and the site-wide
`--accent-ink` default were correctly left alone as already shipped in `be-11`.

Verified rather than taken on trust:

| Check | Result |
|---|---|
| `hreflang` set + `x-default` | 11 `alternate` links on articles **and** indexes |
| `canonical` | absolute, self-referential per locale |
| RTL (`he`, `ar`) | `dir="rtl"`, `body.help-rtl`, list `padding-right: 20px / padding-left: 0`, prose and back/next right-aligned |
| RTL arrow direction | next `←`, back `→` — correctly inverted, since forward is leftward in RTL |
| Dead CSS (`help-icon-hero`, `help-card-list`, `help-cgm-label`, `help-icon-caption`) | zero references anywhere in `website/` — safe to have removed |
| Last slug (`manual-body`) | no dangling "Next topic" |
| Prose measure @1280 | 62–64ch, `.prose` block 587px |
| Switcher controls | select and submit both 44px tall |
| `<noscript>` fallback | plain localized links for all 10 locales |

Two fixes applied.

**1. The language switcher was the only unlocalized string on the site.** Label hardcoded
`Language / שפה` and button `Go` on **all ten locales**, so the German page offered English plus
Hebrew and the Turkish page did the same. Everything else in `UI` — nav, badge, glossary, next
topic — was already per-locale; these two keys were simply missing. Added `langLabel` / `langGo`
to all ten entries in `help-locale-content.mjs`: Sprache/Wechseln, Dil/Git, اللغة/انتقل,
Язык/Перейти, שפה/עבור, and so on. This is the language-policy rule for the website — help UI
follows the path locale.

**2. `onchange` on the select made the switcher keyboard-hostile.** Navigating on `change` means
an arrow key press moves the page immediately, so a keyboard user could never reach any option
beyond the adjacent one — a WCAG 3.2.2 (On Input) failure. The submit button existed precisely
to avoid this, so keeping both defeated it. `onchange` removed; navigation now happens on submit
only, which is also what the `<noscript>` links already implied.

Also dropped the empty `class=""` that LTR pages carried.

**Windows encoding trap — worth knowing before touching this generator again.** During review I
edited `gen-help-locales.mjs` with a PowerShell `Get-Content -Raw | Set-Content` round trip, which
reads a BOM-less UTF-8 file as ANSI. Every `—`, `→`, `←`, and `·` in the generator became mojibake
(`â€"`, `â†'`), which then propagated into all 160 pages: Hebrew titles rendered as
`… ארוחה â€" Healthings Help`. Repaired by inverting the codec, and all 180 files regenerated
clean — zero `â`/`Â`/`€`/`†` anywhere in `website/**/*.html`. **Use a UTF-8-aware editor or Python
for this file; never a PowerShell text round trip.** Inverting it needs a hybrid codec, since
cp1252 cannot encode `\x90` and latin-1 cannot encode `€`.

**Post-commit fix — the meal-logging article described an app that does not exist.** The owner
read `/he/help/meal-logging/` and rejected two claims, both wrong in all ten locales because they
come from one source row in `help-locale-content.mjs`:

| Claim | Reality in the app |
|---|---|
| "Tap **+** on the metabolic chart" | There is no add affordance on the chart. `MetabolicChart.tsx` has no `onAddMeal`; the entry point is the **Meal** button in the Food Log action row (`FoodMacroStrip.tsx`, next to Water). |
| "so coaching under My Rules can show live impact on charts" | Logging a meal runs `analyzeMacroMealIssues`, which flags `carb_over`, `kcal_over`, `protein_low`, and `rule_conflict` — it *surfaces conflicts with My Rules and the daily targets*, it does not animate a chart. |

Both fixed against source, not guessed: step 1 now names the real control in each locale's own UI
string (`FOOD LOG` / `יומן ארוחות` / `ESSENSTAGEBUCH` / `ДНЕВНИК ПИТАНИЯ` …, from `FOOD_LOG_TITLE`,
and `Meal` / `ארוחה` / `Mahlzeit` / `Öğün` …, from `foodLogUiCopy.ts`), so the help text matches the
words on the screen in the reader's language. The lead now states the conflict check. Ten pages
regenerated; no other files touched, and no encoding regression.

**The lesson is about provenance, not translation.** The owner flagged Hebrew, but Hebrew was a
faithful translation of a wrong English source — nine other locales carried the same error
silently. Help copy that names a control or describes a behavior has to be traced to the component
that renders it.

**Full audit of the remaining 14 articles.** Every factual claim checked against the component
that implements it. Nothing else was invented the way the chart `+` was, but three defects came
out, one of them in the app rather than the website.

*1. Eight locales named a button that does not exist.* `phone-health-activity` said to tap
**Next**, but `quickStartCopy.ts` localizes that label: `Continuar` (es, pt), `Continuer` (fr),
`Weiter` (de), `متابعة` (ar), `Далее` (ru), `Continua` (it), `Devam` (tr). Only `en` and `he`
(`המשך`) were right — the Hebrew reviewer could not have caught this one. Fixed to the app's
verbatim labels. `starting-weight` gives the same instruction but its translations say "or
continue" without naming the button, so it needed nothing.

*2. The app undersells its own units step; the help was the accurate side.* `UnitsPreferenceSection`
renders five pickers and `UnitsPrefs` stores five fields (glucose, mass, height, water, energy),
but `units.lead` promised three in all ten languages. Fixed in the app.

*3. `My Profile` / `My Mentors` no longer exist as labels.* Per the language-policy rule the strips
are bare localized nouns now (`profileSettingsStripCopy.ts`: `PROFILE`/`MENTORS`, `פרופיל`/`מנטורים`,
`ПРОФИЛЬ`/`НАСТАВНИКИ`, …), but help *and* the app's own wizard prose still sent readers to an
English "My Profile" in every locale. Fixed on both sides — 30 help occurrences, 30 app occurrences,
plus two hardcoded dashboard strings.

Replacements were scripted with per-locale pairs, not a token sweep, because the right string
depends on grammar: Russian needs `в разделе «Профиль»` since a bare noun after `в` is
ungrammatical, Hebrew wants the clitic fused (`בפרופיל`, `מהפרופיל`) rather than a maqaf before a
bare noun, Italian needs `dal Profilo`, and Turkish needs vowel-harmonised suffixes (`Profil’de`,
`Profil’den`). Each replacement asserted its expected hit count so a silent miss fails the run.

*Verified correct, no action:* birth date/gender/height do feed BMR via Mifflin–St Jeor
(`bmrEstimate.ts`); mentor voice really is Hebrew and Arabic only (`usesMentorGenderUi`); CGM really
is Health Connect or HealthKit (`GlucoseSource`); Withings really is cloud OAuth, not Bluetooth; the
targets screen really has a Regenerate button (`Regenerate with AI`).

**Standing rule this produces:** a help article may not name a control or state a behavior unless
the string was read out of the component that renders it. Both defects that reached users came from
copy written next to a feature description instead of next to the feature.

**Follow-ups, not blocking**

- **Bare `&` in generated markup.** Article titles containing `&` ("Units & measurements",
  "App & coach language") emit an unescaped ampersand in `<title>`, `<h1>`, index links, and
  next-topic text. Browsers recover, but it is invalid and a validator run would flag it. The fix
  is escaping the plain-text `title` field only — the `glossary` and `lead` fields legitimately
  contain `<strong>`, so a blanket escape would be wrong.
- **The glossary line is a tautology on `/en/`.** "Clinical terms like kcal, BMR, CGM … stay in
  English" says nothing on an English page. Worth emptying `UI.en.glossary` and having the
  generator skip the paragraph when blank. Left alone because it is a copy judgment, not a defect.
- **Articles are still one to four sentences** wrapped in a full nav, switcher, and footer
  apparatus. The open question from the start of this pack — collapse the 15 topics into one
  anchored page per locale — is now the biggest remaining question about the help site, and this
  batch made the chrome-to-content ratio more visible, not less.

## Post-deploy verification on the live domain (2026-07-26, ~03:20)

The whole batch was verified on localhost. This was the first look at `healthings.ai` itself, done
because shipped app builds deep-link into these pages — a broken locale is hit by a real alpha
tester, not by us.

Website side is clean:

| Check | Result |
|---|---|
| 30 pages (10 locales x index, cgm, meal-logging) | all `200` |
| `/help/cgm.html`, `/help/` legacy paths | `301` → `/en/...` |
| `/{lang}/help/` directory form (what the app opens) | `200` for en, he, ar |
| `he` / `ar` documents | `lang` + `dir="rtl"` + `body class="help-rtl"` |
| hreflang | 10 locales + `x-default`, absolute URLs, plus a `<noscript>` link list |
| canonical | self-referential, absolute |
| `Cache-Control` | `no-cache` — the be-16 nginx fix covers help too |

The Hebrew `meal-logging` rewrite the owner rejected is live and correct: lead now describes the
coach checking the meal against My Rules, step 1 says **ביומן ארוחות לוחצים ארוחה**. Arabic index
renders RTL with the card grid. Evidence in `tmp/help-live-check/`.

### Defect found — app-side, not website

**Two dashboard help links were hardcoded to `/en/`.** be-12 localized 160 pages and prompt81 built
`helpUrl(langCode, slug)` for exactly this, but two components predated it and never adopted it:

| File | Was | Now |
|---|---|---|
| `ManualBodyProfileSection.tsx` | `const HELP_URL = '.../en/help/manual-body.html'` | `helpUrl(langCode, 'manual-body')` |
| `PhoneHealthActivityStrip.tsx` | `const HELP_URL = '.../en/help/phone-health-activity.html'` | `helpUrl(langCode, 'phone-health-activity')` |

Effect: a Hebrew user got Hebrew help inside Quick Start (the wizard uses `helpUrl` at all 15 call
sites) and then English help from the dashboard. Both slugs already existed in `HelpSlug`, and both
locales already existed on the site — the localized pages were simply never reachable from those
two buttons.

`ManualBodyProfileSection` already received `langCode`. `PhoneHealthActivityStrip` did not, so it
gained an optional `langCode?: string`, threaded from `GearSetupStrip` (`lang?.code`) and from
`WelcomeQuickStartWizard` (`langCode`). The iOS Apple Health diagnostics alert also quoted the
`/en/` URL in its body text and now quotes the localized one.

Violated the language-policy rule ("help `?` → `/{lang}/help/`"). Grep for
`healthings.ai/en/help` under `app/` now returns nothing — worth keeping as a regression check.

Not built or phone-tested; lints clean on all four files. Needs a `bi` before commit.

### Still worth deciding

Both link labels are still hardcoded English prose ("How manual body logging works", "How to get
steps & heart rate into Health Connect") on a dashboard that the language policy says should follow
`appLocale`. The destination is now localized but the label pointing at it is not. Smaller than it
looks — two strings — but it belongs to the dashboard-chrome sweep, not here.

## Agent checklist

- [x] Status → in_progress
- [x] Changes made in the generator, not in generated HTML
- [x] Regenerated all 160 pages
- [x] Smoke criteria above
- [x] Status → needs-review (evidence in `tmp/be-12-review/`) — **do not mark done**
- [x] Update `drafts/README.md` table
- [x] Left `CSS_VER` / site-wide `a` color alone (be-11)
