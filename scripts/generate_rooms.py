#!/usr/bin/env python3
"""7 Laura-named scenes — 2.5D refined pixel, 256×192, empty desk pads.

v2 quality pass: wall-FACE + floor composition (not an IKEA plan),
unified 1px ink, ceiling light + contact shadows, readable micro-detail.
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
    "wall": (198, 200, 206, 255),
    "blind": (142, 146, 154, 255),
    "blind_d": (108, 112, 120, 255),
    "blind_hi": (176, 180, 188, 255),
    "floor": (186, 140, 84, 255),
    "floor2": (164, 118, 66, 255),
    "gap": (112, 76, 42, 255),
    "desk": (220, 184, 126, 255),
    "desk_hi": (242, 214, 160, 255),
    "desk_e": (140, 98, 52, 255),
    "pad": (236, 210, 154, 255),
    "sun": (255, 226, 150, 255),
    "jacket": (244, 240, 232, 255),
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
    hair = (92, 62, 42, 255) if spec["id"] == "cast_06" else (28, 22, 24, 255)
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
    if spec["id"] == "cast_01":
        rect(d, [3, 14, 5, 19], (210, 168, 110, 255))
        rect(d, [15, 14, 17, 19], (186, 140, 88, 255))
    if spec["id"] == "cast_06":
        rect(d, [2, 8, 5, 18], hair)
        rect(d, [14, 8, 18, 18], hair)
    if spec["id"] == "cast_02":
        rect(d, [14, 8, 18, 18], hair)  # low pony
    if spec["id"] == "cast_08":
        rect(d, [2, 8, 4, 18], hair)
        rect(d, [15, 8, 18, 18], hair)
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
# 1. 胡同 — 远墙横长桌 · 一侧四座朝墙 · 桌面大块空 pad
# ===========================================================================
def scene_hutong() -> Image.Image:
    room = new(W, H, HT["floor"])
    d = ImageDraw.Draw(room)
    office_floor(d, 108, HT["floor"], HT["floor2"], HT["gap"])
    light_pool(d, 64, 158, 36, 10, HT["sun"], 3)
    light_pool(d, 190, 158, 36, 10, HT["sun"], 3)

    rect(d, [0, 0, W - 1, 12], HT["ceil"])
    hline(d, 0, W - 1, 12, HT["wall_d"])
    fluorescent(d, 18, 2, 220, HT["sun"])

    wall_face(d, 0, 13, W - 1, 62, HT["wall"], lip=6, lip_c=HT["lip"])
    draw_ttc(d, 8, 18)
    # irregular frames (photo: scattered white frames, not a keyboard)
    frames = (
        (8, 34, 9, 10), (22, 32, 7, 8), (34, 36, 10, 11),
        (50, 31, 8, 9), (64, 35, 7, 8), (78, 32, 11, 10),
        (96, 36, 8, 8), (110, 30, 7, 9), (124, 34, 10, 10),
        (140, 32, 8, 8), (154, 36, 7, 9), (168, 31, 11, 11),
        (186, 34, 8, 8), (200, 32, 7, 10), (214, 36, 9, 9),
        (228, 33, 8, 8), (16, 48, 8, 8), (40, 50, 10, 9),
        (70, 48, 7, 8), (100, 50, 9, 8), (132, 47, 8, 9),
        (164, 50, 10, 8), (196, 48, 8, 9), (224, 50, 7, 8),
    )
    for i, (fx, fy, fw, fh) in enumerate(frames):
        prism(d, fx, fy, fw, fh, 2, HT["frame"], HT["wall_d"], HT["lip"])
        if i % 3 == 0:
            rect(d, [fx + 2, fy + 2, fx + fw - 3, fy + fh - 3], shade(HT["wall_d"], -6))
        elif i % 4 == 0:
            rect(d, [fx + 2, fy + 2, fx + fw - 3, fy + fh - 3], (176, 188, 200, 255))
    dither(d, 220, 14, 254, 60, HT["sun"], 5)

    # closer, thicker desk — top must read as laminate, front as a wood riser
    prism(d, 2, 64, 248, 26, 14, HT["desk"], HT["desk_e"], shade(HT["desk_e"], -18))
    hline(d, 4, 247, 65, HT["desk_hi"])
    dither(d, 6, 70, 246, 86, shade(HT["desk"], -14), 8)
    # cable tray
    hline(d, 16, 236, 103, shade(HT["desk_e"], -24))

    bays = (14, 74, 136, 198)
    items = (prop_laptop(), None, prop_cup(), prop_notebook())
    for i, (bx, spr) in enumerate(zip(bays, items)):
        empty_pad(d, bx + 10, 74, 30, 12, HT["pad"], shade(HT["desk_e"], 16))
        if spr is not None:
            blit(room, spr, bx + 12, 70)
        blit(room, chair_north(), bx + 16, 108)

    blit(room, prop_spray(), 6, 72)
    blit(room, prop_plant(), 236, 50)
    blit(room, prop_cup((40, 40, 46, 255)), 234, 70)

    # sit overlapping the chair backs (not floating blobs)
    blit(room, seated_facing_wall("cast_02"), 88, 98)
    blit(room, seated_facing_wall("cast_06"), 150, 98)

    # aisle clutter so the floor is not a blank plan
    prism(d, 28, 168, 10, 6, 8, (48, 48, 54, 255), (24, 24, 28, 255))
    blit(room, prop_cup((236, 236, 240, 255)), 42, 172)
    blit(room, cast_sprite("cast_01", "side", 0), 118, 150)
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

    blit(room, cast_sprite("cast_02", "side", 0), 46, 128)
    blit(room, cast_sprite("cast_06", "front", 0), 68, 136)
    blit(room, cast_sprite("cast_01", "side", 0), 140, 140)
    return room


# ===========================================================================
# 3. 夏威夷 — 卷帘 + 靠窗 2.5D 长桌，三空位
# ===========================================================================
def scene_hawaii() -> Image.Image:
    room = new(W, H, HW["floor"])
    d = ImageDraw.Draw(room)
    wood_planks(d, 0, 98, W - 1, H - 1, HW["floor"], HW["floor2"], HW["gap"], 7)
    light_pool(d, 80, 160, 40, 10, HW["sun"], 3)
    light_pool(d, 190, 160, 30, 8, HW["sun"], 3)

    # TALL roller-blind wall
    rect(d, [0, 0, W - 1, 78], HW["wall"])
    for y in range(8, 72):
        c = HW["blind_d"] if y % 3 == 0 else (HW["blind"] if y % 3 == 1 else HW["blind_hi"])
        hline(d, 10, 246, y, c)
    # light seams
    for y in range(14, 70, 9):
        hline(d, 28, 228, y, HW["sun"])
    # side rails
    vline(d, 10, 8, 72, shade(HW["blind_d"], -20))
    vline(d, 246, 8, 72, shade(HW["blind_d"], -20))
    # sill 2.5D
    prism(d, 0, 74, W, 6, 6, HW["desk_hi"], HW["desk_e"])
    # sun shafts
    for k in range(0, 56, 3):
        d.point((46 + k // 3, 86 + k), fill=HW["sun"])
        d.point((150 + k // 4, 86 + k), fill=HW["sun"])

    # window-side bench
    drop_shadow(d, 14, 104, 228, 8, ox=1, oy=2)
    prism(d, 12, 82, 232, 18, 12, HW["desk"], HW["desk_e"], shade(HW["desk_e"], -16))
    dither(d, 16, 86, 240, 96, shade(HW["desk"], -14), 9)
    slots = [(24, 88, "laptop"), (100, 88, "cup"), (176, 88, "note")]
    stuff = {
        "laptop": prop_laptop(),
        "cup": prop_cup((40, 40, 44, 255)),
        "note": prop_notebook(),
    }
    for i, (x, y, kind) in enumerate(slots):
        empty_pad(d, x + 16, y, 40, 10, HW["pad"], shade(HW["desk_e"], 10))
        blit(room, stuff[kind], x, y)
        blit(room, chair_north(jacket=(i == 2)), x + 18, 110)

    blit(room, prop_plant(), 232, 68)
    blit(room, prop_bottle(), 8, 86)
    blit(room, prop_plant(), 6, 154)
    # white shirt reads on a black chair (cast_08 hair+sweater vanished into the mesh)
    blit(room, seated_facing_wall("cast_02"), 116, 104)
    blit(room, prop_phone(), 132, 100)
    blit(room, cast_sprite("cast_08", "side", 0), 200, 148)
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

    blit(room, cast_sprite("cast_01", "front", 0), 44, 146)
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
    blit(room, cast_sprite("cast_04", "side", 0), 196, 118)
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
    blit(room, cast_sprite("cast_05", "front", 0), 206, 150)
    blit(room, cast_sprite("cast_07", "side", 0), 100, 96)
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

    blit(room, cast_sprite("cast_04", "front", 0), 214, 150)
    blit(room, cast_sprite("cast_01", "side", 0), 12, 112)
    return room


SCENES = [
    dict(id="hutong", title="胡同工位区",
         blurb="远墙一条浅色长桌 · 一侧四座朝墙 · 桌面留空",
         fn=scene_hutong, walk_y=148, line="这边还能放杯子。",
         beat_t="09:20", action="sit_aisle",
         why="相机在过道朝墙：白墙 ttc + 小镜框，一条浅色长桌贴远墙，四把黑椅在桌南侧、人朝墙坐。桌面大块留空，只靠墙放一两件。纵深办公室照片只作白墙/黑椅/顶灯气氛。"),
    dict(id="elevator", title="电梯间",
         blurb="米黄石材 · 开门体积 · 雕塑台座 · 屏与按钮",
         fn=scene_elevator, walk_y=140, line="先等这梯。",
         beat_t="09:12", action="wait_lift",
         why="石材块墙、白石地、中轴雕塑、右侧门拉开见轿厢。人物是 cast。"),
    dict(id="hawaii", title="夏威夷",
         blurb="窗边 2.5D 长桌 · 三空位",
         fn=scene_hawaii, walk_y=140, line="窗边这档先开。",
         beat_t="09:40", action="open_laptop",
         why="卷帘日光 + 一条靠窗桌，三格空 pad，物靠边。"),
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
    print("Generating 7 2.5D scenes…")
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
        manifest["scenes"].append({
            "id": spec["id"], "title": spec["title"],
            "src": f"assets/scenes/{spec['id']}/scene_{spec['id']}.png",
            "walk_y": spec["walk_y"], "line": spec["line"],
            "beat_t": spec["beat_t"], "action": spec["action"],
        })
    save(make_room_sheet(painted), PREVIEW / "room_sheet.png")
    write_day_md()
    man = ASSETS / "manifest.json"
    man.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  wrote {man.relative_to(ROOT)}")
    print("Done rooms.")


if __name__ == "__main__":
    main()
