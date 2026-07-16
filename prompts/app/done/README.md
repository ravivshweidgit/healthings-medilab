# Done prompts

Implemented prompt specs live here after they ship (phone-tested or explicitly closed).

Active / backlog specs stay in `prompts/app/`:

| File | Why still active |
|------|------------------|
| prompt31.txt | Spec only — **shipped in done/prompt55** (source_config + Samsung steps) |
| prompt32.txt | Spec only — backup import QA + hardening (deferred) |
| prompt38.txt | Planned — secondary lab findings (liver, iron, uric acid) |
| prompt40b.txt | Planned — day/week meal plans, export, food preferences (after 40a) |

**prompt58** — done (2026-07-07). Editable Your setup: 3 toggles (scale/watch/CGM), HC steps when watch off, no OAuth auto-promote. Compile-check OK; phone test pending. See `done/prompt58.txt`.

| prompt40b.txt | Planned — day/week meal plans, export, food preferences (after 40a) |
| prompt60.txt | **Shipped** — see `done/prompt68.txt` for restore fix; feature live, remaining checklist in prompt60 |
| `prompt64.txt` | **Phase 1 shipped** (`10569f2`); **Garmin phone-tested success 2026-07-12** → `done/prompt64.txt` |
| `prompt65.txt` | **iOS TestFlight Withings-first** — no HealthKit v1; EAS + platform guards (Apple Dev enrolled 2026-07-10) |
| `prompt56.txt` | **Partial:** HealthKit glucose on TF **1.2.2 (23)**; steps/HR still backlog |
| `prompt66.txt` | Macro target stability — day snapshots + dampened auto-apply |

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

**prompt48** — done (2026-06-29). Lipid trend charts (Total/LDL/TG/HDL strips + green safe zones); mentors/coach see **all saved lab draws** in USER DATA. Phone-tested. Commits `308500f`, `fa0d6b1`. Supersedes prompt30 chart deferral + latest-only scope.

**prompt50** — done (2026-06-30). Nutritionist visit report: clinical HTML export (7/14/30/90d), Appendix A charts (lipids/body/energy/CGM), Appendix B raw data. Phone-tested. See `done/prompt50.txt`.

**prompt51** — done (2026-07-03). My Rules version history: phone `user_rules_history_v1` (30 cap), clinic `clinic_patient_rules_history`, Rules tab history on portal. Phone-tested. See `done/prompt51.txt`.

**prompt53** — done + closed (2026-07-03). Nutritionist PDF import on phone (plain-text directive history) + clinic **Nutrition reports** tab. User accepted MVP. See `done/prompt53.txt`. **Next:** `prompt54` local-first clinic relay.

**prompt55** — done (2026-07-05). Welcome & Quick Start wizard (7 steps, all users), `source_config`, manual body/trend/energy, step 6 keeps saved targets + My Rules on upgrade. Phone-tested power user (Withings + CGM). See `done/prompt55.txt` (`2882056`). **Deferred:** HC step 4 status UI, device survey in My Profile → **shipped in prompt57**.

**prompt57** — done (2026-07-07). My Profile **Your setup** chips (`source_config` + Withings link), optional body fat % + weigh-in, dashboard provenance labels, `applyWithingsLinkToSourceConfig` on OAuth. Compile-check OK; phone test pending. See `done/prompt57.txt`.

**prompt42 follow-up** — weigh-in macro activation (`measuredAt` dedupe, first weigh-in, unchanged log) documented in `done/prompt42.txt` § Follow-up 2026-06-22.

**prompt42 follow-up (2026-06-28)** — Weigh-in macro review: remove manual lock from auto-apply block, Gemini retry, My Macros Accept UI instead of dead-end alert. **APK = repo** (`ac69355`); weigh-in behavior phone-tested `[ ]` until next scale sync. See `done/prompt42.txt` § Follow-up 2026-06-28.

**prompt34** — closed without ship (2026-06-17). Status row declined; chat fallback unnecessary with persistence. Manual CGM exclusions deferred inside `done/prompt34.txt`.

**prompt33** — closed without ship (2026-06-17). Default 2-day full snapshot + `/N` is sufficient; rollup/cache optimization deferred inside `done/prompt33.txt`.
