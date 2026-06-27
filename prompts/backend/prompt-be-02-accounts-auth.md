# Backend Phase 1 — Accounts + Auth (email OTP)

**Status: in progress (2026-06-22)**  
Builds on **prompt-be-01-vision.md** §7 phase 1.

### Decisions (locked)

- Monorepo `server/` · Fastify + PostgreSQL · Hostinger VPS
- Email OTP only (no password) · JWT access + refresh
- Roles: `patient` | `mentor` (set at first signup; immutable in MVP)

---

## Problem

App is single-device, no identity. Clinic alpha and mentor sharing need accounts before encrypted sync (phase 3).

## What ships (this prompt only)

| Endpoint | Method | Auth | Body | Response |
|----------|--------|------|------|----------|
| `/health` | GET | — | — | `{ ok, version }` |
| `/v1/auth/otp/request` | POST | — | `{ email, role? }` | `{ sent: true }` |
| `/v1/auth/otp/verify` | POST | — | `{ email, code }` | `{ accessToken, refreshToken, user }` |
| `/v1/auth/refresh` | POST | — | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| `/v1/auth/logout` | POST | Bearer | — | `{ ok: true }` |
| `/v1/me` | GET | Bearer | — | `{ user }` |

No sync, billing, or `account_shares` in this phase.

### OTP rules

- 6-digit code · **10 min** expiry · max **5** verify attempts per request
- Rate limit: **3** OTP requests per email per **15 min**
- Dev: `SMTP_MODE=console` logs code (no mail sent)

### JWT

- Access: **15 min** · signed `HS256` · payload `{ sub, email, role }`
- Refresh: **30 days** · stored hashed in DB · rotated on refresh

---

## Database schema

```sql
users (id uuid PK, email citext UNIQUE, role text, created_at, updated_at)
otp_requests (id uuid PK, email citext, code_hash text, role text, expires_at, attempts int, created_at)
refresh_tokens (id uuid PK, user_id FK, token_hash text, expires_at, revoked_at, created_at)
```

---

## Primary files

| Path | Purpose |
|------|---------|
| `server/package.json` | deps + scripts |
| `server/src/index.ts` | Fastify bootstrap |
| `server/src/config.ts` | env validation |
| `server/src/db/schema.sql` | migrations |
| `server/src/routes/auth.ts` | OTP + JWT routes |
| `server/src/services/email.ts` | SMTP / console |
| `server/.env.example` | local + Hostinger template |
| `server/DEPLOY-HOSTINGER.md` | VPS setup |

---

## Deploy (Hostinger VPS)

1. Ubuntu 22.04+ VPS · install Node 20, PostgreSQL 15, nginx
2. Create DB + user · run `npm run migrate`
3. systemd unit for `node dist/index.js` · nginx → `127.0.0.1:3000`
4. TLS via Certbot · DNS `api.healthings.ai` → VPS IP
5. SMTP: Hostinger mailbox or Resend for OTP mail

---

## App integration (phase 1b — separate app prompt)

- SecureStore: `healthings_access_token`, `healthings_refresh_token`
- Settings: email login · optional “skip for now” (local-only mode preserved)
- All existing flows work offline without account

---

## Phone-tested

- [ ] `curl` OTP flow on VPS
- [ ] App login screen (future `prompt-be-02b` or app prompt)

## Deferred → prompt-be-03

- `account_shares` request/approve
- Encrypted sync blob upload/download

## Related

- **prompt-be-01** — vision + roadmap
- **LocalBackupService** — future sync payload spec
