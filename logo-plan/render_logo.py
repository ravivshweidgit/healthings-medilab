"""Soft open book + heart with explicitly rounded tip (circle cap)."""
from PIL import Image, ImageDraw
import math

W, H = 1024, 1024
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
BLACK = (17, 17, 17)
WHITE = (255, 255, 255)

d.rounded_rectangle([120, 160, 500, 820], radius=48, fill=BLACK)
d.rounded_rectangle([524, 160, 904, 820], radius=48, fill=BLACK)
d.ellipse([492, 800, 532, 860], fill=BLACK)
d.rounded_rectangle([500, 180, 524, 800], radius=10, fill=WHITE)


def classic_heart(cx, cy, size):
    pts = []
    for i in range(0, 360):
        t = math.radians(i)
        x = 16 * math.sin(t) ** 3
        y = -(
            13 * math.cos(t)
            - 5 * math.cos(2 * t)
            - 2 * math.cos(3 * t)
            - math.cos(4 * t)
        )
        pts.append((x, y))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    scale = size / max(maxx - minx, maxy - miny)
    mid_x = (minx + maxx) / 2
    mid_y = (miny + maxy) / 2
    out = [(cx + (x - mid_x) * scale, cy + (y - mid_y) * scale) for x, y in pts]
    tip = max(out, key=lambda p: p[1])
    return out, tip


heart, tip = classic_heart(310, 490, 300)
d.polygon(heart, fill=WHITE)

# Round tip with a LARGE disk so the V is fully inside and the visible tip is circular.
R = 72
tip_x, tip_y = tip
cy_c = tip_y - R + 8  # bottom of circle slightly past old tip
d.ellipse([tip_x - R, cy_c - R, tip_x + R, cy_c + R], fill=WHITE)

# Asclepius
ax, ay = 714, 430
d.rounded_rectangle([ax - 10, ay, ax + 10, ay + 280], radius=10, fill=WHITE)
d.ellipse([ax - 18, ay - 18, ax + 18, ay + 18], fill=WHITE)
snake = []
for i in range(0, 101):
    t = i / 100
    y = ay + 30 + t * 230
    x = ax + math.sin(t * math.pi * 2.2) * 38
    snake.append((x, y))
for i in range(len(snake) - 1):
    d.line([snake[i], snake[i + 1]], fill=WHITE, width=22)
for p in snake:
    d.ellipse([p[0] - 11, p[1] - 11, p[0] + 11, p[1] + 11], fill=WHITE)
hx, hy = snake[0]
d.ellipse([hx - 16, hy - 12, hx + 10, hy + 12], fill=WHITE)

out = r"c:\projects\healthings-medilab\logo-plan\book-soft-final.png"
img.save(out, "PNG")
print("saved", out, "tip", tip, "R", R)
