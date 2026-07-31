# be-39 — Clinic chat: full food items for 128 days (no hide)

**Status:** needs-review  
**Model to implement:** Composer  
**Authored by:** Owner (pilot feedback — Natali iodine / Jul 22)  
**Depends on:** be-36 (supersedes clinic half of COGS packing)

## Problem

be-36 packed clinic mentor chat with **7d itemized food** and days 8–31 as **totals only**.
A clinician asking about iodine on Natali’s **22 Jul** (≈ day 8–9) got only day macros
(1367 kcal / P94 / C157 / F46) and the model correctly said items were unavailable — while the
snapshot and Food log tab still had every meal item. Clinics must not have data hidden from AI
that the portal already holds.

## Goal

- **Clinic** portal mentor chat (`mentorChatReply`): default **128 days** food lookback **with
  full item detail** (no totals-only truncation inside that window). Align with portal 128D trend.
- Also widen clinic CGM day stats / workouts to **128d** (detailed CGM series last **14d** @ ~15 min).
- **Patient** `/account/` self-chat keeps be-36 COGS packing (7d items / 31d totals + widen intent).

## Files

- `server/src/services/geminiClinic.ts` — `CLINIC_CHAT_PACKING` vs `PATIENT_CHAT_PACKING`
- `prompts/backend/done/be-36-chat-prompt-cogs.md` — note clinic packing superseded

## Acceptance

- [ ] Clinic ask about a date **>7d ago** (e.g. Natali 2026-07-22) returns **named food items**
- [ ] Context footer says full item detail through 128d (no “ask for wider window” for clinic)
- [ ] Patient `/account/` chat still uses 7d items by default (COGS)
- [ ] Deployed to `api.healthings.ai`

## Evidence

- Natali (`natbog@gmail.com`) snapshot had Jul 22 items; clinic chat was totals-only under be-36.
- After deploy: re-ask iodine / food detail for that date in clinic portal.

## Deferred

- Optional: auto-include a named calendar date even beyond 128d if still in snapshot

## Follow-up (same batch / owner 2026-07-31)

Clinic AI must **estimate** micronutrients (iodine, omega, vitamins…) from food names + grams when
not stored — same HARD rule as phone mentor `GENERAL FOOD KNOWLEDGE`. Never refuse with
“iodine not in the log.”
