# Implementation drafts (Opus → Auto)

Opus 5 writes shippable batch prompts here after pass `06`.  
**Auto** implements only files in **this folder** with `Status: ready`.

```
drafts/
  TEMPLATE.md          ← new draft shape
  be-NN-….md           ← ready / in_progress / blocked (active)
  done/                ← shipped + accepted (record only)
  README.md            ← this file
```

When a batch is accepted, move it to `done/` and add a one-line entry in `done/README.md`.

## Active backlog

| File | Title | Status | Notes |
|------|-------|--------|-------|
| `be-22-clinic-portal-visual.md` | Clinic portal visual rebuild (2026 level) | **ready** | Last open batch. Depends on be-10 tokens + be-16 direction (both done). be-21's 57/57 probe is the non-regression gate. Gate alpha billing behind `?dev=1`; lead balance with money from pack rate; keep tokens as the metered unit |

## Done

See [`done/README.md`](done/README.md) — be-09 through be-21.

## Execution history (why the numbers are scrambled)

File numbers are chronological discovery order, not the only run order. What actually mattered:

| Batch | Why it sat where it did |
|---|---|
| **be-10** before cosmetics | Tokens consumed by everything later |
| **be-09** after be-10 despite the number | Added mid-flight; copy must land before be-11 / be-16 |
| **be-17 / be-18** before be-15 | Policy and purge promises had to be true before the patient account page |
| **be-16** pulled forward | Owner's standing “does not look 2026” complaint; only needed be-10 + be-11 |
| **be-22** last | Repaints the portal be-21 just rewired; correctness before cosmetics |

## Status values

| Status | Meaning | Location |
|--------|---------|----------|
| `ready` | Auto may implement | this folder |
| `in_progress` | Auto working | this folder |
| `needs-review` | Waiting on design / owner review | this folder |
| `blocked` | Needs human decision | this folder |
| `done` | Accepted; record only | `done/` |

## Review loop (Opus ↔ Auto)

```
Opus writes draft → Auto implements → Auto sets needs-review + attaches evidence
   → Opus / owner reviews → accepted (move to done/) or a follow-up draft
```

**Auto must not mark a batch `done` on its own.** Set `needs-review`, attach the evidence the draft asks for, and stop. Owner acceptance (e.g. “looks ok”, “lgtm”, “works”) is what moves it to `done/`.

## Deploy

Human-owned. `git pull --ff-only` then `bash server/scripts/deploy-website.sh` on the VPS — see `server/DEPLOY-WEBSITE.md`. Verify a deploy by checking the cache token on a live page rather than trusting the script's exit code.

## Auto kickoff (paste)

```
Implement ready drafts in prompts/backend/opus5/drafts/ (not drafts/done/).
Start with be-22.

Rules:
- Follow each file's paths, design rules, and acceptance criteria exactly.
- Do not redesign beyond the draft, and do not touch files it lists as off-limits.
- Mark Status: in_progress when you start. When the acceptance criteria pass, set
  Status: needs-review, attach the evidence its review section asks for, and stop.
  Do not mark anything done yourself — wait for owner sign-off, then move to done/.
- Never hand-edit generated help HTML — change the generator and regenerate.
- Do not commit or deploy unless asked.
```
