# Implementation drafts (Opus → Auto)

Opus 5 writes shippable batch prompts here after pass `06`.  
**Auto** implements only files in **this folder** with `Status: ready`.

```
drafts/
  TEMPLATE.md          ← new draft shape
  be-NN-….md           ← ready / in_progress / blocked (active)
  done/                ← shipped + accepted (record only)
  README.md            ← this file
```

When a batch is accepted, move it to `done/` and add a one-line entry in `done/README.md`.

## Active backlog

Run in this order. The reason is the dependency, not preference.

| File | Title | Status | Notes |
|------|-------|--------|-------|
| `be-23-clinic-isolation-and-audit.md` | Clinic isolation + access audit | **ready** | **First — these are the one-way doors.** Written 2026-07-26 after the owner asked why we don't just build for big clinics. The UI was never what blocked them. Two verified schema defects: `clinic_patient_overlays` is `PRIMARY KEY (patient_id)` while `account_shares` is unique per *pair*, so a patient linking two practices lets clinic B silently overwrite clinic A's dietary rules **and** read clinic A's private AI chat — a live cross-clinic confidentiality leak. And a search for `audit`/`access_log`/`read_log` across `server/src` returns **nothing**: no record of which clinician ever opened which record, and it cannot be backfilled. Owner settled consent as **clinic-scoped with per-clinician private chat**, so the overlay splits into `clinic_org_overlays` (patient+org) and `clinic_clinician_chats` (patient+clinician), plus a minimal `organizations`/`org_members` where migration makes every existing mentor a one-person clinic — the door opens without building the room. Audit log deliberately takes **no FK on `patient_id`** (an audit trail that deletes itself is not one) and must be excluded from be-19's residue check. Logging goes at the ~6 data-serving sites, **not** inside `hasApprovedShare`, which is also called for permission probes and would drown real reads. The three duplicated `assertMentorPatientAccess` helpers consolidate into one. Migration has an explicit ambiguity ladder ending in *fail loudly, delete nothing* — dropping a patient's clinical rules to satisfy a migration is worse than a failed migration. be-17 and be-19 harnesses are the gate, plus a two-org isolation case the old schema could not express |
| *(panel batch — not yet drafted)* | Clinic panel: worklist + cross-patient table | — | The scalable table: same component at 20 or 200 patients; pagination, saved filters and assignment are additive. Replaces the eight-card column where the patient list comes last. Needs be-23's org resolution first |
| `be-22-clinic-portal-visual.md` | Clinic portal visual rebuild (2026 level) | **ready, demoted** | **Last.** Was next until 2026-07-26, when the owner asked whether the card-column layout is right for a clinic. It is not, and repainting an information architecture we are about to replace is the wasted work — so this now runs after be-23 and the panel, with its token migration folded into whatever layout wins. Content still stands: gate alpha billing behind `?dev=1`, lead the balance with money from the configured pack rate, keep tokens as the metered unit, and treat be-21's 57/57 probe as a non-regression gate |

## Done

See [`done/README.md`](done/README.md) — be-09 through be-21.

## Execution history (why the numbers are scrambled)

File numbers are chronological discovery order, not the only run order. What actually mattered:

| Batch | Why it sat where it did |
|---|---|
| **be-10** before cosmetics | Tokens consumed by everything later |
| **be-09** after be-10 despite the number | Added mid-flight; copy must land before be-11 / be-16 |
| **be-17 / be-18** before be-15 | Policy and purge promises had to be true before the patient account page |
| **be-16** pulled forward | Owner's standing “does not look 2026” complaint; only needed be-10 + be-11 |
| **be-22** last | Repaints the portal be-21 just rewired; correctness before cosmetics — then demoted again behind be-23 and the panel, because the layout itself is what's wrong |
| **be-23** ahead of everything | One-way doors. Schema, consent and audit are brutal to retrofit once real patients exist; UI is changeable any week |

## Status values

| Status | Meaning | Location |
|--------|---------|----------|
| `ready` | Auto may implement | this folder |
| `in_progress` | Auto working | this folder |
| `needs-review` | Waiting on design / owner review | this folder |
| `blocked` | Needs human decision | this folder |
| `done` | Accepted; record only | `done/` |

## Review loop (Opus ↔ Auto)

```
Opus writes draft → Auto implements → Auto sets needs-review + attaches evidence
   → Opus / owner reviews → accepted (move to done/) or a follow-up draft
```

**Auto must not mark a batch `done` on its own.** Set `needs-review`, attach the evidence the draft asks for, and stop. Owner acceptance (e.g. “looks ok”, “lgtm”, “works”) is what moves it to `done/`.

## Deploy

Human-owned. `git pull --ff-only` then `bash server/scripts/deploy-website.sh` on the VPS — see `server/DEPLOY-WEBSITE.md`. Verify a deploy by checking the cache token on a live page rather than trusting the script's exit code.

## Auto kickoff (paste)

```
Implement prompts/backend/opus5/drafts/be-23-clinic-isolation-and-audit.md
(ignore drafts/done/ — those are shipped records). Stop after be-23 so I can
verify before you continue.

Rules:
- Follow the draft's paths, design, and acceptance criteria exactly. Do not
  redesign beyond it, and do not touch files it lists as off-limits.
- This batch migrates consent rows. Before writing any migration, read
  server/src/db/schema.sql end to end — do not assume "everything cascades".
- Gate: `cd server && npm install && npm run verify` must pass
  (be-17 8/8, be-19 28/28) plus the new two-org isolation case. Those harnesses
  copy the SQL under test from the source and assert it is still there, so
  renaming the overlay tables WILL fail them. Update the copied SQL; never
  weaken an assertion to go green.
- The migration's ambiguity ladder ends in "fail loudly, delete nothing".
  Never drop a patient's clinical rules to make a migration succeed.
- patient_access_log deliberately has no FK on patient_id, and must be added to
  be-19's residue exclusion list — otherwise its own test will report it as a leak.
- Mark Status: in_progress when you start. When the acceptance criteria pass, set
  Status: needs-review, attach the evidence its review section asks for, and stop.
  Do not mark anything done yourself — wait for owner sign-off, then move to done/.
- Do not commit or deploy. Both are human-owned.
```
