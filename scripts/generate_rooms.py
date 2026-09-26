#!/usr/bin/env python3
"""11 Laura-named scenes — 2.5D refined pixel, 256×192, empty desk pads.

v4: hawaii open window + 6 seats; hutong 4 top-wall desks + 4 bottom-wall desks, 8 mid chairs;
concert / cafe / gym / mixian added. Same 1px ink + wall-FACE language.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pxlib import (  # noqa: E402
    ASSETS,
    INK,
    PAL,
    PREVIEW,
    ROOT,
    SHADOW,
    WHITE,
    blit,
    box1,
    carpet,
    dither,
    downlight,
    drop_shadow,
    empty_pad,
    fluorescent,
    hline,
    letter_3d,
    light_pool,
    marble,
    mix,
    new,
    noise,
    oval_shadow,
    outline_sprite,
    solid_shadow,
    prism,
    rect,
    save,
    shade,
    tile_floor,
    tiny_text,
    vline,
    wall_face,
    wood_planks,
    zoom,
)
import generate_cast as gc  # noqa: E402

W, H = 256, 192

HT = {
    "ceil": (248, 246, 242, 255),
    "wall": (238, 234, 228, 255),
    "wall_d": (206, 200, 192, 255),
    "lip": (188, 182, 174, 255),
    "trim": (42, 38, 44, 255),
    "floor": (196, 196, 200, 255),
    "floor2": (180, 180, 186, 255),
    "gap": (156, 156, 162, 255),
    "desk": (232, 220, 200, 255),
    "desk_hi": (246, 238, 222, 255),
    "desk_e": (164, 148, 124, 255),
    "pad": (242, 232, 214, 255),
    "chair": (36, 36, 40, 255),
    "mesh": (62, 62, 70, 255),
    "sun": (255, 236, 196, 255),
    "frame": (250, 248, 244, 255),
}
EL = {
    "stone": (228, 210, 176, 255),
    "stone_d": (196, 172, 136, 255),
    "vein": (176, 152, 116, 255),
    "hi": (246, 232, 204, 255),
    "floor": (240, 230, 210, 255),
    "floor2": (224, 212, 190, 255),
    "grout": (198, 182, 156, 255),
    "ceil": (248, 240, 224, 255),
    "door": (214, 198, 168, 255),
    "door_d": (154, 138, 110, 255),
    "shaft": (22, 20, 24, 255),
    "cabin": (255, 228, 176, 255),
    "ped": (22, 22, 26, 255),
    "statue": (78, 66, 56, 255),
    "bronze": (122, 92, 64, 255),
    "screen": (16, 16, 20, 255),
    "red": (204, 44, 52, 255),
}
HW = {
    "wall": (244, 234, 214, 255),
    "cream": (250, 242, 224, 255),
    "blind": (168, 164, 156, 255),
    "blind_d": (128, 124, 116, 255),
    "blind_hi": (196, 192, 184, 255),
    "floor": (196, 148, 92, 255),
    "floor2": (174, 126, 74, 255),
    "gap": (120, 84, 48, 255),
    "desk": (186, 128, 64, 255),
    "desk_hi": (220, 168, 96, 255),
    "desk_e": (110, 70, 36, 255),
    "pad": (232, 196, 130, 255),
    "sun": (255, 226, 150, 255),
    "jacket": (244, 240, 232, 255),
    "sky": (126, 192, 236, 255),
    "sky2": (78, 154, 216, 255),
    "sky3": (206, 232, 252, 255),
    "bldg": (42, 48, 72, 255),
    "bldg2": (28, 34, 56, 255),
    "bldg3": (64, 56, 92, 255),
    "bldg4": (78, 88, 110, 255),
    "lit": (255, 214, 130, 255),
    "neon_c": (70, 230, 206, 255),
    "neon_p": (255, 96, 168, 255),
}
CN = {
    "floor": (36, 28, 44, 255),
    "floor2": (28, 22, 36, 255),
    "wall": (52, 36, 64, 255),
    "stage": (88, 48, 96, 255),
    "wood": (160, 96, 64, 255),
    "spot": (255, 220, 140, 255),
    "neon": (255, 90, 160, 255),
    "seat": (72, 40, 80, 255),
    "pad": (236, 220, 200, 255),
}
CF = {
    "floor": (186, 140, 88, 255),
    "floor2": (164, 118, 70, 255),
    "gap": (120, 82, 46, 255),
    "wall": (246, 232, 210, 255),
    "counter": (168, 96, 64, 255),
    "counter_d": (120, 64, 40, 255),
    "pad": (240, 220, 180, 255),
    "cup": (120, 72, 48, 255),
    "plant": (46, 110, 78, 255),
}
GY = {
    "floor": (48, 48, 52, 255),
    "floor2": (36, 36, 40, 255),
    "wall": (70, 72, 78, 255),
    "metal": (160, 166, 176, 255),
    "rubber": (32, 32, 36, 255),
    "pad": (220, 220, 224, 255),
    "red": (196, 56, 56, 255),
}
MX = {
    "floor": (214, 170, 110, 255),
    "floor2": (190, 146, 88, 255),
    "wall": (196, 72, 56, 255),
    "wood": (176, 112, 64, 255),
    "wood_e": (120, 72, 40, 255),
    "steam": (240, 236, 228, 255),
    "bowl": (250, 244, 230, 255),
    "pad": (244, 226, 186, 255),
    "lantern": (255, 160, 70, 255),
}
PM = {
    "a": (255, 206, 222, 255),
    "b": (178, 232, 220, 255),
    "grout": (255, 150, 184, 255),
    "wall": (104, 56, 142, 255),
    "wall_hi": (150, 90, 194, 255),
    "neon": (255, 86, 158, 255),
    "neon2": (70, 230, 206, 255),
    "shelf": (248, 240, 246, 255),
    "counter": (246, 156, 186, 255),
    "counter_d": (196, 88, 132, 255),
    "glass": (196, 244, 238, 255),
    "pad": (255, 226, 236, 255),
}
RR = {
    "floor": (198, 226, 218, 255),
    "floor2": (174, 208, 200, 255),
    "grout": (140, 178, 170, 255),
    "wall": (230, 242, 238, 255),
    "hi": (250, 254, 252, 255),
    "stall": (164, 200, 190, 255),
    "stall_d": (112, 156, 146, 255),
    "porc": (250, 252, 255, 255),
    "wet": (168, 214, 226, 255),
    "metal": (148, 166, 176, 255),
    "peach": (255, 176, 186, 255),
}
OF = {
    "floor": (148, 164, 180, 255),
    "floor2": (128, 144, 162, 255),
    "grout": (102, 118, 136, 255),
    "wall": (214, 220, 228, 255),
    "desk": (224, 206, 174, 255),
    "desk_hi": (242, 228, 200, 255),
    "desk_e": (148, 124, 90, 255),
    "pad": (238, 222, 190, 255),
    "win": (168, 200, 220, 255),
}
MT = {
    "floor": (78, 72, 88, 255),
    "floor2": (62, 56, 74, 255),
    "wall": (98, 88, 108, 255),
    "wood": (160, 112, 70, 255),
    "wood_hi": (196, 148, 96, 255),
    "wood_e": (104, 68, 40, 255),
    "pad": (232, 216, 180, 255),
    "screen": (22, 28, 40, 255),
    "holo": (86, 216, 206, 255),
}

BOXC = [
    (255, 140, 180, 255),
    (100, 224, 196, 255),
    (255, 214, 90, 255),
    (186, 150, 255, 255),
    (120, 196, 255, 255),
    (255, 158, 86, 255),
]


def prop_cup(color=(236, 236, 240, 255)) -> Image.Image:
    img = new(7, 9)
    d = ImageDraw.Draw(img)
    prism(d, 1, 1, 5, 2, 5, color, shade(color, -36), shade(color, -50))
    hline(d, 2, 5, 1, shade(color, -70))
    d.point((6, 4), fill=PAL["metal"])  # handle
    return outline_sprite(img)


def prop_notebook() -> Image.Image:
    img = new(11, 9)
    d = ImageDraw.Draw(img)
    prism(d, 0, 1, 10, 3, 4, WHITE, (64, 110, 176, 255), (46, 84, 142, 255))
    hline(d, 2, 8, 3, (176, 186, 198, 255))
    hline(d, 2, 7, 4, (200, 206, 214, 255))
    return outline_sprite(img)


def prop_laptop(open_=True) -> Image.Image:
    img = new(14, 12)
    d = ImageDraw.Draw(img)
    prism(d, 1, 7, 12, 2, 2, PAL["metal"], PAL["metal_d"])
    if open_:
        box1(d, 2, 1, 12, 8, (28, 36, 48, 255))
        rect(d, [3, 2, 11, 6], (40, 52, 64, 255))
        d.point((6, 3), fill=(110, 220, 200, 255))
        d.point((7, 4), fill=WHITE)
        hline(d, 4, 10, 6, (70, 90, 100, 255))
    return outline_sprite(img)


def prop_phone() -> Image.Image:
    img = new(5, 9)
    d = ImageDraw.Draw(img)
    box1(d, 0, 0, 4, 8, (18, 18, 22, 255))
    rect(d, [1, 1, 3, 6], (40, 44, 52, 255))
    d.point((2, 7), fill=(80, 80, 88, 255))
    return img


def prop_blindbox(color=None) -> Image.Image:
    c = color or BOXC[0]
    img = new(9, 10)
    d = ImageDraw.Draw(img)
    prism(d, 1, 1, 7, 2, 6, c, shade(c, -36))
    hline(d, 2, 6, 2, WHITE)
    d.point((4, 5), fill=(90, 50, 140, 255))
    d.point((3, 6), fill=shade(c, 30))
    return outline_sprite(img)


def prop_plant() -> Image.Image:
    img = new(11, 16)
    d = ImageDraw.Draw(img)
    prism(d, 3, 10, 5, 2, 4, WHITE, PAL["metal"])
    for p, c in (
        ((5, 1), PAL["green"]), ((4, 2), PAL["green"]), ((6, 2), PAL["green_hi"]),
        ((3, 4), PAL["green"]), ((7, 4), PAL["green_hi"]), ((5, 5), PAL["green_d"]),
        ((4, 6), PAL["green"]), ((6, 7), PAL["green"]), ((5, 8), PAL["green_hi"]),
        ((2, 6), PAL["green_d"]), ((8, 5), PAL["green"]),
    ):
        d.point(p, fill=c)
    return outline_sprite(img)


def prop_spray() -> Image.Image:
    img = new(6, 11)
    d = ImageDraw.Draw(img)
    box1(d, 1, 3, 4, 10, (214, 228, 238, 255))
    rect(d, [1, 1, 4, 3], PAL["metal"])
    d.point((2, 0), fill=PAL["metal_d"])
    d.point((3, 0), fill=PAL["metal"])
    dither(d, 2, 5, 3, 8, WHITE, 2)
    return outline_sprite(img)


def prop_bottle() -> Image.Image:
    img = new(6, 12)
    d = ImageDraw.Draw(img)
    box1(d, 1, 3, 4, 11, (20, 20, 24, 255))
    rect(d, [2, 1, 3, 3], PAL["metal"])
    d.point((2, 0), fill=PAL["metal_d"])
    d.point((2, 5), fill=(70, 70, 78, 255))
    return outline_sprite(img)


def chair_south(jacket=False) -> Image.Image:
    """Chair facing the near/bottom wall — we see the seat, back is away."""
    img = new(22, 24)
    d = ImageDraw.Draw(img)
    solid_shadow(d, 11, 22, 8, 2)
    # low backrest away from camera (top of sprite)
    prism(d, 5, 1, 12, 5, 2, HT["chair"], shade(HT["chair"], -16), HT["mesh"])
    for y in range(2, 6):
        for x in range(7, 15):
            if (x + y) % 2 == 0:
                d.point((x, y), fill=HT["mesh"])
    prism(d, 3, 8, 15, 6, 4, HT["mesh"], HT["chair"])
    vline(d, 10, 14, 20, PAL["metal"])
    vline(d, 11, 14, 20, PAL["metal_d"])
    hline(d, 4, 17, 20, PAL["metal_d"])
    d.point((4, 21), fill=PAL["metal"])
    d.point((17, 21), fill=PAL["metal"])
    if jacket:
        rect(d, [6, 9, 15, 14], HW["jacket"])
    return outline_sprite(img)


def chair_north(jacket=False) -> Image.Image:
    """Mesh task chair facing the far wall — BACK toward the aisle."""
    img = new(22, 28)
    d = ImageDraw.Draw(img)
    solid_shadow(d, 11, 26, 8, 2)
    # stem + casters (not a checkered sock)
    vline(d, 10, 18, 24, PAL["metal"])
    vline(d, 11, 18, 24, PAL["metal_d"])
    hline(d, 4, 17, 24, PAL["metal_d"])
    d.point((4, 25), fill=PAL["metal"])
    d.point((17, 25), fill=PAL["metal"])
    d.point((10, 25), fill=PAL["metal_hi"])
    # seat cushion 2.5D
    prism(d, 4, 16, 13, 3, 3, HT["mesh"], HT["chair"])
    # mesh BACK as a real slab
    prism(d, 3, 1, 14, 14, 3, HT["chair"], shade(HT["chair"], -16), HT["mesh"])
    for y in range(3, 14):
        for x in range(5, 15):
            if (x + y * 2) % 3 == 0:
                d.point((x, y), fill=HT["mesh"])
    hline(d, 5, 15, 2, (96, 96, 104, 255))
    vline(d, 2, 10, 18, PAL["metal"])
    vline(d, 18, 10, 18, PAL["metal"])
    hline(d, 2, 4, 10, PAL["metal_hi"])
    hline(d, 16, 18, 10, PAL["metal_hi"])
    if jacket:
        rect(d, [6, 4, 15, 13], HW["jacket"])
        hline(d, 7, 14, 5, shade(HW["jacket"], -20))
        vline(d, 6, 6, 12, shade(HW["jacket"], -28))
    return outline_sprite(img)


def chair_east(jacket=False) -> Image.Image:
    """Seat to the right (facing an east-side vertical desk)."""
    img = new(22, 26)
    d = ImageDraw.Draw(img)
    solid_shadow(d, 11, 24, 8, 2)
    hline(d, 4, 17, 23, PAL["metal_d"])
    vline(d, 11, 18, 23, PAL["metal"])
    prism(d, 8, 14, 12, 4, 4, HT["mesh"], HT["chair"])
    box1(d, 2, 1, 10, 18, HT["chair"])
    for y in range(3, 17):
        for x in range(4, 9):
            if (x + y) % 2 == 0:
                d.point((x, y), fill=HT["mesh"])
    vline(d, 1, 8, 20, PAL["metal"])
    vline(d, 20, 12, 20, PAL["metal"])
    if jacket:
        rect(d, [3, 4, 9, 13], HW["jacket"])
    return outline_sprite(img)


def chair_back(jacket=False) -> Image.Image:
    """Chair seen from the aisle, seat toward a south-facing desk."""
    img = new(20, 26)
    d = ImageDraw.Draw(img)
    solid_shadow(d, 10, 24, 8, 2)
    hline(d, 3, 16, 23, PAL["metal_d"])
    vline(d, 10, 18, 23, PAL["metal"])
    prism(d, 2, 14, 12, 4, 4, HT["mesh"], HT["chair"])
    box1(d, 10, 1, 18, 18, HT["chair"])
    for y in range(3, 17):
        for x in range(12, 17):
            if (x + y) % 2 == 0:
                d.point((x, y), fill=HT["mesh"])
    vline(d, 1, 12, 20, PAL["metal"])
    vline(d, 18, 8, 20, PAL["metal"])
    if jacket:
        rect(d, [11, 4, 17, 13], HW["jacket"])
    return outline_sprite(img)


def seated_facing_wall(cid) -> Image.Image:
    """Sitting back-of-head + shoulders, facing the far wall."""
    spec = next(s for s in gc.CAST if s["id"] == cid)
    hair = spec.get("hair_c", (28, 22, 24, 255))
    img = new(20, 22)
    d = ImageDraw.Draw(img)
    solid_shadow(d, 10, 20, 7, 2)
    rect(d, [3, 11, 16, 19], INK)
    rect(d, [4, 12, 15, 18], spec["sleeve"])
    d.point((5, 13), fill=shade(spec["sleeve"], 28))
    d.point((14, 13), fill=shade(spec["sleeve"], 18))
    rect(d, [8, 10, 11, 12], spec["skin"])
    rect(d, [4, 1, 15, 11], INK)
    rect(d, [5, 2, 14, 10], hair)
    d.point((6, 3), fill=shade(hair, 22))
    if spec.get("hair_len") in ("long", "shoulder"):
        rect(d, [2, 8, 4, 18], hair)
        rect(d, [15, 8, 18, 18], hair)
    if spec.get("hair_tip"):
        rect(d, [3, 14, 5, 19], spec["hair_tip"])
        rect(d, [15, 14, 17, 19], spec["hair_tip"])
    return outline_sprite(img)


def draw_ttc(d, x, y):
    """Wall-mounted 3D ttc — lowercase like the photo, C clearly open."""
    face, dep, hi = HT["trim"], (16, 14, 18, 255), (80, 78, 84, 255)

    def blk(sx, sy, w, h):
        rect(d, [sx + 1, sy + 1, sx + w, sy + h], dep)
        rect(d, [sx, sy, sx + w - 1, sy + h - 1], face)
        hline(d, sx, sx + w - 2, sy, hi)

    # t
    blk(x + 2, y, 3, 12)
    blk(x, y + 3, 7, 3)
    # t
    blk(x + 12, y, 3, 12)
    blk(x + 10, y + 3, 7, 3)
    # c (open right)
    blk(x + 22, y + 2, 3, 10)
    blk(x + 22, y + 2, 7, 3)
    blk(x + 22, y + 9, 7, 3)


def cast_sprite(cid="cast_01", view="front", frame=0):
    spec = next(s for s in gc.CAST if s["id"] == cid)
    return gc.draw_cast(spec, view, frame)


FOOT = 32


def blit_cast(room, spr, x, y):
    """Keep feet on the old 32px foot line when sprites are 32×40."""
    blit(room, spr, x, y - (spr.size[1] - FOOT))


def office_floor(d, y0, c1, c2, seam):
    """Pale office slab — faint large seams, not a checker plan."""
    rect(d, [0, y0, W - 1, H - 1], c1)
    for y in range(y0, H, 32):
        hline(d, 0, W - 1, y, c2)
    for x in range(0, W, 48):
        vline(d, x, y0, H - 1, c2)
    noise(d, 0, y0, W - 1, H - 1, shade(c1, -10), every=15)
    dither(d, 0, y0, W - 1, H - 1, c2, 8)


# ===========================================================================
# 1. 胡同 — 上墙 4 桌 + 下墙 4 桌，8 椅在中间背靠背
# ===========================================================================
def scene_hutong() -> Image.Image:
    room = new(W, H, HT["floor"])
    d = ImageDraw.Draw(room)
    office_floor(d, 40, HT["floor"], HT["floor2"], HT["gap"])
    light_pool(d, 80, 108, 36, 8, HT["sun"], 3)
    light_pool(d, 176, 108, 36, 8, HT["sun"], 3)

    rect(d, [0, 0, W - 1, 10], HT["ceil"])
    fluorescent(d, 18, 1, 220, HT["sun"])
    wall_face(d, 0, 11, W - 1, 38, HT["wall"], lip=4, lip_c=HT["lip"])
    draw_ttc(d, 8, 14)
    frames = (
        (48, 14, 8, 8), (64, 16, 7, 7), (80, 14, 8, 8),
        (98, 16, 7, 7), (114, 14, 8, 8), (132, 16, 7, 7),
        (148, 14, 9, 8), (168, 16, 7, 7), (186, 14, 8, 8),
        (204, 16, 7, 7), (222, 14, 8, 8), (238, 16, 7, 7),
    )
    for i, (fx, fy, fw, fh) in enumerate(frames):
        prism(d, fx, fy, fw, fh, 2, HT["frame"], HT["wall_d"], HT["lip"])
        if i % 3 == 0:
            rect(d, [fx + 2, fy + 2, fx + fw - 3, fy + fh - 3], shade(HT["wall_d"], -6))
    dither(d, 220, 12, 254, 36, HT["sun"], 5)

    # four desks flush to the TOP wall, four flush to the BOTTOM edge
    desk_xs = (8, 70, 132, 194)
    desk_w, desk_h, desk_z = 54, 12, 7
    top_items = (prop_laptop(), None, prop_cup((40, 40, 46, 255)), None)
    bot_items = (None, prop_notebook(), None, prop_cup((80, 48, 40, 255)))
    # top-row sit_back (face the wall); bottom-row sit_front (face us)
    top_sit = ("cast_02", None, "cast_05", "cast_08")
    bot_sit = ("cast_01", "cast_03", "cast_04", None)

    top_desk_y = 39
    bot_desk_y = 173
    top_chair_y = 56
    bot_chair_y = 150

    for i, x in enumerate(desk_xs):
        prism(d, x, top_desk_y, desk_w, desk_h, desk_z, HT["desk"], HT["desk_e"])
        empty_pad(d, x + 12, top_desk_y + 2, 30, 8, HT["pad"], shade(HT["desk_e"], 16))
        if top_items[i]:
            blit(room, top_items[i], x + 16, top_desk_y)
        prism(d, x, bot_desk_y, desk_w, desk_h, desk_z, HT["desk"], HT["desk_e"])
        empty_pad(d, x + 12, bot_desk_y + 2, 30, 8, HT["pad"], shade(HT["desk_e"], 16))
        if bot_items[i]:
            blit(room, bot_items[i], x + 16, bot_desk_y)

        # top: person faces the wall (back of head), then chair back toward the aisle
        if top_sit[i]:
            blit(room, cast_sprite(top_sit[i], "sit_back"), x + 11, top_chair_y - 12)
        blit(room, chair_north(jacket=(i == 3)), x + 16, top_chair_y)
        # bottom: chair behind (toward aisle), person faces the bottom wall
        blit(room, chair_south(jacket=(i == 1)), x + 16, bot_chair_y)
        if bot_sit[i]:
            blit(room, cast_sprite(bot_sit[i], "sit_front"), x + 11, bot_chair_y - 14)

    # leftover floor = small props only, no extra seats
    blit(room, prop_plant(), 2, 118)
    blit(room, prop_plant(), 238, 118)
    blit(room, prop_spray(), 2, 96)
    blit(room, prop_bottle(), 244, 150)
    prism(d, 238, 88, 14, 6, 16, HT["chair"], shade(HT["chair"], -16))
    prism(d, 118, 112, 12, 5, 10, (46, 72, 120, 255), (28, 44, 78, 255))
    d.point((124, 114), fill=(210, 168, 80, 255))
    return room


# ===========================================================================
# 2. 电梯间 — 米黄石材 / 开门轿厢 / 雕塑 / 屏+按钮
# ===========================================================================
def scene_elevator() -> Image.Image:
    room = new(W, H, EL["floor"])
    d = ImageDraw.Draw(room)
    # large near-same-color marble slabs — not a bathroom checker
    rect(d, [0, 126, W - 1, H - 1], EL["floor"])
    noise(d, 0, 126, W - 1, H - 1, EL["hi"], every=16)
    noise(d, 0, 126, W - 1, H - 1, EL["floor2"], every=21)
    for y in range(126, H, 32):
        hline(d, 0, W - 1, y, shade(EL["grout"], 20))
    for x in range(0, W, 48):
        vline(d, x, 126, H - 1, shade(EL["grout"], 20))
    light_pool(d, 48, 168, 28, 8, WHITE, 3)
    light_pool(d, 200, 168, 28, 8, WHITE, 3)

    # ceiling
    rect(d, [0, 0, W - 1, 18], EL["ceil"])
    hline(d, 0, W - 1, 18, EL["stone_d"])
    for cx in (36, 96, 160, 220):
        downlight(d, cx, 5, EL["hi"])
        dither(d, cx - 10, 12, cx + 10, 17, EL["hi"], 3)

    # marble wall FACE (not a stack of 3D bricks)
    marble(d, 0, 19, W - 1, 124, EL["stone"], EL["vein"], EL["hi"], every=19)
    wall_face(d, 0, 19, W - 1, 120, EL["stone"], lip=5, lip_c=EL["stone_d"])
    # re-paint marble on the face so the lip stays
    marble(d, 0, 19, W - 1, 120, EL["stone"], EL["vein"], EL["hi"], every=19)
    hline(d, 0, W - 1, 19, shade(EL["stone"], -20))
    hline(d, 0, W - 1, 20, EL["hi"])

    # left CLOSED door — recessed frame, two panels, handle
    drop_shadow(d, 8, 122, 54, 6, ox=1, oy=1)
    box1(d, 8, 26, 62, 124, EL["stone_d"])
    prism(d, 12, 30, 44, 8, 86, EL["door"], EL["door_d"], shade(EL["door_d"], -14))
    vline(d, 34, 38, 116, EL["grout"])
    box1(d, 16, 40, 30, 70, shade(EL["door"], -12), EL["grout"])
    box1(d, 38, 40, 52, 70, shade(EL["door"], -12), EL["grout"])
    box1(d, 16, 78, 30, 112, shade(EL["door"], -16), EL["grout"])
    box1(d, 38, 78, 52, 112, shade(EL["door"], -16), EL["grout"])
    prism(d, 48, 80, 6, 3, 10, EL["door_d"], EL["vein"])
    vline(d, 13, 38, 116, shade(EL["door"], -24))

    # pedestal + standing bronze figure (shoulders, not a crucifix)
    prism(d, 106, 106, 32, 12, 16, EL["ped"], (10, 10, 14, 255), (40, 40, 46, 255))
    oval_shadow(d, 122, 136, 18, 3)
    # head
    box1(d, 116, 50, 130, 62, EL["bronze"])
    d.point((119, 53), fill=shade(EL["bronze"], 24))
    d.point((127, 53), fill=shade(EL["bronze"], -10))
    # neck + shoulders
    rect(d, [120, 62, 126, 66], EL["statue"])
    rect(d, [112, 66, 134, 74], EL["statue"])
    # torso
    rect(d, [116, 74, 130, 96], EL["statue"])
    rect(d, [118, 78, 128, 88], shade(EL["statue"], 18))
    # arms closer to the body (photo is slender, not a T-pose)
    rect(d, [110, 70, 116, 90], EL["statue"])
    rect(d, [130, 70, 136, 88], EL["statue"])
    d.point((108, 86), fill=EL["bronze"])
    # hips + legs together
    rect(d, [118, 96, 128, 106], shade(EL["statue"], 10))
    rect(d, [118, 96, 122, 106], EL["statue"])
    rect(d, [124, 96, 128, 106], EL["statue"])

    # RIGHT open elevator: dark frame, parted leaves, warm cabin
    drop_shadow(d, 156, 122, 74, 6, ox=1, oy=1)
    box1(d, 156, 28, 230, 124, EL["shaft"])
    # parted doors (leaves)
    prism(d, 156, 28, 12, 8, 90, EL["door"], EL["door_d"])
    prism(d, 218, 28, 12, 8, 90, EL["door"], EL["door_d"])
    # cabin depth — receding side walls + warm ceiling + floor
    rect(d, [170, 38, 216, 116], (36, 28, 26, 255))
    vline(d, 172, 40, 114, (18, 14, 14, 255))
    vline(d, 173, 42, 112, (28, 22, 20, 255))
    vline(d, 214, 40, 114, (18, 14, 14, 255))
    vline(d, 213, 42, 112, (28, 22, 20, 255))
    rect(d, [176, 40, 210, 50], EL["cabin"])
    dither(d, 178, 42, 208, 48, WHITE, 3)
    rect(d, [178, 52, 208, 98], (74, 58, 48, 255))
    dither(d, 180, 54, 206, 70, shade(EL["cabin"], -60), 5)
    hline(d, 178, 208, 84, PAL["metal"])
    hline(d, 178, 208, 85, PAL["metal_d"])
    rect(d, [176, 100, 210, 114], (102, 78, 54, 255))
    hline(d, 176, 210, 100, shade(EL["cabin"], -40))
    # threshold
    hline(d, 168, 218, 116, PAL["metal"])

    # screen + buttons on the right pillar
    prism(d, 232, 36, 18, 5, 24, EL["screen"], (8, 8, 12, 255))
    # coffee-ish screen (photo has a drink still)
    rect(d, [235, 40, 247, 54], (32, 28, 30, 255))
    rect(d, [238, 44, 244, 50], (210, 190, 170, 255))
    d.point((241, 46), fill=EL["red"])
    tiny_text(d, 236, 56, "8", EL["red"])
    d.point((246, 58), fill=(70, 200, 90, 255))
    # call panel
    prism(d, 232, 70, 18, 4, 40, EL["door_d"], EL["vein"])
    for y in (76, 88, 100):
        box1(d, 236, y, 246, y + 8, EL["hi"])
    d.point((241, 79), fill=EL["red"])
    # up/down ticks
    d.point((241, 91), fill=INK)
    d.point((241, 103), fill=INK)

    # trash
    prism(d, 232, 148, 16, 6, 22, EL["ped"], (12, 12, 16, 255))

    blit_cast(room, cast_sprite("cast_02", "side", 0), 46, 128)
    blit_cast(room, cast_sprite("cast_06", "front", 0), 68, 136)
    blit_cast(room, cast_sprite("cast_01", "side", 0), 140, 140)
    return room


# ===========================================================================
# 3. 夏威夷 — 开窗：左竖桌+3椅 / 右竖桌+3椅 / 窗外蓝天高楼
# ===========================================================================
def _hawaii_skyline(d, x0, y0, x1, y1):
    """Pixel cyber skyline — blue sky + towers, not a photo."""
    # sky wash, lighter at the horizon
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        c = mix(HW["sky2"], HW["sky3"], t)
        hline(d, x0, x1, y, c)
    dither(d, x0, y0, x1, y0 + 10, shade(HW["sky2"], -16), 6)
    # sun
    box1(d, 188, y0 + 6, 200, y0 + 16, HW["sun"])
    dither(d, 184, y0 + 4, 204, y0 + 18, HW["sun"], 3)
    # far haze band
    hline(d, x0, x1, y1 - 22, mix(HW["sky3"], HW["bldg4"], 0.35))
    # building slabs (x, top, w, face)
    towers = (
        (x0 + 4, y1 - 18, 14, HW["bldg2"]),
        (x0 + 16, y1 - 28, 12, HW["bldg"]),
        (x0 + 28, y1 - 22, 18, HW["bldg3"]),
        (x0 + 46, y1 - 40, 16, HW["bldg"]),
        (x0 + 62, y1 - 26, 14, HW["bldg4"]),
        (x0 + 76, y1 - 48, 18, HW["bldg2"]),
        (x0 + 94, y1 - 32, 12, HW["bldg3"]),
        (x0 + 108, y1 - 54, 20, HW["bldg"]),
        (x0 + 128, y1 - 36, 16, HW["bldg4"]),
        (x0 + 144, y1 - 24, 14, HW["bldg2"]),
        (x0 + 158, y1 - 44, 22, HW["bldg3"]),
        (x0 + 180, y1 - 30, 16, HW["bldg"]),
        (x0 + 196, y1 - 20, 12, HW["bldg4"]),
    )
    for bx, top, bw, face in towers:
        if bx + bw > x1:
            continue
        rect(d, [bx, top, bx + bw - 1, y1], face)
        vline(d, bx, top, y1, shade(face, -22))
        hline(d, bx, bx + bw - 1, top, shade(face, 24))
        # window grid
        for wy in range(top + 3, y1 - 2, 4):
            for wx in range(bx + 2, bx + bw - 2, 3):
                on = ((wx * 7 + wy * 3) % 7) == 0
                d.point((wx, wy), fill=HW["lit"] if on else shade(face, 18))
        # antenna / crown on the tall ones
        if y1 - top >= 40:
            vline(d, bx + bw // 2, top - 6, top, PAL["metal"])
            d.point((bx + bw // 2, top - 7), fill=HW["neon_p"])
        if y1 - top >= 46:
            rect(d, [bx + 3, top + 4, bx + bw - 4, top + 8], HW["neon_c"])
    # nearer dark plinth so the city sits on a ground line
    rect(d, [x0, y1 - 6, x1, y1], shade(HW["bldg2"], -10))
    hline(d, x0, x1, y1 - 6, shade(HW["bldg"], 20))


def scene_hawaii() -> Image.Image:
    room = new(W, H, HW["floor"])
    d = ImageDraw.Draw(room)
    wood_planks(d, 0, 72, W - 1, H - 1, HW["floor"], HW["floor2"], HW["gap"], 6)
    light_pool(d, 128, 160, 50, 12, HW["sun"], 3)
    light_pool(d, 128, 96, 40, 10, HW["sun"], 3)

    # cream side walls; OPEN window (blinds rolled up), skyline visible
    rect(d, [0, 0, 18, 72], HW["cream"])
    rect(d, [238, 0, W - 1, 72], HW["cream"])
    rect(d, [18, 0, 237, 68], HW["wall"])
    _hawaii_skyline(d, 24, 4, 231, 62)
    # frame + mullions (glass is open — no pulled-down blinds)
    vline(d, 22, 2, 64, shade(HW["desk_e"], -20))
    vline(d, 233, 2, 64, shade(HW["desk_e"], -20))
    hline(d, 22, 233, 2, shade(HW["desk_e"], -20))
    vline(d, 127, 4, 62, mix(HW["cream"], (255, 255, 255, 255), 0.35))
    vline(d, 128, 4, 62, shade(HW["desk_e"], 10))
    # rolled-up blinds at the head — window is open
    prism(d, 24, 2, 208, 4, 4, HW["blind_hi"], HW["blind_d"])
    for x in range(28, 228, 6):
        d.point((x, 4), fill=HW["blind"])
    # sill + empty sunlit floor (no middle chairs)
    prism(d, 18, 64, 220, 6, 6, HW["desk_hi"], HW["desk_e"])
    dither(d, 70, 72, 186, 88, HW["sun"], 4)
    for k in range(0, 36, 3):
        d.point((88 + k // 2, 76 + k), fill=HW["sun"])
        d.point((150 + k // 3, 76 + k), fill=HW["sun"])
    blit(room, prop_plant(), 28, 50)
    blit(room, prop_bottle(), 214, 52)

    def wood_desk(x, y, w, h, lip):
        prism(d, x, y, w, h, 8, HW["desk"], HW["desk_e"], lip=lip)
        for gy in range(y + 4, y + h - 2, 6):
            hline(d, x + 2, x + w - 3, gy, shade(HW["desk"], -18))
        prism(d, x, y + h - 6, w, 6, 6, HW["desk_hi"], HW["desk_e"])

    # LEFT vertical desk; chairs on its RIGHT (into the room)
    wood_desk(6, 78, 32, 92, "east")
    for i, yy in enumerate((86, 118, 148)):
        empty_pad(d, 10, yy, 22, 12, HW["pad"], shade(HW["desk_e"], 10))
        if i == 0:
            blit(room, prop_laptop(), 12, yy + 2)
        elif i == 2:
            blit(room, prop_cup((40, 40, 44, 255)), 14, yy + 4)
        blit(room, chair_back(jacket=(i == 1)), 42, yy + 2)

    # RIGHT vertical desk; chairs on its LEFT
    wood_desk(218, 78, 32, 92, "west")
    for i, yy in enumerate((86, 118, 148)):
        empty_pad(d, 222, yy, 22, 12, HW["pad"], shade(HW["desk_e"], 10))
        if i == 1:
            blit(room, prop_notebook(), 224, yy + 2)
        blit(room, chair_east(jacket=(i == 0)), 192, yy + 2)
    return room


# ===========================================================================
# 4. 泡泡玛特
# ===========================================================================
def scene_popmart() -> Image.Image:
    room = new(W, H, PM["a"])
    d = ImageDraw.Draw(room)
    # mint field, faint pink seams — not a loud checker keyboard
    rect(d, [0, 78, W - 1, H - 1], mix(PM["a"], PM["b"], 0.55))
    for y in range(78, H, 16):
        hline(d, 0, W - 1, y, shade(PM["grout"], 30))
    for x in range(0, W, 16):
        vline(d, x, 78, H - 1, shade(PM["grout"], 30))
    noise(d, 0, 78, W - 1, H - 1, shade(PM["a"], 16), every=14)

    rect(d, [0, 0, W - 1, 72], PM["wall"])
    hline(d, 0, W - 1, 68, PM["neon"])
    hline(d, 0, W - 1, 70, PM["neon2"])
    hline(d, 0, W - 1, 72, INK)
    # neon wash
    dither(d, 0, 60, W - 1, 67, PM["neon"], 4)
    letter_3d(d, 112, 4, "PM", PM["neon2"])

    def shelf(x, y, cols, rows, jitter=True):
        prism(d, x, y, cols * 12 + 10, 5, rows * 12 + 6, PM["shelf"], PM["wall"])
        for r in range(rows):
            for c in range(cols):
                col = BOXC[(r * 3 + c * 2 + r * c) % len(BOXC)]
                jx = 1 if jitter and ((r + c) % 4 == 0) else 0
                jy = 1 if jitter and ((r * 2 + c) % 5 == 0) else 0
                bw = 9 if (r + c) % 5 else 8
                bh = 3 if (r + c) % 4 == 0 else 2
                bx, by = x + 5 + c * 12 + jx, y + 6 + r * 12 + jy
                prism(d, bx, by, bw, bh, 7, col, shade(col, -36))
                # window + face so it is a box, not a keycap
                rect(d, [bx + 2, by + 4, bx + bw - 3, by + 7], shade(col, 24))
                if (r + c) % 2 == 0:
                    d.point((bx + 3, by + 5), fill=(90, 50, 140, 255))
                    d.point((bx + 5, by + 5), fill=(90, 50, 140, 255))
                elif (r + c) % 3 == 0:
                    d.point((bx + 4, by + 5), fill=WHITE)

    shelf(4, 8, 4, 4)
    shelf(198, 8, 4, 4)
    shelf(62, 10, 10, 3)

    # counter 2.5D + glass + 3 empty pads
    drop_shadow(d, 68, 154, 114, 10, ox=1, oy=2)
    prism(d, 66, 116, 116, 18, 24, PM["counter"], PM["counter_d"])
    rect(d, [70, 120, 178, 130], PM["glass"])
    dither(d, 72, 122, 176, 128, WHITE, 5)
    empty_pad(d, 80, 122, 24, 9, PM["pad"], PM["counter_d"])
    empty_pad(d, 112, 122, 24, 9, PM["pad"], PM["counter_d"])
    empty_pad(d, 144, 122, 24, 9, PM["pad"], PM["counter_d"])
    blit(room, prop_blindbox(BOXC[0]), 74, 110)
    blit(room, prop_blindbox(BOXC[1]), 106, 110)
    blit(room, prop_blindbox(BOXC[3]), 138, 110)
    # open box + figure
    prism(d, 192, 128, 16, 4, 12, BOXC[2], shade(BOXC[2], -40))
    rect(d, [194, 120, 206, 128], BOXC[1])
    prism(d, 216, 132, 12, 4, 16, BOXC[3], shade(BOXC[3], -40))
    box1(d, 218, 124, 226, 132, PAL["skin_f"])
    d.point((220, 126), fill=INK)
    d.point((224, 126), fill=INK)

    blit_cast(room, cast_sprite("cast_01", "front", 0), 44, 146)
    return room


# ===========================================================================
# 5. 厕所
# ===========================================================================
def scene_restroom() -> Image.Image:
    room = new(W, H, RR["floor"])
    d = ImageDraw.Draw(room)
    rect(d, [0, 78, W - 1, H - 1], RR["floor"])
    noise(d, 0, 78, W - 1, H - 1, RR["floor2"], every=12)
    for y in range(78, H, 20):
        hline(d, 0, W - 1, y, shade(RR["grout"], 16))
    for x in range(0, W, 24):
        vline(d, x, 78, H - 1, shade(RR["grout"], 16))
    dither(d, 168, 140, 250, 180, RR["wet"], 4)

    # subway tile wall
    rect(d, [0, 0, W - 1, 68], RR["wall"])
    for y in range(8, 60, 8):
        off = 0 if (y // 8) % 2 == 0 else 8
        for x in range(-4, W, 18):
            prism(d, x + off, y, 15, 3, 4, RR["hi"], RR["grout"])
    fluorescent(d, 20, 2, 216, WHITE)
    wall_face(d, 0, 0, W - 1, 66, RR["wall"], lip=4, lip_c=RR["grout"])
    # restore tiles on face
    for y in range(8, 60, 8):
        off = 0 if (y // 8) % 2 == 0 else 8
        for x in range(-4, W, 18):
            prism(d, x + off, y, 15, 3, 4, RR["hi"], RR["grout"])

    def stall(x, y, open_=False):
        drop_shadow(d, x, y + 58, 38, 8, ox=2, oy=2)
        # booth volume: thick top + sides
        prism(d, x, y, 38, 10, 50, RR["stall"], RR["stall_d"], shade(RR["stall_d"], -16))
        if open_:
            rect(d, [x + 8, y + 12, x + 28, y + 54], mix(RR["wall"], RR["stall"], 0.25))
            dither(d, x + 8, y + 12, x + 28, y + 20, shade(RR["stall"], -20), 3)
            prism(d, x + 12, y + 32, 14, 6, 14, RR["porc"], RR["metal"])
            rect(d, [x + 15, y + 36, x + 23, y + 42], RR["wet"])
            prism(d, x + 28, y + 12, 8, 8, 40, RR["stall"], RR["metal"])
            # hinge
            vline(d, x + 28, y + 14, y + 50, PAL["metal"])
        else:
            box1(d, x + 7, y + 12, x + 32, y + 56, RR["stall_d"])
            hline(d, x + 9, x + 30, y + 14, shade(RR["stall_d"], 20))
            box1(d, x + 24, y + 30, x + 30, y + 36, (40, 44, 48, 255))
            d.point((x + 27, y + 33), fill=RR["peach"])
            vline(d, x + 9, y + 14, y + 52, shade(RR["stall_d"], 16))
        rect(d, [x + 7, y + 56, x + 32, y + 59], RR["floor2"])

    stall(6, 48, False)
    stall(46, 48, False)
    stall(86, 48, True)
    stall(126, 48, False)

    for sx in (172, 210):
        # mirror
        prism(d, sx, 36, 30, 4, 18, RR["metal"], shade(RR["metal"], -20))
        rect(d, [sx + 3, 40, sx + 26, 52], (196, 220, 228, 255))
        dither(d, sx + 4, 42, sx + 24, 50, WHITE, 3)
        # basin
        prism(d, sx + 1, 70, 28, 6, 10, RR["porc"], RR["metal"])
        rect(d, [sx + 6, 74, sx + 24, 80], RR["wet"])
        box1(d, sx + 12, 62, sx + 18, 72, RR["metal"])
        d.point((sx + 15, 64), fill=WHITE)

    # bin
    prism(d, 180, 152, 18, 6, 20, RR["metal"], (90, 100, 110, 255))
    blit(room, prop_plant(), 154, 140)
    blit_cast(room, cast_sprite("cast_04", "side", 0), 196, 118)
    return room


# ===========================================================================
# 6. 普通工位 — 岛式 2.5D，空 pad（与胡同长桌区分）
# ===========================================================================
def scene_office() -> Image.Image:
    room = new(W, H, OF["floor"])
    d = ImageDraw.Draw(room)
    rect(d, [0, 62, W - 1, H - 1], OF["floor"])
    noise(d, 0, 62, W - 1, H - 1, OF["floor2"], every=13)
    for y in range(62, H, 28):
        hline(d, 0, W - 1, y, shade(OF["grout"], 20))
    for x in range(0, W, 40):
        vline(d, x, 62, H - 1, shade(OF["grout"], 20))
    light_pool(d, 70, 170, 34, 9, (220, 230, 240, 255), 3)

    rect(d, [0, 0, W - 1, 56], OF["wall"])
    wall_face(d, 0, 0, W - 1, 54, OF["wall"], lip=5, lip_c=shade(OF["wall"], -24))
    # window
    prism(d, 154, 10, 92, 8, 28, OF["win"], shade(OF["win"], -30))
    dither(d, 160, 16, 238, 34, WHITE, 4)
    fluorescent(d, 16, 4, 120)

    def island(x, y, left, right):
        drop_shadow(d, x, y + 22, 76, 8, ox=1, oy=2)
        prism(d, x, y, 76, 16, 12, OF["desk"], OF["desk_e"])
        dither(d, x + 2, y + 2, x + 72, y + 12, shade(OF["desk"], -12), 8)
        empty_pad(d, x + 6, y + 4, 28, 10, OF["pad"], OF["desk_e"])
        empty_pad(d, x + 42, y + 4, 28, 10, OF["pad"], OF["desk_e"])
        if left:
            blit(room, left, x + 8, y + 2)
        if right:
            blit(room, right, x + 44, y + 3)
        blit(room, chair_north(), x + 10, y + 26)
        blit(room, chair_north(), x + 44, y + 26)

    island(14, 66, prop_laptop(), prop_cup())
    island(140, 66, None, prop_notebook())
    island(14, 122, prop_blindbox(BOXC[4]), None)
    island(140, 122, prop_cup((40, 42, 48, 255)), None)

    blit(room, prop_plant(), 118, 48)
    blit_cast(room, cast_sprite("cast_05", "front", 0), 206, 150)
    blit_cast(room, cast_sprite("cast_07", "side", 0), 100, 96)
    return room


# ===========================================================================
# 7. 会议室
# ===========================================================================
def scene_meeting() -> Image.Image:
    room = new(W, H, MT["floor"])
    d = ImageDraw.Draw(room)
    rect(d, [0, 70, W - 1, H - 1], MT["floor"])
    noise(d, 0, 70, W - 1, H - 1, MT["floor2"], every=12)
    for y in range(70, H, 28):
        hline(d, 0, W - 1, y, shade(MT["floor2"], -10))
    light_pool(d, 128, 168, 50, 12, mix(MT["holo"], WHITE, 0.4), 3)

    rect(d, [0, 0, W - 1, 62], MT["wall"])
    wall_face(d, 0, 0, W - 1, 60, MT["wall"], lip=5, lip_c=shade(MT["wall"], -20))
    hline(d, 0, W - 1, 60, MT["holo"])
    # screen
    prism(d, 64, 10, 128, 8, 32, MT["screen"], (14, 18, 28, 255))
    dither(d, 74, 16, 182, 38, MT["holo"], 4)
    tiny_text(d, 108, 24, "MEET", MT["holo"])
    # glow on wall
    dither(d, 40, 44, 216, 58, MT["holo"], 5)

    drop_shadow(d, 38, 124, 180, 10, ox=2, oy=2)
    prism(d, 36, 88, 184, 26, 14, MT["wood"], MT["wood_e"], shade(MT["wood_e"], -16))
    dither(d, 40, 90, 216, 108, shade(MT["wood"], -14), 8)
    empty_pad(d, 52, 94, 152, 16, MT["pad"], MT["wood_e"])
    blit(room, prop_notebook(), 56, 96)
    blit(room, prop_cup(), 196, 98)

    # all seats face the screen (north) — south chairs were reading as broken hooks
    for pos in ((48, 122), (96, 122), (146, 122), (194, 122)):
        blit(room, chair_north(), pos[0], pos[1])

    blit_cast(room, cast_sprite("cast_04", "front", 0), 214, 150)
    blit_cast(room, cast_sprite("cast_01", "side", 0), 12, 112)
    return room


# ===========================================================================
# 8. 演唱会内场
# ===========================================================================
def scene_concert() -> Image.Image:
    room = new(W, H, CN["floor"])
    d = ImageDraw.Draw(room)
    rect(d, [0, 78, W - 1, H - 1], CN["floor"])
    noise(d, 0, 78, W - 1, H - 1, CN["floor2"], every=11)
    # dark house + stage face
    rect(d, [0, 0, W - 1, 76], CN["wall"])
    wall_face(d, 0, 0, W - 1, 26, shade(CN["wall"], -10), lip=3, lip_c=shade(CN["wall"], -28))
    prism(d, 16, 24, 224, 16, 18, CN["wood"], shade(CN["wood"], -30))
    dither(d, 24, 28, 232, 38, CN["spot"], 4)
    for cx in (48, 100, 156, 208):
        downlight(d, cx, 3, CN["spot"])
        dither(d, cx - 14, 12, cx + 14, 24, CN["spot"], 3)
    tiny_text(d, 108, 6, "LIVE", CN["neon"])
    # mic stand + side stacks
    prism(d, 124, 16, 5, 3, 16, PAL["metal"], PAL["metal_d"])
    prism(d, 22, 32, 18, 10, 20, CN["seat"], (20, 16, 24, 255))
    prism(d, 216, 32, 18, 10, 20, CN["seat"], (20, 16, 24, 255))
    # performer silhouette on stage (not a cast portrait)
    rect(d, [118, 18, 136, 38], shade(CN["seat"], -10))
    rect(d, [122, 10, 132, 18], shade(CN["seat"], 10))
    # audience: 4 rows, center aisle, empty merch pad on one seat
    for r, y in enumerate((80, 104, 128, 152)):
        for c, x in enumerate((6, 30, 54, 78, 150, 174, 198, 222)):
            prism(d, x, y, 20, 7, 7, CN["seat"], shade(CN["seat"], -20))
            if (r + c) % 5 == 0:
                rect(d, [x + 6, y - 4, x + 14, y + 2], shade(CN["neon"], -40))
            if r == 1 and c == 3:
                empty_pad(d, x + 3, y + 2, 14, 4, CN["pad"], shade(CN["seat"], 20))
    blit_cast(room, cast_sprite("cast_06", "front", 0), 114, 156)
    blit_cast(room, cast_sprite("cast_01", "side", 0), 100, 124)
    return room


# ===========================================================================
# 9. 咖啡店
# ===========================================================================
def scene_cafe() -> Image.Image:
    room = new(W, H, CF["floor"])
    d = ImageDraw.Draw(room)
    wood_planks(d, 0, 70, W - 1, H - 1, CF["floor"], CF["floor2"], CF["gap"], 6)
    rect(d, [0, 0, W - 1, 64], CF["wall"])
    wall_face(d, 0, 0, W - 1, 62, CF["wall"], lip=5, lip_c=shade(CF["wall"], -24))
    fluorescent(d, 30, 4, 180, (255, 230, 180, 255))
    tiny_text(d, 16, 12, "CAFE", (120, 72, 48, 255))
    # street window
    prism(d, 8, 22, 52, 6, 28, (186, 214, 226, 255), shade(CF["wall"], -30))
    dither(d, 12, 26, 54, 46, WHITE, 5)
    # menu board
    prism(d, 70, 12, 70, 8, 22, (40, 32, 28, 255), (24, 20, 18, 255))
    dither(d, 76, 16, 132, 30, (200, 180, 120, 255), 4)
    # pastry case + counter + machine
    prism(d, 148, 28, 36, 10, 18, (246, 228, 196, 255), CF["counter_d"])
    for i, col in enumerate(((240, 180, 120, 255), (200, 80, 70, 255), (250, 220, 160, 255))):
        box1(d, 154 + i * 10, 34, 160 + i * 10, 40, col)
    prism(d, 160, 48, 90, 16, 28, CF["counter"], CF["counter_d"])
    empty_pad(d, 172, 52, 28, 10, CF["pad"], CF["counter_d"])
    empty_pad(d, 210, 52, 28, 10, CF["pad"], CF["counter_d"])
    prism(d, 168, 36, 22, 8, 16, PAL["metal"], PAL["metal_d"])
    box1(d, 172, 40, 186, 48, (40, 28, 22, 255))
    blit(room, prop_cup(CF["cup"]), 214, 46)
    # four cafe tables — pads empty for cups
    for x, y, item in (
        (10, 86, prop_cup()),
        (86, 86, None),
        (10, 138, prop_notebook()),
        (86, 138, None),
    ):
        prism(d, x, y, 54, 14, 8, HW["desk_hi"], CF["counter_d"])
        empty_pad(d, x + 10, y + 3, 32, 8, CF["pad"], CF["counter_d"])
        if item:
            blit(room, item, x + 14, y + 2)
        blit(room, chair_north(), x + 14, y + 20)
    blit(room, prop_plant(), 160, 140)
    blit_cast(room, cast_sprite("cast_08", "front", 0), 200, 150)
    return room


# ===========================================================================
# 10. 健身房
# ===========================================================================
def scene_gym() -> Image.Image:
    room = new(W, H, GY["floor"])
    d = ImageDraw.Draw(room)
    rect(d, [0, 58, W - 1, H - 1], GY["floor"])
    noise(d, 0, 58, W - 1, H - 1, GY["floor2"], every=10)
    for y in range(58, H, 16):
        hline(d, 0, W - 1, y, shade(GY["floor2"], 12))
    rect(d, [0, 0, W - 1, 56], GY["wall"])
    wall_face(d, 0, 0, W - 1, 52, GY["wall"], lip=5, lip_c=shade(GY["wall"], -20))
    prism(d, 20, 8, 216, 8, 28, (180, 196, 210, 255), PAL["metal"])
    dither(d, 28, 14, 228, 32, WHITE, 5)
    tiny_text(d, 110, 4, "GYM", GY["red"])
    # squat rack
    prism(d, 12, 68, 74, 12, 22, GY["metal"], shade(GY["metal"], -30))
    vline(d, 18, 54, 102, GY["metal"])
    vline(d, 78, 54, 102, GY["metal"])
    hline(d, 18, 78, 60, GY["red"])
    # bench + water-bottle pad
    prism(d, 96, 86, 70, 14, 10, GY["rubber"], (20, 20, 24, 255))
    empty_pad(d, 114, 90, 34, 8, GY["pad"], PAL["metal_d"])
    blit(room, prop_bottle(), 118, 88)
    # treadmill
    prism(d, 176, 70, 68, 16, 10, GY["metal"], shade(GY["metal"], -28))
    rect(d, [184, 76, 236, 92], GY["rubber"])
    box1(d, 180, 62, 200, 72, (30, 30, 34, 255))
    # bike
    prism(d, 178, 118, 36, 10, 8, GY["metal"], shade(GY["metal"], -24))
    box1(d, 188, 108, 200, 118, GY["rubber"])
    # dumbbell tree
    for i, x in enumerate((12, 32, 52)):
        prism(d, x, 118 + (i % 2) * 8, 16, 6, 8, GY["metal"], shade(GY["metal"], -24))
        rect(d, [x + 2, 120 + (i % 2) * 8, x + 6, 128 + (i % 2) * 8], GY["rubber"])
    prism(d, 16, 148, 88, 10, 6, GY["red"], shade(GY["red"], -30))
    empty_pad(d, 36, 150, 28, 6, GY["pad"], shade(GY["red"], -10))
    blit_cast(room, cast_sprite("cast_03", "front", 0), 160, 148)
    return room


# ===========================================================================
# 11. 米线店
# ===========================================================================
def scene_mixian() -> Image.Image:
    room = new(W, H, MX["floor"])
    d = ImageDraw.Draw(room)
    wood_planks(d, 0, 72, W - 1, H - 1, MX["floor"], MX["floor2"], shade(MX["wood_e"], 10), 6)
    rect(d, [0, 0, W - 1, 66], MX["wall"])
    wall_face(d, 0, 0, W - 1, 64, MX["wall"], lip=5, lip_c=shade(MX["wall"], -24))
    # shop plaque (latin 5px N reads as H; skip the word)
    prism(d, 8, 8, 28, 6, 10, MX["wood"], MX["wood_e"])
    box1(d, 16, 12, 26, 18, MX["bowl"])
    d.point((20, 10), fill=MX["lantern"])
    # hanging menu slips
    for i, x in enumerate((52, 64, 76)):
        rect(d, [x, 18, x + 8, 36], (250, 236, 190, 255))
        hline(d, x + 1, x + 7, 22 + i, shade(MX["wall"], -40))
    for cx in (96, 136, 176):
        prism(d, cx, 6, 10, 4, 10, MX["lantern"], shade(MX["lantern"], -40))
        dither(d, cx - 6, 18, cx + 16, 28, MX["lantern"], 3)
    # kitchen counter + steaming pots
    prism(d, 140, 40, 108, 14, 22, MX["wood"], MX["wood_e"])
    for x in (150, 176, 202):
        prism(d, x, 32, 18, 8, 12, PAL["metal"], PAL["metal_d"])
        dither(d, x + 2, 22, x + 16, 32, MX["steam"], 2)
    empty_pad(d, 150, 44, 24, 8, MX["pad"], MX["wood_e"])
    empty_pad(d, 186, 44, 24, 8, MX["pad"], MX["wood_e"])
    empty_pad(d, 220, 44, 22, 8, MX["pad"], MX["wood_e"])
    # four two-top tables, bowls parked, pads empty
    for x, y, item in (
        (8, 82, None),
        (84, 82, prop_cup()),
        (8, 136, None),
        (84, 136, prop_notebook()),
    ):
        prism(d, x, y, 64, 16, 8, MX["wood"], MX["wood_e"])
        empty_pad(d, x + 8, y + 3, 22, 10, MX["pad"], MX["wood_e"])
        empty_pad(d, x + 34, y + 3, 22, 10, MX["pad"], MX["wood_e"])
        if item:
            blit(room, item, x + 10, y + 2)
        box1(d, x + 36, y + 4, x + 48, y + 12, MX["bowl"])
        blit(room, chair_north(), x + 16, y + 22)
    blit_cast(room, cast_sprite("cast_05", "side", 0), 200, 148)
    blit_cast(room, cast_sprite("cast_02", "front", 0), 168, 118)
    return room


SCENES = [
    dict(id="hutong", title="胡同工位区",
         blurb="上墙 4 桌 · 下墙 4 桌 · 中间 8 椅背靠背",
         fn=scene_hutong, walk_y=108, line="这边还能放杯子。",
         beat_t="09:20", action="sit_aisle",
         seats=[
             {"id": "n0", "x": 27, "y": 56, "face": "up", "view": "sit_back"},
             {"id": "n1", "x": 89, "y": 56, "face": "up", "view": "sit_back"},
             {"id": "n2", "x": 151, "y": 56, "face": "up", "view": "sit_back"},
             {"id": "n3", "x": 213, "y": 56, "face": "up", "view": "sit_back"},
             {"id": "s0", "x": 27, "y": 150, "face": "down", "view": "sit_front"},
             {"id": "s1", "x": 89, "y": 150, "face": "down", "view": "sit_front"},
             {"id": "s2", "x": 151, "y": 150, "face": "down", "view": "sit_front"},
             {"id": "s3", "x": 213, "y": 150, "face": "down", "view": "sit_front"},
         ],
         why="上墙齐排 4 张工位桌，下墙齐排 4 张；8 把椅子全在房间中间：上排椅朝上墙（看见后脑勺），下排椅朝下墙（看见正脸），两排椅背对背，中间留走道。每桌一块空 pad。墙上只留 ttc 和镜框。空地用植物/喷壶/包补密度，不加座位。"),
    dict(id="elevator", title="电梯间",
         blurb="米黄石材 · 开门体积 · 雕塑台座 · 屏与按钮",
         fn=scene_elevator, walk_y=140, line="先等这梯。",
         beat_t="09:12", action="wait_lift",
         why="石材块墙、白石地、中轴雕塑、右侧门拉开见轿厢。人物是 cast。"),
    dict(id="hawaii", title="夏威夷",
         blurb="开窗：左竖桌+3椅 · 右竖桌+3椅 · 约六座 · 窗外蓝天高楼",
         fn=scene_hawaii, walk_y=148, line="窗边这档先开。",
         beat_t="09:40", action="open_laptop",
         why="窗户打开，卷帘卷在顶上，能看见蓝天和高楼天际线（精致像素，不是照片）。左侧竖向长桌内侧 3 椅，右侧竖向长桌旁 3 椅，合计约六座。窗前只留窗台和日光，不再摆中间三椅。"),
    dict(id="popmart", title="泡泡玛特店",
         blurb="2.5D 盒架 · 柜台三空位",
         fn=scene_popmart, walk_y=146, line="就拆一个。",
         beat_t="10:40", action="unbox",
         why="细盒上架、柜台玻璃上三格空 pad，只停三盒。"),
    dict(id="restroom", title="厕所",
         blurb="四隔间体积 + 两水池",
         fn=scene_restroom, walk_y=132, line="洗一下。",
         beat_t="12:10", action="wash",
         why="四间 2.5D 隔间（一间半开见马桶）+ 两个盆。"),
    dict(id="office", title="普通工位",
         blurb="岛式 2.5D · 双空 pad",
         fn=scene_office, walk_y=150, line="回岛上。",
         beat_t="16:20", action="desk_work",
         why="和胡同长桌区分：四岛，每岛两格空 pad，有的完全空。"),
    dict(id="meeting", title="会议室",
         blurb="长桌中央整块空 pad",
         fn=scene_meeting, walk_y=150, line="我记，你们说。",
         beat_t="14:00", action="take_notes",
         why="木桌 2.5D，中央整块空位，本和杯只在两端。"),
    dict(id="concert", title="演唱会内场",
         blurb="舞台 + 中央过道观众席 · 内场感",
         fn=scene_concert, walk_y=150, line="这排还能挤。",
         beat_t="19:10", action="watch_live",
         why="暗厅、暖木舞台、筒灯、左右音箱。观众席四排、中间过道。座面留空 pad。Q 版小人，不是写真。"),
    dict(id="cafe", title="咖啡店",
         blurb="街窗 + 柜台空 pad + 四张小桌",
         fn=scene_cafe, walk_y=148, line="先点一杯。",
         beat_t="11:20", action="order_coffee",
         why="奶油墙、暖木地、菜单板、咖啡机、点心柜。柜台两格空 pad，四张小桌各留杯位。"),
    dict(id="gym", title="健身房",
         blurb="镜墙 · 深蹲架 · 跑步机 · 垫上留瓶位",
         fn=scene_gym, walk_y=148, line="再一组。",
         beat_t="18:00", action="lift",
         why="橡胶地、镜面墙、架+卧推凳+跑步机+单车+哑铃。凳面和垫面空 pad 放水瓶。"),
    dict(id="mixian", title="米线店",
         blurb="红墙灯笼 · 后厨蒸汽锅 · 四桌双空 pad",
         fn=scene_mixian, walk_y=148, line="一碗米线。",
         beat_t="12:40", action="eat_mixian",
         why="红墙、灯笼、菜单条、后厨三口蒸汽锅。四张木桌各两格空 pad，碗靠边。"),
]


def write_scene_md(spec):
    out = ROOT / "design" / "scenes"
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{spec['id']}.md").write_text(
        f"""# 场景：{spec['title']}（`{spec['id']}`）

