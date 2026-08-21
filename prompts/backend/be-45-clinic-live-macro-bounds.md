# be-45 — Clinic live macro bounds (floor + ceiling, HARD / FLEX)

**Status:** in_progress — **owner-approved 2026-08-21** (clinician path = Save rules builds engine; Macros tab = result view). Branch: `macro-redesign`.  
**Model to implement:** Auto (schema + routes + portal + propose auto-apply); Gemini prompt text is locked in this file — do not “simplify” with regex  
**Authored by:** Owner + Auto (2026-08-18 chat — clinic macros, C vs C−Fi, P 90–113)  
**Depends on:** be-23 (overlay/audit), be-26 (`clinicLocale`), be-40 (server Gemini), be-41 (overlay GET already returns markers)  
**Pairs with:** `prompts/app/100-200/prompt114.txt` (phone meters + overlay pull + AI HARD + real-time meal check). **Implement this batch first.**

## Problem

The workspace **shows** P/C/F/Fi/C−Fi/kcal from the last phone snapshot. The nutritionist **cannot write** them. After a visit they save live **rules** (and markers), while the Food Log meters still follow whatever the phone last proposed.

## Goal (owner lock)

**Michal’s path:** write rules → Save. She does not fill engine controls.

1. Rules Save runs Propose on the server and **auto-applies**:
   - `macros_json.bounds` (macro order)
   - **treatment markers** when the rules name them (SatF, SolFi, iodine, …) into `markers_json`
2. **Macros · Live** and **Markers · Live** show the result. Optional override — not the daily path.
3. Phone receives on next open / pull-to-refresh. Meals are checked in real time against HARD bounds + markers; user is informed when out of bound (prompt114).

Engine shape (under the hood — clinician never needs this vocabulary):

| Mode | Stored | Patient meter |
|---|---|---|
| **FLEX** | no HARD bound (optional guide) | `53 / 102g` — no ≤ ≥ |
| **Floor** | HARD floor | `116 ≥ 65g` |
| **Limit** | HARD ceiling | `66 ≤ 43g` |
| **Band** | HARD floor + ceiling | `102  90–113g` |

**C** and **C−Fi** are independent orders. Logged food still obeys `net = C − Fi`.

## Implementation order (each phase independently shippable)

| # | Phase | Contains | Gate |
|---|---|---|---|
| 1 | **Server core** | `macros_json`, types, validation, feasibility, PUT + GET, resolve helper, **`OR macros_json IS NOT NULL`** pull fix, audit | none — curl-testable |
| 2 | **Portal Macros tab** | **result view** of live bounds (+ optional override editor); `wsTabMacros` / `wsMacroBound*` en+he; relabel snapshot card | after 1 |
| 3 | **Propose + Rules Save auto-apply** | Propose returns `{ bounds, markers, … }`; rules PUT writes macros **and** upserts markers; `rulesHash`; banners; Rebuild | after 2; needs be-40 key |
| 4 | **Markers alignment** | `kcal_per_gram`, `percentOfEnergy` / `ofEnergy`, `geminiClinic` percent fix, Markers `<`/`>` select | independent of 1–3 |
| 5 | **Phone** | `prompt114.txt` — pull, daily resolution, meters, HARD clamp, **real-time meal check + user informed** | after 1–3 live |

Owner lock: auto-apply is **on**. Macros tab is the result view. Michal does not sign engine internals.

## Data model

New column on `clinic_org_overlays` (do **not** invent a parallel store):

```sql
ALTER TABLE clinic_org_overlays ADD COLUMN IF NOT EXISTS macros_json JSONB;
```

```ts
type MacroAxis = 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g' | 'net_carb_g';
type MacroDirection = 'floor' | 'ceiling';
type MacroStrength = 'hard' | 'flex';
type MacroBoundKind = 'constant' | 'percent';
/** kcal_order = clinic kcal bound (or FLEX point). kcal_eaten = today's logged energy. */
type MacroPercentOf = 'kcal_order' | 'kcal_eaten';

/**
 * kcal CEILING only. Target rises with today's measured activity kcal, never above capValue.
 * Michal/Stav: base 2000, threshold 400, cap 2300.
 */
type MacroActivityAddBack = {
  thresholdKcal: number; // activity kcal above which add-back starts
  capValue: number;      // absolute kcal ceiling on high-burn days (REQUIRED — safety rail)
  ratio?: number;        // fraction of burn above threshold that is added back; default 1
};

type MacroBound = {
  axis: MacroAxis;
  direction: MacroDirection;
  kind: MacroBoundKind;   // default 'constant' — old phone daily_macro_target is this
  value: number;          // constant: grams or kcal; percent: 0 < n ≤ 100
  of?: MacroPercentOf;    // required iff kind === 'percent'
  resolvedValue?: number; // last Confirm: grams/kcal shown in the PORTAL; phone recomputes daily
  strength: MacroStrength;
  activityAddBack?: MacroActivityAddBack; // axis 'kcal' + direction 'ceiling' only
  followsActivity?: boolean;              // percent bound: resolve against the boosted kcal ceiling (default false)
};

// macros_json = {
//   bounds: MacroBound[], updatedAt: string,
//   rulesHash?: string,               // rules rawText hash when this order was last built
//   reasoning?: string,            // last Propose reasoning (audit / tab)
//   needsClinician?: { axis: MacroAxis | 'kcal_target'; question: string }[],
// }
```

