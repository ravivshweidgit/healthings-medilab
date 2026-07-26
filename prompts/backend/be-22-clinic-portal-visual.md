# be-22 — Clinic portal visual rebuild (2026 level)

Status: **needs-review** — implemented 2026-07-26 (rescoped leftovers: workspace tokens/dark, skeletons, money-led balance)
Date: 2026-07-26
Builds on: be-10 (tokens), be-16 (visual direction), be-14 (workspace chrome + skeleton), be-21 (action feedback — must not regress), **be-25 (panel IA, home-page tokens, dark, i18n plumbing)**, **be-26 (locale tables)**

## What be-25 already did (do not repeat)

be-25 rewrote `website/clinic/index.html` and created `clinic-portal.css` from scratch. Because it was
authoring the CSS anyway, tokenizing it there was free, so five of this batch's six problems are
closed:

| Was in be-22 | Status |
|---|---|
| 1. Alpha billing scaffolding on screen | **Done** — behind `?dev=1` (`sessionStorage` keeps it across reload) |
| 2. Zero tokens, no dark mode (home page) | **Done** — `var(--…)` only, `<html class="theme-auto">`, verified dark by CDP screenshot |
| 3. Eight cards in a 720px column | **Done** — worklist table first, My clinic collapsed, shell widened to `--wrap-wide` |
| 4. Revoke is the loudest control | **Done** — `Open workspace` is the only filled control; revoke is outline + `--portal-err-ink` |
| 6. No patient search | **Done** — search + status chips + three sorts + 25/page |
| 5. **No skeleton** | **Still open** — this batch |
| 6b. **Raw token counts as the unit** | **Still open** — this batch, and it is the interesting part |

Also settled by be-25, against this batch's earlier assumption: the portal is **localized**, and
`--danger` cannot be used for text on dark because `tokens.css` does not flip it (use
`--portal-err-ink`).

## Problem

Asked directly whether `https://healthings.ai/clinic/index.html` looks like a 2026 clinic product, the
answer is no, and be-21 established that none of it is a feedback problem — that is now solved and
deployed. What remains is that **the portal never received the design system.** Measured:

| File | `var(--…)` uses | Hardcoded hex | Opts into dark |
|---|---|---|---|
| `website/index.html` + `styles.css` | many | — | yes (`class="theme-auto"`) |
| `website/clinic/clinic-workspace.css` | 135 | 59 | no ← **this batch** |
| `website/clinic/index.html` + `clinic-portal.css` | tokens only | status tints only, commented | yes (be-25) |

`tokens.css` says why, in its own comment: dark mode is opt-in *because* "the clinic portal and the
patient workspace … still carry hardcoded light surfaces — flipping tokens globally would darken a
clinician tool that nobody has checked." That was the right call. This batch is the check.

Six problems, in descending order of how much they cost the product:

1. **Alpha billing scaffolding is on screen for clinicians.** "Attach test card (alpha)", "Manual
   token pack", "Usage debits payer credits (Stripe later)". A clinician reading "alpha" and "Stripe
   later" next to a payment control learns the product is not finished. This is the single most
   damaging thing on the page and the cheapest to fix.
2. **Zero tokens, no dark mode.** 36 hardcoded hex values; the rest of the site flips, this does not.
3. **Eight identical cards in one 720px column.** Clinic identity, invite, credits, usage, pending,
   outgoing, linked — all the same weight. It reads as a settings form, not a dashboard. The patient
   list, which is the actual job, is last.
4. **Destructive action is the loudest control on every row.** `Revoke access` is solid red and
   outweighs `Open workspace`, which is what a clinician clicks all day.
5. **No skeleton, no search.** be-14 gave the *workspace* a loading skeleton; this page shows nothing
   until every one of six requests resolves. There is no way to find a patient in a long list.
6. **Raw token counts as the clinician-facing unit.** "Balance: 120 tokens", "480 tokens · 12 events".

## Scope (rescoped)

- `website/clinic/patient.html` + `clinic-workspace.css` — migrate 59 hex values to tokens, then opt
  into `theme-auto`. This is now the **main** job: it is the last light-only surface.
- `website/clinic/index.html` — **balance display only** (money-led headline). Do not restructure it
  again; be-25's IA is accepted.
- `website/clinic/clinic-portal.css` — reuse it for `patient.html`; that was always the intent behind
  extracting it.
