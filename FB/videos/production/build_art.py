"""Rasterise the brand SVGs to PNG using the vendored Montserrat.

The video art follows website/tokens.css, and the site's display face is Montserrat,
which is not installed on Windows — so the rasteriser is pointed at the copy in
assets/fonts instead.

Usage:
  python build_art.py            # all SVGs in assets/illustrations
  python build_art.py card-end   # one file, by stem
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "assets" / "illustrations"
FONTS = ROOT / "assets" / "fonts"


def rasterise(svg: Path) -> None:
    png = svg.with_suffix(".png")
    cmd = [
        "npx", "--yes", "@resvg/resvg-js-cli",
        "--font-dir", str(FONTS),
        "--font-default-family", "Montserrat",
        str(svg), str(png),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    if proc.returncode != 0 or not png.is_file():
        raise SystemExit(f"FAILED {svg.name}\n{proc.stdout}\n{proc.stderr}")
    print(f"OK {png.name} ({png.stat().st_size // 1024} KB)")


def main() -> None:
    if not FONTS.is_dir():
        raise SystemExit(f"Missing fonts dir: {FONTS}")
    stems = sys.argv[1:]
    targets = sorted(ART.glob("*.svg"))
    if stems:
        targets = [p for p in targets if p.stem in stems]
        if not targets:
            raise SystemExit(f"No SVG matched {stems}")
    for svg in targets:
        rasterise(svg)


if __name__ == "__main__":
    main()
