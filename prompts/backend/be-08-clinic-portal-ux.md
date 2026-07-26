# Backend — Clinic portal UI/UX (healthings.ai/clinic)

**Status:** Partial — **Batch A shipped and live**; B/C/D partly absorbed by later batches.
Reconciled 2026-07-26.

| Batch | State |
|-------|-------|
| **A** — correctness | **Done, committed, deployed.** `cancelShare` + `POST /v1/shares/:id/cancel` are in `server/src/services/shares.ts` / `routes/shares.ts`; the portal has the outgoing-invites list, confirm-before-revoke and `healthings_clinic_otp_pending` |
| **B** — forms & a11y | **Partial.** C10 (dashboard actions) and C13 done via `be-21`; C6, C8, C12 still open |
| **C** — IA / daily tool | **Partial.** C17 and C18 done via `be-21`; C14, C15, C19 moved to `../be-22-clinic-portal-visual.md` |
| **D** — hardening | C20 addressed in the rows `be-21` rewrote; C21 still documentation-only |

**Do not re-review this portal from scratch.** This catalog already named the problems that `be-21`
later rediscovered independently (C17 `window.prompt`, C18 ragged rows). Read it before opening a new
portal batch.

Canvas source of the original review (Cursor-only, not in git):
`~/.cursor/projects/c-projects-healthings-medilab/canvases/clinic-portal-ux-review.canvas.tsx`

**ID:** `be-08`  
**Builds on:** `be-05-clinic-dashboard.md` (portal MVP), `be-03` shares,
app prompt49 / prompt63 (clinic Refresh), language policy (clinic portal UI stays **English**),
secrets-workflow (no tokens in git).

**Live URL:** https://healthings.ai/clinic  
**Primary files:** `website/clinic/index.html`, `website/clinic/clinic-api.js`,
`website/clinic/patient.html`, `website/clinic/clinic-workspace.js`, `website/styles.css`,
`server/src/routes/shares.ts`, `server/src/services/shares.ts`

---

## Problem

The clinic portal is the surface clinicians use to invite patients, approve shares, and open a
patient workspace. A full UI/UX review against the live page + source (2026-07-25) found the
**visual design is acceptable** but **behavior and information architecture are not**. Five
correctness bugs make daily use unreliable; forms cannot be driven from the keyboard; the daily
task (Linked patients) sits at the bottom of a ~1090px settings dump.

Clinic portal stays English (language-policy Phase C deferred). This is a **website + API**
prompt — not an app prompt (`prompts/app/`).

---

## Review summary (21 findings)

| Group | Count | IDs |
|-------|------:|-----|
| Correctness blockers | 5 | C1–C5 |
| Forms & accessibility | 8 | C6–C13 |
| Information architecture | 6 | C14–C19 |
| Security hardening | 2 | C20–C21 |

### Measured live (login + revealed `#app-view`)

| Property | Found | Expected |
|----------|-------|----------|
| `<form>` elements | 0 | one per input group (Enter submits) |
| Inputs with a `<label>` | 1 of 3 | 3 of 3 |
| Inputs with `autocomplete` | 0 of 2 | `email` + `one-time-code` |
| Tallest interactive control | 37px | ≥44px |
| Back-link contrast on gradient | ≈2.4:1 | ≥4.5:1 at 0.9rem |
| Signed-in page height (720px column) | ~1090px | Linked patients above the fold |

### Worth keeping

- `clinic-workspace.js` escapes with `esc()`; eight clinical tabs.
- `clinic-api.js` refreshes access token on 401; clears only when refresh fails.
- Empty states on share lists; snapshot refresh polls with a cap + patient hint.
- Same-origin API on healthings.ai (no CORS).

---

## Findings catalog

### Correctness blockers (Batch A)

| ID | Finding | Where | Fix |
|----|---------|-------|-----|
| **C1** | Approve / Reject / Revoke / Sponsor fail silently — `act()` throws; click handlers have no `try/catch`, so a failed approval looks identical to success | `clinic/index.html` act + onclick | Catch and route message to `#app-error` |
| **C2** | Sent invite disappears — dashboard loads `pending-for-me` (patient→mentor only) + approved; mentor-initiated pending is in neither list | `index.html` refresh + `shares.ts` `listPendingForMe` | Also `GET /v1/shares?status=pending`; render **Outgoing invites** + cancel |
| **C3** | Revoke is one unconfirmed click next to Open workspace | revoke button | `confirm()` with patient email before POST |
| **C4** | Any `boot()` error clears tokens silently — network blip = sign-out; wrong-role error never shown | `boot()` + role check | Clear tokens only on 401 / wrong role; surface other errors; keep session on transient failures |
| **C5** | Reload during OTP strands the code — `loginEmail` is in-memory only | login step | Persist pending email in `localStorage` (mirror app `OTP_PENDING_KEY`); restore code step; **Change email** |

**Server needed for C2 cancel:** initiator cannot `reject` (counterparty only) and cannot `revoke` pending. Add `POST /v1/shares/:id/cancel` + `cancelShare()`.

### Forms & accessibility (Batch B)

