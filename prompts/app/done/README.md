# Done prompts

Implemented prompt specs live here after they ship (phone-tested or explicitly closed).

**prompt100** — done (2026-08-02). Mentor chat: long-press Copy (`expo-clipboard`, 10 locales); PDF/TXT File attach via in-chat sheet (back dismisses); Food Log save/nutritionist alerts in `appLocale`. Android 1.2.27 (55). See `done/prompt100.txt`.

**prompt99** — done (2026-08-02). Lab parse: canonical English names + `nameOriginal`; Meuhedet gauge layout (value above marker, not range ends); `refLow`/`refHigh` + second-pass repair; delete-report UI; portal range line. Phone-tested Meuhedet TSH 3.64. See `done/prompt99.txt`.

Active / backlog specs stay in `prompts/app/`:

| File | Why still active |
|------|------------------|
| prompt31.txt | Spec only — **shipped in done/prompt55** (source_config + Samsung steps) |
| prompt32.txt | Spec only — backup import QA + hardening (deferred) |
| prompt38.txt | Planned — secondary lab findings (liver, iron, uric acid) |
| prompt40b.txt | Planned — day/week meal plans, export, food preferences (after 40a) |
| `prompt81b.txt` | **Shipped** — Phase B → `done/prompt87.txt` |
| `prompt92.txt` | UI/UX review brief + **review output (2026-07-24, Opus 4.8)** — 19 findings F2–F20 (F1 withdrawn), batches A–E; feeds prompt93+ |

**prompt97** — done (2026-07-25). Metabolic chart label collision: workout names moved to their own 12px lane above the calorie bars (chart grew 273→285 so the glucose plot kept its resolution), meal kcal numbers keep the strip, each lane placed greedily by kcal so the biggest events keep their text and dropped labels still show bar/▼. Axis time labels thinned by measured width (tick marks stay). Fixed three overlaps at the default 12H view, including a 548 kcal meal that was being drawn *underneath* a neighbour and was invisible. Phone-tested 3H/6H/12H/24H. See `done/prompt97.txt`.

**prompt96** — done (2026-07-25). Dark theme System/Light/Dark: token layer + `ThemeProvider`, every component on `useTheme()`, dark palette tuned to the Withings reference, Profile `AppearanceStrip` + Quick Start theme step, `healthings:themePref` in backup/restore. P5 found exports already light-pinned by construction (`WellnessColors` = static `lightColors`; export charts use the pure SVG builder, not the themed components) — verified on device by sharing a 7-day visit report from a dark, Hebrew app and getting a white page. Closed with the meal-editor leftovers (AI tip on black, rule-warning reds, new `warningAmber` token). See `done/prompt96.txt`.

**prompt66** — done (code 2026-07-13, closed 2026-07-25). Macro target stability: `macro_target_by_day_v1` day snapshots, food-log bars judged vs that day's target, EMA 70/30 + daily caps on silent auto-apply (`dampenMacroSuggestion`), active + 7-day targets in the Gemini context with hold-steady wording; explicit Accept still applies the full proposal. Soak-tested in daily use through 1.2.16. Commits `e6356c1`, `ccaa228`. See `done/prompt66.txt`.

**prompt95** — done (2026-07-24). Audit batches D+E: trend chart mini-panels (F3), chat toolbar overflow menu (F8), top-header refresh icon (F9), detected-script RTL alignment for user content (F13), Edit Meal delete-whole-meal clarity (F15), softer CGM drop (F20), website help cards + patient-friendly landing H1 (F19). Phone-tested (app slices) + local site verify (E4). See `done/prompt95.txt`.

**prompt94** — done (2026-07-24). Batch C: Lucide icon registry + strip icons, mentor chrome + "AI doctor/…" labels, slim brand header + primary-tier navy accent, chrome glyphs (Meal navy / Water blue / Camera / Gallery). Phone-tested. See `done/prompt94.txt`. Next: prompt95 (Batches D+E).

**prompt93** — done (2026-07-24). First-impression UI polish from audit batches A+B: AA secondary text, unified chevron, navy Gallery, solid Meal/water, QS Step N of M, coach tips badge, stable QS progress, compact Yes/No heroes, unified language gate. Phone-tested. See `done/prompt93.txt`.

