# Backend prompts — Healthings.ai

Server, clinic portal and website work. App-side prompts live in [`../app/`](../app/).

## Layout — one rule

**A file here is open. A file in `done/` is shipped.** There is no third state and no nesting.

```
prompts/backend/
  README.md          ← this file: the index
  be-NN-….md         ← open batches (ready / in_progress / needs-review / blocked)
  done/              ← shipped + owner-accepted (record only; Auto never implements from here)
  briefs/            ← reusable investigation packs and the batch TEMPLATE
```

Numbering is a single `be-NN` series in chronological discovery order, matching how
[`../app/`](../app/) already works (`promptNN.txt` + `done/`). Restructured 2026-07-26: batches used
to be split between this folder and `opus5/drafts/`, with two `done/` folders and two files numbered
be-09. If you are looking for `opus5/` — the investigation briefs are now `briefs/`, and every batch
it produced is in `done/`.

## Open batches

Run in this order. The reason is the dependency, not preference.

| File | Title | Status | Notes |
|------|-------|--------|-------|
| — | be-30 labs + lipids clinical view | not drafted | Needs owner clinical judgment (reference ranges); not an Auto batch |

## Done

See [`done/README.md`](./done/README.md) — be-01 through be-32 (incl. be-08, be-22).

## Status values

| Status | Meaning | Location |
|--------|---------|----------|
| `ready` | Auto may implement | this folder |
| `in_progress` | Auto working | this folder |
| `needs-review` | Waiting on owner / design review | this folder |
| `blocked` | Needs a human decision | this folder |
| `done` | Accepted; record only | `done/` |

## Review loop

```
draft written → Auto implements → Auto sets needs-review + attaches evidence
   → owner reviews → accepted (move to done/) or a follow-up batch
```

**Auto must not mark a batch `done` on its own.** Set `needs-review`, attach the evidence the batch
asks for, and stop. Owner acceptance ("looks ok", "lgtm", "works") is what moves it to `done/`.

## Execution history (why the numbers are scrambled)

File numbers are chronological discovery order, not the only run order. What actually mattered:

| Batch | Why it sat where it did |
|---|---|
| **be-10** before cosmetics | Tokens consumed by everything later |
| **be-09** after be-10 despite the number | Added mid-flight; copy must land before be-11 / be-16 |
| **be-17 / be-18** before be-15 | Policy and purge promises had to be true before the patient account page |
| **be-16** pulled forward | Owner's standing "does not look 2026" complaint; only needed be-10 + be-11 |
| **be-22** last, then rescoped | Repaints the portal be-21 just rewired; correctness before cosmetics — demoted behind be-23 and the panel because the layout itself was what's wrong. be-25 then rewrote that page's CSS from scratch, so tokenizing it there was free and be-22 lost most of its scope to the batch it was waiting on. When a paint batch queues behind a structural one, expect the structural one to absorb it |
| **be-23** ahead of everything | One-way doors. Schema, consent and audit are brutal to retrofit once real patients exist; UI is changeable any week |
| **be-24** straight after be-23 | A live undisclosed exposure of patient coach chat, found by the owner asking why the workspace has a chat tab at all. Small, and every day it ships later is another day of transcripts on clinicians' screens |
| **be-25** before be-22 | Panel IA first; painting the old card column is wasted work |
| **be-26** after be-25 | The English-only portal policy was reversed while be-25 was mid-flight ("we are global, global for clinics"). Splitting plumbing from translation kept be-25 reviewable: be-25 guarantees no new inline English, be-26 fills 9 locales |
| **be-27** after be-25/26 | Clinics find people by name; email-only worklists were not clinic practice |

## Decisions (locked 2026-06-22, hosting updated 2026-06-29)

| Topic | Choice |
|-------|--------|
| Stack | Node.js Fastify + PostgreSQL |
| Hosting | **Hetzner VPS** → `api.healthings.ai` |
| Repo | Monorepo `/server` |
| Auth MVP | Email OTP + JWT |

## Principles

- **Local-first**: phone stays source of truth; server syncs and relays.
- **Privacy by default**: encrypted blobs; server never reads health JSON.
- Small, tested, committed steps — same workflow as the app phase.

## Deploy

Human-owned. `git pull --ff-only` then `bash server/scripts/deploy-website.sh` on the VPS — see
`server/DEPLOY-WEBSITE.md`. Verify a deploy by checking the cache token on a live page rather than
trusting the script's exit code.

## Auto kickoff (paste)

**be-28 is `done`.** **be-29 is `ready`** (workspace `clinicLocale`).

```
To implement workspace i18n: open be-29-workspace-i18n.md and ship.
be-30 labs clinical view still needs owner judgment before drafting.
```

## Code

Implementation: [`../../server/`](../../server/) · deploy: `server/DEPLOY-HETZNER.md`
