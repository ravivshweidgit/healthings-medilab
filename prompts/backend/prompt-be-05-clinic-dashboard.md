# Backend Phase 4 — Clinic web portal (mentor dashboard)

**Status: backlog (spec draft 2026-06-29; product decisions locked 2026-07)**  
**Builds on:** `done/prompt-be-02b-app-login.md` · `prompt-be-03-account-shares.md` · `prompt-be-04-encrypted-sync.md`.

---

## Product decisions (locked 2026-07 — align with be-04 + prompt49)

| Decision | Rule |
|----------|------|
| **Data source** | Decrypt latest `sync_blobs` ciphertext from be-04 — **phone persistence snapshot**, not live API to patient device. |
| **Visibility** | **Once patient has shared, clinic can view all sections in that snapshot** (meals, CGM, labs, Withings, rules, targets). Read-only. No per-field hiding in MVP. |
| **Window label** | Show `summary.lookbackMode`: **“90 days”** or **“Full history”** + `dayRange.from`–`to`. Patient chose window at share time. |
| **Refresh** | **Last updated** = blob `createdAt`. New data only after patient taps Share again in app. |
| **Cannot pull** | Clinic cannot request sync from browser — patient must push. (Optional “please share” nudge → v2.) |

---

## Problem

Today **healthings.ai** is patient download only. Clinics/nutritionists need to:

1. **Open a clinic account on the web** (not sideload APK)
2. **Invite or approve patients** (like Git collaborator)
3. **See shared patient data** after patient uploads encrypted snapshot
4. **Manage sponsorship** — clinic covers patient AI (when be-06 live)

Without a web portal, mentors must use the phone app as `role: mentor` — awkward for clinic staff reviewing many patients.

---

## Product model

| Actor | Account | Surface |
|-------|---------|---------|
| **Patient** | `role: patient` | Android app |
| **Clinic / nutritionist** | `role: mentor` | **Web clinic portal** (+ optional app later) |

One mentor account = one clinic seat (MVP). Multi-seat / staff logins → post-MVP.

---

## What ships

### 1. Clinic signup & login (web)

**URL:** `https://healthings.ai/clinic/` (or `/portal/` — pick one at implement)

| Step | Detail |
|------|--------|
| Landing | “For clinics & nutritionists” — separate from patient download hero |
| Sign up | Email OTP — **same API** as app (`/v1/auth/otp/*`) with `role: mentor` on first verify |
| Login | Email OTP; JWT in **httpOnly cookie** or localStorage (web SPA) |
| Profile | Clinic display name (`users.display_name` from be-03), contact email |

Update **`done/prompt-be-07-landing-website.md`** when live: patient CTA + **Clinic login** link in header.

### 2. Dashboard pages (MVP)

| Page | Features |
|------|----------|
| **Home** | Pending invites/requests count; quick “Invite patient” |
| **Patients** | Table: email, display name, link status, **last sync** + lookback (90d / full), sponsor badge |
| **Invite** | Enter patient email → `POST /v1/shares/invite` |
| **Requests** | Incoming patient requests → approve / reject |
| **Patient detail** | Decrypt latest blob (be-04); **read-only views for entire snapshot** |

**Patient detail — read-only charts (MVP):**

Render from decrypted export JSON (same keys as App Backup). Show **full date range in blob** (not hard-coded 7d):

- CGM / glucose trend (downsample for display if needed)
- Meals + macros (all days in snapshot)
- Lab reports (all in snapshot)
- Withings: weight trend, HR, workouts, calorie strip data if present
- Rules / targets summary (read-only text)
- Header: **“Shared data · 90 days · updated &lt;date&gt;”** or **“Full history · updated …”**
- **No AI chat in portal v1** — clinic uses data view; patient AI stays in app

**Patient detail — medical plan (rules loop):**

| Action | Detail |
|--------|--------|
| **Upload plan (PDF)** | Nutritionist report → `POST /v1/plans/upload` |
| Status | **Pending** — waiting for patient to apply on phone |
| Status | **Applied** — patient accepted; active rules live on **their device only** |
| Replace | New upload supersedes pending; patient gets new review banner |

Clinic **does not edit rule text in browser** for MVP — upload PDF (or photo v2). Parsing + active rules stay on patient phone (`prompt46`).

### 3. Daily metabolic loop (clinic + patient)

```
Clinic uploads PDF plan  ──►  patient Review & apply  ──►  medical_rules on phone
        ↓
AI checks each meal live on phone (prompt46 effective rules)
        ↓
End of day: patient Share data (be-04)  ──►  clinic reviews charts
        ↓
Clinic adjusts plan → upload new PDF → patient applies again
```

### 4. Share workflow (with app prompt49)

```
Clinic invites patient email     OR     Patient requests clinic email
              ↓                                    ↓
         pending share  ←—— counterparty approve ——→  approved
              ↓
Patient taps "Share with clinic" in app (default 90d or full history) → be-04 upload
              ↓
Clinic portal "Last updated" + lookback label → open patient → view **all** snapshot sections
```

### 5. Tech stack (recommended)

| Layer | Choice |
|-------|--------|
| Frontend | Vite + React (or extend `website/` as sub-app) |
| Auth | Same JWT as app; OTP via existing API |
| Deploy | Static bundle on VPS under `/clinic/` or separate nginx location |
| API | Existing `api.healthings.ai` — no new server process |

**Repo layout (proposal):**

```
clinic-portal/          # or website/clinic/
  src/
  index.html
server/                 # shares + sync APIs (be-03, be-04)
```

### 5. API consumption (no new routes beyond be-03/be-04/be-06)

| Action | Endpoint |
|--------|----------|
| Login | `/v1/auth/otp/request`, `/verify` |
| List patients | `GET /v1/shares?status=approved` |
| Pending | `GET /v1/shares/pending-for-me` |
| Invite | `POST /v1/shares/invite` |
| Approve/reject | `POST /v1/shares/:id/approve` etc. |
| Download data | `GET /v1/sync/latest?patientId=` |

---

## UX copy (tone)

- “Link patient” not “add user”
- “Share your data from the app” — patient must push; clinic cannot pull from phone
- “AI sponsored by &lt;clinic&gt;” when `sponsor_ai` approved (app shows; portal shows badge)

---

## Primary files

| Path | Purpose |
|------|---------|
| `clinic-portal/` (new) | SPA — login, patients, detail charts |
| `website/index.html` | Link “Clinic login” |
| `server/scripts/deploy-clinic-portal.sh` | build + nginx |
| `prompt-be-03`, `be-04` | backend APIs |

---

## Phone / browser-tested checklist

- [ ] Clinic signup on web → mentor role in DB
- [ ] Invite patient email → patient sees pending in app (prompt49)
- [ ] Patient approves + shares → clinic sees patient row + last sync
- [ ] Open patient → CGM + meals render from decrypted blob
- [ ] Revoke link → clinic loses access; patient can delete blobs

---

## Deferred

- Multi-user clinic org (admin + staff)
- In-portal AI assistant on patient data
- Edit patient rules from portal (read-only MVP)
- Native mentor app parity
- Dashboard subscription billing (separate from AI tokens)

---

## Related

- **`prompt-be-03-account-shares.md`** — relationship API
- **`prompt-be-04-encrypted-sync.md`** — ciphertext upload
- **`prompt-be-06-token-wallet.md`** — sponsor billing
- **`prompt49.txt`** — patient link + share UI
- **`done/prompt-be-07-landing-website.md`** — apex site + clinic entry link
