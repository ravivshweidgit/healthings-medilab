"""Rebuild assets/brand-logo.png with a real alpha channel.

The source art is flat RGB drawn over white. An edge flood fill cannot reach the enclosed
counters of A, G, o, e, a, so those survive as white blobs, and thresholding throws away
the anti-aliasing. Instead invert the compositing itself: every pixel is
`src * a + 255 * (1 - a)`, so `a = 1 - min(r, g, b) / 255` recovers coverage and the source
colour follows. Counters go transparent because they are white, and edge pixels keep
fractional alpha.

    python website/scripts/make-logo-transparent.py [source.png]

Defaults to the current asset, which is safe to re-run only if it is still opaque; pass the
pre-conversion file explicitly when redoing a botched pass.
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "brand-logo.png"
src_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEST

img = Image.open(src_path).convert("RGB")
w, h = img.size
src = img.load()

out = Image.new("RGBA", (w, h))
dst = out.load()

for y in range(h):
    for x in range(w):
        r, g, b = src[x, y]
        coverage = 255 - min(r, g, b)
        if coverage == 0:
            dst[x, y] = (0, 0, 0, 0)
            continue
        scale = 255 / coverage
        dst[x, y] = (
            max(0, min(255, round((r - (255 - coverage)) * scale))),
            max(0, min(255, round((g - (255 - coverage)) * scale))),
            max(0, min(255, round((b - (255 - coverage)) * scale))),
            coverage,
        )

out.save(DEST, "PNG", optimize=True)

alpha = out.getchannel("A")
data = list(alpha.getdata())
total = w * h
clear = sum(1 for a in data if a == 0)
solid = sum(1 for a in data if a == 255)
px = out.load()
stray = sum(
    1
    for y in range(h)
    for x in range(w)
    if px[x, y][3] > 200 and min(px[x, y][:3]) > 235
)

print(f"{DEST.relative_to(ROOT.parent)}: {w}x{h}  {DEST.stat().st_size // 1024} KB")
print(f"  clear {clear / total:.1%}  solid {solid / total:.1%}  partial {(total - clear - solid) / total:.1%}")
print(f"  stray opaque near-white pixels: {stray}")
