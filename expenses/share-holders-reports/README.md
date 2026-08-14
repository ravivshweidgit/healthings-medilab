# Shareholders reports (weekly)

**Internal only** — do **not** deploy to healthings.ai.  
**Purpose:** One snapshot per ISO week of **Cash / Hours / share %** for everyone in the pool.  
**Source of truth for formula:** [../share-model.md](../share-model.md)  
**Ledgers:** [../README.md](../README.md) (`expenses/` + `working-hours/` per person)

## Layout

```
expenses/share-holders-reports/
  README.md          ← this index
  YYYY-WW/
    README.md        ← markdown source for the week
    share-holders-report-YYYY-WW-EN.html
    share-holders-report-YYYY-WW-HE.html
```

| Rule | |
|------|--|
| Name | `YYYY-WW` — same ISO week as person ledgers |
| Create | When the week’s cash/hours are logged (or when partners ask for a pack) |
| Content | Week **delta** + **closing** pool (Cash, Hours, Sweat, Share %) |
| **Final format** | HTML: `share-holders-report-YYYY-WW-EN.html` + `…-HE.html` (send these) |
| Books | **USD** · FX **3.0 ₪/$** · \(R = \$133/h\) |

## Reports

| Week | Folder | Closing pool | Shares (R / M / S) | HTML |
|------|--------|-------------:|--------------------|------|
| **2026-33** | [2026-33/](./2026-33/README.md) | **$84,507.59** | **98.1% / 1.6% / 0.3%** | [EN](./2026-33/share-holders-report-2026-33-EN.html) · [HE](./2026-33/share-holders-report-2026-33-HE.html) |

## How to add a week

1. Person cash + hours already in `…/expenses/YYYY-WW/` and `…/working-hours/YYYY-WW/`.  
2. Recompute [../share-model.md](../share-model.md) people table.  
3. Write `YYYY-WW/README.md` (opening + deltas + closing).  
4. Generate **`share-holders-report-YYYY-WW-EN.html`** + **`…-HE.html`** (same style as partners HTML).  
5. Add a row to the table above.
