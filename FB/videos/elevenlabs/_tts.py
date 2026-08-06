"""Shared ElevenLabs TTS + EQ helpers (Healthings explainers)."""
from __future__ import annotations

import json
import re
import subprocess
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SETTINGS = json.loads((HERE / "settings.json").read_text(encoding="utf-8"))


def load_settings() -> dict:
    return SETTINGS


def strip_script(text: str) -> str:
    """Drop markdown headers / blank lead-in from scripts/*.txt."""
    lines = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            if lines:
                lines.append("")
            continue
        if s.startswith("#"):
            continue
        lines.append(s)
    body = "\n".join(lines).strip()
    body = body.replace("\u2019", "'").replace("\u2014", "-").replace("\u00b7", ",")
    return re.sub(r"\n{3,}", "\n\n", body)


def read_clip_script(lang: str, clip: str) -> str:
    path = ROOT / "scripts" / lang / f"{clip}.txt"
    if not path.is_file():
        raise SystemExit(f"Missing script: {path}")
    return strip_script(path.read_text(encoding="utf-8"))


def parse_voice_choice(lang: str) -> str | None:
    """Parse SELECTED_HE / SELECTED_EN from voice-choice.txt."""
    path = HERE / "voice-choice.txt"
    if not path.is_file():
        return None
    key = "SELECTED_HE" if lang == "he" else "SELECTED_EN"
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line.startswith(key):
            continue
        # SELECTED_EN: Daniel | onwK4e9ZLuTAKqWW03F9 | ...
        parts = line.split("|")
        if len(parts) >= 2:
            vid = parts[1].strip()
            if vid and vid != "voice_id_here" and vid != "TBD":
                return vid
    return None


# Premade ElevenLabs labels we use for A/B without digging up IDs.
VOICE_ALIASES = {
    "daniel": "onwK4e9ZLuTAKqWW03F9",
    "bill": "pqHfZKP75CvOlQylNhV4",
    "brian": "nPczCjzI2devNBz1zQrb",
    "george": "JBFqnCBsd6RMkjVDRZzb",
    # Female EN candidates for explainers (IDs verified on this account)
    "sarah": "EXAVITQu4vr4xnSDxMaL",
    "rachel": "21m00Tcm4TlvDq8ikWAM",
    "charlotte": "XB0fDUnXU5powFXDhCwa",
    "lily": "pFZP5JQG7iQjIQuC4Bku",
    "matilda": "XrExE9yKIg1WjnnlVkGX",
    "alice": "Xb7hH8MSUJpSbSDYk0k2",
}


def resolve_voice_id(lang: str, override: str | None = None) -> str:
    if override:
        key = override.strip()
        alias = VOICE_ALIASES.get(key.lower())
        if alias:
            return alias
        return key  # raw ElevenLabs voice id
    chosen = parse_voice_choice(lang)
    if chosen:
        return chosen
    if lang == "en":
        return SETTINGS["voices_en_default"]
    raise SystemExit(
        "No Hebrew voice selected. Run gen_auditions.py, then set SELECTED_HE in voice-choice.txt"
    )


def tts(api_key: str, voice_id: str, text: str, out_mp3: Path, *, previous_text: str | None = None, next_text: str | None = None) -> None:
    body: dict = {
        "text": text,
        "model_id": SETTINGS["model_id"],
        "voice_settings": SETTINGS["voice_settings"],
    }
    if previous_text:
        body["previous_text"] = previous_text[-500:]
    if next_text:
        body["next_text"] = next_text[:500]
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(req, timeout=180) as resp:
        out_mp3.write_bytes(resp.read())


def apply_eq(raw_mp3: Path, out_wav: Path) -> None:
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    eq = SETTINGS["eq_ffmpeg"]
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-i", str(raw_mp3),
        "-af", eq,
        "-ar", "48000", "-ac", "2",
        "-y", str(out_wav),
    ]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise SystemExit(f"ffmpeg EQ failed:\n{p.stderr[-800:]}")


CLIPS = [
    "00-closed-cycle",
    "01-clinic",
    "02-rules",
    "03-gear",
    "04-ai-coach",
    "05-closed-loop",
]
