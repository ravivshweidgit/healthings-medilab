# be-15 — Patient web account (read-only, consent-gated)

**Status:** in_progress — Parts 1 and 2 shipped; Part 3 (app) built, awaiting phone test. Opus 5, 2026-07-26

## What shipped in Parts 1 and 2

### Part 1 — server (verified: `tmp/be-15-verify/verify.mjs`, 25 checks on PGlite)

| Change | File |
|---|---|
| `web_view_enabled BOOLEAN NOT NULL DEFAULT FALSE` on `users` | `db/schema.sql` |
| `webViewEnabled` on `PublicUser`, so `GET /v1/me` carries it | `services/jwt.ts`, `services/users.ts` |
| `hasAnySnapshotConsumer()` — clinic share **or** web view | `services/consent.ts` |
| Purge split by reader: clinic workspace vs snapshot, returning `PurgeOutcome` | `services/consent.ts` |
| Upload gate now `hasAnySnapshotConsumer` instead of counting shares | `services/sync.ts` |
| `getLatestSyncPayloadForPatient()` + `GET /v1/sync/mine/payload` | `services/sync.ts`, `routes/sync.ts` |
| `PUT /v1/account/web-view`; disabling purges via `setWebViewEnabled` | `routes/account.ts`, `services/users.ts` |

The purge split is the load-bearing decision. Clinic overlay and rules history are clinic-authored
and the self view never renders them, so they die with the last clinic link either way; the snapshot
has two possible readers and must survive. One combined condition would have been wrong in both
directions.

### Part 2 — `/account/` (verified: `tmp/be-15-review/probe-account.mjs`, 41 checks in Chrome)

`website/account/index.html`, plus three small changes to shared clinic code:

- `clinic-api.js` became a `createClient(tokenKey)` factory. `ClinicApi` is unchanged for the portal;
  the account page uses `healthings_account_tokens` so a clinician and a patient sharing a browser
  do not sign each other out.
- `clinic-workspace.js` accepts `ctx.tabIds`. Chat and Rules are the only tabs that write *and* the
  only ones that read `ctx.overlay`, so omitting them yields a read-only workspace with no render
  function changed.
