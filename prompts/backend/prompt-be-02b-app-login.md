# Backend Phase 1b — App login (email OTP)

**Status: shipped (2026-06-28)** — pending phone test  
Builds on **prompt-be-02-accounts-auth.md**.

---

## Problem

Backend auth exists but the phone app had no identity — no way to sign in against `api.healthings.ai`.

## What ships

| Area | Detail |
|------|--------|
| API client | `AuthApiService.ts` — OTP request/verify, refresh, `/v1/me`, logout |
| Token storage | `AuthTokenStore.ts` — SecureStore (`healthings_access_token`, `healthings_refresh_token`) |
| UI | `AccountStrip.tsx` on dashboard — email, role (patient/mentor), OTP, skip, sign out |
| Config | `HEALTHINGS_API_URL` in `.env` (default `https://api.healthings.ai`) |

### UX rules

- Account is **optional** — “Skip for now” collapses strip; all local flows unchanged
- No password — email + 6-digit code only at sign-in
- Session persists via refresh token (~30 days); silent refresh on API calls
- Role picker shown only before first verify (patient default)

## Primary files

| Path | Purpose |
|------|---------|
| `app/src/services/AuthApiService.ts` | REST + auto-refresh |
| `app/src/services/AuthTokenStore.ts` | SecureStore keys |
| `app/src/components/AccountStrip.tsx` | Dashboard account UI |
| `app/src/config/env.ts` | `healthingsApiUrl` |
| `app/src/screens/DashboardScreen.tsx` | Renders AccountStrip above backup |

## Server validation

`server/scripts/smoke-test.sh` — full OTP flow on VPS (see `DEPLOY-HETZNER.md` §2).

## Phone-tested

- [ ] Send OTP from phone (real email / SMTP)
- [ ] Verify code → signed in, email shown
- [ ] Kill app → reopen → still signed in
- [ ] Sign out → local app still works
- [ ] Skip for now → no account required

## Deferred → prompt-be-03

→ **`prompt-be-03-account-shares.md`** — optional clinic link; mentor pays AI when approved.

## Related

- **prompt-be-02** — server auth endpoints
- **prompt-be-01** — vision + roadmap
