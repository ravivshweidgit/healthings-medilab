"""Build a sharp full-bleed clinic-portal plate for film (no fake desk paste).

The 1024x508 share screenshot is too soft to survive a perspective warp onto a
tilted monitor. Opus finishing review: cut full-bleed for the thesis beat;
keep Swiss desks as establishing plates with their original screens.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "assets" / "illustrations"
STILLS = ROOT / "assets" / "screens" / "stills"
PORTAL = STILLS / "clinic-portal-dark-dashboard.png"
OUT = ART / "clinic-portal-dark-16x9.jpg"
OUT_PNG = ART / "clinic-portal-dark-16x9.png"


def upscale_lanczos(bgr: np.ndarray, scale: float) -> np.ndarray:
    if scale <= 1.01:
        return bgr
    h, w = bgr.shape[:2]
    return cv2.resize(
        bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LANCZOS4
    )


def unsharp(bgr: np.ndarray, amount: float = 0.55, sigma: float = 1.1) -> np.ndarray:
    blur = cv2.GaussianBlur(bgr, (0, 0), sigma)
    out = cv2.addWeighted(bgr, 1 + amount, blur, -amount, 0)
    return np.clip(out, 0, 255).astype(np.uint8)


def main() -> None:
    if not PORTAL.is_file():
        raise SystemExit(f"Missing {PORTAL}")
    ui = cv2.imread(str(PORTAL), cv2.IMREAD_COLOR)
    if ui is None:
        raise SystemExit("Failed to read portal")

    # Target: fill width of 1920 with letterbox bars — never stretch aspect.
    # Upscale so the warp/fit is mostly a *down*sample into the plate.
    target_w = 1840
    scale = target_w / ui.shape[1]
    # 2-step upsample then mild sharpen — better than one big LANCZOS jump
    step = min(2.0, scale)
    hi = upscale_lanczos(ui, step)
    if scale / step > 1.01:
        hi = upscale_lanczos(hi, scale / step)
    hi = unsharp(hi, amount=0.45, sigma=1.0)

    # Lift crushed blacks slightly so it reads as an emissive panel, not a hole
    hi_f = hi.astype(np.float32)
    hi_f = hi_f * 0.92 + 18.0  # floor ~18
    hi = np.clip(hi_f, 0, 255).astype(np.uint8)

    plate = np.zeros((1080, 1920, 3), dtype=np.uint8)
    # slate surround matching dark cards
    plate[:] = (30, 33, 38)  # BGR
    ph, pw = hi.shape[:2]
    # Fit into safe area
    fit = min(1840 / pw, 920 / ph)
    if fit < 0.999:
        hi = cv2.resize(hi, (int(pw * fit), int(ph * fit)), interpolation=cv2.INTER_AREA)
        ph, pw = hi.shape[:2]
    x0 = (1920 - pw) // 2
    y0 = (1080 - ph) // 2 + 18
    plate[y0 : y0 + ph, x0 : x0 + pw] = hi

    # Soft vignette on surround only
    yy, xx = np.ogrid[:1080, :1920]
    r = np.sqrt(((xx - 960) / 960) ** 2 + ((yy - 540) / 540) ** 2)
    vig = np.clip(1.0 - 0.22 * np.clip(r - 0.75, 0, 1) / 0.5, 0.78, 1.0)
    plate = (plate.astype(np.float32) * vig[..., None]).clip(0, 255).astype(np.uint8)

    # Thin inner frame around the UI — reads as a glass edge
    cv2.rectangle(
        plate, (x0 - 1, y0 - 1), (x0 + pw, y0 + ph), (55, 58, 62), 1, cv2.LINE_AA
    )

    cv2.imwrite(str(OUT_PNG), plate)  # keep lossless master
    # JPEG for pipeline consumers that expect .jpg
    rgb = cv2.cvtColor(plate, cv2.COLOR_BGR2RGB)
    im = Image.fromarray(rgb)
    draw = ImageDraw.Draw(im)
    fonts = ROOT / "assets" / "fonts"
    font_path = next(
        (fonts / n for n in ("Montserrat-Bold.ttf", "Montserrat-SemiBold.ttf") if (fonts / n).is_file()),
        None,
    )
    try:
        font = ImageFont.truetype(str(font_path), 28) if font_path else ImageFont.load_default()
    except OSError:
        font = ImageFont.load_default()
    draw.text((80, 48), "HEALTHINGS.AI", fill=(243, 245, 247), font=font)
    im.save(OUT, quality=95, subsampling=0, optimize=True)
    print(f"OK {OUT.name} ({OUT.stat().st_size // 1024} KB) from portal {ui.shape[1]}x{ui.shape[0]}")
    print(f"OK {OUT_PNG.name} lossless")
    print("NOTE: desk composites retired — use this plate for clinic thesis / sees-week.")


if __name__ == "__main__":
    main()
