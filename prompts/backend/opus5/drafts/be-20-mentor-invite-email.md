# be-20 — mentor invite email

**Status:** done — server + clinic portal + privacy. Opus 5, 2026-07-26

**Builds on:** be-03 (shares), be-08 (clinic invite UI), be-19 (email-keyed pending invites
must not linger without the patient ever hearing about them).

## Problem

`POST /v1/shares/invite` wrote an `account_shares` row and stopped. `email.ts` only sent OTP
codes. An invited patient who had never installed the app had no way to know a clinic was waiting
— and after be-19 we know those pending rows hold their email address until someone cancels or
deletes.

## What shipped

| Change | File |
|---|---|
| `sendClinicInviteEmail` + shared `deliverMail` | `server/src/services/email.ts` |
| `invitePatient` inserts first, then emails; returns `{ share, emailSent }` | `server/src/services/shares.ts` |
| Route returns `emailSent` | `server/src/routes/shares.ts` |
| Portal warns when invite saved but mail failed | `website/clinic/index.html` |
| Privacy: we email clinic invitations (no health data in the mail) | `website/privacy.html` |

## Decisions

**Insert before send; soft-fail SMTP.** If mail outage rolled back the invite, the clinic would
retry and get a 409 on a pending row they cannot see as "failed". Soft-fail keeps the row and
surfaces `emailSent: false` so the clinician can tell the patient in person.

**Mentor→patient only.** Patient→clinic `requestMentor` already requires the clinic account to
exist and they see it under Incoming — a second email is a later batch if clinics ask for it.

**No deep link / `?invite=`.** Accept/decline lives in the app today. The mail points at install +
Profile → Clinic link. Deep-linking into `/account/` would mix deletion/web-view with an approve
flow that page does not have.

**No health data in the mail.** Clinic label + email + how to approve. Matches the privacy claim.

## Verification

`tmp/be-20-verify/verify.mjs` — 10 source assertions (order, soft-fail, privacy, portal).

## Open

- Optional: email the clinic when a patient requests a link (`requestMentor`)
- Optional: resend invite from the outgoing list
