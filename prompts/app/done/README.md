# Done prompts

Implemented prompt specs live here after they ship (phone-tested or explicitly closed).

Active / backlog specs stay in `prompts/app/`:

| File | Why still active |
|------|------------------|
| prompt31.txt | Spec only — source config + Samsung + AI/manual BMR |
| prompt32.txt | Spec only — backup import QA + hardening (deferred) |
| prompt38.txt | Planned — secondary lab findings (liver, iron, uric acid) |
| prompt40b.txt | Planned — day/week meal plans, export, food preferences (after 40a) |

**prompt20** — done (Phase 1 + 3 + rules/fiber). Phase 2 photo polish deferred inside `done/prompt20.txt`.

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

**prompt45** — done (2026-06-22). Withings HR sync hardening: empty-fetch guard, today merge, foreground/5min refresh, mismatch-only dashboard diag. 2026-06-22 stall was Withings cloud stale (API = store); diag proved not an app drop bug.

**prompt42 follow-up** — weigh-in macro activation (`measuredAt` dedupe, first weigh-in, unchanged log) documented in `done/prompt42.txt` § Follow-up 2026-06-22.

**prompt42 follow-up (2026-06-28)** — Weigh-in macro review: remove manual lock from auto-apply block, Gemini retry, My Macros Accept UI instead of dead-end alert. APK installed; phone test on next scale sync. See `done/prompt42.txt` § Follow-up 2026-06-28 (`ac69355`).

**prompt34** — closed without ship (2026-06-17). Status row declined; chat fallback unnecessary with persistence. Manual CGM exclusions deferred inside `done/prompt34.txt`.

**prompt33** — closed without ship (2026-06-17). Default 2-day full snapshot + `/N` is sufficient; rollup/cache optimization deferred inside `done/prompt33.txt`.