- Skeleton loading states (be-14 reuse) on both pages.
- **Off-limits:** `clinic-workspace.js` behaviour, `clinic-api.js`, `clinic-i18n.js` locale tables
  (be-26). One additive server field only — see the "credits" reversal below; `/v1/wallet` must expose
  the pack price so the page can show money without hardcoding a rate. No schema change, no new query.

## Decisions (settled — do not reopen)

| Question | Decision | Why |
|---|---|---|
| Alpha billing controls | **Hide behind a dev flag.** Show the balance only | Owner's call, 2026-07-26. The controls are real and still needed for alpha testing — deleting them costs a workflow, hiding them costs nothing. **Shipped in be-25** |
| Clinician-facing unit | **Keep "tokens". Show money as the headline instead** | Reversed 2026-07-26 after reading `config.ts`. See below — "credit" is already taken, and the real defect is a missing denominator, not the word |
| `window.confirm` for revoke | **Keep** | be-21's reasoning stands: destructive, accessible by default, unambiguous. A custom dialog is cost without benefit here |
| Clinic portal i18n | **Reversed 2026-07-26 — the portal is localized** | Owner: "we are global, global for clinics." Plumbing in be-25, locales in be-26. Any string this batch adds must go through `t()`, never inline English |
| Portal spacing | **Inherit colour / type / radius / shadow tokens; define a portal-local spacing scale** | Standard design-system practice — tokens are brand primitives and must be consistent; density is a per-surface decision. A marketing page optimizes a first impression, an operational tool optimizes scanning and repeat use. `--tap-min: 44px` is an accessibility floor and outranks density |

### Why not "credits" (reversal, with the evidence)

The first draft said to rename the clinician-facing unit to "credits". That was wrong, and `config.ts`
says why:

```
/** Starter AI credit per account ($ pack mapped to tokens - see TOKEN_PACK_SIZE). */
TOKEN_PACK_SIZE: 100
TOKEN_PACK_PRICE_CENTS: 500
STRIPE_CURRENCY: 'usd'
```

**"Credit" is already taken, and it means money.** A credit is the $5 pack; a token is the metered
unit; the rate is 100 tokens per 500 cents, so **1 token = $0.05**. Renaming tokens to credits would
make the section title "AI credits" ambiguous between dollars and consumption, and would put the UI
into a second vocabulary for a number the ledger, the debit rows (`wallet_ledger`), and the eventual
Stripe invoice quantity all record as tokens. Cosmetic gain, reconciliation trap.

The actual defect in "Balance: 120 tokens" is not the noun — it is that **there is no denominator**.
120 of what, lasting how long? Two honest denominators already exist in the data:

1. **Money, as the headline.** 120 × $0.05 = **$6.00**. A clinic budgets in currency, not in units of
   inference. Render `$6.00` large with `120 tokens` as the precise secondary figure. Format with
   `Intl.NumberFormat(undefined, { style: 'currency', currency })` — never hand-built `'$' + n`.
2. **Work, in the usage section.** `/v1/usage/summary` returns `totalTokens` **and** `eventCount` per
   patient, so tokens-per-conversation is computable — "≈ 12 coach conversations at your recent
   average". That belongs where reconciliation happens, not in the chrome.

Word the money as worth at the current pack rate, not as a charge: the clinic is not billed $6.00, it
holds $6.00 of unused capacity. Do not imply a refund.

**This needs one additive server change**, which overrides the "no endpoint changes" line in Scope:
`getWalletForUser` already returns `tokenPackSize`, but not price. Add `tokenPackPriceCents` and
`currency` from `config` to the `WalletView` — read-only, no new query, no schema change. Do not
hardcode $0.05 in the page; the rate is configuration and will move.

## What to build

> Sections 1, 2 (home page), 3, 4 and 6 below **shipped in be-25**. They are kept for their reasoning
> and for the `patient.html` migration, which still needs the same token mapping and the same
> chip-in-dark care. Read them as reference, not as a task list.

### 1. Gate the alpha controls — DONE (be-25)

```js
// Alpha billing controls are real and still needed for testing, but a clinician
// must never see "alpha" or "Stripe later" next to a payment control.
const DEV_TOOLS =
  new URLSearchParams(location.search).has('dev') ||
  localStorage.getItem('healthings_clinic_dev') === '1' ||
  ['localhost', '127.0.0.1'].includes(location.hostname);
```

