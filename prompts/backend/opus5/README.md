# Opus 5 — Website UI/UX investigation pack

**Who runs this folder:** **Opus 5 (thinking, high)** only.  
**Who implements later:** **Auto / Composer** — after drafts land in `drafts/`.

This pack is the ordered briefing for a full Healthings.ai website UI/UX review.
Opus follows the numbered files in order, writes findings, then drops **implementation
prompts** into `drafts/`. You then switch to Auto and say: *implement the drafts in
`prompts/backend/opus5/drafts/`*.

| Step | Model | What |
|------|-------|------|
| 1 | **Opus 5** | Open this README → run `00` → `01`…`06` |
| 2 | **Opus 5** | Write one draft file per shippable batch under `drafts/` (use `TEMPLATE.md`) |
| 3 | Human | Skim drafts; rename/approve if needed |
| 4 | **Auto** | “Implement ready drafts in `prompts/backend/opus5/drafts/`” |
| 5 | Human | Deploy website; smoke live URLs |

Do **not** ask Opus to ship production HTML/CSS (budget). Do **not** ask Auto to redesign
from scratch without these drafts.

---

## Tell Opus (paste this)

```
Follow the prompts in prompts/backend/opus5/ in order:
00-start-here.md → 01 … → 06-design-system-and-handoff.md

Investigate live https://healthings.ai (screenshots I attach). Do not implement CSS/HTML.
When done, write implementation drafts under prompts/backend/opus5/drafts/ using TEMPLATE.md.
Stop when 06 is complete and drafts are ready for Auto.
```

---

## Tell Auto later (paste this)

```
Implement the approved drafts in prompts/backend/opus5/drafts/ (status: ready).
Follow each draft’s files + acceptance criteria. Do not redesign beyond the draft.
When a draft ships, mark its status done in the draft file header.
```

---

## File order (Opus)

| # | File | Surface |
|---|------|---------|
| 00 | `00-start-here.md` | Role, constraints, finding format |
| 01 | `01-landing.md` | https://healthings.ai/ |
| 02 | `02-help.md` | `/{lang}/help/` |
| 03 | `03-privacy.md` | `/privacy.html` |
| 04 | `04-clinic-portal.md` | `/clinic/` |
| 05 | `05-patient-workspace.md` | `/clinic/patient.html` |
| 06 | `06-design-system-and-handoff.md` | Tokens + write `drafts/` |

Related (do not re-do unless live still broken): `../prompt-be-08-clinic-portal-ux.md`  
Index pointer: `../prompt-be-09-website-ux-review.md`
