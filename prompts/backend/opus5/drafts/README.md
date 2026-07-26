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
| **be-17** snapshot purge | **Jumps the queue — run before be-15.** Not a feature: `privacy.html` promises that revoking a clinic link purges the snapshot, and no such deletion exists anywhere in the server. Found 2026-07-26 while re-validating be-15, whose consent rules assume the purge is already there |
| **be-18** privacy claims audit | **Also jumps the queue.** be-17 fixed one false paragraph; this is the systematic pass that should have preceded it. Nine more claims were wrong, two of them affirmative denials of things the product does. Part A (policy text) must land before be-15 rewrites `#deletion` |
| **be-15** patient web account | Largest and cross-cutting (server + website + app). Depends on be-13, be-14, **be-17** and **be-18 Part A** |
| **be-16** landing visual direction | The only batch that raises the ceiling rather than the floor. Needs be-10's tokens and be-11's fixes underneath it. **Pulled forward and built on 2026-07-26**, ahead of be-13 to be-15: its dependencies (be-10, be-11) were already done, and the site's look was the owner's standing complaint. be-13 to be-15 are unaffected — it touches only `index.html`, `styles.css` and `tokens.css` |

be-11, be-12 and be-13 do not depend on each other and may be reordered or parallelized. be-08,
be-10, be-14, be-17 and be-15 are strictly ordered.

### Two notes that will otherwise cause confusion

- **Help regeneration happens once.** be-10 must add `tokens.css` to the generator template and bump
  `CSS_VER`, but should **defer running the generator** to be-12, so there is one 160-file diff
  instead of two. If be-12 is not running in the same session, regenerate at the end of be-10.
- **Checkpoint after be-10.** It is a global refactor with the widest blast radius in the pack.
  Verify landing, help, privacy, clinic portal and workspace all still render before starting be-11.
  Layout must not move — only typography and the retired `--green*` aliases should change.

### Deploy

Human-owned. Deploy is `git pull --ff-only` then `bash server/scripts/deploy-website.sh` on the VPS —
see `server/DEPLOY-WEBSITE.md`. Current as of `9091ed6` (be-14, 2026-07-26): the earlier drift, where
the VPS had not pulled since `61e76a2` and the live H1 still read "A full metabolic OS", is resolved.
Verify a deploy by checking the cache token on a live page rather than trusting the script's exit
code — 165 of be-14's 168 files were token-only, so a stale page serves old CSS silently.