- Wrap `#simulate-card-btn` and `#load-pack-btn` in one container hidden unless `DEV_TOOLS`.
- Delete the copy "Usage debits payer credits (Stripe later)". Replace with what a clinician needs to
  know: how usage maps to the patients they sponsor.
- Keep the balance and the payment-method line visible always. The payment-method line must not read
  "auto-reload simulated in alpha" — say `No card on file` / `Card on file`.
- `?dev=1` must survive a reload, hence the `localStorage` arm. Set it when the query param is present.
- be-21's flash confirmations for these two buttons stay exactly as they are.

### 2. Migrate to tokens, then opt into dark — home page DONE (be-25); apply this mapping to `patient.html`

Replace the 59 hex values in `clinic-workspace.css` with `tokens.css` equivalents. The mapping is not
guesswork, and be-25 already validated it on the home page:

| Current | Token | Note |
|---|---|---|
| `#1a2b4a` | `var(--navy)` on headings, `var(--text)` on body | These diverge in dark — get it right per use |
| `#dde3ea`, `#eef2f6` | `var(--line)` | |
| `#666` | `var(--muted)` | |
| `#c62828`, `#c0392b` | `var(--danger)` for **fills**; a flipping ink token for **text** | be-25's finding: `--danger` does not flip in `tokens.css`, so as text on a dark surface it lands near 3:1. Reuse `--portal-err-ink` from `clinic-portal.css` |
| `#fff` on surfaces | `var(--surface)` | Inputs and selects too |
| `#f8f9fa` | `var(--surface-2)` | |
| `#3d9dd6` link text | `var(--accent-ink)` | be-10's review: `--accent` is 3.0:1 and fails AA as text |

be-21's status chips (`.chip.ok/.soon/.off/.gone`) are the one place to be careful — they are tinted
fills with matching ink, and the light tints (`#ecfdf3`, `#fffbeb`) go muddy on a dark surface. be-25
solved this with portal-local `--portal-{ok,warn,err,neutral}-{bg,line,ink}` triples redeclared under
`.theme-auto`. **Reuse those variables** rather than inventing a second set for the workspace.

Add `class="theme-auto"` to `<html>` **only after** verifying every state in dark: all four chip
states, all three `.portal-status` kinds, the inline sponsor picker, focus rings, and both `<input>`
and `<select>`. A control that stays white in dark is worse than no dark mode. Emulate with
`Emulation.setEmulatedMedia` `prefers-color-scheme: dark` rather than switching the OS.

### 3. Layout — superseded by be-25

This batch proposed two columns with patients in the main column and invite in a sidebar. **be-25 went
further and better:** one worklist table, invite as a strip above it, clinic identity collapsed. The
sidebar concern below ("does the sidebar bury the invite form?") is moot — there is no sidebar.

### 4. Row hierarchy — DONE (be-25)

`Open workspace` is the primary action and should be the only filled control on the row. `Revoke
access` becomes quiet — outline or text, `var(--danger)` ink, no red fill. Keep the danger colour;
drop the visual weight. Sponsorship controls stay secondary.

be-21's `.share-row` column layout is gone — be-25 replaced it with a table, which solves the same
problem (a shared column grid) structurally. The underlying rule still holds for the workspace: an
action group must start at the same x on every row.

### 5. Skeleton and empty states — **still open, this batch**

Reuse be-14's skeleton, including the lesson its review paid for: **hide the skeleton on every error
path**, not just on success. A clinician with no patients yet must not see an empty list over an
endless shimmer with a stale `aria-busy`. Honour `prefers-reduced-motion`.

Empty states get a next action, not bare muted text — be-25 already does this per filter
("No linked patients yet — invite someone above.").

The gap be-25 left: the worklist renders **nothing** until all six requests resolve. A skeleton of ~5
table rows belongs there, and one on the workspace.

### 6. Patient search — DONE (be-25)

Shipped as always-visible search plus status chips and sorts, rather than appearing at ≥ 8 rows.
Conditional visibility was dropped deliberately: a control that appears at row 8 teaches the clinician
it does not exist when they have 7 patients.

## Must not regress

be-21's behaviours survived be-25's rewrite and must survive this one. The original probe lived in
`tmp/be-21-review/probe-portal.mjs` and is **not in the repo** — be-25 verified equivalently by CDP
against a stubbed API, which is the pattern to follow (see be-25's Review section for the
`Page.addScriptToEvaluateOnNewDocument` + `Page.enable` gotcha). Specifically preserve:

