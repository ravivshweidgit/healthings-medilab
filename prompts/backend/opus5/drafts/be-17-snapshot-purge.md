# be-17 — Make the snapshot purge real (the privacy policy already promises it)

**Status:** ready
**Model to implement:** Auto / Composer
**Authored by:** Opus 5
**Findings:** raised 2026-07-26 while re-validating be-15 against the server code
**Depends on:** nothing. **Blocks be-15**, whose consent rules assume this exists.

> This is a correctness fix on **live, deployed behaviour**, not a feature. The privacy policy on
> `healthings.ai/privacy.html` makes three factual claims about snapshot storage. All three are
> currently false. Ship this before be-15 and before any further Play Store data-safety work.

## Problem

`website/privacy.html` lines 92–99, live right now:

> While a link is approved and you have shared, a current snapshot sits in **temporary server memory
> only** — a handoff for that clinic, **not saved in our database** and not a permanent medical
> record. **Revoke immediately purges** that copy (snapshot, pending rules, and clinic workspace data
> for that link).

Against the code:

| Claim | Reality | Evidence |
|---|---|---|
| "temporary server memory only" | It is a `BYTEA` column in a Postgres table | `sync_blobs.payload_gzip`, `schema.sql` |
| "not saved in our database" | It is saved in the database | `INSERT INTO sync_blobs …`, `sync.ts:124` |
| "Revoke immediately purges that copy" | Nothing is ever deleted | no `DELETE FROM sync_blobs` exists anywhere in `server/src` |
| "**a** current snapshot" (singular) | Every upload appends a new row and none are pruned | `nextVersion()` = `MAX(version) + 1`, `sync.ts:92`; insert-only at `:124` |

`revokeShare` (`shares.ts:331`) sets `status = 'revoked'`, calls `removeSponsorshipForMentor`, and
stops. The snapshot, the clinic overlay and the rules history all survive. The only `DELETE` touching
overlay data is a history-length trim in `clinicOverlay.ts:128` (`OFFSET MAX_SERVER_HISTORY`), which
is a cap, not a purge.

Two consequences, in order of seriousness:

1. **The policy is inaccurate on its most load-bearing claim.** "Local-first, nothing leaves the
   phone unless you send it, and revoking takes it back" is the product's entire positioning, the
   thing be-09 and be-16 put on the landing page, and the basis of the Play Store data-safety
   answers. A user who revokes today believes their data is gone. It is not.
2. **Storage grows without bound.** Each upload is a full snapshot up to 15 MB (`sync.ts:117`) and
   every version is retained forever. Nothing reads a version older than the newest — every consumer
   query is `ORDER BY version DESC LIMIT 1` (`sync.ts:156`, `sync.ts:178`, `geminiClinic.ts:160`,
   `syncRequests.ts:135`) — so the history is pure dead weight.

## Decision — fix the code, not the policy

The policy describes the behaviour users were promised and the behaviour the product is sold on.
Rewriting it to say "we retain every snapshot you have ever shared, indefinitely" would be accurate
but would break the promise rather than the sentence. One sentence still needs correcting either way
(see Part 2): the snapshot *is* in a database, and saying otherwise is false even once purging works.

## Part 1 — Server

Files: `server/src/services/consent.ts` (new), `shares.ts`, `sync.ts`

- [ ] `purgeClinicDataIfNoConsumers(patientId)` — deletes `sync_blobs`, `clinic_patient_overlays` and
      `clinic_patient_rules_history` for the patient, **only when** no approved share remains. A
      patient linked to two clinics who revokes one must keep all of it for the other. be-15 widens
      "consumer" to include the web view, and this is the single place that changes.
- [ ] `purgeClinicLinkData(patientId, mentorId)` — the genuinely per-link cleanup, safe while other
      clinics are still linked: `DELETE FROM sync_update_requests WHERE patient_id = $1 AND mentor_id = $2`
- [ ] Call both at the end of `revokeShare`, **after** the status update so the revoked link no
      longer counts as a consumer
- [ ] Prune superseded versions in `uploadSyncBlob`: after the INSERT, delete rows for that patient
      with a lower `version`. Nothing reads them. This makes "a current snapshot" true and bounds the
      table at one row per sharing patient
- [ ] Leave the `countApprovedShares === 0` upload gate alone — be-15 is what widens it

### Two things this draft originally got wrong — corrected during implementation

**The overlay cannot be purged per link, and must not be.** `clinic_patient_overlays` is
`patient_id UUID PRIMARY KEY` with no `mentor_id` at all (`schema.sql:185`), so there is exactly one
row per patient shared by every clinic linked to them. `clinic_patient_rules_history.mentor_id`
exists but is nullable and `ON DELETE SET NULL`. Deleting either "for that link" would corrupt a
surviving clinic's workspace. Both are therefore gated on no-consumers alongside the snapshot. The
only truly per-link table is `sync_update_requests`.

