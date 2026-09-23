#!/usr/bin/env python3
"""Refined-pixel engine v2.

Camera: slight south-looking-north 2.5D (Soul Knight room view).
You see wall FACE in the upper band, FLOOR in the lower band,
and furniture as top + front (+ optional right side). Light from ceiling.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
PREVIEW = ROOT / "public" / "preview"

INK = (34, 30, 38, 255)
WHITE = (250, 246, 238, 255)
TRANS = (0, 0, 0, 0)
SHADOW = (22, 18, 26, 110)
SHADOW_D = (16, 14, 20, 160)

PAL = {
    "ink": INK,
    "white": WHITE,
    "paper": (244, 238, 226, 255),
    "metal": (168, 174, 186, 255),
    "metal_d": (110, 116, 128, 255),
    "metal_hi": (214, 220, 228, 255),
    "skin": (236, 198, 168, 255),
    "skin_f": (246, 216, 192, 255),
    "skin_d": (210, 164, 132, 255),
    "eye": (28, 24, 32, 255),
    "blush": (232, 140, 148, 255),
    "green": (46, 110, 78, 255),
    "green_d": (28, 72, 50, 255),
    "green_hi": (90, 168, 110, 255),
}


def clamp(n: int) -> int:
    return 0 if n < 0 else 255 if n > 255 else n


def shade(c, amt: int):
    r, g, b, a = c[0], c[1], c[2], c[3] if len(c) > 3 else 255
    return (clamp(r + amt), clamp(g + amt), clamp(b + amt), a)


def mix(a, b, t: float):
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
        int((a[3] if len(a) > 3 else 255) + ((b[3] if len(b) > 3 else 255) - (a[3] if len(a) > 3 else 255)) * t),
    )


def new(w: int, h: int, fill=None) -> Image.Image:
    return Image.new("RGBA", (w, h), fill if fill is not None else TRANS)


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    try:
        print(f"  wrote {path.relative_to(ROOT)}")
    except ValueError:
        print(f"  wrote {path}")


def blit(dst: Image.Image, src: Image.Image, x: int, y: int):
    dst.paste(src, (x, y), src)


def rect(d: ImageDraw.ImageDraw, box, c):
    d.rectangle(box, fill=c)


def hline(d, x0, x1, y, c):
    if x1 < x0:
        x0, x1 = x1, x0
    rect(d, [x0, y, x1, y], c)


def vline(d, x, y0, y1, c):
    if y1 < y0:
        y0, y1 = y1, y0
    rect(d, [x, y0, x, y1], c)


def box1(d, x0, y0, x1, y1, fill, edge=INK):
    rect(d, [x0, y0, x1, y1], edge)
    if x1 - x0 > 1 and y1 - y0 > 1:
        rect(d, [x0 + 1, y0 + 1, x1 - 1, y1 - 1], fill)


def dither(d, x0, y0, x1, y1, c, step=3, phase=0):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x + y + phase) % step == 0:
                d.point((x, y), fill=c)


def noise(d, x0, y0, x1, y1, c, every=11, phase=0):
    """Sparse material noise — not a grid."""
    n = 0
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            n += 1
            if ((x * 13 + y * 7 + phase) % every) == 0:
                d.point((x, y), fill=c)


def oval_shadow(d, cx, cy, rx=8, ry=2, col=SHADOW, solid=False):
    for dy in range(-ry, ry + 1):
        for dx in range(-rx, rx + 1):
            if (dx * dx) * (ry * ry) + (dy * dy) * (rx * rx) <= rx * rx * ry * ry:
                if solid or (dx + dy) % 2 == 0:
                    d.point((cx + dx, cy + dy), fill=col)


def solid_shadow(d, cx, cy, rx=8, ry=2, col=SHADOW_D):
    oval_shadow(d, cx, cy, rx, ry, col, solid=True)


def drop_shadow(d, x, y, w, h, ox=2, oy=3, col=SHADOW):
    """Dithered contact shadow south-east of a volume."""
    for yy in range(y + oy, y + h + oy):
        for xx in range(x + ox, x + w + ox):
            if (xx + yy) % 2 == 0:
                d.point((xx, yy), fill=col)


def light_pool(d, cx, cy, rx, ry, col, step=2):
    """Soft elliptical wash on the floor under a ceiling can."""
    for dy in range(-ry, ry + 1):
        for dx in range(-rx, rx + 1):
            if (dx * dx) * (ry * ry) + (dy * dy) * (rx * rx) <= rx * rx * ry * ry:
                if (dx + dy) % step == 0:
                    d.point((cx + dx, cy + dy), fill=col)


def prism(d, x, y, w, h, thick, top, front, side=None, edge=INK, lip="south"):
    """2.5D box. top + south riser + right slab. Riser must be thick enough to read."""
    side = side or shade(front, -22)
    hi = shade(top, 26)
    bevel = shade(front, 18)
    # contact shadow
    if lip == "south":
        drop_shadow(d, x, y + h, w + 2, thick + 1, ox=2, oy=2)
    rect(d, [x, y, x + w - 1, y + h - 1], top)
    if lip == "east":
        rect(d, [x + w, y, x + w + thick - 1, y + h - 1], front)
        hline(d, x, x + w + thick - 1, y, edge)
        hline(d, x, x + w + thick - 1, y + h - 1, edge)
        vline(d, x, y, y + h - 1, edge)
        vline(d, x + w - 1, y, y + h - 1, edge)
        vline(d, x + w + thick - 1, y, y + h - 1, edge)
        if w > 3:
            hline(d, x + 1, x + w - 2, y + 1, hi)
            vline(d, x + 1, y + 1, y + h - 2, hi)
    elif lip == "west":
        drop_shadow(d, x - thick, y + h - 2, w + thick, 4, ox=1, oy=2)
        rect(d, [x - thick, y, x - 1, y + h - 1], front)
        if thick > 3:
            vline(d, x - 1, y + 1, y + h - 2, bevel)
        hline(d, x - thick, x + w - 1, y, edge)
        hline(d, x - thick, x + w - 1, y + h - 1, edge)
        vline(d, x - thick, y, y + h - 1, edge)
        vline(d, x, y, y + h - 1, edge)
        vline(d, x + w - 1, y, y + h - 1, edge)
        if w > 3:
            hline(d, x + 1, x + w - 2, y + 1, hi)
    else:
        # two-tone riser so it is a FACE, not a stroke
        rect(d, [x, y + h, x + w - 1, y + h + thick - 1], front)
        if thick > 3:
            hline(d, x + 1, x + w - 2, y + h, bevel)
            hline(d, x + 1, x + w - 2, y + h + 1, bevel)
            dither(d, x + 1, y + h + 2, x + w - 2, y + h + thick - 2, shade(front, -12), 5)
        sw = 4 if w > 20 else (3 if w > 10 else 2)
        rect(d, [x + w, y + 1, x + w + sw - 1, y + h + thick - 1], side)
        hline(d, x, x + w + sw - 1, y, edge)
        hline(d, x, x + w - 1, y + h - 1, edge)
        hline(d, x, x + w + sw - 1, y + h + thick - 1, edge)
        vline(d, x, y, y + h + thick - 1, edge)
        vline(d, x + w - 1, y, y + h + thick - 1, edge)
        vline(d, x + w + sw - 1, y + 1, y + h + thick - 1, edge)
        if w > 4 and h > 2:
            hline(d, x + 1, x + w - 2, y + 1, hi)
            vline(d, x + 1, y + 1, y + h - 2, hi)


def empty_pad(d, x, y, w, h, fill, edge):
    """Vacant item bay — faint field + corner ticks, not a stamped UI slot."""
    rect(d, [x, y, x + w - 1, y + h - 1], fill)
    # only corners, so the desk still reads as one slab
    d.point((x, y), fill=edge)
    d.point((x + w - 1, y), fill=edge)
    d.point((x, y + h - 1), fill=edge)
    d.point((x + w - 1, y + h - 1), fill=edge)
    d.point((x + 1, y), fill=edge)
    d.point((x, y + 1), fill=edge)
    d.point((x + w - 2, y), fill=edge)
    d.point((x + w - 1, y + 1), fill=edge)
    d.point((x + 1, y + h - 1), fill=edge)
    d.point((x, y + h - 2), fill=edge)
    d.point((x + w - 2, y + h - 1), fill=edge)
    d.point((x + w - 1, y + h - 2), fill=edge)


def wall_face(d, x0, y0, x1, y1, fill, lip=5, lip_c=None, ink=INK):
    """Tall wall FACE + south lip (wall thickness seen from above)."""
    lip_c = lip_c or shade(fill, -28)
    rect(d, [x0, y0, x1, y1], fill)
    hline(d, x0, x1, y0, shade(fill, -18))
    hline(d, x0, x1, y0 + 1, shade(fill, 14))
    # panel seams + ambient occlusion so the wall is not a flat fill
    for x in range(x0 + 32, x1, 40):
        vline(d, x, y0 + 2, y1 - 1, shade(fill, -10))
    dither(d, x0, y1 - 6, x1, y1, shade(fill, -16), 4)
    rect(d, [x0, y1 + 1, x1, y1 + lip], lip_c)
    hline(d, x0, x1, y1, ink)
    hline(d, x0, x1, y1 + lip, ink)
    hline(d, x0, x1, y1 + lip + 1, shade(lip_c, -30))


def fluorescent(d, x, y, w, glow=None):
    """Long office tube + housing."""
    glow = glow or (255, 244, 210, 255)
    prism(d, x, y, w, 3, 3, WHITE, (186, 186, 190, 255), (150, 150, 156, 255))
    hline(d, x + 4, x + w - 5, y + 1, glow)
    dither(d, x + 2, y + 5, x + w - 3, y + 9, glow, 4)


def downlight(d, cx, y, glow=None):
    """Recessed ceiling can."""
    glow = glow or (255, 236, 200, 255)
    box1(d, cx - 6, y, cx + 6, y + 5, shade(glow, -40), (120, 110, 96, 255))
    rect(d, [cx - 3, y + 2, cx + 3, y + 3], glow)
    d.point((cx, y + 2), fill=WHITE)


def marble(d, x0, y0, x1, y1, base, vein, hi=None, every=17):
    """Cream stone: base wash + sparse veins, not a brick grid."""
    hi = hi or shade(base, 18)
    rect(d, [x0, y0, x1, y1], base)
    noise(d, x0, y0, x1, y1, hi, every=every, phase=3)
    noise(d, x0, y0, x1, y1, vein, every=every + 7, phase=9)
    # a few longer veins
    span = max(8, (x1 - x0) // 5)
    y = y0 + 6
    while y < y1 - 2:
        x = x0 + ((y * 17) % max(1, x1 - x0 - span))
        for i in range(span):
            if x + i <= x1 and (i % 2 == 0):
                d.point((x + i, y + (i // 5)), fill=vein)
        y += 11


def wood_planks(d, x0, y0, x1, y1, c1, c2, gap, plank=6):
    """Long boards — not a brick grid."""
    for i, y in enumerate(range(y0, y1 + 1, plank)):
        base = c1 if i % 2 == 0 else c2
        rect(d, [x0, y, x1, min(y + plank - 1, y1)], base)
        hline(d, x0, x1, min(y + plank - 1, y1), gap)
        # rare seams
        seam = x0 + 18 + (i * 23) % max(12, (x1 - x0 - 30))
        vline(d, seam, y, min(y + plank - 2, y1), gap)
        # grain ticks
        if i % 2 == 0:
            dither(d, x0, y + 1, x1, min(y + 1, y1), shade(base, -10), 9, i)


def tile_floor(d, x0, y0, x1, y1, a, b, grout, size=16):
    """Large tiles (lobby / wet room). Keep grout thin."""
    for y in range(y0, y1 + 1, size):
        for x in range(x0, x1 + 1, size):
            c = a if ((x // size) + (y // size)) % 2 == 0 else b
            rect(d, [x, y, min(x + size - 1, x1), min(y + size - 1, y1)], c)
            hline(d, x, min(x + size - 1, x1), y, grout)
            vline(d, x, y, min(y + size - 1, y1), grout)


def carpet(d, x0, y0, x1, y1, c1, c2, grout=None, size=14):
    for y in range(y0, y1 + 1, size):
        for x in range(x0, x1 + 1, size):
            c = c1 if ((x // size) + (y // size)) % 2 == 0 else c2
            rect(d, [x, y, min(x + size - 1, x1), min(y + size - 1, y1)], c)
            if grout:
                hline(d, x, min(x + size - 1, x1), y, grout)
                vline(d, x, y, min(y + size - 1, y1), grout)
    noise(d, x0, y0, x1, y1, shade(c1, -12), every=13)


def outline_sprite(img: Image.Image, ink=INK) -> Image.Image:
    """1px ink around opaque pixels — unified silhouette."""
    w, h = img.size
    out = new(w, h)
    px = img.load()
    op = out.load()

    def opa(x, y):
        return 0 <= x < w and 0 <= y < h and px[x, y][3] > 80

    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 80:
                op[x, y] = px[x, y]
            elif any(opa(x + dx, y + dy) for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                op[x, y] = ink
    return out


def zoom(img: Image.Image, n: int = 3) -> Image.Image:
    return img.resize((img.width * n, img.height * n), Image.Resampling.NEAREST)


def tiny_text(d, x, y, text: str, color):
    G = GLYPHS
    cx = x
    for ch in text:
        bits = G.get(ch)
        if bits is None:
            cx += 4
            continue
        for row, rowbits in enumerate(bits):
            for col, bit in enumerate(rowbits):
                if bit == "1":
                    d.point((cx + col, y + row), fill=color)
        cx += max(4, len(bits[0]) + 1)


def letter_3d(d, x, y, text, face, depth=None):
    """Block letters with 1px south-east thickness."""
    depth = depth or shade(face, -40)
    tiny_text(d, x + 1, y + 1, text, depth)
    tiny_text(d, x, y, text, face)


GLYPHS = {
    "t": ["111", "010", "010", "010", "010"],
    "c": ["011", "100", "100", "100", "011"],
    "T": ["111", "010", "010", "010", "010"],
    "C": ["011", "100", "100", "100", "011"],
    "A": ["010", "101", "111", "101", "101"],
    "E": ["111", "100", "111", "100", "111"],
    "L": ["100", "100", "100", "100", "111"],
    "V": ["101", "101", "101", "101", "010"],
    "P": ["110", "101", "110", "100", "100"],
    "M": ["101", "111", "111", "101", "101"],
    "R": ["110", "101", "110", "101", "101"],
    "O": ["010", "101", "101", "101", "010"],
    "H": ["101", "101", "111", "101", "101"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["110", "001", "010", "100", "111"],
    "3": ["111", "001", "011", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    "G": ["011", "100", "101", "101", "011"],
    "Y": ["101", "101", "010", "010", "010"],
    "N": ["1001", "1101", "1011", "1001", "1001"],
    "I": ["111", "010", "010", "010", "111"],
    "X": ["101", "010", "010", "010", "101"],
    "F": ["111", "100", "110", "100", "100"],
    "S": ["011", "100", "010", "001", "110"],
    "U": ["101", "101", "101", "101", "011"],
    "B": ["110", "101", "110", "101", "110"],
    "K": ["101", "110", "100", "110", "101"],
    "W": ["101", "101", "111", "111", "101"],
    "D": ["110", "101", "101", "101", "110"],
    " ": ["000", "000", "000", "000", "000"],
    "-": ["000", "000", "111", "000", "000"],
    ".": ["000", "000", "000", "000", "010"],
}
