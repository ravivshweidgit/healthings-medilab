# Backend prompts — Healthings.ai

Spec/working prompts for the **backend phase**: user accounts, authentication, and
patient ↔ dietitian data sharing (P2P / relay).

- App-side prompts (the React Native client, prompt01–prompt28) live in `../app/`.
- Backend prompts start here at `prompt-be-01` and up.

## Scope of this phase
- User accounts + auth (identity for patient and dietitian)
- `account_shares` relationship model (request / approve)
- Encrypted data sync between paired accounts (zero-knowledge to the server)
- Dietitian dashboard (view a shared patient's existing charts/metrics)
- Domain: `api.healthings.ai` (REST) + `wss://rt.healthings.ai` (signaling / live)

## Principles carried over from the app
- **Local-first**: the phone stays the source of truth; the server syncs/relays, it does not own the data.
- **Privacy by default**: prefer end-to-end encryption so the server cannot read health data.
- Small, tested, committed steps — same workflow as the app phase.
