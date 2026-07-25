# 06 — Design system + Auto handoff (Opus 5)

**Action:** Synthesize all passes → write **implementation drafts** under `drafts/`.  
**Stop** when drafts are ready. Do not implement code.

---

## Deliverables (in your reply)

1. **Site-wide verdict** (3–5 sentences).
2. **Master findings table** — all W… (and C… if any), P0→P2, effort, draft owner filename.
3. **Design system sketch**
   - Type scale (landing / help / clinic)
   - Spacing rhythm
   - Color + contrast notes (AA)
   - 3–5 reusable component rules (buttons, cards, inputs, links)
4. **Batch plan** — 3–6 Auto-sized batches (max perceived quality first).

---

## Write files under `drafts/`

For **each** batch, create one markdown file using `drafts/TEMPLATE.md`.

Naming:

```
drafts/be-10-short-slug.md
drafts/be-11-short-slug.md
…
```

Rules:

- One Auto session per file (prefer small).
- Status header: `ready` when you finish the draft.
- List exact paths under `website/` (and `server/` only if API needed).
- Acceptance criteria: desktop + mobile bullets the human can smoke-test.
- Out of scope explicit.
- Reference finding IDs (W3, W7…).
- Do **not** duplicate be-08 Batch A correctness unless live still broken — then point at
  `prompt-be-08` instead of rewriting.

Also update `drafts/README.md` table: filename | title | status | depends on.

---

## Final message to human (exact shape)

```
Opus pack complete.
Verdict: <one line>
Drafts ready for Auto:
- prompts/backend/opus5/drafts/be-10-….md
- …
Next: switch to Auto and say: implement ready drafts in prompts/backend/opus5/drafts/
```

---

## Do not

- Implement CSS/HTML in the repo in this Opus session.
- Create drafts outside `prompts/backend/opus5/drafts/`.
- Ask Auto to “make the site look better” without these files.
