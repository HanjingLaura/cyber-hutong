#!/usr/bin/env python3
"""Paint hutong empty room v11 from scratch.

Style target: Laura's base_v4 / v9 pixel texture (chunky grain, 2px ink,
framed wall, small oblique tiles). Structure: v10 bottom desk (one back
panel to the floor, feet attached, continuous grout, no end-grain seams).
View 2 is view 1 cropped at y>=176.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "hutong" / "room"
PREVIEW = ROOT / "public" / "preview"
ART = Path("/opt/cursor/artifacts/screenshots")

W, H = 1280, 720
CROP_Y = 176

# --- layout (v9/v10) ---
WALL_Y1 = 159
BASE_Y0, BASE_Y1 = 160, 175
FLOOR_Y0 = 176
BORDER = 3
BORDER_Y = 682

TOP_X, TOP_Y = 176, 179
TOP_W, TOP_TOP_H = 922, 75
TOP_SEAMS = (406, 636, 867)
TOP_PEDS = (212, 464, 686, 920)
TOP_PED_W = 96
TOP_PED_Y1 = 318
TOP_SLAB = 6

BOT_X, BOT_Y = 163, 497
BOT_W, BOT_TOP_H = 952, 81
BOT_SEAMS = (401, 638, 876)
BOT_PANEL_Y0, BOT_PANEL_Y1 = 580, 662
FOOT_W, FOOT_H = 12, 4
BOT_FEET = (BOT_X + 8, BOT_X + BOT_W - 20)

TILE = 44
GROUT_W = 2
LEAN = -0.14
TILE_OX, TILE_OY = 8, 176

# --- palette (v9 / base_v4) ---
INK = (26, 21, 15)
INK2 = (42, 36, 30)
WALL = (224, 221, 216)
WALL_HI = (242, 240, 236)
WALL_S = (208, 205, 200)
BASE = (46, 48, 54)
BASE_HI = (92, 93, 98)
BASE_D = (38, 39, 43)
FRAME_EDGE = (62, 64, 68)
FLOOR = (204, 201, 196)
FLOOR2 = (196, 193, 188)
FLOOR3 = (210, 207, 202)
GROUT = (228, 225, 220)
GROUT_D = (186, 183, 178)
WOOD = (210, 166, 118)
WOOD2 = (194, 150, 103)
WOOD_HI = (214, 176, 131)
WOOD_D = (176, 132, 88)
WOOD_PED = (162, 120, 78)
WOOD_PED2 = (148, 108, 68)
WOOD_PED_HI = (176, 134, 90)
WOOD_EDGE = (72, 45, 18)
SIDE = (68, 47, 26)
SIDE_HI = (104, 78, 53)
PANEL = (111, 82, 54)
PANEL2 = (96, 70, 46)
PANEL_HI = (126, 93, 62)
PANEL_D = (88, 64, 42)
BEVEL = (232, 198, 156)
BEVEL2 = (216, 182, 140)
FOOT = (58, 42, 28)
FOOT_HI = (78, 58, 38)
HANDLE = (42, 38, 36)
HANDLE_HI = (78, 74, 70)
MAT = (214, 214, 216)
ART_BG = (186, 186, 188)
ART_MT = (148, 148, 152)
ART_MT2 = (132, 132, 136)
BORDER_C = (22, 20, 24)
SUB = (28, 26, 30)


def clamp(n):
    return 0 if n < 0 else 255 if n > 255 else n


def shade(c, amt):
    return (clamp(c[0] + amt), clamp(c[1] + amt), clamp(c[2] + amt))


def mix(a, b, t):
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def rect(px, x0, y0, x1, y1, c):
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(W - 1, x1), min(H - 1, y1)
    if x1 >= x0 and y1 >= y0:
        px[y0 : y1 + 1, x0 : x1 + 1] = c


def hline(px, x0, x1, y, c):
    if 0 <= y < H:
        rect(px, x0, y, x1, y, c)


def vline(px, x, y0, y1, c):
    if 0 <= x < W:
        rect(px, x, y0, x, y1, c)


def ink_box(px, x0, y0, x1, y1, thick=2):
    for k in range(thick):
        hline(px, x0, x1, y0 + k, INK)
        hline(px, x0, x1, y1 - k, INK)
        vline(px, x0 + k, y0, y1, INK)
        vline(px, x1 - k, y0, y1, INK)


def is_floor_c(p):
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    return abs(r - g) < 22 and abs(g - b) < 22 and 145 < r < 235


FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    " ": ["000", "000", "000", "000", "000", "000", "000"],
}


def draw_text(px, x, y, text, color, scale=2, tracking=2):
    cx = x
    for ch in text:
        bits = FONT.get(ch, FONT[" "])
        w = len(bits[0])
        for row, rowbits in enumerate(bits):
            for col, bit in enumerate(rowbits):
                if bit != "1":
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        xx, yy = cx + col * scale + dx, y + row * scale + dy
                        if 0 <= xx < W and 0 <= yy < H:
                            px[yy, xx] = color
        cx += w * scale + tracking


def draw_ttc(px, x, y):
    def blk(sx, sy, w, h):
        rect(px, sx, sy, sx + w - 1, sy + h - 1, INK)

    # t
    blk(x + 18, y, 18, 56)
    blk(x, y + 18, 54, 16)
    blk(x + 18, y + 52, 28, 16)
    # t
    blk(x + 80, y, 18, 56)
    blk(x + 62, y + 18, 54, 16)
    blk(x + 80, y + 52, 28, 16)
    # c
    blk(x + 132, y + 16, 16, 52)
    blk(x + 132, y + 16, 44, 16)
    blk(x + 132, y + 52, 44, 16)


def draw_frame(px, x, y, w=64, h=48, seed=0):
    """Reference-sized frame: 2px ink, light mat, mountain pixel art, dark bevel."""
    # drop shadow
    hline(px, x + 2, x + w, y + h, shade(WALL, -18))
    vline(px, x + w, y + 2, y + h, shade(WALL, -18))
    ink_box(px, x, y, x + w - 1, y + h - 1, 2)
    rect(px, x + 2, y + 2, x + w - 3, y + h - 3, MAT)
    hline(px, x + 2, x + w - 3, y + 2, shade(MAT, 16))
    hline(px, x + 2, x + w - 3, y + h - 3, shade(MAT, -24))
    vline(px, x + 2, y + 2, y + h - 3, shade(MAT, 10))
    vline(px, x + w - 3, y + 2, y + h - 3, shade(MAT, -20))
    ix0, iy0, ix1, iy1 = x + 5, y + 5, x + w - 6, y + h - 6
    rect(px, ix0, iy0, ix1, iy1, ART_BG)
    ink_box(px, ix0 - 1, iy0 - 1, ix1 + 1, iy1 + 1, 1)
    peaks = [
        (0.18 + (seed % 3) * 0.04, 0.58 + (seed % 2) * 0.12),
        (0.48 + (seed % 4) * 0.05, 0.78 + (seed % 3) * 0.08),
        (0.80 + (seed % 2) * 0.03, 0.52 + (seed % 3) * 0.10),
    ]
    bw = ix1 - ix0 + 1
    bh = iy1 - iy0 + 1
    for xx in range(ix0, ix1 + 1):
        t = (xx - ix0) / max(1, bw - 1)
        hgt = 0.16
        for pxp, ph in peaks:
            hgt = max(hgt, ph * max(0.0, 1.0 - abs(t - pxp) * 3.4))
        top = iy1 - int(hgt * (bh - 2))
        col = ART_MT if ((xx + seed * 3) % 6) else ART_MT2
        rect(px, xx, top, xx, iy1, col)
        if top > iy0:
            px[top, xx] = shade(col, 12)


def paint_floor(px):
    """Small oblique tiles (~44px), per-tile shade + speckle, continuous grout."""
    rect(px, BORDER, FLOOR_Y0, W - 1 - BORDER, BORDER_Y - 1, FLOOR)
    rng = np.random.RandomState(4)

    max_n = 40
    for ty in range(-2, max_n):
        y0 = TILE_OY + ty * TILE
        y1 = y0 + TILE - 1
        if y1 < FLOOR_Y0 or y0 >= BORDER_Y:
            continue
        for tx in range(-4, 40):
            shade_amt = ((tx * 13 + ty * 7) % 7) * 2 - 6
            col = shade(FLOOR, shade_amt)
            col_d = shade(col, -8)
            for y in range(max(FLOOR_Y0, y0 + GROUT_W), min(BORDER_Y, y1 + 1)):
                shift = int(round((y - TILE_OY) * LEAN))
                x0 = TILE_OX + tx * TILE + shift
                x1 = x0 + TILE - 1
                xa = max(BORDER, x0 + GROUT_W)
                xb = min(W - 1 - BORDER, x1)
                if xb < xa:
                    continue
                px[y, xa : xb + 1] = col
                # cheap per-pixel tick so tiles aren't a flat fill
                for x in range(xa, xb + 1):
                    t = (x * 131 + y * 17) & 255
                    if t < 18:
                        px[y, x] = shade(col, -6)
                    elif t > 240:
                        px[y, x] = shade(col, 5)
                if y >= y1 - 1:
                    px[y, xa : xb + 1] = col_d
                else:
                    px[y, xb] = col_d

    # H grout — same y everywhere (light fill + darker south edge)
    for ty in range(-2, max_n):
        y0 = TILE_OY + ty * TILE
        if FLOOR_Y0 <= y0 < BORDER_Y:
            hline(px, BORDER, W - 1 - BORDER, y0, GROUT)
        if FLOOR_Y0 <= y0 + 1 < BORDER_Y:
            hline(px, BORDER, W - 1 - BORDER, y0 + 1, GROUT_D)

    # V grout — lean, continuous beside desks (furniture painted later)
    for tx in range(-4, 40):
        for y in range(FLOOR_Y0, BORDER_Y):
            shift = int(round((y - TILE_OY) * LEAN))
            x = TILE_OX + tx * TILE + shift
            if BORDER <= x < W - BORDER:
                px[y, x] = GROUT
            if BORDER <= x + 1 < W - BORDER:
                px[y, x + 1] = GROUT_D

    for _ in range(9000):
        x = int(rng.randint(BORDER, W - BORDER))
        y = int(rng.randint(FLOOR_Y0, BORDER_Y))
        p = tuple(int(c) for c in px[y, x])
        if is_floor_c(p) and p not in (GROUT, GROUT_D):
            px[y, x] = shade(p, int(rng.randint(-9, 8)))


def paint_wall(px):
    """Framed wall panel: dark outer border, bevel, dark baseboard rail."""
    rect(px, BORDER, BORDER, W - 1 - BORDER, WALL_Y1, WALL)
    rng = np.random.RandomState(2)
    for _ in range(1800):
        x = int(rng.randint(BORDER + 2, W - BORDER - 2))
        y = int(rng.randint(BORDER + 4, WALL_Y1 - 2))
        px[y, x] = shade(WALL, int(rng.randint(-7, 6)))

    # top / bottom bevel of the panel
    hline(px, BORDER, W - 1 - BORDER, BORDER, WALL_HI)
    hline(px, BORDER, W - 1 - BORDER, BORDER + 1, shade(WALL_HI, -8))
    hline(px, BORDER, W - 1 - BORDER, WALL_Y1 - 1, WALL_S)
    hline(px, BORDER, W - 1 - BORDER, WALL_Y1, shade(WALL_S, -12))
    vline(px, BORDER, BORDER, WALL_Y1, shade(WALL, 8))
    vline(px, W - 1 - BORDER, BORDER, WALL_Y1, WALL_S)

    # dark baseboard rail between wall and floor
    rect(px, BORDER, BASE_Y0, W - 1 - BORDER, BASE_Y1, BASE)
    hline(px, BORDER, W - 1 - BORDER, BASE_Y0, shade(WALL, -18))
    hline(px, BORDER, W - 1 - BORDER, BASE_Y0 + 1, BASE_HI)
    hline(px, BORDER, W - 1 - BORDER, BASE_Y0 + 2, shade(BASE_HI, -14))
    hline(px, BORDER, W - 1 - BORDER, BASE_Y1 - 1, BASE_D)
    hline(px, BORDER, W - 1 - BORDER, BASE_Y1, INK)

    draw_ttc(px, 118, 26)
    draw_text(px, 120, 116, "TRUE TALENTS CONNECT", SUB, scale=2, tracking=3)

    fx0, fy0, pitch_x, pitch_y = 852, 28, 80, 58
    for row in range(2):
        for col in range(4):
            draw_frame(px, fx0 + col * pitch_x, fy0 + row * pitch_y, 64, 48, seed=row * 4 + col)


def wood_at(x, y, base=WOOD):
    """Chunky horizontal 2–3 tone grain plus fine ticks (v9 density)."""
    band = y // 4
    h = (band * 1103515245 + 12345) & 0x7FFFFFFF
    kind = (h ^ (band * 19)) % 7
    if base is WOOD:
        tones = (WOOD, WOOD2, WOOD_HI)
    elif base is WOOD_PED:
        tones = (WOOD_PED, WOOD_PED2, WOOD_PED_HI)
    else:
        tones = (base, shade(base, -14), shade(base, 10))
    if kind == 0:
        col = tones[1]
    elif kind == 1:
        col = tones[2]
    else:
        col = tones[0]
    slen = 20 + ((h >> 8) % 36)
    phase = (x + ((h >> 3) % 40)) % slen
    if phase < 7:
        col = shade(col, -10)
    elif phase > slen - 5:
        col = shade(col, 6)
    # fine per-pixel ticks so the slab is not a 3-color fill
    pix = (x * 131 + y * 17 + band * 29) & 255
    if pix < 14:
        col = shade(col, -7)
    elif pix > 244:
        col = shade(col, 6)
    elif pix % 37 == 0:
        col = shade(col, -4)
    return col


def fill_wood(px, x0, y0, x1, y1, base=WOOD):
    for y in range(max(0, y0), min(H, y1 + 1)):
        for x in range(max(0, x0), min(W, x1 + 1)):
            px[y, x] = wood_at(x, y, base)


def chamfer_top(px, x0, y0, x1, ch=3):
    for k in range(ch):
        # cut far corners to floor-colored? no — ink stair
        px[y0 + k, x0 + ch - 1 - k] = INK
        px[y0 + k, x1 - ch + 1 + k] = INK
        for t in range(ch - 1 - k):
            # outside the chamfer stays whatever was there (floor)
            pass


def paint_leg(px, x, y0, y1):
    """Dark 12px post, left highlight, small foot — v9 weight."""
    box_w = 12
    ink_box(px, x, y0, x + box_w - 1, y1 + 2, 2)
    rect(px, x + 2, y0, x + box_w - 3, y1, SIDE)
    vline(px, x + 2, y0, y1, SIDE_HI)
    vline(px, x + 3, y0, y1, shade(SIDE, 8))
    vline(px, x + box_w - 3, y0, y1, shade(SIDE, -12))
    rect(px, x, y1 + 1, x + box_w - 1, y1 + 3, INK)
    rect(px, x + 2, y1 + 2, x + box_w - 3, y1 + 2, FOOT)


def paint_pedestal(px, x0, y0, x1, y1):
    # darker wood than the desktop (v9 pedestals sit in shade)
    fill_wood(px, x0 + 2, y0 + 2, x1 - 9, y1 - 2, WOOD_PED)
    # right side face
    rect(px, x1 - 8, y0 + 2, x1 - 3, y1 - 2, SIDE)
    vline(px, x1 - 8, y0 + 2, y1 - 2, SIDE_HI)
    vline(px, x1 - 3, y0 + 2, y1 - 2, shade(SIDE, -14))
    ink_box(px, x0, y0, x1, y1, 2)
    mid = (y0 + y1) // 2
    hline(px, x0 + 2, x1 - 9, mid, INK)
    hline(px, x0 + 2, x1 - 9, mid + 1, INK)

    def handle(hy):
        hx0, hx1 = x0 + 22, x1 - 32
        # 7px rounded bar with top highlight (v9)
        ink_box(px, hx0, hy, hx1, hy + 6, 1)
        rect(px, hx0 + 1, hy + 1, hx1 - 1, hy + 5, HANDLE)
        hline(px, hx0 + 2, hx1 - 2, hy + 1, HANDLE_HI)
        hline(px, hx0 + 2, hx1 - 2, hy + 2, shade(HANDLE_HI, -8))
        px[hy + 1, hx0 + 1] = INK
        px[hy + 5, hx0 + 1] = INK
        px[hy + 1, hx1 - 1] = INK
        px[hy + 5, hx1 - 1] = INK

    handle(y0 + 14)
    handle(mid + 12)
    for fx in (x0 + 5, x1 - 12):
        ink_box(px, fx, y1 + 1, fx + 6, y1 + 3, 1)
        rect(px, fx + 1, y1 + 2, fx + 5, y1 + 2, FOOT)


def paint_top_desk(px):
    x0, y0 = TOP_X, TOP_Y
    x1 = x0 + TOP_W - 1
    yt1 = y0 + TOP_TOP_H - 1
    join = yt1 + 1
    slab_y1 = join + TOP_SLAB - 1
    ped_y0 = join

    # single dark leg at each outer end; a close pair at every segment joint
    paint_leg(px, x0 + 6, ped_y0, TOP_PED_Y1)
    paint_leg(px, x1 - 18, ped_y0, TOP_PED_Y1)
    for sx in TOP_SEAMS:
        paint_leg(px, sx - 16, ped_y0, TOP_PED_Y1)
        paint_leg(px, sx + 4, ped_y0, TOP_PED_Y1)

    for px0 in TOP_PEDS:
        paint_pedestal(px, px0, ped_y0, px0 + TOP_PED_W - 1, TOP_PED_Y1)

    # desktop — continuous grain, 2px outline, highlight, thickness strip
    fill_wood(px, x0 + 2, y0 + 2, x1 - 2, yt1)
    hline(px, x0 + 4, x1 - 4, y0 + 2, WOOD_HI)
    hline(px, x0 + 4, x1 - 4, y0 + 3, shade(WOOD_HI, -6))
    for sx in TOP_SEAMS:
        vline(px, sx, y0 + 3, yt1 - 6, WOOD_EDGE)
        vline(px, sx + 1, y0 + 3, yt1 - 6, shade(WOOD_HI, -8))

    # darker front-edge thickness (last 7px of the top + the slab)
    for y in range(yt1 - 6, yt1 + 1):
        hline(px, x0 + 2, x1 - 2, y, shade(WOOD_D, 8 if y < yt1 - 2 else -4))
    rect(px, x0 + 2, join, x1 - 2, slab_y1, WOOD_D)
    hline(px, x0 + 3, x1 - 3, join, shade(WOOD_D, 18))
    hline(px, x0 + 2, x1 - 2, slab_y1 - 1, shade(WOOD_D, -8))
    hline(px, x0 + 2, x1 - 2, slab_y1, WOOD_EDGE)

    ink_box(px, x0, y0, x1, slab_y1, 2)
    # 2px stair chamfer on the far corners
    for k in range(4):
        px[y0 + k, x0 + 3 - k] = INK
        px[y0 + k, x0 + 4 - k] = INK
        px[y0 + k, x1 - (3 - k)] = INK
        px[y0 + k, x1 - (4 - k)] = INK


def paint_bottom_desk(px):
    x0, y0 = BOT_X, BOT_Y
    x1 = x0 + BOT_W - 1
    yt1 = y0 + BOT_TOP_H - 1

    fill_wood(px, x0 + 2, y0 + 2, x1 - 2, yt1)
    hline(px, x0 + 4, x1 - 4, y0 + 2, WOOD_HI)
    hline(px, x0 + 4, x1 - 4, y0 + 3, shade(WOOD_HI, -6))
    for sx in BOT_SEAMS:
        vline(px, sx, y0 + 3, yt1, WOOD_EDGE)
        vline(px, sx + 1, y0 + 3, yt1, shade(WOOD_HI, -8))

    # front-edge thickness of the desktop (lighter strip) then panel lip
    for y in range(yt1 - 4, yt1 + 1):
        hline(px, x0 + 2, x1 - 2, y, BEVEL if y < yt1 - 1 else BEVEL2)
    hline(px, x0 + 2, x1 - 2, BOT_PANEL_Y0, BEVEL)
    hline(px, x0 + 2, x1 - 2, BOT_PANEL_Y0 + 1, shade(BEVEL, -16))

    # back panel: darker wood, subtle vertical grain + speckle (not a flat rect)
    rng = np.random.RandomState(9)
    for y in range(BOT_PANEL_Y0 + 2, BOT_PANEL_Y1):
        for x in range(x0 + 2, x1 - 1):
            band = x // 8
            kind = (band * 13 + y // 11) % 6
            col = PANEL
            if kind == 0:
                col = shade(PANEL, -8)
            elif kind == 1:
                col = shade(PANEL, 7)
            if ((x + band * 3) % 19) == 0:
                col = shade(col, -6)
            px[y, x] = col
    # v9-style dotted speckle plus a few extra ticks
    for y in range(BOT_PANEL_Y0 + 4, BOT_PANEL_Y1 - 2, 4):
        for x in range(x0 + 5, x1 - 4, 5):
            if (x + y) % 2 == 0:
                px[y, x] = shade(tuple(int(c) for c in px[y, x]), -10)
    for _ in range(400):
        x = int(rng.randint(x0 + 3, x1 - 2))
        y = int(rng.randint(BOT_PANEL_Y0 + 4, BOT_PANEL_Y1 - 2))
        px[y, x] = shade(tuple(int(c) for c in px[y, x]), -8 if rng.rand() < 0.55 else 6)
    for vx in (x0 + BOT_W // 4, x0 + BOT_W // 2, x0 + 3 * BOT_W // 4):
        vline(px, vx, BOT_PANEL_Y0 + 6, BOT_PANEL_Y1 - 5, shade(PANEL, -10))

    hline(px, x0 + 2, x1 - 2, BOT_PANEL_Y1 - 1, PANEL_D)
    hline(px, x0 + 2, x1 - 2, BOT_PANEL_Y1, INK)

    # 2px outline around the whole body
    ink_box(px, x0, y0, x1, BOT_PANEL_Y1, 2)
    for k in range(4):
        px[y0 + k, x0 + 3 - k] = INK
        px[y0 + k, x0 + 4 - k] = INK
        px[y0 + k, x1 - (3 - k)] = INK
        px[y0 + k, x1 - (4 - k)] = INK

    # side thickness
    vline(px, x0 + 2, y0 + 4, BOT_PANEL_Y1 - 2, SIDE)
    vline(px, x1 - 2, y0 + 4, BOT_PANEL_Y1 - 2, SIDE)

    # 12×4 feet flush on the outline — no floor gap
    yf0 = BOT_PANEL_Y1 + 1
    for fx in BOT_FEET:
        for y in range(yf0, yf0 + FOOT_H):
            for x in range(fx, fx + FOOT_W):
                edge = y in (yf0, yf0 + FOOT_H - 1) or x in (fx, fx + FOOT_W - 1)
                px[y, x] = INK if edge else (FOOT_HI if y == yf0 + 1 and 2 <= x - fx <= 5 else FOOT)


def darken_floor(px, x, y, amt):
    if BORDER <= x < W - BORDER and FLOOR_Y0 <= y < BORDER_Y and is_floor_c(px[y, x]):
        px[y, x] = shade(tuple(int(c) for c in px[y, x]), amt)


def paint_shadows(px):
    x0, x1 = TOP_X, TOP_X + TOP_W - 1
    for y in range(TOP_Y + 8, TOP_PED_Y1 + 8):
        for k in range(1, 5):
            darken_floor(px, x0 - k, y, -14)
            darken_floor(px, x1 + k, y, -14)
    for y in range(TOP_PED_Y1 + 4, TOP_PED_Y1 + 8):
        for x in range(x0 - 2, x1 + 3):
            darken_floor(px, x, y, -12)

    bx0, bx1 = BOT_X, BOT_X + BOT_W - 1
    for y in range(BOT_Y + 8, BOT_PANEL_Y1 + 1):
        for k in range(1, 5):
            darken_floor(px, bx0 - k, y, -16)
            darken_floor(px, bx1 + k, y, -16)
    fb = BOT_PANEL_Y1 + 1 + FOOT_H
    for y in range(fb, fb + 5):
        for x in range(bx0 - 3, bx1 + 4):
            darken_floor(px, x, y, -18)


def paint_room_border(px):
    """Dark frame on left, right and bottom (and top of the wall panel)."""
    rect(px, 0, 0, BORDER - 1, H - 1, BORDER_C)
    rect(px, W - BORDER, 0, W - 1, H - 1, BORDER_C)
    rect(px, 0, 0, W - 1, BORDER - 1, BORDER_C)
    rect(px, 0, BORDER_Y, W - 1, H - 1, BORDER_C)
    # inner rim
    vline(px, BORDER, BORDER, BORDER_Y - 1, FRAME_EDGE)
    vline(px, W - 1 - BORDER, BORDER, BORDER_Y - 1, FRAME_EDGE)
    hline(px, BORDER, W - 1 - BORDER, BORDER_Y - 1, FRAME_EDGE)


def crop4(im, box, z=4):
    c = im.crop(box)
    return c.resize((c.size[0] * z, c.size[1] * z), Image.Resampling.NEAREST)


def side_by_side(a, b):
    out = Image.new("RGB", (a.size[0] + b.size[0] + 8, max(a.size[1], b.size[1])), (32, 32, 32))
    out.paste(a, (0, 0))
    out.paste(b, (a.size[0] + 8, 0))
    return out


def grout_rows(im, x0, x1, y0, y1):
    """Rows whose mean is farther from the tile body (light or dark grout)."""
    sl = im[y0:y1, x0:x1].astype(np.int16)
    m = sl.mean(axis=(1, 2))
    med = np.median(m)
    return [y0 + i for i, v in enumerate(m) if abs(v - med) > 8]


def audit(v11):
    print("audit v11")
    # sample bands that sit between V grout columns
    far = grout_rows(v11, 20, 50, 500, 670)
    strip = grout_rows(v11, 100, 140, 500, 670)
    print(f"  H grout far {far}")
    print(f"  H grout strip {strip}")
    # keep only the 2px grout clusters
    def clusters(rows):
        if not rows:
            return []
        out, s, p = [], rows[0], rows[0]
        for r in rows[1:]:
            if r > p + 2:
                out.append((s, p))
                s = r
            p = r
        out.append((s, p))
        return out

    print(f"  clusters far {clusters(far)} strip {clusters(strip)}")
    for name, fx in (("L", BOT_FEET[0]), ("R", BOT_FEET[1])):
        gap = any(is_floor_c(v11[BOT_PANEL_Y1 + 1, x]) for x in range(fx, fx + FOOT_W))
        print(f"  foot {name} gap={gap}")


def main():
    print("Painting hutong empty v11…")
    px = np.zeros((H, W, 3), dtype=np.uint8)
    paint_floor(px)
    paint_wall(px)
    paint_top_desk(px)
    paint_bottom_desk(px)
    paint_shadows(px)
    paint_room_border(px)

    img = Image.fromarray(px, "RGB")
    v2 = img.crop((0, CROP_Y, W, H))
    assert img.size == (1280, 720)
    assert v2.size == (1280, 544)
    assert np.array_equal(np.array(v2), px[CROP_Y:])
    audit(px)

    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    p1 = OUT / "hutong_empty_view1_v11.png"
    p2 = OUT / "hutong_empty_view2_v11.png"
    img.save(p1)
    v2.save(p2)
    img.save(PREVIEW / "hutong_empty_view1_v11.png")
    v2.save(PREVIEW / "hutong_empty_view2_v11.png")
    img.save(ART / "hutong_empty_view1_v11.png")
    v2.save(ART / "hutong_empty_view2_v11.png")
    print(f"  wrote {p1.relative_to(ROOT)}")
    print(f"  wrote {p2.relative_to(ROOT)}")

    v9p = OUT / "hutong_empty_view1_v9.png"
    v9 = Image.open(v9p).convert("RGB") if v9p.exists() else None

    crops = {
        "bot_left": (90, 488, 230, 690),
        "bot_right": (1050, 488, 1190, 690),
        "top_joint": (380, 170, 460, 340),
        "top_joint_wide": (360, 170, 680, 340),
        "top_left": (160, 170, 450, 340),
        "frames": (840, 20, 1180, 155),
        "wall_left": (0, 0, 80, 180),
        "aisle": (200, 330, 1080, 490),
    }
    for name, box in crops.items():
        a = crop4(img, box, 4)
        a.save(ART / f"hutong_v11_{name}_4x.png")
        if v9 is not None:
            b = crop4(v9, box, 4)
            side_by_side(b, a).save(ART / f"hutong_v9v11_{name}_4x.png")
        print(f"  crop {name}")

    if v9 is not None:
        side_by_side(v9, img).save(ART / "hutong_v9v11_1x.png")
        # compact bottom pair
        bb = (80, 170, 1200, 700)
        side_by_side(v9.crop(bb), img.crop(bb)).save(ART / "hutong_v9v11_desks_1x.png")

    print("Done v11.")


if __name__ == "__main__":
    main()
