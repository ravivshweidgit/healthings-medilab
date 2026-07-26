# be-13 — Privacy policy page

**Status:** done — Phase A and Phase B both shipped 2026-07-26
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
2. **"Last updated: July 3, 2026" is buried** as the last sentence of the hero `.lead` (line 37),
   not in the Summary section as this draft originally said. On a policy page the effective date is
   a field, not the tail of a paragraph about being local-first.
3. **English only.** The app ships in 10 languages and the help site is generated in 10, but the
   privacy policy exists only in English. For EU and Israeli users a policy has to be intelligible
   to the person consenting.
4. **Terminology drift — but only in two of three places.** Re-checked against the app on
   2026-07-26, and the original instruction here ("replace mentor with clinic throughout") was
   wrong and would have broken correct copy. **Mentor is still live product language** for the AI
   coach personas: the app ships a Mentors strip, `userMentorGender`, `getMentors()`,
   `ActiveMentorIcons`, and a `mentor-voice-gender` help article in all 10 locales. What changed is
   the *clinician* role, which is now called clinic. So:

   | Line | Text | Verdict |
   |---|---|---|
   | 84 | "Clinic mentor chat and rule suggestions" | **Change** → "Clinic chat and rule suggestions" — clinician-side feature |
   | 114 | "when you use AI coach or mentor chat" | **Keep** — this is the in-app AI mentor, current product language |
   | 147 | "as features evolve (e.g. optional mentor sync)" | **Change** → "optional clinic sync" — written when mentor meant clinician |

   Do not run a blanket find-and-replace on this page.
5. **Deletion is email-only** — being fixed by be-15; make sure the two batches do not collide.
6. **Cache-token drift left by be-16 — found 2026-07-26, fix it in this batch.** `be-16` modified
   the shared `styles.css` and `tokens.css` and bumped only `index.html` to `?v=20260726be16`.
   `privacy.html` and all 160 generated help pages still request `?v=20260726be11`. Same files, two
   cache keys — a returning visitor who cached the pre-be-16 stylesheet under the `be11` key keeps
   getting it everywhere except the landing page. Today the visible damage is near zero because
   be-16's shared-scope edits were token swaps that render identically, but the trap is live: the
   next change to a shared rule will silently not reach privacy or help. Bump `privacy.html` and
   `CSS_VER` in `website/scripts/gen-help-locales.mjs` to one common token and regenerate.
7. ~~**The contact address is the OTP robot.**~~ **Fixed 2026-07-26 — no longer this batch's work.**
   All three email links pointed at `otp@healthings.ai`, the mailbox the API authenticates as to send
   login codes, and the page had to apologize for it in prose. The owner created
   `support@healthings.ai`; all four site occurrences were swapped the same night. Kept here only so
   the anchor work below is not written against stale copy.

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
- Once `#clinic-sharing` exists, upgrade the landing page's local-first band to point at it.
  `website/index.html` currently links to bare `privacy.html` because the anchor did not exist when
  be-16 shipped, and that band is the one place a reader asks "what exactly leaves my phone".
- Add a short "On this page" list of those 10 links directly beneath the summary paragraph.
- Pull the effective date out of the summary into its own line under the H1:
  `<p class="doc-date">Last updated 3 July 2026</p>`.
- Replace "mentor" with "clinic" throughout, except where it names the clinic-side chat feature
  precisely. Cross-check against the language policy's always-English glossary.
- Coordinate with be-15: that batch replaces the `#deletion` body with a link to `/account/` and
  adds the patient web view as a second, opt-in upload reason. If be-15 has already shipped, leave
  that section alone here.

### Contact address — done 2026-07-26, do not re-litigate

`support@healthings.ai` is live and receives. Swapped in four places:

| File | Where |
|---|---|
| `website/privacy.html` | health-data warning, `#deletion`, `#contact` |
| `website/index.html` | footer |
| `server/PLAY-CONSOLE-INTERNAL.md` | data-safety deletion row, store-listing contact email |

The health-data warning no longer has to explain the address; it now names what not to send and
points at clinic sharing instead.

`MAIL_FROM` and `SMTP_USER` stay `otp@healthings.ai` and must not be changed. The SMTP password in
`server/.env` belongs to that mailbox, so sending as anything else would need send-as permissions
for no benefit. The split is deliberate: `otp@` sends to machines, `support@` receives from humans.

Still open, owner-side and not blocking this batch:

- The **Play Console** listing and data-safety form still show `otp@` in Google's UI. The repo doc is
  updated; the console is not. Public on the store page.
- `privacy@healthings.ai` as a second alias to the same inbox. Free, conventional for a health
  product, and keeps a GDPR-style request from depending on a support queue.

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
page into 10 files for this.

**Mechanism — corrected 2026-07-26.** The original line here said "based on the `?lang=` parameter
or the `Accept-Language` header". `Accept-Language` is not available: `healthings.ai` is nginx
serving static files off disk (`server/scripts/deploy-website.sh`), with no application layer to
negotiate on. Build it as progressive enhancement instead:

