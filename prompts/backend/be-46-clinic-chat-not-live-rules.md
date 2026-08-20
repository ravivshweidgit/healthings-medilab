# be-46 — Clinic chat must not claim live rules

**Status:** needs-review  
**Model:** Auto  
**Builds on:** be-24 (clinic chat is staff-private), prompt51 (Rules tab is the persist path)  
**Shipped:** 2026-08-20

## Problem

Clinic staff pasted standing dietary rules into mentor chat. Gemini replied
**"אני מאשר/ת שאפעל בהתאם לכללים אלו…"** — as if the wording were now in force
for analysis and patient recommendations.

That is false. Chat history is discussion only. Live rules are the Rules tab
Save (`PUT /v1/clinic/patients/:id/rules` → overlay → phone). Until then the
patient's app, meal analysis, and later chats still follow saved `rawText`.

## Fix

Do **not** auto-apply chat text as rules (clinical overwrite risk). Tell the
truth in two places:

| Piece | Change |
|-------|--------|
| `geminiClinic.ts` clinic prompt | HARD: saved Rules block is authoritative; chat is a draft; never confirm / accept / "I will follow" chat-only wording; point staff to Rules tab + Save; what-if analysis OK if labelled not-live |
| `geminiClinic.ts` patient `/account/` prompt | Same honesty: chat does not save My Rules |
| Chat tab copy | Hint under the privacy note — 10 `clinicLocale`s |
| CSS | Stack the two notes without extra gap |

## Acceptance

- [ ] Clinic chat tab shows the rules hint (Hebrew: הצ׳אט לא שומר כללים…)
- [ ] Staff paste new standing rules → mentor does **not** confirm they are live; points to Rules tab + Save
- [ ] What-if ("if we used this wording…") still allowed, labelled not-live
- [ ] Saved Rules tab text is still what the prompt labels CLINIC-UPDATED / PATIENT RULES
- [ ] No auto-write to `clinic_org_overlays.rules_json` from chat

## Out of scope

- "Save these as rules" button from a chat bubble
- Translating clinic rules text for a patient in another language (open, language-policy)

## Deploy

VPS: `git pull` → server `npm ci` → `build` → `restart healthings-api`  
Website clinic static files (`clinic-workspace.js` / `-i18n.js` / `.css`) with the site deploy.

## Evidence

Owner screenshot 2026-08-20: clinic Hebrew thread with false "I confirm I will act
according to these rules" — the trigger for this batch.
