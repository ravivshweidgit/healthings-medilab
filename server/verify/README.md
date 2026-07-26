# Destructive-path verification harnesses

```bash
cd server
npm install
npm run verify          # both
npm run verify:be-17    # snapshot purge on revoke
npm run verify:be-19    # account deletion
```

## Why these exist as repo files

They cover the paths that **delete user data**, where a bug is unrecoverable and production is not an
acceptable test target. They were written as throwaway scripts in `tmp/` during be-17 and be-19; they
are tracked now because later batches (be-23 onward) change the tables they delete from, and a gate
that lives in a gitignored folder is not a gate.

## How they work

Real Postgres 16 via **PGlite** (WASM), loaded with the actual `src/db/schema.sql` — no local Postgres
or Docker required. Each harness copies the SQL under test from the source and calls `assertInSource()`,
so if the service drifts from what is verified here the run **fails loudly** rather than passing against
a stale copy. That check is the reason these are worth keeping: the assertions cannot silently go out of
date.

## Rules

- Paths resolve from the script's own location. Do not reintroduce an absolute path.
- Do not weaken an assertion to make a run pass. If behaviour legitimately changed, update the copied
  SQL **and** say so in the batch draft.
- Add cases here rather than starting a new throwaway harness in `tmp/`.

## Coverage

| Harness | Asserts |
|---|---|
| `be-17-snapshot-purge.mjs` | Revoking one clinic link deletes that link's data and **nothing** belonging to another clinic; revoking the last link purges; uploads keep exactly one snapshot row at the newest version |
| `be-19-account-deletion.mjs` | Cascades plus the two rows no cascade reaches (`otp_requests` keyed by email, `account_shares` with a null `patient_id`); departing-mentor purge; rollback safety; deletion scoped to one account so a bystander keeps every row |
