# Healthings API (Phase 1)

Email OTP authentication for MediLab / Healthings.ai.

- Spec: [`../prompts/backend/done/prompt-be-02-accounts-auth.md`](../prompts/backend/done/prompt-be-02-accounts-auth.md)
- Deploy: [DEPLOY-HETZNER.md](./DEPLOY-HETZNER.md)

## Quick start

```bash
npm install
cp .env.example .env
npm run migrate
npm run dev
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| POST | `/v1/auth/otp/request` | Send OTP |
| POST | `/v1/auth/otp/verify` | Exchange code for JWT |
| POST | `/v1/auth/refresh` | Rotate refresh token |
| POST | `/v1/auth/logout` | Revoke sessions (Bearer) |
| GET | `/v1/me` | Current user (Bearer) |
