# Backend Phase 1b — App login (email OTP + biometric unlock)

**Status: shipped (2026-06-29)** — phone-tested  
Builds on **prompt-be-02-accounts-auth.md**.

---

## Problem

Backend auth exists but the phone app had no identity — no way to sign in against `api.healthings.ai`.

## What ships

| Area | Detail |
|------|--------|
| API client | `AuthApiService.ts` — OTP request/verify, refresh, `/v1/me`, logout |
| Token storage | `AuthTokenStore.ts` — SecureStore (`healthings_access_token`, `healthings_refresh_token`) |
| Login gate | `LoginScreen.tsx` — required email OTP before dashboard |
| Account | `AccountStrip.tsx` — email, role, biometric toggle, sign out |
| Biometric | `BiometricUnlockService.ts` — fingerprint/Face ID on app open (optional) |
| Config | `HEALTHINGS_API_URL` in `.env` (default `https://api.healthings.ai`) |
| Server email | `email.ts` — Porkbun SMTP port 587, console fallback on send failure |
| Deploy scripts | `set-smtp-porkbun.sh`, `enable-tls.sh`, `enable-smtp.sh` |

### UX rules

- **Required sign-in** — no skip; dashboard only after OTP verify
- Session persists via refresh token (~30 days); silent refresh on API calls
- Role picker before first verify (patient default)
- **One-time prompt** after first login: enable fingerprint unlock
- **Account toggle** — unlock with fingerprint on/off
- **Keyboard** — login form scrolls above keyboard on code entry
- **HTTPS only** — `http://` POST redirects break OTP on Android (301 → GET → 404)

### Biometric unlock

- `expo-local-authentication` — prompt on cold start when enabled + tokens exist
- Cancel biometric → login screen (email OTP); tokens kept until sign out
- Android: fingerprint reliable; face unlock may not work with strict keystore (documented)

## Primary files

| Path | Purpose |
|------|---------|
| `app/src/services/AuthApiService.ts` | REST + auto-refresh |
| `app/src/services/AuthTokenStore.ts` | SecureStore keys |
| `app/src/services/BiometricUnlockService.ts` | Fingerprint gate + prefs |
| `app/src/screens/LoginScreen.tsx` | Required sign-in gate |
| `app/src/components/AccountStrip.tsx` | Account + biometric toggle |
| `app/App.tsx` | Boot: biometric → restore → login or dashboard |
| `app/src/config/env.ts` | `healthingsApiUrl` |
| `app/src/screens/DashboardScreen.tsx` | Passes user + onSignedOut |
| `server/src/services/email.ts` | OTP email (console fallback) |
| `server/DEPLOY-HETZNER.md` | TLS + Porkbun SMTP |

## Server validation

`server/scripts/smoke-test.sh` — full OTP flow on VPS (see `DEPLOY-HETZNER.md` §2).

Production (2026-06-29): Let's Encrypt HTTPS on `api.healthings.ai`; Porkbun `otp@healthings.ai` SMTP port 587.

## Phone-tested

- [x] Send OTP from phone (real email / SMTP)
- [x] Verify code → signed in, email shown
- [x] Kill app → reopen → still signed in
- [x] Sign out → returns to login screen
- [x] Biometric prompt after login; fingerprint unlock on reopen
- [x] Account toggle enables/disables fingerprint
- [x] Login keyboard does not hide code input

## Deferred → prompt-be-03

→ **`prompt-be-03-account-shares.md`** — optional clinic link; mentor pays AI when approved.

## Related

- **prompt-be-02** — server auth endpoints
- **prompt-be-01** — vision + roadmap
