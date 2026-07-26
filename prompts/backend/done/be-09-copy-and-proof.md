# be-09 — Landing copy and proof

**Status:** done — reviewed by Opus 5 on 2026-07-26, three fixes applied during review
**Model to implement:** Auto / Composer
**Authored by:** Opus 5 (website UX pack, added 2026-07-26 after the be-10 kickoff)
**Findings:** C1–C6 below
**Depends on:** none — copy is independent of tokens

**Execution position:** run **next**, before `be-11`. The number sorts it before `be-10` because it
has no dependency on tokens, but `be-10` was already underway when this was written. Everything
downstream (`be-11` structure, `be-16` visual direction) should be designed around final wording,
not draft wording, which is why this must not be deferred to the end.

## Problem

The pack fixes what is broken and then makes it look current. Neither addresses what the page
*says* — and the writing is the weakest part of the landing page. Six findings, all on
`website/index.html` as it stands today:

**C1 — The headline hides the product.** `Understand your body, hit your targets` could belong to
any of five hundred wellness apps. The genuinely unusual claim is one line below it, in the lead:
*import your lab reports and your nutritionist's plan*. A clinic-linked metabolic tool with lab
import is specific and defensible. The headline should carry it; today it buries it.

**C2 — The product has three names on one page.** The lead says "**Healthings** learns your body"
(line 35). The comparison card says "**MediLab** tells you what to do next" (line 103). The logo,
title, and comparison column say **HEALTHINGS.AI**. A visitor cannot tell what the product is
called, and inconsistent naming reads as unfinished.

**C3 — The page is written for testers, not visitors.** Above and around the fold: an
"Android & iOS alpha" badge, two store badges, "Internal testing", "Alpha tester guides", and a
three-step *How to install* list including "Tap Become a tester". That is onboarding
documentation occupying the most valuable space on the site. It is the single biggest reason the
page reads as an internal tool rather than a product.

**C4 — No proof of any kind.** No named clinician, no result, no indication of who built this or
why they can be trusted. For a product that asks strangers to upload blood work, this is the
trust gap. Fake testimonials are banned (`be-16`) and that stays — but nothing real was planned
in their place.

**C5 — An unsupported efficacy claim.** "Solo: same OS — many reach similar targets" (line 164).
"Many reach similar targets" is an outcome claim with nothing behind it, on a health product.
It must be substantiated or removed. This is the highest-priority item in this batch.

**C6 — "OS" is unexplained jargon.** "Metabolic OS" appears in the title, and "the OS" is used as
a bare noun twice more. It works as positioning for someone who already understands the product
and means nothing to a first-time visitor.

## Goal

A stranger who lands on the page learns, in order: what this is, who it is for, why it can be
trusted, and how to get it. Tester logistics still exist and stay easy to find — they simply
stop being the first thing a visitor reads.

## Files to touch

- `website/index.html` — copy, section order, one new proof section
- `website/styles.css` — only if the proof section needs a rule that does not already exist
- Do **not** touch: help pages or generator, privacy page, clinic pages, app source
- Do **not** change: store links, the TestFlight/Play URLs, the footer links

## Design rules (from Opus)

**Every claim must be true and checkable.** No invented testimonials, no invented users, no
statistics without a source, no implied clinical endorsement or regulatory status. If a fact
cannot be verified from the repo or confirmed by the owner, leave a clearly marked
`<!-- TODO(owner): … -->` and ship the section without it rather than filling the gap.

**Specific beats aspirational.** "Import a Clalit PDF and get today's protein cap" is worth more
than "understand your body". The product's real differentiator is the loop from lab report and
nutritionist plan to a daily number, and the copy should say that plainly.

**Do not oversell the AI.** The mentors are a feature, not the pitch. Leading with AI in 2026
signals commodity.

**Keep the existing voice.** Short sentences, concrete nouns, no exclamation marks, no emoji.
The lines that already work — "Charts tell you what happened. […] tells you what to do next",
"One system, not four apps" — are the register to match, and should survive this batch.

