# 04 — Clinic portal (Opus 5)

**URL:** https://healthings.ai/clinic/  
**Files:** `website/clinic/index.html`, `website/clinic/clinic-api.js`, shared `website/styles.css`  
**Prior correctness catalog:** `../prompt-be-08-clinic-portal-ux.md` (C1–C21)  
**After this:** `05-patient-workspace.md`

---

## Ask the human for

| Shot | Required |
|------|----------|
| Login — email step (desktop + mobile) | yes |
| Login — code step (if available) | nice |
| Signed-in home with cards (if mentor account) | strongly preferred |
| If no mentor login: say so — review structure from HTML + be-08; mark “needs signed-in render” | — |

---

## Investigate (design / IA — not re-doing Batch A)

**Correctness (C1–C5)** is owned by be-08. Only note if **live** still broken after deploy.

Focus here:

1. **Brand / trust** — Bare back-link vs clinician-grade chrome.
2. **Daily task** — Linked patients above the fold? Or buried under alpha billing?
3. **Card order & density** — Proposed order in be-08: Linked → Pending → Outgoing →
   Invite → My clinic → AI credits/usage. Affirm or refine.
4. **Login craft** — Hierarchy, contrast on gradient, button size, labels (be-08 Batch B).
5. **Mobile rows** — Action buttons wrap; destructive vs primary distinction.
6. **Empty states** — Tone and next action clarity.

---

## Output for this pass

1. Clinic-home verdict (3–5 sentences) as a **daily clinician tool**.
2. Findings **W…** for visual/IA; reference **C…** only when extending be-08.
3. Explicit list: “already in be-08 Batch B/C — do not duplicate into new drafts” vs
   “new design work for drafts/”.
4. Wireframe-in-words for signed-in home (section order + what each section shows).

**Next:** `05-patient-workspace.md`
