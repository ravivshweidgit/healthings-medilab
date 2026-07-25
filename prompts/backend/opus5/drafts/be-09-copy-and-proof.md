# be-09 — Landing copy and proof

**Status:** ready
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

- [ ] Exactly one product name in running prose across `website/index.html`
- [ ] No unsupported outcome or efficacy claim anywhere on the page
- [ ] Every factual claim traceable to the repo, the app, or an explicit `TODO(owner)`
- [ ] H1 ≤ 60 characters and names the lab/nutritionist → daily target loop
- [ ] *How to install* no longer in the hero; store links and their ids still work
- [ ] Proof section present, with any unverifiable element left as a visible TODO
- [ ] Desktop (~1280) and mobile (~390): no layout regression from `be-10`; prose ≤ 68ch
- [ ] No new images, fonts, scripts, or third-party requests

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

## Agent checklist

- [ ] Status → in_progress
- [ ] Every claim verified or marked `TODO(owner)` — nothing invented
- [ ] Acceptance criteria above
- [ ] Status → `needs-review` with evidence attached — **do not mark done**
- [ ] Update `drafts/README.md` table
