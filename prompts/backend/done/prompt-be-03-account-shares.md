## Prompt be-03 — Account shares + AI sponsorship (decoupled)

**Status: done (2026-06-30)** — Code shipped; VPS migrate + phone test pending.

**Builds on:** `done/prompt-be-02b-app-login.md`

---

### Model

| Concern | Who controls | Rule |
|---------|--------------|------|
| **Data whitelist** | Either party requests → other approves | Many `approved` shares per patient |
| **AI sponsorship** | **Mentor** enables in clinic portal | **One sponsor per patient**; independent of data share |

### Sponsorship API (mentor-side)

| Endpoint | Role | Action |
|----------|------|--------|
| `GET /v1/sponsorships` | patient | Read-only `{ sponsorship \| null }` |
| `GET /v1/sponsorships/mine` | mentor | Patients I sponsor |
| `POST /v1/sponsorships/enable` | mentor | `{ patientId, expiresAt? }` — default 90 days |
| `POST /v1/sponsorships/disable` | mentor | Stop sponsoring that patient |
| `POST /v1/usage/ai` | patient | Meter billable AI (app after Gemini success) |
| `GET /v1/usage/summary` | mentor / patient | Usage totals for invoicing |

Patient app shows badge + expiry. **No charges in alpha** (`BILLING_ENFORCE=false`).

### Primary files

| Path | Role |
|------|------|
| `server/src/services/shares.ts` | data whitelist |
| `server/src/services/sponsorships.ts` | one sponsor + `expires_at` |
| `server/src/services/usage.ts` | `ai_usage_events` meter |
| `server/src/services/sponsor.ts` | `resolveAiPayer` (skips expired) |
| `app/src/services/UsageApiService.ts` | fire-and-forget report |
| `website/clinic/index.html` | Sponsor AI + usage summary |
| `app/src/components/ClinicLinkStrip.tsx` | data sharing + badge/expiry |

### Phone-tested

- [ ] Multiple data shares
- [ ] Mentor enables AI sponsorship with expiry → patient badge
- [ ] After expiry: badge gone, usage meters to patient
- [ ] Portal shows token totals by patient
- [ ] Meal/chat logs `ai_usage_events` when signed in

### Related

- `be-04` sync gates on approved **share**, not sponsorship