**Constant vs percent (Michal 2026-08-21 — see `be-45-michal-plan.md`):**

- **Kind ≠ strength.** `constant` = grams/kcal. `percent` = share of energy. HARD / FLEX is a separate field. A constant bound can be HARD (Natali P 77–96) or FLEX.
- Phone `daily_macro_target` is a **legacy constant point**, not a clinic bound. Do not delete. Do not auto-import onto `macros_json` (not HARD, not FLEX — it is off the card). Empty `bounds: []` → phone keeps those numbers, no ≤ ≥.
- Clinic percent is an **order kind**, not a new axis. Meter still shows resolved grams (+ a `%` caption).
- Resolve P/C/F percent against **`kcal_order`** (prescription). Resolve SatF percent (marker, not this card) against **`kcal_eaten`**. Do not resolve carb % against eaten — a deficit day must not shrink the carb cap.
- `g = value/100 * kcalBase / (axis is fat ? 9 : 4)`. Integer kcal; grams 1 decimal.
- **`resolvedValue` is required on PUT when `kind === 'percent'`** (400 without it). It is the absolute
  fallback for any reader that does not understand percent — see Backward compatibility.
- Percent bound without a kcal base: Propose must set/ask kcal first; PUT rejects carb/fat `percent` if no kcal_order and `of === 'kcal_order'`.
- Changing the kcal order does **not** silently rewrite `resolvedValue`. Portal flash: “C 30% of 2000 was 150 g; of 1800 is 135 g. Confirm?”
- 10% “no red” slack in rules → FLEX ceiling or a wider band. Not a third kind.
- SatF / SolFi stay treatment markers. SatF may later store `kind: 'percent', of: 'kcal_eaten'` on the marker row — do not duplicate SatF as a macro axis.

**Training days = one order, not two (Michal/Stav “HB 2000, training never above 2300”):**

Rejected: a kcal **range** 2000–2300 (makes 2200 legal on a rest day), a **second rule set** per day
kind (patient has one Food Log; the second set drifts), and a **patient Yes/No toggle** (forgotten
toggle = under-fuelled day with green meters). The phone already measures activity kcal — do not ask
a question the app can answer.

- `activityAddBack` is valid **only** on `axis: 'kcal'`, `direction: 'ceiling'`, `strength: 'hard'`. Anywhere else → 400.
- `capValue` is **required** and must be `> value`. A bad watch/HC reading must never raise a clinical ceiling without a rail.
- Resolve (phone, per day — code math, no AI):
  ```
  activityKcal = today's measured activity kcal (Activity Log + watch/steps burn) — NOT BMR
  extra        = max(0, activityKcal - thresholdKcal) * (ratio ?? 1)
  kcalCeiling  = min(value + extra, capValue)          // never below `value`
  ```
- **No activity data** (watch off, no sync, no session) → `kcalCeiling = value`. Never infer a session.
- Percent bounds resolve against the **base** `value`, not the boosted ceiling, unless `followsActivity: true`.
  Default false: extra energy is not extra carbohydrate. Stav on a training day is `C ≤ 150 g` (30% of 2000),
  red at 152 while kcal is green — intended.
- `followsActivity: true` requires `kind: 'percent'`, `of: 'kcal_order'`, and an existing kcal ceiling
  carrying `activityAddBack`. Otherwise → 400.
- **Open (owner + Michal):** if a late sync revises activity **down** after the patient ate to the boosted
  ceiling, does the ceiling drop back (clinically honest, turns a green day red) or stay granted? v1 draft:
  recompute from current data each resolve. Confirm before implementing.

### What is dynamic

`resolvedValue` on the stored bound is the **portal Confirm snapshot**, for display and audit. The phone
recomputes each day from the same stored order. Do not treat `resolvedValue` as the meter.

| Bound | Recomputes when | Moves during the day |
|---|---|---|
| constant (P 95–126 g) | never | no |
| percent `of: 'kcal_order'` (C ≤ 30%) | clinician edits the kcal line → portal Confirm | no |
| kcal ceiling with `activityAddBack` | activity syncs / session logged | **yes** — upward toward `capValue` |
| SatF marker percent `of: 'kcal_eaten'` | every logged meal | **yes** |

