# be-14 — Clinic patient workspace

**Status:** needs-review
**Model to implement:** Auto / Composer
**Authored by:** Opus 5 (website UX pack)
**Findings:** W19 (no patient identity — safety), W20 (desktop-only), W21 (tabs wrap, not sticky), W22 (no loading state)
**Depends on:** be-10 (tokens). **be-15** reuses this renderer read-only — keep changes behind the
existing structure, do not fork the file.

## Problem

1. **The workspace never names the patient.** `#patient-title` is the literal string
   `Patient workspace` — set in `patient.html` line 13 and *set again* on successful load (line 79).
   `#patient-meta` shows snapshot version, share time, and KB. `parseSnapshot` reads gender, height,
   birthdate, age, and language, but no name or email. The patient's identity exists only in the URL
   query string and on the portal list page.

   A clinician with three patients open in three browser tabs sees three identical titles reading
   "Patient workspace". In a tool used to write dietary rules for a named person, that is a
   wrong-patient hazard, not a cosmetic gap. **This is the highest-priority item in the batch.**

2. **Desktop-only.** Three media queries exist — `960px` (grid columns), `1100px` (charts row),
   `720px` (chat layout) — and none touch the topbar, tabs, or main container. The file's own first
   line says "desktop-first". A clinician opening a patient on a tablet between appointments gets a
   layout that was never considered.

3. **Eight tabs wrap instead of scrolling.** `.ws-tabs` uses `flex-wrap: wrap`, so on a narrow
   window the tab bar becomes two or three stacked rows that push content down. The topbar is
   `position: sticky`, but the tabs are not — so scrolling into the food log leaves no way to switch
   tabs without scrolling back up.

4. **No loading state.** While the snapshot fetches, the tabs and main content are `hidden` and the
   only feedback is the word "Loading snapshot…" in small muted meta text. The page reads as broken
   rather than busy. The one exception is the chat spinner, which is done well.

## Worth keeping

The empty states are excellent and specific — "Need at least 2 lipid lab draws in the snapshot to
show trend charts", "No meals this day", "Still waiting — ensure the patient app is open… then tap
Refresh snapshot again". These tell a clinician what to do next, which most products fail at. Leave
them alone. The snapshot provenance line ("Read-only snapshot · patient phone data · v{N}") is also
exactly right for a clinical tool and should stay visible.

## Goal

A clinician always knows **whose** data is on screen, can use the workspace on a tablet, and can
switch tabs from anywhere on the page.

## Files to touch

- `website/clinic/patient.html`
- `website/clinic/clinic-workspace.css`
- `website/clinic/clinic-workspace.js` (title/meta rendering only)
- Do **not** touch: `clinic-charts.js` rendering logic, empty-state copy, `clinic-dashboard.*`

## Design rules (from Opus)

- Patient identity is **persistent chrome**, not a detail — it belongs in the sticky topbar and in
  `document.title`, so it survives scrolling and tab-switching in the browser.
- Do not add a patient photo or avatar. Email plus display name is the right amount of identification
  for a clinical tool; anything more invites shoulder-surfing risk.
- Tabs on narrow screens **scroll horizontally**; they never wrap. Wrapping changes the height of
  the chrome, which moves content unpredictably.

## Re-validated against the code 2026-07-26 — read this before the notes below

Every CSS and layout claim in this draft still holds: `.ws-tabs` has `flex-wrap: wrap`
(`clinic-workspace.css:80`), the topbar is `position: sticky` (`:45`), the three media queries are
at 960 / 1100 / 720, `.charts-row` is pinned to `height: 520px; max-height: 520px` (`:209`), and
`--tap-min: 44px` exists from be-10 so the snippet below compiles. Line numbers in the Problem
section have drifted by one (`patient.html` 13 → 14, 79 → 80); the content is unchanged.

Two things in the original Implementation notes were wrong, both about identity.

**1. The email is not "already there to pass through."** The portal list does hold it —
`share.patientEmail`, from `/v1/shares?status=approved` — but the Open workspace link is:

```js
view.href = 'patient.html?patientId=' + encodeURIComponent(share.patientId);
```

Only the opaque id crosses. `patient.html` never learns who the patient is.

The tempting one-line reading of "pass it through" is to append `&email=`. **Do not.** That puts a
patient's email in the address bar, in browser history, in any copied link, and in the referrer of
every outbound click — in the same tool this draft says should avoid shoulder-surfing risk.

Close it on the workspace side instead. `patient.html` already authenticates through `ClinicApi`
and already calls two authorized endpoints; add a third call to `/v1/shares?status=approved` and
match on `patientId`. The server already returns `patientEmail` in `PublicShare`
(`server/src/.../shares.ts:12`, `:55`), so **no server change is needed** and the email never
appears in a URL.

