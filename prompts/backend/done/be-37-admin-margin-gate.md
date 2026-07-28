# be-37 — Admin gate for margin: server-side allowlist + global aggregate

**Status:** done (2026-07-28) — server gate + global margin kept; clinic UI superseded by be-38
**Note:** Owner: admin is not a clinic. Margin block removed from clinic portal in be-38.
**Model to implement:** Fable 5 (Cursor)
**Authored by:** Owner + agent (owner: "why does the clinic see profit? do we need admin account?")
**Depends on:** be-35 (margin endpoint + portal block), be-36 (COGS shrink)

## Problem

Two defects in the be-35 margin view, found by the owner:

1. **Client-side gate.** The portal hides the margin block behind `?dev=1`, but that is a
   sessionStorage flag. `GET /v1/usage/margin` only requires login — any mentor can call it
   and read their revenue-vs-COGS **and Healthings' cost rates**. Unit economics leak to
   customers.
2. **Payer-scoped only.** The owner's mentor account sees only events it pays for. Once a
   second clinic exists there is no platform-wide COGS view at all.

## Design

- **`ADMIN_EMAILS`** env (comma-separated, lowercase-compared). No schema change — a proper
  `admin` role can come later if the operator team grows beyond the owner.
- `/v1/me` returns `isAdmin` so the portal can gate UI server-truthfully.
- `GET /v1/usage/margin` → **admin-only (403 otherwise)** and now aggregates **all payers**
  (global revenue, COGS, margin) — the operator number, not the clinic number.
- Portal: margin block renders only when `me.isAdmin`; `?dev=1` no longer reveals it.
  Title copy `(dev)` → `(admin)` in all 10 locales.
- Non-admin mentors keep usage + billing panels — their own spend is legitimately theirs.

## Files

- `server/src/config.ts` — `ADMIN_EMAILS` + `isAdminEmail()`
- `server/src/routes/auth.ts` — `isAdmin` on `/v1/me`
- `server/src/routes/usage.ts` — admin check on margin route
- `server/src/services/usage.ts` — global aggregation (payer filter optional)
- `website/clinic/index.html` — gate by `isAdmin`, drop dev-mode reliance for this block
- `website/clinic/clinic-i18n.js` — `(dev)` → `(admin)` ×10
- `server/.env.example` — document `ADMIN_EMAILS`

## Acceptance criteria

- [ ] Owner account: margin block visible (no `?dev=1` needed), shows all-payer totals
- [ ] Margin endpoint: 401 unauthenticated, 403 authenticated non-admin
- [ ] `ADMIN_EMAILS` set on VPS; tsc clean; deployed

## Out of scope

- Full `admin` role / separate admin console
- Per-clinic margin drill-down for admin (follow-up if needed)

## Agent checklist

- [x] Server: config + me + route + service
- [x] Portal + i18n (`(dev)` → `(admin)` ×10)
- [x] Deploy + VPS env + verify (owner UI check pending)