That leaves a gap worth naming rather than hiding: with two clinics linked, revoking one removes that
clinic's **access** but deletes none of the shared data. The policy wording in Part 2 is written to
be true of this, promising deletion when the *last* link ends. For alpha, where patients have one
clinic, the two are the same thing.

**Placement.** `shares.ts` sits *below* `sync.ts` and `clinicOverlay.ts` in the import graph — both
import `hasApprovedShare` from it. Putting the purge in `sync.ts` and calling it from `revokeShare`
inverts that and creates a cycle. It lives in a new leaf module `consent.ts` that imports only the
pool, which keeps the graph acyclic *and* keeps the purge inside `revokeShare` where a future caller
cannot forget it.

## Part 2 — Policy wording

File: `website/privacy.html`

- [ ] "temporary server memory only … not saved in our database" is false even after Part 1 ships.
      Reword to describe what is actually true: the snapshot is **stored on our server only while a
      clinic link is active**, and is deleted when the last link ends. Keep the sentence short and
      keep "not a permanent medical record", which is true once pruning lands
- [ ] Do not weaken "immediately purges" — Part 1 makes it true
- [ ] Do not touch the `#deletion` section; that is be-15's

## Acceptance criteria

- [ ] Patient with one clinic revokes → `sync_blobs` for that patient is empty
- [ ] Patient with two clinics revokes one → snapshot **survives**; the revoked clinic gets 403 on
      `/v1/sync/latest`; the remaining clinic still loads the workspace
- [ ] Revoking a link deletes that link's overlay and rules history, and does not touch another
      mentor's overlay for the same patient
- [ ] Two consecutive uploads leave exactly one `sync_blobs` row, at the higher version
- [ ] Clinic portal and patient workspace behave exactly as before for an active link
- [ ] Every sentence in `privacy.html` about server storage is literally true of the code

## Out of scope

- The web view consumer and `web_view_enabled` — be-15
- `DELETE /v1/account` — be-15
- Widening the upload gate — be-15

## Review by Opus 5 (after Auto marks done)

**Evidence to capture**

- Query output of `SELECT patient_id, version FROM sync_blobs` before and after each of the four
  cases in the acceptance criteria — this is a data-deletion change, so screenshots are not evidence
- The reworded privacy paragraph, quoted, next to the code path it now describes

**Judgment calls to check**

- Is the purge scoped correctly? Deleting one patient too many is unrecoverable, and this is the
  first destructive path in the codebase. Check the `WHERE` clauses personally.
- Does the reworded policy paragraph still read as a **promise** rather than a disclosure? The point
  of the paragraph is reassurance; accuracy that reads as a retreat has cost something real.
- Should purging be logged? There is a defensible argument for an audit line proving deletion ran,
  and a competing one that logging patient ids at deletion time is its own retention problem.

## Built by Opus 5, 2026-07-26 — needs-review

Shipped as described, with the two corrections above folded in.

| Change | File |
|---|---|
| `purgeClinicDataIfNoConsumers`, `purgeClinicLinkData` | `server/src/services/consent.ts` (new, 58 lines) |
| Both called from `revokeShare` after the status update | `server/src/services/shares.ts` |
| Superseded versions deleted after insert | `server/src/services/sync.ts` |
| Retention paragraph rewritten; "Last updated" → 26 July 2026 | `website/privacy.html` |

### Verification

No local Postgres and no Docker on this machine, and production is not a test target for destructive
SQL. Verified instead against **PGlite** (real Postgres 16 compiled to WASM) loaded with the actual
`schema.sql`, in `tmp/be-17-verify/`. The harness copies the statements under test and then asserts
each one appears verbatim in the source file, so the test cannot silently drift from the code.

| Case | Result |
|---|---|
| One clinic, revoke it | snapshot, overlay and history deleted; patient's own cloud backup untouched |
| Two clinics, revoke one | all three **survive**; only the revoked clinic's pending refresh dropped |
| …and the surviving refresh row belongs to the clinic that was not revoked | pass |
| Then revoke the second | everything deleted |
| Three uploads | exactly one row remains, at the newest version |
| Purge a link with nothing pending | no-op |

8/8 pass. `npx tsc --noEmit` clean.

### Left for the reviewer

- `user_cloud_backups` is deliberately untouched: it is the patient's own backup, not clinic data,
  and it has its own delete in `accountBackup.ts`. Confirm that reading of the policy.
- No audit log was added. The draft raised it as a genuine two-sided question and it stayed open;
  logging patient ids at deletion time is its own retention problem.
- **Not deployed.** Deploying is what makes the policy true, so the code and the reworded page should
  go out together.

## Agent checklist

- [ ] Status → in_progress
- [ ] `WHERE` clauses reviewed before running anything destructive
- [ ] All four purge/keep combinations verified against a real database, not reasoned about
- [ ] Status → needs-review — **do not mark done**, and do not deploy
- [ ] Update `drafts/README.md` table
