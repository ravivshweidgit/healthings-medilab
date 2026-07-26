# Backend prompts — Healthings.ai

Spec/working prompts for the **backend phase**: user accounts, authentication, and
patient ↔ dietitian data sharing (relay).

- App-side prompts live in `../app/`.
- **Done** specs: [`done/`](./done/README.md)
- **Active** specs: [`opus5/drafts/`](./opus5/drafts/README.md) — new backend batches go there
- This folder holds only the be-08 UX catalog and the be-09 pointer

## Decisions (locked 2026-06-22, hosting updated 2026-06-29)

| Topic | Choice |
|-------|--------|
| Stack | Node.js Fastify + PostgreSQL |
| Hosting | **Hetzner VPS** → `api.healthings.ai` |
| Repo | Monorepo `/server` |
| Auth MVP | Email OTP + JWT |

## Active (`prompts/backend/`)

Reconciled 2026-07-26: be-03, be-04, be-05 and be-06 all shipped weeks ago but were still labelled
"backlog (spec draft)". They are now in `done/` with corrected headers. Only two files remain here,
and neither is a plain backlog batch.

| File | Topic | State |
|------|--------|-------|
| `prompt-be-08-clinic-portal-ux.md` | Clinic portal UI/UX catalog (C1–C21) | **Partial** — Batch A live; C6/C8/C12 + login busy state open; C14/C15/C19 moved to `opus5/drafts/be-22` |
| `prompt-be-09-website-ux-review.md` | Pointer → **`opus5/`** pack | Router, not a batch — stays here while the pack is active |
| **`opus5/`** | Ordered Opus 5 website UX passes (`00`–`06`) + `drafts/` for Auto | Active — see [`opus5/drafts/README.md`](./opus5/drafts/README.md) |

**Where new backend work goes:** `opus5/drafts/`, not this folder. The `prompt-be-NN` numbering
stopped at be-09; everything since is a `be-NN` batch inside the opus5 pack.

**Historical build order:** be-03 → be-06 (stub) → be-04 → be-05 · App **`prompt49.txt`** in
parallel with be-03/04 · **be-08** after be-05 live · **opus5/** (Opus) then Auto on `opus5/drafts/`

## Done (`prompts/backend/done/`)

See [done/README.md](./done/README.md) for summaries.

Recent: **be-06** token wallet · **be-05** clinic portal MVP · **be-04** encrypted sync · **be-03**
account shares · **be-07** healthings.ai landing · **be-02b** app login · **be-02** server auth ·
**be-01** vision

## Principles

- **Local-first**: phone stays source of truth; server syncs/relays.
- **Privacy by default**: E2E encrypted blobs (phase 3+); server never reads health JSON.
- Small, tested, committed steps — same workflow as the app phase.

## Code

Implementation: [`../../server/`](../../server/) · deploy: `server/DEPLOY-HETZNER.md`
