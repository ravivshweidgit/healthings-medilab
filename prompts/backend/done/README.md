# Done backend prompts

Shipped and accepted batches — **record only**. Auto must not implement anything in this folder.

Open batches live one level up in [`prompts/backend/`](../README.md).

Numbering is a single `be-NN` series in chronological discovery order. Before 2026-07-26 these were
split across two folders with two competing prefixes (`prompt-be-NN` here, `be-NN` under
`opus5/drafts/done/`), which produced two different files numbered be-09. One series now, one place.

## be-01 … be-08 — server and portal foundations

**be-01** — done. Vision: local-first, Hetzner hosting, email OTP auth, phased roadmap (sync, mentor
shares, billing).

**be-02** — done (2026-06-28). Server accounts + auth: Fastify, PostgreSQL, OTP/JWT, `/v1/auth/*`,
Hetzner deploy. App login → be-02b.

**be-02b** — done (2026-06-29). App login: LoginScreen, SecureStore tokens, biometric unlock, HTTPS
`api.healthings.ai`, Porkbun SMTP OTP. Phone-tested.

**be-03** — done (2026-06-30). Account shares + AI sponsorship, decoupled: many approved data shares
per patient, one sponsor. `shares.ts`, `sponsorships.ts`, `usage.ts`, `sponsor.ts`. Two files: this
condensed record and `be-03-account-shares-spec.md`, the full original design.

**be-04** — done. Encrypted patient sync (zero-knowledge relay): `sync_blobs`,
`server/src/routes/sync.ts`. The snapshot path that be-15 and be-17 were later built on.

**be-05** — done. Clinic web portal MVP: `website/clinic/index.html` + `patient.html`. UI/UX debt →
be-08; multi-clinic data-model defects → be-23.

**be-06** — done. Token wallet + clinic-sponsored AI: `wallets`, `wallet_ledger`, `payment_methods`,
`routes/wallet.ts`, `resolveAiPayer`. Charging off in alpha (`BILLING_ENFORCE=false`).

**be-07** — done (2026-06-29). Landing site https://healthings.ai, APK download, nginx + Certbot,
publish/deploy scripts. Play internal → app `prompt47.txt`.

**be-08** — done (2026-07-26). Clinic portal UI/UX catalog C1–C21. Correctness and IA shipped via
Batch A / be-21 / be-25; C11 tap targets + C21 localStorage session docs closed in `4581a37`.
Full record: `be-08-clinic-portal-ux.md`.

## be-09 … be-21 — website and portal batches

| File | Title | Shipped |
|------|-------|---------|
| `be-09-copy-and-proof.md` | Landing copy and proof | 2026-07-26 |
| `be-10-design-system.md` | Shared design system (tokens) | 2026-07-26 |
| `be-11-landing.md` | Landing page | 2026-07-26 |
| `be-12-help.md` | Help site (10 locales) | 2026-07-26 |
| `be-13-privacy.md` | Privacy policy page | 2026-07-26 |
| `be-14-patient-workspace.md` | Clinic patient workspace | 2026-07-26 |
| `be-15-patient-web-account.md` | Patient web account | 2026-07-26 |
| `be-16-landing-visual-direction.md` | Landing visual direction | 2026-07-26 — owner: "looks ok" |
| `be-17-snapshot-purge.md` | Snapshot purge on revoke | 2026-07-26 |
| `be-18-privacy-claims-audit.md` | Privacy claims audit + Part B | 2026-07-26 |
| `be-19-account-deletion.md` | Account deletion | 2026-07-26 |
| `be-20-mentor-invite-email.md` | Mentor invite email | 2026-07-26 |
| `be-21-portal-action-feedback.md` | Portal action feedback + sponsorship days | 2026-07-26 |

## be-22 … be-28 — clinic panel visuals, isolation, chat privacy, worklist, i18n, names, workspace IA

| File | Title | Shipped |
|------|-------|---------|
| `be-22-clinic-portal-visual.md` | Workspace tokens/dark + money-led balance + skeletons | 2026-07-26 — owner: "looks good"; `58307ea` |
| `be-23-clinic-isolation-and-audit.md` | Org-scoped overlays + access audit | 2026-07-26 — owner: "looks good"; migrate fix `4a11a51` |
| `be-24-coach-chat-not-shared.md` | Patient coach chat never shared with clinic | 2026-07-26 — owner: "looks good" |
| `be-25-clinic-panel.md` | Patients-first worklist + tokens/dark + i18n plumbing | 2026-07-26 — owner: "looks good"; `c61ea99` |
| `be-26-clinic-portal-i18n.md` | Clinic portal translated into all 10 locales | 2026-07-26 — owner: "looks good"; `db98700` |
| `be-27-patient-names.md` | Patient first/last name for clinic findability | 2026-07-27 — owner: "looks good now"; `2cdbadd`…`6156c30` |
| `be-28-workspace-clinical-ia.md` | Patient workspace: stop mirroring the phone | 2026-07-27 — owner: "Accept be-28"; `ffdc814`…`510afc3` |

be-22 was written first, then mostly absorbed by be-25 on the home page; what shipped under be-22 is the
patient workspace half plus money-led balance. be-25 and be-26 are one decision split in two: the owner
reversed the English-only portal policy mid-be-25, so be-25 kept the plumbing and be-26 filled the nine
remaining locales. Read those two together.

## Retired IDs

**be-09 (the other one)** — `prompt-be-09-website-ux-review.md` was never a batch; it was a router
telling Opus how to run the investigation pack and Auto how to pick up the output. Its content now
lives in [`../briefs/README.md`](../briefs/README.md), which is where a reader looks for it. The ID
is retired so `be-09` means exactly one thing.

## Adding to this folder

When the owner accepts a batch (`Status: done`), move the file here and add a row or paragraph above.
Auto does not do this on its own — see the review loop in [`../README.md`](../README.md).
