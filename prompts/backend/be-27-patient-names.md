# be-27 — Patient first & last name for clinic findability

**Status:** needs-review  
**Model to implement:** Auto  
**Date:** 2026-07-27  
**Depends on:** be-25 (worklist), be-14 (email-only title gap)  
**Blocks:** nothing; messaging (clinic↔patient) stays a later batch

> Clinics find people by name. Email-only worklists are not clinic practice.

## Problem

The portal worklist and patient workspace title identify patients by **email only**. There is no
first/last name on `users`, none in the app profile, and none in the sync snapshot (be-14). A clinic
with dozens of patients cannot locate "Dana" without knowing the address.

## Locked decisions

| Question | Choice |
|----------|--------|
| Storage | `users.first_name` + `users.last_name` — **not** `display_name` (mentor/clinic label) |
| Source of truth | Account via `PATCH /v1/me` — **not** the clinic sync blob |
| When required | Profile completeness **nudge** only — share still works on email until names are set |
| Clinic UI | Primary: `First Last`; secondary: email (`dir="ltr"`); search name **or** email; sort “Name A–Z” |
| Pending invites | Email-only until `patient_id` exists and names are set |

## Scope

| Touch | Why |
|-------|-----|
| `server/src/db/schema.sql` | Columns |
| `server/src/services/jwt.ts`, `users.ts`, `routes/auth.ts` | PublicUser + PATCH |
| `server/src/services/shares.ts` | Join patient names onto `PublicShare` |
| App Auth + Profile + completeness | Collect and nudge |
| `website/clinic/index.html`, `patient.html`, `clinic-i18n.js` | Worklist + title |

**Out of scope:** clinic↔patient messaging; clinic editing patient names; names in sync gzip.

## Acceptance criteria

- [x] Patient can save first + last name from My Profile; `/v1/me` returns them
- [x] Mentor `displayName` path unchanged; patients cannot set `displayName`; mentors cannot set names
- [x] Approved shares expose `patientFirstName` / `patientLastName`
- [x] Worklist shows name primary + email secondary; search matches either; Name A–Z sort
- [x] Workspace title prefers name, then email, then short id
- [x] Completeness nudge treats missing names as incomplete (with gender/height/birthdate); Quick Start collects names after appearance and gates exit on names too (alpha follow-up)
- [x] i18n: portal keys in all 10 locales; app labels for 10 locales
- [x] No schema change to `account_shares`

## Agent checklist

- [x] Status → in_progress
- [x] Implement server → app → portal
- [x] Typecheck server (`npx tsc --noEmit` — clean)
- [x] Status → needs-review; do not self-accept
- [x] Do not commit or deploy unless asked

## Evidence (for owner review)

| Layer | What landed |
|-------|-------------|
| Schema | `users.first_name` / `users.last_name` via `ALTER … IF NOT EXISTS` |
| API | `PATCH /v1/me` names for patients; 422 cross-role; shares LEFT JOIN names |
| App | My Profile + Quick Start (`language` → `appearance` → `names`); `updatePatientNames`; QS exit via `isProfileBasicsComplete` |
| Portal | Name primary + email `dir=ltr` secondary; search name/email; sort Name A–Z; `patient.html` title |
| i18n | `sortName` + search placeholder in 10 clinic locales; app `yourSetupCopy` 10 locales |

**Deploy when accepted:** API + website (+ `bi` to enter names on phone).

## Related

- be-14 — email-only workspace title (explicitly deferred names)
- be-25 — worklist search/sort
- be-03 — mentor `displayName` / clinic label
