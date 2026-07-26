# be-25 — Clinic panel: patients-first worklist

**Status:** done  
**Commit:** `c61ea99`  
**Owner:** "looks good" on production (2026-07-26)  
**Model to implement:** Auto  
**Authored by:** Auto  
**Built by:** Auto  
**Date:** 2026-07-26  
**Depends on:** be-23 (shipped — org access), be-21 (action feedback — must not regress)  
**Folds in:** be-08 leftovers C6, C8, C12, C14, C15, C19 + login busy states  
**Unblocks:** be-22 (rescoped), be-26 (locale tables)

> The clinic home is still eight identical cards in a 720px column with Linked patients last.
> be-23 fixed the data model; be-24 fixed chat privacy. This batch fixes the **job**: find a
> patient and open their workspace.

## Problem

A clinician's daily task is "open the right patient." Today that list sits under My clinic, Invite,
AI credits, AI usage, Pending, and Outgoing — ~1090px of settings before the work. There is no
search, no sort, no pagination, and no last-sync signal. Rows are stacked `.share-row` cards, fine
for three patients and wrong for thirty.

be-08 already named this (C14, C15, C19). Those were parked on be-22; be-22 is a paint job and must
not redesign the IA underneath. So the panel comes first.

## Goal

Signed-in home reads as a **clinic worklist**:

1. Light brand header (logo + "Clinic")
2. Patient worklist first — search, status filter, sortable table/list that works at 20 and at 200
3. Invite + pending actions within reach of the list (not buried)
4. Clinic identity + AI balance as secondary chrome
5. Alpha billing controls off the default screen (`?dev=1` only) — already decided in be-22; cheap
   enough to do here so the panel does not ship looking unfinished

Login: real forms, visible labels, Enter submits, busy states, `:focus-visible`.

## Decisions (locked)

| Question | Decision |
|---|---|
| Layout metaphor | **Worklist / table**, not another card column |
| Width | Widen the signed-in shell to ~1100–1200px on desktop; login stays narrow (~420–480) |
| Primary row action | **Open workspace** is the primary button; Revoke is secondary/danger text or outline — never the loudest control |
| Status buckets | One list with a filter: **Linked** (default) · Pending · Outgoing · All. Counts in the filter chips |
| Search | Client-side filter on email (and display name if present), case-insensitive, debounce ~150ms |
| Sort | Default: email A→Z. Optional: last sync newest-first, sponsored soonest-first |
| Pagination | Page size **25**; simple Prev/Next + "Showing a–b of n". No infinite scroll |
| Last sync | **Add** `lastSyncAt` (nullable ISO) on the public share for approved patients with a snapshot — one LEFT JOIN / lateral, no new table |
| Sponsorship | Keep the days-left chip on the row (data from `/sponsorships/mine` as today) |
| Usage card | Collapse into a compact "AI usage" disclosure under balance, or drop from the default view and keep behind `?dev=1` with the other alpha metering chrome. Prefer **behind `?dev=1`** with wallet pack/attach controls |
| Balance | Always show a compact balance chip in the header/secondary strip ("N tokens") — not the full alpha wallet UI |
| Invite | Inline above or beside the worklist ("Invite patient" email + Send) — not a separate card below the fold |
| Pending inbound | Surface as a banner or filter chip with count; Approve/Reject stay one click |
| Org / seats / assignment | **Out of scope.** One-person orgs from be-23 stay invisible. No multi-clinic UI until multi-org resolution is fixed |
| Workspace | **Off-limits.** Do not edit `clinic-workspace.js` / `patient.html` behaviour beyond links into them |
| `window.confirm` for revoke | **Keep** (be-21) |

### Decisions revised mid-batch (owner)

| Question | Original | Revised | Why |
|---|---|---|---|
| Tokens / dark mode on the home page | be-22 | **This batch** | The batch rewrites this page's CSS from scratch. Writing 61 fresh hex values and then asking be-22 to migrate them is manufacturing debt in the same commit that creates the file. Tokens cost nothing while the file is being authored. be-22 keeps `patient.html` + `clinic-workspace.css`. |
| Portal language | English only | **Localized — 10 languages** | Owner reversal 2026-07-26: "we are global, global app, global for clinics." English-only was a clinician-tool assumption. |
| i18n split | — | **be-25 = plumbing, be-26 = locales** | Catalog, `t()`, `dir` handling, and the picker land here so no new inline English strings are written. Translating ~150 keys × 9 locales is its own reviewable batch. |

## Scope

| Touch | Why |
|---|---|
| `website/clinic/index.html` | Restructure signed-in DOM + login forms; rewrite list rendering |
| `website/clinic/clinic-portal.css` (new) | Panel layout, tokens, dark mode |
| `website/clinic/clinic-i18n.js` (new) | Copy catalog + `t()` + locale picker plumbing |
| `website/clinic/clinic-api.js` | Only if share DTO field needs client typing — keep thin |
| `server/src/services/shares.ts` (+ route if needed) | Expose `lastSyncAt` on public shares |
| `prompts/backend/be-08-…` | Tick C6/C8/C12/C14/C15/C19 when done; move be-08 to done if nothing left |
| `prompts/backend/be-22-…` | Note C14/C15/C19 owned by be-25; be-22 keeps visual/tokens only |