- `sponsorChip()` text in all four states, and `daysUntil()`'s local-midnight comparison
- `withBusy()`: label, `aria-busy`, whole-group disable, and that a second click sends zero requests
- `#app-flash` **outside** the three lists and set **after** `refreshDashboard()` — this is what makes
  a confirmation survive the re-render. A layout change that moves it inside a list silently breaks it
- The inline sponsor picker, its live end date, and Cancel sending nothing
- `#name-status` next to the name field, and both credit-button confirmations
- Confirmation wording that states consequences: revoke names the snapshot purge, sponsor-off names
  who pays next

Extend the probe with dark-mode assertions: computed `background-color` of `.card`, `.portal-btn`,
`input`, `select` and all four chips must differ between schemes and stay ≥ 4.5:1 against their ink.

## Acceptance criteria

- [x] No occurrence of "alpha", "Stripe", "simulate" or "test card" without `?dev=1` — be-25
- [x] `?dev=1` restores both controls and survives a reload — be-25
- [x] Home page: zero hardcoded hex, `class="theme-auto"`, dark verified by screenshot — be-25
- [x] `Open workspace` is the only filled control on an approved row — be-25
- [x] **`patient.html` / `clinic-workspace.css`:** hex only in declared `--ws-*` / portal-tint fallbacks
      (commented), `theme-auto` on, loads `clinic-portal.css` for shared `--portal-*`
- [ ] No horizontal overflow at 390px on the workspace — owner glance
- [x] Skeleton clears on success **and** on both error paths, on worklist and workspace
- [x] Balance leads with currency from `tokenPackPriceCents`, with the token count as secondary; no
      hardcoded rate, formatted via `Intl.NumberFormat` **with the portal locale**
- [x] Usage section states tokens per conversation from `totalTokens / Σ eventCount`, and does not
      divide by zero when `eventCount` is 0
- [x] Any new string goes through `t()` with a key added to `clinic-i18n.js` — no inline English
- [ ] Lighthouse mobile accessibility 100 — owner / post-deploy

## Review evidence (2026-07-26)

- Server: `WalletView` gains `tokenPackPriceCents` + `currency` from config (no schema change)
- CSS: `clinic-workspace.css` tokenized; remaining hex confined to `:root` / dark `.theme-auto` tint decls
- Worklist: 5-row skeleton shown before `Promise.all`, cleared on success via `renderWorklist` and on
  every error path via `setWorklistLoading(false)`
- Workspace: skeleton already present (be-14); 404 / HTTP error / throw all clear it before empty main
- Balance chip: `{money} · {n} tokens` via `Intl.NumberFormat(getLocale(), { style:'currency' })`
- i18n: `balanceChip`, `balanceTokensSecondary`, `usageAvg`; `pmNone` / `usageLead` no longer say alpha/Stripe
- `npx tsc --noEmit` on server: clean; index inline script parses

## Agent checklist

- [x] Status → in_progress / needs-review
- [x] Do not self-accept
- [x] Do not commit or deploy unless asked


## Review by Opus 5

Checkboxes cannot settle these:

- **Does showing money make the alpha look more finished than it is?** The clearer the balance reads,
  the more it implies billing works. Stripe is not wired — `TOKEN_PACK_PRICE_CENTS` is a configured
  rate, not a charge that has ever happened. If `$6.00` reads as a real account balance, it may need a
  qualifier the owner is comfortable with.
- **Is a quiet Revoke too quiet?** It is a consent action with a real consequence — be-17's purge.
  Confirm it still reads as consequential, and that the confirm dialog carries the weight the button
  gave up. be-25 made it outline-only, so this question is now live rather than hypothetical.
- **Does a dark clinician tool help or hurt in a clinic?** Exam rooms are bright and many clinicians
  work off a shared machine whose OS theme they did not choose. `theme-auto` follows the OS with no
  override. If clinicians want to pin light, that is a small addition to the be-25 picker row.

## Related

- be-21 — action feedback and sponsorship chips; this batch must preserve all of it
- be-25 — took over the home page: IA, tokens, dark, alpha gating, search, i18n plumbing
- be-26 — locale tables; keep new strings keyed so they are translatable
- be-14 — workspace chrome, skeleton, and the error-path lesson
- be-16 — the visual direction being adopted; also the source of the site nav
- be-17 — the purge that revoke confirms
- `tokens.css` — its dark-mode comment named the portal home as the reason dark is opt-in; that half
  is now verified, `patient.html` is the remaining half
