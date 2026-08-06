# Production checklist

The film renders from a spec — there is no timeline project to keep in sync.

## Before you change anything

- [ ] Read `../brand-notes.md` once (claims policy, always-English glossary)
- [ ] Demo / own account only in any new capture — no patient PII

## Editing a film

1. Edit `../clips/<id>.json` — VO line (`en`), subtitle (`he`), and `shot`
2. Regenerate the voice and timings:
   `python ../elevenlabs/gen_clip_vo.py --clip <id> --force`
3. Render:
   `python render_clip.py --clip <id>`
4. Watch it **muted** — the subtitles must carry the story on their own

## Adding a new film

- [ ] Storyboard in `../storyboards/` (why this order, who it is for)
- [ ] Spec in `../clips/`
- [ ] Shots exist in `../assets/screens/stills/` or `../assets/illustrations/`
- [ ] Render, then add the row to `../README.md`

## Quality gates before posting

- [ ] Duration line in the render log says picture matches expected (no drift warning)
- [ ] No Android system junk on screen (volume slider, SIM toast) — see `_reject-` files
- [ ] Subtitles clear the bottom 150px so Reels/Stories UI does not cover them
- [ ] Claims match `../brand-notes.md` — no guaranteed outcomes, no "AI doctor"
- [ ] Founder 13-day POC stays in the post text, not the film

## Publishing

| Channel | Package |
|---------|---------|
| FB / IG Reels | 9:16 mp4, burned subs; attach the `.srt` where supported |
| WhatsApp | Same file — burned subs matter most here |
| Website / clinic intro | Same film; a 16:9 variant is backlog |

Name finished files as the renderer does: `<clip-id>-<vo_lang>-sub<subs_lang>-9x16.mp4`.
