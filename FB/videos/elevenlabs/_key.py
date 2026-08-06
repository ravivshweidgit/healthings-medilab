"""Resolve ElevenLabs API key without committing secrets."""
from __future__ import annotations

import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
CANDIDATES = [
    HERE / "api-key.local.txt",
    Path(os.environ.get("ELEVENLABS_API_KEY_FILE", "")),
    Path(r"G:\My Drive\TanzaniaSafariDeals\elevenlabs\api-key.txt"),
]


def load_api_key() -> str:
    env = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if env:
        return env
    for path in CANDIDATES:
        if path and path.is_file():
            key = path.read_text(encoding="utf-8").strip()
            if key:
                return key
    raise SystemExit(
        "No ElevenLabs API key. Set ELEVENLABS_API_KEY, or create "
        f"{HERE / 'api-key.local.txt'}, or keep the safari Drive key file."
    )
