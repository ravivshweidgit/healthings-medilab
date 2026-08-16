# Review — 17 Swiss "What is Healthings" (EN 16x9)

Reviewed: `exports/017-swiss-what-is-healthings/17-swiss-what-is-healthings-en-16x9.mp4` (48.9s, 1920x1080, VO ends 45.9s).
Spec: `clips/17-swiss-what-is-healthings.json`. Frames pulled at 3/7/10/15/21/25/30/35/40/44/47s.

## 1. Verdict — **remaster picture. Do not touch VO.**

Daniel's read and the 06 script are the best asset here; the pictures are what's costing you.
Three are blockers, not taste: **(a) Hebrew on screen at 21s** in an EN-only cut, **(b) the phone
mockup is oversized for 16x9 and clips its own title**, **(c) no burned EN subs anywhere** — a
silent-autoplay feed gets 49s of stock wellness and no message. Fix those and you have a shippable
brand film without re-recording a syllable.

## 2. Shot by shot

| t | Line | Picture | Call |
|---|---|---|---|
| 1.4–6.1 | meals / watch / labs | flat-lay: phone, watch, lab printout | **Works.** Generic app + paper labs is exactly "your current mess". |
| 6.2–8.4 | none of it talks | `loop-disconnected` — Clinic / Gear / Labs / Meals, "no loop" | **Works,** but see §3. |
| 8.5–12.2 | connects into one loop | `loop-video` — static | Idea right, execution flat. Static PNG on the film's thesis line. |
| 12.3–19.0 | starts in the clinic | Swiss desk, artery render + lab table, mountain window | **Best frame in the film.** Premium + clinical. Keep. |
| 19.0–23.1 | plan becomes rules | Quick Start **12 of 13**, Hebrew body-target line, title clipped | **Blocker.** Owner is right, and it's worse than "weak" — see §5.1. |
| 23.1–28.2 | scale / watch / CGM | scale, watch, CGM on arm | **Works.** Reads honest, not staged. |
| 28.3–32.8 | every meal checked, in seconds | AI-art dark phone, **fake meters with gibberish labels** | **Weakest beat.** Fake UI on the one line that promises a real check. |
| 32.9–38.1 | clinic sees the real week | clinic monitor: week charts + meal photos, stethoscope | **Works.** This is the dietitian's own desk. Keep. |
| 38.2–42.7 | clinic directs / app executes / devices measure | `loop-video` again, **identical frame** | Repeat of 8.5s with zero change. Dead 4.5s. |
| 42.8–45.9 | one loop, closed | `swiss-clinic.jpg` — **spa pool + lounge chairs** | Wrong genre. See §4. |
| 45.9–48.9 | — | healthings.ai endcard | Clean. Keep. |

**Quick Start vs Food Log meters — owner call confirmed, with one correction.** The Quick Start frame
is not merely weak: it shows wizard chrome ("Quick Start · 12 of 13", dot pager), a title cropped by
the 16x9 edge, a mid-scroll body, and Hebrew (`הפחתת שומן…`) in an EN-only cut. But the *right home*
for the Food Log meters is **not** the 19s rules beat — it's **28.3s, "checked against your plan"**.
`a10-food-strip-open.jpg` shows kcal eaten / activity / burned, deficit, and P/C/F/Fi/C-Fi/H2O each
against target, with **C 110/80g and Fi 55/37g in red**. Red over-target bars *are* the check. That
single frame proves "the loop executes daily" better than anything else in the library.

## 3. Islands → closed loop: story is **broken, and it's a fixable bug**