## Implementation notes

**1. Settle the product name (C2).** One name across the page. `HEALTHINGS.AI` in the logo and
title, `Healthings` in running prose. Remove **MediLab** from line 103 — it appears nowhere else
on the site. Grep the whole `website/` tree for `MediLab` and report any other hits rather than
silently changing pages outside this batch's scope.

**2. Rewrite the H1 and lead (C1, C6).** The H1 should name the loop: labs and a nutritionist's
plan becoming today's targets. Keep it under ~60 characters so it stays one or two lines at the
`be-16` hero scale. Move "metabolic OS" out of the first thing a stranger reads — it can stay in
the `<title>` and as positioning further down. The lead is already good and mostly needs to stop
repeating what a stronger H1 now says.

Write three H1 candidates as an HTML comment above the chosen one so the owner can swap without
re-deriving them.

**3. Demote tester logistics (C3).** Keep the store badges and the alpha badge in the hero —
they are the call to action. Move the *How to install* three-step block out of the hero into its
own section **below** "How it works", under a heading such as "Get the alpha". The `#play-link`
and `#testflight-link` ids, hrefs, and any JS depending on them must keep working exactly as
today.

**4. Add one proof section (C4).** Place it after "How it works". Whatever is true and available:

- **A real result, labeled as such.** `website/images/app/app-trend-dark.png` shows 32 days:
  −2.5 kg with +1.1 kg muscle. If it is used, it must be captioned as the founder's own data over
  a stated period — attributed honestly, not implied to be a customer. Anything less specific is
  worse than nothing here.
- **Who built it and why**, in two or three sentences.
- **What happens to the data**, in one line, linking to `privacy.html`. The local-first claim is
  the strongest trust asset the product has and currently appears nowhere on the landing page.

Anything requiring a fact you cannot verify becomes a `TODO(owner)` comment. Do not invent a
clinician, a user count, a partner, or a quote.

**5. Remove or substantiate the efficacy claim (C5).** Delete "many reach similar targets" unless
the owner supplies a basis. The surrounding sentence about the solo path is fine and should stay.

**6. Meta and title.** Update `<meta name="description">` to match the new lead. Keep it under
155 characters.

## Acceptance criteria

- [x] Exactly one product name in running prose across `website/index.html`
- [x] No unsupported outcome or efficacy claim anywhere on the page
- [x] Every factual claim traceable to the repo, the app, or an explicit `TODO(owner)`
- [x] H1 ≤ 60 characters and names the lab/nutritionist → daily target loop
- [x] *How to install* no longer in the hero; store links and their ids still work
- [x] Proof section present, with any unverifiable element left as a visible TODO
- [x] Desktop (~1280) and mobile (~390): no layout regression from `be-10`; prose ≤ 68ch
- [x] No new images, fonts, scripts, or third-party requests

## Out of scope

- Visual design, type scale, section rhythm, dark mode — all `be-16`
- Header nav, logo transparency, store badge sizing — all `be-11`
- Localizing the landing page
- Help, privacy, and clinic copy

## Review by Opus 5 (after Auto marks needs-review)

**Evidence to capture**

- Full-page screenshots at 390 and 1280
- A plain-text diff of every copy change, old line beside new
- The list of `TODO(owner)` items left behind, with the reason each could not be verified
- Output of the `MediLab` grep across `website/`

**Judgment calls to check**

- Does the H1 say something only *this* product could say, or has it swapped one generic line for
  another? The test: could a competitor put their name on it unchanged?
- Is the proof section **credible or defensive**? Founder data honestly labeled reads as
  confidence. The same data with vague attribution reads as a cover-up, and would be worse than
  omitting the section.
- Did demoting the install steps make the alpha *harder to find* for the tester audience who
  currently relies on this page? Check the path from landing to installed still holds up.
