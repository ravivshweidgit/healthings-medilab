# be-22 — Clinic portal visual rebuild (2026 level)

Status: ready
Date: 2026-07-26
Builds on: be-10 (tokens), be-16 (visual direction), be-14 (workspace chrome + skeleton), be-21 (action feedback — must not regress)

## Problem

Asked directly whether `https://healthings.ai/clinic/index.html` looks like a 2026 clinic product, the
answer is no, and be-21 established that none of it is a feedback problem — that is now solved and
deployed. What remains is that **the portal never received the design system.** Measured:

| File | `var(--…)` uses | Hardcoded hex | Opts into dark |
|---|---|---|---|
| `website/index.html` + `styles.css` | many | — | yes (`class="theme-auto"`) |
| `website/clinic/clinic-workspace.css` | 135 | 59 | no |
| **`website/clinic/index.html`** | **0** | **36** | **no** |

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

## Scope

- `website/clinic/index.html` — the whole batch.
- New `website/clinic/clinic-portal.css` if the inline `<style>` exceeds roughly 200 lines after
  migration. Extracting is preferred, because `patient.html` should eventually share it.
- **Off-limits:** `clinic-workspace.js`, `clinic-api.js`, anything under `server/`. No endpoint
  changes — every number this page needs is already on a response.
- **`patient.html` is out of scope.** It still has 59 hardcoded hex values of its own; opting it into
  dark is a follow-up, and mixing it in here makes the diff unreviewable.

## Decisions (settled — do not reopen)

| Question | Decision | Why |
|---|---|---|
| Alpha billing controls | **Hide behind a dev flag.** Show the balance only | Owner's call, 2026-07-26. The controls are real and still needed for alpha testing — deleting them costs a workflow, hiding them costs nothing |
| Clinician-facing unit | **"credits", not "tokens"** | The section is already titled "AI credits". Presentation only — `/v1/wallet` keeps `balanceTokens` and `/v1/usage/summary` keeps `totalTokens`. Reversible in one place if the owner disagrees |
| `window.confirm` for revoke | **Keep** | be-21's reasoning stands: destructive, accessible by default, unambiguous. A custom dialog is cost without benefit here |
| Clinic portal i18n | **Out of scope** — English | `language-policy.mdc`: the clinic portal is a clinician tool and stays English |

## What to build

### 1. Gate the alpha controls

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

### 2. Migrate to tokens, then opt into dark

Replace all 36 hex values with the `tokens.css` equivalents. The mapping is not guesswork:

| Current | Token | Note |
|---|---|---|
| `#1a2b4a` | `var(--navy)` on headings, `var(--text)` on body | These diverge in dark — get it right per use |
| `#dde3ea`, `#eef2f6` | `var(--line)` | |
| `#666` | `var(--muted)` | |
| `#c62828`, `#c0392b` | `var(--danger)` | |
| `#fff` on surfaces | `var(--surface)` | Inputs and selects too |
| `#f8f9fa` | `var(--surface-2)` | |
| `#3d9dd6` link text | `var(--accent-ink)` | be-10's review: `--accent` is 3.0:1 and fails AA as text |

be-21's status chips (`.chip.ok/.soon/.off/.gone`) are the one place to be careful — they are tinted
fills with matching ink, and the light tints (`#ecfdf3`, `#fffbeb`) go muddy on a dark surface. Give
them dark-scheme values inside the `.theme-auto` block rather than mapping them to existing tokens.

Add `class="theme-auto"` to `<html>` **only after** verifying every state in dark: all four chip
states, all three `.portal-status` kinds, the inline sponsor picker, focus rings, and both `<input>`
and `<select>`. A control that stays white in dark is worse than no dark mode.

### 3. Layout

Two columns at ≥ 900px, single column below:

- **Main:** Linked patients, Pending requests, Outgoing invites — in that order. Patients first.
- **Sidebar:** clinic identity, invite form, AI credits, AI usage.

Give the page a real heading and the be-16 site nav rather than the lone `← Patient download` link.
Section counts from be-21 stay.

### 4. Row hierarchy

`Open workspace` is the primary action and should be the only filled control on the row. `Revoke
access` becomes quiet — outline or text, `var(--danger)` ink, no red fill. Keep the danger colour;
drop the visual weight. Sponsorship controls stay secondary.

Keep be-21's `.share-row` column layout. It exists because `space-between` + `flex-wrap` made the
action group start at a different x for every patient — do not revert it while reorganizing.

### 5. Skeleton and empty states

Reuse be-14's skeleton, including the lesson its review paid for: **hide the skeleton on every error
path**, not just on success. A clinician with no patients yet must not see an empty list over an
endless shimmer with a stale `aria-busy`. Honour `prefers-reduced-motion`.

Empty states get a next action, not bare muted text — "No linked patients yet. Invite one above."

### 6. Patient search

A filter input above Linked patients, shown only at ≥ 8 rows, matching on email, client-side. Clear on
Escape. It must not fight the be-21 flash region for focus.

## Must not regress

be-21 shipped hours before this and is verified live. Re-run `tmp/be-21-review/probe-portal.mjs`
unchanged — **57/57 is a gate on this batch, not a historical record.** Specifically preserve:

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

- [ ] No occurrence of "alpha", "Stripe", "simulate" or "test card" in what a clinician sees without `?dev=1`
- [ ] `?dev=1` restores both controls and survives a reload
- [ ] Zero hardcoded hex in the file (chip dark values excepted, and commented as to why)
- [ ] `class="theme-auto"` present, and every state above verified in both schemes by screenshot
- [ ] Two-column at 1280px, single column at 390px, no horizontal overflow at 390px
- [ ] `Open workspace` is the only filled control on an approved row
- [ ] Skeleton clears on success **and** on both error paths
- [ ] Filter appears at ≥ 8 patients, absent below
- [ ] "tokens" does not appear in clinician-facing copy; the API fields are unchanged
- [ ] `probe-portal.mjs` still 57/57, plus the new dark assertions
- [ ] Lighthouse mobile accessibility 100

## Review by Opus 5

Checkboxes cannot settle these:

- **Does it read as a clinical tool or a consumer app?** be-16's direction was built to sell to a
  patient. A clinician wants density and scanability, not hero rhythm. Borrowing tokens is right;
  borrowing the landing page's spacing may not be.
- **Is "credits" honest?** It is friendlier, and it is also one step further from what is actually
  metered. If a clinician ever needs to reconcile a bill, "tokens" is the truthful word.
- **Does the sidebar bury the invite form?** Inviting is how a clinic starts. If it moves to a sidebar
  and adoption drops, the layout is wrong.
- **Is a quiet Revoke too quiet?** It is a consent action with a real consequence — be-17's purge.
  Confirm it still reads as consequential, and that the confirm dialog carries the weight the button
  gave up.

## Related

- be-21 — action feedback and sponsorship chips; this batch must preserve all of it
- be-14 — workspace chrome, skeleton, and the error-path lesson
- be-16 — the visual direction being adopted; also the source of the site nav
- be-17 — the purge that revoke confirms
- `tokens.css` — its dark-mode comment names this page as the reason dark is opt-in
