# Healthings — human hours report

**As of:** 2026-07-29  
**Window:** first commit **2026-05-08** → **2026-07-29** (82 calendar days)  
**Companion:** [README.md](./README.md) (cash), [cursor-invoices.md](./cursor-invoices.md)

This is an **effort estimate**, not a timesheet. Coding hours are inferred from git activity; field-test hours use the owner’s stated daily protocol.

---

## 1. Git activity (proxy for product work)

| Signal | Value |
|--------|------:|
| Calendar days | 82 |
| Days with ≥1 commit | 56 |
| Commits (approx.) | 533 |
| Churn vs initial commit | ~810 files / ~135k lines added |
| Commits by month | May 18 · Jun 129 · Jul 386 |

### Coding / product hours (56 active days)

| Intensity | Hours / active day | Total hours | ≈ person-months (160h) |
|-----------|-------------------:|------------:|-----------------------:|
| Light | 3 | ~170 | ~1.0 |
| **Typical (used below)** | **5** | **~280** | **~1.8** |
| Heavy (July-like) | 7 | ~390 | ~2.4 |

**Working figure for coding + Cursor-driven build:** **~280 hours** (range **250–350**).  
Does not fully capture Play/TestFlight forms, pairing, or non-commit debugging.

---

## 2. Daily field testing (owner protocol)

Stated regimen — **every calendar day** in the window:

| Session | Duration | Role |
|---------|----------|------|
| Bike ×2 | **30 min each** (assumed mid; see §4) | Activity / HR / energy tests |
| Walking — lunch | **20 min** | Walking test |
| Walking — evening | **60 min** | Walking test |
| **Per day** | **80 min walk + 60 min bike** | |

### Field hours (82 days × every day)

| Component | Per day | × 82 days |
|-----------|--------:|----------:|
| Walking (20 + 60) | 80 min | **~109 h** |
| Bike (2 × 30 min) | 60 min | **~82 h** |
| **Field testing total** | **140 min (~2.3 h)** | **~191 h** |

Alternate bike lengths (if you correct the assumption):

| Each bike session | Bike total (82d) | Field total (with walks) |
|-------------------|-----------------:|-------------------------:|
| 20 min | ~55 h | ~164 h |
| **30 min (default)** | **~82 h** | **~191 h** |
| 45 min | ~123 h | ~232 h |

---

## 3. Combined human effort

| Bucket | Hours (working figure) |
|--------|-----------------------:|
| Coding / product / releases | ~280 |
| Daily bike + walk field tests | ~191 |
| **All-in** | **~470 h** |

| Range | Hours | ≈ person-months |
|-------|------:|----------------:|
| Conservative (light code + short bikes) | ~170 + 164 ≈ **335** | ~2.1 |
| **Central** | **~470** | **~2.9** |
| Aggressive (heavy code + long bikes) | ~390 + 232 ≈ **620** | ~3.9 |

**Central estimate: ~3 person-months of owner time** over ~2.7 calendar months — high intensity, especially July.

---

## 4. Assumptions to revisit

1. **Bike = 30 min each** — owner did not specify; change §2 if wrong.  
2. **Field tests every day** including travel/illness days — if some days skipped, scale by actual days.  
3. **Coding = 5 h × 56 commit days** — founder+AI blend; adjust if many full-time days or many light days.  
4. **No double-count** of “lunch walk while also coding” — field block is treated as dedicated test time.  
5. **Cash is separate** — see [README.md](./README.md); do not convert hours to salary here unless you add a rate.

---

## 5. Optional: implied labor value (not booked)

Sweat for the share model uses **equal-effort \(R\)** = max participant charge rate  
(see [share-model.md](./share-model.md); currently nutritionist **\$133/h** assuming 1h sessions).

\[
\text{sweat \$} \approx \text{Hours} \times R_{\max}
\]

Example: \(470 \times 133 \approx \$62.5\text{k}\) sweat (not a salary claim — equity math only).

---

## How to update

1. After each month, refresh commit/active-day counts (`git log --since=…`).  
2. Correct bike minutes and any missed field days.  
3. Keep cash in `README.md`; keep hours here.
