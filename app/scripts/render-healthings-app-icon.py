"""Render HEALTHINGS.AI app icon (1024) from HealthingsMark geometry."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
# Safe zone for adaptive icons (~66% center)
PAD = 72

CHROME = (184, 190, 198)
WHITE = (255, 255, 255)
TILE_TOP = (255, 255, 255)
TILE_BOT = (243, 245, 247)
HEART_TOP = (229, 57, 53)
HEART_BOT = (183, 28, 28)
TEAL = (0, 168, 192)

HEART_CUBICS = [
    (40.0, 62.0),
    (40.0, 62.0, 16.0, 46.0, 16.0, 32.0),
    (16.0, 24.5, 21.5, 19.0, 28.5, 19.0),
    (33.2, 19.0, 37.2, 21.6, 40.0, 25.5),
    (42.8, 21.6, 46.8, 19.0, 51.5, 19.0),
    (58.5, 19.0, 64.0, 24.5, 64.0, 32.0),
    (64.0, 46.0, 40.0, 62.0, 40.0, 62.0),
]


def cubic(p0, p1, p2, p3, t: float):
    u = 1 - t
    return (
        u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
        u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
    )


def sample_heart(ox, oy, scale, steps=36):
    pts = []
    cur = (HEART_CUBICS[0][0], HEART_CUBICS[0][1])
    for seg in HEART_CUBICS[1:]:
        c1, c2, end = (seg[0], seg[1]), (seg[2], seg[3]), (seg[4], seg[5])
        for i in range(steps + 1):
            x, y = cubic(cur, c1, c2, end, i / steps)
            pts.append((ox + x * scale, oy + y * scale))
        cur = end
    return pts


def rounded_rect(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def main():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Outer glass tile
    outer = (PAD, PAD, SIZE - PAD, SIZE - PAD)
    # Gradient tile via lines
    tile = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile)
    x0, y0, x1, y1 = outer
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        r = int(TILE_TOP[0] * (1 - t) + TILE_BOT[0] * t)
        g = int(TILE_TOP[1] * (1 - t) + TILE_BOT[1] * t)
        b = int(TILE_TOP[2] * (1 - t) + TILE_BOT[2] * t)
        td.line([(x0, y), (x1, y)], fill=(r, g, b, 255))
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(outer, radius=180, fill=255)
    tile.putalpha(mask)
    img = Image.alpha_composite(img, tile)
    d = ImageDraw.Draw(img)
    rounded_rect(d, outer, 180, outline=CHROME + (255,), width=8)

    # Inner highlight rim
    inner = (PAD + 40, PAD + 40, SIZE - PAD - 40, SIZE - PAD - 40)
    rounded_rect(d, inner, 150, outline=(255, 255, 255, 220), width=5)

    # Heart in mark coords 0..80 → map into content box
    content = PAD + 100
    scale = (SIZE - 2 * content) / 80
    ox = content
    oy = content
    poly = sample_heart(ox, oy, scale)

    mask_h = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask_h).polygon(poly, fill=255)
    ys = [p[1] for p in poly]
    y_min, y_max = min(ys), max(ys)
    grad = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    h = max(1, int(y_max - y_min))
    for i in range(h + 1):
        t = i / h
        r = int(HEART_TOP[0] * (1 - t) + HEART_BOT[0] * t)
        g = int(HEART_TOP[1] * (1 - t) + HEART_BOT[1] * t)
        b = int(HEART_TOP[2] * (1 - t) + HEART_BOT[2] * t)
        y = int(y_min + i)
        gd.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))
    heart = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    heart.paste(grad, mask=mask_h)
    img = Image.alpha_composite(img, heart)
    d = ImageDraw.Draw(img)

    # Teal ECG across heart (mark path scaled)
    # M14 40 H26 L30 28 L35 52 L40 34 L44 40 H66
    def m(x, y):
        return (ox + x * scale, oy + y * scale)

    ecg = [m(14, 40), m(26, 40), m(30, 28), m(35, 52), m(40, 34), m(44, 40), m(66, 40)]
    d.line(ecg, fill=TEAL + (255,), width=max(8, int(3.2 * scale)), joint="curve")
    # soft white highlight under ECG
    d.line(ecg, fill=(255, 255, 255, 100), width=max(3, int(1.1 * scale)), joint="curve")

    root = Path(r"c:\projects\healthings-medilab")
    outs = [
        root / "app/assets/icon.png",
        root / "app/assets/adaptive-icon.png",
        root / "app/assets/splash-icon.png",
        root / "app/assets/branding/healthings_mark.png",
        root / "website/assets/icon.png",
    ]
    for o in outs:
        img.save(o, format="PNG")
        print("wrote", o)

    # Favicon 48
    fav = img.resize((48, 48), Image.Resampling.LANCZOS)
    fav.save(root / "app/assets/favicon.png", format="PNG")
    print("wrote favicon 48")

    # Splash: white bg + centered mark (slightly inset)
    splash = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    mark = img.resize((700, 700), Image.Resampling.LANCZOS)
    splash.paste(mark, ((SIZE - 700) // 2, (SIZE - 700) // 2), mark)
    splash.save(root / "app/assets/splash-icon.png", format="PNG")
    print("wrote splash")


if __name__ == "__main__":
    main()