Early morning is noisy for `kcal_eaten` percent (10% of 200 kcal). Expected — same as today's marker.

**At most one floor and one ceiling per axis.** Empty `bounds: []` = clinic cleared orders (phone falls back to snapshot `daily_macro_target`).

SatF / SolFi / sodium stay **treatment markers** (be-41). Do not duplicate those codes here.

### Feasibility (pure math — reject Save / reject Propose apply)

- Same axis: floor value **<** ceiling value.
- HARD `carb_g` floor **F** + HARD `net_carb_g` ceiling **N**: if `F > N`, implied Fi at C=F is `F − N`. If a HARD `fiber_g` **ceiling** exists and is **&lt;** that implied Fi, reject (impossible).
- Do **not** reject “only net ceiling” or “only C floor.”
- FLEX bounds never fail HARD pairs.

## Routes

Mirror markers:

- `GET /v1/clinic/overlays` (patient) — `overlay.macros: { bounds, updatedAt } | null`
- `GET /v1/clinic/patients/:patientId/overlay` (mentor) — same; audit `macros.read` with overlay read
- `PUT /v1/clinic/patients/:patientId/macros` (mentor JWT) — validate axes/directions, uniqueness per axis+direction, feasibility, `value > 0`. Audit `macros.write`. Same `assertMentorPatientAccess` as rules.
- `POST /v1/clinic/patients/:patientId/macros/propose` (mentor JWT) — server Gemini. Returns
  `{ bounds, markers, reasoning, impliedNotes, needsClinician }`. Used by **Rebuild from rules** and
  by rules PUT auto-apply. When called alone it does not write; rules Save path validates then writes
  macros bounds **and** upserts markers.

Multi-org: same as rules/markers — most recently updated org wins on patient pull; document, don’t solve.

## Delivery to the phone — third field, same transport

The order is **not** injected as rules text and **not** as treatment markers. It is a third field on
the object the app already pulls, so nothing new has to sync.

| Not this | Why |
|---|---|
| Append grams into `rules_json.rawText` | The phone would have to parse Hebrew prose for numbers — banned (`ai-judgment-not-regex.mdc`) |
| Encode axes as treatment markers | Markers are a nutrient catalog with one `dailyTarget` + `unit`. No floor+ceiling pair, no `% of energy` anchor, no activity add-back. be-45 already forbids duplicating SatF as a macro axis |

```
clinic_org_overlays: rules_json | markers_json | macros_json   ← three siblings
        │
        └── GET /v1/clinic/overlays  →  { rules, markers, macros }
                     │
                     └── ClinicOverlayService.pullClinicOverlaysFull (phone, on open + pull-to-refresh)
                              ├── rules   → user rules
                              ├── markers → healthings:treatmentMarkers
                              └── macros  → healthings:clinicMacroBounds   (prompt114)
```

**Bug to fix in the same batch — a macros-only order never reaches the phone.**
`clinicOverlay.ts` selects patient overlays with:

```sql
WHERE ... AND (rules_json IS NOT NULL OR markers_json IS NOT NULL)
```

A clinic that saves **only** macros (no rules, no markers) produces a row that clause skips, so the
order silently never syncs. Add `OR macros_json IS NOT NULL`. Also extend the `ClinicOverlay` type
(`macros`) and `overlayFromRow` alongside `rulesFromRow` / `markersFromRow`.

Audit: `macros.read` with the overlay read, `macros.write` on PUT — same as markers.

## Portal UI (patient workspace)

### A live Macros tab — not a card inside a read-only surface

Today’s **Macro targets** card renders `daily_macro_target` from the last phone snapshot: the app’s
numbers, already stale, clinic cannot write them. The clinic order is a different thing and needs the
same treatment Rules and Markers already have — its own **live** tab.

Register beside them (`clinic-workspace.js` tab list, after `markers`):

```js
{ id: 'macros', labelKey: 'wsTabMacros', group: 'write', live: true, clinicOnly: true },
```

`live: true` gives the existing `ws-tab-live` badge, so the tab reads **Macros · Live** exactly like
Rules and Markers. `renderMacros(body, ctx)` in the `tab === …` chain; `clinicOnly` because the
mentor is the write path for v1 (patient `/account/` does not edit clinic HARD macros).

Keep the old snapshot bars, relabelled so the two can never be confused:

| Surface | Source | Label |
|---|---|---|
| **Macros tab** (new) | `overlay.macros` — clinic order | **Set by this clinic · Live** |
| **Macro targets** card (existing) | snapshot `daily_macro_target` | **Patient app targets · last sync {date}** |

