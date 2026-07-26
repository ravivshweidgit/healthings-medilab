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
| `be-08-clinic-portal-ux.md` | Clinic portal UI/UX catalog (C1–C21) | **partial** | Batch A correctness shipped and live. Genuinely open: C6 forms/Enter submit, C8 visible labels on email + code, C12 `:focus-visible`, and busy states on the **login** buttons. Fold these into the next portal batch rather than a standalone pass. C14/C15/C19 handed to be-22 |
| *(panel batch — not yet drafted)* | Clinic panel: worklist + cross-patient table | — | The scalable table: same component at 20 or 200 patients; pagination, saved filters and assignment are additive. Replaces the eight-card column where the patient list comes last. Needs be-23's org resolution first — **be-23 shipped** |
| `be-22-clinic-portal-visual.md` | Clinic portal visual rebuild (2026 level) | **ready, demoted** | **Last.** Was next until 2026-07-26, when the owner asked whether the card-column layout is right for a clinic. It is not, and repainting an information architecture we are about to replace is the wasted work — so this runs after be-23 and the panel, with its token migration folded into whatever layout wins. Content still stands: gate alpha billing behind `?dev=1`, lead the balance with money from the configured pack rate, keep tokens as the metered unit, and treat be-21's 57/57 probe as a non-regression gate |

## Done

See [`done/README.md`](./done/README.md) — be-01 through be-24.

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
| **be-22** last | Repaints the portal be-21 just rewired; correctness before cosmetics — then demoted again behind be-23 and the panel, because the layout itself is what's wrong |
| **be-23** ahead of everything | One-way doors. Schema, consent and audit are brutal to retrofit once real patients exist; UI is changeable any week |
| **be-24** straight after be-23 | A live undisclosed exposure of patient coach chat, found by the owner asking why the workspace has a chat tab at all. Small, and every day it ships later is another day of transcripts on clinicians' screens |

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

```
Next open work after be-23/be-24: either draft the clinic panel batch
(worklist + cross-patient table — see open-batches table), or fold the
remaining be-08 items (C6/C8/C12 + login busy states) into that draft.
Do not start be-22 until the panel IA is settled.

Rules:
- Follow the batch's paths, design, and acceptance criteria exactly.
- Do not mark anything done yourself — wait for owner sign-off.
- Do not commit or deploy unless asked.
```

## Code

Implementation: [`../../server/`](../../server/) · deploy: `server/DEPLOY-HETZNER.md`