- Emit all 10 localized summaries into `privacy.html` as sibling blocks, each carrying its own
  `lang` and, for `he`/`ar`, `dir="rtl"`. English is the one that renders by default.
- A small inline script picks a locale from `?lang=` first, then `navigator.language`, and reveals
  that block instead of the English one. Unknown or absent → English, unchanged.
- No JS means the English summary, which is what the page shows today. Nothing regresses.
- Only English is indexed. That is correct for a legally operative document — do not add hreflang
  here, and do not let a crawler treat a machine translation as the policy of record.
- The app should append `?lang={locale}` when it opens this page, so a Hebrew user arrives at the
  Hebrew summary. That is the whole point of the feature and it is the part most likely to be
  forgotten; see the sharing-screen note below.

Accept a brief English-then-localized swap on first paint. Do not try to hide the page until the
script runs — a privacy policy that starts blank is worse than one that starts in English.

**Related and higher priority:** the most important consent copy is not on this page at all — it is
the in-app sharing screen at the moment of approval, which the language policy already localizes.
Verify that copy matches the promises here.

## Suggested order — ship A before starting B

**Phase A — structure and hygiene.** Anchors, TOC, effective date, the two terminology fixes, the
`CSS_VER` bump, and the landing-page link upgrade to `#clinic-sharing`. All mechanical, all
low-risk, all independently valuable. The anchors alone unblock the app linking a user straight to
the consent section. Mark this reviewable on its own.

**Phase B — localized summary.** Ten translations plus the reveal script. Larger, and it is the
part where a wrong word is a consent problem rather than a layout problem. Do not start it until
Phase A is reviewed.

If time runs out, Phase A shipped and Phase B unstarted is a good outcome. Phase B half-done — some
locales translated, others falling back silently — is not.

## Acceptance criteria

Phase A:

- [x] All 10 sections have stable `id` anchors and the "On this page" list links to them
- [x] `privacy.html#clinic-sharing` scrolls to the right section
- [x] `website/index.html` local-first band points at `privacy.html#clinic-sharing`
- [x] Effective date visible under the H1, not trailing the hero lead
- [x] Lines 84 and 147 changed; line 114 left alone
- [x] `privacy.html` and `gen-help-locales.mjs` `CSS_VER` share one token; 160 pages regenerated
- [x] Prose measures ≤68ch at 1600px (inherited from be-10; it was ~120 characters)
- [x] Mobile (~390): the TOC does not push the summary below the fold
- [x] No policy commitment changed in substance

Phase B: **not started** (waits for Phase A review)

- [ ] All 10 summaries present; `?lang=he` and `?lang=ar` render RTL
- [ ] JS disabled → English summary, page otherwise identical to today
- [ ] Unknown `?lang=` value → English, no console error
- [ ] No hreflang added to this page

## Out of scope

- Rewriting the policy's substance or tone
- Translating anything beyond the summary block
- Cookie banner (the site sets no cookies; do not add one)
- Changing `MAIL_FROM` / `SMTP_USER`, or any email address on the page

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

## Opus 5 review outcome — Phase A (2026-07-26)

**Accepted with two fixes applied during review.** The diff is faithful to the draft and unusually
disciplined: 168 files, and every one of them is either the page itself, a cache token, or the two
spec docs. Nothing drifted.

Verified independently rather than from Auto's artifacts (`tmp/be-13-review/opus-*.{mjs,json,png}`):

| Criterion | Result |
|---|---|
| 10 `id` anchors, TOC links resolve | 10/10, zero broken hrefs |
| `#clinic-sharing` lands on the right section | yes |
| Effective date under H1 | yes, out of the hero lead |
| Line 84 / 147 changed, 114 kept | correct — `mentor chat` survived |
| One cache token | 328/328 references on `20260726be13`, no `be11`/`be16` left |
| Horizontal overflow | 0px at 390 / 820 / 1280 / 1600 |
| Prose measure | 587px at 1280 and 1600 — capped by `--measure` |
| TOC does not bury the summary at 390 | summary at y=459, TOC at y=745 |
| Emails | untouched |

### Fixed during review

1. **No `scroll-margin-top` on the anchored headings.** Every anchor landed its `h2` at exactly
   `top: 0` — ascenders clipped by the viewport edge, no hint that content exists above. Auto's own
   `deeplink-metrics.json` recorded `"top": 0` and read it as success; it is the symptom. This
   matters more here than on a normal page because the app will open `#clinic-sharing` *at the
   moment of consent*, and a heading welded to the top edge reads as a broken render. Added
   `.prose h2[id] { scroll-margin-top: 1.5rem }` — headings now land at 24px with a sliver of the
   prior section visible, which is what tells a reader they jumped mid-document.
2. **`.doc-toc ol` used `padding-left`.** Physical property on a site that generates RTL pages.
   Free to fix now, invisible until someone reuses `.doc-toc` on a Hebrew page. Now
   `padding-inline-start`.

Both are CSS-only and needed no token bump, because be-13 has not been deployed — `20260726be13`
has never been served, so it is still safe to change what it points at.

### Cache tokens now need a rule

