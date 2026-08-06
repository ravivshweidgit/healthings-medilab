"""Generate ElevenLabs VO for Healthings explainer clips (+ approved EQ).

Usage:
  python gen_vo.py --lang he
  python gen_vo.py --lang en --clip 05
  python gen_vo.py --lang he --force
"""
from __future__ import annotations

import argparse
from pathlib import Path

from _key import load_api_key
from _tts import (
    CLIPS,
    apply_eq,
    read_clip_script,
    resolve_voice_id,
    tts,
)

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=("he", "en"), required=True)
    ap.add_argument("--clip", help="e.g. 05 or 05-closed-loop (default: all)")
    ap.add_argument("--force", action="store_true", help="Regenerate even if files exist")
    args = ap.parse_args()

    clips = list(CLIPS)
    if args.clip:
        token = args.clip.strip()
        if token.isdigit():
            token = f"{int(token):02d}"
        clips = [c for c in clips if c.startswith(token) or c == token]
        if not clips:
            raise SystemExit(f"No clip matched {args.clip!r}. Known: {CLIPS}")

    key = load_api_key()
    voice = resolve_voice_id(args.lang)
    out_dir = ROOT / "assets" / "audio" / args.lang
    out_dir.mkdir(parents=True, exist_ok=True)

    texts = [read_clip_script(args.lang, c) for c in clips]
    print(f"voice={voice} lang={args.lang} clips={len(clips)}")

    for i, clip in enumerate(clips):
        raw = out_dir / f"{clip}-raw.mp3"
        wav = out_dir / f"{clip}-eq.wav"
        if wav.exists() and not args.force:
            print(f"skip {clip} (exists)")
            continue
        prev = texts[i - 1] if i > 0 else None
        nxt = texts[i + 1] if i < len(texts) - 1 else None
        print(f"TTS {clip} ({len(texts[i])} chars)...")
        tts(key, voice, texts[i], raw, previous_text=prev, next_text=nxt)
        apply_eq(raw, wav)
        print(f"  -> {wav}")

    print("Done:", out_dir)


if __name__ == "__main__":
    main()
