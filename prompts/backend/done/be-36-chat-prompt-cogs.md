# be-36 — Shrink clinic/account chat prompt COGS

**Status:** done (2026-07-28) — owner accepted: web `ai_chat` ~15–17k vs prior ~70k
**Model to implement:** Fable 5 (Cursor)
**Authored by:** Owner + agent (deferred from be-35; live margin showed `ai_chat` as the cost sink)
**Depends on:** be-32 / be-35 (Gemini usage metering + margin view)

## Problem

Live `ai_chat` turns hit ~70k **prompt** tokens. History is already capped at 12. The bomb is
`buildPatientContextBlock` in `geminiClinic.ts`: every clinic and account chat turn dumps
**31 days of itemized food** + **7 days of every ~5‑min CGM sample** + 31d workouts, whether or
not the question needs it. Phone defaults to a 2‑day period review; web chat always packs a
mega-review.

## Goal

Cut default prompt size hard while keeping clinical judgment intact (full My Rules text, no
regex parsing of rules). Measure with be-35 / `gemini_prompt_tokens` before vs after.

## Design (locked)

| Block | Before | After (default) |
|-------|--------|-----------------|
| Food | 31d itemized | **7d itemized**; days 8–31 = **day totals only** |
| CGM day stats | 31d | **14d** |
| CGM full series | 7d every sample | **2d**, downsampled to ~**15 min** |
| Workouts | 31d | **14d** |
| Labs | 10 reports × 40 | **3** newest reports |
| Rules short line in PATIENT DATA | present | **drop** (full `rawText` already in rules block) |
| `thinkingBudget` | 4096 | **1024** (output COGS; prompt is the main win) |

Optional widen: if the staff/patient message clearly asks for a wider window
(`30 days`, `last month`, etc. — routing patterns only), restore food detail + CGM series to
the old wide packing for that turn. Do **not** parse My Rules.

Footer line in PATIENT DATA stating the packed window so the model (and mentor) know to ask
for more if needed.

## Files

- `server/src/services/geminiClinic.ts` — constants, formatters, `buildPatientContextBlock`,
  both `mentorChatReply*` thinking budgets
- `prompts/backend/be-36-…` + README row

## Acceptance criteria

- [ ] Default clinic/account chat prompt tokens drop materially vs ~70k (owner fires a chat, checks usage / margin)
- [ ] Full `rawText` rules still in prompt; no new rules regex
- [ ] Day totals for older food days still present (not silent drop of history)
- [ ] tsc clean; deployed

## Out of scope

- Phone `GeminiService` / `CHAT_HISTORY_MAX_MESSAGES` (later)
- Charts / permanent packing UI toggle
- Changing credit price or Gemini API rates

## Agent checklist

- [x] Spec + README
- [x] Implement tiered packing + optional widen
- [x] Deploy; owner before/after check pending
