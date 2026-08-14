# Healthings — people ledger (cash + hours)

**As of:** 2026-08-14  
**Internal only** — do **not** deploy to healthings.ai.  
**Company books:** **USD** · ILS→USD at **3.0 ₪/$** (locked).

## Layout

```
expenses/
  Raviv|Shai|Michal/
    expenses/
      README.md                 ← person cash rollup
      YYYY-WW/                  ← that ISO week’s receipts + week README
    working-hours/
      README.md                 ← person hours rollup
      YYYY-WW/                  ← that week’s hour log
  share-holders-reports/
    YYYY-WW/                    ← weekly shareholders snapshot (Cash/Hours/%)
  share-model*.md|.html         ← shared ownership pool
```

## Week folders — `YYYY-WW` (01–54)

| Rule | |
|------|--|
| Name | `YYYY-WW` — e.g. `2026-33` |
| `WW` | ISO week **01–54**, or **`00`** for locked pre–week-33 baseline (Raviv hours + expenses) |
| Create | Only when that week has cash or hours to log — do **not** pre-create empty 01–54 |
| Undated | Ballpark / “earlier” rows stay on the person `expenses/README.md` until a date is known |

| Person | Cash | Hours |
|--------|------|-------|
| [Raviv](./Raviv/) | [expenses](./Raviv/expenses/README.md) · [2026-00](./Raviv/expenses/2026-00/) + [2026-33](./Raviv/expenses/2026-33/) | [2026-00 ~544 h](./Raviv/working-hours/2026-00/) + [2026-33](./Raviv/working-hours/2026-33/) → [rollup](./Raviv/working-hours/README.md) |
| [Shai](./Shai/) | [expenses](./Shai/expenses/README.md) · [2026-33](./Shai/expenses/2026-33/) **$266.67** (2 alpha sessions → clinic) | [working-hours](./Shai/working-hours/README.md) · [2026-33](./Shai/working-hours/2026-33/) |
| [Michal](./Michal/) | **No expenses** (she is the clinic) | [working-hours](./Michal/working-hours/README.md) · [2026-33](./Michal/working-hours/2026-33/) |

### Ownership model (shared)

| Doc | |
|-----|--|
| [share-model.md](./share-model.md) | Full internal formula + people table |
| [share-model-partners.md](./share-model-partners.md) / [`.html`](./share-model-partners.html) | Partner-facing EN |
| [share-model-partners.he.md](./share-model-partners.he.md) / [`.html`](./share-model-partners.he.html) | Partner-facing HE |
| [share-holders-reports/](./share-holders-reports/README.md) | Weekly snapshots · [**2026-33 EN**](./share-holders-reports/2026-33/share-holders-report-2026-33-EN.html) · [**HE**](./share-holders-reports/2026-33/share-holders-report-2026-33-HE.html) |

**Pool snapshot (2026-08-14):** Raviv ~98.1% · Michal ~1.6% · Shai ~0.3%.

### How to update

1. Find ISO week for the receipt/work date → folder `YYYY-WW` under that person’s `expenses/` or `working-hours/`.  
2. Add a row in that week’s `README.md` (+ file if useful).  
3. Refresh the person rollup README, then [share-model.md](./share-model.md).  
4. When the week is ready for partners, add [share-holders-reports/YYYY-WW/](./share-holders-reports/README.md).
