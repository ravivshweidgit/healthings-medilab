# be-28 — Patient workspace: stop mirroring the phone

**Status:** ready
**Model to implement:** Auto
**Authored by:** Opus 5 (owner walkthrough of all 8 workspace tabs + portal/app code audit, 2026-07-27)
**Depends on:** be-25 (portal IA), be-27 (patient names in the title)
**Splits into:** be-29 (workspace i18n), be-30 (labs + lipids clinical view) — see *Deliberately split out*

> The app is a self-tracking tool for one person holding a 390 px phone.
> The workspace is a review tool for a clinician on a 1440 px screen who has
> ninety seconds for this patient. Same data, different job.

## Problem

The workspace renders the patient's phone, faithfully, in a browser. It says so out
loud: *"Tap a row to expand like on the phone"* (`clinic-workspace.js:637`),
*"Click a meal card to see items like on the phone"* (`:402`). The Profile tab
reproduces the app's accordion verbatim, first-person labels included — a clinician
reading רביב's chart is shown a row called **My Profile**. The pronoun is wrong, and
it is wrong because nobody re-asked what a clinician needs; the app screen was ported.

That decision then sets the layout. Every tab body is a centred phone-width card —
`.profile-tab-card` 640 px, `.lipid-tab-card` / `.nutrition-tab-wrap` /
`.food-log-panel` 720 px (`clinic-workspace.css:339, 681, 968, 1074`) — inside a shell
that allows `--max-w: 1440px` (`:13`). On the owner's 1024 px screenshots the content
column floats in the middle with two dead gutters; on a real clinic monitor it is worse.
We are paying for desktop and shipping phone.

## Goal

A clinician opening a patient can answer *who is this, how fresh is this, what changed,
what needs attention* without clicking a tab. Reading surfaces use the width they have.
Nothing on screen exists because the phone had it.

**Data parity is not the target and must not regress** — `persistence-parity.mdc` still
governs what the snapshot carries. This batch changes presentation only.

## Findings

| # | Finding | Evidence |
|---|---|---|
| **P1** | Patient-voice labels shown to clinicians: My Profile / My Targets / My Mentors / My Rules / My Macros — **the app already dropped these**; it ships bare nouns | portal `clinic-workspace.js:556-641` vs app `profileSettingsStripCopy.ts:29-36` (`myProfile: 'PROFILE'`) |
| **P2** | Tab bodies capped at 640–720 px inside a 1440 px shell; ~60 % of a desktop viewport is empty | `clinic-workspace.css:339, 681, 968, 1074` vs `:13` |
| **P3** | Header ships debug metadata: `Snapshot v115 · shared 27/07/2026, 01:13:39 · 204 KB` | `patient.html:153-156` |
| **P4** | Workspace is English-only — `patient.html` never loads `clinic-i18n.js`; all 64 `data-i18n` attributes are in `index.html` | grep `ClinicI18n` → 1 hit, in the catalog itself |
| **P5** | Eight peer tabs mix six read surfaces with two write surfaces; `Rules (live)` leaks a code parenthetical into the UI | `clinic-workspace.js:1175-1184` |
| **P6** | No persistent patient banner — age, sex, weight, active-rule count all require entering Profile | `patient.html:14-21` |
| **P7** | Dashboard opens on sub-day ranges (1H/2H/3H/6H) — CGM-watching behaviour, not case review | screenshot 1; app presets `MetabolicChart.tsx:115-127` |
| **P8** | Labs is an ungrouped dump: dozens of ultrasound velocity rows, many `0 cm/sec`, empty Flag column, no panels, no ranges | `clinic-workspace.js:1152-1173`; screenshot 8 |
| **P9** | Lipids is 3 draws alone in a 720 px box; it is a lab panel wearing a tab | `clinic-workspace.js:1056`; screenshot 3 |
| **P10** | Nutrition report text scrolls inside a ~200 px inner scroller, inside a 720 px card, inside a 1440 px page | `clinic-workspace.css:681`; screenshot 5 |
| **P11** | Inline styles and raw hex emitted from JS; `.ws-btn.secondary` is used but never styled, so the rules-restore button renders as a default browser button | `clinic-workspace.js:363-366, 478-481, 931`; only `.ws-btn.primary` exists at `clinic-workspace.css:117` |
| **P12** | **700 lines of dead code**: `clinic-dashboard.js` (439) + `clinic-dashboard.css` (261) are an earlier mirror of this same page. No HTML loads either — zero `<script>`/`<link>` references repo-wide | grep `clinic-dashboard.js` → hits only inside itself |
| **P13** | The Withings card badge is a hardcoded green **OK** regardless of data age — a false freshness signal on a clinical screen | `clinic-workspace.js:686` |
| **P14** | The two *write* surfaces report failure with `alert()` and have no inline error region | `clinic-workspace.js:788` (chat send), `:1041-1044` (rules save) |

## Scope — this batch