> 精致像素 · 256×192 · 2.5D · 桌面留物位

{spec['blurb']}

{spec['why']}

- `public/assets/scenes/{spec['id']}/scene_{spec['id']}.png`
- `public/preview/zoomed/{spec['id']}.png`
{("- 8 seat anchors: top n0–n3 face up (`sit_back`); bottom s0–s3 face down (`sit_front`). Walk aisle `walk_y=108`." if spec["id"] == "hutong" else "")}

不描摹真人，不提交 refs。
""",
        encoding="utf-8",
    )


def write_day_md():
    lines = [
        "# 一条一天 · 只链保留场景",
        "",
        "> 主循环：Online-control（本人在线操控）→ Offline-agent（离线驱动同一小人）→ Behavior-learning（学在线轨迹）。蒸馏 Q&A / PersonaCard 只冷启动。见 [`parallel-universe.md`](parallel-universe.md)。",
        "",
        "下架：茶水间 / 打印区 / 楼梯过道 / 天台 / 老板办公室 / 快递门口。",
        "",
        "## 默认事件牌",
        "",
        "```",
    ]
    for s in sorted(SCENES, key=lambda x: x["beat_t"]):
        lines.append(f"{s['beat_t']}  {s['title']:8}  {s['action']}")
    lines += ["```", "", "## 分镜", ""]
    for i, s in enumerate(sorted(SCENES, key=lambda x: x["beat_t"]), 1):
        lines += [
            f"### {i} · {s['beat_t']} · {s['title']}",
            f"- `{s['action']}` 「{s['line']}」",
            f"- {s['why']}",
            "",
        ]
    (ROOT / "design" / "day-in-life.md").write_text("\n".join(lines), encoding="utf-8")
    print("  wrote design/day-in-life.md")


def make_room_sheet(images):
    pad, tw, th, cols = 6, 128, 96, 4
    rows = (len(images) + cols - 1) // cols
    sheet = new(cols * (tw + pad) + pad, rows * (th + 16 + pad) + pad, (18, 20, 28, 255))
    d = ImageDraw.Draw(sheet)
    for i, (spec, img) in enumerate(images):
        r, c = divmod(i, cols)
        x = pad + c * (tw + pad)
        y = pad + r * (th + 16 + pad)
        sheet.paste(img.resize((tw, th), Image.Resampling.NEAREST), (x, y))
        d.text((x + 2, y + th + 2), spec["id"], fill=(200, 176, 130, 255))
    return sheet


def main():
    print("Generating 11 2.5D scenes…")
    manifest = {"canvas": [W, H], "scenes": []}
    painted = []
    for stale in (
        "room_hutong_gate.png", "room_pantry.png", "room_print.png",
        "room_hallway.png", "room_rooftop.png", "room_boss.png", "room_delivery.png",
    ):
        p = ASSETS / "rooms" / stale
        if p.exists():
            p.unlink()
            print(f"  removed {p.relative_to(ROOT)}")
    for spec in SCENES:
        img = spec["fn"]()
        painted.append((spec, img))
        save(img, ASSETS / "scenes" / spec["id"] / f"scene_{spec['id']}.png")
        save(img, ASSETS / "rooms" / f"room_{spec['id']}.png")
        save(img.resize((W // 2, H // 2), Image.Resampling.NEAREST),
             ASSETS / "rooms" / "thumbs" / f"room_{spec['id']}.png")
        save(zoom(img, 3), PREVIEW / "zoomed" / f"{spec['id']}.png")
        write_scene_md(spec)
        entry = {
            "id": spec["id"], "title": spec["title"],
            "src": f"assets/scenes/{spec['id']}/scene_{spec['id']}.png",
            "walk_y": spec["walk_y"], "line": spec["line"],
            "beat_t": spec["beat_t"], "action": spec["action"],
        }
        if spec.get("seats"):
            entry["seats"] = spec["seats"]
        manifest["scenes"].append(entry)
    save(make_room_sheet(painted), PREVIEW / "room_sheet.png")
    write_day_md()
    man = ASSETS / "manifest.json"
    man.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  wrote {man.relative_to(ROOT)}")
    print("Done rooms.")


if __name__ == "__main__":
    main()
