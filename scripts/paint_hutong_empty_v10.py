#!/usr/bin/env python3
"""Paint hutong empty room v10 from scratch.

v9 is the layout / content / style reference only. Every pixel is drawn
from geometry — nothing is copied or patched from v9.
View 2 is view 1 cropped at y>=176.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "hutong" / "room"
PREVIEW = ROOT / "public" / "preview"
ART = Path("/opt/cursor/artifacts/screenshots")

W, H = 1280, 720
CROP_Y = 176

# layout measured from v9, then drawn clean
WALL_Y1 = 160
FLOOR_Y0 = 176
BORDER_Y = 682

TOP_X, TOP_Y = 176, 179
TOP_W, TOP_TOP_H = 922, 75          # 176..1097, 179..253
TOP_PED_Y0, TOP_PED_Y1 = 254, 318
TOP_PEDS = (212, 464, 686, 920)     # left edges
TOP_PED_W = 91
TOP_LEG_XS = (183, 1083)
TOP_SEAMS = (406, 636, 867)

BOT_X, BOT_Y = 163, 497
BOT_W, BOT_TOP_H = 952, 81          # 163..1114, 497..577
BOT_BEVEL = 578
BOT_PANEL_Y0, BOT_PANEL_Y1 = 580, 662
BOT_SEAMS = (401, 638, 876)
FOOT_W, FOOT_H = 12, 4
BOT_FEET = (BOT_X + 6, BOT_X + BOT_W - 1 - 18)

TILE = 80
GROUT_W = 3

INK = (26, 21, 15)
WALL = (248, 246, 242)
WALL_LINE = (36, 34, 38)
FLOOR = (208, 204, 198)
FLOOR2 = (216, 212, 206)
GROUT = (176, 172, 166)
WOOD = (210, 168, 120)
WOOD2 = (200, 158, 110)
WOOD_HI = (222, 184, 140)
WOOD_D = (186, 144, 96)
SIDE = (72, 54, 36)
SIDE_HI = (88, 66, 44)
PANEL = (111, 82, 54)
PANEL_HI = (126, 93, 62)
PANEL_D = (96, 70, 46)
BEVEL = (232, 198, 156)
FOOT = (58, 42, 28)
FOOT_HI = (78, 58, 38)
HANDLE = (48, 42, 38)
FRAME = (150, 150, 154)
MAT = (214, 214, 218)
ART_GREY = (168, 168, 170)
ART_D = (140, 140, 142)
BORDER = (14, 23, 32)
SUB = (28, 26, 30)


def clamp(n):
    return 0 if n < 0 else 255 if n > 255 else n


def shade(c, amt):
    return (clamp(c[0] + amt), clamp(c[1] + amt), clamp(c[2] + amt))


def rect(px, x0, y0, x1, y1, c):
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(W - 1, x1)
    y1 = min(H - 1, y1)
    if x1 < x0 or y1 < y0:
        return
    px[y0 : y1 + 1, x0 : x1 + 1] = c


def hline(px, x0, x1, y, c):
    if 0 <= y < H:
        rect(px, x0, y, x1, y, c)


def vline(px, x, y0, y1, c):
    if 0 <= x < W:
        rect(px, x, y0, x, y1, c)


def box(px, x0, y0, x1, y1, fill, edge=INK):
    rect(px, x0, y0, x1, y1, edge)
    if x1 - x0 > 1 and y1 - y0 > 1:
        rect(px, x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)


def is_floor_c(p):
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    return abs(r - g) < 20 and abs(g - b) < 20 and 140 < r < 230


# 7×11 pixel caps used for TRUE TALENTS CONNECT
FONT = {
    "A": ["01110", "10001", "10001", "10001", "11111", "10001", "10001", "10001", "10001", "10001", "10001"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10000", "10000", "10000", "10000", "10001", "01110"],
    "E": ["11111", "10000", "10000", "10000", "11110", "10000", "10000", "10000", "10000", "10000", "11111"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "N": ["10001", "11001", "11001", "10101", "10101", "10011", "10011", "10001", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "R": ["11110", "10001", "10001", "10001", "11110", "10100", "10010", "10010", "10001", "10001", "10001"],
    "S": ["01110", "10001", "10000", "10000", "01110", "00001", "00001", "00001", "00001", "10001", "01110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    " ": ["000", "000", "000", "000", "000", "000", "000", "000", "000", "000", "000"],
}


def draw_text(px, x, y, text, color, scale=2, tracking=2):
    cx = x
    for ch in text:
        bits = FONT.get(ch, FONT[" "])
        w = len(bits[0])
        for row, rowbits in enumerate(bits):
            for col, bit in enumerate(rowbits):
                if bit == "1":
                    for dy in range(scale):
                        for dx in range(scale):
                            xx, yy = cx + col * scale + dx, y + row * scale + dy
                            if 0 <= xx < W and 0 <= yy < H:
                                px[yy, xx] = color
        cx += w * scale + tracking
    return cx


def draw_ttc(px, x, y):
    """Chunky lowercase ttc — 1-block SK logo."""
    def blk(sx, sy, w, h):
        rect(px, sx, sy, sx + w - 1, sy + h - 1, INK)

    # t
    blk(x + 18, y, 18, 58)
    blk(x, y + 18, 54, 16)
    blk(x + 18, y + 54, 30, 16)
    # t
    blk(x + 80, y, 18, 58)
    blk(x + 62, y + 18, 54, 16)
    blk(x + 80, y + 54, 30, 16)
    # c (open on the right)
    blk(x + 132, y + 16, 16, 54)
    blk(x + 132, y + 16, 46, 16)
    blk(x + 132, y + 54, 46, 16)


def draw_frame(px, x, y, w=50, h=40):
    box(px, x, y, x + w - 1, y + h - 1, MAT, INK)
    rect(px, x + 3, y + 3, x + w - 4, y + h - 4, FRAME)
    base_y = y + h - 6
    peaks = (8, 14, 6, 16, 10, 18, 7)
    for i, xx in enumerate(range(x + 6, x + w - 6)):
        hh = peaks[i % len(peaks)] - abs((i % 10) - 5)
        y0 = max(y + 8, base_y - max(3, hh))
        col = ART_D if (i // 4) % 2 == 0 else ART_GREY
        rect(px, xx, y0, xx, base_y, col)


def paint_floor(px):
    # floor starts under the wall join so a strip of tile sits above the top desk
    rect(px, 0, 162, W - 1, BORDER_Y - 1, FLOOR)
    # slight tile checker so the field is not flat, grout stays on a grid
    floor0 = 162
    for ty in range(((floor0 - 16) // TILE) * TILE, BORDER_Y, TILE):
        for tx in range(0, W, TILE):
            if ((tx // TILE) + (ty // TILE)) % 2 == 0:
                rect(px, tx + GROUT_W, max(ty + GROUT_W, floor0),
                     min(tx + TILE - 1, W - 1), min(ty + TILE - 1, BORDER_Y - 1), FLOOR2)
    # continuous grout — full-width / full-height, never stubbed
    for ty in range(((floor0 - 16) // TILE) * TILE, BORDER_Y, TILE):
        for k in range(GROUT_W):
            yy = ty + k
            if floor0 <= yy < BORDER_Y:
                hline(px, 0, W - 1, yy, GROUT)
    for tx in range(0, W, TILE):
        for k in range(GROUT_W):
            vline(px, tx + k, floor0, BORDER_Y - 1, GROUT)
    rng = np.random.RandomState(10)
    for _ in range(900):
        x = int(rng.randint(0, W))
        y = int(rng.randint(floor0, BORDER_Y))
        if tuple(px[y, x]) in (FLOOR, FLOOR2):
            px[y, x] = shade(tuple(int(c) for c in px[y, x]), -6 if (x + y) % 2 == 0 else 5)


def paint_wall(px):
    rect(px, 0, 0, W - 1, WALL_Y1, WALL)
    # 2px join, then floor runs up to the top-desk outline at y=176
    hline(px, 0, W - 1, 160, shade(WALL, -18))
    hline(px, 0, W - 1, 161, INK)

    draw_ttc(px, 120, 28)
    draw_text(px, 122, 118, "TRUE TALENTS CONNECT", SUB, scale=2, tracking=3)

    fx0, fy0, pitch_x, pitch_y = 886, 38, 69, 56
    for row in range(2):
        for col in range(4):
            draw_frame(px, fx0 + col * pitch_x, fy0 + row * pitch_y)


def wood_px(x, y, base=WOOD):
    """Continuous horizontal grain — same function on the whole slab."""
    n = (x * 7 + y * 13) % 53
    wave = ((x + y * 3) // 11) % 5
    amt = (4, 0, -3, 1, -1)[wave]
    if n < 3:
        amt -= 12
    elif n > 50:
        amt += 8
    elif n in (11, 28, 41):
        amt -= 5
    return shade(base, amt)


def fill_wood(px, x0, y0, x1, y1, base=WOOD):
    for y in range(max(0, y0), min(H, y1 + 1)):
        for x in range(max(0, x0), min(W, x1 + 1)):
            px[y, x] = wood_px(x, y, base)


def desk_outline(px, x0, y0, x1, y1, chamfer=2):
    """1px ink box, 2px chamfer on the far (north) corners."""
    hline(px, x0 + chamfer, x1 - chamfer, y0, INK)
    hline(px, x0, x1, y1, INK)
    vline(px, x0, y0 + chamfer, y1, INK)
    vline(px, x1, y0 + chamfer, y1, INK)
    for k in range(chamfer):
        px[y0 + k, x0 + chamfer - 1 - k] = INK
        px[y0 + k, x1 - chamfer + 1 + k] = INK


def paint_top_desk(px):
    x0, y0 = TOP_X, TOP_Y
    x1 = x0 + TOP_W - 1
    yt1 = y0 + TOP_TOP_H - 1
    join = yt1 + 1

    # pedestals + legs first — top edge shares the desktop underside
    for px0 in TOP_PEDS:
        paint_pedestal(px, px0, join, px0 + TOP_PED_W - 1, TOP_PED_Y1)
    for lx in TOP_LEG_XS:
        box(px, lx, join, lx + 7, TOP_PED_Y1, SIDE, INK)
        vline(px, lx + 1, join + 1, TOP_PED_Y1 - 1, SIDE_HI)
        box(px, lx - 1, TOP_PED_Y1 + 1, lx + 8, TOP_PED_Y1 + 3, FOOT, INK)

    # desktop from above
    fill_wood(px, x0 + 1, y0 + 1, x1 - 1, yt1)
    hline(px, x0 + 3, x1 - 3, y0 + 1, WOOD_HI)
    for sx in TOP_SEAMS:
        vline(px, sx, y0 + 2, yt1, shade(WOOD_D, -8))
        vline(px, sx + 1, y0 + 2, yt1, shade(WOOD_HI, -4))

    # 3px underside lip, no through-line that would cut the pedestals free
    rect(px, x0 + 1, join, x1 - 1, join + 2, WOOD_D)
    hline(px, x0 + 2, x1 - 2, join, shade(WOOD_D, 18))
    vline(px, x0, y0 + 2, join + 2, INK)
    vline(px, x1, y0 + 2, join + 2, INK)

    desk_outline(px, x0, y0, x1, yt1, chamfer=2)
    vline(px, x0 + 1, y0 + 3, join + 2, SIDE)
    vline(px, x1 - 1, y0 + 3, join + 2, SIDE)


def paint_pedestal(px, x0, y0, x1, y1):
    fill_wood(px, x0 + 1, y0 + 1, x1 - 1, y1 - 1, WOOD)
    box(px, x0, y0, x1, y1, None, INK) if False else None
    # redraw fill then outline (box would wipe grain)
    hline(px, x0, x1, y0, INK)
    hline(px, x0, x1, y1, INK)
    vline(px, x0, y0, y1, INK)
    vline(px, x1, y0, y1, INK)
    mid = (y0 + y1) // 2
    hline(px, x0 + 1, x1 - 1, mid, INK)
    # two drawers
    for dy0, dy1 in ((y0 + 3, mid - 2), (mid + 2, y1 - 3)):
        hline(px, x0 + 2, x1 - 2, dy0, WOOD_HI)
        # handle
        hx0, hx1 = x0 + 28, x1 - 28
        hy = (dy0 + dy1) // 2
        hline(px, hx0, hx1, hy, HANDLE)
        hline(px, hx0, hx1, hy + 1, INK)
        px[hy, hx0] = INK
        px[hy, hx1] = INK
    # tiny feet attached to the pedestal
    for fx in (x0 + 3, x1 - 6):
        box(px, fx, y1 + 1, fx + 4, y1 + 3, FOOT, INK)


def paint_bottom_desk(px):
    x0, y0 = BOT_X, BOT_Y
    x1 = x0 + BOT_W - 1
    yt1 = y0 + BOT_TOP_H - 1

    # one continuous wood top
    fill_wood(px, x0 + 2, y0 + 1, x1 - 2, yt1 - 1)
    hline(px, x0 + 3, x1 - 3, y0 + 1, WOOD_HI)
    for sx in BOT_SEAMS:
        vline(px, sx, y0 + 2, yt1 - 1, shade(WOOD_D, -8))
        vline(px, sx + 1, y0 + 2, yt1 - 1, shade(WOOD_HI, -4))
    desk_outline(px, x0, y0, x1, yt1, chamfer=2)
    vline(px, x0 + 1, y0 + 3, yt1 - 1, SIDE)
    vline(px, x0 + 2, y0 + 3, yt1 - 1, SIDE_HI)
    vline(px, x1 - 1, y0 + 3, yt1 - 1, SIDE)
    vline(px, x1 - 2, y0 + 3, yt1 - 1, SIDE_HI)

    # bevel where the top meets the single back panel
    hline(px, x0 + 1, x1 - 1, BOT_BEVEL, BEVEL)
    hline(px, x0 + 1, x1 - 1, BOT_BEVEL + 1, shade(BEVEL, -16))

    # ONE tall flat panel — no segment seams, 3-tone + sparse speckle
    rect(px, x0 + 3, BOT_PANEL_Y0, x1 - 3, BOT_PANEL_Y1 - 1, PANEL)
    hline(px, x0 + 3, x1 - 3, BOT_PANEL_Y0, PANEL_HI)
    hline(px, x0 + 3, x1 - 3, BOT_PANEL_Y1 - 1, PANEL_D)
    rng = np.random.RandomState(3)
    for _ in range(220):
        x = int(rng.randint(x0 + 4, x1 - 3))
        y = int(rng.randint(BOT_PANEL_Y0 + 2, BOT_PANEL_Y1 - 2))
        px[y, x] = shade(PANEL, 6 if (x + y) % 2 == 0 else -6)

    # shared side faces + 1px ink down the whole body
    for y in range(y0, BOT_PANEL_Y1 + 1):
        px[y, x0] = INK
        px[y, x0 + 1] = SIDE
        px[y, x0 + 2] = SIDE_HI
        px[y, x1] = INK
        px[y, x1 - 1] = SIDE
        px[y, x1 - 2] = SIDE_HI
    hline(px, x0, x1, BOT_PANEL_Y1, INK)

    # 12×4 feet attached to the panel outline — no floor gap
    yf0 = BOT_PANEL_Y1 + 1
    for fx in BOT_FEET:
        for y in range(yf0, yf0 + FOOT_H):
            for x in range(fx, fx + FOOT_W):
                edge = y == yf0 or y == yf0 + FOOT_H - 1 or x == fx or x == fx + FOOT_W - 1
                if edge:
                    px[y, x] = INK
                elif y == yf0 + 1 and 2 <= x - fx <= 5:
                    px[y, x] = FOOT_HI
                else:
                    px[y, x] = FOOT


def darken_floor(px, x, y, amt):
    if 0 <= x < W and FLOOR_Y0 <= y < BORDER_Y and is_floor_c(px[y, x]):
        px[y, x] = shade(tuple(int(c) for c in px[y, x]), amt)


def paint_shadows(px):
    """Soft contact shadow: darken floor, never replace grout geometry."""
    # top desk
    x0, x1 = TOP_X, TOP_X + TOP_W - 1
    for y in range(TOP_PED_Y0, TOP_PED_Y1 + 10):
        for k in range(1, 5):
            darken_floor(px, x0 - k, y, -20)
            darken_floor(px, x1 + k, y, -20)
    for y in range(TOP_PED_Y1 + 4, TOP_PED_Y1 + 9):
        for x in range(x0 - 2, x1 + 3):
            darken_floor(px, x, y, -16)

    # bottom desk — shadow starts under the feet
    bx0, bx1 = BOT_X, BOT_X + BOT_W - 1
    for y in range(BOT_Y + 8, BOT_PANEL_Y1 + 1):
        for k in range(1, 5):
            darken_floor(px, bx0 - k, y, -22)
            darken_floor(px, bx1 + k, y, -22)
    foot_bottom = BOT_PANEL_Y1 + 1 + FOOT_H
    for y in range(foot_bottom, foot_bottom + 6):
        for x in range(bx0 - 3, bx1 + 4):
            darken_floor(px, x, y, -20)


def paint_border(px):
    hline(px, 0, W - 1, BORDER_Y, shade(INK, 20))
    rect(px, 0, BORDER_Y + 1, W - 1, H - 1, BORDER)


def crop4(im, box, z=4):
    c = im.crop(box)
    return c.resize((c.size[0] * z, c.size[1] * z), Image.Resampling.NEAREST)


def side_by_side(a, b):
    out = Image.new("RGB", (a.size[0] + b.size[0] + 8, max(a.size[1], b.size[1])), (32, 32, 32))
    out.paste(a, (0, 0))
    out.paste(b, (a.size[0] + 8, 0))
    return out


def grout_rows(im, x0, x1, y0, y1):
    sl = im[y0:y1, x0:x1].astype(np.int16)
    m = sl.mean(axis=(1, 2))
    med = np.median(m)
    return [y0 + i for i, v in enumerate(m) if v < med - 6]


def audit(v10, v9=None):
    print("audit")
    far_l = grout_rows(v10, 20, 80, 490, 680)
    strip_l = grout_rows(v10, 110, 155, 490, 680)
    far_r = grout_rows(v10, 1200, 1260, 490, 680)
    strip_r = grout_rows(v10, 1130, 1158, 490, 680)
    print(f"  H grout far-L {far_l}")
    print(f"  H grout strip-L {strip_l}")
    print(f"  H grout far-R {far_r}")
    print(f"  H grout strip-R {strip_r}")
    extra = (set(strip_l) - set(far_l)) | (set(strip_r) - set(far_r))
    missing = (set(far_l) - set(strip_l)) | (set(far_r) - set(strip_r))
    print(f"  extra={sorted(extra)} missing={sorted(missing)}")

    # feet attached?
    for name, fx in (("L", BOT_FEET[0]), ("R", BOT_FEET[1])):
        gap = any(is_floor_c(v10[BOT_PANEL_Y1 + 1, x]) for x in range(fx, fx + FOOT_W))
        print(f"  foot {name} gap={gap}")
    print("  grout", "OK" if not extra and not missing else "CHECK")


def main():
    print("Painting hutong empty v10 from scratch…")
    px = np.zeros((H, W, 3), dtype=np.uint8)
    paint_floor(px)
    paint_wall(px)
    paint_top_desk(px)
    paint_bottom_desk(px)
    paint_shadows(px)
    paint_border(px)

    img = Image.fromarray(px, "RGB")
    v2 = img.crop((0, CROP_Y, W, H))
    assert img.size == (1280, 720)
    assert v2.size == (1280, 544)
    assert np.array_equal(np.array(v2), px[CROP_Y:])

    v9_path = OUT / "hutong_empty_view1_v9.png"
    v9 = np.array(Image.open(v9_path).convert("RGB")) if v9_path.exists() else None
    audit(px, v9)

    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    p1 = OUT / "hutong_empty_view1_v10.png"
    p2 = OUT / "hutong_empty_view2_v10.png"
    img.save(p1)
    v2.save(p2)
    img.save(PREVIEW / "hutong_empty_view1_v10.png")
    v2.save(PREVIEW / "hutong_empty_view2_v10.png")
    img.save(ART / "hutong_empty_view1_v10.png")
    v2.save(ART / "hutong_empty_view2_v10.png")
    print(f"  wrote {p1.relative_to(ROOT)}")
    print(f"  wrote {p2.relative_to(ROOT)}")

    ends = {
        "left": (90, 488, 230, 690),
        "right": (1050, 488, 1190, 690),
    }
    for name, box in ends.items():
        a = crop4(img, box, 4)
        a.save(ART / f"hutong_v10_{name}_end_4x_redraw.png")
        if v9 is not None:
            b = crop4(Image.fromarray(v9), box, 4)
            b.save(ART / f"hutong_v9_{name}_end_4x_redraw.png")
            side_by_side(b, a).save(ART / f"hutong_v9v10_{name}_end_4x_redraw.png")
        print(f"  crop {name}")

    # extra audit crops
    for name, box in {
        "full": (0, 0, 1280, 720),
        "top_desk": (150, 170, 1130, 340),
        "bot_desk": (140, 480, 1140, 690),
        "logo": (80, 10, 520, 160),
        "frames": (860, 20, 1180, 155),
        "aisle": (200, 330, 1080, 490),
    }.items():
        if name == "full":
            img.save(ART / "hutong_empty_view1_v10_full.png")
        else:
            crop4(img, box, 2 if name in ("top_desk", "bot_desk") else 4).save(
                ART / f"hutong_v10_{name}_audit.png"
            )

    print("Done v10 redraw.")


if __name__ == "__main__":
    main()
