# Backend Phase 2 — Account shares (patient ↔ mentor / clinic)

**Status: done (shipped 2026-06-30)** — header corrected 2026-07-26. This is the **full original
spec**; the condensed shipped record with the endpoint table and phone-test checklist is
`done/prompt-be-03-account-shares.md`. Both are kept: the summary is the record of what landed, this
file is the design rationale behind it.  
Builds on **`done/prompt-be-02-accounts-auth.md`** · **`done/prompt-be-02b-app-login.md`**.

### Decisions (locked 2026-06-29)

- **Clinic = mentor account** — one `role: mentor` user per clinic (not a separate “alpha site”)
- **Link is optional** — solo patients use the app without a mentor; they import a nutritionist report locally (app prompt, not this spec)
- **Personal plan per patient** — licensed nutritionist instructions → app **My Rules** (local import); server only stores the **relationship**, not the plan text
- **Mentor pays AI** for **approved** linked patients — sponsored debit from mentor wallet (**prompt-be-06**); no patient card required while sponsored
- **Many clinics** — same API for every mentor; no per-clinic deploy
- Bidirectional onboarding — mentor invites patient **or** patient requests mentor; other party approves
- **One active sponsor mentor per patient** (MVP) — ~~superseded~~ **decoupled in shipped code:** many shares; optional `ai_sponsorships` with split % (see `done/prompt-be-03-account-shares.md`)

---

## Problem

Accounts exist (`be-02`) but there is no server-side link between a **patient** and a **clinic/mentor**. Without that:

- Cannot attribute AI usage to the paying mentor
- Cannot gate encrypted sync to an approved mentor (`be-04`)
- Cannot list “my patients” / “my clinic” in the app

---

## Product paths (both use the same link table)

| Path | Mentor link | AI payer (when `be-06` live) | Plan source |
|------|-------------|--------------------------------|-------------|
| **Clinic patient** | Approved link to clinic mentor | **Mentor** | Import personal RD report → My Rules (app) |
| **Solo patient** | None (or link added later) | **Patient** wallet | Import any RD report → My Rules (app) |

Linking does **not** replace report import. Linking = **identity + sponsorship + future data share**.

---

## What ships (this prompt only)

### Endpoints

| Endpoint | Method | Auth | Role | Body | Response |
|----------|--------|------|------|------|----------|
| `/v1/shares/invite` | POST | Bearer | **mentor** | `{ patientEmail }` | `{ share }` |
| `/v1/shares/request` | POST | Bearer | **patient** | `{ mentorEmail }` | `{ share }` |
| `/v1/shares` | GET | Bearer | patient or mentor | `?status=` optional | `{ shares[] }` |
| `/v1/shares/:id/approve` | POST | Bearer | counterparty | — | `{ share }` |
| `/v1/shares/:id/reject` | POST | Bearer | counterparty | — | `{ share }` |
| `/v1/shares/:id/revoke` | POST | Bearer | either party | — | `{ share }` |
| `/v1/shares/pending-for-me` | GET | Bearer | any | — | `{ shares[] }` | invites awaiting my action |

No wallet, Stripe, Gemini proxy, or encrypted blobs in this phase.

### Share object (JSON)

```json
{
  "id": "uuid",
  "patientId": "uuid | null",
  "patientEmail": "user@example.com",
  "mentorId": "uuid",
  "mentorEmail": "clinic@example.com",
  "status": "pending | approved | rejected | revoked",
  "sponsorAi": true,
  "initiatedBy": "patient | mentor",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "approvedAt": "ISO | null"
}
```

### State machine

```
pending ──approve──► approved ──revoke──► revoked
   │                    │
   reject               reject (only from pending)
   ▼                    ▼
rejected             (terminal)
```

- **Approve** — only the **non-initiator** (counterparty)
- **Reject** — only the **non-initiator**, only from `pending`
- **Revoke** — either party from `approved` → `revoked` (ends sponsorship)

### Rules

1. **Role enforcement** — `patient_id` user must have `role = patient`; `mentor_id` must have `role = mentor`
2. **Email normalization** — store/compare emails as `citext` lowercase
3. **Duplicate pending** — reject second `pending` invite/request for same `(mentor_id, patient_email)` pair
4. **One sponsor (MVP)** — approving a new `sponsor_ai` link auto-revokes any other `approved` sponsor link for that patient (or reject approve with `409` — **implement auto-revoke** for simpler clinic handoff)
5. **Pre-registration invite** — mentor invites unknown email → `patient_id = null`, `patient_email` set; when patient registers/verifies OTP with that email, set `patient_id` and surface pending shares in app
6. **Self-link** — forbidden (mentor email = patient email → `400`)
7. **Sponsor flag** — `sponsor_ai = true` on all new shares (MVP); future: optional non-sponsored share for data-only

