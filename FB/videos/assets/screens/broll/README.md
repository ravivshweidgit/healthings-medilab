# YouTube B-roll (short cuts)

1–2s clips for Activity Log explainers. Sources live in `assets/raw/youtube/` (local only).

| File | Source | In-point |
|------|--------|----------|
| `yt-arms-15s.mp4` | `FRKBEl5nu_A` | 45s |
| `yt-upper-15s.mp4` | `R5uLtIAfd9s` | 18s |

Recut:

```powershell
ffmpeg -y -ss 45 -i ..\..\raw\youtube\FRKBEl5nu_A.mp4 -t 1.5 -an -c:v libx264 -crf 18 yt-arms-15s.mp4
ffmpeg -y -ss 18 -i ..\..\raw\youtube\R5uLtIAfd9s.mp4 -t 1.5 -an -c:v libx264 -crf 18 yt-upper-15s.mp4
```