**prompt58** — done (2026-07-07). Editable Your setup: 3 toggles (scale/watch/CGM), HC steps when watch off, no OAuth auto-promote. Compile-check OK; phone test pending. See `done/prompt58.txt`.

| prompt40b.txt | Planned — day/week meal plans, export, food preferences (after 40a) |
| prompt60.txt | **Shipped** — see `done/prompt68.txt` for restore fix; feature live, remaining checklist in prompt60 |
| `prompt64.txt` | **Phase 1 shipped** (`10569f2`); **Garmin phone-tested success 2026-07-12** → `done/prompt64.txt` |
| `prompt65.txt` | **iOS TestFlight Withings-first** — no HealthKit v1; EAS + platform guards (Apple Dev enrolled 2026-07-10) |
| `prompt56.txt` | **Partial:** HealthKit glucose on TF **1.2.2 (23)**; steps/HR still backlog |

**prompt61** — done (2026-07-08). One-tap text meal save; modal stays open for Done review. Phone-tested. See `done/prompt61.txt`.

**prompt62** — done (2026-07-08). Collapsible glucose + trend/energy; Food Log moved up; AI chat strip labeled. Phone-tested. See `done/prompt62.txt`.

**prompt63** — done (2026-07-08). Clinic Refresh surfaces newer patient My Rules (portal + sync reconcile). Clinic portal tested. See `done/prompt63.txt` (`7da920e`).

**prompt59** — done (2026-07-07). Steps setup guide (Samsung Health → HC → Healthings read). Power user guide visible; fresh-user test deferred. See `done/prompt59.txt`.

**prompt20** — done (Phase 1 + 3 + rules/fiber). Phase 2 photo polish deferred inside `done/prompt20.txt`. **Follow-up 2026-06-29** — Gemini per-item fat rules (plant vs whey); phone-tested. See `done/prompt20.txt` § Follow-up 2026-06-29.

**prompt21** — done (CGM persistence + merge + mentors).

**prompt25** — done (per-mentor coach panel + open-at-top on chat entry). Phone-tested 2026-06-17.

**prompt35** — done (2026-06-18). Shipped unified macro pipeline: fiber↔carb coupling, `/macros` + chat confirm card, and auto macro revision on weigh-in/lab using 7-day context + labs.

**prompt36** — done (2026-06-18). Monitoring-driven macro revision: ENERGY BALANCE + CARB GUIDANCE injection, kcal safety floor, cholesterol-first prompt, tiered carb rules, My Rules parse fix + Goals context. Phone-tested ~2325 kcal P141 C50 F173 Fi25.

**prompt37** — done (2026-06-19). Lab GUIDANCE blocks, clinical profiling, profile banner. Phone-tested ~2391 kcal P141 C54 F179 Fi27.

**prompt39** — done (2026-06-19). Food log history for meal AI ("usual shake", "last evening"); lab results strip at dashboard bottom. Phone-tested.

**prompt40a** — done (2026-06-20). Nutritionist recipe cards: slash-only `/eat` `/recipe`, English commands + Hebrew hints, `/` autocomplete, log-as-meal + dashboard refresh. Phone-tested. **40b** → `prompt40b.txt`.

**prompt41** — done (2026-06-19). CGM chat: qualitative glucose by default, deep dive on request; `/7` full CGM series (≤7d) + day/night averages (07:00–23:00 / 23:00–07:00). APK installed for phone test.

**prompt42** — done (2026-06-20). Macro revision guards: audit log, manual lock on confirm, block unsafe weigh-in auto-apply (carb outlier / fallback). Phone-tested. Refines prompt35 auto-apply.

**prompt43** — done (2026-06-22). Mentor food-science estimates: omega/nutrient questions answered from meals + USDA-style tables; no refusal / no glucose opener on nutrient threads. Phone-tested.

**prompt44** — done (2026-06-22). Macro energy timeline: `targetWeeks` in My Targets drives deficit (~700 kcal cap for ≤2 wk), trimmed 7d TDEE burn, loss direction from current weight, P→C+Fi→F fill, manual target edit. Phone-tested ~707 kcal deficit / ~1913 kcal target.

**prompt45** — done (2026-06-22). Withings HR sync hardening: empty-fetch guard, today merge, foreground/5min refresh, mismatch-only dashboard diag. 2026-06-22 stall was Withings cloud stale (API = store); diag proved not an app drop bug. **Chart downsample refined in prompt67** (gap-break + min/max; shallow sync).