### Sponsor resolution (for `be-06`)

Helper used later by AI billing — document contract now:

```ts
resolveAiPayer(userId: patientId): { payerUserId: uuid, sponsored: boolean }
```

- If patient has **one** `approved` share with `sponsor_ai` → payer = `mentor_id`, `sponsored = true`
- Else → payer = `patient_id`, `sponsored = false`

Alpha (`PAYMENTS_ENABLED=false` in `be-06`): still call resolver for **usage logs** per mentor.

---

## Database schema

```sql
CREATE TABLE IF NOT EXISTS account_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users (id) ON DELETE CASCADE,
  patient_email CITEXT NOT NULL,
  mentor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  sponsor_ai BOOLEAN NOT NULL DEFAULT TRUE,
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('patient', 'mentor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (patient_id IS NULL OR patient_id != mentor_id)
);

CREATE INDEX IF NOT EXISTS idx_shares_mentor_status
  ON account_shares (mentor_id, status);

CREATE INDEX IF NOT EXISTS idx_shares_patient_status
  ON account_shares (patient_id, status)
  WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shares_patient_email_pending
  ON account_shares (patient_email, status)
  WHERE patient_id IS NULL;

-- At most one approved sponsor per patient (MVP)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_one_sponsor_per_patient
  ON account_shares (patient_id)
  WHERE status = 'approved' AND sponsor_ai = TRUE AND patient_id IS NOT NULL;
```

Optional on `users` for clinic display (same migration or small follow-up):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
-- mentors may PATCH /v1/me { displayName } — clinic name shown to patients
```

---

## Primary files

| Path | Purpose |
|------|---------|
| `server/src/db/schema.sql` | `account_shares` + optional `display_name` |
| `server/src/routes/shares.ts` | REST handlers |
| `server/src/routes/plans.ts` | medical plan PDF relay |
| `server/src/services/plans.ts` | upload/download; share gate |
| `server/src/services/shares.ts` | state machine, validation, attach patient on register |
| `server/src/services/sponsor.ts` | `resolveAiPayer()` stub for `be-06` |
| `server/src/routes/auth.ts` | after `findOrCreateUser`, call `attachPendingShares(email)` |
| `server/src/index.ts` | register share routes |

---

## App integration (phase 2b — **`prompt49.txt`**)

Full UI spec: **`prompts/app/prompt49.txt`**. Summary:

| Surface | Behavior |
|---------|----------|
| **Patient** | “Link to clinic” — enter mentor/clinic email → request; approve incoming invite |
| **Mentor** | “My patients” — invite by email; approve requests; revoke |
| **Solo** | No link required; optional “Link later” |
| **On login** | Fetch `/v1/shares/pending-for-me`; badge if action needed |
| **Sponsored UI** | “AI sponsored by &lt;clinic display name&gt;” when approved sponsor exists |

Nutritionist **report import → My Rules** — app **`prompt46.txt`** (medical + personal; medical wins). **Clinic PDF upload** — § Medical plan relay below + **`prompt-be-05-clinic-dashboard.md`**.

---

## Medical plan relay (PDF) — clinic writes rules, phone applies

**Metabolic OS loop:** clinic sets rules → AI checks each meal on phone → clinic reviews day → clinic updates rules.

| Path | Who | Where rules become active |
|------|-----|---------------------------|
| **A — Patient import** | Patient | Phone only (`prompt46` — pick PDF locally) |
| **B — Clinic upload** | Clinic on web | Phone after patient **Review & apply** (`prompt46` + `prompt49`) |

**Local-first:** server stores **PDF file only** (relay). **No parsed rules on server.** Patient app downloads PDF → `parseMedicalPlanPdf` on device → saves `medical_rules` locally. Clinic never holds patient’s active rule JSON.

### Endpoints

| Endpoint | Method | Auth | Role | Body | Response |
|----------|--------|------|------|------|----------|
| `/v1/plans/upload` | POST | Bearer | **mentor** | multipart PDF + `{ patientId }` or `{ shareId }` | `{ plan }` |
| `/v1/plans/pending` | GET | Bearer | **patient** | — | `{ plans[] }` awaiting apply |
| `/v1/plans/:id/download` | GET | Bearer | **patient** | — | PDF bytes |
| `/v1/plans/:id/applied` | POST | Bearer | **patient** | `{ appliedAt }` | `{ ok }` — after local save |
| `/v1/plans` | GET | Bearer | mentor | `?patientId=` | list sent plans + status |

**Access:** mentor upload requires **approved** share with that patient. Patient download only for plans addressed to them.

### Plan object

```json
{
  "id": "uuid",
  "shareId": "uuid",
  "mentorId": "uuid",
  "patientId": "uuid",
  "status": "pending | applied | superseded",
  "filename": "plan-june.pdf",
  "uploadedAt": "ISO",
  "appliedAt": "ISO | null",
  "clinicDisplayName": "Dr. Cohen Nutrition"
}
```

- New clinic upload **supersedes** prior `pending` plan for same share (one pending at a time).
- **`applied`** when patient taps Apply on phone (rules saved locally).

### Schema

```sql
CREATE TABLE IF NOT EXISTS medical_plan_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES account_shares (id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'superseded')),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);
```

PDF on disk under `/var/healthings/plans/` (same pattern as be-04 blobs). **Delete on share revoke** (optional retain for audit — post-MVP).

### Clinic portal (be-05)

Patient detail → **Upload plan (PDF)** → shows “Sent · pending patient apply” or “Applied · 2026-06-29”.

### Patient app (prompt49 + prompt46)

Banner: **“&lt;Clinic&gt; sent a new medical plan”** → Review (same UI as local PDF import) → **Apply** → `medical_rules` updated → POST `/applied`.

---

## Error codes

| HTTP | When |
|------|------|
| `400` | Invalid email, self-link, wrong role for action |
| `403` | Wrong role (patient calling invite) |
| `404` | Share not found or not yours |
| `409` | Duplicate pending share (before auto-revoke logic) |
| `422` | Invalid state transition (approve non-pending) |

---

## Smoke test (curl)

```bash
# Mentor invites patient
curl -X POST https://api.healthings.ai/v1/shares/invite \
  -H "Authorization: Bearer $MENTOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"patientEmail":"patient@example.com"}'

