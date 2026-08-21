# be-51 — Refresh slide so install/kill cannot kick Sign in

**Status:** done (2026-08-21). Owner: phone looks ok. Commit `3065a16`.

## Builds on

- be-02 / be-02b (OTP + JWT + SecureStore)
- prompt105 (session expiry must not open Quick Start; daily auth log)

## Problem

Phone was kicked to Sign in 2–3 times in one day. Access is 15 minutes; refresh 401 calls `clearAuthTokens`. Refresh **rotated** the token (revoke old, issue new). A process kill in that window (`bi`, Play install, OS death) left SecureStore holding the revoked token → next open 401 → Sign in.

A second wipe: refresh succeeded, then `/me` 401/403 cleared the new tokens.

## What shipped

| Piece | Detail |
|-------|--------|
| `rotateRefreshToken` | Slide `expires_at` +30 days on the **same** token. Logout still revokes all. |
| `refreshAuthSessionOnce` | After a successful refresh, `/me` failure keeps tokens (cached user or JWT decode). |
| `clearAuthTokens(reason)` | Daily log `tokens_cleared reason=…` (`refresh_rejected`, `logout`, …). |

## Files

- `server/src/services/jwt.ts`
- `app/src/services/AuthApiService.ts`
- `app/src/services/AuthTokenStore.ts`

## Phone-tested

- [x] Android after `bi` — owner: phone looks ok
- [ ] Kick does not recur over a day with installs / background kill
- [ ] Account → Share app log shows `tokens_cleared` only on real Sign out / dead token

## Related (same phone build, later commit)

- Meal `rule_message` must match the item’s name and macros (do not invent “contains 2% fat” on 0% yogurt). `userRulesContext.ts`, `GeminiService.ts`.
