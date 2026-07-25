# Backend — Website UI/UX review (Opus 5)

**Status:** Active briefing pack lives in **`opus5/`** (not a single paste blob).

**ID:** `prompt-be-09`  
**Pack path:** [`opus5/README.md`](./opus5/README.md)

## Workflow

1. **Opus 5** follows `opus5/00` → `opus5/06` in order.
2. Opus writes Auto-ready batches under [`opus5/drafts/`](./opus5/drafts/).
3. **Auto** implements drafts with `Status: ready`.
4. Human deploys website and smoke-tests.

## Paste to Opus 5

```
Follow the prompts in prompts/backend/opus5/ in order:
00-start-here.md → 01 … → 06-design-system-and-handoff.md

Investigate live https://healthings.ai (screenshots I attach). Do not implement CSS/HTML.
When done, write implementation drafts under prompts/backend/opus5/drafts/ using TEMPLATE.md.
Stop when 06 is complete and drafts are ready for Auto.
```

## Paste to Auto (later)

```
Implement all drafts in prompts/backend/opus5/drafts/ with Status: ready.
Follow each file’s paths and acceptance criteria. Mark status in_progress then done.
Do not redesign beyond the draft.
```

## Related

- Clinic correctness (separate): `prompt-be-08-clinic-portal-ux.md`
- App UI audit pattern: `../app/prompt92.txt`