- Did the rewrite preserve the existing voice, or drift toward marketing register? Any sentence
  that could open a press release is a failure.
- Is "OS" now absent from the first screen without the positioning being lost entirely?

## Opus 5 review outcome (2026-07-26)

**Accepted.** The copy work is the strongest batch so far. The H1 —
*From lab report and nutritionist plan to today's targets* (56 chars) — passes the
competitor test: no generic wellness app could put its name on it. `MediLab` is gone from
copy (remaining hits are the `healthings-medilab.apk` artifact name, correctly left alone).
The efficacy claim is gone and its replacement, *"Solo: same loop without a linked clinic"*,
states a fact instead. The founder trend is labeled *"Founder's own Healthings data […] Not
a customer testimonial"*, which reads as confidence rather than a cover-up — the distinction
this batch was asked to get right. The bio was left as `TODO(owner)` rather than invented.

Three fixes applied during review.

**1. The privacy one-liner contradicted the privacy policy.** Shipped copy read *"Health
data stays on your phone unless you choose to share with a linked clinic."* `privacy.html`
says data stays local **"by default"** and discloses (line 113) that AI coach chat sends
meal and health context to Google Gemini — a feature this same page advertises two cards
above (*"Ask AI mentors between visits"*). A visitor would conclude their data never leaves
the phone unless they link a clinic. On a health product, that is the one class of claim
that must not be loose. Now:

> Health data stays on your phone by default. It leaves only when you share with a linked
> clinic or ask the AI coach.

Still the page's strongest trust asset, and now it matches the policy it links to.

**2. Layout regression — the criterion was checked without being measured.** Measured at
1280 before the fix: the proof card put a 640×1422 full-phone screenshot into a 293 px grid
cell (rendered 257×569), which drove **all three row-1 cards to 800 px** via
`.card { height: 100% }`, and the fifth card left an **empty third cell** in row 2. The
screenshot also scaled to ~40 % of the size its 8 px chart labels need, making it
decoration — the failure mode `be-16` explicitly warns about.

| | Before fix | After fix |
|---|---|---|
| Row 1 card height | 800 px | 622 px (driven by the compare card, not the image) |
| Row 2 | 2 cards + empty cell | 2 cards at 448 px, full width |
| Proof image rendered | 257×569 | 257×250 |
| Document height | 1814 px | 1581 px |

Fixes: a new cropped asset (`website/images/app/proof-trend-dark.{webp,png}`, 640×622 —
chart panel and legend only, no status bar, nav bar, or clipped period chips), and six grid
tracks at the desktop breakpoint so five cards fill two rows with no orphan. The crop is
also legible: legend text lands at ~11 px instead of ~4 px, and the dated axis
(Jun 25 → Jul 21) now carries the 32-day span on its own.

Generated by `assets-staging/make-proof-crop.py` from `61-dark-trend.png` — that directory is
gitignored because the source captures contain real health data, so the script ships alongside
`make-app-images.py` there rather than in the repo. No clean
light-mode trend capture exists — the two staged candidates are the Profile screen (with a
real email in it) and a dashboard caught mid-refresh. If `be-16` wants a light figure here,
it needs a new capture.

**3. Asset hygiene.** The image was a bare `.webp` with no fallback and no `loading`
attribute despite sitting below the fold. Now a `<picture>` with a PNG fallback,
`loading="lazy"`, `decoding="async"`, and intrinsic `width`/`height`. Dead
`.cta-panel .install-steps` rule removed — install steps no longer live in the hero.

**Note the "no new images" criterion was broken deliberately.** It was written to stop
stock photography and third-party requests, not to force a bad asset. One local crop of an
image already in the repo is the intended spirit; no new fonts, scripts, or external
requests were added.

