# Backend prompts — Healthings.ai

Spec/working prompts for the **backend phase**: user accounts, authentication, and
patient ↔ dietitian data sharing (relay).

- App-side prompts live in `../app/`.
- Backend prompts: `prompt-be-01` (vision) and up.

## Decisions (locked 2026-06-22, hosting updated 2026-06-29)

| Topic | Choice |
|-------|--------|
| Stack | Node.js Fastify + PostgreSQL |
| Hosting | **Hetzner VPS** → `api.healthings.ai` |
| Repo | Monorepo `/server` |
| Auth MVP | Email OTP + JWT |

## Scope of this phase

| Phase | Prompt | Status |
|-------|--------|--------|
| Vision | `prompt-be-01-vision.md` | done |
| Accounts + auth | `prompt-be-02-accounts-auth.md` | done (server) |
| App login | `prompt-be-02b-app-login.md` | **done — phone-tested 2026-06-29** |
| Account shares | `prompt-be-03-account-shares.md` | **spec draft** |
| Encrypted sync | `prompt-be-04` (planned) | backlog |
| Mentor dashboard API | `prompt-be-05` (planned) | backlog |
| Token wallet | `prompt-be-06` (planned) | backlog |

## Principles

- **Local-first**: phone stays source of truth; server syncs/relays.
- **Privacy by default**: E2E encrypted blobs (phase 3+); server never reads health JSON.
- Small, tested, committed steps — same workflow as the app phase.

## Code

Implementation: [`../../server/`](../../server/) · deploy: `server/DEPLOY-HETZNER.md`
