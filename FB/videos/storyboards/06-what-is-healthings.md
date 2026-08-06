# 06 — What is Healthings (new-user explainer)

**Length:** ~45–55s · **Aspect:** 9:16 · **Audience:** cold / new users  
**Spec:** `clips/06-what-is-healthings.json` (VO **EN** · subs **HE**)

This is the clip to show someone who has never heard of Healthings. Clip 00/05 assume
the viewer already accepts the premise; this one earns it.

## Narrative shape

| Beat | Job | Shot |
|------|-----|------|
| 1. Recognition | Name what they already do (meals, watch, labs) | Food Log |
| 2. Problem | Those three never meet | Trend & energy |
| 3. Promise | Healthings connects them into one loop | Loop art |
| 4. Clinic | Licensed nutritionist reads real labs | Lab import |
| 5. Rules | Plan becomes rules in the app | My Rules |
| 6. Gear | Scale · watch · CGM keep numbers honest | Withings link |
| 7. Daily | Every meal checked against the plan | Coach |
| 8. Loop closes | Clinic sees the real week, adjusts | Dashboard |
| 9. Thesis | Directs · executes · measures | Loop art |
| 10. Brand | One loop, closed | Loop art → end card |

## Why this order

The hook is **not** the product. It is the viewer's own week — three habits that
already exist and already fail to connect. Only after that gap is visible does the
loop diagram mean anything.

## Render

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 06-what-is-healthings
python FB/videos/production/render_clip.py --clip 06-what-is-healthings
```

Output: `assets/exports/06-what-is-healthings-en-subhe-9x16.mp4`

## Upgrade path

Swap the stills for Hebrew screen **video** (`SESSION.md`) and add clinic portal
footage for beats 4 and 8 — the spec references files by name, so re-render picks
them up without touching the script.
