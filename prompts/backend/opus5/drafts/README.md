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
| **be-09** copy and proof | **Runs after be-10, despite the number.** Added 2026-07-26, once be-10 was already in flight; it sorts before be-10 because it has no dependency on tokens. Must land before be-11 and be-16 so both are built around final wording |
| **be-11** landing | Pure presentation on top of tokens. Highest visible payoff (logo, badges, nav) |
| **be-12** help | Regenerates 160 files — run alone so the diff is reviewable |
| **be-13** privacy | Must precede be-15, which rewrites the `#deletion` section |
| **be-14** patient workspace | Must precede be-15, which reuses this renderer read-only. Fixing responsive + identity here means be-15 inherits a clean renderer |
| **be-15** patient web account | Largest and cross-cutting (server + website + app). Depends on be-13 and be-14 |
| **be-16** landing visual direction | The only batch that raises the ceiling rather than the floor. Needs be-10's tokens and be-11's fixes underneath it. **Pulled forward and built on 2026-07-26**, ahead of be-13 to be-15: its dependencies (be-10, be-11) were already done, and the site's look was the owner's standing complaint. be-13 to be-15 are unaffected — it touches only `index.html`, `styles.css` and `tokens.css` |

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
| `be-10-design-system.md` | Shared design system (tokens) | done | Reviewed 2026-07-26. Tokens live, `--green*` gone. Review added `--accent-ink` (5.85:1) — `--accent` is 3.0:1 and had dropped four workspace controls below AA. Link contrast → be-11, muted prose → be-13 |
| `be-09-copy-and-proof.md` | Landing copy and proof | done | Reviewed 2026-07-26. Strong copy; H1 passes the competitor test. Review fixed a privacy one-liner that contradicted `privacy.html` (omitted the Gemini path), cropped the proof screenshot (a 640×1422 phone shot had stretched row 1 to 800 px and left an orphan grid cell), and added `<picture>` + lazy. Founder note now live (Raviv Shweid, $3,000 private program). Held back: the "13 days to normal cholesterol" result, pending lab values and a no-medication confirmation — see review section |
| `be-11-landing.md` | Landing page | done | Reviewed 2026-07-26. Logo unboxed, badges are true peers at 166×49, card grid gone. Review capped prose at `--measure` (stacked sections had pushed every line to 115–119ch), finished the inherited link-contrast fix globally (`a` was still `--accent` inside cards), and rebuilt the logo alpha — the flood fill had left white inside enclosed letter counters and 0 % anti-aliasing. Tagline-in-PNG and duplicate wordmark → be-16 |
| `be-12-help.md` | Help site (10 locales) | done | Reviewed 2026-07-26. Cleanest batch — generator-only scope; hreflang, canonical, RTL and dead-CSS removal all verified. Review localized the language switcher (label and button were `Language / שפה` + `Go` on all ten locales) and dropped the `onchange` that put distant options out of keyboard reach. **Never edit `gen-help-locales.mjs` through a PowerShell text round trip** — it turns the em dash and arrows into mojibake across all 160 pages; see review section. Open: collapse the 15 tiny articles? |
| `be-13-privacy.md` | Privacy policy page | **run next** | Anchors + TOC + terminology. Coordinate with be-15 on the deletion section |
| `be-14-patient-workspace.md` | Clinic patient workspace | ready | Patient identity (safety), responsive, sticky tabs |
| `be-15-patient-web-account.md` | Patient web account (read-only, consent-gated) | ready | Cross-cutting: server + website + app. Ship Part 1 → 2 → 3. Reuses be-14's renderer |
| `be-16-landing-visual-direction.md` | Landing visual direction (2026 level) | **needs-review** | Built by Opus directly on 2026-07-26, out of queue order — it is the batch that answers "does not look like a 2026 product", and its own review section says the judgment matters more than the checkboxes. Two-column hero with a real phone, inverted local-first band with an SVG diagram, four section treatments, opt-in dark mode, `IntersectionObserver` entrance. Lighthouse mobile 98 / 100 / 100 / 100. Evidence in `tmp/be-16-review/`. Awaiting owner sign-off in a browser |

## Floor vs ceiling

**be-09 and be-16 are the only two batches that change how the site lands on a stranger** — one the
words, the other the look. The rest fix what is broken. If the pack ships without them, the site will
be correct, accessible, responsive, and still read as an internal tool.

be-10 through be-15 fix what is **wrong**: a boxed logo, cropped badges, 120-character lines, 15px
tap targets, a desktop-only workspace, a missing patient account. Necessary, and none of it makes the
site look like a 2026 product.

**be-16 is the only batch that changes how the site looks.** It adds the product imagery, type scale,
section rhythm, dark mode, and motion that are simply absent today. Expect the visible transformation
there — and expect the earlier batches to make it far cheaper to build.

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
| `needs-review` | Acceptance criteria pass; waiting on the Opus design review |
| `done` | Reviewed and accepted; leave as record |
| `blocked` | Needs human decision |

## Review loop (Opus ↔ Auto)

Every draft ends with a **Review by Opus 5** section. Those items are judgment calls that a checkbox
cannot settle — whether the logo reads as intentional, whether a consent toggle carries the right
weight, whether a fix hit its own failure mode.

```
Opus writes draft → Auto implements → Auto sets needs-review + attaches evidence
   → Opus reviews → accepted (done) or a follow-up draft
```

**Auto must not mark a batch `done` on its own.** Set `needs-review`, attach the evidence the draft
asks for, and stop. If the review finds something, it becomes a new numbered draft rather than an
edit to the finished one, so the record of what shipped stays accurate.

Screenshots go wherever is convenient and get referenced by path in the review handoff — they are
throwaway evidence, not repo assets.

## Auto kickoff (paste)

```
Implement the drafts in prompts/backend/opus5/drafts/ following the Execution order
table in that folder's README. Start with be-10 and stop after it so I can verify
before you continue.

Rules:
- Follow each file's paths, design rules, and acceptance criteria exactly.
- Do not redesign beyond the draft, and do not touch files it lists as off-limits.
- Mark Status: in_progress when you start. When the acceptance criteria pass, set
  Status: needs-review, attach the evidence its "Review by Opus 5" section asks
  for, and stop. Do not mark anything done yourself.
- Never hand-edit generated help HTML — change the generator and regenerate.
- Do not commit or deploy. Both are human-owned.
```
