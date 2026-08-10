# Healthings — human hours report

**As of:** 2026-08-10  
**Window:** first commit **2026-05-08** → **2026-08-10** (95 calendar days)  
**Prior snapshot:** 2026-07-29 (~470 h central) — refreshed because owner keeps daily product + field effort  
**Companion:** [README.md](./README.md) (cash), [cursor-invoices.md](./cursor-invoices.md)

This is an **effort estimate**, not a timesheet. Coding hours are inferred from git activity; field-test hours use the owner’s stated daily protocol (still every day).

---

## 1. Git activity (proxy for product work)

| Signal | Value |
|--------|------:|
| Calendar days | 95 |
| Days with ≥1 commit | 65 |
| Commits (approx.) | 595 |
| Since prior snapshot (after 2026-07-29) | +9 active days · +63 commits |

### Coding / product hours (65 active days)

| Intensity | Hours / active day | Total hours | ≈ person-months (160h) |
|-----------|-------------------:|------------:|-----------------------:|
| Light | 3 | ~195 | ~1.2 |
| **Typical (used below)** | **5** | **~325** | **~2.0** |
| Heavy | 7 | ~455 | ~2.8 |

**Working figure for coding + Cursor-driven build:** **~325 hours** (range **~250–400**).  
Does not fully capture Play/TestFlight forms, pairing, or non-commit debugging.  
Aug 10 may add another active day after this snapshot’s last commit (2026-08-09).

---

## 2. Daily field testing (owner protocol)

Stated regimen — **every calendar day** in the window (owner confirms still ongoing):

| Session | Duration | Role |
|---------|----------|------|
| Bike ×2 | **30 min each** (assumed mid; see §4) | Activity / HR / energy tests |
| Walking — lunch | **20 min** | Walking test |
| Walking — evening | **60 min** | Walking test |
| **Per day** | **80 min walk + 60 min bike** | |

### Field hours (95 days × every day)

| Component | Per day | × 95 days |
|-----------|--------:|----------:|
| Walking (20 + 60) | 80 min | **~127 h** |
| Bike (2 × 30 min) | 60 min | **~95 h** |
| **Field testing total** | **140 min (~2.3 h)** | **~222 h** |

Delta since 2026-07-29 snapshot: **+12 calendar days** (Jul 30 → Aug 10) → **~+28 h** field.

Alternate bike lengths (if you correct the assumption):

| Each bike session | Bike total (95d) | Field total (with walks) |
|-------------------|-----------------:|-------------------------:|
| 20 min | ~63 h | ~190 h |
| **30 min (default)** | **~95 h** | **~222 h** |
| 45 min | ~143 h | ~270 h |

---

## 3. Combined human effort

| Bucket | Hours (working figure) |
|--------|-----------------------:|
| Coding / product / releases | ~325 |
| Daily bike + walk field tests | ~222 |
| **All-in** | **~547 h** |

| Range | Hours | ≈ person-months |
|-------|------:|----------------:|
| Conservative (light code + short bikes) | ~195 + 190 ≈ **385** | ~2.4 |
| **Central** | **~547** | **~3.4** |
| Aggressive (heavy code + long bikes) | ~455 + 270 ≈ **725** | ~4.5 |

**Central estimate: ~3.4 person-months of owner time** over ~3.1 calendar months.

### vs prior snapshot (2026-07-29)

| | Prior | Now | Δ |
|--|------:|----:|--:|
| Calendar days | ~82–83 | 95 | +12–13 |
| Commit-active days | 56 | 65 | +9 |
| Coding (5 h/day) | ~280 | ~325 | +45 |
| Field | ~191 | ~222 | +31 |
| **Central all-in** | **~470** | **~547** | **~+77** |

---

## 4. Assumptions to revisit

1. **Bike = 30 min each** — owner did not specify; change §2 if wrong.  
2. **Field tests every day** including travel/illness days — if some days skipped, scale by actual days. Owner states effort continues daily since last calc.  
3. **Coding = 5 h × active commit days** — founder+AI blend; adjust if many full-time days or many light days.  
4. **No double-count** of “lunch walk while also coding” — field block is treated as dedicated test time.  
5. **Cash is separate** — see [README.md](./README.md); do not convert hours to salary here unless you add a rate.

---

## 5. Optional: implied labor value (not booked)

Sweat for the share model uses **equal-effort \(R\)** = max participant charge rate  
(see [share-model.md](./share-model.md); currently nutritionist **\$133/h** assuming 1h sessions).

\[
\text{sweat \$} \approx \text{Hours} \times R_{\max}
\]

Example: \(547 \times 133 \approx \$72.8\text{k}\) sweat (not a salary claim — equity math only).

---

## How to update

1. After each month (or when owner asks), refresh commit/active-day counts (`git log --since=…`).  
2. Correct bike minutes and any missed field days.  
3. Keep cash in `README.md`; keep hours here.
