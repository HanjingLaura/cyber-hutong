#!/usr/bin/env python3
"""7 Laura-named scenes — 2.5D refined pixel, 256×192, empty desk pads."""
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
    WHITE,
    blit,
    box1,
    dither,
    empty_pad,
    hline,
    new,
    oval_shadow,
    prism,
    rect,
    save,
    tiny_text,
    vline,
    zoom,
)
import generate_cast as gc  # noqa: E402

W, H = 256, 192

HT = {
    "ceil": (250, 248, 246, 255),
    "wall": (244, 242, 238, 255),
    "wall_d": (214, 210, 204, 255),
    "trim": (36, 34, 38, 255),
    "floor": (214, 214, 216, 255),
    "floor2": (200, 200, 204, 255),
    "gap": (176, 176, 180, 255),
    "desk": (236, 228, 212, 255),
    "desk_hi": (248, 242, 232, 255),
    "desk_e": (176, 164, 146, 255),
    "pad": (246, 240, 228, 255),
    "chair": (32, 32, 36, 255),
    "mesh": (56, 56, 64, 255),
    "sun": (255, 240, 210, 255),
    "win": (174, 206, 228, 255),
}
EL = {
    "stone": (226, 208, 174, 255),
    "stone_d": (198, 176, 140, 255),
    "grout": (168, 148, 116, 255),
    "hi": (244, 230, 200, 255),
    "floor": (246, 240, 228, 255),
    "floor2": (228, 220, 204, 255),
    "ceil": (250, 244, 230, 255),
    "door": (210, 196, 168, 255),
    "door_d": (160, 146, 120, 255),
    "shaft": (24, 22, 26, 255),
    "cabin": (255, 236, 200, 255),
    "ped": (24, 24, 28, 255),
    "statue": (72, 64, 60, 255),
    "bronze": (110, 86, 64, 255),
    "screen": (18, 18, 22, 255),
    "red": (200, 40, 48, 255),
}
HW = {
    "wall": (210, 212, 216, 255),
    "blind": (150, 154, 162, 255),
    "blind_d": (118, 122, 130, 255),
    "floor": (196, 154, 96, 255),
    "floor2": (172, 128, 74, 255),
    "gap": (120, 84, 48, 255),
    "desk": (228, 196, 140, 255),
    "desk_hi": (246, 222, 170, 255),
    "desk_e": (150, 108, 60, 255),
    "pad": (240, 214, 160, 255),
    "sun": (255, 226, 150, 255),
    "jacket": (244, 240, 232, 255),
}
PM = {
    "a": (255, 210, 224, 255),
    "b": (186, 236, 224, 255),
    "grout": (255, 160, 190, 255),
    "wall": (112, 64, 150, 255),
    "wall_hi": (158, 100, 200, 255),
    "neon": (255, 88, 160, 255),
    "neon2": (70, 230, 206, 255),
    "shelf": (250, 244, 248, 255),
    "counter": (255, 176, 200, 255),
    "counter_d": (210, 100, 148, 255),
    "glass": (200, 246, 240, 255),
    "pad": (255, 230, 238, 255),
}
RR = {
    "floor": (210, 232, 226, 255),
    "floor2": (186, 214, 206, 255),
    "grout": (150, 186, 178, 255),
    "wall": (236, 246, 242, 255),
    "hi": (250, 254, 252, 255),
    "stall": (168, 204, 194, 255),
    "stall_d": (118, 164, 154, 255),
    "porc": (250, 252, 255, 255),
    "wet": (176, 220, 230, 255),
    "metal": (148, 166, 176, 255),
    "peach": (255, 180, 190, 255),
}
OF = {
    "floor": (156, 172, 186, 255),
    "floor2": (136, 152, 168, 255),
    "grout": (110, 126, 142, 255),
    "wall": (220, 226, 234, 255),
    "desk": (230, 214, 184, 255),
    "desk_hi": (246, 234, 210, 255),
    "desk_e": (156, 132, 98, 255),
    "pad": (240, 226, 198, 255),
}
MT = {
    "floor": (86, 80, 94, 255),
    "floor2": (70, 64, 80, 255),
    "wall": (108, 98, 114, 255),
    "wood": (166, 118, 74, 255),
    "wood_hi": (200, 154, 102, 255),
    "wood_e": (110, 74, 44, 255),
    "pad": (236, 220, 186, 255),
    "screen": (26, 32, 44, 255),
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


def wood_floor(room, y0, c1, c2, gap, plank=5):
    """Long planks — not a brick grid."""
    d = ImageDraw.Draw(room)
    for i, y in enumerate(range(y0, room.height, plank)):
        base = c1 if i % 2 == 0 else c2
        rect(d, [0, y, room.width - 1, min(y + plank - 1, room.height - 1)], base)
        hline(d, 0, room.width - 1, min(y + plank - 1, room.height - 1), gap)
        # rare seams only
        seam = 40 + (i * 17) % 80
        vline(d, seam, y, min(y + plank - 2, room.height - 1), gap)


def tile_floor(room, y0, a, b, grout, size=12):
    d = ImageDraw.Draw(room)
    for y in range(y0, room.height, size):
        for x in range(0, room.width, size):
            c = a if ((x // size) + (y // size)) % 2 == 0 else b
            rect(d, [x, y, min(x + size - 1, room.width - 1), min(y + size - 1, room.height - 1)], c)
            hline(d, x, min(x + size - 1, room.width - 1), y, grout)
            vline(d, x, y, min(y + size - 1, room.height - 1), grout)


def prop_cup(color=(236, 236, 240, 255)) -> Image.Image:
    img = new(6, 8)
    d = ImageDraw.Draw(img)
    prism(d, 1, 1, 4, 2, 5, color, (200, 200, 206, 255), (180, 180, 186, 255))
    hline(d, 1, 4, 1, (40, 40, 46, 255))
    return img


def prop_notebook() -> Image.Image:
    img = new(10, 8)
    d = ImageDraw.Draw(img)
    prism(d, 0, 1, 9, 3, 4, WHITE, (70, 118, 186, 255), (50, 90, 150, 255))
    hline(d, 2, 7, 3, (180, 190, 200, 255))
    return img


def prop_laptop() -> Image.Image:
    img = new(12, 10)
    d = ImageDraw.Draw(img)
    prism(d, 1, 5, 10, 2, 3, PAL["metal"], PAL["metal_d"])
    box1(d, 2, 1, 10, 6, (36, 44, 54, 255))
    d.point((5, 3), fill=(120, 220, 210, 255))
    d.point((6, 4), fill=WHITE)
    return img


def prop_blindbox(color=None) -> Image.Image:
    c = color or BOXC[0]
    img = new(8, 9)
    d = ImageDraw.Draw(img)
    prism(d, 1, 1, 6, 2, 6, c, tuple(max(0, x - 30) for x in c[:3]) + (255,))
    hline(d, 2, 5, 2, WHITE)
    d.point((3, 5), fill=(90, 50, 140, 255))
    return img


def prop_plant() -> Image.Image:
    img = new(9, 14)
    d = ImageDraw.Draw(img)
    prism(d, 2, 9, 5, 2, 4, WHITE, PAL["metal"])
    for p, c in (
        ((4, 1), PAL["green"]), ((3, 2), PAL["green"]), ((5, 2), PAL["green_hi"]),
        ((2, 4), PAL["green"]), ((6, 4), PAL["green_hi"]), ((4, 5), PAL["green_d"]),
        ((3, 6), PAL["green"]), ((5, 7), PAL["green"]),
    ):
        d.point(p, fill=c)
    return img


def chair_back(jacket=False) -> Image.Image:
    """Mesh chair: seat toward desk (left), BACK toward aisle (right)."""
    img = new(22, 28)
    d = ImageDraw.Draw(img)
    oval_shadow(d, 11, 26, 8, 2)
    hline(d, 3, 18, 25, PAL["metal_d"])
    vline(d, 10, 20, 25, PAL["metal"])
    # seat (left, toward desk)
    prism(d, 1, 14, 10, 5, 5, HT["mesh"], HT["chair"])
    # tall mesh BACK (right, toward aisle)
    box1(d, 10, 1, 20, 20, HT["chair"])
    for y in range(3, 19):
        for x in range(12, 19):
            if (x + y) % 2 == 0:
                d.point((x, y), fill=HT["mesh"])
    hline(d, 12, 18, 2, (80, 80, 88, 255))
    vline(d, 2, 12, 20, PAL["metal"])
    vline(d, 20, 8, 20, PAL["metal"])
    if jacket:
        rect(d, [12, 4, 19, 14], HW["jacket"])
    return img


def chair_north(jacket=False) -> Image.Image:
    """Mesh chair facing the far wall: dark seat + BACK toward the aisle."""
    img = new(18, 20)
    d = ImageDraw.Draw(img)
    oval_shadow(d, 9, 18, 7, 2)
    vline(d, 8, 14, 17, PAL["metal"])
    hline(d, 4, 13, 17, PAL["metal_d"])
    rect(d, [3, 5, 14, 9], HT["chair"])
    box1(d, 2, 7, 15, 16, HT["chair"])
    for y in range(9, 15):
        for x in range(4, 14):
            if (x + y) % 2 == 0:
                d.point((x, y), fill=HT["mesh"])
    if jacket:
        rect(d, [4, 9, 13, 14], HW["jacket"])
    return img


def prop_spray() -> Image.Image:
    img = new(5, 10)
    d = ImageDraw.Draw(img)
    box1(d, 1, 3, 3, 9, (220, 232, 242, 255))
    rect(d, [1, 1, 3, 3], PAL["metal"])
    d.point((2, 0), fill=PAL["metal_d"])
    return img


def seated_facing_wall(cid) -> Image.Image:
    """Compact back-of-head + shoulders; sitting, facing the far wall."""
    spec = next(s for s in gc.CAST if s["id"] == cid)
    img = new(18, 18)
    d = ImageDraw.Draw(img)
    rect(d, [1, 10, 16, 17], spec["sleeve"])
    rect(d, [4, 1, 13, 11], INK)
    rect(d, [5, 2, 12, 10], (28, 22, 24, 255))
    rect(d, [7, 10, 10, 12], spec["skin"])
    return img


def cast_sprite(cid="cast_01", view="front", frame=0):
    spec = next(s for s in gc.CAST if s["id"] == cid)
    return gc.draw_cast(spec, view, frame)


# ===========================================================================
# 1. 胡同 — 远墙一条浅色长桌 · 一侧四座朝墙 · 桌面留空
#    Layout from the side-along-the-desk photo (not the deep-office shot).
#    WALL (top) | DESK | people/chairs facing wall | AISLE (bottom)
# ===========================================================================
def scene_hutong() -> Image.Image:
    room = new(W, H, HT["floor"])
    d = ImageDraw.Draw(room)
    # pale office floor — faint seams, not a checker floorplan
    rect(d, [0, 84, W - 1, H - 1], HT["floor"])
    for y in range(84, H, 28):
        hline(d, 0, W - 1, y, HT["floor2"])
    for x in range(0, W, 40):
        vline(d, x, 84, H - 1, HT["floor2"])
    dither(d, 0, 84, W - 1, H - 1, HT["floor2"], 7)

    # white ceiling + fluorescent
    rect(d, [0, 0, W - 1, 13], HT["ceil"])
    prism(d, 24, 3, 208, 3, 3, WHITE, HT["wall_d"])
    dither(d, 36, 8, 220, 12, HT["sun"], 5)

    # FAR white wall — ttc + small frames. Desk flush to THIS wall.
    rect(d, [0, 14, W - 1, 51], HT["wall"])
    hline(d, 0, W - 1, 14, HT["wall_d"])
    tiny_text(d, 8, 18, "ttc", HT["trim"])
    frames = (
        (8, 28), (22, 26), (36, 30), (52, 24), (66, 29),
        (84, 26), (100, 31), (116, 24), (132, 28), (148, 26),
        (164, 30), (180, 24), (196, 29), (212, 26), (228, 31),
        (16, 40), (40, 38), (70, 42), (98, 39), (130, 41),
        (160, 38), (190, 42), (220, 39),
    )
    for i, (fx, fy) in enumerate(frames):
        box1(d, fx, fy, fx + 7, fy + 9, WHITE, HT["wall_d"])
        if i % 4 == 0:
            rect(d, [fx + 2, fy + 3, fx + 5, fy + 6], HT["wall_d"])

    dither(d, 232, 16, 254, 50, HT["sun"], 6)

    # ONE deep horizontal pale desk flush to the far wall (south lip = aisle)
    prism(d, 6, 50, 244, 26, 8, HT["desk"], HT["desk_e"])
    hline(d, 8, 247, 51, HT["desk_hi"])

    # four seat bays — faint pads, lots of bare laminate between them
    bays = (16, 74, 132, 190)
    items = (prop_laptop(), None, prop_cup(), prop_notebook())
    for i, (bx, spr) in enumerate(zip(bays, items)):
        empty_pad(d, bx + 12, 58, 24, 8, (240, 232, 218, 255), (200, 188, 170, 255))
        if spr is not None:
            blit(room, spr, bx + 12, 54)
        blit(room, chair_north(), bx + 16, 86)

    blit(room, prop_spray(), 10, 60)
    blit(room, prop_plant(), 236, 38)

    # sit BETWEEN chair and desk, facing the wall (backs to the aisle)
    blit(room, seated_facing_wall("cast_02"), 88, 78)
    blit(room, seated_facing_wall("cast_06"), 146, 78)

    blit(room, cast_sprite("cast_01", "side", 0), 118, 152)
    return room


# ===========================================================================
# 2. 电梯间 — 米黄石材 / 开门 / 雕塑 / 屏+按钮
# ===========================================================================
def scene_elevator() -> Image.Image:
    room = new(W, H, EL["floor"])
    d = ImageDraw.Draw(room)
    tile_floor(room, 86, EL["floor"], EL["floor2"], (210, 200, 184, 255), 18)
    dither(d, 16, 140, 90, 180, WHITE, 5)

    rect(d, [0, 0, W - 1, 24], EL["ceil"])
    for cx in (40, 100, 160, 216):
        prism(d, cx - 7, 6, 14, 3, 6, WHITE, EL["grout"])
        d.point((cx, 9), fill=EL["hi"])

    # stone wall panels (2.5D blocks)
    rect(d, [0, 25, W - 1, 86], EL["stone"])
    for y in (25, 46, 67):
        for x in range(0, W, 36):
            prism(d, x + 2, y + 2, 30, 6, 14, EL["hi"] if (x + y) % 72 == 0 else EL["stone"], EL["stone_d"], EL["grout"])

    # left closed door volume
    prism(d, 8, 30, 36, 8, 96, EL["door"], EL["door_d"])
    vline(d, 26, 38, 126, EL["grout"])
    prism(d, 36, 78, 6, 3, 10, EL["door_d"], EL["grout"])

    # pedestal + statue (abstract standing figure)
    prism(d, 108, 108, 32, 10, 18, EL["ped"], (12, 12, 16, 255), (40, 40, 46, 255))
    oval_shadow(d, 124, 136, 18, 3)
    # figure
    box1(d, 118, 48, 130, 58, EL["bronze"])  # head
    rect(d, [120, 58, 128, 108], EL["statue"])
    rect(d, [112, 68, 120, 74], EL["statue"])  # arm out
    rect(d, [128, 70, 136, 74], EL["statue"])
    vline(d, 124, 42, 48, EL["statue"])

    # RIGHT open elevator: dark frame, leaves, small warm cabin inside
    box1(d, 164, 32, 236, 140, EL["shaft"])
    prism(d, 164, 32, 14, 8, 102, EL["door"], EL["door_d"])
    prism(d, 222, 32, 14, 8, 102, EL["door"], EL["door_d"])
    # cabin inset — must read as OPEN, not a closed cream slab
    rect(d, [180, 42, 220, 128], (48, 40, 36, 255))
    rect(d, [184, 46, 216, 70], EL["cabin"])
    dither(d, 186, 48, 214, 60, WHITE, 3)
    hline(d, 186, 214, 88, PAL["metal"])
    rect(d, [184, 118, 216, 128], (90, 70, 50, 255))

    # screen + buttons
    prism(d, 236, 40, 16, 4, 22, EL["screen"], (8, 8, 12, 255))
    tiny_text(d, 239, 48, "8", EL["red"])
    d.point((248, 56), fill=(70, 200, 90, 255))
    prism(d, 236, 72, 16, 4, 36, EL["door_d"], EL["grout"])
    for y in (78, 88, 98):
        box1(d, 240, y, 248, y + 6, EL["hi"])
    d.point((244, 81), fill=EL["red"])

    prism(d, 232, 150, 18, 6, 24, EL["ped"], (12, 12, 16, 255))

    blit(room, cast_sprite("cast_02", "side", 0), 48, 112)
    blit(room, cast_sprite("cast_06", "front", 0), 68, 120)
    blit(room, cast_sprite("cast_01", "side", 0), 146, 126)
    return room


# ===========================================================================
# 3. 夏威夷 — 窗边 2.5D 长桌，三空位
# ===========================================================================
def scene_hawaii() -> Image.Image:
    room = new(W, H, HW["floor"])
    d = ImageDraw.Draw(room)
    wood_floor(room, 70, HW["floor"], HW["floor2"], HW["gap"], 7)

    rect(d, [0, 0, W - 1, 64], HW["wall"])
    for y in range(10, 54):
        c = HW["blind_d"] if y % 3 == 0 else HW["blind"]
        hline(d, 18, 238, y, c)
    for y in range(14, 52, 8):
        hline(d, 40, 210, y, HW["sun"])
    # sill 2.5D
    prism(d, 0, 56, W, 6, 8, HW["desk_hi"], HW["desk_e"])
    for k in range(0, 64, 3):
        d.point((50 + k // 3, 72 + k), fill=HW["sun"])
        d.point((140 + k // 4, 72 + k), fill=HW["sun"])

    # one window-side bench
    prism(d, 16, 72, 224, 16, 10, HW["desk"], HW["desk_e"], (140, 100, 56, 255))
    slots = [(28, 76, "laptop"), (104, 76, "cup"), (176, 76, "note")]
    stuff = {"laptop": prop_laptop(), "cup": prop_cup((40, 40, 44, 255)), "note": prop_notebook()}
    for i, (x, y, kind) in enumerate(slots):
        empty_pad(d, x + 14, y, 44, 10, (236, 236, 228, 255), (120, 84, 48, 255))
        blit(room, stuff[kind], x, y + 1)
        blit(room, chair_back(jacket=(i == 1)), x + 22, 98)

    blit(room, prop_plant(), 228, 58)
    blit(room, prop_plant(), 6, 150)
    blit(room, cast_sprite("cast_08", "back", 0), 120, 118)
    return room


# ===========================================================================
# 4. 泡泡玛特
# ===========================================================================
def scene_popmart() -> Image.Image:
    room = new(W, H, PM["a"])
    d = ImageDraw.Draw(room)
    tile_floor(room, 56, PM["a"], PM["b"], PM["grout"], 10)

    rect(d, [0, 0, W - 1, 55], PM["wall"])
    hline(d, 0, W - 1, 50, PM["neon"])
    hline(d, 0, W - 1, 52, PM["neon2"])

    def shelf(x, y, cols, rows):
        prism(d, x, y, cols * 8 + 6, 4, rows * 9 + 6, PM["shelf"], PM["wall"])
        for r in range(rows):
            for c in range(cols):
                col = BOXC[(r * cols + c) % len(BOXC)]
                bx, by = x + 4 + c * 8, y + 5 + r * 9
                prism(d, bx, by, 6, 2, 6, col, tuple(max(0, v - 36) for v in col[:3]) + (255,))

    shelf(6, 8, 5, 4)
    shelf(200, 8, 5, 4)
    shelf(70, 10, 14, 3)
    tiny_text(d, 110, 4, "PM", PM["neon2"])

    # counter 2.5D + 3 boxes + empty glass pads
    prism(d, 70, 118, 110, 14, 28, PM["counter"], PM["counter_d"])
    rect(d, [74, 120, 176, 128], PM["glass"])
    empty_pad(d, 86, 122, 22, 8, PM["pad"], PM["counter_d"])
    empty_pad(d, 116, 122, 22, 8, PM["pad"], PM["counter_d"])
    empty_pad(d, 146, 122, 22, 8, PM["pad"], PM["counter_d"])
    blit(room, prop_blindbox(BOXC[0]), 78, 110)
    blit(room, prop_blindbox(BOXC[1]), 108, 110)
    blit(room, prop_blindbox(BOXC[3]), 138, 110)
    # open box + figure
    prism(d, 190, 126, 14, 4, 12, BOXC[2], (200, 160, 40, 255))
    rect(d, [192, 118, 202, 126], BOXC[1])
    prism(d, 212, 130, 10, 4, 16, (186, 150, 255, 255), (120, 80, 180, 255))
    box1(d, 213, 122, 221, 130, PAL["skin_f"])

    blit(room, cast_sprite("cast_01", "front", 0), 48, 142)
    return room


# ===========================================================================
# 5. 厕所
# ===========================================================================
def scene_restroom() -> Image.Image:
    room = new(W, H, RR["floor"])
    d = ImageDraw.Draw(room)
    tile_floor(room, 58, RR["floor"], RR["floor2"], RR["grout"], 10)

    rect(d, [0, 0, W - 1, 50], RR["wall"])
    for y in range(8, 44, 8):
        off = 0 if (y // 8) % 2 == 0 else 8
        for x in range(-6, W, 18):
            prism(d, x + off, y, 14, 3, 5, RR["hi"], RR["grout"])
    prism(d, 18, 4, 220, 3, 6, WHITE, RR["metal"])

    def stall(x, y, open_=False):
        # booth volume
        prism(d, x, y, 34, 8, 50, RR["stall"], RR["stall_d"])
        if open_:
            rect(d, [x + 6, y + 10, x + 24, y + 50], RR["wall"])
            prism(d, x + 10, y + 28, 12, 6, 14, RR["porc"], RR["metal"])
            rect(d, [x + 13, y + 32, x + 19, y + 38], RR["wet"])
            prism(d, x + 26, y + 10, 8, 6, 42, RR["stall"], RR["metal"])
        else:
            box1(d, x + 6, y + 10, x + 28, y + 52, RR["stall_d"])
            box1(d, x + 22, y + 28, x + 28, y + 34, (40, 44, 48, 255))
            d.point((x + 25, y + 31), fill=RR["peach"])
        # gap under door
        rect(d, [x + 6, y + 52, x + 28, y + 55], RR["floor2"])

    stall(8, 42, False)
    stall(46, 42, False)
    stall(84, 42, True)
    stall(122, 42, False)

    for sx in (170, 208):
        prism(d, sx, 44, 28, 6, 16, RR["metal"], (120, 136, 146, 255))
        rect(d, [sx + 4, 48, sx + 24, 56], (210, 230, 236, 255))
        prism(d, sx + 2, 68, 24, 6, 12, RR["porc"], RR["metal"])
        rect(d, [sx + 6, 72, sx + 20, 78], RR["wet"])
        box1(d, sx + 11, 60, sx + 17, 70, RR["metal"])

    prism(d, 178, 150, 20, 6, 22, RR["metal"], (90, 100, 110, 255))
    blit(room, prop_plant(), 152, 138)
    blit(room, cast_sprite("cast_04", "side", 0), 188, 118)
    return room


# ===========================================================================
# 6. 普通工位 — 岛式 2.5D，空 pad
# ===========================================================================
def scene_office() -> Image.Image:
    room = new(W, H, OF["floor"])
    d = ImageDraw.Draw(room)
    tile_floor(room, 50, OF["floor"], OF["floor2"], OF["grout"], 14)
    rect(d, [0, 0, W - 1, 49], OF["wall"])
    prism(d, 158, 10, 88, 6, 28, (176, 204, 220, 255), (130, 160, 180, 255))

    def island(x, y, left, right):
        prism(d, x, y, 72, 16, 8, OF["desk"], OF["desk_e"])
        empty_pad(d, x + 6, y + 3, 26, 10, (236, 236, 230, 255), OF["desk_e"])
        empty_pad(d, x + 40, y + 3, 26, 10, (236, 236, 230, 255), OF["desk_e"])
        if left:
            blit(room, left, x + 8, y + 2)
        if right:
            blit(room, right, x + 42, y + 3)
        blit(room, chair_back(), x + 8, y + 22)
        blit(room, chair_back(), x + 40, y + 22)

    island(18, 58, prop_laptop(), prop_cup())
    island(140, 58, None, prop_notebook())
    island(18, 118, prop_blindbox(BOXC[4]), None)
    island(140, 118, prop_cup((40, 42, 48, 255)), None)

    blit(room, cast_sprite("cast_05", "front", 0), 206, 148)
    blit(room, cast_sprite("cast_07", "side", 0), 100, 92)
    return room


# ===========================================================================
# 7. 会议室
# ===========================================================================
def scene_meeting() -> Image.Image:
    room = new(W, H, MT["floor"])
    d = ImageDraw.Draw(room)
    tile_floor(room, 52, MT["floor"], MT["floor2"], (52, 46, 62, 255), 14)
    rect(d, [0, 0, W - 1, 51], MT["wall"])
    hline(d, 0, W - 1, 51, MT["holo"])
    prism(d, 68, 10, 120, 6, 28, MT["screen"], (16, 20, 30, 255))
    dither(d, 76, 16, 180, 36, MT["holo"], 4)
    tiny_text(d, 108, 22, "MEET", MT["holo"])

    prism(d, 40, 86, 176, 28, 10, MT["wood"], MT["wood_e"], (130, 90, 54, 255))
    empty_pad(d, 56, 92, 144, 16, (236, 232, 220, 255), MT["wood_e"])
    blit(room, prop_notebook(), 60, 94)
    blit(room, prop_cup(), 188, 96)

    for pos in ((52, 60), (110, 60), (168, 60), (44, 124), (110, 126), (176, 124)):
        blit(room, chair_back(), pos[0], pos[1])

    blit(room, cast_sprite("cast_04", "front", 0), 214, 148)
    blit(room, cast_sprite("cast_01", "side", 0), 16, 108)
    return room


SCENES = [
    dict(id="hutong", title="胡同工位区",
         blurb="远墙一条浅色长桌 · 一侧四座朝墙 · 桌面留空",
         fn=scene_hutong, walk_y=158, line="这边还能放杯子。",
         beat_t="09:20", action="sit_aisle",
         why="相机在过道朝墙：白墙 ttc + 小镜框，一条浅色长桌贴远墙，四把黑椅在桌南侧、人朝墙坐。桌面大块留空，只靠墙放一两件。纵深办公室照片只作白墙/黑椅/顶灯气氛。"),
    dict(id="elevator", title="电梯间",
         blurb="米黄石材 · 开门体积 · 雕塑台座 · 屏与按钮",
         fn=scene_elevator, walk_y=126, line="先等这梯。",
         beat_t="09:12", action="wait_lift",
         why="石材块墙、白石地、中轴雕塑、右侧门拉开见轿厢。人物是 cast。"),
    dict(id="hawaii", title="夏威夷",
         blurb="窗边 2.5D 长桌 · 三空位",
         fn=scene_hawaii, walk_y=140, line="窗边这档先开。",
         beat_t="09:40", action="open_laptop",
         why="卷帘日光 + 一条靠窗桌，三格空 pad，物靠边。"),
    dict(id="popmart", title="泡泡玛特店",
         blurb="2.5D 盒架 · 柜台三空位",
         fn=scene_popmart, walk_y=142, line="就拆一个。",
         beat_t="10:40", action="unbox",
         why="细盒上架、柜台玻璃上三格空 pad，只停三盒。"),
    dict(id="restroom", title="厕所",
         blurb="四隔间体积 + 两水池",
         fn=scene_restroom, walk_y=130, line="洗一下。",
         beat_t="12:10", action="wash",
         why="四间 2.5D 隔间（一间半开见马桶）+ 两个盆。"),
    dict(id="office", title="普通工位",
         blurb="岛式 2.5D · 双空 pad",
         fn=scene_office, walk_y=148, line="回岛上。",
         beat_t="16:20", action="desk_work",
         why="和胡同长桌区分：四岛，每岛两格空 pad，有的完全空。"),
    dict(id="meeting", title="会议室",
         blurb="长桌中央整块空 pad",
         fn=scene_meeting, walk_y=148, line="我记，你们说。",
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
        "> 不是「纯 agent 演完一天」。本人在线操控；离线才由 agent 按卡回放。蒸馏只冷启动。见 [`parallel-universe.md`](parallel-universe.md)。",
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