Each ordered axis shows the clinic bound; unordered axes show only the app number.

**Primary: order list**

- Rows: axis label · **type select (`FLEX` · `>` · `<` · `range`)** · value field(s) · unit (`g` / `%` / `kcal`) · Today (from snapshot meals, same math as now: net = C − Fi on the day)
- **The type select is the strength.** `FLEX` → `strength: 'flex'`; `>` `<` `range` → `'hard'`. No separate HARD/FLEX control — one decision per row. Render HARD as a derived badge, not an input.
- **Add bound** — axis picker (kcal, P, C, F, Fi, C−Fi). Adding P twice is floor+ceiling on one row, not two P rows.
- Empty axes hidden until added.
- **kcal ceiling row only:** collapsed “Training day” toggle → `add activity above [400] kcal, up to [2300]`. Hidden until opened; empty = plain ceiling. Preview line: “Rest 2000 · session burning 700 → 2300.”
- **Percent row:** checkbox “follows the training bump” (default off), shown only when a kcal add-back exists. Caption states both resolutions: “30% of 2000 = 150 g · of 2300 = 173 g.”
- Hint line when HARD C floor + HARD C−Fi ceiling: e.g. “At 65 g C, fiber needs ≥ 22 g to keep net ≤ 43.” `clinicLocale`; numbers+units `ltr`.
- **Primary view:** live result of last rules Save (bounds, today vs bound, reasoning summary, `needsClinician` banner).
- Buttons: **Rebuild from rules** · **Save overrides** (manual edit path). Auto-apply on rules Save is the write that matters.

### Rules Save builds the engine (owner lock)

Michal writes the program in **rules**. Save is the write that matters.

On a successful rules PUT, the server runs Propose and **writes**:

| Field | What |
|---|---|
| `macros_json.bounds` | P/C/F/Fi/C−Fi/kcal order |
| `markers_json.markers` | treatment markers named in the rules (SatF, SolFi, iodine, …) |

Audit `macros.write` and `markers.write` when each side changes. Store `rulesHash` + `reasoning` /
`needsClinician` on `macros_json` for the Macros tab.

```
Rules Save
   → Propose (Gemini judgment, not regex)
   → validate macros + markers
   → write macros_json.bounds
   → upsert markers_json (see merge rules)
   → Macros · Live + Markers · Live show the result
```

#### Marker merge rules (do not wipe the clinic)

Propose returns `markers: [{ marker, direction, dailyTarget, percentOfEnergy?, ofEnergy?, note? }]`.

- **Upsert by code** — SatF in the proposal updates / creates SatF.
- **Do not delete** a marker Propose omitted (Raviv’s iodine stays if the new rules only mention protein). Clearing a marker is an explicit Markers-tab Remove, not a silent AI side effect.
- **Max 3** — if Propose returns more, keep the first 3 that validate; put the rest in `needsClinician`.
- Percent SatF: set `percentOfEnergy` + `ofEnergy: 'kcal_eaten'` and always fill `dailyTarget` grams as the fallback (compat).
- Existing constant markers without percent stay constant unless the rules clearly say “% of energy.”

Opening **Macros · Live** / **Markers · Live** = see what was set. Manual edit + Save remains for override.

**Override ≠ “rules are incomplete.”** Two paths:

| Path | Meaning |
|---|---|
| `needsClinician` banner | Rules are missing/ambiguous a number — fill on the tab *or* fix rules + Rebuild |
| Manual edit with no banner | Intentional clinic override (allowed) |

After any manual Save that differs from the last Propose: set `source: 'clinic_override'` (or clear `rulesHash` match) and show badge **“Set here — not from last rules Save.”** Next rules Save or **Rebuild from rules** rewrites from text and clears the badge.

- `rulesHash` equal to current rules → do not re-Propose on every tab open (only on rules Save, or
  explicit **Rebuild from rules**).
- `needsClinician`: apply every bound / marker the model *can* fill; **omit** axes that need a missing
  number (never invent). Banner on the tab.
- Failure is silent-safe: Gemini down / invalid JSON → rules still save 200; previous macros/markers stay;
  tab can show “last rebuild failed.” Never lose rules because Propose failed.
- Auto-apply is **on** for this product (owner lock). Do not require Confirm-before-apply.

Copy: extend `clinic-workspace-i18n.js` (`wsMacroBound*` keys). EN + HE full; other locales EN fallback for new keys (be-26 pattern). No inline English in JS.

Patient-authored meal names stay `dir="auto"`. Bound numbers `dir="ltr"`.

Self-view (`/account/`): read-only or same PUT if web already edits rules — **clinic mentor is the write path for v1**; patient web does not edit clinic HARD macros.

