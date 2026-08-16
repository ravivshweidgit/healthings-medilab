"""Generate clip-17 HE VO via free Edge neural TTS + segment alignment for render_clip."""
from __future__ import annotations

import asyncio
import json
import subprocess
import tempfile
from pathlib import Path

import edge_tts

from _tts import apply_eq

ROOT = Path(__file__).resolve().parent.parent
CLIP = ROOT / "clips" / "17-swiss-what-is-healthings.json"
OUT_DIR = ROOT / "assets" / "audio" / "he"

VOICE_DEFAULT = "he-IL-HilaNeural"
TAG_DEFAULT = "he-hila"
GAP_MS = 280  # short breath between lines

# TTS-only niqqud (subs stay plain)
VO_FIXES = {
    "ובונה לכם": "וּבוֹנָה לכם",
    "שלכם רואה": "שלכם רוֹאָה",
    "מכוונת": "מְכַוֶּנֶת",
    "מחליטה": "מַחְלִיטָה",
    "רושמים": "רוֹשְׁמִים",
    "ומעדכנת": "וּמְעַדְכֶּנֶת",
    "למעגל": "לְמַעֲגָל",
    "מעגל": "מַעֲגָל",
    "מחברת": "מְחַבֶּרֶת",
    "לישות": "לִישׁוּת",
}


def point_for_tts(text: str) -> str:
    t = text
    for plain, dotted in VO_FIXES.items():
        t = t.replace(plain, dotted)
    return t


def ffprobe_dur(path: Path) -> float:
    p = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(p.stdout.strip())


async def synth_segment(text: str, out_mp3: Path, voice: str) -> None:
    await edge_tts.Communicate(point_for_tts(text), voice).save(str(out_mp3))


async def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--voice",
        default=VOICE_DEFAULT,
        help="Edge neural voice id (he-IL-HilaNeural / he-IL-AvriNeural)",
    )
    ap.add_argument(
        "--tag",
        default=None,
        help="Output stem tag (default: he-hila / he-avri from voice)",
    )
    args = ap.parse_args()
    voice = args.voice
    if args.tag:
        tag = args.tag
    elif "Avri" in voice:
        tag = "he-avri"
    elif "Hila" in voice:
        tag = "he-hila"
    else:
        tag = TAG_DEFAULT

    spec = json.loads(CLIP.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stem = f"{spec['id']}-{tag}"
    raw_mp3 = OUT_DIR / f"{stem}-raw.mp3"
    eq_wav = OUT_DIR / f"{stem}-eq.wav"
    align_path = OUT_DIR / f"{stem}-align.json"
    print(f"voice={voice} tag={tag}")

    with tempfile.TemporaryDirectory() as td:
        tdir = Path(td)
        parts: list[Path] = []
        segs_out: list[dict] = []
        cursor = 0.0

        for i, seg in enumerate(spec["segments"]):
            he = (seg.get("he") or "").strip()
            if not he:
                raise SystemExit(f"segment {i} missing he")
            part = tdir / f"seg{i:02d}.mp3"
            print(f"TTS {i + 1}/{len(spec['segments'])}: {he[:40]}…")
            await synth_segment(he, part, voice)
            dur = ffprobe_dur(part)
            segs_out.append(
                {
                    "en": seg.get("en", ""),
                    "he": he,
                    "start": round(cursor, 3),
                    "end": round(cursor + dur, 3),
                }
            )
            parts.append(part)
            cursor += dur
            if i + 1 < len(spec["segments"]):
                # silent gap so cuts don't smash into the next line
                gap = tdir / f"gap{i:02d}.mp3"
                subprocess.run(
                    [
                        "ffmpeg", "-hide_banner", "-loglevel", "error",
                        "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                        "-t", f"{GAP_MS / 1000:.3f}",
                        "-q:a", "9", "-acodec", "libmp3lame", "-y", str(gap),
                    ],
                    check=True,
                )
                parts.append(gap)
                cursor += GAP_MS / 1000.0

        list_file = tdir / "concat.txt"
        list_file.write_text(
            "".join(f"file '{p.as_posix()}'\n" for p in parts),
            encoding="utf-8",
        )
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-f", "concat", "-safe", "0", "-i", str(list_file),
                "-c", "copy", "-y", str(raw_mp3),
            ],
            check=True,
        )

    apply_eq(raw_mp3, eq_wav)
    align_path.write_text(
        json.dumps(
            {
                "clip": spec["id"],
                "vo_lang": "he",
                "voice_id": voice,
                "text": " ".join(s["he"] for s in segs_out),
                "aligned": True,
                "segments": segs_out,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"VO -> {eq_wav} ({cursor:.1f}s)")
    print(f"align -> {align_path.name}")
    for s in segs_out:
        print(f"  {s['start']:6.2f}-{s['end']:6.2f}  {s['he'][:48]}")


if __name__ == "__main__":
    asyncio.run(main())
