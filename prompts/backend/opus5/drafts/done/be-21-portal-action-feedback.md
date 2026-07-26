# be-21 — Clinic portal: action feedback and sponsorship time remaining

Status: done
Date: 2026-07-26
Builds on: be-08 (portal UX), be-20 (invite button feedback, the pattern reused here)

## Problem

Two owner reports on the live portal, plus one question that turned out to be a gap.

**1. Sponsorship never showed how much time was left.** The row concatenated a date onto the status
string — `approved · AI sponsor until 10/24/2026` — through `toLocaleDateString()` with no locale
options. A clinician deciding whether to renew had to subtract today's date from a US-format number
in their head. `GET /v1/sponsorships/mine` already returned `expiresAt` and `active`; nothing used
them beyond that one string.

**2. No action button reported anything.** `act()` awaited the request, called `refreshDashboard()`,
and the row silently changed or disappeared. Concretely:

| Gap | Consequence |
|---|---|
| No busy state on any button | A slow request looked like a dead click; a second click fired a second request |
| No success message, ever | Approving a patient produced no words at all |
| Errors went to `#app-error` at the page bottom | The message rendered off-screen from the button that failed |
| `window.prompt` for sponsorship days | Blocking native dialog; no visible end date; a typo silently became 90 |

**3. The row layout was ragged.** `.share-row` used `flex-wrap` + `justify-content: space-between`,
so with three buttons per patient the action group wrapped at a different point per row and the
buttons started at a different x for every patient.

## What shipped

Website only — `website/clinic/index.html`. No server change; the data was already on the response.

### Sponsorship chip

`sponsorChip(sp)` replaces the concatenated string with its own element, on its own line, carrying
remaining time rather than an end date. `daysUntil()` compares at **local midnight** so "expires
tomorrow" does not read as "today" because of the clock time the sponsorship happened to be created.

| State | Chip | Class | Button offered |
|---|---|---|---|
| Active, > 7 days | `AI sponsored · 45 days left` | `ok` (green) | Stop AI sponsorship |
| Active, ≤ 7 days | `AI sponsored · 3 days left` | `soon` (amber) | Stop AI sponsorship |
| Active, today | `AI sponsored · ends today` | `soon` | Stop AI sponsorship |
| Expired | `AI sponsorship ended 5 days ago` | `gone` (red) | **Renew** AI sponsorship |
| Never sponsored | `AI not sponsored` | `off` (grey) | Sponsor AI |

The exact end date moves to the chip's `title`, so it is available without being the primary reading.
Dates elsewhere use `toLocaleDateString(undefined, { year, month: 'short', day })` — `Oct 24, 2026`
rather than an ambiguous `10/24/2026`.

The chip only renders for `status === 'approved'` rows with a `patientId`: sponsorship is meaningless
for a pending invite, and the previous code would have shown it on one.

### Action feedback

- `withBusy(btn, label, fn)` — the pressed button takes a present-tense label (`Approving…`), gets
  `aria-busy`, and **every control in its group** is disabled, so a second click cannot reach the
  network. Restored in `finally`, which matters only on the failure path; success re-renders the list.
- `#app-flash` — one `role="status" aria-live="polite"` region at the top of `#app-view`, `position:
  sticky` so a confirmation is visible even when the button was far down the page. It lives **outside**
  the three lists, which is what lets it survive the `refreshDashboard()` re-render; the message is set
  after the refresh for the same reason.
- Every action now says what changed, in the clinician's terms rather than the API's:

| Action | Confirmation |
|---|---|
| approve | Approved {email}. Their data is now available in your workspace. |
| reject | Rejected the request from {email}. |
| cancel | Invite to {email} cancelled. |
| revoke | Access revoked for {email}. Their snapshot is deleted unless another clinic still reads it. |
| sponsor-on | Sponsoring AI for {email} for 90 days — until Oct 24, 2026. |
| sponsor-off | AI sponsorship stopped for {email}. Their coach now bills to their own credits. |

The revoke wording states be-17's purge, and sponsor-off states who pays next — both are consequences
a clinician cannot see from the row afterwards.

- **Save name** got its own `#name-status` next to the field (form-level feedback belongs at the form),
  and names what patients will actually see: `Saved. Patients will see "Dr. Cohen" on invites and in
  the app.` Clearing it says the email address is shown instead.
- **Attach test card** and **Manual token pack** report through the flash, the latter quoting the new
  balance.
- Section headings carry counts — `Linked patients (4)`.

### Sponsorship duration picker

`window.prompt` is gone. Clicking Sponsor AI swaps the action row for an inline form: a `<select>` of
30 / 60 / 90 / 180 / 365 days defaulting to 90, a live `· until Oct 24, 2026` that updates on change,
`Start sponsorship`, and `Cancel` which restores the original row without sending anything.

`window.confirm` is **kept** for revoke and cancel-invite. Those are destructive, and a native confirm
is accessible and unambiguous. Replacing them with a real dialog belongs with the visual rebuild.

### Row layout

`.share-row` is now `flex-direction: column`, so each row is a label block above a left-aligned
`.row-actions`. Predictable across rows at any width, and it removes the wrap raggedness.

## Verification

`tmp/be-21-review/probe-portal.mjs` — the real page over a local static server with only `fetch`
mocked, in headless Chrome. **57/57.** Nine groups: sponsorship chip in all four states plus the
button label each implies; a confirmation for all six row actions; busy state including the assertion
that a second click during flight sends **zero** extra requests; the failure path showing the server's
message, not a success, and restoring the button; the picker's options, default, live end date and
"no native prompt used"; cancel sending nothing; save-name success and failure; both credit buttons;
390px overflow and tap targets.

Two probe notes worth keeping:

- The tap-target check first failed because it measured **hidden** login-view buttons at 0px height.
  The assertion was wrong, not the page — it now filters on `getClientRects().length`.
- The ragged rows were found in the screenshot, not by an assertion. Nothing in the check list could
  have caught it.

Screenshots: `portal-sponsorship.png`, `portal-sponsor-picker.png`, `portal-busy.png`, `portal-390.png`.

## Deliberately not in this batch

The owner also asked whether the page looks professional for a 2026 clinic product. It does not, and
none of it is fixable by feedback wiring. Left for a visual rebuild draft:

- **The page never received be-10 or be-16.** It hardcodes `#1a2b4a`, `#dde3ea`, `#c62828` instead of
  `tokens.css`, so it has no dark mode and none of the be-16 type scale or rhythm. This batch's new
  CSS follows the file's existing hardcoded convention rather than half-migrating it.
- **Eight identical cards in one 720px column**, no nav, no hierarchy — a form list, not a dashboard.
- **Alpha language in a clinical tool**: "Attach test card (alpha)", "Manual token pack", "Usage
  debits payer credits (Stripe later)", and tokens exposed to clinicians as a unit of account.
- **Destructive action is the loudest thing on the row** — `Revoke access` is solid red and outweighs
  `Open workspace`.
- No patient search or filter; plain-text empty states; no loading skeleton (be-14 gave the workspace
  one, this page never got it).

## Related

- be-20 — the invite button's busy/success/warning pattern, generalized here
- be-17 — the purge that the revoke confirmation now states out loud
- be-16 — the tokens and visual direction this page still has not adopted
