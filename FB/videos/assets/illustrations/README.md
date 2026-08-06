# Illustrations

Brand art for the films. Every file is drawn against the website tokens — palette,
type and shape language are documented in `../../brand-notes.md`.

| File | Role |
|------|------|
| `phone-frame.svg` | Page gradient + the site's dark handset, screen punched out |
| `loop-video.svg` | The closed cycle — Clinic → Rules → App+AI → Gear |
| `loop-disconnected.svg` | The same four cards, arcs broken — the "before" state |
| `card-open.svg` | Opening title |
| `card-end.svg` | End card with the URL |

`loop-disconnected` and `loop-video` place their cards at identical coordinates, so a
dissolve between them reads as the loop closing rather than as a scene change. Keep
them in sync if you move a node.

Each file has a `-16x9` landscape twin for the website cut. Unsuffixed means 9:16;
`render_clip.py` picks the variant that matches `--aspect` and falls back to the
portrait file if a landscape one is missing. Screenshots need no variant — they sit
inside the phone.

Rebuild the PNGs with `python ../../production/build_art.py` — never resvg directly,
or Montserrat falls back to a system face.
