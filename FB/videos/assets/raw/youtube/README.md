# YouTube source downloads (local)

Full workout videos used to cut `assets/screens/broll/` flashes.
Keep out of git if large — regenerate with yt-dlp:

```powershell
yt-dlp -f "bv*[height<=720]+ba/b[height<=720]" --merge-output-format mp4 `
  -o "FRKBEl5nu_A.%(ext)s" "https://www.youtube.com/watch?v=FRKBEl5nu_A"
yt-dlp -f "bv*[height<=720]+ba/b[height<=720]" --merge-output-format mp4 `
  -o "R5uLtIAfd9s.%(ext)s" "https://www.youtube.com/watch?v=R5uLtIAfd9s"
```
