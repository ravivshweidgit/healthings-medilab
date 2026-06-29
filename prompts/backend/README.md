# Backend prompts — Healthings.ai

Spec/working prompts for the **backend phase**: user accounts, authentication, and
patient ↔ dietitian data sharing (relay).

- App-side prompts live in `../app/`.
- **Done** specs: [`done/`](./done/README.md)
- **Backlog** specs: this folder (`prompt-be-03+`)

## Decisions (locked 2026-06-22, hosting updated 2026-06-29)

| Topic | Choice |
|-------|--------|
| Stack | Node.js Fastify + PostgreSQL |
| Hosting | **Hetzner VPS** → `api.healthings.ai` |
| Repo | Monorepo `/server` |
| Auth MVP | Email OTP + JWT |

## Backlog (`prompts/backend/`)

| File | Topic |
|------|--------|
| `prompt-be-03-account-shares.md` | Patient ↔ mentor link, sponsor billing (spec draft) |

Planned (no spec file yet): **be-04** encrypted sync · **be-05** mentor dashboard API · **be-06** token wallet

## Done (`prompts/backend/done/`)

See [done/README.md](./done/README.md) for summaries.

Recent: **be-07** healthings.ai landing · **be-02b** app login · **be-02** server auth · **be-01** vision

## Principles

- **Local-first**: phone stays source of truth; server syncs/relays.
- **Privacy by default**: E2E encrypted blobs (phase 3+); server never reads health JSON.
- Small, tested, committed steps — same workflow as the app phase.

## Code

Implementation: [`../../server/`](../../server/) · deploy: `server/DEPLOY-HETZNER.md`