- `ctx.selfView` swaps five clinic-facing strings to second person ("patient phone data" → "your
  phone"). Found by scanning the six reachable render functions, not by eye.

Decisions worth keeping:

- **Enabling is app-only.** The page offers *off*, never *on*. Enabling from the web would leave the
  page promising data no phone had uploaded yet; the app can enable and upload in one gesture.
  Disabling from anywhere is safe because it only ever reduces exposure — which is also why the
  button is not styled as destructive.
- **No pako.** The portal pulls pako from jsDelivr; this page uses native `DecompressionStream`
  instead, so a page rendering health data loads nothing third-party. Verified by asserting zero
  off-origin requests.
- Cache tokens on `clinic-api.js` and `clinic-workspace.js` bumped to `20260726f` in
  `clinic/index.html` and `clinic/patient.html`, since both files changed under the portal.
- A regression probe re-renders `clinic/patient.html` and asserts eight tabs, Chat, Rules and the
  original wording all survive.

### Part 3 — app (built 2026-07-26, phone test pending)

| Change | File |
|---|---|
| `webViewEnabled?: boolean` on `AuthUser`; `setWebViewEnabled()` | `services/AuthApiService.ts` |
| Upload gate widened to `hasSnapshotConsumer()` — clinic **or** web view | `services/ClinicSyncService.ts` |
| `pushSnapshotForWebView()` on launch and foreground, 10-minute throttle | `services/ClinicSyncService.ts` |
| "My web view" switch, last-sent line, Send snapshot now | `components/AccountStrip.tsx` |
| Renames follow the widened meaning | `components/ClinicLinkStrip.tsx` |

Two things that were nearly missed:

- Every app upload path gated on `listShares('approved').length > 0`, so the server would have
  accepted an upload the app never attempted. The web view would have been permanently empty with
  no error anywhere.
- A clinic can press **Refresh snapshot**; the patient's own page cannot. Without a push the page
  would show whatever was uploaded when the view was first switched on, so the app pushes on launch
  and foreground. Enabling resets the throttle and uploads at once, so the page is not left on
  "waiting for your phone".

`fulfillPendingClinicSyncRequests` stays clinic-only deliberately: only a clinic creates a request,
and its approved-share check guards a link revoked after asking.

The toggle lives beside **Cloud backup** in the Account strip, the existing precedent for a switch
that starts a server upload.

### Not done yet

Account deletion, the mentor invite email, and the two privacy policy sentences. `/account/` stays
`noindex` and unlinked until the app build ships.
**Model to implement:** Auto / Composer
**Authored by:** Opus 5 (website UX pack)
**Findings:** raised during pass 04 (clinic portal) — no patient surface exists on the web
**Depends on:** be-08 Batch A (clinic portal correctness — reuse its share-action + error patterns)

> Cross-cutting: this draft touches **server + website + app**, unlike the CSS-only batches in this
> folder. Implement in the Part 1 → 2 → 3 order below; each part is independently shippable.

## Re-validated against the code 2026-07-26 — read this before the Implementation parts

Every factual claim below was re-checked against current `server/src` and `website/`. Most hold. The
ones that do not are listed here, and **one of them blocks the batch**.

## Second re-validation, 2026-07-26 morning — after be-17 and be-18 shipped

### Unblocked

be-17 shipped. `server/src/services/consent.ts` now exports `purgeClinicDataIfNoConsumers(patientId)`
and `purgeClinicLinkData(patientId, mentorId)`, and `revokeShare` calls both. The hook this draft
needed exists; be-15's job is to widen "consumer" so the count includes the web view. Note the name
is *Clinic*Data, not `purgeSnapshotIfNoConsumers` as this draft predicted — it also drops the overlay
and rules history, which is correct and should not be narrowed.

### Design settled: self-sharing, not cloud-backup reuse

be-18 revealed something this draft was written without knowing: `user_cloud_backups` already holds a
full opt-in copy of the patient's data on the server. Since `parseSnapshot` in `clinic-workspace.js`
reads only `payload.asyncStorage`, and the backup payload has exactly that key, the backup is
directly renderable — so "skip the new upload path and render the backup" looked attractive.

**Rejected, on the owner's original instinct.** Backup and web view are different intents, and the
backup is the *heavier* commitment: full and untrimmed at 25 MB, kept alongside a previous copy, and
refreshed opportunistically once enabled. Routing the web view through it would force a patient who
wants a read-only view into the largest server-side footprint the product has — backwards for a
local-first app. The decider: `sync_blobs` holds **one row per patient**, not one per consumer
(be-17 prunes to the latest), so self-sharing costs *zero* extra storage when a clinic link already
exists, and one small trimmed blob when it does not. Self-sharing is the smaller footprint in every
case, and it slots into the consumer count that already exists instead of sitting beside it as a
special case.

Keep the cheap half of the idea: the renderer needs no changes for either payload shape.

### be-18 changed a sentence this batch must revisit

`privacy.html` now says, in `#on-device`: *"There are exactly **two** ways this data reaches our
server, and you start both of them: clinic sharing and cloud backup."* A web view makes that
**three**. Part 2 must update that sentence, the `#server-data` list, and add the web view alongside
`#clinic-sharing` and `#cloud-backup` — with the same "off unless you turn it on" framing those two
already use. Do not leave the count wrong; be-18 exists because nobody was checking.

A **second** sentence breaks, found while building Part 1. be-17 wrote into `#clinic-sharing`: *"when
your last clinic link ends we delete the snapshot along with the clinic's workspace data and rule
history."* With the web view on, the snapshot deliberately survives that moment — it has another
reader. The clinic's workspace data and rule history are still deleted, so only the snapshot clause
needs the exception. Part 1 already behaves this way and it is verified; the policy is what is now
behind.

### Account deletion is smaller than this draft assumes — but has two escapes

Every table referencing `users (id)` cascades, so `DELETE FROM users WHERE id = $1` clears
`refresh_tokens`, `account_shares`, `ai_sponsorships`, `ai_usage_events`, `wallets`, `wallet_ledger`,
`payment_methods`, `sync_blobs`, `sync_update_requests`, `clinic_patient_overlays`,
`clinic_patient_rules_history` and `user_cloud_backups` in one statement. No hand-written cascade
list is needed.

Two rows do **not** cascade and must be deleted by email:

- `otp_requests` is keyed by `email` with no foreign key — every abandoned sign-in attempt survives
  the account, holding an address and a code hash
- `account_shares.patient_id` is nullable, so a **pending invite to an address that never
  registered** keeps `patient_email` after the user row goes

So a correct delete is three statements, not one.

### Superseded — the old blocking note, kept for the record

The "Consent and purge rules" section says *"Today `revokeShare` purges unconditionally — that would
silently break a patient who is using the web view."* That is wrong in the direction that matters:
**nothing purges at all.** There is no `DELETE FROM sync_blobs` anywhere in `server/src`. `revokeShare`
(`shares.ts:331`) sets `status = 'revoked'`, removes the sponsorship, and stops. Every snapshot a
patient has ever uploaded is still on the server, at every version, because `nextVersion()` increments
and the insert is never followed by a prune.

So the risk this draft was written to avoid — a consumer-blind purge breaking the web view — is not
the real problem. The real problem is that `website/privacy.html` already promises this purge to
users, in production. That is now **be-17**, which must ship first. Once it does, the hook this draft
needs (`purgeSnapshotIfNoConsumers`) exists, and be-15's job shrinks to widening "consumer" to
include the web view in exactly one function.

Do not implement be-15's purge bullets. They belong to be-17 and are written correctly there.

### Stale — fixed by batches that shipped after this draft was written

| Draft says | Now |
|---|---|
| Problem 2: privacy page tells users to email `otp@healthings.ai` | It says `support@healthings.ai` (shipped 2026-07-26). The Play Store point stands: an email address still does not satisfy the account-deletion **URL** requirement |
| Part 2: "Landing gets a header … it has no navigation at all today" | be-16 shipped a `site-nav` with **Help** and **Clinic sign in**. The work is now *adding a patient Sign in entry to an existing nav*, not building one |
| Acceptance: "will need the responsive work from be-14 before the snapshot tab is mobile-clean" | be-14 shipped. `clinic-workspace.css` has a 720px breakpoint, horizontal tab scroll and `charts-row { height: auto }`. Precondition satisfied |
| Part 2 lists `#deletion` work loosely | be-13 gave `privacy.html` real anchors. Link to `privacy.html#deletion`, and note be-17 explicitly leaves that section to this batch |

### Confirmed — safe to rely on

- `email.ts` exports only `sendOtpEmail`; no invite mail exists
- New users default to `role: 'patient'` (`auth.ts:21-24` on request, `otp.ts:91` on verify)
- `approveShare` / `rejectShare` / `cancelShare` / `revokeShare` all exist in `shares.ts`
- `uploadSyncBlob` hard-fails `422 "Link a clinic account before sharing data"` at `sync.ts:109-112` — exactly as described
- `GET /v1/sync/mine` exists and is metadata-only; `toPublicBlob` (`sync.ts:71`) strips the payload
- `getLatestSyncForMentor(mentor, patientId)` at `sync.ts:142` is the right template to mirror
- `accountBackup.ts` provides backup status / upload / download / delete
- `sync_update_requests` really is `mentor_id NOT NULL` + `UNIQUE (patient_id, mentor_id)` (`schema.sql:173`), so omitting self-refresh remains the right call
- No `web_view_enabled` column and no `DELETE /v1/account` exist — both are genuinely new work
- `PublicShare` carries `patientId` and `patientEmail`

### The `readOnly` flag is more tractable than the draft assumes

`clinic-workspace.js` is 1247 lines but makes **no network calls of its own**. Everything goes through
`ctx.api`, and only in three places, all `/v1/clinic/patients/…`:

| Method | Path | Tab |
|---|---|---|
| `POST` | `/chat` | Mentors & chat |
| `GET` | `/rules/history` | Rules (live) |
| `PUT` | `/rules` | Rules (live) |

Two of the four surfaces the draft names are **not in the file at all**: Sponsor AI lives in
`clinic/index.html`, and the refresh button is markup in `clinic/patient.html`. They are page-shell
concerns, so the account page simply never renders them.

That means every mutating path is confined to two of the eight tabs. Omitting `chat` and `rules` from
the `initTabs` array when `readOnly` is set removes all three endpoints at once, and the remaining six
tabs need no changes for safety. The draft also missed a fourth mutating surface: **restore from rules
history** (`clinic-workspace.js:886`) re-issues the same `PUT` — it disappears with the rules tab.

Two things still need attention, neither structural:

- **Third-person clinic copy** renders verbatim for a patient. `"Chat with the patient's AI mentors…"`
  (`:737`), `"Read-only snapshot · patient phone data · v{N}"` (`:714`), and the lipids/nutrition empty
  states that say *"Use **Refresh snapshot** on the portal header"* (`:1092`, `:1107`) all address a
  clinician. On `/account/` that reads as someone else's chart — which directly undercuts the *"this
  is what your clinic sees"* framing. Note that `:714` is one of the strings be-14 was told to leave
  byte-identical; parameterise it, do not edit it in place.
- **`ctx` is required, not optional.** Callers must supply `patientId`, `parsed`, `blob`, `overlay`,
  `api`, `tab`, `activeMentor`. For read-only the account page can pass `api: null` and `overlay: null`
  as a second line of defence behind the tab filter.
- Tab persistence uses the global `__clinicTab`, which is fine but is a clinic-named global on a
  patient page.

## Problem

Three gaps that all land on the same missing page:

1. **Invites go nowhere.** A clinician's "Send invite" writes an `account_shares` row and nothing
   else — `server/src/services/email.ts` only sends OTP codes. An invited patient who has not yet
   installed the app is never notified and has no place to accept.
2. **Account deletion is email-only.** `website/privacy.html` tells alpha users to email
   `otp@healthings.ai`. Google Play requires a **web URL** for account deletion for any app that
   allows account creation. An email address does not satisfy that.
3. **Patients can't see or manage their own sharing** anywhere except inside the app, and can't see
   what their clinic actually sees.

## Design decision (user, 2026-07-25)

> "User can have a read-only web account page of his own data, but he will need to share data with
> his web account like he shares data with the clinic. This is not breaking the promise — user choice."

The web view is **another consumer of the existing snapshot**, authorized by the same explicit,
revocable consent gesture as a clinic link. Off by default. Nothing is uploaded without a deliberate
user action, so the local-first promise in `privacy.html` holds.

There is **no signup form**. Email OTP already creates the account (`otp.ts` defaults new users to
`role: 'patient'`), so "open an account" is just signing in.

## Goal

`healthings.ai/account/` — patient signs in with email OTP and gets four things:

| Section | What it does |
|---|---|
| Sharing & access | Accept/decline pending clinic invites; see who has access; revoke |
| Web view | Toggle the read-only mirror on/off; off purges the server copy |
| My data | Download cloud backup; delete account (step-up OTP) |
| Snapshot (read-only) | The same view the clinic sees, when web view is on |

Framing the snapshot view as *"this is exactly what your clinic sees"* makes the feature double as
transparency, which is worth saying in the UI copy.

## Architecture — reuse, do not fork

Already exists (do not rebuild):

- Email OTP auth and roles — `server/src/services/otp.ts`, `jwt.ts`
- `account_shares` + approve / reject / revoke / cancel — `server/src/services/shares.ts`
- `sync_blobs` + `uploadSyncBlob` — `server/src/services/sync.ts`
- `GET /v1/sync/mine` — patient's own snapshot **metadata only**
- Snapshot renderer — `website/clinic/clinic-workspace.js`, `clinic-charts.js`, `clinic-workspace.css`
- Cloud backup download / delete — `server/src/routes/accountBackup.ts`

New work:

- `web_view_enabled` consent flag on the patient (column on `users` or a small `patient_web_view` row)
- `uploadSyncBlob` gate widened — currently hard-fails with *"Link a clinic account before sharing
  data"* when `countApprovedShares === 0` (`sync.ts` lines 109–112)
- `GET /v1/sync/mine/payload` — patient's own payload, 403 unless `web_view_enabled`
- `purgeSnapshotIfNoConsumers(patientId)` helper
- `DELETE /v1/account` with step-up OTP
- Invite email in `email.ts` + send on mentor-initiated share create
- `website/account/` page reusing the workspace renderer
- App: web-view toggle in the existing sharing strip

## Consent and purge rules — get these exactly right

The snapshot now has **two possible consumers**: approved clinic shares, and the patient's own web
view. Every purge decision must be consumer-aware.

- Upload allowed when **≥ 1 consumer** exists (approved share **or** web view on).
- Turning web view **off** purges `sync_blobs` **only if** no approved clinic share remains.
- Revoking the **last** clinic share purges **only if** web view is off. be-17's
  `purgeClinicDataIfNoConsumers` counts approved shares only, so as written it *would* delete the
  snapshot out from under a patient using the web view. Widening that count is the single change
  that prevents it.
- Deleting the account purges everything.

## Part 1 — Server

Files: `server/src/services/sync.ts`, `shares.ts`, `email.ts`, `routes/sync.ts`, `routes/shares.ts`,
`routes/account.ts` (new), `src/db/schema.sql`

- [ ] `web_view_enabled BOOLEAN NOT NULL DEFAULT FALSE` for patients + `GET`/`PUT` to read and set it
- [ ] `uploadSyncBlob`: replace the `approved === 0` hard fail with `hasAnyConsumer(patientId)`;
      keep the 422 message when there is genuinely no consumer, reworded to mention both options
- [ ] `getLatestSyncPayloadForPatient(user)` — mirrors `getLatestSyncForMentor` but self-scoped;
      throws 403 when `web_view_enabled` is false
- [ ] `GET /v1/sync/mine/payload` wired to it
- [ ] `purgeSnapshotIfNoConsumers(patientId)` called from web-view-off and from `revokeShare`
- [ ] `DELETE /v1/account` — requires a **fresh OTP code** in the body, not just a valid session;
      cascades users → shares, blobs, wallets, backups, overlays
- [ ] `sendInviteEmail(patientEmail, clinicName)` in `email.ts`, called when a mentor creates a
      share; links to `https://healthings.ai/account/?invite=<shareId>`

## Part 2 — Website

Files: `website/account/index.html` (new), `website/account/account.js` (new),
`website/privacy.html`, `website/index.html`, `website/clinic/clinic-workspace.js`

- [ ] `/account/` login step reuses the clinic portal's OTP markup and the be-08 error handling
      (`#login-error`, `#app-error`, `role="alert"`, OTP-pending persistence)
- [ ] `?invite=<id>` deep-links straight to the accept/decline card after sign-in
- [ ] Four sections per the Goal table; web view toggle states its consequence in plain copy
      ("Turning this off deletes the server copy immediately")
- [ ] Snapshot view reuses `clinic-workspace.js` behind a **`readOnly` flag** — do not copy the file.
      Hide: rules editing/save, clinic chat compose, Sponsor AI, mentor refresh button.
      Keep: Dashboard, Food log, Labs, Lipids, Nutrition reports, Profile.
- [ ] `privacy.html`: add the web view as a second, opt-in upload reason; replace the email-only
      deletion paragraph with a link to `/account/`
- [ ] Landing gets a header with `Get the app · Help · Sign in` (it has no navigation at all today)
- [ ] Sign-in routes by role: patient → `/account/`, mentor → `/clinic/`

## Part 3 — App

- [ ] Web-view toggle next to the existing clinic sharing controls, same visual treatment as a
      clinic link so the consent gesture reads as identical
- [ ] Upload path already runs on clinic request — extend it to also upload when web view is on
- [ ] Off-state copy matches the website wording

## Refresh — deliberately omitted

No self-refresh request in alpha. `sync_update_requests.mentor_id` is `NOT NULL` with a
`UNIQUE (patient_id, mentor_id)` constraint, so a self-request means schema churn for little gain.
The page shows *"Snapshot from {date} · open the app to refresh"*. Revisit if users ask.

## Acceptance criteria

- [ ] Patient with no app can accept a clinic invite from an emailed link and is then prompted to install
- [ ] Web view off (default) → `GET /v1/sync/mine/payload` returns 403 and no blob exists on the server
- [ ] Web view on with no clinic link → app uploads successfully; page renders the snapshot read-only
- [ ] Web view off again → blob is gone; clinic snapshot unaffected when a clinic link also exists
- [ ] Revoking the last clinic share while web view is on does **not** purge the snapshot
- [ ] Delete account requires a fresh code, then removes all rows; a later sign-in creates a clean account
- [ ] Read-only: no rules save, chat compose, or sponsor control reachable from `/account/`
- [ ] Desktop (~1280) and mobile (~390): both usable; the clinic workspace CSS is desktop-first and
      will need the responsive work from be-14 before the snapshot tab is mobile-clean
- [ ] No regression: clinic portal and clinic patient workspace behave exactly as before

## Out of scope

- Any patient **editing** on web — read-only, always
- Real-time sync or web-initiated refresh
- Localizing `/account/` — English first, matching the clinic portal per the language policy
- Stripe / paid plans on the patient side

## Review by Opus 5 (after Auto marks done)

**Evidence to capture**

- All four consent states at 1280 and 390: web view off, web view on, invite deep-link, post-deletion
- The app's web-view toggle beside the existing clinic sharing control, in one screenshot
- The invite email as received
- Server logs or query output proving the purge ran in each of the four consumer combinations

**Judgment calls to check**

- Does the web-view toggle read as the **same gesture** as clinic sharing — same weight, same
  language, same sense of consequence? The whole design rests on the two feeling identical.
- Is the purge consequence unmistakable **before** the user acts, without being alarming? "Turning
  this off deletes the server copy immediately" is a promise, not a warning.
- Does the read-only snapshot feel like *"this is what my clinic sees"*, or like a **crippled app**?
  If it reads as crippled, the framing copy is wrong, not the feature.
- Is the delete-account friction **proportionate**? Light enough that a user can genuinely exercise
  the right, heavy enough not to happen by accident, and not so ceremonial it reads as a dark pattern.
- Does the invited-patient-with-no-app path feel welcoming, or like a dead end with a download link?
- Cross-check against the privacy page: does the live behavior match every promise be-13 makes?

## Agent checklist

- [ ] Status → in_progress
- [ ] Changes match this draft only
- [ ] Purge rules verified against all four consumer combinations
- [ ] Acceptance criteria smoke-tested
- [ ] Status → done
- [ ] Update `drafts/README.md` table