**Do not touch:** `clinic-workspace.js`, `patient.html` (except shared CSS import if extracted), app code,
schema beyond reading `sync_blobs`, org-invite UI, Stripe.

## Layout (desktop ~1280)

```
┌─ header: logo · Clinic · {email} · balance chip · Sign out ─────────┐
│  [Invite patient ____________] [Send]     flash messages            │
│  filter: Linked (n) | Pending (n) | Outgoing (n) | All              │
│  [Search patients…                              ]  sort ▾           │
│  ┌ email          │ sync      │ sponsor   │ actions ─────────────┐  │
│  │ a@…            │ 2h ago    │ 12d left  │ Open · Sponsor · …   │  │
│  │ b@…            │ never     │ —         │ Open · …             │  │
│  └────────────────┴───────────┴───────────┴──────────────────────┘  │
│  Showing 1–25 of 40   ‹ Prev  Next ›                                │
│  ── My clinic (collapsed or compact: display name) ──               │
└─────────────────────────────────────────────────────────────────────┘
```

Mobile (~390): table becomes stacked rows (one patient per block) keeping Open as the first
button; filter chips wrap; search full width. Do not hide Open behind a menu.

## Implementation notes

### Login (be-08 C6 / C8 / C12 + busy)

- Wrap email step and code step in `<form>`s; `type="submit"`; `preventDefault` then existing handlers.
- Visible `<label for="email">` / `<label for="code">` (not placeholder-only).
- `withBusy` (or equivalent) on Send code / Sign in; empty input → visible error, not silent return.
- `:focus-visible { outline: 2px solid …; outline-offset: 2px }` on buttons and inputs.

### Worklist rendering

- Replace `#approved-list` / `#pending-list` / `#outgoing-list` card piles with **one** container
  fed by the same three API calls (plus sponsorships). Keep `refreshDashboard` parallelism.
- Build rows with DOM `textContent` / `createElement` (C20 — no patient email via `innerHTML`).
- Preserve be-21 behaviours: `withBusy`, `#app-flash`, sponsor day picker, cancel outgoing, confirm
  revoke, Open workspace → `patient.html?…`.
- Empty states per filter ("No linked patients yet — invite someone above.").

### `lastSyncAt`

In `toPublicShare` / list query path, for rows with `patient_id`:

```sql
LEFT JOIN LATERAL (
  SELECT created_at
  FROM sync_blobs b
  WHERE b.patient_id = s.patient_id
  ORDER BY b.version DESC
  LIMIT 1
) snap ON TRUE
```

Map to `lastSyncAt: string | null`. Display as relative time ("2h ago", "3d ago", "Never").
Do not fetch payloads.

### Alpha chrome (`?dev=1`)

Hide by default: Attach test card, Manual token pack, AI usage summary table, any "Stripe later"
copy. Show when `URLSearchParams` has `dev=1` (sessionStorage ok so refresh keeps it). Balance chip
stays visible either way.

### Tokens + dark mode

`clinic-portal.css` uses `var(--…)` from `tokens.css` only. `<html class="theme-auto">` opts the page
into the dark scheme, same mechanism as the landing page.

Two portal-local token groups, because `tokens.css` does not carry them:

1. **Status tints** — tokens ship solid `--ok` / `--warn` / `--danger` inks, not the pale fills a chip
   or banner needs. `--portal-ok-bg` / `-line` / `-ink` (and warn/err/neutral) are defined at `:root`
   and re-declared under `.theme-auto` in the dark media query.
2. **Danger text** — `--danger: #c0392b` does **not** flip in `tokens.css` and lands near 3:1 on a
   dark surface. Revoke text and `.error` use `--portal-err-ink`, which inverts.

Primary buttons fill with `--navy` and take `--bg-page` for ink, not `#fff`: `--navy` is "heading
colour" and inverts to near-white in dark, so a hardcoded white label would vanish.

### i18n plumbing

- `clinic-i18n.js` exposes `CLINIC_LOCALES` (10 = app `SUPPORTED_LANGUAGES`), `COPY`, `t()`,
  `setLocale()`, `applyDocumentLocale()`. Locale persists in `localStorage`, falls back to
  `navigator.languages`, then `en`.
- Static DOM carries `data-i18n` / `data-i18n-placeholder` / `data-i18n-aria`; `hydrateStaticCopy()`
  fills them. Dynamic strings call `t(key, vars)` with `{name}` interpolation. **No inline English in
  new markup or new JS.**
- Fallback is **per string**, not per locale: a half-filled locale shows English for the missing keys
  instead of blanking the UI.