**2. There is no patient name anywhere.** The snapshot has none — the `name` fields in
`clinic-workspace.js` are meal items and lab rows. So "display name if the snapshot has one" is a
branch that can never be taken. Build email, with `Patient · {short id}` as the fallback when the
shares lookup fails, and drop the name path.

Also worth knowing: the eight tabs are **not** markup. `patient.html` ships
`<nav class="ws-tabs" id="ws-tabs" hidden></nav>` and `initTabs` paints them
(`clinic-workspace.js:1213`). Scroll and sticky are pure CSS so that does not change, but anything
touching tab structure lands in the JS, and the loading skeleton has to account for the strip
starting `hidden`.

## Implementation notes

**Identity.** Fetch it; do not put it in the URL — see the re-validation above:

- `#patient-title` → the patient's email, resolved from `/v1/shares?status=approved`
- `#patient-meta` keeps snapshot version, share time, and size — that is provenance, and it stays
- `document.title` → `{patient email} — Healthings clinic` so browser tabs are distinguishable
- Delete the line that re-sets the title back to `Patient workspace` on load (`patient.html` line 80)
- If the lookup fails, fall back to `Patient · {short id}` — never a generic string shared by
  every patient

**Tabs.**

```css
.ws-tabs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: thin; }
.ws-tab  { flex: 0 0 auto; min-height: var(--tap-min); }
```

Make the tab strip sticky directly beneath the topbar. The topbar has no fixed height, so use a
wrapper that contains both and sticks as one unit rather than guessing a `top` offset.

**Responsive.** Add a `max-width: 720px` block covering: topbar padding down to `12px 16px`, meta
text allowed to wrap under the title, `.ws-main` padding reduced, and `.charts-row`'s fixed
`height: 520px` released to `auto` (it is already single-column below 1100px, so the fixed height
just crops or stretches).

**Loading.** Show a skeleton in the panel area rather than hiding it: three neutral blocks at the
card dimensions, replaced on load. Keep "Loading snapshot…" in the meta line as the text signal.

## Acceptance criteria

- [x] Patient email or name visible in the topbar at all times, including while scrolled
- [x] Browser tab title identifies the patient; two patients in two tabs are distinguishable
- [x] No code path renders the bare string "Patient workspace" as the title of a loaded patient
- [x] Tabs scroll horizontally in one row at 720px and 390px; never wrap
- [x] Tab strip stays reachable when scrolled to the bottom of the food log
- [x] Every tab is ≥44px tall
- [x] Tablet (~820px) and mobile (~390px): no horizontal page scroll, no clipped charts
- [x] Skeleton appears during fetch; no blank-then-pop
- [x] No regression: all 8 tabs render, charts draw, empty-state copy unchanged, rules save works

## Out of scope

- Redesigning the tab information architecture (8 tabs is a lot, but that is a product question)
- Chart redesign
- Read-only mode — that is be-15, which reuses this file behind a flag

## Review by Opus 5 (after Auto marks done)

**Evidence to capture**

- Screenshots with a **real snapshot loaded** at 1440, 820 and 390
- Two patients open in two browser tabs, showing the browser tab titles
- A screenshot scrolled to the bottom of the food log, showing whether tabs are still reachable
- The tab strip at 390 with tab 8 (`Labs`) as the target

**Judgment calls to check**

- Is patient identity **unmissable at a glance**? This is the safety fix; if a clinician has to look
  for it, it has not worked. Also judge the reverse risk: is a full email in persistent chrome too
  shoulder-surfable in a consulting room, and would a name plus partial email be better?
- Do the horizontally scrolling tabs **afford** scrolling? Without a visible cue, tabs 6–8 become
  invisible rather than merely off-screen — which is worse than wrapping was.
- Does the skeleton reduce perceived wait, or just add a flicker before content? If the fetch is
  consistently fast, the skeleton may be noise.
- At 820, is the workspace genuinely **usable for clinical work**, or only "not broken"? Judge
  whether a clinician could write rules on a tablet, not whether the CSS survives.
- Confirm the empty-state copy is byte-identical to before. It was the best thing in the file.

## Agent checklist

- [x] Status → in_progress
- [x] Empty-state copy left untouched
- [x] Changes match this draft only — identity via `/v1/shares` (no email in URL); no display-name branch; tabs painted in JS unchanged; charts/dashboard untouched
- [x] Smoke criteria above
- [x] Status → needs-review (evidence in `tmp/be-14-review/`) — **do not mark done**
- [x] Update `drafts/README.md` table
- [x] CSS token bumped `20260726d` → `20260726e` + help regen

