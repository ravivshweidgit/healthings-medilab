# Draft template — copy to `be-NN-short-slug.md`

```markdown
# be-NN — short title

**Status:** ready  
**Model to implement:** Auto / Composer  
**Authored by:** Opus 5 (website UX pack)  
**Findings:** W1, W4, …  
**Depends on:** none | be-10-…

## Problem

<What is wrong for the user, in 2–4 sentences.>

## Goal

<What “done” looks like visually / interactively.>

## Files to touch

- `website/…`
- `website/clinic/…` (if any)
- Do **not** touch: …

## Design rules (from Opus)

- Type / spacing / color notes specific to this batch
- Do not invent a new palette outside the pack’s design system

## Implementation notes

- Concrete layout/CSS/copy changes (enough for Auto; not a full redesign essay)
- Help content? → `help-locale-content.mjs` + regen **or** CSS only — say which

## Acceptance criteria

- [ ] Desktop (~1280): …
- [ ] Mobile (~390): …
- [ ] No regression on: …

## Out of scope

- …

## Review by Opus 5 (after Auto marks done)

<Judgment calls Auto cannot self-certify. Every draft must have this section.>

**Evidence to capture**

- Screenshots at 1280 and 390 of <pages>
- <measurements, diffs, logs>

**Judgment calls to check**

- <Does it read as intentional, not merely compliant?>
- <What is the failure mode of this fix, and did we hit it?>

## Agent checklist

- [ ] Status → in_progress
- [ ] Changes match this draft only
- [ ] Smoke criteria above
- [ ] Status → done
- [ ] Update `prompts/backend/README.md` table
- [ ] Status → `needs-review` and evidence attached for Opus
```
