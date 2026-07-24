"""Render HEALTHINGS.AI brand wordmark (2026 lockup) — light and dark variants.

    python render-healthings-ai-wordmark.py          # both
    python render-healthings-ai-wordmark.py dark     # dark only

The dark variant (prompt96) keeps the exact same geometry so the Quick Start
wordmark crop stays valid; only the palette changes and the background is
transparent so it sits on any dark surface.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

NAVY = (26, 43, 74)
TEAL = (0, 168, 192)
HEART_TOP = (229, 57, 53)  # #E53935
HEART_BOT = (183, 28, 28)  # #B71C1C
BG = (255, 255, 255)

# Dark palette: wordmark at textPrimary, a brighter cyan and heart so neither
# muddies on near-black, tagline one step down so the lockup keeps its hierarchy.
DARK_INK = (242, 243, 245)  # #F2F3F5
DARK_TAGLINE = (201, 206, 214)  # #C9CED6
DARK_TEAL = (38, 198, 218)  # #26C6DA
DARK_HEART_TOP = (255, 107, 107)  # #FF6B6B
DARK_HEART_BOT = (211, 47, 47)  # #D32F2F

BOLD = r"C:\Windows\Fonts\arialbd.ttf"
REG = r"C:\Windows\Fonts\arial.ttf"

# Same geometric heart as HealthingsMark (viewBox 0..80)
HEART_CUBICS = [
    (40.0, 62.0),
    (40.0, 62.0, 16.0, 46.0, 16.0, 32.0),
    (16.0, 24.5, 21.5, 19.0, 28.5, 19.0),
    (33.2, 19.0, 37.2, 21.6, 40.0, 25.5),
    (42.8, 21.6, 46.8, 19.0, 51.5, 19.0),
    (58.5, 19.0, 64.0, 24.5, 64.0, 32.0),
    (64.0, 46.0, 40.0, 62.0, 40.0, 62.0),
]


def draw_text_tracked(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    tracking: float,
) -> int:
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        bbox = draw.textbbox((0, 0), ch, font=font)
        x += (bbox[2] - bbox[0]) + tracking
    return x - xy[0]


def cubic(p0, p1, p2, p3, t: float) -> tuple[float, float]:
    u = 1 - t
    return (
        u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
        u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
    )


def sample_mark_heart(ox: float, oy: float, scale: float, steps: int = 28) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    start = HEART_CUBICS[0]
    cur = (start[0], start[1])
    for seg in HEART_CUBICS[1:]:
        c1 = (seg[0], seg[1])
        c2 = (seg[2], seg[3])
        end = (seg[4], seg[5])
        for i in range(steps + 1):
            x, y = cubic(cur, c1, c2, end, i / steps)
            pts.append((ox + x * scale, oy + y * scale))
        cur = end
    return pts


def paint_heart(
    img: Image.Image,
    ox: float,
    oy: float,
    scale: float,
    top: tuple[int, int, int],
    bot: tuple[int, int, int],
) -> Image.Image:
    poly = sample_mark_heart(ox, oy, scale)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    ys = [p[1] for p in poly]
    y0, y1 = min(ys), max(ys)
    grad = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    h = max(1, int(y1 - y0))
    for i in range(h + 1):
        t = i / h
        r = int(top[0] * (1 - t) + bot[0] * t)
        g = int(top[1] * (1 - t) + bot[1] * t)
        b = int(top[2] * (1 - t) + bot[2] * t)
        y = int(y0 + i)
        gd.line([(0, y), (img.width, y)], fill=(r, g, b, 255))
    heart = Image.new("RGBA", img.size, (0, 0, 0, 0))
    heart.paste(grad, mask=mask)
    return Image.alpha_composite(img, heart)


def render(dark: bool) -> Image.Image:
    W, H = 1400, 420
    ink = DARK_INK if dark else NAVY
    tagline_ink = DARK_TAGLINE if dark else NAVY
    teal = DARK_TEAL if dark else TEAL
    heart_top = DARK_HEART_TOP if dark else HEART_TOP
    heart_bot = DARK_HEART_BOT if dark else HEART_BOT

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0) if dark else (*BG, 255))
    draw = ImageDraw.Draw(img)

    title_font = ImageFont.truetype(BOLD, 92)
    ai_font = ImageFont.truetype(BOLD, 92)
    tag_font = ImageFont.truetype(REG, 34)

    tracking = 4.5
    x0, y0 = 64, 78
    health_w = 0
    for ch in "HEALTHINGS":
        bbox = draw.textbbox((0, 0), ch, font=title_font)
        health_w += (bbox[2] - bbox[0]) + tracking
    health_w -= tracking

    draw_text_tracked(draw, "HEALTHINGS", (x0, y0), title_font, ink, tracking)

    ecg_x = x0 + health_w + 28
    baseline = y0 + 58
    pts = [
        (ecg_x, baseline),
        (ecg_x + 28, baseline),
        (ecg_x + 42, baseline - 34),
        (ecg_x + 56, baseline + 38),
        (ecg_x + 74, baseline - 62),
        (ecg_x + 92, baseline + 18),
        (ecg_x + 106, baseline),
        (ecg_x + 128, baseline),
    ]
    draw.line(pts, fill=teal, width=9, joint="curve")
    r = 4
    for px_, py in (pts[0], pts[-1]):
        draw.ellipse((px_ - r, py - r, px_ + r, py + r), fill=teal)

    ai_x = ecg_x + 128 + 20
    draw.text((ai_x, y0), ".AI", font=ai_font, fill=ink)

    heart_scale = 1.45
    hx = x0 - 8
    hy = 205
    img = paint_heart(img, hx, hy, heart_scale, heart_top, heart_bot)
    draw = ImageDraw.Draw(img)

    tag = "Personalized metabolic OS with your licensed nutritionist"
    draw.text((hx + 118, hy + 32), tag, font=tag_font, fill=tagline_ink)

    px = img.load()
    l, t, r2, b = W, H, 0, 0

    def is_bg(c: tuple[int, int, int, int]) -> bool:
        if dark:
            return c[3] == 0
        return abs(c[0] - BG[0]) < 8 and abs(c[1] - BG[1]) < 8 and abs(c[2] - BG[2]) < 8

    for y in range(H):
        for x in range(W):
            if not is_bg(px[x, y]):
                l = min(l, x)
                t = min(t, y)
                r2 = max(r2, x)
                b = max(b, y)
    pad = 36
    crop = img.crop((max(0, l - pad), max(0, t - pad), min(W, r2 + 1 + pad), min(H, b + 1 + pad)))
    # The light lockup ships opaque, as it always has; dark keeps its alpha so it
    # can sit on the page background or a card.
    return crop if dark else crop.convert("RGB")


LIGHT_OUTS = [
    Path(r"c:\projects\healthings-medilab\app\assets\branding\healthings_wordmark.png"),
    Path(r"c:\projects\healthings-medilab\app\assets\brand-logo.png"),
    Path(r"c:\projects\healthings-medilab\website\help\healthings-wordmark.png"),
]

DARK_OUTS = [
    Path(r"c:\projects\healthings-medilab\app\assets\branding\healthings_wordmark_dark.png"),
    Path(r"c:\projects\healthings-medilab\app\assets\brand-logo-dark.png"),
]


def main() -> None:
    which = (sys.argv[1] if len(sys.argv) > 1 else "both").lower()
    jobs = []
    if which in ("both", "light"):
        jobs.append((False, LIGHT_OUTS))
    if which in ("both", "dark"):
        jobs.append((True, DARK_OUTS))
    for dark, outs in jobs:
        crop = render(dark)
        for o in outs:
            crop.save(o, format="PNG")
            print("wrote", o, crop.size)


if __name__ == "__main__":
    main()