## Opus 5 review outcome (2026-07-26) — accepted with fixes

**Status: done.** The safety fix is right and the way it was built is right. Identity comes from
`/v1/shares?status=approved` matched on `patientId`, so the email never enters the URL, history or
referrer; `Patient · {short id}` covers the unmatched case; `document.title` disambiguates two open
tabs. Sticky was applied to a new `.ws-chrome` wrapper rather than to the topbar and the tab strip
separately, which avoids guessing a `top` offset that would have broken the moment the topbar
wrapped. `.ws-tabs[hidden] { display: none !important }` is a real catch — `display: flex` beats the
`hidden` attribute, and without it the empty nav would have shown as a stray border during load.

`clinic-workspace.js`, `clinic-charts.js` and `clinic-dashboard.*` are untouched in the diff, so the
empty-state copy is byte-identical by construction rather than by inspection. Cache token is
`20260726e` across all 328 references with `CSS_VER` in step.

### Fixed during review — the skeleton lied on every error path

`capture.mjs` only ever exercises the happy path. Both failure paths left the skeleton on screen
permanently:

| Path | Before | After |
|---|---|---|
| `404` no snapshot yet | Error text **plus** three shimmering blocks, `aria-busy="true"`, infinite animation, and `patient-meta` still reading "Loading snapshot…" | `clearWorkspace()`, meta cleared |
| `!ok` (500) | Same, on top of any stale content | `clearSkeleton()`; meta cleared only if nothing had rendered, so a stale panel keeps its provenance line |

This matters most in the single most common state in an alpha: a patient who has been approved but
has not opened the app yet. The clinician saw "No snapshot yet. Tap Refresh snapshot" and, directly
underneath, a loading animation that never stopped — the page said *nothing here* and *still coming*
at the same time, and the topbar agreed with the second one. The old code hid `#ws-main` on 404, so
this was introduced by the skeleton, not inherited.

Two smaller fixes in the same pass:

- **No `prefers-reduced-motion` guard.** A 1.2s infinite shimmer with no escape hatch, in a file that
  had no motion guards at all. Now `animation: none` with a flat `var(--bg)` fill — still a visible
  placeholder, not an invisible one. Verified with `emulateMediaFeatures`.
- **Identity and snapshot were serialised.** `applyPatientLabel(await resolvePatientLabel(...))` ran
  to completion before the snapshot fetch started, so time-to-content was two round trips deep for
  no reason. Now both are in flight together; `renderWorkspaceFromSync` re-applies the label if it
  lands first, so either resolution order converges. A side benefit is that identity no longer
  depends on the snapshot succeeding — the error screenshots show the email resolved while the
  snapshot 404s.
- Skeleton colours were hardcoded `#eef1f4` / `#f7f8fa`; moved to `--bg` / `--surface`. Small, but
  it is the exact class of thing be-10 existed to remove.

The CSS change did not need a token bump: `20260726e` was built but never deployed, so nothing has
ever been served under it. The forward-only rule applies to *deployed* tokens.

### Judgment calls from the review section

- **Identity at a glance** — yes. At every width the email is the largest thing after the back link,
  and at 390 it is on its own line above the fold. The shoulder-surfing counter-risk raised in the
  draft is real but not actionable yet: there is no patient name in the snapshot to fall back to,
  and a partial email in a consulting room is worse than useless for confirming you have the right
  chart open. Revisit if be-15 ever gives patients a display name.
- **Do the tabs afford scrolling?** Partially. At 390 the eighth tab is clipped mid-word, which is
  the honest cue, and `scrollbar-width: thin` helps on desktop. It is better than the old wrap.
- **Does the skeleton earn its place?** On the happy path, yes. On the error paths it was actively
  harmful, which is now fixed.
- **Is 820 usable for clinical work?** Yes — 820 is above the 720 breakpoint so it keeps the desktop
  layout, and the charts row still fits. Below 720 the charts unstack to `height: auto`.

### Not fixed — noted for later

The 404 screen is one line of red text above roughly 600px of empty page. It is honest now, but a
centred empty-state card would read better. Left alone deliberately: the draft ring-fenced
empty-state copy, and this is presentation polish that overlaps be-15.

Evidence added: `probe-empty.mjs` / `probe-empty.json` (404, 500, and 404 under reduced motion),
`probe-motion.mjs` / `probe-motion.json` (guard verified with the skeleton actually on screen),
`probe-no-snapshot.png`. Auto's nine checks in `checks.json` were re-run after the fixes and all
still pass.

**Not deployed.**
