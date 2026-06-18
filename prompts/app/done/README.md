# Done prompts

Implemented prompt specs live here after they ship (phone-tested or explicitly closed).

Active / backlog specs stay in `prompts/app/`:

| File | Why still active |
|------|------------------|
| prompt31.txt | Spec only — source config + Samsung + AI/manual BMR |
| prompt32.txt | Spec only — backup import QA + hardening (deferred) |

**prompt20** — done (Phase 1 + 3 + rules/fiber). Phase 2 photo polish deferred inside `done/prompt20.txt`.

**prompt21** — done (CGM persistence + merge + mentors).

**prompt25** — done (per-mentor coach panel + open-at-top on chat entry). Phone-tested 2026-06-17.

**prompt35** — done (2026-06-18). Shipped unified macro pipeline: fiber↔carb coupling, `/macros` + chat confirm card, and auto macro revision on weigh-in/lab using 7-day context + labs.

**prompt36** — done (2026-06-18). Monitoring-driven macro revision: ENERGY BALANCE + CARB GUIDANCE injection, kcal safety floor, cholesterol-first prompt, tiered carb rules, My Rules parse fix + Goals context. Phone-tested ~2325 kcal P141 C50 F173 Fi25.

**prompt34** — closed without ship (2026-06-17). Status row declined; chat fallback unnecessary with persistence. Manual CGM exclusions deferred inside `done/prompt34.txt`.

**prompt33** — closed without ship (2026-06-17). Default 2-day full snapshot + `/N` is sufficient; rollup/cache optimization deferred inside `done/prompt33.txt`.