**prompt67** — done (2026-07-16). MetabolicChart HR gap-break + min/max downsample; Withings routine sync shallow (2d), deep 60/128 on demand via Re-link sheet. Phone-tested. Commits `2379239`, `05d7f46`. See `done/prompt67.txt`.

**prompt68** — done (2026-07-16). Cloud restore: pako@3 inflate returns Uint8Array — decode UTF-8 before JSON.parse. Phone-tested. See `done/prompt68.txt`.

**prompt69** — done (2026-07-16). Withings Android sheet (Normal / Deep / Re-link); root `.easignore` for EAS; iOS build 28 TestFlight. Phone-tested. Commit `37667fa`. See `done/prompt69.txt`.

**prompt70** — done (2026-07-16). Food Log: activity + burned (BMR caption), kcal macro bar above P, Dynamic Type number wrap fix. Phone-tested Samsung. See `done/prompt70.txt`.

**prompt71** — done (2026-07-16). H2O meter: glass tiles, timeline chips, edit/delete, bar tap → sheet, backup/export keys. Phone-tested Samsung. See `done/prompt71.txt`.

**prompt72** — done (2026-07-17). Units & measurements per-measure prefs (display/input; SI store). Glucose badge converts; chart stays mg/dL+HR. Compile-check OK; phone test pending. See `done/prompt72.txt`.

**prompt73** — done (2026-07-17). Manual body dual Fat/Muscle (%|mass), BMR override, watch activity merge on manual weight, My Profile Android/iOS parity. Phone-tested Android. See `done/prompt73.txt`.

**prompt74** — done (2026-07-17). Snappy Body Save + setup scale toggle (defer HC/trend/Body mount). Phone-tested Android. See `done/prompt74.txt`.

**prompt75** — done (2026-07-17). Camera Nutritionist “Save anyway” keeps meal items (no empty meal). Phone-tested Android. See `done/prompt75.txt`.

**prompt76** — done (2026-07-18). Watch off → phone health (HC / Apple Health); Allow/Deep sync; steps max-origin skip Withings; kcal from steps×0.55; write advisory; Food Log today@0. See `done/prompt76.txt`. **Watch On walking superseded by prompt80** (distance×weight + bike).

**prompt80** — done (2026-07-22). Hybrid Watch On: Withings distance×weight walks + Withings bike/sports; ignore walk sessions & passive; phone steps only Watch Off. Phone-tested Android Jul 21 → 884 kcal (was 937). See `done/prompt80.txt`.

**prompt77** — done (2026-07-18). Quick Start one-question UX + in-wizard Link Withings; original gear/meals art; help site pages. See `done/prompt77.txt`.

**prompt78** — done (2026-07-18). HEALTHINGS.AI wordmark + app icon, site/clinic brand, export rename, dashboard safe-area under status bar. See `done/prompt78.txt`.

**prompt79** — done (2026-07-19). Pull-refresh perf: shallow Withings windows, parallel today, fast HR merge, quiet pull; ~9s→~4s. See `done/prompt79.txt`.

**prompt81** — done (2026-07-21). Phase A: language gate, EN/HE Quick Start, units labels, 7-locale help `/{lang}/help/` + switcher, legacy `/help/` → `/en/help/`. Phone-tested Samsung. Phase B → `done/prompt87.txt`. See `done/prompt81.txt`.

**prompt82** — done (2026-07-21). Body-card source header: Withings + CGM marks, WITHINGS-captioned ✓/Re-link pill, title/icon alignment, single-device title collision fix. Phone-tested Samsung. Android **1.2.13** (40). See `done/prompt82.txt`.

**prompt83** — done (2026-07-21). Meal save awaits food-log refresh before close; saving spinner; fix late `reset()` wipe after reopen. Phone-tested Samsung. See `done/prompt83.txt`.

**prompt84** — done (2026-07-22). Net-carb target + Ask macros HARD from nutritionist directive (AI extract kcal/net); ENERGY BALANCE skipped when directive kcal set; AI-judgment-not-regex rule. Phone-tested Samsung (~1690 kcal). See `done/prompt84.txt`.

**prompt85** — done (2026-07-22). My Profile **Reports** collapsible strip (Visit report under Data sharing); plain 90-day label; grey/black chips. Phone-tested Samsung. See `done/prompt85.txt`.

