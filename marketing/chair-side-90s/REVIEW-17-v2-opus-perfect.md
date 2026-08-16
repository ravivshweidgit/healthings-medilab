# Clip 17 — Opus review v2 (path to perfect)

**Reviewed:** `exports/017-swiss-what-is-healthings/17-swiss-what-is-healthings-en-suben-16x9.mp4`  
51.8s · 1920×1080p30 · H.264 ~**926 kbps** (final mux CRF 19) · film-style EN burns · dark cards  
**Spec:** `clips/17-swiss-what-is-healthings.json`  
**Frames:** `marketing/chair-side-90s/review-frames-17/`  
**Prior review:** `REVIEW-17-swiss-what-is-opus.md` (blockers mostly closed)

---

## 1. Verdict

Remaster fixed the ship-blockers (EN burns, dark cards + holds, real meters, clinic close, aligned loop nodes). What’s left is **finishing**, not story: the cut still **strobes** bright photo ↔ near-black slate, the **encode is too thin** for dark gradients, the **phone mockup** is the weakest product proof, and the **clinic thesis still** shows stock vessel art instead of Healthings. VO stays locked. Fix grade/encode/subs/phone first; regenerate clinic art second — then it’s investor-ready.

---

## 2. Scorecard

| Area | /10 | Note |
|---|---|---|
| Picture | 6 | Strong stills; no shared grade across photo vs slate |
| Continuity | 6 | Islands→loop node set fixed; lockup blinks on/off; clinic room changes twice |
| Typography | 7 | Diagrams clean; open chip order ≠ diagram node set |
| Phone mockup | 4 | Cropped body; meters float in dead black; 16×9 still eats UI |
| Subs | 6 | Film look OK; size/position short of broadcast; long clinic line is one card |
| Encode | 4 | ~926 kbps will band dark cards on a good screen |
| Brand coherence | 7 | Loop story lands; chip / App+AI naming mismatch undercuts it |

---

## 3. Shot-by-shot (current cut)

| ~t | Line | Picture | Call |
|---|---|---|---|
| 0–3.2 | — | Dark open card | **Polish** — chip order; bitrate banding |
| 3.2–8 | meals / watch / labs | `vo-meals-watch-labs.jpg` | **Polish** — grade down; light phone UI vs later dark product |
| 8–11 | none of it talks | `loop-disconnected-dark` | **Keep** — node set matches; optional stronger “NO LOOP” |
| 11–15 | one loop | `loop-video-dark` | **Polish** — double wordmark; roles still inert on return |
| 15–22 | starts in the clinic | `vo-clinic-labs-plan.jpg` | **Replace** — stock artery UI; ~9s hold; hotel-lounge read |
| 22–26 | plan → rules | phone `a4-rules-meters-dark` | **Polish** — fill screen; fix H2O vs Food Log |
| 26–31 | scale / watch / CGM | `vo-scale-watch-cgm.jpg` | **Keep** — best photo beat; grade only |
| 31–36 | meal checked | phone `a14-food-log-dark-meters` | **Polish** — mockup + sub collision with UI |
| 36–41 | clinic sees week | `vo-clinic-sees-week.jpg` | **Polish** — strongest clinic room; grade toward slate |
| 41–45 | directs / executes / measure | `loop-video-dark` again | **Polish** — same frame as 11s; add role labels |
| 45–48 | one loop, closed | `vo-clinic-labs-plan` again | **Replace** — repeats weakest still |
| 48–52 | — | Dark end card | **Polish** — bookend with open (heart); chip order |

---

## 4. Top fixes to “perfect” (ranked)

### 1. Shared grade + soft light↔dark bridges — **M**
Photos sit at high key; diagrams/cards are near black. Eight hard flips read as a deck, not a film.  
**Fix:** pull photo exposure ~15–20%, soft vignette, cool highlights (week desk hardest). 8-frame dissolves only on light↔dark cuts. No Ken Burns.

### 2. Re-encode for dark UI — **S**
Final mux ~926 kbps will band slate cards and mosquito the burns.  
**Fix:** ship CRF **16–17** (or ~8–10 Mbps), `-preset slow`, light grain on cards/diagrams.

### 3. Film subs: size, height, split — **S**
Burns are small and sit very low; clinic line is one 9s card.  
**Fix:** ~42px @1080p, baseline ~86% height; split clinic VO into two cards at the period; wrap ≤~42 chars.

### 4. Phone mockup template — **M**
Device clipped by frame bottom; rules meters sit in upper ~40% with dead black; hard screen corners; lilac edge artifact.  
**Fix:** contain bezel *or* deliberate bleed (pick one); fill screen; 24px corner mask; drop stripe; ~65–70% frame width for readability.

### 5. Clinic thesis art — **L**
Monitor shows generic vessel art, not Healthings; same still closes the film.  
**Fix:** regenerate with real clinic portal (labs/plan); match room language to week desk; separate tighter crop for close.

### 6. Brand micro-continuity — **S**
- Chip `CLINIC · RULES · GEAR · AI` vs diagram `CLINIC / RULES / APP + AI / GEAR`  
- Corner lockup only on composites, absent on photos  
- H2O 2500 vs 0 between the two phone stills (same day numbers otherwise)  
**Fix:** one chip string everywhere; lockup on all non-card beats *or* none; re-capture meters from same app state.

### 7. Second loop appearance must earn its time — **M**
Identical PNG under “Clinic directs. App executes. Devices measure.”  
**Fix:** `loop-video-dark-roles` with verbs on nodes, or three held states lighting one node per phrase.

---

## 5. Nice (after the seven)

- Flat-lay phone → dark Food Log if regenerated  
- Week desk → real portal week view  
- End card: heart + optional factual line (“For clinics and their patients”) — no outcome claims  
- Dip-to-black into end card  
- Audio check: −14 LUFS / ≤ −1 dBTP; duck clears Daniel on dense lines  

---

## 6. Do not change

- Daniel VO / 06 script / clinic-first beat order  
- EN-only film burns (look), no Hebrew  
- Steady picture (`--motion 1.0`)  
- Dark cards + ~3.2 / ~4.0 holds  
- Loop node set; no arrow triangles  
- Real product stills for rules + meal check (framing/state only)  
- `vo-scale-watch-cgm.jpg` composition  

---

## 7. Suggested render order (Auto-safe)

1. CRF / grain encode pass  
2. Sub size + split clinic card  
3. Chip + lockup + end-card heart  
4. Re-capture rules meters (H2O match)  
5. Phone-frame template rebuild  
6. Grade + short dissolves on light↔dark  
7. Clinic still regen + distinct close crop  
8. Loop roles variant for directs/executes/measure  
9. Loudness verify  

---

*Opus-class judgment (finishing + clinical-trust). Mechanical steps → Auto. Corrected one prior hallucination: the “none of it talks” beat is the slate islands diagram, not floating labels on the flat-lay.*
