# Voice — David BBC (Daniel) via existing pipeline

Same stack as clip **06 what-is-healthings**: ElevenLabs **Daniel** = “David BBC”.

## Generate / render (canonical)

```powershell
python FB/videos/elevenlabs/gen_clip_vo.py --clip 16-swiss-closed-loop --voice daniel --force

python FB/videos/production/render_clip.py --clip 16-swiss-closed-loop --aspect 16x9 `
  --music marketing/chair-side-90s/bed.mp3 --music-level 0.16
```

Export: `FB/videos/assets/exports/016-swiss-closed-loop/`

Spec: `FB/videos/clips/16-swiss-closed-loop.json`  
Animatic preview: `marketing/chair-side-90s/index.html` (optional; film is the mp4)