**prompt86** — done (2026-07-22). Food Log collapsible (chart-style title, grey border); collapsed `−`/`+` balance; CareSens + Refresh my data → dashboard footer. Phone-tested Samsung. See `done/prompt86.txt`.

**prompt87** — done (2026-07-22). Phase B dashboard chrome i18n (Food Log, metabolic strips, Profile nested titles, dates, body metrics, AI chat, backup/reports/sharing). Phone-tested Samsung. See `done/prompt87.txt`. Closes `prompt81b`.

**prompt88** — done (2026-07-24). Phase B follow-up: Lab Results, Your setup, Profile form, Food Log chrome, chart legend (Glucose/HR/Steps/Workout) + two-row legend layout. Phone-tested Android. See `done/prompt88.txt`.

**prompt89** — done (2026-07-24). PROFILE & SETTINGS order: Profile → Language → Units → Gear; CareSens Import in Gear when CGM Yes; footer Refresh only. Phone-tested Android. See `done/prompt89.txt`.

**prompt90** — done (2026-07-24). Meal window: per-item Edit/Delete; From past meal day picker (copy, not edit); idle + Save meal i18n; blue Save. Phone-tested Android. See `done/prompt90.txt`.

**prompt91** — done (2026-07-24). Coach languages **pt / it / tr** (10 total); Quick Start + chrome + website help; gate 2-col select text; Refresh my data i18n. Phone-tested Android. See `done/prompt91.txt`.

**prompt52** — done (2026-07-24). My Rules rawText-only save (no Gemini on save); Edit/Add modal (90% top, safe nav); Past versions collapse; coach quotes verbatim. Phone-tested Android. Clinic summarise path deferred. See `done/prompt52.txt`.

**prompt48** — done (2026-06-29). Lipid trend charts (Total/LDL/TG/HDL strips + green safe zones); mentors/coach see **all saved lab draws** in USER DATA. Phone-tested. Commits `308500f`, `fa0d6b1`. Supersedes prompt30 chart deferral + latest-only scope.

**prompt50** — done (2026-06-30). Nutritionist visit report: clinical HTML export (7/14/30/90d), Appendix A charts (lipids/body/energy/CGM), Appendix B raw data. Phone-tested. See `done/prompt50.txt`. **UI shell → Reports strip in prompt85.**

**prompt51** — done (2026-07-03). My Rules version history: phone `user_rules_history_v1` (30 cap), clinic `clinic_patient_rules_history`, Rules tab history on portal. Phone-tested. See `done/prompt51.txt`.

**prompt53** — done + closed (2026-07-03). Nutritionist PDF import on phone (plain-text directive history) + clinic **Nutrition reports** tab. User accepted MVP. See `done/prompt53.txt`. **Next:** `prompt54` local-first clinic relay.

**prompt55** — done (2026-07-05). Welcome & Quick Start wizard (7 steps, all users), `source_config`, manual body/trend/energy, step 6 keeps saved targets + My Rules on upgrade. Phone-tested power user (Withings + CGM). See `done/prompt55.txt` (`2882056`). **Deferred:** HC step 4 status UI, device survey in My Profile → **shipped in prompt57**.

**prompt57** — done (2026-07-07). My Profile **Your setup** chips (`source_config` + Withings link), optional body fat % + weigh-in, dashboard provenance labels, `applyWithingsLinkToSourceConfig` on OAuth. Compile-check OK; phone test pending. See `done/prompt57.txt`.

**prompt42 follow-up** — weigh-in macro activation (`measuredAt` dedupe, first weigh-in, unchanged log) documented in `done/prompt42.txt` § Follow-up 2026-06-22.

**prompt42 follow-up (2026-06-28)** — Weigh-in macro review: remove manual lock from auto-apply block, Gemini retry, My Macros Accept UI instead of dead-end alert. **APK = repo** (`ac69355`); weigh-in behavior phone-tested `[ ]` until next scale sync. See `done/prompt42.txt` § Follow-up 2026-06-28.

**prompt34** — closed without ship (2026-06-17). Status row declined; chat fallback unnecessary with persistence. Manual CGM exclusions deferred inside `done/prompt34.txt`.

**prompt33** — closed without ship (2026-06-17). Default 2-day full snapshot + `/N` is sufficient; rollup/cache optimization deferred inside `done/prompt33.txt`.
