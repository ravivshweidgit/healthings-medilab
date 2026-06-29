# Done backend prompts

Shipped backend specs live here. Active / backlog specs stay in `prompts/backend/`.

## Summaries

**prompt-be-01** — done. Vision: local-first, Hetzner hosting, email OTP auth, phased roadmap (sync, mentor shares, billing).

**prompt-be-02** — done (2026-06-28). Server accounts + auth: Fastify, PostgreSQL, OTP/JWT, `/v1/auth/*`, Hetzner deploy. App login → be-02b.

**prompt-be-02b** — done (2026-06-29). App login: LoginScreen, SecureStore tokens, biometric unlock, HTTPS `api.healthings.ai`, Porkbun SMTP OTP. Phone-tested.

**prompt-be-07** — done (2026-06-29). Landing site https://healthings.ai, APK download, nginx + Certbot, publish/deploy scripts. Play internal → app `prompt47.txt`.

## Backlog (`prompts/backend/`)

| File | Topic |
|------|--------|
| `prompt-be-03-account-shares.md` | Patient ↔ mentor link, sponsor billing (draft) |
| be-04+ | Encrypted sync, mentor dashboard API, token wallet (planned, no files yet) |