**P1, P2, P3, P5, P6, P7, P10, P11, P12, P13, P14.**

### P12 — delete the abandoned mirror first

`clinic-dashboard.js` (439 lines) and `clinic-dashboard.css` (261 lines) are an earlier,
simpler read-only mirror of the same dashboard. **Nothing loads them** — there is no
`<script>` or `<link>` for either anywhere in the repo. They survived because
`website/styles.css:614` copied their phone-frame rules out *verbatim* for the landing
page (be-16), so the originals stopped being edited but never got removed.

Delete both. Confirm `website/styles.css` still renders the landing phone frame after,
since that copy is the only live consumer of those rules. Doing this first means the
rest of the batch is not read against 700 lines of plausible-looking dead code.

### P13 — the OK badge must mean something

`clinic-workspace.js:686` prints a green **OK** chip on the Withings card unconditionally.
On a clinical screen a green badge is a claim. Either drive it from the body-scan
measurement date (`OK` when within ~7 days, muted `Stale · 12 d` beyond) or remove it.
Do not leave a decorative green.

### P14 — write surfaces need real error UI

Clinic chat send (`:788`) and rules save (`:1041-1044`) report failure with `alert()`.
These are the only two places a clinician *writes* to a patient record, so they are
exactly where a dismissable native dialog is wrong: it loses the message, gives no retry,
and cannot be read by a screen reader in context. Add an inline error region next to the
control, keep the composed text, offer retry.

### P6 — patient banner (do this first; it justifies the rest)

A sticky band under the topbar, always visible, every tab:

```
רביב שוויד   56 y · Male · 180 cm        77.2 kg   16.9 % fat        2 rules active   Synced 16 min ago
```

Pull from `parsed.profile` + `parsed.withings.bodyScan` (already loaded — see
`renderDashboard`, `clinic-workspace.js:677-698`). Weight/fat come from the same
`bodyScan` the Withings card uses; do not add a fetch.

Rules count = `effectiveRules(ctx.parsed, ctx.overlay)` length. If the overlay supplies
them, label the chip **Clinic rules** so the clinician knows they are looking at their
own org's directive, per be-23 isolation.

### P3 — header carries freshness, not build metadata

| Show | Hide |
|---|---|
| `Synced 16 min ago` (relative; exact stamp in `title=`) | `v115` |
| `Clinic rules active` as a chip, not trailing prose | `204 KB` |

Keep version and byte size available for support: put them in the `title` attribute of
the freshness element. A clinician never needs them; a support call sometimes does.

### P1 — clinician-voice labels

The app is already here. `profileSettingsStripCopy.ts:29-36` ships `PROFILE`, `TARGETS`,
`MENTORS`, `RULES`, `MACROS` — bare nouns, exactly as `language-policy.mdc` requires
("Profile nested titles use bare nouns … not 'My …' product phrases"). Only the portal
still says *My*. This is not a redesign, it is the portal catching up to a locked policy.

| Now | Becomes |
|---|---|
| My Profile | Profile |
| My Targets | Targets |
| My Mentors | Care team |
| My Rules | Dietary rules |
| My Macros | Macro targets |
| Coach | Coach summary |

`Care team` is the one intentional divergence from the app's `MENTORS`: the reader here
is the clinician, and they are looking at a roster, not at their own mentor picker.

Delete *"Tap a row to expand like on the phone"* and *"like on the phone"*
(`:402, :637`). Replace the Profile subtitle with what the row actually is:
*"From the patient's last snapshot — read-only."* Keep **read-only** everywhere it
appears; that one is load-bearing, not phone-talk.

