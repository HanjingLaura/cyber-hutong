#!/usr/bin/env python3
"""Refined-pixel primitives: 1px ink, 2.5D prisms, readable tiny props."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
PREVIEW = ROOT / "public" / "preview"

INK = (36, 32, 40, 255)
WHITE = (248, 244, 236, 255)
TRANS = (0, 0, 0, 0)
SHADOW = (22, 20, 26, 120)

PAL = {
    "ink": INK,
    "white": WHITE,
    "paper": (244, 238, 226, 255),
    "metal": (168, 174, 186, 255),
    "metal_d": (110, 116, 128, 255),
    "metal_hi": (210, 216, 224, 255),
    "skin": (236, 198, 168, 255),
    "skin_f": (246, 216, 192, 255),
    "skin_d": (210, 164, 132, 255),
    "eye": (28, 24, 32, 255),
    "blush": (232, 140, 148, 255),
    "green": (46, 110, 78, 255),
    "green_d": (28, 72, 50, 255),
    "green_hi": (90, 168, 110, 255),
}


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


def oval_shadow(d, cx, cy, rx=8, ry=2):
    for dy in range(-ry, ry + 1):
        for dx in range(-rx, rx + 1):
            if (dx * dx) * (ry * ry) + (dy * dy) * (rx * rx) <= rx * rx * ry * ry:
                if (dx + dy) % 2 == 0:
                    d.point((cx + dx, cy + dy), fill=SHADOW)


def prism(d, x, y, w, h, thick, top, front, side=None, edge=INK, lip="south"):
    """2.5D box. lip=south: thick edge at bottom (camera south).
    lip=east: thick edge on the right (aisle to the right of a left-wall desk)."""
    side = side or front
    rect(d, [x, y, x + w - 1, y + h - 1], top)
    if lip == "east":
        rect(d, [x + w, y, x + w + thick - 1, y + h - 1], front)
        hline(d, x, x + w + thick - 1, y, edge)
        hline(d, x, x + w + thick - 1, y + h - 1, edge)
        vline(d, x, y, y + h - 1, edge)
        vline(d, x + w - 1, y, y + h - 1, edge)
        vline(d, x + w + thick - 1, y, y + h - 1, edge)
        if w > 4:
            vline(d, x + 1, y + 1, y + h - 2, top)
    else:
        rect(d, [x, y + h, x + w - 1, y + h + thick - 1], front)
        sw = 2 if w > 8 else 1
        for i in range(sw):
            vline(d, x + w + i, y + 1 - i, y + h + thick - 1 - i, side)
        hline(d, x, x + w - 1, y, edge)
        hline(d, x, x + w - 1, y + h - 1, edge)
        hline(d, x, x + w - 1, y + h + thick - 1, edge)
        vline(d, x, y, y + h + thick - 1, edge)
        vline(d, x + w - 1, y, y + h + thick - 1, edge)
        if w > 4 and h > 2:
            hline(d, x + 1, x + w - 2, y + 1, top)


def empty_pad(d, x, y, w, h, fill, edge):
    """Stamped empty item bay — must read as a vacant slot."""
    rect(d, [x, y, x + w - 1, y + h - 1], fill)
    # 1px slot frame
    hline(d, x, x + w - 1, y, edge)
    hline(d, x, x + w - 1, y + h - 1, edge)
    vline(d, x, y, y + h - 1, edge)
    vline(d, x + w - 1, y, y + h - 1, edge)
    # corner ticks
    d.point((x + 1, y + 1), fill=edge)
    d.point((x + w - 2, y + 1), fill=edge)
    d.point((x + 1, y + h - 2), fill=edge)
    d.point((x + w - 2, y + h - 2), fill=edge)


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
        cx += 4


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
    "1": ["010", "110", "010", "010", "111"],
    "2": ["110", "001", "010", "100", "111"],
    "3": ["111", "001", "011", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "8": ["111", "101", "111", "101", "111"],
    " ": ["000", "000", "000", "000", "000"],
    "-": ["000", "000", "111", "000", "000"],
    ".": ["000", "000", "000", "000", "010"],
}
