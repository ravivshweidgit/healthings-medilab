# 05 — Patient workspace (Opus 5)

**URL:** https://healthings.ai/clinic/patient.html?patientId=…  
**Files:** `website/clinic/patient.html`, `clinic-workspace.css`, `clinic-workspace.js`,
`clinic-charts.js`, `clinic-api.js`  
**After this:** `06-design-system-and-handoff.md`

---

## Ask the human for

| Shot | Required |
|------|----------|
| Topbar + tabs (desktop) | yes if account available |
| Empty / no-snapshot / waiting-on-patient state | yes if reproducible |
| One populated tab (dashboard or food log) | strongly preferred |
| Mobile or narrow width tabs | nice |

If the human has **no** clinic patient link, complete a **code-informed** review of
topbar/tabs/empty copy from source, and mark visual findings `needs render`.

---

## Investigate

1. **Orientation** — Can a clinician tell whose patient, how fresh the snapshot is, and
   how to refresh — within 3 seconds?
2. **Tabs** — Label clarity, overflow on narrow screens, active state contrast.
3. **Loading / error / empty** — Actionable copy (patient must open app, etc.).
4. **Density** — Clinical data vs chrome; scroll fatigue; chart legibility.
5. **Consistency** — Matches portal login brand? Or a second, unrelated tool?
6. **Safety** — Destructive actions; no accidental data loss (design only).

Workspace tabs were called “worth keeping” in be-08 — prefer **chrome polish** over a
rewrite of clinical renderers unless P0.

---

## Output for this pass

1. Workspace verdict.
2. Findings **W…**
3. What belongs in a small “workspace chrome” batch vs leave alone.

**Next:** `06-design-system-and-handoff.md` — you will write the batch files there.