Auto did what the draft asked and unified everything, but the token moved **backwards**:
`index.html` went `be16` → `be13`. It works — a different string is still a cache bust — but two
keys are now burned with different stylesheet states, and batch names do not sort, because **be-16
shipped before be-13**. Re-emitting `be16` for a be-16 follow-up would serve stale CSS to everyone
who loaded the landing page tonight.

Documented at the `CSS_VER` declaration in `gen-help-locales.mjs`. Next bump should be a date plus
a letter (`20260726d`), not another batch number.

### Evidence defect — regenerate before trusting

`privacy-390.png` shows text clipped off the right edge and looks like a serious mobile overflow
bug. **It is not.** It was captured with a clamped headless window, so it is a 390-wide crop of a
wider render — the same trap documented in be-16's review notes. Measured overflow is 0px at every
width. `opus-privacy-390.png` is the truthful version. Delete or replace the old one; an artifact
that looks like a regression is worse than no artifact.

Auto's `capture-deeplink.mjs` used puppeteer's `defaultViewport`, which is correct, so the 1280
shots are trustworthy. Whatever produced the 390 was not the same path.

### Phase B is still the right call to defer

Nothing in Phase A constrains it. The one thing worth deciding before it starts: the app must
append `?lang={locale}` when opening this page, or the localized summary is unreachable for the
users it exists for. That is an app change, not a website change, and it belongs in the same batch.

## Phase B outcome (2026-07-26, built by Opus)

Shipped. **Website-only — the app change this draft demanded is not needed**, and the reason is
worth recording because it was asserted twice before anyone checked.

**The app never opens `privacy.html`.** The wizard's `privacyLink` string reads "How it works &
privacy" in ten languages, but its `href` is `helpUrl(langCode, 'quick-start-welcome')` — the help
article, not the policy. Grepping `app/` for `privacy.html` returns nothing. So there is no link to
append `?lang=` to.

The real entry points are the two on the landing page and, far more importantly, the **Play Store
listing**, where the privacy policy URL is a required field. Someone browsing Play in Hebrew taps
"Privacy Policy" and lands here — and `navigator.language` already handles them with no app
involvement at all. `?lang=` survives as an override and a test handle. No APK, no phone test.

### Mechanism — a JSON island, not ten hidden blocks

The draft said to emit all ten summaries as sibling blocks and un-hide one. Built it as a single
swap instead:

- `PRIVACY_SUMMARY` in `help-locale-content.mjs` — one translation surface, next to the help copy.
- `gen-privacy-summary.mjs` injects it into `privacy.html` between markers as
  `<script type="application/json">`, and refuses to run if a locale is missing a field.
- Four elements carry `data-i18n`; an inline script rewrites them and sets `lang`/`dir`.

Why this rather than hidden siblings: the policy of record is the English text, and this way that
is the *only* summary in the markup. Nothing is hidden, so nothing can fail to un-hide, and a
crawler cannot mistake a machine translation for the policy. Ten `hidden` blocks would have meant
ten copies of a consent document in the source, one keystroke away from all being visible.

### Verified — negatives matter more than positives here

| Case | Result |
|---|---|
| `?lang=` for all 9 locales | correct heading, lead, summary, note |
| `navigator.language: de-DE`, no query | German, no query string needed |
| `he` / `ar` | `dir="rtl"`, right-aligned, no overflow |
| **no JavaScript** | English, note hidden, page identical to authored |
| **unknown `?lang=zz`** | English |
| **empty `?lang=`** | English |
| **corrupt JSON island** | English — parse failure returns early |
| Overflow at 390 | 0px in every locale |
| `#summary` anchor | present in every case |
| `?lang=he#clinic-sharing` | lands at `top: 24`, scroll-margin intact |

Evidence: `tmp/be-13-review/phaseb-*.{mjs,json,png}`.

### Cache token scheme changed

`20260726d`, and it only moves forward. Batch-name tokens are retired — they do not sort, which is
how be-16 shipped before be-13 and drove the token backwards. `be11`, `be13` and `be16` have all
been served with different stylesheets behind them and must never be re-emitted; noted at the
`CSS_VER` declaration.

### Known seam, left alone deliberately

In a localized render the summary heading is translated but the "On this page" list below it stays
English. That is correct rather than sloppy — the list navigates nine English sections, and
translating only its first entry would promise more than the page delivers. Revisit only if the
full policy is ever translated.

## Agent checklist

- [x] Status → in_progress
- [x] Checked whether be-15 already rewrote `#deletion` (still email-only; left alone)
- [x] Left the email addresses alone — the `support@` swap already shipped on 2026-07-26
- [x] Did **not** blanket-replace "mentor" (line 114 is correct as written)
- [x] Changes match this draft only — Phase A only; Phase B not started
- [x] Regenerated help pages if `CSS_VER` moved (`20260726be13`)
- [x] Smoke criteria above
- [x] Status → needs-review (evidence in `tmp/be-13-review/`) — **do not mark done**
- [x] Update `drafts/README.md` table

## Do not deploy

The owner runs `server/scripts/deploy-website.sh`. Leave the VPS alone.
