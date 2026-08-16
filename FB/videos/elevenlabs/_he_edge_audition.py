"""Free HE VO auditions via edge-tts (Microsoft neural he-IL, no API key)."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

import edge_tts

from _tts import apply_eq

ROOT = Path(__file__).resolve().parent.parent
CLIP = ROOT / "clips" / "17-swiss-what-is-healthings.json"
OUT = ROOT / "assets" / "audio" / "auditions" / "he-edge"

VOICES = [
    "he-IL-HilaNeural",
    "he-IL-AvriNeural",
]


# TTS-only niqqud fixes for gender/vowel-ambiguous words (subs keep plain text)
VO_FIXES = {
    "ובונה לכם": "וּבוֹנָה לכם",
    "שלכם רואה": "שלכם רוֹאָה",
    "מכוונת": "מְכַוֶּנֶת",
    "מחליטה": "מַחְלִיטָה",
    "רושמים": "רוֹשְׁמִים",
    "ומעדכנת": "וּמְעַדְכֶּנֶת",
    "למעגל": "לְמַעְגָּל",
    "מעגל": "מַעְגָּל",
    "מחברת": "מְחַבֶּרֶת",
    "לישות": "לִישׁוּת",
}


def script_he() -> str:
    spec = json.loads(CLIP.read_text(encoding="utf-8"))
    parts = []
    for seg in spec["segments"]:
        t = (seg.get("he") or "").strip()
        if not t:
            raise SystemExit("missing he line in clip 17")
        for plain, dotted in VO_FIXES.items():
            t = t.replace(plain, dotted)
        parts.append(t)
    return " ".join(parts)


async def list_he() -> None:
    vs = await edge_tts.list_voices()
    for v in vs:
        if v["Locale"].startswith("he"):
            print(v["ShortName"], v["Gender"])


async def gen() -> None:
    text = script_he()
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"chars={len(text)} -> {OUT}")
    for voice in VOICES:
        mp3 = OUT / f"he-edge-{voice}-raw.mp3"
        wav = OUT / f"he-edge-{voice}-eq.wav"
        print(f"TTS {voice}...")
        await edge_tts.Communicate(text, voice).save(str(mp3))
        apply_eq(mp3, wav)
        print(f"  -> {wav.name}")


if __name__ == "__main__":
    asyncio.run(list_he())
    asyncio.run(gen())
