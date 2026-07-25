# be-11 — Landing page

**Status:** ready
**Model to implement:** Auto / Composer
**Authored by:** Opus 5 (website UX pack)
**Findings:** W4 (logo), W5 (store badges), W6 (no navigation), W7 (stretched cards), W3 (tap targets), W8 (install steps outrank the pitch)
**Depends on:** be-10 (tokens)

## Repo is canonical — the live site is one deploy behind (resolved)

The live H1 reads "A full metabolic OS" while the repo reads "Understand your body, hit your
targets". This is **not** an out-of-band edit: commit `61e76a2` (2026-07-24, *"patient-friendly
landing H1 + readable help layout"*) made that change deliberately, and the site has not been
deployed since. Deploy is `git pull --ff-only` on the VPS followed by
`bash server/scripts/deploy-website.sh`, so the repo is authoritative by construction.

The same staleness explains the help pages serving `styles.css?v=20260724e4` while the generator
emits `20260724lang10`.

**Implication:** deploying this batch *applies* the intended copy rather than reverting anything.
No question to raise. Expect the H1 and lead to change on the live site as a side effect of the
first deploy after this batch.

## Problem

Measured live at 1280×900 and 390×844:

1. **The logo renders as a white rectangle.** `assets/brand-logo.png` has an **opaque white
   background** (corner pixel `rgba(255,255,255,255)`), sitting on the sky-blue gradient. It reads
   as an unfinished asset — the single most damaging detail on the page.
2. **Both store badges are distorted, in different ways.** `.store-badge-link` is a 166×49 box with
   `overflow: hidden`, but the Play badge is a 646×250 image displayed at 220×65 and then
   `transform: scale(1.42)` — so it is zoomed and cropped. The TestFlight badge is a local 270×80
   SVG with `object-fit: cover`. The Play badge is also **hotlinked from `play.google.com`**, which
   is a third-party request on every page load of a health site that publishes a privacy policy.
3. **No navigation exists.** No header, no way to reach help, the clinic portal, or sign-in without
   scrolling to the footer.
4. **Desktop cards are stretched to equal height.** `.cards-grid .card { height: 100% }` forces all
   three to 685px; "Who it's for" has four bullets and ~500px of empty white below them.
5. **Five mobile links are 15px tall** — "Alpha tester guides", "otp@healthings.ai", "Help & setup
   guides", "Privacy policy", "Clinic login". The minimum is 44px.
6. **Install mechanics outrank the pitch.** The CTA panel is 454px tall on mobile and 241px of that
   (53%) is "HOW TO INSTALL". The value proposition ("One system, not four apps") starts at y=814 —
   below the 844px fold. A visitor decides before seeing why the product exists.

## Goal

Above the fold on mobile: brand, one-line pitch, two clean store badges, and the first reason to
care. Install mechanics move below, where they belong for someone who has already decided.

## Files to touch

- `website/assets/brand-logo.png` (re-export with transparency, or add an SVG)
- `website/images/` (add a locally hosted Play badge)
- `website/index.html`
- `website/styles.css`
- Do **not** touch: help pages, clinic pages

## Design rules (from Opus)

- Keep the sky gradient and the centered single-column hero. This page's quiet confidence is an
  asset for a health product; do not turn it into a generic SaaS landing page with feature grids.
- Store badges are **vendor artwork** — never crop, zoom, or `object-fit: cover` them. Give each a
  box matching its native aspect ratio and let it sit at its natural size.
- The new header is chrome, not a hero element: small, quiet, no background fill.

## Implementation notes

**Logo.** Re-export `brand-logo.png` with a transparent background at 2x (target display 300px wide,
so ≥600px source). An SVG is better if the source artwork exists. Keep the `?v=` bump.

**Badges.** Download the official Play badge to `website/images/` and reference it locally — this
removes the third-party request and the hotlink fragility. Then:

```css
.store-badge-link { aspect-ratio: 270 / 80; overflow: visible; }
.store-badge { width: 100%; height: 100%; object-fit: contain; }
```

Delete the `#play-link .store-badge { transform: scale(1.42) }` rule entirely. Both badges then
render at their native proportions at the same visual weight.

**Header.** Add above `.hero`:

```html
<header class="site-nav">
  <a class="site-nav-brand" href="/">HEALTHINGS.AI</a>
  <nav>
    <a href="/en/help/">Help</a>
    <a href="/clinic/">Clinic sign in</a>
  </nav>
</header>
```

Flex, `justify-content: space-between`, links at `--tap-min` height. When be-15 ships, "Clinic sign
in" becomes "Sign in" pointing at the unified `/signin/`.

**Card stretch.** Replace `height: 100%` with `align-content: start` on the card body, or let the
grid rows size naturally (`align-items: start` on `.cards-grid`). Ragged card bottoms are correct
here — equal heights only make sense when the content is genuinely parallel.

**Tap targets.** Apply `.u-tap` from be-10 to the footer links and the "Alpha tester guides" link.
Footer links also currently render in `--muted`, so they do not look clickable; give them `--accent`.

**Install steps.** Move `.install-steps` out of `.cta-panel` and place it **after** the three value
cards, as its own section titled "Installing the alpha". The CTA panel keeps the badges and the
single "Internal testing" note. Expected result: the first value card moves above the mobile fold.

**Link hygiene.** `href="help/"` (line 71) points at the legacy redirect directory; change to
`/en/help/`.

## Acceptance criteria

- [ ] Logo has no white box on the gradient at both breakpoints
- [ ] Neither store badge is cropped or scaled; no request to `play.google.com` on load
- [ ] Header present with Help and Clinic sign in, both ≥44px tall on mobile
- [ ] Desktop (~1280): the three cards have natural, unequal heights and no large empty regions
- [ ] Mobile (~390): the first value card begins above y=844
- [ ] Every footer link is ≥44px tall and rendered in `--accent`
- [ ] No regression: store links still open the correct Play / TestFlight URLs

## Out of scope

- Rewriting the marketing copy — the H1 and lead were settled in `61e76a2`; leave the words alone
- Screenshots or product imagery — worth doing later, but not in this batch
- Localizing the landing page

## Review by Opus 5 (after Auto marks done)

**Evidence to capture**

- Full-page screenshots at 1280 and 390
- A close crop of the logo sitting on the sky gradient, at 2x
- Network panel confirming zero requests to `play.google.com`
- The y-coordinate of the first value card at 390 width

**Judgment calls to check**

- Does the logo now read as **intentional** — correct optical weight next to the alpha badge, not
  just "no longer boxed"?
- Do the two store badges read as **peers**? Equal visual weight, neither cropped, neither
  dominating. This is the pair a visitor chooses between.
- Does the new header behave as chrome, or does it compete with the hero for first attention?
- With the install steps moved out, does the CTA panel still feel **complete**, or does it now look
  thin and unfinished? If thin, the fix is spacing, not putting the instructions back.
- Do the ragged card bottoms read as deliberate, or as a broken grid? Report honestly — if they look
  broken, equal heights with better-balanced content is the fallback.

## Agent checklist

- [ ] Status → in_progress
- [ ] Changes match this draft only
- [ ] Smoke criteria above
- [ ] Status → done
- [ ] Update `drafts/README.md` table
