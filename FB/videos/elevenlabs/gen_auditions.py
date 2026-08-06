"""Generate short ElevenLabs auditions for Healthings (HE + EN sample lines).

Mirrors C:\\projects\\home-hero-video auditions flow.
Does not print the API key. Costs a small amount of ElevenLabs credits.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from _key import load_api_key
from _tts import apply_eq, load_settings, tts

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio" / "auditions"

SAMPLE_HE = (
    "Healthings סוגר מעגל. "
    "הקליניקה מכוונת, האפליקציה מיישמת, "
    "Scale, Watch ו־CGM מודדים — והמעגל נסגר."
)
SAMPLE_EN = (
    "Healthings closes the loop. "
    "The clinic directs, the app executes, "
    "Scale, Watch, and CGM measure — and the cycle closes."
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=("he", "en", "both"), default="both")
    ap.add_argument("--skip-existing", action="store_true")
    args = ap.parse_args()

    settings = load_settings()
    key = load_api_key()
    labels = settings.get("audition_labels", {})
    voice_ids = settings["audition_voice_ids"]

    jobs = []
    if args.lang in ("he", "both"):
        jobs.append(("he", SAMPLE_HE))
    if args.lang in ("en", "both"):
        jobs.append(("en", SAMPLE_EN))

    for lang, text in jobs:
        for vid in voice_ids:
            label = labels.get(vid, vid[:8])
            raw = OUT / f"{lang}-{label}-{vid[:8]}-raw.mp3"
            wav = OUT / f"{lang}-{label}-{vid[:8]}-eq.wav"
            if args.skip_existing and wav.exists():
                print(f"skip {wav.name}")
                continue
            print(f"TTS {lang} {label} ({len(text)} chars)...")
            tts(key, vid, text, raw)
            apply_eq(raw, wav)
            print(f"  -> {wav}")

    print("\nListen in:", OUT)
    print("Then set SELECTED_HE / SELECTED_EN in voice-choice.txt")


if __name__ == "__main__":
    main()
