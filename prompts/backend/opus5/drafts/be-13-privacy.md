# be-13 — Privacy policy page

**Status:** ready
**Model to implement:** Auto / Composer
**Authored by:** Opus 5 (website UX pack)
**Findings:** W15 (no anchors), W16 (last-updated buried), W17 (English-only), W18 (terminology drift)
**Depends on:** be-10 (tokens). Coordinate with **be-15**, which rewrites the deletion section.

## Worth keeping

This page is genuinely good and unusually honest for an alpha: 633 words, a 3-minute read, plain
language, and it states the local-first promise in the first sentence. It refuses health data by
email. It admits the app is not a medical device. **Do not rewrite it into legalese.** Everything
below is presentation and reachability, not tone.

## Problem

1. **No anchors.** All 10 `<h2>` elements lack `id`, so nothing is deep-linkable. The app's sharing
   screen has no way to link a user straight to "Optional clinic sharing", which is the one section
   that matters at the moment of consent.
2. **"Last updated: July 3, 2026" is buried** mid-paragraph inside the summary. On a policy page the
   effective date is a field, not a sentence.
3. **English only.** The app ships in 10 languages and the help site is generated in 10, but the
   privacy policy exists only in English. For EU and Israeli users a policy has to be intelligible
   to the person consenting.
4. **Terminology drift.** The page says "mentor" (e.g. "Clinic mentor chat", "optional mentor sync")
   while the app has removed the mentor role from sign-in and the product now says *clinic*.
5. **Deletion is email-only** — being fixed by be-15; make sure the two batches do not collide.

## Goal

Same words, easier to navigate, reachable from the moment of consent, and consistent with what the
product now calls things.

## Files to touch

- `website/privacy.html`
- `website/styles.css` (only if the TOC needs a class)
- Do **not** touch: the substance of the policy commitments

## Design rules (from Opus)

- A policy page is a reference document. Optimize for *finding a section*, not for reading top to
  bottom.
- The TOC is quiet: a plain list under the summary, not a sidebar and not sticky. Two and a half
  screens does not justify persistent navigation.

## Implementation notes

- Add a slug `id` to each `<h2>`: `#summary`, `#on-device`, `#clinic-sharing`, `#server-data`,
  `#third-parties`, `#permissions`, `#children`, `#deletion`, `#changes`, `#contact`. These become a
  public contract — the app will link to them, so do not rename them later.
- Add a short "On this page" list of those 10 links directly beneath the summary paragraph.
- Pull the effective date out of the summary into its own line under the H1:
  `<p class="doc-date">Last updated 3 July 2026</p>`.
- Replace "mentor" with "clinic" throughout, except where it names the clinic-side chat feature
  precisely. Cross-check against the language policy's always-English glossary.
- Coordinate with be-15: that batch replaces the `#deletion` body with a link to `/account/` and
  adds the patient web view as a second, opt-in upload reason. If be-15 has already shipped, leave
  that section alone here.

## Decided: localize the summary only, keep the full policy in English

Translate the **summary block** into the 10 existing locales. Leave the remaining nine sections in
English, with one localized line directly beneath the summary: *"The full policy is available in
English below."*

Why not the whole thing: a privacy policy is a legally operative document, and machine-translating
consent language for a health product across 10 languages creates real liability with no lawyer
reviewing the output. Why not English-only: the substance of the promises — local-first, nothing
uploaded without your approval, revoke at any time — has to be intelligible to the person
consenting, and that substance is entirely contained in the summary.

Scope check: roughly 120 words × 10 locales instead of 633 × 10 with legal review.

Implementation: the summary strings belong in `help-locale-content.mjs` alongside the other
localized copy, so there is one translation surface rather than two. Do **not** fork the privacy
page into 10 files for this — inject the localized summary into the single page based on the
`?lang=` parameter or the `Accept-Language` header, defaulting to English.

**Related and higher priority:** the most important consent copy is not on this page at all — it is
the in-app sharing screen at the moment of approval, which the language policy already localizes.
Verify that copy matches the promises here.

## Acceptance criteria

- [ ] All 10 sections have stable `id` anchors and the "On this page" list links to them
- [ ] `privacy.html#clinic-sharing` scrolls to the right section
- [ ] Effective date visible under the H1, not inside a paragraph
- [ ] No occurrence of "mentor" that contradicts current product language
- [ ] Prose measures ≤68ch at 1600px (inherited from be-10; it was ~120 characters)
- [ ] Mobile (~390): the TOC does not push the summary below the fold
- [ ] No policy commitment changed in substance

## Out of scope

- Rewriting the policy's substance or tone
- Localization — see "Needs a decision"
- Cookie banner (the site sets no cookies; do not add one)

## Review by Opus 5 (after Auto marks done)

**Evidence to capture**

- Screenshots at 1280 and 390
- A deep-link test: `privacy.html#clinic-sharing` landing on the right section
- The localized summary rendered in Hebrew and in Arabic

**Judgment calls to check**

- Does the TOC help, or does it **push the summary down**? The summary is the most valuable content
  on the page; navigation must not outrank it, especially at 390.
- Is the "full policy follows in English" signposting clear enough that a Hebrew reader knows what
  they have and have not been given?
- Does the page still read as **honest and plain**? The restructure must not make it feel legalistic.
  If it now reads colder, say so — the tone is the page's main asset.
- Does the localized summary make any promise the English body contradicts? Compare them line by
  line; this is a consent document.

## Agent checklist

- [ ] Status → in_progress
- [ ] Checked whether be-15 already rewrote `#deletion`
- [ ] Changes match this draft only
- [ ] Smoke criteria above
- [ ] Status → done
- [ ] Update `drafts/README.md` table