## Markers tab alignment (same language, separate object)

Markers stay their own object, tab, catalog, max-3 and lab links (be-41 / be-47). What changes is the
**edit language** — she should not meet two different vocabularies for “cap” in one workspace — plus
the percent kind be-45 already needs for SatF.

| Feature | Macros | Markers | Reason |
|---|---|---|---|
| `<` / `>` type select | yes | **yes** | Same control, wired to the existing `direction: 'cap' \| 'floor'` — no schema change |
| `range` | yes | **deferred** | She writes one direction. The only hint is SolFi “כ־10–12”, which she collapsed to a floor herself |
| **FLEX** | yes | **never** | A marker with no ≤ ≥ is not a treatment marker. Unlocked guidance belongs in rules |
| `%` of energy | yes | **yes — energy nutrients only** | Her live SatF line is “מתחת ל־10%”, already in this batch |
| Activity add-back | kcal only | no | Not applicable |

Row shape matches the Macros tab exactly:

```
SatF    [ <  ▾]  [10]  [ % ▾]  of energy eaten     today  18 ≤ 19g   10%
SolFi   [ >  ▾]  [10]  [ g ▾]                      today  12 ≥ 10g
Iodine  [ >  ▾]  [150] [mcg]                       today  —
```

### Type change

**`dailyTarget` keeps its meaning forever — percent is an additive sibling field.** Overloading
`dailyTarget` to hold `10` for “10%” would make every already-installed app render Stav’s sat-fat cap
as **10 g** instead of ~19 g. Additive only:

```ts
type TreatmentMarker = {
  marker: string;
  direction: 'cap' | 'floor';   // unchanged — the type select maps onto this
  dailyTarget: number;          // ALWAYS grams/mg/mcg in `unit`. For percent rows: the resolved
                                // fallback at Confirm time (e.g. 19 at 1740 kcal). Never a percent.
  percentOfEnergy?: number;     // NEW — 0 < n ≤ 100. Present ⇒ this marker is a % order
  ofEnergy?: 'kcal_eaten';      // NEW — required iff percentOfEnergy set; only legal value today
  unit: MarkerUnit;
  note?: string;
};
```

Old app reads `dailyTarget` and shows a sane grams cap. New app sees `percentOfEnergy` and prefers it,
resolving per day. No client-version gating, no `appVersion` header check (be-48) needed.

- Catalog gains nullable `kcal_per_gram` (`SAT_FAT_G` → 9; protein/carb-like rows → 4; micros → null).
- **`percentOfEnergy` is rejected when the catalog row has no `kcal_per_gram`.** Iodine has no energy
  density; “10% iodine” is meaningless. The portal hides the `%` option for those rows.
- `ofEnergy` may only be `'kcal_eaten'`. A marker is plate composition (AHA), never % of the
  prescription — same split already locked for macros.
- Resolve: `g = percentOfEnergy / 100 × kcalEaten / kcal_per_gram`. Dynamic per day, same row as macros
  in the “What is dynamic” table.
- No `strength` field on markers. Anything that would be FLEX is not a marker.

**`normalizeTreatmentMarkers` rebuilds the object field-by-field** (`out.push({ marker, direction,
dailyTarget, unit, linkedLabCodes, note, setAt, setBy })`) and the route’s zod object is non-strict,
so it **strips** unknown keys instead of rejecting them. Any field not added in *all three* places —
`MarkerInput`, the zod schema in `routes/clinic.ts`, and the `out.push` literal — is silently dropped
on the next save with no error. Add `percentOfEnergy` / `ofEnergy` to all three, and verify
`attachCatalogMeta` spreads rather than reconstructs.

### Bug this exposes

`geminiClinic.ts` formats markers into the clinic prompt as:

```ts
`- ${short} (${code}): ${m.direction} ${m.dailyTarget}${m.unit}/day`
```

A percent marker renders as **`cap 10g/day`** — off by a factor of two and clinically wrong. Update
`formatTreatmentMarkersTargetsBlock` (and `…FromStore`) to emit `cap 10% of energy eaten (≈19 g at
1740 kcal today)`. Fix in the same batch as the schema, before any percent marker can be saved.

### Files (markers half)

- `server/src/services/treatmentMarkers.ts` — type, `normalizeTreatmentMarkers` percent validation
- `server/src/routes/clinic.ts` — zod: add `kind` / `of` to the markers PUT body
- `server/src/db/schema.sql` — `diet_marker_catalog.kcal_per_gram` (nullable) + seed `SAT_FAT_G = 9`
- `server/src/services/geminiClinic.ts` — percent-aware marker block (bug above)
- `website/clinic/clinic-workspace.js` `renderMarkers` — type select + unit select; `%` hidden without energy density
- Phone: `TreatmentMarkerService` + strip already render ≤ ≥ (prompt110); percent resolution lands with prompt114

