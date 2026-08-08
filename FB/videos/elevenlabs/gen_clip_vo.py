"""Generate clip VO from a clip spec, with ElevenLabs character-level timestamps.

The spec's segments are joined into one VO take, so the picture and the burned
subtitles can be cut on real speech boundaries instead of equal slices.

Usage:
  python gen_clip_vo.py --clip 06-what-is-healthings
  python gen_clip_vo.py --clip 05-closed-loop --force
"""
from __future__ import annotations

import argparse
import base64
import json
import urllib.request
from pathlib import Path

from _key import load_api_key
from _tts import apply_eq, load_settings, resolve_voice_id

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CLIPS = ROOT / "clips"
AUDIO = ROOT / "assets" / "audio"

JOINER = " "


def load_spec(clip_id: str) -> dict:
    path = CLIPS / f"{clip_id}.json"
    if not path.is_file():
        available = sorted(p.stem for p in CLIPS.glob("*.json"))
        raise SystemExit(f"No spec {path}\nAvailable: {available}")
    return json.loads(path.read_text(encoding="utf-8"))


def build_vo_text(spec: dict, lang: str) -> tuple[str, list[tuple[int, int]]]:
    """Return joined VO text plus (start_char, end_char) per segment."""
    spans: list[tuple[int, int]] = []
    parts: list[str] = []
    cursor = 0
    for i, seg in enumerate(spec["segments"]):
        text = (seg.get(lang) or seg.get("en") or "").strip()
        if not text:
            raise SystemExit(f"Segment {i} has no '{lang}' (or en) VO text")
        if parts:
            cursor += len(JOINER)
        parts.append(text)
        spans.append((cursor, cursor + len(text)))
        cursor += len(text)
    return JOINER.join(parts), spans


def tts_with_timestamps(api_key: str, voice_id: str, text: str) -> dict:
    settings = load_settings()
    body = {
        "text": text,
        "model_id": settings["model_id"],
        "voice_settings": settings["voice_settings"],
    }
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clip", required=True)
    ap.add_argument("--force", action="store_true")
    ap.add_argument(
        "--voice",
        help="Override voice: alias (sarah, rachel, daniel, …) or ElevenLabs voice id",
    )
    ap.add_argument(
        "--tag",
        help="Write side-by-side VO files as <id>-<tag>-eq.wav (keeps default Daniel take)",
    )
    ap.add_argument(
        "--lang",
        help="VO language key in the clip spec (en, de, fr, …). Default: spec vo_lang",
    )
    args = ap.parse_args()

    spec = load_spec(args.clip)
    lang = args.lang or spec.get("vo_lang", "en")
    out_dir = AUDIO / lang
    out_dir.mkdir(parents=True, exist_ok=True)

    stem = f"{spec['id']}-{args.tag}" if args.tag else spec["id"]
    raw = out_dir / f"{stem}-raw.mp3"
    wav = out_dir / f"{stem}-eq.wav"
    align_path = out_dir / f"{stem}-align.json"

    if wav.exists() and align_path.exists() and not args.force:
        print(f"exists (use --force to regenerate): {wav.name}")
        return

    text, spans = build_vo_text(spec, lang)
    # Matilda (SELECTED_EN) speaks FR/DE/RU via multilingual_v2; HE stays parked.
    # Spec `"voice"` (e.g. daniel on 06) applies to EN only — locale dubs stay Matilda.
    voice_lang = "en" if lang != "he" else "he"
    voice_override = args.voice or (spec.get("voice") if lang == "en" else None)
    voice = resolve_voice_id(voice_lang, voice_override)
    print(
        f"clip={spec['id']} lang={lang} voice={voice} "
        f"tag={args.tag or '-'} chars={len(text)} segments={len(spans)}"
    )

    payload = tts_with_timestamps(load_api_key(), voice, text)
    raw.write_bytes(base64.b64decode(payload["audio_base64"]))
    apply_eq(raw, wav)

    alignment = payload.get("alignment") or {}
    chars = alignment.get("characters") or []
    starts = alignment.get("character_start_times_seconds") or []
    ends = alignment.get("character_end_times_seconds") or []
    aligned = len(chars) == len(text) and len(starts) == len(text)

    segments = []
    for (a, b), seg in zip(spans, spec["segments"]):
        if aligned:
            start = float(starts[a])
            end = float(ends[min(b, len(ends)) - 1])
        else:
            start = end = -1.0
        row = {
            "en": seg.get("en", ""),
            "he": seg.get("he", ""),
            "start": start,
            "end": end,
        }
        if lang not in ("en", "he") and seg.get(lang):
            row[lang] = seg[lang]
        segments.append(row)

    align_path.write_text(
        json.dumps(
            {
                "clip": spec["id"],
                "vo_lang": lang,
                "voice_id": voice,
                "text": text,
                "aligned": aligned,
                "segments": segments,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    if aligned:
        print(f"aligned OK -> {align_path.name}")
        for s in segments:
            preview = (s.get(lang) or s.get("en") or "")[:52]
            print(f"  {s['start']:6.2f}-{s['end']:6.2f}  {preview}")
    else:
        print("WARNING: alignment length mismatch; renderer will fall back to proportional timing")
    print(f"VO -> {wav}")


if __name__ == "__main__":
    main()
