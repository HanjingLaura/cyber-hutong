#!/usr/bin/env python3
"""Three style options for cast_01 only — do not touch committed cast assets.

Research (Soul Knight / 元气骑士, Stardew Valley, Eastward, Owlboy portraits):
  Head: SK tiny sprites are ~50–65% head; Stardew walkers are ~2.5 heads tall.
  Hair: 3 tones (under / base / highlight band), not pillow-shaded noise.
  Outline: a dark hue of the fill — never pure #000. Selective (silhouette
    only) with a slightly darker inner ring.
  AA: 1–3 pixel clusters on curves (jaw, hair hem); no stray single pixels
    off the silhouette.
  Face: eyes carry it; skip a nose. Readable blob silhouette first.
  Light: above-left. Chin, neck, under-hair take the shadow tone.

A  24×28  Soul Knight tiny chibi — huge round head, stub body
B  48×56  cleaner large chibi — 3-tone hair bands, sel-out, AA
C  32×48  Stardew-like — smaller head, taller body, blockier hair
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pxlib import new, zoom  # noqa: E402
import generate_rooms as gr  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "public" / "preview"
ARTIFACT = Path("/opt/cursor/artifacts/screenshots")
REVIEW = Path("/tmp/cast-review")

# Warm dark outline — not pure black.
INK = (68, 44, 50, 255)
INK_IN = (48, 30, 36, 255)
SKIN = (246, 206, 180, 255)
SKIN_H = (255, 232, 210, 255)
SKIN_S = (214, 158, 126, 255)
HAIR1 = (22, 16, 20, 255)     # under / inner ring
HAIR2 = (46, 30, 36, 255)     # base
HAIR3 = (104, 74, 70, 255)    # mid highlight
HAIR4 = (186, 154, 142, 255)  # rim band — must read on black hair
EYE = (36, 24, 30, 255)
WHITE = (255, 252, 246, 255)
SHIRT = (246, 242, 234, 255)
SHIRT_S = (208, 198, 186, 255)
SHIRT_H = (255, 252, 248, 255)
PANTS = (52, 52, 62, 255)
SHOE = (34, 30, 36, 255)
FLOWER = (255, 250, 244, 255)
MOUTH = (198, 118, 124, 255)
BLUSH = (236, 148, 154, 255)
TRANS = (0, 0, 0, 0)
SHADOW = (18, 14, 20, 140)

PAL = {
    "K": INK, "k": INK, "I": INK_IN,
    "S": SKIN, "s": SKIN_H, "D": SKIN_S,
    "1": HAIR1, "2": HAIR2, "3": HAIR3, "4": HAIR4,
    "E": EYE, "W": WHITE, "M": MOUTH, "B": BLUSH,
    "C": SHIRT, "c": SHIRT_H, "d": SHIRT_S,
    "P": PANTS, "N": SHOE, "F": FLOWER, "U": SHADOW,
}


def put_ch(g, x, y, ch):
    if 0 <= y < len(g) and 0 <= x < len(g[0]) and ch != ".":
        g[y][x] = ch


def get_ch(g, x, y):
    if 0 <= y < len(g) and 0 <= x < len(g[0]):
        return g[y][x]
    return "."


def filled(g, x, y):
    return get_ch(g, x, y) not in ".U"


def in_ell(x, y, cx, cy, rx, ry):
    if rx <= 0 or ry <= 0:
        return False
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.02


def fill_ell(g, cx, cy, rx, ry, ch, only=None):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if in_ell(x, y, cx, cy, rx, ry):
                if only is None or get_ch(g, x, y) in only:
                    put_ch(g, x, y, ch)


def fill_rect(g, x0, y0, x1, y1, ch, only=None):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if only is None or get_ch(g, x, y) in only:
                put_ch(g, x, y, ch)


def stamp(g, x, y, rows):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != ".":
                put_ch(g, x + i, y + j, ch)


def silhouette_outline(g, ink="k"):
    h, w = len(g), len(g[0])
    extra = []
    for y in range(h):
        for x in range(w):
            if get_ch(g, x, y) == "." and any(
                filled(g, x + dx, y + dy) for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
            ):
                extra.append((x, y))
    for x, y in extra:
        g[y][x] = ink


def inner_ring(g):
    """Darken hair / cloth pixels that sit against the outline."""
    h, w = len(g), len(g[0])
    for y in range(h):
        for x in range(w):
            ch = get_ch(g, x, y)
            if ch not in "23C":
                continue
            if any(get_ch(g, x + dx, y + dy) in "kK" for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                g[y][x] = {"2": "1", "3": "2", "C": "d"}[ch]


def aa_clusters(g, spots):
    """Small 2–3 px clusters on curves — never a lone pixel off-silhouette."""
    for x, y, ch in spots:
        if filled(g, x, y) or get_ch(g, x, y) in "kK":
            put_ch(g, x, y, ch)


def to_img(g):
    h, w = len(g), len(g[0])
    img = new(w, h)
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch in PAL:
                img.putpixel((x, y), PAL[ch])
    return img


# ---------------------------------------------------------------------------
# A — Soul Knight 24×28. Head is most of the sprite.
# ---------------------------------------------------------------------------
def draw_a(view: str) -> Image.Image:
    w, h = 24, 28
    g = [list("." * w) for _ in range(h)]
    back = view.endswith("back")
    sit = view.startswith("sit")
    cx, cy, rx, ry = 12, 9, 8, 8

    fill_ell(g, cx, cy, rx, ry, "2")
    # 3-tone crown: highlight band upper-left, under-hair lower
    fill_ell(g, cx - 2, cy - 3, 5, 4, "3", only="2")
    fill_ell(g, cx - 3, cy - 4, 3, 2, "4", only="3")
    stamp(g, 8, 3, ["44"])
    stamp(g, 7, 4, ["43"])
    fill_ell(g, cx, cy + 4, 7, 4, "1", only="2")
    if not back:
        fill_ell(g, cx, cy + 1, 6, 6, "S")
        fill_ell(g, cx, cy, 5, 4, "s", only="S")
        fill_ell(g, cx, cy + 4, 5, 3, "D", only="S")
        # bangs / side-part curtains over forehead
        fill_ell(g, cx - 1, cy - 4, 7, 3, "2")
        fill_ell(g, cx - 3, cy - 5, 3, 2, "3", only="2")
        # part on her left (viewer's right)
        put_ch(g, 16, 3, "1")
        put_ch(g, 16, 4, "S")
        stamp(g, 7, 8, ["WE", "..", ".."])
        stamp(g, 14, 8, ["WE"])
        put_ch(g, 8, 11, "B")
        put_ch(g, 15, 11, "B")
        stamp(g, 11, 12, ["MM"])
        # flower on right jaw
        put_ch(g, 19, 12, "F")
        put_ch(g, 20, 13, "F")
        put_ch(g, 19, 13, "F")
    else:
        fill_ell(g, cx, cy + 1, 6, 5, "2")
        fill_ell(g, cx, cy + 2, 4, 3, "1", only="2")

    # long side fall past the stub shoulders
    for y in range(12, 20):
        inset = 0 if y < 16 else (y - 15)
        put_ch(g, 4 + inset, y, "1" if y > 16 else "2")
        put_ch(g, 5 + inset, y, "2")
        put_ch(g, 18 - inset, y, "2")
        put_ch(g, 19 - inset, y, "1" if y > 16 else "2")

    # stub body — off-shoulder
    by = 16
    stamp(g, 8, by, [
        ".SSSSSS.",
        "dCCCCCCd",
        ".dCCCCd.",
        ".SSCCSS.",
    ] if not back else [
        ".222222.",
        "dCCCCCCd",
        ".dCCCCd.",
        ".SSCCSS.",
    ])
    if sit:
        stamp(g, 8, by + 4, [
            ".PPPPPP.",
            ".NNNNNN.",
            "..UUUU..",
        ])
    else:
        stamp(g, 8, by + 4, [
            ".PPPPPP.",
            ".PPPPPP.",
            ".NNNNNN.",
            "..NNNN..",
            "...UU...",
        ])

    silhouette_outline(g)
    inner_ring(g)
    aa_clusters(g, [
        (5, 4, "3"), (6, 3, "3"), (18, 4, "1"),
        (4, 18, "1"), (19, 18, "1"),
        (7, 15, "D") if not back else (7, 15, "1"),
    ])
    return to_img(g)


# ---------------------------------------------------------------------------
# B — 48×56 cleaner large chibi. Room for 3-tone bands + AA.
# ---------------------------------------------------------------------------
def draw_b(view: str) -> Image.Image:
    w, h = 48, 56
    g = [list("." * w) for _ in range(h)]
    back = view.endswith("back")
    sit = view.startswith("sit")
    cx, cy, rx, ry = 23, 15, 14, 13

    # hair mass
    fill_ell(g, cx, cy, rx, ry, "2")
    # long falls — left heavier, right a bit shorter (side-part read)
    for y in range(18, 40):
        t = (y - 18) / 22
        li = int(t * 3)
        ri = int(t * 4)
        for x in range(8 + li, 13):
            put_ch(g, x, y, "1" if y > 32 or x <= 8 + li else "2")
        for x in range(34, 40 - ri):
            put_ch(g, x, y, "1" if y > 30 or x >= 39 - ri else "2")
    # hem thicken
    fill_rect(g, 9, 38, 14, 41, "1")
    fill_rect(g, 33, 36, 38, 39, "1")

    # 3-tone: under-hair, mid, highlight band (above-left, follows crown)
    fill_ell(g, cx, cy + 6, 12, 7, "1", only="2")
    for y in range(3, 11):
        for x in range(11, 24):
            if get_ch(g, x, y) in "21" and in_ell(x, y, cx - 2, cy - 4, 9, 6):
                g[y][x] = "3"
    for y in range(3, 8):
        for x in range(13, 21):
            if get_ch(g, x, y) == "3" and in_ell(x, y, cx - 3, cy - 6, 5, 3):
                g[y][x] = "4"
    # Eastward-style highlight band — a readable crescent, not a spray
    stamp(g, 14, 3, ["444"])
    stamp(g, 13, 4, [".4433"])
    stamp(g, 12, 5, ["..33"])

    if not back:
        fill_ell(g, cx, cy + 2, 9, 9, "S")
        fill_ell(g, cx - 1, cy, 7, 6, "s", only="S")
        fill_ell(g, cx, cy + 7, 7, 4, "D", only="S")
        # bangs over forehead, part on viewer's right
        fill_ell(g, cx - 2, cy - 6, 10, 5, "2")
        fill_ell(g, cx - 4, cy - 7, 5, 3, "3", only="2")
        fill_rect(g, 27, 4, 29, 7, "1")
        put_ch(g, 28, 6, "S")
        put_ch(g, 29, 7, "S")
        # curtain cheeks
        fill_rect(g, 12, 14, 15, 22, "2")
        fill_rect(g, 31, 14, 34, 21, "2")
        # eyes — clean WE with lid, no noisy singles
        stamp(g, 15, 14, [
            "kkk",
            "WEK",
            "EEK",
        ])
        stamp(g, 25, 14, [
            "kkk",
            "KWE",
            "KEE",
        ])
        put_ch(g, 16, 18, "B")
        put_ch(g, 17, 18, "B")
        put_ch(g, 29, 18, "B")
        put_ch(g, 30, 18, "B")
        stamp(g, 21, 20, ["MM"])
        # flower earring touching right jaw
        stamp(g, 35, 20, [
            ".F.",
            "FFF",
            ".F.",
        ])
    else:
        fill_ell(g, cx, cy + 2, 10, 8, "2")
        fill_ell(g, cx, cy + 4, 7, 5, "1", only="2")
        fill_ell(g, cx - 3, cy - 5, 6, 4, "3", only="2")
        # tapered hair sheet so the back is not a mushroom blob
        for y in range(22, 40):
            t = (y - 22) / 18
            half = int(11 - t * 5)
            for x in range(cx - half, cx + half + 1):
                put_ch(g, x, y, "1" if y > 34 or x in (cx - half, cx + half) else "2")

    # neck + off-shoulder top
    by = 26
    if not back:
        stamp(g, 19, by, ["SSSSSS"])
        stamp(g, 18, by + 1, ["sSSSSSs"])
    else:
        stamp(g, 19, by, ["222222"])
        stamp(g, 18, by + 1, ["2222222"])
    # hanging hair over shoulders already placed; shirt under
    stamp(g, 14, by + 2, [
        "dCCCCCCCCCCd",
        "dCCCCCCCCCCd",
        "dCcCCCCCCcd",
        "dCCCCCCCCCCd",
        ".SSCCCCCCSS.",
    ])
    # keep hair falls in front of the sleeve
    for y in range(by + 2, by + 8):
        for x in range(8, 13):
            if get_ch(g, x, y) == ".":
                put_ch(g, x, y, "2")
        for x in range(35, 40):
            if get_ch(g, x, y) == ".":
                put_ch(g, x, y, "2")

    if sit:
        stamp(g, 16, by + 7, [
            ".PPPPPPPPPP.",
            ".PPPPPPPPPP.",
            ".NNNNNNNNNN.",
            "..UUUUUUUU..",
        ])
    else:
        stamp(g, 16, by + 7, [
            ".PPPPPPPPPP.",
            ".PPPPPPPPPP.",
            ".PPPPPPPPPP.",
            "..PPPPPPPP..",
            "..NNNNNNNN..",
            "...NNNNNN...",
            "....UUUU....",
        ])

    silhouette_outline(g)
    inner_ring(g)
    aa_clusters(g, [
        (10, 6, "3"), (11, 5, "3"), (12, 4, "4"),
        (33, 6, "1"), (34, 8, "1"),
        (9, 40, "1"), (10, 41, "1"),
        (37, 38, "1"), (36, 39, "1"),
        (15, 24, "D") if not back else (15, 24, "1"),
        (31, 23, "D") if not back else (31, 23, "1"),
    ])
    return to_img(g)


# ---------------------------------------------------------------------------
# C — Stardew-like 32×48. Smaller head, taller body, blockier hair.
# ---------------------------------------------------------------------------
def draw_c(view: str) -> Image.Image:
    w, h = 32, 48
    g = [list("." * w) for _ in range(h)]
    back = view.endswith("back")
    sit = view.startswith("sit")

    # Stardew is boxier than SK, but still chamfered — not a helmet slab
    fill_rect(g, 8, 2, 23, 16, "2")
    fill_rect(g, 7, 4, 24, 14, "2")
    fill_rect(g, 9, 1, 22, 2, "2")
    for x, y in ((8, 2), (23, 2), (7, 4), (24, 4), (9, 1), (22, 1)):
        put_ch(g, x, y, ".")
    # long falls with a slight taper
    fill_rect(g, 6, 10, 10, 26, "2")
    fill_rect(g, 21, 10, 25, 24, "2")
    fill_rect(g, 6, 24, 9, 29, "1")
    fill_rect(g, 22, 22, 25, 27, "1")
    put_ch(g, 6, 10, ".")
    put_ch(g, 25, 10, ".")
    # top-down 2-tone: highlight strip on the crown, shadow under
    fill_rect(g, 10, 2, 18, 4, "3", only="2")
    fill_rect(g, 12, 2, 15, 3, "4", only="3")
    fill_rect(g, 8, 13, 23, 16, "1", only="2")
    # side-part notch + short bangs
    put_ch(g, 19, 2, "1")
    put_ch(g, 20, 3, "1")
    fill_rect(g, 10, 4, 18, 6, "2")

    if not back:
        fill_rect(g, 10, 6, 21, 16, "S")
        fill_rect(g, 11, 6, 20, 10, "s", only="S")
        fill_rect(g, 11, 13, 20, 16, "D", only="S")
        # short bangs
        fill_rect(g, 10, 5, 18, 7, "2")
        put_ch(g, 19, 5, "S")
        # Stardew face is almost only the eyes
        stamp(g, 12, 9, ["E."])
        stamp(g, 18, 9, [".E"])
        put_ch(g, 15, 13, "M")
        put_ch(g, 13, 12, "B")
        put_ch(g, 19, 12, "B")
        # simple 4-petal flower
        stamp(g, 24, 14, [
            ".F",
            "FF",
        ])
    else:
        fill_rect(g, 10, 6, 21, 15, "2")
        fill_rect(g, 12, 10, 19, 14, "1", only="2")

    # taller torso — off-shoulder, then long legs
    by = 17
    if not back:
        stamp(g, 12, by, ["SSSSSS"])
    else:
        stamp(g, 12, by, ["222222"])
    stamp(g, 10, by + 1, [
        "dCCCCCCCC",
        "dCCCCCCCC",
        "dCcCCCCCd",
        ".SSCCCCSS",
    ])
    # hair over the sleeves
    fill_rect(g, 6, 17, 9, 24, "2")
    fill_rect(g, 22, 17, 25, 23, "2")

    if sit:
        stamp(g, 11, by + 5, [
            "PPPPPPPP",
            "PPPPPPPP",
            "NNNNNNNN",
            ".UUUUUU.",
        ])
    else:
        stamp(g, 11, by + 5, [
            "PPPPPPPP",
            "PPPPPPPP",
            "PPPPPPPP",
            "PPPPPPPP",
            "PPPPPPPP",
            ".NNNNNN.",
            ".NNNNNN.",
            "..UUUU..",
        ])

    silhouette_outline(g)
    inner_ring(g)
    aa_clusters(g, [
        (9, 2, "3"), (23, 3, "1"),
        (6, 29, "1"), (25, 27, "1"),
    ])
    return to_img(g)


VIEWS = ("idle_front", "idle_back", "sit_front", "sit_back")
VIEW_LABELS = ("idle front", "idle back", "sit front", "sit back")


def checker(w, h, a=(228, 224, 218, 255), b=(210, 206, 200, 255), cell=8):
    img = Image.new("RGBA", (w, h), a)
    px = img.load()
    for y in range(h):
        for x in range(w):
            if ((x // cell) + (y // cell)) % 2 == 0:
                px[x, y] = b
    return img


def _font(size=12):
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    try:
        if path.exists():
            return ImageFont.truetype(str(path), size)
        return ImageFont.load_default()
    except Exception:
        return ImageFont.load_default()


def label(draw, xy, text, fill=(70, 54, 48, 255), size=12):
    draw.text(xy, text, fill=fill, font=_font(size))


def make_options(sheets):
    """A/B/C columns, four views stacked, NN upscale, aligned rows."""
    scale = 6
    pad, title_h, cap = 20, 64, 18
    col_w = [max(im.size[0] for im in frames) * scale + pad for frames in sheets]
    row_h = [
        max(sheets[c][r].size[1] for c in range(3)) * scale + cap + 10
        for r in range(4)
    ]
    W = pad + sum(col_w)
    H = title_h + sum(row_h) + pad + 8
    out = Image.new("RGBA", (W, H), (214, 210, 204, 255))
    d = ImageDraw.Draw(out)
    label(d, (pad, 8), "cast_01 only — pick a style. Committed cast is unchanged.", (70, 54, 48, 255), 14)
    label(d, (pad, 28), "A Soul Knight 24x28   B large 48x56 3-tone   C Stardew-like 32x48", (96, 40, 52, 255), 13)
    label(d, (pad, 46), "head ratio / 3-tone hair / colored outline / AA clusters", (110, 90, 84, 255), 11)
    names = ("A  SK tiny 24x28", "B  large 48x56", "C  Stardew 32x48")
    x0 = pad
    for c, name in enumerate(names):
        label(d, (x0, title_h - 16), name, (96, 40, 52, 255), 12)
        y = title_h
        for r, vn in enumerate(VIEW_LABELS):
            im = sheets[c][r]
            big = zoom(im, scale)
            cell = checker(col_w[c] - 8, row_h[r] - 6)
            out.paste(cell, (x0, y))
            out.paste(big, (x0 + 6, y + 4), big)
            label(d, (x0 + 6, y + row_h[r] - 18), vn, (90, 80, 74, 255), 11)
            y += row_h[r]
        x0 += col_w[c]
    return out


def place_in_room(style_sit, label_text):
    """Hutong view 1 with SW seat emptied, then this style under the desk."""
    saved = gr.HUTONG_SOUTH
    gr.HUTONG_SOUTH = (None,) + saved[1:]
    try:
        room = gr.scene_hutong().convert("RGBA")
    finally:
        gr.HUTONG_SOUTH = saved
    spr = zoom(style_sit, gr.HUTONG_SCALE)
    x = gr.SEATS_X[0] - spr.size[0] // 2
    y = gr.V1_BOT_DESK_Y - gr.SIT_ABOVE_DESK
    room.alpha_composite(spr, (max(0, x), max(0, y)))
    desk, xoff = gr._desk_for_row(near=True)
    room.alpha_composite(desk, (xoff, gr.V1_BOT_DESK_Y))
    d = ImageDraw.Draw(room)
    label(d, (10, 10), label_text, (40, 36, 44, 255), 14)
    return room


def make_in_room(sits):
    rooms = [
        place_in_room(sits[0], "A  Soul Knight 24x28 @ 3x"),
        place_in_room(sits[1], "B  large 48x56 @ 3x"),
        place_in_room(sits[2], "C  Stardew-like 32x48 @ 3x"),
    ]
    pad = 12
    w, h = rooms[0].size
    out = Image.new("RGBA", (pad + 3 * (w + pad), h + 36), (18, 20, 28, 255))
    d = ImageDraw.Draw(out)
    label(d, (pad, 8), "cast_01 style in hutong (game scale 3x) — current cast otherwise, SW seat swapped", (200, 176, 130, 255), 14)
    for i, rm in enumerate(rooms):
        out.paste(rm, (pad + i * (w + pad), 28))
    return out


def main():
    PREVIEW.mkdir(parents=True, exist_ok=True)
    ARTIFACT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)

    a = tuple(draw_a(v) for v in VIEWS)
    b = tuple(draw_b(v) for v in VIEWS)
    c = tuple(draw_c(v) for v in VIEWS)
    assert a[0].size == (24, 28), a[0].size
    assert b[0].size == (48, 56), b[0].size
    assert c[0].size == (32, 48), c[0].size

    options = make_options((a, b, c))
    in_room = make_in_room((a[2], b[2], c[2]))
    for dest in (ARTIFACT, PREVIEW, REVIEW):
        options.save(dest / "cast_style_options.png")
        in_room.save(dest / "cast_style_in_room.png")
        print(f"  wrote {dest}/cast_style_options.png {options.size}")
        print(f"  wrote {dest}/cast_style_in_room.png {in_room.size}")

    # 2x review crops of each idle/sit
    for name, frames in (("A", a), ("B", b), ("C", c)):
        for v, im in zip(VIEWS, frames):
            zoom(im, 2).save(REVIEW / f"{name}_{v}_2x.png")
    print("Done style options (committed cast untouched).")


if __name__ == "__main__":
    main()
