#!/usr/bin/env python3
"""Hutong office — empty SK background (wall / floor / desks only).

Painted at 320×320 with chunky 1px-ink Soul Knight tiles, then ×4 NN
to 1280×1280. Official room/scene files are EMPTY: no chairs, people,
or desk objects. Character sprites stay untouched.

Camera: one top-down 3/4. Desktop from above. Only south-facing
vertical faces (pointing down toward the camera) are drawn.
Each row is one joined light-wood desk with four seat positions.

Top/far row: pedestals face the aisle (south) and attach under the
desktop. Bottom/near row: pedestals face the aisle (north) and stay
hidden; only the top + plain modesty panel show.
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
    PREVIEW,
    ROOT,
    blit,
    box1,
    dither,
    drop_shadow,
    hline,
    new,
    noise,
    outline_sprite,
    rect,
    save,
    shade,
    tiny_text,
    vline,
    zoom,
)

ARTIFACT = Path("/opt/cursor/artifacts/screenshots")
HD_DIR = ASSETS / "characters_hd"

ART = 4  # 320 furniture → 1280 display (1 art px = 4 screen px)
BASE_W, BASE_H = 320, 320
HUT_W, HUT_H = BASE_W * ART, BASE_H * ART
VIEW_ZOOM = 1
HUTONG_NORTH = ("cast_01", "cast_02", "cast_03", "cast_04")
HUTONG_SOUTH = ("cast_05", "cast_06", "cast_07", "cast_08")

# 320 layout — 4 seats, long joined desks, v6 proportions
B_SEATS_X = (48, 117, 186, 255)
B_WALL_H = 64
B_CAP_H = 12
B_FAR_DESK_Y = 64
B_BOT_DESK_Y = 266
B_V2_DESK_Y = 6
B_ROOM_EDGE = 8
B_DESK_X = 8
B_DESK_W = 304
B_TOP_H = 20
B_SLAB_H = 7
B_PED_W = 32
B_PED_H = 26
B_MODEST_H = 12
B_FAR_CHAIR_Y = 122
B_WALK_Y = 216
B_BOT_CHAIR_Y = 248
B_V2_WALK_Y = 176
B_V2_CHAIR_Y = 72
B_SIT_ABOVE_BACK = 34
B_SIT_ABOVE_DESK = 40

SEATS_X = tuple(x * ART for x in B_SEATS_X)
WALL_H = B_WALL_H * ART
FAR_DESK_Y = B_FAR_DESK_Y * ART
FAR_CHAIR_Y = B_FAR_CHAIR_Y * ART
WALK_Y = B_WALK_Y * ART
BOT_CHAIR_Y = B_BOT_CHAIR_Y * ART
BOT_DESK_Y = B_BOT_DESK_Y * ART
V2_WALK_Y = B_V2_WALK_Y * ART
V2_DESK_Y = B_V2_DESK_Y * ART
V2_CHAIR_Y = B_V2_CHAIR_Y * ART
SIT_ABOVE_BACK = B_SIT_ABOVE_BACK * ART
SIT_ABOVE_DESK = B_SIT_ABOVE_DESK * ART
ROOM_EDGE = B_ROOM_EDGE * ART

C = {
    "wall": (248, 246, 242, 255),
    "wall_s": (226, 222, 216, 255),
    "cap": (112, 104, 94, 255),
    "cap_hi": (150, 142, 132, 255),
    "cap_d": (64, 58, 52, 255),
    "base": (186, 180, 172, 255),
    "base_d": (128, 122, 114, 255),
    "lip": (168, 162, 156, 255),
    "floor": (206, 204, 202, 255),
    "floor2": (196, 194, 192, 255),
    "grout": (176, 174, 172, 255),
    "desk": (212, 170, 118, 255),
    "desk_hi": (228, 194, 144, 255),
    "desk_g": (188, 144, 94, 255),
    "desk_f": (162, 118, 74, 255),
    "desk_e": (124, 88, 54, 255),
    "drawer": (168, 124, 80, 255),
    "drawer_d": (108, 76, 48, 255),
    "drawer_hi": (186, 146, 100, 255),
    "leg": (108, 78, 50, 255),
    "chair": (28, 28, 32, 255),
    "chair_h": (56, 56, 62, 255),
    "mesh": (72, 72, 80, 255),
    "mesh_hi": (104, 104, 112, 255),
    "mesh_d": (18, 18, 22, 255),
    "ttc": (22, 20, 24, 255),
    "ttc_d": (8, 6, 10, 255),
    "sub": (36, 34, 38, 255),
    "frame": (150, 150, 154, 255),
    "mat": (214, 214, 218, 255),
    "edge": (150, 150, 154, 255),
}


def _crop_opaque(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def hutong_cast(cid, view):
    path = HD_DIR / cid / f"{view}.png"
    return _crop_opaque(Image.open(path).convert("RGBA"))


def _star_base(d, cx, cy):
    md = shade(C["chair"], 18)
    rect(d, [cx - 1, cy - 1, cx + 1, cy + 1], C["chair_h"])
    d.point((cx, cy), fill=C["mesh_hi"])
    legs = ((0, -7), (7, -2), (5, 6), (-5, 6), (-7, -2))
    for dx, dy in legs:
        steps = max(abs(dx), abs(dy), 1)
        for i in range(1, steps + 1):
            d.point((cx + int(round(dx * i / steps)), cy + int(round(dy * i / steps))), fill=C["chair"])
        d.point((cx + dx, cy + dy), fill=C["chair_h"])
        d.point((cx + dx + 1, cy + dy), fill=md)
        d.point((cx + dx, cy + dy + 1), fill=INK)


def _arm_pad(d, cx, cy):
    d.point((cx, cy), fill=C["mesh_hi"])
    for dx, dy in ((-1, 0), (1, 0), (0, 1), (0, -1), (-1, 1), (1, 1)):
        d.point((cx + dx, cy + dy), fill=C["chair_h"])


def chair_north() -> Image.Image:
    img = new(30, 34)
    d = ImageDraw.Draw(img)
    for i, (x0, x1, y) in enumerate(((8, 21, 33), (7, 22, 32))):
        hline(d, x0, x1, y, (22, 20, 24, 70 - i * 18))
    _star_base(d, 14, 26)
    vline(d, 13, 20, 25, C["chair"])
    vline(d, 14, 20, 25, C["chair_h"])
    vline(d, 15, 20, 25, C["chair"])
    rect(d, [7, 18, 22, 21], C["chair_h"])
    hline(d, 7, 22, 18, shade(C["chair_h"], 28))
    hline(d, 8, 21, 19, C["mesh_hi"])
    hline(d, 7, 22, 21, C["chair"])
    box1(d, 2, 15, 6, 21, C["chair"], C["chair_h"])
    box1(d, 23, 15, 27, 21, C["chair"], C["chair_h"])
    _arm_pad(d, 4, 14)
    _arm_pad(d, 25, 14)
    rect(d, [7, 1, 22, 17], C["mesh_d"])
    rect(d, [8, 2, 21, 16], C["mesh"])
    for y in range(3, 16):
        for x in range(9, 21):
            hi = (x + y) % 2 == 0 or (11 <= x <= 18 and 6 <= y <= 10)
            d.point((x, y), fill=C["mesh_hi"] if hi else C["mesh"])
    hline(d, 10, 19, 5, shade(C["mesh_hi"], 22))
    hline(d, 9, 20, 2, C["chair_h"])
    hline(d, 8, 21, 16, C["chair"])
    vline(d, 8, 2, 16, C["chair_h"])
    vline(d, 21, 2, 16, C["chair"])
    return outline_sprite(img)


def chair_south() -> Image.Image:
    img = new(32, 36)
    d = ImageDraw.Draw(img)
    hline(d, 9, 22, 1, C["chair_h"])
    hline(d, 8, 23, 2, shade(C["chair_h"], 16))
    rect(d, [7, 3, 24, 22], C["chair"])
    rect(d, [8, 4, 23, 21], C["chair_h"])
    hline(d, 10, 21, 5, shade(C["chair_h"], 28))
    hline(d, 11, 20, 6, C["mesh_hi"])
    vline(d, 8, 4, 21, shade(C["chair_h"], 18))
    vline(d, 23, 4, 21, C["chair"])
    rect(d, [5, 3, 8, 10], C["chair"])
    rect(d, [23, 3, 26, 10], C["chair"])
    rect(d, [6, 4, 7, 9], C["chair_h"])
    rect(d, [24, 4, 25, 9], C["chair_h"])
    rect(d, [8, 23, 23, 27], C["chair_h"])
    hline(d, 9, 22, 24, C["mesh_hi"])
    hline(d, 8, 23, 27, C["chair"])
    box1(d, 1, 16, 6, 27, C["chair"], C["chair_h"])
    box1(d, 25, 16, 30, 27, C["chair"], C["chair_h"])
    _arm_pad(d, 3, 15)
    _arm_pad(d, 28, 15)
    return outline_sprite(img)


# ---------------------------------------------------------------------------
# Empty-room tiles — Soul Knight 3/4, hard pixels, 2–3 tones
# ---------------------------------------------------------------------------

def floor(d, y0):
    tile = 20
    rect(d, [0, y0, BASE_W - 1, BASE_H - 1], C["floor"])
    for ty in range(y0, BASE_H, tile):
        hline(d, 0, BASE_W - 1, ty, C["grout"])
    for tx in range(0, BASE_W, tile):
        vline(d, tx, y0, BASE_H - 1, C["grout"])
    noise(d, 0, y0, BASE_W - 1, BASE_H - 1, C["floor2"], every=31)


def _blk(d, sx, sy, w, h, face, dep):
    """Flat SK block letter — 1px south-east depth, no soft bevel."""
    rect(d, [sx + 1, sy + 1, sx + w, sy + h], dep)
    rect(d, [sx, sy, sx + w - 1, sy + h - 1], face)


def draw_ttc(d, x, y):
    face, dep = C["ttc"], C["ttc_d"]

    def blk(sx, sy, w, h):
        _blk(d, sx, sy, w, h, face, dep)

    # lowercase t t c — chunky SK blocks
    blk(x + 6, y, 6, 24)
    blk(x, y + 6, 18, 6)
    blk(x + 28, y, 6, 24)
    blk(x + 22, y + 6, 18, 6)
    blk(x + 46, y + 2, 6, 22)
    blk(x + 46, y + 2, 16, 6)
    blk(x + 46, y + 18, 16, 6)

    tiny_text(d, x + 68, y + 3, "TRUE", C["sub"])
    tiny_text(d, x + 68, y + 11, "TALENTS", C["sub"])
    tiny_text(d, x + 68, y + 19, "CONNECT", C["sub"])


def _plaque(d, x, y, s=11):
    box1(d, x, y, x + s - 1, y + s - 1, C["mat"], C["frame"])
    rect(d, [x + 2, y + 2, x + s - 3, y + s - 3], shade(C["mat"], -12))


def wall(d):
    """Vertical wall FACE + thick top cap (SK dungeon / lobby wall tile)."""
    cap_top = 4
    # cap top (wall thickness seen from above)
    rect(d, [0, 0, BASE_W - 1, cap_top - 1], C["cap_hi"])
    hline(d, 0, BASE_W - 1, 0, C["cap_d"])
    hline(d, 1, BASE_W - 2, 1, shade(C["cap_hi"], 16))
    hline(d, 0, BASE_W - 1, cap_top - 1, C["cap_d"])
    # cap south face (thick rim pointing at the camera)
    rect(d, [0, cap_top, BASE_W - 1, B_CAP_H - 1], C["cap"])
    hline(d, 0, BASE_W - 1, cap_top, shade(C["cap"], 18))
    dither(d, 1, cap_top + 2, BASE_W - 2, B_CAP_H - 3, C["cap_d"], 5)
    hline(d, 0, BASE_W - 1, B_CAP_H - 1, INK)

    # wall face
    face_y1 = B_WALL_H - 6
    rect(d, [0, B_CAP_H, BASE_W - 1, face_y1], C["wall"])
    hline(d, 0, BASE_W - 1, B_CAP_H, shade(C["wall"], 10))
    dither(d, 0, B_CAP_H, BASE_W - 1, B_CAP_H + 3, C["wall_s"], 4)

    # baseboard (south lip where wall meets floor)
    rect(d, [0, face_y1 + 1, BASE_W - 1, B_WALL_H - 2], C["base"])
    hline(d, 0, BASE_W - 1, face_y1 + 1, C["base_d"])
    hline(d, 0, BASE_W - 1, B_WALL_H - 3, shade(C["base"], 14))
    hline(d, 0, BASE_W - 1, B_WALL_H - 1, INK)
    hline(d, 0, BASE_W - 1, B_WALL_H - 2, C["lip"])

    draw_ttc(d, 16, B_CAP_H + 6)
    size, pitch, col0 = 11, 16, 232
    for fy in (B_CAP_H + 6, B_CAP_H + 22):
        for c in range(4):
            _plaque(d, col0 + c * pitch, fy, size)


def room_edge(d, y):
    hline(d, 0, BASE_W - 1, y, C["edge"])
    hline(d, 0, BASE_W - 1, y + 1, INK)
    rect(d, [0, y + 2, BASE_W - 1, BASE_H - 1], shade(C["floor"], -14))


def _wood_top(d, x, y, w, h):
    """Desktop from above — 3 flat plank tones, 1px ink, no gradients."""
    rect(d, [x, y, x + w - 1, y + h - 1], C["desk"])
    plank = 4
    for i, gy in enumerate(range(y + 2, y + h - 2, plank)):
        band = C["desk"] if i % 2 == 0 else shade(C["desk"], -16)
        y1 = min(gy + plank - 2, y + h - 3)
        rect(d, [x + 2, gy, x + w - 3, y1], band)
        hline(d, x + 2, x + w - 3, y1, C["desk_g"])
    hline(d, x + 1, x + w - 2, y + 1, C["desk_hi"])
    vline(d, x + 1, y + 1, y + h - 2, C["desk_hi"])
    hline(d, x, x + w - 1, y, INK)
    hline(d, x, x + w - 1, y + h - 1, INK)
    vline(d, x, y, y + h - 1, INK)
    vline(d, x + w - 1, y, y + h - 1, INK)


def _south_face(d, x, y, w, h, face):
    """South-facing vertical board (points down at the camera)."""
    rect(d, [x, y, x + w - 1, y + h - 1], face)
    hline(d, x + 1, x + w - 2, y, shade(face, 20))
    if h > 3:
        dither(d, x + 2, y + 2, x + w - 3, y + h - 2, shade(face, -14), 6)
    hline(d, x, x + w - 1, y + h - 1, INK)
    vline(d, x, y, y + h - 1, INK)
    vline(d, x + w - 1, y, y + h - 1, INK)


def _end_leg(d, x, y0, y1):
    """Block desk post from the underside down to a foot on the floor."""
    rect(d, [x, y0, x + 5, y1], C["leg"])
    vline(d, x, y0, y1, INK)
    vline(d, x + 5, y0, y1, INK)
    vline(d, x + 1, y0, y1, shade(C["leg"], 16))
    rect(d, [x - 1, y1 - 1, x + 6, y1 + 1], C["leg"])
    hline(d, x - 1, x + 6, y1 + 1, INK)


def _pedestal(d, x, y, w, h, drawers=3):
    """Under-desk pedestal. y is the join with the desktop underside.

    Only the south face (+ a 2px east slab) is drawn. The top is hidden
    under the desktop. Drawn before the slab so the join cannot float.
    """
    face, dark, hi = C["drawer"], C["drawer_d"], C["drawer_hi"]
    plinth = 3
    body_h = h - plinth
    rect(d, [x, y, x + w - 1, y + body_h - 1], face)
    # east slab — SK volume, not an up-facing plane
    rect(d, [x + w, y + 1, x + w + 1, y + h - 1], C["desk_e"])
    vline(d, x + w + 1, y + 1, y + h - 1, INK)
    hline(d, x + 1, x + w - 2, y + 1, hi)
    hline(d, x, x + w - 1, y, INK)
    vline(d, x, y, y + h - 1, INK)
    vline(d, x + w - 1, y, y + body_h - 1, INK)

    inner = body_h - 4
    dh = inner // drawers
    for i in range(drawers):
        dy0 = y + 2 + i * dh
        dy1 = dy0 + dh - 2
        box1(d, x + 3, dy0, x + w - 4, dy1, hi, dark)
        hx0 = x + w // 2 - 5
        hx1 = x + w // 2 + 4
        hy = (dy0 + dy1) // 2
        hline(d, hx0, hx1, hy, dark)
        hline(d, hx0, hx1, hy + 1, INK)
        d.point((hx0, hy), fill=INK)
        d.point((hx1, hy), fill=INK)

    # plinth sits on the floor — cabinet is furniture, not a hanging box
    rect(d, [x, y + body_h, x + w - 1, y + h - 1], C["desk_e"])
    hline(d, x, x + w - 1, y + body_h, dark)
    hline(d, x, x + w - 1, y + h - 1, INK)
    for fx in (x + 1, x + w - 4):
        rect(d, [fx, y + h, fx + 2, y + h + 1], C["leg"])
        hline(d, fx, fx + 2, y + h + 1, INK)


def draw_desk_row(d, x, y, w, show_pedestals: bool):
    """One long 4-seat desk.

    show_pedestals=True  → aisle-facing (south) pedestals, attached under slab.
    show_pedestals=False → drawers face north / are hidden; top + modesty only.
    """
    top_h = B_TOP_H
    slab = B_SLAB_H
    ped_h, ped_w = B_PED_H, B_PED_W
    modest = B_MODEST_H
    body_h = slab + ped_h + 3 if show_pedestals else modest + 3
    drop_shadow(d, x + 2, y + top_h + body_h - 4, w - 2, 7, ox=2, oy=2)

    if show_pedestals:
        # Pedestals first, tucked 1px under the slab so they cannot float.
        join_y = y + top_h + slab - 1
        for sx in B_SEATS_X:
            px = sx - ped_w // 2
            px = max(x + 10, min(x + w - ped_w - 10, px))
            _pedestal(d, px, join_y, ped_w, ped_h, drawers=3)
        foot_y = join_y + ped_h + 1
        _end_leg(d, x + 4, join_y, foot_y)
        _end_leg(d, x + w - 10, join_y, foot_y)
        _wood_top(d, x, y, w, top_h)
        _south_face(d, x, y + top_h, w, slab, C["desk_f"])
        # shared ink at the slab / pedestal join
        hline(d, x, x + w - 1, y + top_h + slab - 1, INK)
    else:
        _wood_top(d, x, y, w, top_h)
        _south_face(d, x, y + top_h, w, modest, C["desk_f"])
        fy = y + top_h + modest
        _end_leg(d, x + 4, fy - 1, fy + 2)
        _end_leg(d, x + w - 10, fy - 1, fy + 2)


def paint_empty(view: str) -> Image.Image:
    """320 art: wall / floor / two desks. No chairs, people, or props."""
    room = new(BASE_W, BASE_H, C["floor"])
    d = ImageDraw.Draw(room)
    if view == "v1":
        floor(d, B_WALL_H)
        wall(d)
        draw_desk_row(d, B_DESK_X, B_FAR_DESK_Y, B_DESK_W, show_pedestals=True)
        draw_desk_row(d, B_DESK_X, B_BOT_DESK_Y, B_DESK_W, show_pedestals=False)
    else:
        floor(d, 0)
        draw_desk_row(d, B_DESK_X, B_V2_DESK_Y, B_DESK_W, show_pedestals=True)
        draw_desk_row(d, B_DESK_X, B_BOT_DESK_Y, B_DESK_W, show_pedestals=False)
        room_edge(d, BASE_H - B_ROOM_EDGE)
    return room


def _opaque_top(im: Image.Image) -> int:
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 80:
                return y
    return 0


def _furn_chair(north: bool):
    return zoom(chair_north() if north else chair_south(), ART)


def _seat_back(room, cid, cx, chair, chx, chy, desk_end):
    spr = hutong_cast(cid, "sit_back")
    br_top = chy + _opaque_top(chair)
    py = br_top - SIT_ABOVE_BACK
    if py < desk_end + 1:
        py = desk_end + 1
    blit(room, spr, cx - spr.size[0] // 2, py)
    blit(room, chair, chx, chy)


def _seat_front(room, cid, cx, chair, chx, chy, desk_y):
    blit(room, chair, chx, chy)
    spr = hutong_cast(cid, "sit_front")
    blit(room, spr, cx - spr.size[0] // 2, desk_y - SIT_ABOVE_DESK)


def _people_only(room, desk_y, chair_y, who, facing):
    """Composite chairs + people onto an already-painted empty room."""
    north = facing == "north"
    chair = _furn_chair(north)
    top_h = B_TOP_H * ART
    front = (B_SLAB_H + B_PED_H) * ART if north else B_MODEST_H * ART
    desk_end = desk_y + top_h + front
    for i, cx in enumerate(SEATS_X):
        if not who[i]:
            continue
        chx = cx - chair.size[0] // 2
        if north:
            _seat_back(room, who[i], cx, chair, chx, chair_y, desk_end)
        else:
            _seat_front(room, who[i], cx, chair, chx, chair_y, desk_y)


def paint(view: str, people: bool = False) -> Image.Image:
    room = zoom(paint_empty(view), ART)
    if not people:
        return room
    if view == "v1":
        _people_only(room, FAR_DESK_Y, FAR_CHAIR_Y, HUTONG_NORTH, "north")
        _people_only(room, BOT_DESK_Y, BOT_CHAIR_Y, HUTONG_SOUTH, "south")
    else:
        _people_only(room, V2_DESK_Y, V2_CHAIR_Y, tuple(reversed(HUTONG_SOUTH)), "north")
        _people_only(room, BOT_DESK_Y, BOT_CHAIR_Y, tuple(reversed(HUTONG_NORTH)), "south")
    return room


def _desk_boxes_1x():
    """Crop boxes on the 1280 canvas around each empty desk."""
    x0 = (B_DESK_X - 2) * ART
    x1 = (B_DESK_X + B_DESK_W + 2) * ART
    top_h = (B_TOP_H + B_SLAB_H + B_PED_H + 6) * ART
    bot_h = (B_TOP_H + B_MODEST_H + 6) * ART
    top = (x0, (B_FAR_DESK_Y - 2) * ART, x1, B_FAR_DESK_Y * ART + top_h)
    bot = (x0, (B_BOT_DESK_Y - 2) * ART, x1, B_BOT_DESK_Y * ART + bot_h)
    return top, bot


def write_deliverables(v1, v2):
    """Official empty rooms + 1× / 2× views + 4× desk crops."""
    top_box, bot_box = _desk_boxes_1x()
    top_4 = zoom(v1.crop(top_box), 4)
    bot_4 = zoom(v1.crop(bot_box), 4)
    v1_2 = zoom(v1, 2)
    v2_2 = zoom(v2, 2)

    for spec, img in (("hutong", v1), ("hutong_reverse", v2)):
        save(img, ASSETS / "scenes" / spec / f"scene_{spec}.png")
        save(img, ASSETS / "rooms" / f"room_{spec}.png")
        save(
            img.resize((img.size[0] // 2, img.size[1] // 2), Image.Resampling.NEAREST),
            ASSETS / "rooms" / "thumbs" / f"room_{spec}.png",
        )
        save(zoom(img, VIEW_ZOOM), PREVIEW / "zoomed" / f"{spec}.png")

    names = {
        "hutong_empty_view1.png": v1,
        "hutong_empty_view2.png": v2,
        "hutong_empty_view1_2x.png": v1_2,
        "hutong_empty_view2_2x.png": v2_2,
        "hutong_empty_desk_top_4x.png": top_4,
        "hutong_empty_desk_bot_4x.png": bot_4,
        "hutong_empty_hd.png": v1,
        "hutong_view1_hd.png": v1,
        "hutong_view2_hd.png": v2,
    }
    for dest in (PREVIEW, ARTIFACT):
        dest.mkdir(parents=True, exist_ok=True)
        for name, img in names.items():
            save(img, dest / name)


def patch_manifest():
    man = ASSETS / "manifest.json"
    if not man.exists():
        return
    data = json.loads(man.read_text(encoding="utf-8"))
    for s in data.get("scenes", []):
        if s.get("id") == "hutong":
            s["walk_y"] = WALK_Y
            s["canvas"] = [HUT_W, HUT_H]
        if s.get("id") == "hutong_reverse":
            s["walk_y"] = V2_WALK_Y
            s["canvas"] = [HUT_W, HUT_H]
    man.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  wrote {man.relative_to(ROOT)}")


def _self_check(v1: Image.Image):
    """Pixel tests: spelling, 4 pedestals, no bottom drawers, no chairs."""
    px = v1.load()

    def sample(bx, by):
        return px[bx * ART + 2, by * ART + 2][:3]

    # wall text lives around ttc block — confirm dark ink on the face
    logo = sample(24, B_CAP_H + 10)
    assert logo[0] < 80, f"ttc logo not dark: {logo}"

    # 4 pedestals: each seat-x under the far desk should be drawer wood, not floor
    join = B_FAR_DESK_Y + B_TOP_H + B_SLAB_H + 6
    ped_hits = 0
    for sx in B_SEATS_X:
        r, g, b = sample(sx - 6, join)
        floorish = abs(r - g) < 14 and abs(g - b) < 14 and r > 160
        if not floorish:
            ped_hits += 1
        else:
            print(f"  WARN pedestal at x={sx} y={join} rgb=({r},{g},{b})")
    assert ped_hits == 4, f"expected 4 pedestals, got {ped_hits}"

    # bottom desk front must be plain wood — no drawer-handle ink clusters
    modest_y = B_BOT_DESK_Y + B_TOP_H + B_MODEST_H // 2
    drawer_like = 0
    for sx in B_SEATS_X:
        r, g, b = sample(sx, modest_y)
        if r < 80 and g < 80 and b < 80:
            drawer_like += 1
    assert drawer_like == 0, f"bottom desk shows dark drawer hits: {drawer_like}"

    # aisle must stay floor grey — no chair-black blobs at old chair rows
    chair_black = 0
    for sx in B_SEATS_X:
        for by in (B_FAR_CHAIR_Y + 8, B_BOT_CHAIR_Y + 4):
            r, g, b = sample(sx, by)
            if r < 50 and g < 50 and b < 50:
                chair_black += 1
    assert chair_black == 0, f"aisle has chair-black pixels: {chair_black}"

    print("  self-check OK: 4 pedestals, hidden bottom drawers, no chairs")


def main():
    print("Generating empty HD hutong (SK tiles, no people)…")
    v1 = paint("v1", people=False)
    v2 = paint("v2", people=False)
    assert v1.size == (HUT_W, HUT_H), v1.size
    _self_check(v1)
    write_deliverables(v1, v2)
    patch_manifest()
    print("Done empty hutong HD.")


if __name__ == "__main__":
    main()
