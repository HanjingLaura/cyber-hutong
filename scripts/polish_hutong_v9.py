#!/usr/bin/env python3
"""Polish approved hutong empty v8 → v9.

Does not redesign the room. Starts from the user-approved 1280×720 v8
and only repairs jagged edges, streaky grain, lost feet, uneven shadows,
grout/speckle, and a few smeared outlines. View 2 is view 1 cropped at y>=176.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC1 = Path("/tmp/hutong_v8/view1.png")
if not SRC1.exists():
    SRC1 = Path("/home/ubuntu/.cursor/projects/workspace/uploads/hutong_empty_view1_v8_35f5.png")
OUT_DIR = ROOT / "assets" / "hutong" / "room"
ART = Path("/opt/cursor/artifacts/screenshots")
PREVIEW = ROOT / "public" / "preview"

CROP_Y = 176

# measured on v8
BOT_TOP_Y0, BOT_TOP_Y1 = 497, 577  # inclusive light-wood top
BOT_PANEL_Y0, BOT_PANEL_Y1 = 578, 662
BOT_OUT_Y = 663
BOT_XL, BOT_XR = 163, 1114  # one width for top + panel
CHAMFER = 2
AISLE_Y0, AISLE_Y1 = 380, 468
TILE = 64
GROUT_ORIGIN_Y = 349

INK = np.array([26, 21, 15], np.uint8)
INK2 = np.array([36, 28, 20], np.uint8)
SIDE = np.array([72, 54, 36], np.uint8)
SIDE_HI = np.array([88, 66, 44], np.uint8)
LWOOD = np.array([205, 162, 116], np.uint8)
LWOOD2 = np.array([196, 154, 108], np.uint8)
PANEL = np.array([111, 82, 54], np.uint8)
PANEL_HI = np.array([126, 93, 62], np.uint8)
PANEL_D = np.array([96, 70, 46], np.uint8)
BEVEL = np.array([232, 198, 156], np.uint8)
FOOT = np.array([58, 42, 28], np.uint8)
FOOT_HI = np.array([78, 58, 38], np.uint8)
FLOOR = np.array([203, 199, 194], np.uint8)
GROUT = np.array([172, 169, 164], np.uint8)
SHADOW = np.array([168, 164, 158], np.uint8)
SHADOW2 = np.array([150, 146, 140], np.uint8)


def clamp(n):
    return 0 if n < 0 else 255 if n > 255 else n


def shade(c, amt):
    return np.array([clamp(int(c[0]) + amt), clamp(int(c[1]) + amt), clamp(int(c[2]) + amt)], np.uint8)


def is_grey(p, lo=150, hi=230, chroma=16):
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    return abs(r - g) < chroma and abs(g - b) < chroma and lo <= r <= hi


def is_wood(p):
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    return r > 70 and r > g + 8 and g > b and (r - b) > 20


def aisle_floor(orig, x, y, shadow=False):
    """Continue the real aisle tile at this x, same grout phase."""
    W = orig.shape[1]
    x = 0 if x < 0 else W - 1 if x >= W else x
    sy = AISLE_Y0 + ((y - GROUT_ORIGIN_Y) % TILE)
    if sy >= AISLE_Y1:
        sy = AISLE_Y0 + (sy - AISLE_Y1)
    p = orig[sy, x].copy()
    if shadow:
        p = shade(p, -22)
    return p


def paint_floor(im, orig, x, y, shadow=False):
    if y >= 682 or y < 176:
        return
    if 0 <= x < im.shape[1]:
        im[y, x] = aisle_floor(orig, x, y, shadow=shadow)


def restore_floor_rect(im, orig, x0, y0, x1, y1, shadow=False):
    H, W = im.shape[:2]
    for y in range(max(176, y0), min(H, y1 + 1)):
        if y >= 682:
            continue
        for x in range(max(0, x0), min(W, x1 + 1)):
            paint_floor(im, orig, x, y, shadow=shadow)


def row_interior_wood(im, y, x0, x1):
    """Mean light-wood of the inner third of this row (preserves v8 grain)."""
    a = x0 + (x1 - x0) // 3
    b = x0 + 2 * (x1 - x0) // 3
    sl = im[y, a:b]
    return sl.mean(axis=0).astype(np.uint8)


def rebuild_bottom_desk(im, orig):
    """One clean prism: straight top, matching side faces, flat back panel."""
    x0, x1 = BOT_XL, BOT_XR
    # wipe a halo (stepped sides, muddy shadow, copied speckle) back to aisle floor
    restore_floor_rect(im, orig, x0 - 28, BOT_TOP_Y0 - 16, x0 + 22, BOT_OUT_Y + 16)
    restore_floor_rect(im, orig, x1 - 22, BOT_TOP_Y0 - 16, x1 + 28, BOT_OUT_Y + 16)
    restore_floor_rect(im, orig, x0 - 8, BOT_TOP_Y0 - 16, x1 + 8, BOT_TOP_Y0 - 2)
    restore_floor_rect(im, orig, x0 - 8, BOT_OUT_Y, x1 + 8, min(681, BOT_OUT_Y + 16))

    # --- desktop top (from above), same width as the panel ---
    for y in range(BOT_TOP_Y0, BOT_TOP_Y1 + 1):
        inset = CHAMFER if y == BOT_TOP_Y0 else (1 if y == BOT_TOP_Y0 + 1 else 0)
        xl, xr = x0 + inset, x1 - inset
        srcy = min(max(y, BOT_TOP_Y0 + 6), BOT_TOP_Y1 - 6)
        for x in range(xl + 2, xr - 1):
            # rewrite only the wiped / stepped edge columns; keep the approved interior
            if x <= xl + 26 or x >= xr - 26 or not is_wood(im[y, x]):
                srcx = 500 + ((x - xl) % 90)
                src = orig[srcy, srcx]
                im[y, x] = src if is_wood(src) else LWOOD
        # 2px side face + 1px ink — same weight as the top desk
        im[y, xl] = INK2
        im[y, xl + 1] = SIDE
        im[y, xr] = INK2
        im[y, xr - 1] = SIDE
    # north outline of the top (thin, like the top desk)
    for x in range(x0 + CHAMFER, x1 - CHAMFER + 1):
        im[BOT_TOP_Y0 - 1, x] = INK2
        im[BOT_TOP_Y0, x] = INK2 if x in (x0 + CHAMFER, x1 - CHAMFER) else im[BOT_TOP_Y0, x]

    # --- back panel: flat 3-tone, drawer-like, no streaks ---
    # bevel where the top meets the panel
    for y, col in ((BOT_PANEL_Y0, BEVEL), (BOT_PANEL_Y0 + 1, shade(BEVEL, -16)), (BOT_PANEL_Y0 + 2, PANEL_HI)):
        for x in range(x0 + 2, x1 - 1):
            im[y, x] = col
    for y in range(BOT_PANEL_Y0 + 3, BOT_PANEL_Y1):
        for x in range(x0 + 3, x1 - 2):
            n = (x * 3 + y * 5) % 29
            if n == 0:
                im[y, x] = shade(PANEL, 6)
            elif n == 14:
                im[y, x] = shade(PANEL, -6)
            else:
                im[y, x] = PANEL
    # shared left/right outline + side face down the whole body
    for y in range(BOT_TOP_Y0, BOT_PANEL_Y1 + 1):
        im[y, x0] = INK
        im[y, x0 + 1] = SIDE
        im[y, x0 + 2] = SIDE_HI
        im[y, x1] = INK
        im[y, x1 - 1] = SIDE
        im[y, x1 - 2] = SIDE_HI
    for x in range(x0, x1 + 1):
        im[BOT_PANEL_Y1, x] = INK
        if x0 + 3 < x < x1 - 3:
            im[BOT_PANEL_Y1 - 1, x] = PANEL_D

    # even contact shadow (same 4px on both sides + underside)
    for y in range(BOT_TOP_Y0 + 6, BOT_OUT_Y + 11):
        for k in range(1, 5):
            paint_floor(im, orig, x0 - k, y, shadow=True)
            paint_floor(im, orig, x1 + k, y, shadow=True)
    for y in range(BOT_OUT_Y + 1, BOT_OUT_Y + 9):
        for x in range(x0 - 3, x1 + 4):
            paint_floor(im, orig, x, y, shadow=True)

    # feet LAST so the shadow cannot eat them
    def foot(cx, cy):
        for y in range(cy, cy + 6):
            for x in range(cx, cx + 12):
                im[y, x] = FOOT if y > cy and x > cx and y < cy + 5 and x < cx + 11 else INK
        for x in range(cx + 2, cx + 6):
            im[cy + 1, x] = FOOT_HI

    foot(x0 + 6, BOT_OUT_Y + 1)
    foot(x1 - 18, BOT_OUT_Y + 1)


def even_top_shadows(im, orig):
    """Even 3px side shadow on the top desk; do not touch legs."""
    top_xl, top_xr = 176, 1097
    for y in range(186, 328):
        for k in range(1, 4):
            for x in (top_xl - k, top_xr + k):
                if 0 <= x < im.shape[1] and is_grey(im[y, x], lo=140, hi=230):
                    paint_floor(im, orig, x, y, shadow=True)


def crisp_top_desk_corners(im):
    """Top desk far corners are already almost clean; snap leftover AA."""
    # left far corner
    for y, xl in ((179, 189), (180, 188), (181, 187), (182, 186)):
        # darken a 1px outline if the edge is a muddy mid-tone
        p = im[y, xl]
        if is_wood(p) or (40 < p[0] < 140):
            im[y, xl] = INK
    for y, xr in ((179, 1085), (180, 1086), (181, 1087), (182, 1088)):
        p = im[y, xr]
        if is_wood(p) or (40 < p[0] < 140):
            im[y, xr] = INK


def crisp_pedestals(im):
    """Snap smeared pedestal / handle outlines to a 1px ink."""
    # four pedestal bboxes measured from v8
    boxes = (
        (211, 254, 302, 318),
        (463, 254, 555, 318),
        (685, 254, 777, 318),
        (920, 254, 1012, 318),
    )
    for x0, y0, x1, y1 in boxes:
        # outer box already has an outline; reinforce if a mid-grey AA pixel sits on the rim
        for y in range(y0, y1 + 1):
            for x in (x0, x1):
                p = im[y, x]
                if 40 < int(p[0]) < 90 and int(p[0]) - int(p[2]) < 40:
                    im[y, x] = INK
        for x in range(x0, x1 + 1):
            for y in (y0, y1):
                p = im[y, x]
                if 40 < int(p[0]) < 90 and int(p[0]) - int(p[2]) < 40:
                    im[y, x] = INK


def crop4(im, box, z=4):
    c = Image.fromarray(im).crop(box)
    return c.resize((c.size[0] * z, c.size[1] * z), Image.Resampling.NEAREST)


def side_by_side(a, b):
    w = a.size[0] + b.size[0] + 8
    h = max(a.size[1], b.size[1])
    out = Image.new("RGB", (w, h), (32, 32, 32))
    out.paste(a, (0, 0))
    out.paste(b, (a.size[0] + 8, 0))
    return out


def write_artifacts(before, after):
    ART.mkdir(parents=True, exist_ok=True)
    spots = {
        "bot_top_left": (90, 488, 200, 600),
        "bot_top_right": (1080, 488, 1190, 600),
        "bot_panel": (300, 575, 700, 670),
        "bot_foot_left": (150, 648, 230, 690),
        "bot_foot_right": (1070, 648, 1150, 690),
        "bot_shadow_left": (130, 500, 180, 680),
        "bot_shadow_right": (1100, 500, 1160, 680),
        "grout_tl": (120, 470, 200, 510),
        "grout_tr": (1080, 470, 1160, 510),
        "top_pedestal": (200, 248, 320, 330),
        "top_leg_left": (160, 248, 230, 335),
        "wall_logo": (40, 20, 400, 160),
        "wall_frames": (900, 20, 1200, 160),
    }
    for name, box in spots.items():
        b = crop4(before, box, 4)
        a = crop4(after, box, 4)
        b.save(ART / f"hutong_v8_{name}_4x.png")
        a.save(ART / f"hutong_v9_{name}_4x.png")
        side_by_side(b, a).save(ART / f"hutong_v8v9_{name}_4x.png")
        print(f"  crop {name}")

    # full view side-by-side at 1x (stacked would be huge; place views adjacent)
    v8 = Image.fromarray(before)
    v9 = Image.fromarray(after)
    side_by_side(v8, v9).save(ART / "hutong_empty_v8_vs_v9.png")
    # also a compact 1x pair of just the bottom desk
    bb = (80, 470, 1200, 700)
    side_by_side(v8.crop(bb), v9.crop(bb)).save(ART / "hutong_empty_v8_vs_v9_bottom.png")


def main():
    print("Polishing hutong empty v8 → v9…")
    src = Image.open(SRC1).convert("RGB")
    before = np.array(src)
    orig = before.copy()
    im = before.copy()

    rebuild_bottom_desk(im, orig)
    even_top_shadows(im, orig)
    crisp_top_desk_corners(im)
    crisp_pedestals(im)

    v1 = Image.fromarray(im)
    v2 = v1.crop((0, CROP_Y, v1.size[0], v1.size[1]))
    assert v1.size == (1280, 720), v1.size
    assert v2.size == (1280, 544), v2.size
    assert np.array_equal(np.array(v2), im[CROP_Y:]), "view2 must be view1[y>=176]"

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    p1 = OUT_DIR / "hutong_empty_view1_v9.png"
    p2 = OUT_DIR / "hutong_empty_view2_v9.png"
    v1.save(p1)
    v2.save(p2)
    print(f"  wrote {p1.relative_to(ROOT)} {v1.size}")
    print(f"  wrote {p2.relative_to(ROOT)} {v2.size}")

    ART.mkdir(parents=True, exist_ok=True)
    v1.save(ART / "hutong_empty_view1_v9.png")
    v2.save(ART / "hutong_empty_view2_v9.png")
    PREVIEW.mkdir(parents=True, exist_ok=True)
    v1.save(PREVIEW / "hutong_empty_view1_v9.png")
    v2.save(PREVIEW / "hutong_empty_view2_v9.png")

    write_artifacts(before, im)
    print("Done v9.")


if __name__ == "__main__":
    main()