**Verified after fixes:** no horizontal overflow at 390 or 1280; lead at 47ch; H1 three
lines at 390 (26.4 px — type scale is `be-16`'s call); WebP served with PNG available;
`#play-link` / `#testflight-link` hrefs and ids untouched by the diff.

**Left for later, deliberately**

- **Founder note — written 2026-07-26 from the owner's own account, now live.** Raviv Shweid,
  diagnosed with high cholesterol, quoted **$3,000** by a private program, built the version
  that runs daily instead. The price detail is the strongest line on the page: concrete,
  human, and it explains the product's existence without a single claim to defend.

  Two things the owner said were **deliberately not shipped**:

  1. *"Nothing on the planet today can create this perfect closed cycle loop."* An
     unfalsifiable superlative about every competitor on earth. The defensible version of the
     same idea is already the page's spine — labs and a plan in, a daily number out — and it
     persuades a skeptic, which a superlative does not.
  2. *"High cholesterol to normal levels in 13 days."* The strongest proof the product has and
     the most dangerous sentence on the page. It is a clinical biomarker outcome, not body
     composition, so it reads as "this app treats a condition" — a claim with regulatory
     weight that an n=1 result cannot carry unqualified.

     **The owner's own lab values, supplied 2026-07-26, do not support "normal levels."**
     From the app's Cholesterol trends, Jun 16 → Jun 29 2026 (13 days):

     | Marker | Before | After | General adult target | In range after |
     |---|---|---|---|---|
     | Total cholesterol | 225.6 | 173.1 | < 200 | yes — crossed in |
     | LDL | 170 | 118.5 | < 100 | **no** |
     | Triglycerides | 60 | 60 | < 150 | already in |
     | HDL | 44 | 43 | ≥ 40 | in, flat |

     Total crossed into range; LDL fell 51.5 points but is still above target. So the honest
     line reports both and says LDL is not there yet — which is *more* persuasive, because a
     page that concedes an unfinished number reads as reporting rather than marketing. Not
     cherry-picked: in this 13-day window TG and HDL were flat, so quoting total and LDL is the
     whole story. (The larger HDL decline, 57 → 44, happened between Jan 2024 and Jun 2026,
     outside the window.)

     Staged in `index.html` with real numbers. **One clause still missing:** whether medication
     changed in that window. A 52-point LDL drop in 13 days invites "were you on a statin?", and
     shipping without the answer implies the app did it alone. Both variants are written into
     the comment; the owner picks one and it goes live in a single edit.

  **Layout caveat:** the founder note added roughly five lines to the proof card, so row 1 at
  1280 is taller than the 622 px measured before it. Not re-measured — `be-11` owns card
  stretch and inherits this.
- **Cache token drift.** `index.html` requests `styles.css?v=20260726be09` while
  `privacy.html`, `clinic/index.html`, and ~160 help pages still request `…be10` for a file
  whose content has changed. Harmless today because every changed rule is index-only, but
  `be-11` should move all pages to one token (ideally a content hash) bumped in one place —
  `gen-help-locales.mjs` `CSS_VER` plus the three hand-written pages.
- **Seven inline links below 44 px** tap height (footer, `cta-note`, privacy link). Inline
  prose links are conventionally exempt and this is pre-existing, but `be-11` owns the
  footer and should decide.
- **Five cards in a rigid grid** is a structural smell. The six-track span rule is tuned to
  an odd card count and will need revisiting the moment a card is added or removed. `be-11`
  owns real page structure; a narrative page probably should not be a card grid at all.
- **A dark chart on a light page** is now a deliberate, bordered figure rather than a
  mismatched screenshot, but `be-16` should confirm it fits the final visual direction.

**Evidence caveat:** full-page CDP captures tiled the viewport again, the same IDE panel
limitation hit during the `be-10` review. Layout claims above come from measured
`getBoundingClientRect` values, not screenshots.

## Agent checklist

- [x] Status → in_progress
- [x] Every claim verified or marked `TODO(owner)` — nothing invented
- [x] Acceptance criteria above
- [x] Status → `needs-review` with evidence attached — **do not mark done**
- [x] Update `prompts/backend/README.md` table