### Acceptance (markers half)

- [ ] PUT SatF `dailyTarget: 19, percentOfEnergy: 10, ofEnergy: 'kcal_eaten'` → 200; GET returns all three
- [ ] Same row **re-saved unchanged** still returns `percentOfEnergy` (the strip-on-normalize trap)
- [ ] PUT `percentOfEnergy` on `IODINE_MCG` (no `kcal_per_gram`) → 400
- [ ] PUT `percentOfEnergy: 0` / `101` → 400; `percentOfEnergy` without `ofEnergy` → 400
- [ ] PUT a marker with `strength` → field ignored, no crash (zod strips unknown keys)
- [ ] Existing constant markers (Natali iodine 150, Raviv SatF 15) round-trip byte-identical, no migration
- [ ] Clinic Gemini block reads `cap 10% of energy eaten (≈19 g at 1740 kcal)`, not `cap 10g/day`; constant markers format **exactly as today**
- [ ] Portal: markers rows use the same `<` / `>` select as Macros; `%` absent on Iodine

### Deferred

`range` on markers. Trigger to revisit: Michal writes a real band she refuses to collapse to one
direction (SolFi 10–12 is the candidate). One field, same UI, no redesign.

## Propose — Gemini prompt (locked)

Server-only. **Judgment, not regex** (`ai-judgment-not-regex.mdc`). Do not scan rules with RegExp for “65” / “C-Fi”. Put verbatim rules + markers + labs + current snapshot macros + today eaten into the prompt.

Input blocks (from snapshot + overlay the mentor already loaded):

- CLINIC RULES (`rawText`)
- TREATMENT MARKERS (code, direction, dailyTarget, unit)
- LAB RESULTS (canonical codes already on snapshot)
- CURRENT PHONE MACRO POINT TARGET (`daily_macro_target` if present)
- TODAY EATEN (P/C/F/Fi/net/kcal)
- BODY / BURN if present (weight, lean, 7d burn) — context only

Output JSON **only**:

```json
{
  "bounds": [
    { "axis": "protein_g", "direction": "floor", "value": 90, "strength": "hard" },
    { "axis": "protein_g", "direction": "ceiling", "value": 113, "strength": "hard" },
    { "axis": "net_carb_g", "direction": "ceiling", "value": 43, "strength": "hard" }
  ],
  "markers": [
    { "marker": "SAT_FAT_G", "direction": "cap", "dailyTarget": 19, "percentOfEnergy": 10, "ofEnergy": "kcal_eaten" },
    { "marker": "SOLUBLE_FIBER_G", "direction": "floor", "dailyTarget": 10 }
  ],
  "reasoning": "short clinical English — why these bounds, cite labs/rules",
  "impliedNotes": ["At C floor 65 and net ceiling 43, Fi ≥ 22 g if they eat 65 g C"],
  "needsClinician": [
    { "axis": "kcal", "question": "Rules give 1500–2100 with no single target. Which number should the 35% carb ceiling use?" }
  ]
}
```

`markers` uses catalog codes only. Prefer `percentOfEnergy` for sat fat when rules say “% of energy.”
Do **not** put SatF / SolFi / iodine into `bounds`. Omit `markers: []` when rules name none — auto-apply
then leaves existing markers untouched.
Prompt body (ship this text; clinicLocale does not translate the model instructions):

