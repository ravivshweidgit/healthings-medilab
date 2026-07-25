# be-14 — Clinic patient workspace

**Status:** ready
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

## Implementation notes

**Identity.** The portal list already holds the patient's email; pass it through and render it:

- `#patient-title` → the patient's display name if the snapshot has one, else their email
- `#patient-meta` keeps snapshot version, share time, and size — that is provenance, and it stays
- `document.title` → `{patient email} — Healthings clinic` so browser tabs are distinguishable
- Delete the line that re-sets the title back to `Patient workspace` on load (`patient.html` line 79)
- If identity is unavailable, fall back to `Patient · {short id}` — never a generic string shared by
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

- [ ] Patient email or name visible in the topbar at all times, including while scrolled
- [ ] Browser tab title identifies the patient; two patients in two tabs are distinguishable
- [ ] No code path renders the bare string "Patient workspace" as the title of a loaded patient
- [ ] Tabs scroll horizontally in one row at 720px and 390px; never wrap
- [ ] Tab strip stays reachable when scrolled to the bottom of the food log
- [ ] Every tab is ≥44px tall
- [ ] Tablet (~820px) and mobile (~390px): no horizontal page scroll, no clipped charts
- [ ] Skeleton appears during fetch; no blank-then-pop
- [ ] No regression: all 8 tabs render, charts draw, empty-state copy unchanged, rules save works

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

- [ ] Status → in_progress
- [ ] Empty-state copy left untouched
- [ ] Changes match this draft only
- [ ] Smoke criteria above
- [ ] Status → done
- [ ] Update `drafts/README.md` table
