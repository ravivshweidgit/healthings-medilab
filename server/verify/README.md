# Destructive-path verification harnesses

```bash
cd server
npm install
npm run verify          # all three
npm run verify:be-17    # snapshot purge on revoke
npm run verify:be-19    # account deletion
npm run verify:be-24    # coach chat strip on upload
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
| `be-17-snapshot-purge.mjs` | Revoking one clinic link deletes **that org's** workspace and **nothing** belonging to another clinic (be-23 isolation); revoking the last link purges; uploads keep exactly one snapshot row at the newest version |
| `be-19-account-deletion.mjs` | Cascades plus the two rows no cascade reaches; departing-mentor purge (org-scoped); `patient_access_log` excluded from residue and survives deletion; rollback safety; bystander untouched |
| `be-24-chat-strip.mjs` | Upload strip removes `chat_history_*` before hash/store; no-chat payloads stay byte-identical; inflate-bomb rejected; portal no longer parses/merges patient coach chat |
