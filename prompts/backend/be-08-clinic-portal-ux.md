# Backend — Clinic portal UI/UX (healthings.ai/clinic)

**Status:** needs-review — C11 fixed + C21 documented 2026-07-26; waiting owner eye-check then move to `done/`
Reconciled 2026-07-26; catalog complete pending acceptance.

| Batch | State |
|-------|-------|
| **A** — correctness | **Done.** `cancelShare` + outgoing invites + confirm-before-revoke + OTP pending restore |
| **B** — forms & a11y | **Done.** C6–C13 including C11 (44px targets + link contrast re-measure) |
| **C** — IA / daily tool | **Done.** Absorbed by be-21 / be-25 |
| **D** — hardening | **Done.** C20 textContent; C21 documented (idle lock deferred) |

**Do not re-review this portal from scratch.** This catalog already named the problems; later
batches shipped the fixes. Open a new batch only for net-new findings.

**ID:** `be-08`  
**Builds on:** `be-05-clinic-dashboard.md` (portal MVP), `be-03` shares,
app prompt49 / prompt63 (clinic Refresh). Portal i18n later shipped in be-25 / be-26
(language-policy Phase C — global clinics).

**Live URL:** https://healthings.ai/clinic  
**Primary files:** `website/clinic/index.html`, `website/clinic/clinic-api.js`,
`website/clinic/patient.html`, `website/clinic/clinic-workspace.js`, `website/clinic/clinic-portal.css`,
`website/privacy.html`, `server/src/routes/shares.ts`, `server/src/services/shares.ts`

---

## Problem

The clinic portal is the surface clinicians use to invite patients, approve shares, and open a
patient workspace. A full UI/UX review against the live page + source (2026-07-25) found the
**visual design is acceptable** but **behavior and information architecture are not**. Five
correctness bugs make daily use unreliable; forms cannot be driven from the keyboard; the daily
task (Linked patients) sits at the bottom of a ~1090px settings dump.

---

## Review summary (21 findings) — all closed

| Group | Count | IDs | Closed by |
|-------|------:|-----|-----------|
| Correctness blockers | 5 | C1–C5 | Batch A (this file) |
| Forms & accessibility | 8 | C6–C13 | be-21 / be-25 / **this close-out (C11)** |
| Information architecture | 6 | C14–C19 | be-21 / be-25 |
| Security hardening | 2 | C20–C21 | be-21 (C20); **this close-out (C21 docs)** |

### C11 close-out (2026-07-26)

Re-measured on production with CDP:

| Control | Before | After |
|---------|-------:|------:|
| `.portal-btn` / row actions | 44px | 44px (already `var(--tap-min)`) |
| `.chip-btn` filter chips | **36px** | **44px** |
| `.portal-input` | **42px** | **44px** |
| Pager Previous/Next | **40px** (local override) | **44px** |
| `summary` (My clinic) | **25px** | **44px** |
| Workspace `← Clinic portal` | text-only | **44px** padded link |

Brand / body text on `--bg-page` (#f0f4f8): navy **12.77:1**, muted sub **4.95:1** — both ≥ AA.
The original “back-link ≈2.4:1 on gradient” was the pre-be-25 bare back link; gone with the brand
header. Workspace back link already uses `--accent-ink` (5.85:1 design target).

### C21 close-out (2026-07-26)

Documented, not coded:

- `clinic-api.js` header — XSS + shared-workstation risk; idle lock deferred; cookie migration note
- `privacy.html` Sessions bullet — clinic /account `localStorage`, no idle auto-lock, use Sign out

Idle timeout remains a future hardening batch if clinics ask for it.

---

## Findings catalog (record)

### Correctness blockers (Batch A) — done

| ID | Finding | Fix |
|----|---------|-----|
| **C1** | Approve / Reject / Revoke / Sponsor fail silently | Catch → flash / `#app-error` |
| **C2** | Sent invite disappears | Outgoing list + `POST …/cancel` |
| **C3** | Revoke unconfirmed | `confirm()` with email |
| **C4** | `boot()` clears tokens on any error | Clear only on 401 / wrong role |
| **C5** | Reload during OTP strands code | `healthings_clinic_otp_pending` |

### Forms & accessibility (Batch B) — done

| ID | Finding | Fix |
|----|---------|-----|
| **C6** | Enter does nothing | Real `<form>`s (be-25) |
| **C7** | No autofill hints | `autocomplete` email / one-time-code |
| **C8** | Email + code unlabeled | Visible labels (be-25) |
| **C9** | Errors not announced | `role="alert"` |
| **C10** | Buttons stay enabled while busy | `withBusy` (be-21 / be-25) |
| **C11** | Touch targets / link contrast | `var(--tap-min)` everywhere; re-measure 2026-07-26 |
| **C12** | No `:focus-visible` | Shared outline (be-25) |
| **C13** | Save name silent | `#name-status` (be-21) |

### Information architecture (Batch C) — done

| ID | Finding | Fix |
|----|---------|-----|
| **C14** | Linked patients last | Worklist-first (be-25) |
| **C15** | No search / sort / pagination | be-25 |
| **C16** | Dimmed Open workspace navigates | Omit without `patientId` |
| **C17** | Sponsorship via `prompt` | Inline day picker (be-21) |
| **C18** | Ragged phone rows | Table + mobile blocks (be-25) |
| **C19** | No brand chrome | Panel header (be-25) |

### Security hardening (Batch D) — done

| ID | Finding | Fix |
|----|---------|-----|
| **C20** | Emails via `innerHTML` | DOM `textContent` |
| **C21** | Tokens in `localStorage`, no idle timeout | Documented; idle lock later |

---

## Out of scope (this prompt)

- Clinic portal i18n — shipped in be-25 / be-26 after policy reversal
- Full redesign of patient workspace tabs — visual tokens/dark in be-22
- Stripe / real payments UI polish beyond alpha copy
- Idle auto-lock implementation

---

## Related

- Canvas (Cursor IDE only): `clinic-portal-ux-review.canvas.tsx`
- Prior portal MVP: `done/be-05-clinic-dashboard.md` (if present) / be-05 record
- be-21 action feedback · be-25 worklist · be-22 workspace visual · be-26 i18n
- Deploy: `server/DEPLOY-WEBSITE.md`

---

## Agent checklist

- [x] Batch A committed + API + website deployed
- [x] Smoke checklist green on production
- [x] C6–C13 closed (C11 re-measured and fixed 2026-07-26)
- [x] C14–C21 closed (C21 docs only)
- [ ] Moved to `done/` after owner acceptance
