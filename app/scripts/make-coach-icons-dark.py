"""Derive dark-theme variants of Michal's Quick Start step-5 crops.

The crops arrived flattened out of a JPG mockup: an opaque near-white page square,
a pale mint plate, and a teal glyph. On dark that square is a white patch, so each
variant drops the surround to alpha 0 and remaps the remaining ink to dark tokens:

    card icons  plate -> iconTintBlue #233252, glyph -> accentBlue #8E9BFF
    header      teal disc -> brandNavy #3E6EA5, glyph stays white

Run: python app/scripts/make-coach-icons-dark.py
"""

from collections import deque
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "assets" / "quick-start"

PLATE = (0x23, 0x32, 0x52)  # darkColors.iconTintBlue
GLYPH = (0x8E, 0x9B, 0xFF)  # darkColors.accentBlue
NAVY = (0x3E, 0x6E, 0xA5)  # darkColors.brandNavy — white on it clears AA

WASH_LUMA = 244.0  # measured mint plate
TEAL_LUMA = 122.0  # NEXT_BLUE_DEEP #0BA5BE


def luma(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def surround_mask(im):
    """Flood the opaque page white inward from the border.

    Colour alone cannot separate it from the header's white glyph, and the plate
    edge blocks the fill on both tests: it is darker than 246 and carries a cyan
    cast wider than 8.
    """
    w, h = im.size
    px = im.load()
    mask = [[0] * w for _ in range(h)]
    q = deque()

    def paintable(x, y):
        r, g, b, _ = px[x, y]
        return luma((r, g, b)) > 246 and (max(r, g, b) - min(r, g, b)) <= 8

    for x in range(w):
        for y in (0, h - 1):
            if not mask[y][x] and paintable(x, y):
                mask[y][x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not mask[y][x] and paintable(x, y):
                mask[y][x] = 1
                q.append((x, y))

    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not mask[ny][nx] and paintable(nx, ny):
                mask[ny][nx] = 1
                q.append((nx, ny))
    return mask


def fit_circle(points):
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    dists = sorted(((p[0] - cx) ** 2 + (p[1] - cy) ** 2) ** 0.5 for p in points)
    return cx, cy, dists[int(len(dists) * 0.99)]


def circle_alpha(size, cx, cy, radius):
    """Alpha from the fitted disc, not from the flood fill.

    The header crop carries a white ring the fill cannot cross, which survived as a
    halo. Both shapes are circles, so the geometry gives a crisp anti-aliased rim.
    """
    w, h = size
    a = Image.new("L", size)
    data = []
    for y in range(h):
        for x in range(w):
            d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
            data.append(round(255 * min(max(radius + 0.5 - d, 0.0), 1.0)))
    a.putdata(data)
    return a


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def convert_card(src, dst):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    mask = surround_mask(im)
    cx, cy, radius = fit_circle(
        [(x + 0.5, y + 0.5) for y in range(h) for x in range(w) if not mask[y][x]]
    )
    out = Image.new("RGBA", im.size)
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            t = (WASH_LUMA - luma((r, g, b))) / (WASH_LUMA - TEAL_LUMA)
            if mask[y][x]:
                t = 0.0
            op[x, y] = (*lerp(PLATE, GLYPH, min(max(t, 0.0), 1.0)), 255)
    out.putalpha(circle_alpha(im.size, cx, cy, radius))
    out.save(dst)


def convert_header(src, dst):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    mask = surround_mask(im)

    sats, lumas, teal_px = [], [], []
    for y in range(h):
        for x in range(w):
            if mask[y][x]:
                continue
            r, g, b, _ = px[x, y]
            s = max(r, g, b) - min(r, g, b)
            sats.append(s)
            if s > 40:
                lumas.append(luma((r, g, b)))
                teal_px.append((x + 0.5, y + 0.5))
    sats.sort()
    sat_ref = max(sats[int(len(sats) * 0.9)], 1)
    disc_luma = sum(lumas) / len(lumas)
    cx, cy, radius = fit_circle(teal_px)

    out = Image.new("RGBA", im.size)
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            f = min((max(r, g, b) - min(r, g, b)) / sat_ref, 1.0)
            shade = min(max(luma((r, g, b)) / disc_luma, 0.82), 1.18)
            tinted = tuple(min(round(c * shade), 255) for c in NAVY)
            op[x, y] = (*lerp((255, 255, 255), tinted, f), 255)
    out.putalpha(circle_alpha(im.size, cx, cy, radius))
    out.save(dst)


def main():
    for name in ("coach-person-heart", "coach-refresh", "coach-lotus"):
        convert_card(ASSETS / f"{name}.png", ASSETS / f"{name}-dark.png")
        print("wrote", f"{name}-dark.png")
    convert_header(
        ASSETS / "coach-header-person-sparkle.png",
        ASSETS / "coach-header-person-sparkle-dark.png",
    )
    print("wrote coach-header-person-sparkle-dark.png")


if __name__ == "__main__":
    main()
