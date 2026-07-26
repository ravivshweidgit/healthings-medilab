# 06 — Design system + Auto handoff (Opus 5)

**Action:** Synthesize all passes → write **implementation batches** into `prompts/backend/`.  
**Stop** when the batches are ready. Do not implement code.

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

## Write batch files under `prompts/backend/`

For **each** batch, create one markdown file using `briefs/TEMPLATE.md`.

Naming — open batches sit at the top level of `prompts/backend/`; `done/` is shipped records only:

```
prompts/backend/be-10-short-slug.md
prompts/backend/be-11-short-slug.md
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
  `be-08` instead of rewriting.

Also update the open-batches table in `prompts/backend/README.md`: filename | title | status | notes.

---

## Final message to human (exact shape)

```
Investigation pack complete.
Verdict: <one line>
Batches ready for Auto:
- prompts/backend/be-10-….md
- …
Next: switch to Auto and say: implement the ready batches in prompts/backend/
```

---

## Do not

- Implement CSS/HTML in the repo in this investigation session.
- Create batch files anywhere but the top level of `prompts/backend/`.
- Ask Auto to “make the site look better” without these files.
