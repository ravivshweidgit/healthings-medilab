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
| `prompt-be-03-account-shares.md` | Patient ↔ clinic link, sponsor flag (spec draft) |
| `prompt-be-04-encrypted-sync.md` | Encrypted blob upload; zero-knowledge relay |
| `prompt-be-05-clinic-dashboard.md` | Clinic web portal — signup, patients, view shared data |
| `prompt-be-06-token-wallet.md` | Token wallet + clinic-sponsored AI billing |

**Build order:** be-03 → be-06 (stub) → be-04 → be-05 · App **`prompt49.txt`** in parallel with be-03/04

## Done (`prompts/backend/done/`)

See [done/README.md](./done/README.md) for summaries.

Recent: **be-07** healthings.ai landing · **be-02b** app login · **be-02** server auth · **be-01** vision

## Principles

- **Local-first**: phone stays source of truth; server syncs/relays.
- **Privacy by default**: E2E encrypted blobs (phase 3+); server never reads health JSON.
- Small, tested, committed steps — same workflow as the app phase.

## Code

Implementation: [`../../server/`](../../server/) · deploy: `server/DEPLOY-HETZNER.md`
