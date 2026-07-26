# Done backend prompts

Shipped backend specs live here. Active / backlog specs stay in `prompts/backend/`.

## Summaries

**prompt-be-01** — done. Vision: local-first, Hetzner hosting, email OTP auth, phased roadmap (sync, mentor shares, billing).

**prompt-be-02** — done (2026-06-28). Server accounts + auth: Fastify, PostgreSQL, OTP/JWT, `/v1/auth/*`, Hetzner deploy. App login → be-02b.

**prompt-be-02b** — done (2026-06-29). App login: LoginScreen, SecureStore tokens, biometric unlock, HTTPS `api.healthings.ai`, Porkbun SMTP OTP. Phone-tested.

**prompt-be-03** — done (2026-06-30). Account shares + AI sponsorship, decoupled: many approved data
shares per patient, one sponsor. `shares.ts`, `sponsorships.ts`, `usage.ts`, `sponsor.ts`. Two files:
the condensed record and `-spec.md`, the full original design.

**prompt-be-04** — done. Encrypted patient sync (zero-knowledge relay): `sync_blobs`,
`server/src/routes/sync.ts`. The snapshot path that `be-15` clinician AI and `be-17` purge-on-unshare
were later built on.

**prompt-be-05** — done. Clinic web portal MVP: `website/clinic/index.html` +
`patient.html`. UI/UX debt → `prompt-be-08`; multi-clinic data-model defects → `opus5/drafts/be-23`.

**prompt-be-06** — done. Token wallet + clinic-sponsored AI: `wallets`, `wallet_ledger`,
`payment_methods`, `routes/wallet.ts`, `resolveAiPayer`. Charging off in alpha
(`BILLING_ENFORCE=false`).

**prompt-be-07** — done (2026-06-29). Landing site https://healthings.ai, APK download, nginx + Certbot, publish/deploy scripts. Play internal → app `prompt47.txt`.

## Still active (`prompts/backend/`)

| File | Topic |
|------|--------|
| `prompt-be-08-clinic-portal-ux.md` | Clinic portal UI/UX catalog (C1–C21) — partial; Batch A live |
| `prompt-be-09-website-ux-review.md` | Pointer → `opus5/` pack |
| **`opus5/drafts/`** | Where all current backend batches live |