`ctx.selfView` (the patient's own `/account/` view, `clinic-workspace.js:1186-1196`)
keeps first-person copy. **Both branches must be updated** — the strings are ternaries.

### P2 — use the width

Reading tabs get a responsive grid instead of a centred card:

| Tab | ≥ 1100 px | < 1100 px |
|---|---|---|
| Profile | Two columns: identity/targets left, care team + rules + coach right | one column |
| Food log | Day summary + macro bars left, meal cards right (grid, not a row of 4) | stacked |
| Nutrition reports | Report list rail left (~240 px), report body right, no inner scroller (**P10**) | list above body |
| Labs / Lipids | full width table (see be-30) | as-is |

Cap the *text* column, not the page: prose stays ≤ 72ch via a class, panels do not.
Delete the per-tab `max-width` rules; the shell's `--max-w` is the only cap.

While in this file, drop the rules that no JS emits — `.grid-2`, `.grid-3`, `.card`,
`.metric-grid`, `.metric-box`, `.meal-row` (`clinic-workspace.css:216-229, 385-398,
411-418`). Check `website/account/index.html` before deleting `.card`; the self-view
shares this stylesheet.

### P5 — tab bar

`Rules (live)` → **Rules** with a small `Live` chip. Separate the two write surfaces
(Clinic chat, Rules) from the six read surfaces with a divider or trailing group, so the
bar reads *review … act* rather than eight equals.

### P7 — chart ranges

Do **not** invent a new ladder. The app's presets are `1H 3H 6H 12H 24H 2D 4D 8D 16D`,
default 12H (`MetabolicChart.tsx:115-127`); the portal already added 32D. Keep that
ladder and **drop only the sub-6H chips**, defaulting to **24H**. A clinician zooming to
2H is doing something the phone is better at; a clinician comparing 16D to 32D is doing
the job. Same reasoning leaves the trend chips (8D…128D) alone.

## Files to touch

- `website/clinic/patient.html` — header, banner mount, meta copy
- `website/clinic/clinic-workspace.js` — labels, tab list, grid markup, inline styles
- `website/clinic/clinic-workspace.css` — remove per-tab caps + dead rules, add grid + banner
- `website/clinic/clinic-charts.js` — range chip set only
- **Delete** `website/clinic/clinic-dashboard.js`, `website/clinic/clinic-dashboard.css`
- Bump `?v=` on every asset touched, both `patient.html` and `index.html` if shared

`website/account/index.html` renders the same workspace with `selfView: true` and no
overlay (`clinic-workspace.js:1186-1196`). Every change lands on the patient's own view
too — check it, do not break it.

**Do not touch:** `parseSnapshot` field names, `ShareExportService`, the sync blob,
`account_shares`, anything under `server/`.

## Design rules

- Tokens only. `clinic-workspace.css:17-45` may keep its `--ws-chart-*` hex — chart
  series need fixed hues that survive the theme flip — but **no new** raw hex elsewhere.
- Reuse `.chip` from `clinic-portal.css`; do not invent a second badge.
- Always-English glossary still holds: `kcal`, `mg/dL`, `kg`, `CGM`, `BMR`, `AI`.
- Patient-authored text (meal names, rules prose) keeps `dir="auto"`; emails and IDs
  keep `dir="ltr"` — `language-policy.mdc`, verified in the be-25 RTL probe.

## Acceptance criteria

- [ ] 1440 px: no reading tab renders inside a ≤ 720 px centred card
- [ ] Patient banner visible on all 8 tabs, sticky, correct after a tab switch
- [ ] Header shows relative freshness; `v` and `KB` only in `title`
- [ ] Zero occurrences of `like on the phone` or `My ` row labels in clinic view
- [ ] `ctx.selfView` still reads first-person on `/account/`
- [ ] 390 px: single column, banner wraps to two lines, no horizontal scroll
- [ ] `clinic-dashboard.{js,css}` deleted and the landing phone frame still renders
- [ ] Withings badge reflects measurement age; no unconditional green
- [ ] Chat and rules failures show inline, keep the typed text, and offer retry
- [ ] No regression: rules save + sync, chat send, snapshot refresh, meal modal
- [ ] `/account/` self-view renders every touched tab

## Deliberately split out

**be-29 — workspace i18n (P4).** ~3,200 lines of hardcoded English across
`patient.html`, `clinic-workspace.js`, `clinic-dashboard.js`, `clinic-charts.js`. be-26
translated the worklist into 10 locales, so a Hebrew clinic today navigates a translated
list and lands in an English workspace. Mechanical and large; do it *after* this batch so
strings are extracted once, in their final wording, not twice.

**be-30 — labs + lipids as a clinical view (P8, P9).** Grouping by panel, reference
ranges, abnormal-only filter, and whether Lipids survives as its own tab or becomes a
pinned panel inside Labs. Needs clinical judgment on which ranges to assert and a
decision on `0 cm/sec` rows, so it is not an Auto batch — draft it with the owner.

Note for that batch: **the phone is ahead of the clinic here.** The app has
`LabResultsStrip` plus a `LipidTrendChart` that draws clinical threshold bands
(`LipidTrendChart.tsx:73-112`), while the portal's Labs tab is a 22-line untyped table
(`clinic-workspace.js:1152-1173`). Everywhere else this batch argues *stop copying the
phone*; Labs is the one place to go look at what the phone already does.

## Review by Opus 5 (after Auto marks needs-review)

**Evidence to capture**

- Screenshots at 1440 / 1024 / 390 of Dashboard, Profile, Food log, Nutrition reports
- Before/after of the header strip
- Confirmation that `/account/` self-view still reads in first person

**Judgment calls to check**

- Does the banner read as a clinical header, or as another card we bolted on?
- Two columns on Profile: genuinely scannable, or one column with a gap in the middle?
- Did removing the sub-day chart ranges cost anything real for a CGM patient?

## Agent checklist

- [ ] Status → in_progress
- [ ] Changes match this draft only — no i18n, no labs redesign
- [ ] Bump `?v=` and verify the live cache token after deploy
- [ ] Status → needs-review with evidence; do not self-accept

## Related

- be-25 — worklist IA; the same "phone first" instinct was corrected there
- be-23 — org-scoped overlays; the banner's rules chip depends on it
- be-27 — the name now in the workspace title
