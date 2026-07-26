# Investigation briefs

Reusable **investigation** packs — not batches. Nothing here ships code.

A brief tells a high-reasoning model how to review a surface and what shape its findings must take.
The output is one or more `be-NN` batch files in [`../`](../README.md), written from
[`TEMPLATE.md`](./TEMPLATE.md). Auto then implements those batches.

Was `prompts/backend/opus5/` until 2026-07-26, plus `prompt-be-09-website-ux-review.md`, which was a
router rather than a batch. Renamed away from a model version because the briefs outlive it: the
website pack below was written for Opus 5, but any model with the same reasoning budget can run it.

```
briefs/
  README.md      ← this file: how to run a pack
  TEMPLATE.md    ← the shape of a be-NN batch file
  00 … 06        ← the website UI/UX pack (ordered)
```

## Website UI/UX pack

| Step | Who | What |
|------|-----|------|
| 1 | **Investigator** (Opus-class, thinking) | Read `00-start-here.md`, then `01` → `06` in order |
| 2 | **Investigator** | Write one batch file per shippable unit into `prompts/backend/` using `TEMPLATE.md` |
| 3 | Human | Skim the batches; reorder or reject before anything is built |
| 4 | **Auto** | Implement batches with `Status: ready` |
| 5 | Human | Deploy the website; smoke the live URLs |

| # | File | Surface |
|---|------|---------|
| 00 | `00-start-here.md` | Role, constraints, finding format |
| 01 | `01-landing.md` | https://healthings.ai/ |
| 02 | `02-help.md` | `/{lang}/help/` |
| 03 | `03-privacy.md` | `/privacy.html` |
| 04 | `04-clinic-portal.md` | `/clinic/` |
| 05 | `05-patient-workspace.md` | `/clinic/patient.html` |
| 06 | `06-design-system-and-handoff.md` | Tokens + write the batch files |

Do **not** ask the investigator to ship production HTML/CSS — that is what the budget is for
reasoning, not typing. Do **not** ask Auto to redesign from scratch without a batch file.

**Before opening a portal brief, read [`../be-08-clinic-portal-ux.md`](../be-08-clinic-portal-ux.md).**
It already catalogs C1–C21 for the clinic portal, and be-21 wasted effort rediscovering two of them
(C17, C18) from scratch. Extend that catalog; do not restart it.

## Paste to the investigator

```
Follow the briefs in prompts/backend/briefs/ in order:
00-start-here.md → 01 … → 06-design-system-and-handoff.md

Investigate live https://healthings.ai (screenshots I attach). Do not implement CSS/HTML.
When done, write batch files into prompts/backend/ using briefs/TEMPLATE.md.
Stop when 06 is complete and the batches are ready for Auto.
```

## Paste to Auto later

```
Implement the approved batches in prompts/backend/ with Status: ready (ignore done/ —
those are shipped records). Follow each batch's files and acceptance criteria. Do not
redesign beyond the batch. Set Status: needs-review with evidence when done; do not
mark anything done yourself and do not commit or deploy.
```

## Related

- Batch index and status values: [`../README.md`](../README.md)
- App UI audit pattern: [`../../app/prompt92.txt`](../../app/prompt92.txt)
