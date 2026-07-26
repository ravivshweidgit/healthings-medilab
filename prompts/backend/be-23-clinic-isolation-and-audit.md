# be-23 — Clinic isolation and access audit (the one-way doors)

**Status:** needs-review
**Authored by:** Opus 5
**Date:** 2026-07-26
**Depends on:** be-17 (purge), be-19 (account deletion) — both shipped; this batch changes tables they delete from
**Blocks:** the clinic panel batch and be-22. Both are two-way doors; this one is not.

> Written after the owner asked why we would not simply build for big clinics. The honest answer is
> that the UI was never what blocked them. Two defects were verified in the schema, and one of them is
> a live cross-clinic confidentiality leak.

## Problem

### 1. Two clinics linked to the same patient share one overlay row

```sql
CREATE TABLE clinic_patient_overlays (
  patient_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  rules_json JSONB,
  chat_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL
);
```

One row per **patient**, not per patient-and-clinic. Meanwhile `account_shares` is unique per
*pair* (`idx_shares_one_active_per_pair`), so a patient linking two independent practices is already
permitted. Consequences, both reachable in production today:

- **Clinic B silently overwrites clinic A's dietary rules.** The patient's app applies whatever is in
  the row (`pullClinicOverlays`), so a directive from one practice replaces another's with no conflict,
  no warning and no attribution beyond a single `updated_by`.
- **Clinic B can read clinic A's private AI chat about that patient.** `chat_json` is in the shared
  row. Two competing practices see each other's clinical reasoning.

be-17's own comment noticed the key shape and correctly declined to delete per-link. It did not treat
it as a bug, because be-17's job was the purge. It is a bug.

### 2. There is no audit log at all

A search for `audit`, `access_log`, `read_log` and `viewed_at` across `server/src` returns **nothing**.
There is no record of which clinician opened which patient's record, ever. It cannot be backfilled —
every day without it is history that can never be produced. It is also the first thing a clinic's
compliance officer asks for, and `clinic_patient_rules_history` (which does exist) only covers rule
*writes*, never reads.

## Decisions (settled with the owner 2026-07-26)

| Question | Decision |
|---|---|
| Who does a patient consent to? | **The clinic as an organization**, but each clinician's notes and AI chat stay **private to that clinician** |
| Build the full big-clinic product now? | **No.** Do the one-way doors (schema, consent, audit) while there is almost no data. Roles UI, seat management and SSO are additive and wait |
| Fix the leak or document it? | **Fix.** be-18's standard is that the policy may not claim more than the code does, and the policy promises clinic-scoped sharing |

The reasoning worth preserving: schema, identity and consent are one-way doors — retrofitting them once
real patients exist means migrating **consent records**, the most dangerous migration in this product.
UI layout is a two-way door and can change any week. So spend the aggression here.

## Scope

- `server/src/db/schema.sql` — new tables + migration
- `server/src/services/clinicOverlay.ts` — 8 query sites, all of them
- `server/src/services/consent.ts` — be-17's purge must cover the new tables
- `server/src/services/accountDeletion.ts` — be-19's residue check and cascade set
- `server/src/services/shares.ts`, `sync.ts`, `syncRequests.ts` — access resolution + audit calls
- `website/clinic/` — only what is needed to keep working; **no redesign** (that is the panel batch)

**Off-limits:** the app's calorie path, `clinic-workspace.js` rendering, anything be-22 touches.

## Design

