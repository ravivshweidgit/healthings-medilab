# Plan — Healthings closed-cycle video series

## One-sentence thesis

**A licensed clinic writes the clinical rules; the app runs them every day with meals + scale/watch/CGM; the clinic sees the real loop and adjusts — not another food diary, not black-box AI.**

## What is built

`06-what-is-healthings` (new users, ~49s) and `05-closed-loop` (warm, ~27s) render from
`clips/*.json` — see `README.md`. Everything below is the storyboard backlog; a clip gets
a spec when it is ready to shoot.

## Audience (now)

- English explainer VO first (website / TestFlight / FB / clinic intros)
- Hebrew Facebook recruit post can stay text-only (`FB/post-alpha-recruit-he.txt`); HE video VO parked after poor quality pass
- People who already use apps and will log meals

## Formats

| Format | Use |
|--------|-----|
| **Vertical 9:16** | FB Reels, IG, WhatsApp status/stories (primary) |
| **Square 1:1** | FB feed still + short loop |
| **Horizontal 16:9** | Website / clinic deck (optional later) |

Style: **hybrid** — simple motion diagram of the loop + real phone/clinic screens. No stock “happy salad” montage as the main idea.

## Visual system

- Brand name **Healthings** as hero signal in open + close of every clip
- Always-English glossary on screen: kcal, mg/dL, kg, CGM, AI, Withings (see `brand-notes.md`)
- Loop motif (reuse in every clip):

```
Clinic ──► Rules ──► App (meals + AI)
   ▲                    │
   │                    ▼
   └── Gear (scale · watch · CGM) ◄─┘
```

- Prefer real UI from light theme (exports already light-pinned); Hebrew UI when posting HE

## Channel packaging

| Channel | Package |
|---------|---------|
| FB alpha post | Clip 00 or 05 + caption pointing to DM; still from cholesterol trend OK as cover |
| Reel series | 01 → 02 → 03 → 04 → 05 numbered |
| WhatsApp | 25–35s each, captions burned in |
| Clinic intro | Clip 00 + portal screens |

## Claims policy (non-negotiable)

- Founder outcome = **personal n=1**, documented labs — **not** a promise
- Clinic = licensed nutritionist direction; app = continuous execution
- No “cures diabetes / replaces doctor”
- Full rules in `brand-notes.md`

## Implementation phases

### Phase A — Planning pack (this folder) ✅
Storyboards, scripts HE/EN, captions, shot lists, production checklist.

### Phase B — Capture (next)
Phone: dashboard, Food Log, My Rules, Gear setup, Coach chat, visit report share.
Portal: worklist + patient rules (no real patient PII — demo account only).

### Phase C — Edit
ElevenLabs VO (`elevenlabs/`, same Daniel/EQ pattern as `home-hero-video`) + burned Hebrew captions; CapCut picture synced to VO; end card with alpha CTA.

### Phase D — Publish
Post series; keep exports under `assets/exports/` named `clipNN-he-9x16.mp4`.

## Success criteria

- Viewer can redraw the loop after one watch
- Clear that **clinic owns clinical intent**; **app owns daily execution**
- Gear is measurement, not the product itself
- Soft CTA matches `FB/post-alpha-recruit-he.txt` (pilot, 10 seats, DM)
