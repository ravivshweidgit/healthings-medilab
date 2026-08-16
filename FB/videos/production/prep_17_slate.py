"""One-shot prep for clip 17 remaster polish: grade photos, lockup, meters."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ART = Path(__file__).resolve().parent.parent / "assets" / "illustrations"
STILLS = Path(__file__).resolve().parent.parent / "assets" / "screens" / "stills"
FONTS = Path(__file__).resolve().parent.parent / "assets" / "fonts"

font_path = None
for name in ("Montserrat-Bold.ttf", "Montserrat-SemiBold.ttf", "Montserrat-Medium.ttf"):
    p = FONTS / name
    if p.is_file():
        font_path = p
        break


def lockup(img: Image.Image, opacity: float = 0.55) -> Image.Image:
    out = img.convert("RGBA")
    overlay = Image.new("RGBA", out.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    try:
        font = ImageFont.truetype(str(font_path), 42) if font_path else ImageFont.load_default()
    except OSError:
        font = ImageFont.load_default()
    fill = (243, 245, 247, int(255 * opacity))
    draw.text((80, 48), "HEALTHINGS.AI", font=font, fill=fill)
    return Image.alpha_composite(out, overlay).convert("RGB")


def grade(
    img: Image.Image,
    *,
    brightness: float = 0.82,
    contrast: float = 1.05,
    color: float = 0.88,
    vignette: float = 0.35,
) -> Image.Image:
    img = ImageEnhance.Brightness(img).enhance(brightness)
    img = ImageEnhance.Contrast(img).enhance(contrast)
    img = ImageEnhance.Color(img).enhance(color)
    arr = np.asarray(img).astype(np.float32)
    arr[..., 0] *= 0.96
    arr[..., 2] *= 1.04
    img = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
    w, h = img.size
    y, x = np.ogrid[:h, :w]
    cx, cy = w / 2, h / 2
    r = ((x - cx) ** 2 / (cx ** 2) + (y - cy) ** 2 / (cy ** 2)) ** 0.5
    factor = 1 - vignette * np.clip((r - 0.55) / 0.7, 0, 1)
    a = np.asarray(img).astype(np.float32)
    a *= factor[..., None]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def main() -> None:
    photos = [
        ("vo-meals-watch-labs.jpg", 0.84, 0.32),
        ("vo-clinic-labs-plan.jpg", 0.80, 0.38),
        ("vo-scale-watch-cgm.jpg", 0.86, 0.30),
        ("vo-clinic-sees-week.jpg", 0.78, 0.40),
    ]
    for name, bri, vig in photos:
        src = ART / name
        g = grade(Image.open(src).convert("RGB"), brightness=bri, vignette=vig)
        g = lockup(g, 0.55)
        out = ART / name.replace(".jpg", "-slate.jpg")
        g.save(out, quality=92, optimize=True)
        print("graded", out.name)

    week = Image.open(ART / "vo-clinic-sees-week-slate.jpg")
    w, h = week.size
    cw, ch = int(w * 0.82), int(h * 0.82)
    left, top = (w - cw) // 2, int((h - ch) * 0.35)
    close = week.crop((left, top, left + cw, top + ch)).resize((w, h), Image.Resampling.LANCZOS)
    close.save(ART / "vo-clinic-close-slate.jpg", quality=92, optimize=True)
    print("close vo-clinic-close-slate.jpg")

    a14 = Image.open(STILLS / "a14-food-log-dark-meters.jpg").convert("RGB")
    mw, _mh = a14.size
    meters = a14.crop((0, 480, mw, 1580))
    W, H = 1080, 2400
    canvas = Image.new("RGB", (W, H), (22, 24, 28))
    target_h = 1700
    scale = target_h / meters.height
    pw = int(meters.width * scale)
    meters = meters.resize((pw, target_h), Image.Resampling.LANCZOS)
    if pw > W:
        x0 = (pw - W) // 2
        meters = meters.crop((x0, 0, x0 + W, target_h))
        pw = W
    canvas.paste(meters, ((W - pw) // 2, 180))
    canvas.save(STILLS / "a4-rules-meters-dark.jpg", quality=93, optimize=True)
    print("rules meters rebuilt from a14")


if __name__ == "__main__":
    main()