```
You are a licensed clinical nutritionist writing a SHORT diet ORDER for one patient.
You are NOT filling a complete P/C/F/kcal plate unless the rules clearly require it.

Return JSON only (schema above). No markdown.

AXES (exact strings): kcal | protein_g | carb_g | fat_g | fiber_g | net_carb_g
DIRECTION: floor | ceiling
STRENGTH: hard | flex

RULES
- Each axis may have at most one floor and one ceiling.
- Omit an axis entirely when the clinic should not lock it (FLEX / not ordered). Prefer OMISSION over inventing numbers.
- HARD = patient must follow; FLEX = optional guide. Default to HARD only when rules/labs clearly constrain that axis; otherwise omit or FLEX.
- protein_g, carb_g, fat_g, fiber_g, net_carb_g are grams/day. kcal is kcal/day.
- KIND: constant (grams/kcal) or percent (0–100 of kcal_order or kcal_eaten). Kind is not HARD/FLEX. Michal writes protein and kcal as constants; she writes carb ceilings and sat fat as % of energy. Prefer percent on carb_g when rules say “עד X% מסה״כ הקלוריות”; resolve against kcal_order (the prescription), not eaten. Sat fat % of energy is a MARKER (kcal_eaten), not a macro bound. Always also fill resolvedValue so the meter has grams. Old phone point targets are constant kind and stay off this card until the clinician adds a bound.
- TRAINING DAYS: when rules give one calorie target plus a higher allowance on training days ("HB 2000, on training never above 2300"), that is ONE kcal ceiling with activityAddBack { thresholdKcal, capValue }, NOT a kcal range and NOT two orders. capValue is the number they must never exceed. Pick thresholdKcal from the rules if stated, otherwise omit activityAddBack and say in reasoning that the threshold needs the clinician. Never set followsActivity yourself — extra energy is not extra carbohydrate unless the clinician says so.
- net_carb_g is C−Fi (digestible carb). On a plate, net = C − Fi always. As an ORDER, net and total C are INDEPENDENT: a net ceiling does not require a C or Fi bound.
- If you set a HARD carb_g floor AND a HARD net_carb_g ceiling with floor > ceiling, fiber at that C must be at least C−net. Put that in impliedNotes. Do NOT invent a fiber_g bound unless rules/labs ask for fiber explicitly.
- Kidney / protein cap from labs (creatinine, urea) may justify a protein_g CEILING. A protein FLOOR is separate — both allowed (a band).
- Treatment markers (SAT_FAT_G, SOLUBLE_FIBER_G, IODINE_MCG, …) go in the separate `markers` array —
  never as macro bounds. Prefer percentOfEnergy for sat fat when rules say share of energy. Omit the
  markers array (or return []) when rules name none so auto-apply does not wipe existing markers.
- When a number the clinician must own is genuinely absent from the rules, OMIT that bound and add one entry to needsClinician with a short, specific question. Never invent it, never split the difference, never take the top of a range. Typical gaps: the single kcal target behind a "% of calories" ceiling; the activity threshold for a training allowance; whether a stated band's high end is the aim or a safety cap.
- Do not parse numbers from rules with pattern matching. Read the whole rules text as a clinician.
- Do not claim a Mediterranean or keto diet unless rules say so. diet_label is not in this JSON.
- If rules are empty and labs are unremarkable, return bounds: [] and say so in reasoning.

Work order: (1) which axes are clinically constrained, (2) floor vs ceiling vs band, (3) HARD vs omit, (4) impliedNotes for C vs net vs Fi.
```

## Backward compatibility (no migration, no reader left behind)

**Nothing in this batch rewrites existing data.** Five patients have live markers today (Natali
iodine/selenium, Stav SolFi + SatF 20 g, Daniel SatF 17 + SolFi 12, Raviv SatF 15 / SolFi 10 /
iodine 150) and every patient has a phone `daily_macro_target`. All of it keeps working untouched.

| Existing artifact | After this batch |
|---|---|
| `markers_json` rows | Unchanged bytes. No `percentOfEnergy` ⇒ constant marker, identical behaviour |
| `daily_macro_target` (phone snapshot) | Never written, never deleted by be-45. Still owns every unordered axis |
| `rules_json` | Unchanged. Macros are never appended to `rawText` |
| Installed apps without prompt114 | Ignore the unknown `overlay.macros` key. Markers still read `dailyTarget` |
| Cached old portal JS | Sends no new fields → constant markers, same payload as today |
| Old backups (no `healthings:clinicMacroBounds`) | Restore → no clinic bounds → point targets. New backup on an old app → unknown key ignored |

### Rules that make it hold

1. **Every new field is optional, and absent means today's behaviour.** `kind` absent ⇒ `constant`;
   `activityAddBack` absent ⇒ plain ceiling; `followsActivity` absent ⇒ `false`; `percentOfEnergy`
   absent ⇒ grams. No defaults are back-filled into stored rows.
2. **Always ship a resolved absolute next to a relative one.** `MacroBound.resolvedValue` is
   **required on PUT when `kind === 'percent'`**, and marker `dailyTarget` always holds grams. Any
   reader that does not understand the relative form still gets a clinically sane number rather than
   a percent rendered as grams.
3. **Additive DDL only** — `ADD COLUMN IF NOT EXISTS macros_json JSONB`, `ADD COLUMN IF NOT EXISTS
   kcal_per_gram NUMERIC`. No `NOT NULL`, no row-rewriting defaults, no renames, no drops.
4. **Widen, never narrow, the pull filter.** `OR macros_json IS NOT NULL` only adds rows; patients who
   match today still match.
5. **Unknown values are skipped, not fatal.** Phone and server ignore an unrecognised `axis`, `kind`,
   `of`, or marker field, keep the rest of the payload, and log. Never drop the whole overlay, never
   crash a pull.
