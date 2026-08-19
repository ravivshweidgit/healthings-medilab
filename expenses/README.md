# Healthings — people ledger (cash + hours)

**As of:** 2026-08-19  
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
| [Raviv](./Raviv/) | [expenses](./Raviv/expenses/README.md) · [2026-00](./Raviv/expenses/2026-00/) + [2026-33](./Raviv/expenses/2026-33/) | [2026-00 ~544 h](./Raviv/working-hours/2026-00/) + [2026-33 ~32](./Raviv/working-hours/2026-33/) + [2026-34 **22**](./Raviv/working-hours/2026-34/) → [rollup **~598**](./Raviv/working-hours/README.md) |
| [Shai](./Shai/) | [expenses](./Shai/expenses/README.md) · [2026-34](./Shai/expenses/2026-34/) **$666.67** (₪2,000 transferred 2026-08-19; week 33 had **no** transfer) | [working-hours](./Shai/working-hours/README.md) · [2026-34 **1 h**](./Shai/working-hours/2026-34/) |
| [Michal](./Michal/) | **No expenses** (she is the clinic) | [working-hours](./Michal/working-hours/README.md) · [2026-33 **10**](./Michal/working-hours/2026-33/) + [2026-34 **5**](./Michal/working-hours/2026-34/) |

### Ownership model (shared)

| Doc | |
|-----|--|
| [share-model.md](./share-model.md) | Full internal formula + people table |
| [share-model-partners.md](./share-model-partners.md) / [`.html`](./share-model-partners.html) | Partner-facing EN |
| [share-model-partners.he.md](./share-model-partners.he.md) / [`.html`](./share-model-partners.he.html) | Partner-facing HE |
| [share-holders-reports/](./share-holders-reports/README.md) | Weekly snapshots · [**2026-34 EN**](./share-holders-reports/2026-34/share-holders-report-2026-34-EN.html) · [**HE**](./share-holders-reports/2026-34/share-holders-report-2026-34-HE.html) · [2026-33](./share-holders-reports/2026-33/) |

**Pool snapshot (2026-08-19):** Raviv ~96.9% · Michal ~2.2% · Shai ~0.9%.

### How to update

1. Find ISO week for the receipt/work date → folder `YYYY-WW` under that person’s `expenses/` or `working-hours/`.  
2. Add a row in that week’s `README.md` (+ file if useful).  
3. Refresh the person rollup README, then [share-model.md](./share-model.md).  
4. When the week is ready for partners, add [share-holders-reports/YYYY-WW/](./share-holders-reports/README.md).
