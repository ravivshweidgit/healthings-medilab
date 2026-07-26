# be-19 — account deletion

**Status:** server + website done, verified. App entry point still open. Opus 5, 2026-07-26

**Builds on:** be-15 (`/account/` exists and is where a patient is already signed in),
be-17 (`purgeClinicDataIfNoConsumers` is the rule for "no reader left"),
be-18 (the policy must not claim more than the code does).

## Problem

`privacy.html` promised deletion by emailing `support@healthings.ai`, and nothing implemented it —
there was no `DELETE /v1/account` anywhere in `server/src`. The promise was the owner, by hand.

Google Play also requires a **URL** where deletion can be requested, not a mailto, for any app that
lets users create an account. `/account/` shipping in be-15 is what made a real URL possible.

## The two leaks a naive delete would have left

Both found by reading `schema.sql` end to end rather than trusting that "everything cascades".

| Leak | Why no cascade reaches it |
|---|---|
| `otp_requests` | **No foreign key at all.** Keyed by `email`, so every code the person ever requested — address plus code hash — survives `DELETE FROM users` |
| `account_shares` with `patient_id IS NULL` | A clinic can invite someone **before they sign up**, so `patient_id` is NULL while `patient_email` is `NOT NULL`. The cascade never fires: the row keeps their email, and the invitation stays live for a clinic to approve against an account that no longer exists |

## The bug that mattered more

A departing **mentor** can strand their patients' data. The cascade removes the share row but cannot
run the be-17 purge, because the rule lives in application code, not in the schema. Every patient
whose last clinic link was that mentor would keep an overlay and a snapshot on the server with
nothing left to read them — silently contradicting be-17's guarantee and the policy.

So deletion collects affected patients **before** the delete, then runs
`purgeClinicDataIfNoConsumers` for each after it commits. The be-15 split still holds: a patient with
their web view on keeps the snapshot and loses only the clinic-authored overlay.

## What ships

| Change | File |
|---|---|
| `withTransaction()` — `query()` checks out a fresh connection per call, so a sequence of them is not a transaction | `db/pool.ts` |
| `deleteAccountWithCode()`, `deleteAccountUnchecked()`, `findResidue()` | `services/accountDeletion.ts` |
| `POST /v1/account/delete/code`, `DELETE /v1/account` | `routes/account.ts` |
| Purpose-aware OTP copy | `services/email.ts`, `services/otp.ts` |
| Deletion view, confirmation view, two entry points | `website/account/index.html` |
| `#deletion` rewritten to a real URL and real semantics | `website/privacy.html` |

## Decisions worth keeping

**Step-up OTP, not just a session.** Deletion is irreversible with no grace period, so a valid
session is not enough authority. It reuses `verifyOtpAndGetEmail`, which already verifies without
minting tokens.

**A dedicated `POST /v1/account/delete/code`, not the existing `/v1/auth/otp/request`.** That one
takes an email in the body, so reusing it would let a client aim a deletion code at any address.
Here the address comes from the access token and cannot be chosen.

**The deletion email has its own copy.** A sign-in code says "if you did not request this, ignore
this email" — exactly the wrong advice when someone else is trying to delete an account. The email is
the only out-of-band channel the real owner has, so it names what the code does and says *do not
enter it*.

**Invalid code returns 422, not 401.** Caught by the probe: `clinic-api.js` treats any 401 as an
expired access token, attempts a refresh, and calls `clearTokens()` when that fails — so a typo in
the confirmation code signed the user out. The session is fine; it is the code in the body that
failed. Matches `sync.ts`, which already uses 422 for a failed precondition.

**Deletion is offered on every signed-in state, not only in the workspace.** Most people will never
turn the web view on, and they are exactly who Play's requirement is about. One footer entry covers
the gate states — including `fatal-view`, so a snapshot that will not load cannot block deletion —
and the workspace gets its own button because it hides the gate.

**Four `ON DELETE SET NULL` columns are left alone, and the policy now says so.** Each preserves
*someone else's* record while dropping the departing identity: a patient keeps clinic rules written
by a clinician who left (`clinic_patient_overlays.updated_by`, `clinic_patient_rules_history.mentor_id`),
and billing keeps its ledger (`ai_usage_events.sponsor_id`, `wallet_ledger.payer_user_id`). Being
honest about this in `#deletion` is a be-18 obligation, not decoration.

**No second "are you sure?" after the code.** Typing a 6-digit code from your inbox *is* the
confirmation; stacking a dialog on top trains people to click through both.

## Verification

`tmp/be-19-verify/verify.mjs` — 21 source assertions, then **28 checks on PGlite**:

- Every table that references `users` is populated before each deletion, so a table that cascades
  only by accident would show up. `residue()` mirrors `findResidue` across all 14.
- Both roles. Mentor case covers three patients at once: sole clinic (purged), web view on
  (overlay purged, **snapshot survives**), second clinic (nothing purged).
- The `SET NULL` cases assert the row survives *and* the identity is gone.
- Rollback semantics, and that a bystander sharing the same clinic keeps every row.

`tmp/be-15-review/probe-account.mjs` — extended to **77 checks** in real Chrome:

- Entry offered on all four signed-in states, absent when signed out, present in the workspace.
- Opening the flow sends no email and deletes nothing; asking for a code deletes nothing.
- A 3-digit code never reaches the server.
- Wrong code: error shown, still in the flow, **session kept**, retryable — the assertion that
  caught the 401 bug.
- Send failure does not advance to a code that was never sent.
- Cancel returns to the previous state having deleted nothing.
- Success sends exactly one `DELETE` carrying the code, then clears the tokens.

`tmp/be-19-shots/` — all three steps at 390 and 1100. Dark renders identically **by design**:
`tokens.css` gates dark on `.theme-auto`, which the workspace stylesheets deliberately do not opt
into while they still carry hardcoded light surfaces.

## Open

- ~~**In-app entry point.**~~ Shipped in `AccountStrip` (Profile → Account): **Delete account**
  opens `https://healthings.ai/account/` after a confirm. Both roles. OTP stays on the web so
  the app does not grow a second deletion path. **Phone-tested 2026-07-26** — confirm dialog,
  browser opens `/account/`, Delete my account link visible.
- **`/account/` is still `noindex`**, now linked from `privacy.html` and the app. Reviewers follow
  links, so the URL requirement is met without advertising the web view before a build carries it.
- **A deletion visitor lands on "Nothing here yet"**, which is about the web view. The entry link is
  there and the policy names it, but the page's headline is answering a different question. Worth
  revisiting once the app build ships and that state becomes rare.