The two diagrams don't share a node set. Disconnected shows **Clinic / Gear / Labs / Meals**;
connected shows **Clinic / Rules / Gear / App + AI**. Labs and Meals vanish, Rules and App+AI appear
out of nowhere. The viewer cannot track which island became which node, so the promise — *these four
things you already have become one loop* — never lands visually; it only lands in Daniel's voice.
Fix: keep the same four boxes and animate the arrows closing. Labs → Rules and Meals → App+AI can be
relabels *on screen*, but they have to be seen moving. Then at 38.2s reuse the loop with each node
lighting on its phrase ("Clinic **directs**" / "App **executes**" / "Devices **measure**") so the
second appearance earns its 4.5s. ("App + AI executes daily" under "Clinic directs" is good framing —
keep that wording; it stays clear of the banned claim.)

## 4. Swiss aesthetic: **helps twice, dilutes twice**

The two Swiss *desk* shots (12.3s, 32.9s) are the strongest clinical trust signals you have —
mountain window, clean workstation, stethoscope, real charts. That reads "European private clinic",
which is the aspiration an Israeli dietitian is buying into. The **spa pool lounge** on the closing
line does the opposite: pool + resort armchairs says wellness retreat, and a dietitian's instinct on
that image is "consumer lifestyle app, not my tool". Closing the film on it undoes the two good desk
shots. The 1.4s flat-lay drifts the same direction but survives because it's framed as the *before*.
Rule of thumb for this brand: **desks and instruments, never pools.**

## 5. Top 5 picture swaps, ranked by impact

1. **28.3s — `vo-meal-checked.jpg` → `screens/stills/a10-food-strip-open.jpg`.** Replaces AI-fake UI
   with real UI on the film's proof line. Owner's dark-theme ask is right and there is **no dark
   Food Log capture in the library** (all of `screens/stills/` is light theme, per `INVENTORY.md`) —
   ship the light frame now, queue a dark-theme recapture at 1080x2400 as the upgrade.
2. **19.0s — recrop `a4-my-rules-targets.jpg` to the "Rules applied" card only.** Crop out the Quick
   Start header, the dot pager, and the Hebrew body-target line. What's left ("1.2–1.5 g protein per
   kg · limit saturated fat to <7% · 30–35 g fiber…") is exactly "your plan became rules" and is the
   most clinically credible text in the whole film. Hebrew removal is not optional for this cut.
3. **Fix the phone-frame scale for 16x9, then burn EN subs.** The phone composite is tuned for 9:16;
   at 1920x1080 it overflows top and bottom and guillotines the screen title. Swap #1 lands clipped
   unless this is fixed — the meter rows are exactly what the crop eats. Then burn the existing
   `-en.srt` (outline-only, per the pipeline rule) so the film works muted.
4. **42.8s — drop `swiss-clinic.jpg` (spa).** Close on the clinic desk instead, or hold the closed-loop
   diagram one extra beat and go straight to the endcard. Either beats a resort pool on "one loop, closed".
5. **8.5s / 38.2s — make `loop-video.png` move**, per §3. Same asset twice unchanged is the single
   biggest "slide deck" tell in a film that's otherwise well shot.

## 6. Do not change

- **The VO.** Daniel / "David BBC" is locked for 06/17 by `explainer-video-pipeline.mdc`. No Matilda A/B here.
- **The 06 script, word for word.** No outcome claims, no "AI replaces dietitian", clinic-first order
  intact ("It starts in the clinic. A licensed nutritionist reads your labs and sets your plan").
- **The clinic-first beat order**: clinic → rules → devices → meal → clinic-adjusts. That sequence *is*
  the wedge argument. Swap pictures inside beats; do not reorder beats.
- **The two Swiss desk shots** (12.3s, 32.9s) and the **scale/watch/CGM** shot (23.1s).
- **"Clinic directs. App executes. Devices measure."** and the endcard's `CLINIC · RULES · GEAR · AI` strip.
- **Steady picture** — no Ken Burns added while fixing the above.

---
*Model note: reviewed on Opus-class judgment (clinical-trust and claim-safety calls, per `model-budget.mdc`).
The swaps themselves are Auto-level mechanical edits to the clip JSON plus one recapture.*
