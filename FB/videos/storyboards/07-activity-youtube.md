# 07 — Activity Log YouTube how-to

**Audience:** people who follow YouTube / TV workouts  
**Export:** `assets/exports/003-activity-youtube/`  
**VO:** English (Daniel) · **Subs:** Hebrew burned

## Story

1. Open Activity Log  
2. **Sample 1 — Upper Body** (TV film B-roll) → paste link → AI calc (minutes + kcal)  
3. **Sample 2 — Arm exercises with dumbbells** (B-roll) → load 5 kg → 15 kg  
4. Save to favorites — link + load + minutes + kcal kept  
5. Daily reuse: tap and log — customized workout ready every day  

## Shots

| Beat | Asset |
|------|--------|
| Activity Log strip | `stills/a9-activity-strip.jpg` |
| Upper Body film | `broll/yt-upper-15s.mp4` ([R5uLtIAfd9s](https://www.youtube.com/watch?v=R5uLtIAfd9s&t=18s)) |
| Upper Body AI (no load) | `stills/a9-activity-ai-noload.jpg` |
| Dumbbells arms film | `broll/yt-arms-15s.mp4` ([FRKBEl5nu_A](https://www.youtube.com/watch?v=FRKBEl5nu_A&t=45s)) |
| AI @ 5 kg | `stills/a9-activity-ai-5kg.jpg` |
| AI @ 15 kg | `stills/a9-activity-ai-15kg.jpg` |

## Render

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 07-activity-youtube --force
python FB/videos/production/render_clip.py  --clip 07-activity-youtube
```