| File | Title | Status | Notes |
|------|-------|--------|-------|
| `be-10-design-system.md` | Shared design system (tokens) | done | Reviewed 2026-07-26. Tokens live, `--green*` gone. Review added `--accent-ink` (5.85:1) — `--accent` is 3.0:1 and had dropped four workspace controls below AA. Link contrast → be-11, muted prose → be-13 |
| `be-09-copy-and-proof.md` | Landing copy and proof | done | Reviewed 2026-07-26. Strong copy; H1 passes the competitor test. Review fixed a privacy one-liner that contradicted `privacy.html` (omitted the Gemini path), cropped the proof screenshot (a 640×1422 phone shot had stretched row 1 to 800 px and left an orphan grid cell), and added `<picture>` + lazy. Founder note now live (Raviv Shweid, $3,000 private program). Held back: the "13 days to normal cholesterol" result, pending lab values and a no-medication confirmation — see review section |
| `be-11-landing.md` | Landing page | done | Reviewed 2026-07-26. Logo unboxed, badges are true peers at 166×49, card grid gone. Review capped prose at `--measure` (stacked sections had pushed every line to 115–119ch), finished the inherited link-contrast fix globally (`a` was still `--accent` inside cards), and rebuilt the logo alpha — the flood fill had left white inside enclosed letter counters and 0 % anti-aliasing. Tagline-in-PNG and duplicate wordmark → be-16 |
| `be-12-help.md` | Help site (10 locales) | done | Reviewed 2026-07-26. Cleanest batch — generator-only scope; hreflang, canonical, RTL and dead-CSS removal all verified. Review localized the language switcher (label and button were `Language / שפה` + `Go` on all ten locales) and dropped the `onchange` that put distant options out of keyboard reach. **Never edit `gen-help-locales.mjs` through a PowerShell text round trip** — it turns the em dash and arrows into mojibake across all 160 pages; see review section. Open: collapse the 15 tiny articles? |
| `be-13-privacy.md` | Privacy policy page | **done** | Phase B shipped 2026-07-26: summary localized into 9 languages via a JSON island and a single swap, so English stays the only summary in the markup and no-JS / unknown-locale / corrupt-payload all fall back to the policy of record. Website-only — the app never links to `privacy.html` (the wizard's privacy link goes to the `quick-start-welcome` help article), so `navigator.language` covers the real entry point, which is the Play Store listing. Cache tokens moved to forward-only `20260726d`. Phase A, reviewed and accepted the same day: anchors, TOC, doc-date, two terminology fixes, unified `?v=20260726be13` + help regen, landing → `#clinic-sharing`. Review added `scroll-margin-top` — every anchor landed its heading flush at `top: 0` with ascenders clipped, which matters because the app opens `#clinic-sharing` at the moment of consent — and made the TOC padding logical. Cache tokens now need a rule: the token moved *backwards* (be16 → be13), so `be11` and `be16` are burned; see the `CSS_VER` comment in the generator. `privacy-390.png` in the evidence folder is a clamped-window crop and falsely shows overflow — measured 0px at every width, use `opus-privacy-390.png`. Coordinate with be-15 on `#deletion` |
| `be-14-patient-workspace.md` | Clinic patient workspace | **done** | Reviewed 2026-07-26. Identity from `/v1/shares` matched on `patientId` (never in the URL) + `Patient · {short id}` fallback + per-tab `document.title`; sticky `.ws-chrome` wrapping topbar **and** tabs, so no guessed `top` offset; horizontal tab scroll; 720px responsive; loading skeleton. `clinic-workspace.js` untouched, so empty-state copy is byte-identical by construction. Review found the skeleton stayed on screen forever on **both** error paths — a patient who has not opened the app showed "No snapshot yet" over an endless shimmer with `aria-busy` and a stale "Loading snapshot…", which is the most common state in an alpha; the old code hid `#ws-main` there, so the skeleton introduced it. Also added the missing `prefers-reduced-motion` guard (1.2s infinite animation, no guards anywhere in that file), un-serialised identity vs snapshot (two round trips deep for no reason; identity now survives a snapshot 404), and tokenised hardcoded skeleton colours. Cache `20260726e` needed no bump — built but never served. be-15 reuses this renderer |
| `be-17-snapshot-purge.md` | Make the snapshot purge real | **done** | Shipped and deployed 2026-07-26 (`e4c131a`), server and website together, verified live. Written **and built** by Opus 5 the same day, out of a be-15 re-validation. `privacy.html` tells users that revoking a clinic link "immediately purges" the snapshot, that it sits in "temporary server memory only" and is "not saved in our database". All three are false: the payload is a `BYTEA` column in `sync_blobs`, there is no `DELETE FROM sync_blobs` anywhere in `server/src`, and `nextVersion()` means every version a patient ever uploaded is still there (15 MB cap each, nothing reads below the newest). `revokeShare` sets a status and removes the sponsorship, nothing more. Fix the code rather than the promise, plus one sentence that is false either way. Two of the draft's own instructions were wrong and were corrected while building: `clinic_patient_overlays` is keyed by `patient_id` alone with no `mentor_id`, so it is shared by every linked clinic and must not be deleted per link, and `shares.ts` sits below `sync.ts` in the import graph, so the purge lives in a new leaf module `consent.ts` to keep it inside `revokeShare` without a cycle. Verified against real Postgres 16 via PGlite loaded with `schema.sql` (no local Postgres or Docker here, and production is not a test target for destructive SQL); the harness asserts its statements appear verbatim in the source so it cannot drift. 8/8, including the two-clinic case where revoking one must delete nothing. **Not deployed** — code and reworded page ship together |
| `be-15-patient-web-account.md` | Patient web account (read-only, consent-gated) | **blocked on be-17** | Cross-cutting: server + website + app. Ship Part 1 → 2 → 3. Re-validated 2026-07-26: its purge bullets are built on a purge that does not exist, so they moved to be-17; afterwards be-15 only widens "consumer" in one function. Three claims went stale under later batches (privacy contact is now `support@`, be-16 already shipped a site nav, be-14's responsive work is done). The `readOnly` flag is easier than the draft assumed — `clinic-workspace.js` makes no calls of its own, and all three clinic endpoints sit in just two of the eight tabs, so dropping `chat` and `rules` from `initTabs` removes them at once; Sponsor AI and Refresh are page-shell, not renderer. Remaining real work: third-person clinic copy that reads wrong on a patient's own page |
| `be-18-privacy-claims-audit.md` | Privacy policy claims audit | **Part A done** | Written and built by Opus 5 on 2026-07-26, immediately after be-17 deployed. be-17 fixed the one false paragraph it happened to be pointed at; nobody had ever diffed the whole document against the code. Nine more claims were wrong. Two are affirmative denials: the policy says "we do **not** upload this health data to our server" while `user_cloud_backups` holds the full opt-in backup **plus** the previous copy, and the word "cloud" appears nowhere on the page; and Gemini is described as receiving context "from your device" while `geminiClinic.ts` posts a `PATIENT DATA:` block built from the stored snapshot whenever a *clinician* opens chat — the patient's data reaches Google through someone else's action. "What we collect on our server" listed 3 things against 14 tables, omitting Stripe identifiers and card last4, wallet ledger, and a per-patient AI usage log kept indefinitely. Permissions listed 3 of ~15; Health Connect reads five record types, not one; Apple Health was absent entirely. Part A (policy text, all ten languages) is built and **not deployed**. Part B is app and server work needing a build and phone test: drop the unused `RECORD_AUDIO` that `expo-image-picker` adds, decide whether `SYSTEM_ALERT_WINDOW` belongs in a release manifest, and set a retention policy. **The Health Connect `Distance` read is closed and off-limits** — owner has phone-tested the steps-only kcal path and confirmed it; the calorie code is not to be touched, not even for a behaviour-neutral cleanup. Part B shrinks what Part A has to disclose, so expect a second smaller policy edit after it |
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