6. **Constant formatting is byte-stable** in `geminiClinic` marker/macro blocks, so existing clinic
   chat behaviour does not shift under a patient who has no percent orders.

### Rollback

Reverting the server is safe with one documented loss. `macros_json` stays in the table unread; the
phone sees no `macros`, clears clinic bounds, and falls back to point targets. For markers, an old
server that re-saves a percent row **strips `percentOfEnergy` / `ofEnergy` and keeps the `dailyTarget`
grams** — the cap stays clinically valid but stops tracking energy. Acceptable; note it in the
rollback runbook rather than trying to prevent it.

## Files to touch

- `server/src/db/schema.sql` — `macros_json`
- `server/src/services/clinicOverlay.ts` — `ClinicOverlay.macros` + `macrosFromRow`; **add `OR macros_json IS NOT NULL`** to the patient-pull WHERE (a macros-only order must sync); background propose hook on rules save
- `server/src/services/clinicMacros.ts` (new) — validate, save, propose
- `server/src/routes/clinic.ts` — PUT + POST propose
- `server/src/services/geminiClinic.ts` or small helper — propose call (be-40 key on server)
- `website/clinic/clinic-workspace.js` — new `macros` tab entry (`live: true, clinicOnly: true`) + `renderMacros()` + relabel the existing snapshot card; `.css`; `clinic-workspace-i18n.js` (`wsTabMacros`, `wsMacroBound*`)
- Do **not** implement phone meters here → prompt114
- Do **not** regex-parse `user_rules`

## Acceptance criteria

- [ ] PUT two bounds on P (floor 90 + ceiling 113) + net ceiling 43 → GET overlays shows them
- [ ] PUT C floor 65 + net ceiling 43 + Fi ceiling 10 HARD → 400
- [ ] PUT only net ceiling 43 → 200 (C/Fi omitted OK)
- [ ] PUT kcal ceiling 2000 + `activityAddBack { thresholdKcal: 400, capValue: 2300 }` → 200; GET returns it
- [ ] PUT `activityAddBack` on protein / on a floor / with `capValue` ≤ value / with `strength: 'flex'` → 400
- [ ] PUT `followsActivity: true` on C percent with no kcal add-back → 400
- [ ] Resolve helper: activity 0 → 2000; 700 → 2300; 500 → 2100; 5000 (bad sync) → 2300, never higher
- [ ] Propose alone returns JSON without writing; Rebuild / rules Save write after validate
- [ ] **Macros-only overlay** (no rules, no markers) → patient `GET /v1/clinic/overlays` returns it (the WHERE-clause fix)
- [ ] Rules PUT → `macros_json.bounds` **updated** (auto-apply); patient pull returns the new order; audit `macros.write`
- [ ] Rules PUT with “sat fat &lt;10% · SolFi ≥10” → markers upserted (percent SatF + SolFi floor); existing iodine **kept** if not in proposal
- [ ] Rules PUT with no marker language → existing markers unchanged
- [ ] Propose on Daniel-style rules (`C ≤ 35%`, kcal 1500–2100, no point) → carb omitted + `needsClinician` banner; other axes still applied
- [ ] Gemini failure during rules PUT → rules still save 200; previous macros **and** markers kept; error logged
- [ ] PUT a percent bound **without** `resolvedValue` → 400
- [ ] Pre-batch overlay rows (rules-only, markers-only) return byte-identical JSON after the migration
- [ ] Overlay carrying an unknown `axis` / `kind` → that bound skipped, the rest still returned, no 500
- [ ] Portal: **Macros** tab shows Live badge + live result after rules Save; en + he
- [ ] Rules save succeeds even when Propose fails
- [ ] Audit `macros.write`

## Out of scope

- App meters, overlay apply, auto-apply HARD → prompt114
- Macro history versioning (rules history pattern later)
- Translating `reasoning` into `appLocale` (same open decision as rules text)
- Chat that PUTs macros as a side effect
- Replacing snapshot `daily_macro_target` on the server (phone still owns the point target for unordered axes)

## Review by owner (after Auto marks needs-review)

**Evidence**

- curl PUT / GET / 400 transcript
- curl: rules PUT → overlay.macros.bounds present; patient GET includes macros
- Portal 1280 + 390: Macros · Live result after rules Save (P band + C ceiling example); today column
- he RTL: labels RTL, numbers LTR

**Judgment**

- Propose quality on live overlays (Natali / Stav / Daniel) — clinical, not Auto’s
- Late downward activity sync: ceiling drops back (v1 draft) vs stays granted — owner call if noisy

## Agent checklist

- [ ] Status → in_progress
- [ ] This draft only
- [ ] Acceptance above
- [ ] `prompts/backend/README.md` table
- [ ] Status → `needs-review` + evidence; **do not** self-move to done/
