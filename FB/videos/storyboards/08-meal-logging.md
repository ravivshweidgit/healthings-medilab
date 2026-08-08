# 08 — Food Log meal items & grams

**Audience:** people who want accurate meal logging (per-item macros)  
**Export:** `assets/exports/008-meal-logging/`  
**VO:** English (Daniel) · **Subs:** Hebrew burned

## Story

1. Open Food Log (day summary)  
2. Open a real meal — item rows with grams / kcal / macros  
3. Show English item names + rule flags + meal total  
4. Edit one item (Blueberries) — grams slider at 39g  
5. **Live slider** — macros update as grams move  
6. Low portion still (5g) — honest scaling  
7. Meal total → Save  
8. Close on Food Log + Healthings  

## Shots

| Beat | Asset |
|------|--------|
| Food Log strip | `stills/a10-food-strip-summary.jpg` |
| Edit Meal (top items) | `stills/a10-meal-edit-en.jpg` |
| Edit Meal (oat bran / berries + total) | `stills/a10-meal-edit-bottom-en.jpg` |
| Edit item @ 39g | `stills/a10-meal-grams-39g.jpg` |
| Slider motion | `stills/a10-meal-grams-slider.mp4` |
| Edit item @ 5g | `stills/a10-meal-grams-5g.jpg` |

Phone UI captured via stable `adb screencap` (English names after chat rename).

## Render

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 08-meal-logging --force
python FB/videos/production/render_clip.py  --clip 08-meal-logging
```
