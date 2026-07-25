# be-15 — Patient web account (read-only, consent-gated)

**Status:** ready
**Model to implement:** Auto / Composer
**Authored by:** Opus 5 (website UX pack)
**Findings:** raised during pass 04 (clinic portal) — no patient surface exists on the web
**Depends on:** be-08 Batch A (clinic portal correctness — reuse its share-action + error patterns)

> Cross-cutting: this draft touches **server + website + app**, unlike the CSS-only batches in this
> folder. Implement in the Part 1 → 2 → 3 order below; each part is independently shippable.

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
- Revoking the **last** clinic share purges **only if** web view is off. Today `revokeShare` purges
  unconditionally — that would silently break a patient who is using the web view.
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

## Agent checklist

- [ ] Status → in_progress
- [ ] Changes match this draft only
- [ ] Purge rules verified against all four consumer combinations
- [ ] Acceptance criteria smoke-tested
- [ ] Status → done
- [ ] Update `drafts/README.md` table
