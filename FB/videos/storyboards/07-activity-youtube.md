# 07 — Activity Log YouTube how-to

**Audience:** people who follow YouTube / TV workouts  
**Export:** `assets/exports/003-activity-youtube/`  
**VO:** English (Daniel) · **Subs:** Hebrew burned

## Story

1. Open Activity Log → Add activity  
2. Paste a public YouTube workout (flash real film B-roll)  
3. AI calc watches the video → minutes + kcal  
4. Optional load kg (5 → 15) — kcal follows *your* body + load  
5. Save — burn updates

## Shots

| Beat | Asset |
|------|--------|
| Add / paste UI | `stills/a9-activity-add.jpg` |
| Arms workout flash | `broll/yt-arms-15s.mp4` (from [FRKBEl5nu_A](https://www.youtube.com/watch?v=FRKBEl5nu_A&t=45s) @ 45s) |
| Upper-body flash | `broll/yt-upper-15s.mp4` (from [R5uLtIAfd9s](https://www.youtube.com/watch?v=R5uLtIAfd9s&t=18s) @ 18s) |
| AI @ 5 kg | `stills/a9-activity-ai-5kg.jpg` |
| AI @ 15 kg | `stills/a9-activity-ai-15kg.jpg` |

## Render

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 07-activity-youtube --force
python FB/videos/production/render_clip.py  --clip 07-activity-youtube
```