| ID | Finding | Fix |
|----|---------|-----|
| **C6** | Enter does nothing (zero forms) | Wrap each input + button in `<form>`; submit handlers |
| **C7** | No autofill hints | `autocomplete="email"` / `autocomplete="one-time-code"` |
| **C8** | Email + code unlabeled (placeholders only) | Visible `<label>` like display name |
| **C9** | Errors not announced | `role="alert"` on `#login-error` and `#app-error` |
| **C10** | Buttons stay enabled while OTP / invite runs | Disable + busy label; prevent double OTP |
| **C11** | Touch targets 35–37px; back-link ≈2.4:1 | ≥44px padding; darker link color |
| **C12** | No `:focus-visible` on portal controls | Outline rule for `.portal-btn` / `.portal-input` |
| **C13** | Save name silent on success | Brief confirmation or disable until dirty |

### Information architecture (Batch C)

| ID | Finding | Fix |
|----|---------|-----|
| **C14** | Linked patients last under alpha billing | Reorder: Linked → Pending → Outgoing → Invite → My clinic → AI credits/usage |
| **C15** | No patient search / sort / pagination | Filter input + sort by email; paginate if >~20 |
| **C16** | Dimmed Open workspace still navigates to `#` | Omit link when no `patientId` |
| **C17** | Sponsorship days via `window.prompt` | Small modal / number input with explicit confirm |
| **C18** | `share-row` wraps ragged on phones | Stack actions; drop left-only margin on secondary |
| **C19** | No brand chrome (bare back link + h1) | Light brand header aligned with patient site (logo / product name) |

### Security hardening (Batch D)

| ID | Finding | Fix |
|----|---------|-----|
| **C20** | Patient emails via `innerHTML` without escape (`index.html`; workspace already has `esc()`) | DOM `textContent` or shared `esc()` |
| **C21** | Tokens in `localStorage`, no idle timeout | Document risk; optional idle lock later (not alpha-blocking) |

---

## Implementation batches (suggested order)

### Batch A — Correctness (do first) — **LOCAL CODE DONE 2026-07-25**

Shipped in working tree (not committed / not on VPS yet):

- [x] C1 — `act()` try/catch → `#app-error`
- [x] C2 — Outgoing invites list + Cancel invite UI
- [x] C2 server — `cancelShare` + `POST /v1/shares/:id/cancel`
- [x] C3 — confirm before revoke (and cancel)
- [x] C4 — boot: clear tokens only on 401 / wrong role; transient → app shell + error
- [x] C5 — `healthings_clinic_otp_pending` + Change email
- [x] C7 partial — autocomplete on email + code
- [x] C9 — `role="alert"` on error els
- [x] C16 — no dead Open workspace when missing `patientId`
- [x] C20 partial — share/usage rows built with DOM `textContent` (no email `innerHTML`)

**Still required to go live:**

1. Commit portal + server cancel route
2. Deploy **API** (cancel 404s until then) + **website** (`server/scripts/deploy-website.sh`)
3. Smoke on https://healthings.ai/clinic — invite → see Outgoing → cancel; fail an action → error text; reload mid-OTP → code step restored

### Batch B — Forms & a11y

- [ ] C6 forms / Enter submit — **still open.** Zero `<form>` elements in `index.html`
- [ ] C8 visible labels — **still open** for email + code (display name has one)
- [x] C10 busy states — **done for dashboard actions and Invite** (`withBusy`, `be-20` / `be-21`).
      **Login half still open:** `send-code` and `verify-code` have no busy state, and both bail
      silently (`if (!loginEmail) return`) on empty input
- [ ] C11 44px targets + link contrast — **partial**; `be-21`'s probe asserted visible buttons clear
      40px, contrast not re-measured
- [ ] C12 `:focus-visible` — **still open.** No `focus-visible` rule in the portal
- [x] C13 save-name success feedback — done via `#name-status` (`be-21`)

### Batch C — IA / daily tool

- [ ] C14 card reorder → **moved to `be-22`** (patients-first layout)
- [ ] C15 patient filter → **moved to `be-22`** (search / sort / pagination)
- [x] C17 sponsorship UI (replace `prompt`) — done via `SPONSOR_DAY_CHOICES` inline picker (`be-21`)
- [x] C18 mobile row layout — done; `.share-row` stacks actions (`be-21`)
- [ ] C19 light brand header → **moved to `be-22`**

### Batch D — Hardening (defer idle lock)

- [x] C20 — share and usage rows are built with DOM `textContent`; `be-21` kept that when it
      rewrote the row actions. No patient email reaches `innerHTML`
- [ ] C21 document localStorage session risk; idle timeout = later

---

## Out of scope (this prompt)

- Clinic portal i18n (language-policy Phase C)
- Full redesign of patient workspace tabs (`patient.html` / `clinic-workspace.js`) — review noted them as worth keeping
- Stripe / real payments UI polish beyond alpha copy
- App locales / Swahili (app prompts only)

---

## Related

- Canvas (Cursor IDE only): `clinic-portal-ux-review.canvas.tsx`
- Prior portal MVP spec: `be-05-clinic-dashboard.md`
- Landing site ship: `done/be-07-landing-website.md`
- App mentor role picker removed 2026-07-25 — clinicians register only on this portal
  (`LoginScreen.tsx`); do not reintroduce mentor OTP role in the app
- Deploy docs: `server/DEPLOY-WEBSITE.md`, `server/scripts/deploy-website.sh`

---

## Agent checklist

- [x] Batch A committed + API + website deployed
- [x] Smoke checklist green on production
- [ ] Remaining B items (C6 forms, C8 labels, C12 focus-visible, C10 login busy state) — fold into
      the next portal batch rather than a standalone pass
- [ ] Move to `prompts/backend/done/` once the leftover B items ship; C items now belong to `be-22`