- `setLocale` writes `lang` + `dir` on `<html>`, so `he`/`ar` mirror the whole portal.
- `Intl` calls (`toLocaleDateString`, `localeCompare`) take the portal locale.

### Text direction — emails are `ltr`, not `auto`

Patient-authored content is never translated, but `dir="auto"` is wrong for an **email address**:
`דנה.לוי@example.co.il` resolves RTL and paints the domain to the *left* of the local part, which
reads as corrupted data. Address cells and the usage table use `dir="ltr"`; the Hebrew run still
shapes right-to-left inside it. Reserve `dir="auto"` for free-form prose (meal names, patient rules).
Recorded in `.cursor/rules/language-policy.mdc`.

### Cache bust

Bump `?v=` on clinic CSS/JS links when shipping.

## Acceptance criteria

Verified in Chrome via CDP against a stubbed API (30 linked incl. Hebrew + Arabic addresses,
2 inbound pending, 1 outgoing, four sponsorship states):

- [x] Linked patients are above the fold on a 720px-tall desktop viewport for a typical clinic
- [x] Search narrows the visible set by email; clear filter restores — Hebrew query matched 1 row
- [x] Status filter chips work; counts match — Linked (30) · Pending (2) · Outgoing (1) · All (33)
- [x] ≥26 linked patients → pagination — 25 rows, Prev disabled on page 1, "Showing 1–25 of 30"
- [x] Open workspace is the primary control; Revoke is outline/danger text
- [x] `lastSyncAt` shown when a snapshot exists; "Never" when not
- [x] Sort by last sync and by sponsorship urgency both reorder correctly
- [x] Login: forms + labels + Enter submit + busy + focus-visible
- [x] Alpha billing UI absent without `?dev=1`; present with it
- [x] Dark mode renders on the whole page (`prefers-color-scheme: dark` emulated)
- [x] Hebrew flips `<html dir="rtl">`; table and chrome mirror; emails stay `ltr`
- [x] Unfilled locale falls back to English **per string** (no blank labels)
- [x] No unhydrated `data-i18n` nodes after boot
- [x] No edits to `clinic-workspace.js`
- [x] `npx tsc --noEmit` clean in `server/`
- [x] Invite send, approve/reject, cancel, revoke, sponsor on/off against the **live** API
      — owner reviewed production after deploy (`c61ea99`): "looks good"
- [x] be-21 action-feedback smoke on the deployed page — covered by owner production review

## Out of scope

- Org seats, assignment, multi-clinician inbox
- Clinic↔patient messaging / rule acknowledgement (deferred from be-23)
- Token migration for `patient.html` + `clinic-workspace.css` (still be-22)
- **Translated locale tables** (be-26) — this batch ships the catalog with `en` filled only
- Translating clinic-written rules for a patient who reads another language (needs an owner
  decision; Gemini judgment, not a string table)
- Patient workspace tabs
- Saved filter presets, URL-state deep links (additive later)
- Rewriting be-22's probe harness in this batch

## Review (after Auto marks needs-review)

**Evidence gathered**

- CDP probe: viewport emulated to 1280 and to ~390; stubbed `/v1/me`, `/v1/shares/*`,
  `/v1/sponsorships/mine`, `/v1/usage/summary`, `/v1/wallet` via
  `Page.addScriptToEvaluateOnNewDocument` (needs `Page.enable` first, or it silently no-ops).
- Screenshots: desktop light, desktop dark, Hebrew RTL dark, mobile stacked.
- `shares.ts` returns `lastSyncAt`; rendered as "5m ago" / "7h ago" / "2d ago" / "Never".

**Judgment calls for the owner**

- Does it read as a clinic tool now, or still a settings page with a table glued on?
- At 200 patients, is a client-side filter still acceptable, or is server-side search next?
- Is "Never" sync alarming in the right way, or does it look like a bug?
- Should the language picker sit in the header, or move into the My clinic disclosure once be-26
  fills the locales? It is header-level now so it is findable during translation review.

**Not yet closed (moved out of this batch)**

- be-08 leftovers **C11** (contrast re-measure) and **C21** (localStorage session note) — catalog stays open until those two close
- Locale tables → **be-26**
- `patient.html` tokens / dark / skeletons / money-led balance → **be-22**

## Agent checklist

- [x] Status → in_progress
- [x] Changes match this batch only
- [x] Acceptance criteria above
- [x] Update be-08 / be-22 cross-links; README open table
- [x] Status → needs-review + evidence; do not self-accept
- [x] Do not commit or deploy unless asked

## Related

- be-08 — catalog; this batch closes its remaining portal IA + login a11y items
- be-21 — action feedback; non-regression
- be-22 — visual/tokens for `patient.html` + workspace; home page now already tokenized
- be-23 — org-scoped access already live; panel must not invent multi-org UI yet
- be-26 — fills the locale tables this batch's catalog declares
- be-05 — original portal MVP
- `.cursor/rules/language-policy.mdc` — locale-per-account model, `dir` rules