# Patient approves (after login)
curl -X POST https://api.healthings.ai/v1/shares/$ID/approve \
  -H "Authorization: Bearer $PATIENT_TOKEN"

# List mentor's patients
curl https://api.healthings.ai/v1/shares?status=approved \
  -H "Authorization: Bearer $MENTOR_TOKEN"
```

---

## Phone-tested

- [ ] Mentor invite → patient register same email → pending visible → approve
- [ ] Patient request → mentor approve
- [ ] Revoke → sponsor index allows new clinic link
- [ ] Solo patient — no shares, app works
- [ ] App UI phase 2b (when built)
- [ ] Clinic uploads PDF → patient pending banner → apply → medical rules on phone; clinic sees **applied**

---

## Deferred

| Item | Prompt |
|------|--------|
| Mentor wallet + AI debit | **`prompt-be-06-token-wallet.md`** |
| Encrypted blob sync | **`prompt-be-04-encrypted-sync.md`** |
| Clinic web portal + patient charts | **`prompt-be-05-clinic-dashboard.md`** |
| App link + share UI | **`prompt49.txt`** |
| Token transfer between wallets | **Not MVP** — mentor is billed directly, not pre-transfer |
| Multiple simultaneous sponsors | Post-MVP |
| Stripe / card | Post-alpha |

---

## Related

- **`done/prompt-be-01-vision.md`** — vision (updated GTM: many clinics, no alpha site)
- **`done/prompt-be-02-accounts-auth.md`** — auth + roles
- **`done/prompt-be-02b-app-login.md`** — app login (evolve to required sign-in + link UI)
- **prompt-be-06** — `resolveAiPayer()` consumer
- App (planned) — nutritionist report import → My Rules

## Supersedes / notes

- **prompt-be-01** § mentor **token transfer** — superseded for MVP by **mentor billed / sponsored debit** (mentor wallet in `be-06`).
- **investor-pov/key-rule.md** — “formal alpha site” channel deprecated; each clinic is a mentor account.
