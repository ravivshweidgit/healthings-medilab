# 09 — Food Log how to add a meal

**Audience:** people learning meal entry (camera, AI text, chat, reuse)  
**Export:** `assets/exports/009-meal-entry/`  
**VO:** English (Daniel) · **Subs:** Hebrew burned  
**Pair with:** clip 08 (per-item grams / precision)

## Story

1. Food Log → Meal  
2. Log Meal idle — Camera / Gallery / describe / From past meal  
3. Photo path — AI analyzing a real plate  
4. Describe path — AI item list from typed meal  
5. Chat corrections field  
6. From past meal picker  
7. Bridge to grams slider (clip 08 detail)  
8. CTA — log once, reuse and correct  

## Shots

| Beat | Asset |
|------|--------|
| Food Log open | `stills/a11-food-strip-open.jpg` |
| Log Meal idle | `stills/a11-log-meal-idle.jpg` |
| Photo analyzing | `stills/a11-meal-photo-analyzing.jpg` |
| AI from text | `stills/a11-meal-from-text.jpg` |
| Chat correct | `stills/a11-meal-chat-correct.jpg` |
| Past meal picker | `stills/a11-past-meal-picker.jpg` |
| Grams bridge | `stills/a10-meal-grams-39g.jpg` |

Spare: `a11-meal-from-photo.jpg` (Thai salad item list), `a11-meal-from-past.jpg`.

## Render

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 09-meal-entry --force
python FB/videos/production/render_clip.py  --clip 09-meal-entry
```
