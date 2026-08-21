# Plan for Michal — live clinic macros

**Status:** **owner-approved 2026-08-21** — clinician path = write rules only; AI models the meters. Engine details stay in `be-45` / prompt114 (she does not need them).  
**For:** Michal (licensed clinical nutritionist)  
**What she does:** write visit rules → Save. That is the whole job.

---

## מה משתנה בשבילך (עברית)

היום: שומרת כללים → הכללים חיים בטלפון, אבל המטרים ביומן האוכל נשארים לפי מספר ישן של האפליקציה.

**מהיום (אחרי שנבנה):** את כותבת את התוכנית בכללים כמו היום ושומרת. המערכת קוראת את מה שכתבת, בונה את גבולות המקרו והסמנים, ומעדכנת את הטלפון. **את לא צריכה להבין אחוזים מול גרמים, יום אימון, או מסכים של מנוע** — רק לכתוב כמו שאת כותבת היום.

לשונית **מקרו · חי** ליד הכללים: שם אפשר לראות מה נקבע (לביקורת). לא חובה לגעת בה.

המטופל רואה ≤ ≥ על מה שננעל, והארוחות נבדקות בזמן אמת — אם משהו חורג, הוא רואה ומוזמן לתקן.

---

## What you do (English)

1. Write **rules** as today.  
2. **Save.**  

AI turns that text into the live macro / marker order and pushes it to the phone (same pull as rules). You do **not** fill type dropdowns, percent math, or training toggles unless you want to open the Macros tab and override.

**Macros · Live** tab = audit of the full Food Log order (kcal · P · C · F · Fi · C−Fi). Unlocked axes stay visible as **FLEX** (no number). Optional edit for power users / owner — not the daily path.

---

## What the patient sees

- Food Log meters with ≤ ≥ / bands when the clinic locked that axis.  
- Markers (SatF, SolFi, …) the same way.  
- Meal log / edit: checked against those bounds in real time; over/under is visible and the user is told (red meter + short notice). Same day: C can be green and C−Fi red — intentional.

Example (illustration, not your numbers):

| Meter | Display when locked |
|------|---------------------|
| kcal | `1740 ≤ 2000` (or up to 2300 on a measured training burn when your rules say so) |
| P | `108  95–126g` |
| C | `140 ≤ 150g` · `30% of 2000` |
| SatF | `18 ≤ 19g` · `10%` |

---

## Coverage — what you already wrote (engine must support)

| Patient | Rules language we already saw | Engine maps to |
|---|---|---|
| Natali | grams bands + floors; I/Se floors | constant bands / floors + markers |
| Anat | grams after she did % table; kcal rails + point | constant + kcal point/rails |
| Stav | P grams; C ≤30% kcal; kcal 2000 / training ≤2300; SatF &lt;10%; SolFi floor | % of target, kcal + activity add-back, SatF % eaten |
| Daniel | P grams; C ≤35%; kcal 1500–2100; SatF &lt;10%; Fi ~30–35 | % of target (AI picks target from your text or flags the Macros tab if missing); SatF % eaten |
| Raviv | markers only | markers; phone points until rules add macros |

If a future note does not fit that shape, it stays in rules prose until we extend the engine — meters never invent from silence.

---

## Owner lock (2026-08-21)

- Michal’s daily path = **rules only**. She does not need to understand the engine.  
- AI **auto-models and auto-applies** on rules Save: **macros + treatment markers** (audit + Macros/Markers tabs show the result).  
- Clinic **can** edit the engine on those tabs (override). That does **not** always mean the rules are incomplete — sometimes it is intentional.  
- Gaps (`needsClinician`) → banner = something *is* missing/ambiguous in the rules; apply everything else; do not invent.  
- After a manual override: badge **“Set here — not from last rules Save”** until Rebuild or next rules Save.  
- Markers: upsert what the rules name; **do not delete** markers the rules did not mention.  
- Patient: **real-time meal check + informed** when out of bound.  
- Implement when ready: `be-45` then `prompt114`.

**Michal:** no signature required for engine internals. Keep writing rules as today after ship.  
**Notes:**
```
```
