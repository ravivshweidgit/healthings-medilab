# Implementation drafts (Opus → Auto)

Opus 5 writes shippable batch prompts here after pass `06`.  
**Auto** implements only files with `Status: ready`.

## Execution order

Run strictly in this order. The reason for each position is the dependency, not preference.

**File numbers are the execution order.** Run them ascending.

| Batch | Why here |
|---|---|
| **be-08 Batch A** (`prompts/backend/prompt-be-08-clinic-portal-ux.md`) | Prerequisite, not part of this pack. Already coded locally and uncommitted. Correctness before cosmetics, and it touches `clinic/index.html` which be-10 also edits — land it first to avoid conflicts |
| **be-10** design system | Every later batch consumes these tokens. Doing it later means re-touching every file |
| **be-11** landing | Pure presentation on top of tokens. Highest visible payoff (logo, badges, nav) |
| **be-12** help | Regenerates 160 files — run alone so the diff is reviewable |
| **be-13** privacy | Must precede be-15, which rewrites the `#deletion` section |
| **be-14** patient workspace | Must precede be-15, which reuses this renderer read-only. Fixing responsive + identity here means be-15 inherits a clean renderer |
| **be-15** patient web account | Largest and cross-cutting (server + website + app). Depends on be-13 and be-14 |

be-11, be-12 and be-13 do not depend on each other and may be reordered or parallelized. be-08,
be-10, be-14 and be-15 are strictly ordered.

### Two notes that will otherwise cause confusion

- **Help regeneration happens once.** be-10 must add `tokens.css` to the generator template and bump
  `CSS_VER`, but should **defer running the generator** to be-12, so there is one 160-file diff
  instead of two. If be-12 is not running in the same session, regenerate at the end of be-10.
- **Checkpoint after be-10.** It is a global refactor with the widest blast radius in the pack.
  Verify landing, help, privacy, clinic portal and workspace all still render before starting be-11.
  Layout must not move — only typography and the retired `--green*` aliases should change.

### Deploy

Human-owned, and currently **stale**: the VPS has not pulled since `61e76a2` (2026-07-24), which is
why the live H1 still reads "A full metabolic OS". Deploy is `git pull --ff-only` then
`bash server/scripts/deploy-website.sh` on the VPS — see `server/DEPLOY-WEBSITE.md`.

| File | Title | Status | Notes |
|------|-------|--------|-------|
| `be-10-design-system.md` | Shared design system (tokens) | ready | **Foundation — do first.** Retires `--green*`, adds prose measure + tap-target tokens |
| `be-11-landing.md` | Landing page | ready | Logo transparency, store badges, header nav, card stretch |
| `be-12-help.md` | Help site (10 locales) | ready | Index regression, language switcher, meta/SEO, RTL. Generator only — never hand-edit generated HTML |
| `be-13-privacy.md` | Privacy policy page | ready | Anchors + TOC + terminology. Coordinate with be-15 on the deletion section |
| `be-14-patient-workspace.md` | Clinic patient workspace | ready | Patient identity (safety), responsive, sticky tabs |
| `be-15-patient-web-account.md` | Patient web account (read-only, consent-gated) | ready | Cross-cutting: server + website + app. Ship Part 1 → 2 → 3. Reuses be-14's renderer |

## Decisions (settled 2026-07-25 — no open questions for Auto)

| Question | Decision | Where |
|---|---|---|
| Landing copy: repo or live? | **Repo.** Live is one deploy behind `61e76a2`; deploying applies the intended H1 | `be-11` |
| Consolidate 15 help articles into one page per locale? | **No.** Saves nothing on translation, breaks deep links from shipped app builds | `be-12` |
| Localize the privacy policy? | **Summary only**, full policy stays English | `be-13` |

## Deploy note

The site is stale — the VPS has not pulled since `61e76a2` (2026-07-24). Deploy is
`git pull --ff-only` then `bash server/scripts/deploy-website.sh` on the VPS
(`server/DEPLOY-WEBSITE.md`). Deploy is human-owned.

## Status values

| Status | Meaning |
|--------|---------|
| `ready` | Auto may implement |
| `in_progress` | Auto working |
| `done` | Shipped + smoke-tested; move or leave as record |
| `blocked` | Needs human decision |

## Auto kickoff (paste)

```
Implement the drafts in prompts/backend/opus5/drafts/ following the Execution order
table in that folder's README. Start with be-10 and stop after it so I can verify
before you continue.

Rules:
- Follow each file's paths, design rules, and acceptance criteria exactly.
- Do not redesign beyond the draft, and do not touch files it lists as off-limits.
- Mark Status: in_progress when you start a batch and done when its acceptance
  criteria pass; update the table in this README.
- Never hand-edit generated help HTML — change the generator and regenerate.
- Do not commit or deploy. Both are human-owned.
```