### Organizations, introduced without a UI

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE org_members (
  org_id  UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role    TEXT NOT NULL CHECK (role IN ('owner', 'clinician')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);
```

**Migration creates exactly one org per existing mentor**, named from `users.display_name`, with that
mentor as `owner`. Every current mentor is therefore a one-person clinic and **nothing in the UI has to
change yet**. That is the point: the door is open, the room is not built.

### Consent moves to the org

`account_shares` gains `org_id UUID REFERENCES organizations (id) ON DELETE CASCADE`, backfilled from
the mentor's org. Keep `mentor_id` — it records **who** initiated and is still wanted for display and
for the invite email. Access resolution becomes: *does the actor belong to an org with an approved
share for this patient?*

`hasApprovedShare(patientId, mentorId)` is the single primitive every clinician path already funnels
through — `sync.ts`, `clinicOverlay.ts` and `syncRequests.ts` each wrap it in a near-identical
`assertMentorPatientAccess` that differs only in error class. **Consolidate those three into one
helper** and resolve via org membership there. Three copies of an authorization rule is how the fourth
copy ends up wrong.

### Split the overlay by its real scopes

The current row conflates two different things. They have different owners, so they become two tables:

```sql
-- Clinical direction: shared inside one clinic, invisible to any other clinic.
CREATE TABLE clinic_org_overlays (
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  rules_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL,
  PRIMARY KEY (patient_id, org_id)
);

-- AI chat: private to the individual clinician, per the owner's decision.
CREATE TABLE clinic_clinician_chats (
  patient_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  chat_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (patient_id, clinician_id)
);
```

`clinic_patient_rules_history` gains `org_id` so the audit answers "which clinic changed this", not
just "which person".

### Access audit log

```sql
CREATE TABLE patient_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID NOT NULL,          -- deliberately no FK: see below
  actor_user_id UUID,
  org_id        UUID,
  action  TEXT NOT NULL,                -- snapshot.read | rules.read | rules.write | chat.read | chat.write | refresh.request
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_log_patient ON patient_access_log (patient_id, created_at DESC);
```

**No foreign key on `patient_id`, and this is the one deliberate exception to be-19's cascade rules.**
An audit trail that deletes itself when the subject leaves is not an audit trail. The columns hold raw
UUIDs so the record survives; nothing in it identifies the patient beyond an id that no longer resolves.
Add it to be-19's exclusion list explicitly, or the next residue test will flag it as a leak.

**Log where data is served, not inside `hasApprovedShare`.** That function is also called for
permission probes and list building, so logging inside it would record checks that returned nothing and
drown the real reads. Call the recorder at the ~6 sites that actually hand over data or accept a write.
Append-only: no update or delete path, ever.

## Migration, and where it is genuinely ambiguous

Each existing `clinic_patient_overlays` row must be assigned to an org. In order:

1. `updated_by`'s org, when set.
2. Otherwise, the org of the single approved share for that patient.
3. If a patient has **more than one** approved share and no `updated_by`, take the `mentor_id` from the
   most recent `clinic_patient_rules_history` row. This is exactly the case the bug created, so expect it.
4. If still unresolvable, **leave the row in place and do not delete it.** Log it and stop. Silently
   dropping a patient's clinical rules to satisfy a migration is worse than a failed migration.

`chat_json` follows `updated_by` and becomes that clinician's private chat. Where `updated_by` is null
the chat cannot be attributed; move it nowhere and record it. Alpha volumes make this rare, and a lost
AI chat transcript is recoverable in a way that lost dietary rules are not.

Run against real Postgres 16 via PGlite loaded with `schema.sql`, as be-17 and be-19 did. Production
is not a test target for a migration that moves consent rows.

## Must not regress

be-17 and be-19 both delete from the table this batch splits. **Both harnesses are tracked in the repo**
and are the gate:

```bash
cd server && npm install && npm run verify
```

`server/verify/be-17-snapshot-purge.mjs` and `server/verify/be-19-account-deletion.mjs` — real Postgres 16
via PGlite loaded with `src/db/schema.sql`, currently **8/8** and **28/28**. They were promoted out of
`tmp/` on 2026-07-26 precisely for this batch, and their absolute paths were made relative; see
`server/verify/README.md`. Each copies the SQL under test from the source and calls `assertInSource()`,
so **changing a service without updating the harness fails the run** rather than passing against a stale
copy. Expect that to fire the moment the overlay tables are renamed — that is the harness working, not a
false alarm. Update the copied SQL, do not weaken the assertion.

- **be-17 purge:** revoking one clinic link must delete that clinic's overlay and **nothing** belonging
  to another clinic — a test the old schema literally could not express. Add the two-org case.
- **be-19 deletion:** `findResidue` must cover `clinic_org_overlays` and `clinic_clinician_chats`, and
  must **not** flag `patient_access_log`. A departing mentor still triggers the purge for patients whose
  last link they were.
- The patient app's `pullClinicOverlays` must keep working unchanged for a single-clinic patient, which
  is every patient today.

## Deliberately deferred

- **Whose rules win when a patient links two clinics.** Today "most recent write" wins, and after this
  batch that stays true — now attributed and audited rather than anonymous. It is not a regression, but
  it is not right either, and the fix is a product decision: the patient should probably have to
  **acknowledge** a rule change rather than have their diet altered silently. That is the same fix as
  the missing clinic↔patient messaging, so it belongs in that batch. **First follow-up.**
- Org invitations, roles UI, seat management, SSO — all additive, none move data.
- Surfacing the audit log to clinicians or patients. Collect first; display later.

## Acceptance criteria

- [x] Two orgs linked to one patient: each reads only its own rules; neither can read the other's chat
- [x] Migration assigns every existing overlay, or fails loudly without deleting anything
- [x] One consolidated access helper; the three per-service copies are gone
- [x] Every data-serving path writes one `patient_access_log` row with the right `action`
- [x] No update or delete path exists for `patient_access_log`
- [x] be-17 harness green, including a new two-org isolation case
- [x] be-19 harness green, with the new tables in `findResidue` and the audit log excluded
- [x] A single-clinic patient sees no behaviour change in the app

## Evidence

`tmp/be-23-review/` — `verify-output.txt` (be-17 **10/10**, be-19 **31/31**), `NOTES.md`.
`npm run typecheck` clean. Not committed / not deployed.

## Review by Opus 5

- **Is per-clinician private chat right?** It matches the owner's decision and normal clinical practice,
  but inside one clinic a covering colleague then cannot see the reasoning. Revisit if a real
  multi-clinician practice appears — the fix would be org-visible chat with clinician attribution.
- **Does an unreferenced `patient_access_log.patient_id` survive scrutiny?** It is the right call for an
  audit trail, and it is also the one place this product keeps a row about a deleted person. The policy
  must say so plainly, in the same breath as the four existing `SET NULL` exceptions.
- **Is a one-person org per mentor confusing?** Every clinician becomes an "organization" they never
  created and cannot see. Harmless now, but the first org UI must not surprise them with it.

## Related

- be-17 — the purge whose scope comment first noticed this key shape
- be-19 — the cascade rules this batch takes one deliberate exception to
- be-22 — the repaint; explicitly after this, and after the panel
