# be-38 — Dedicated `/admin/` operator console (margin ≠ clinic)

**Status:** done (2026-07-28) — owner: `/admin/` looks good (wide layout)  
**Follow-up (2026-08-05):** Active users day picker (Prev / date / Today / Next) + click Margin day → who used AI that local day (`website/admin/index.html`; API already had `from`/`to`).
**Model to implement:** Fable 5 (Cursor)
**Authored by:** Owner + agent (owner: admin is not a clinic; use `raviv.shweid+admin@gmail.com`)
**Depends on:** be-37 (`ADMIN_EMAILS`, admin-only `GET /v1/usage/margin`, global aggregate)
**Supersedes:** be-37 clinic-portal margin UI (server gate stays)

## Problem

be-37 put Margin on the clinic portal behind `isAdmin`. That still mixes products:
clinic tool vs Healthings operator console. The owner's patient Gmail is not a clinic
account (`mentorOnly` on login). Admin must not require a mentor/clinic role.

## Goal

- **`https://healthings.ai/admin/`** — OTP login for `ADMIN_EMAILS` only; shows global
  margin (all payers). Separate token key from clinic/account.
- **Clinic portal** — no margin block at all (usage + billing stay; those are clinic spend).
- Admin identity may be any role (`patient` placeholder on first OTP is fine); gate is
  email allowlist, not `role === 'mentor'`.
- VPS: `ADMIN_EMAILS=raviv.shweid+admin@gmail.com`

## Design

- OTP `purpose: 'admin'` on request → 403 if email not on allowlist (no code sent).
- `/v1/me` still returns `isAdmin`; admin page refuses non-admin after verify.
- Reuse clinic portal CSS/theme; English-only operator copy for alpha.
- `HealthingsApi.createClient('healthings_admin_tokens')` — no shared session with clinic.

## Files

- `website/admin/index.html` — login + margin tables
- `website/clinic/index.html` — remove margin UI / fetch
- `server/src/routes/auth.ts` — optional `purpose: 'admin'` on OTP request
- `server/.env.example` — document +admin example
- `prompts/backend/be-38-…` + README; note be-37 clinic UI superseded

## Acceptance criteria

- [ ] `/admin/` sign-in with +admin email → margin visible
- [ ] Non-allowlist email → OTP request 403; clinic mentors see no margin on `/clinic/`
- [ ] Clinic login with patient Gmail still mentorOnly (unchanged)
- [ ] Deployed; `ADMIN_EMAILS` updated on VPS

## Out of scope

- Full admin role / multi-operator console
- Translating admin UI to 10 locales

## Agent checklist

- [x] Spec + README
- [x] Strip clinic margin; build `/admin/`
- [x] OTP purpose gate; deploy + env (owner OTP check pending)