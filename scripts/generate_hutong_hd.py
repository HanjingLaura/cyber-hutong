#!/usr/bin/env python3
"""Hutong office: accepted 320 furniture, 4× NN, native concept people.

Furniture is still drawn at the accepted 320×320 art and nearest-scaled
to 1280×1280 (1 furniture art pixel = 4 screen pixels). People are the
native concept crops (already ~240 px tall) seated 1:1 on that canvas.
Matches uploads/hutong_bg_concept.png: white wall, baseboard, side walls,
ttc + TRUE/TALENT/CENTER, two rows of 7 frames, thick light-wood desks,
2-drawer cabinets, HD office chairs.
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
    vline,
    zoom,
    GLYPHS,
)

ARTIFACT = Path("/opt/cursor/artifacts/screenshots")
HD_DIR = ASSETS / "characters_hd"

ART = 4  # accepted 320 furniture → 1280 display
BASE_W, BASE_H = 320, 320
HUT_W, HUT_H = BASE_W * ART, BASE_H * ART
VIEW_ZOOM = 1  # scene already equals the 1280 preview
HUTONG_NORTH = ("cast_01", "cast_02", "cast_03", "cast_04")
HUTONG_SOUTH = ("cast_05", "cast_06", "cast_07", "cast_08")

# accepted 320 layout (do not redesign)
B_SEATS_X = (48, 117, 186, 255)
B_WALL_H = 54
B_FAR_DESK_Y = 50
FAR_TOP, FAR_FRONT = 18, 20
B_FAR_CHAIR_Y = 122
B_WALK_Y = 216
B_BOT_CHAIR_Y = 248
B_BOT_DESK_Y = 272
NEAR_TOP, NEAR_FRONT = 22, 22
B_V2_WALK_Y = 176
B_V2_DESK_Y = 2
B_V2_CHAIR_Y = 72
B_SIT_ABOVE_BACK = 34
B_SIT_ABOVE_DESK = 40
B_EMPTY_SOUTH_LIFT = 16
B_ROOM_EDGE = 8

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
EMPTY_SOUTH_LIFT = B_EMPTY_SOUTH_LIFT * ART
ROOM_EDGE = B_ROOM_EDGE * ART

C = {
    "wall": (248, 246, 242, 255),
    "wall_s": (228, 224, 218, 255),
    "side": (210, 206, 200, 255),
    "side_d": (168, 164, 158, 255),
    "base": (196, 190, 182, 255),
    "base_d": (140, 134, 126, 255),
    "lip": (188, 184, 178, 255),
    "floor": (210, 208, 206, 255),
    "floor2": (198, 196, 194, 255),
    "grout": (186, 184, 182, 255),
    "desk": (214, 176, 128, 255),
    "desk_hi": (232, 200, 156, 255),
    "desk_g": (190, 148, 100, 255),
    "desk_f": (168, 126, 84, 255),
    "desk_e": (132, 96, 62, 255),
    "drawer": (176, 134, 90, 255),
    "drawer_d": (118, 86, 54, 255),
    "leg": (120, 88, 56, 255),
    "chair": (28, 28, 32, 255),
    "chair_h": (56, 56, 62, 255),
    "mesh": (72, 72, 80, 255),
    "mesh_hi": (104, 104, 112, 255),
    "mesh_d": (18, 18, 22, 255),
    "ttc": (24, 22, 26, 255),
    "ttc_d": (10, 8, 12, 255),
    "ttc_hi": (70, 68, 74, 255),
    "frame": (176, 176, 180, 255),
    "mat": (236, 236, 238, 255),
    "sub": (110, 110, 116, 255),
    "edge": (160, 160, 164, 255),
}


def _crop_opaque(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def hutong_cast(cid, view):
    path = HD_DIR / cid / f"{view}.png"
    return _crop_opaque(Image.open(path).convert("RGBA"))


def _star_base(d, cx, cy):
    """Five-caster base — concept has a hub + 5 legs ending in round feet."""
    md = shade(C["chair"], 18)
    rect(d, [cx - 1, cy - 1, cx + 1, cy + 1], C["chair_h"])
    d.point((cx, cy), fill=C["mesh_hi"])
    legs = ((0, -7), (7, -2), (5, 6), (-5, 6), (-7, -2))
    for dx, dy in legs:
        steps = max(abs(dx), abs(dy), 1)
        for i in range(1, steps + 1):
            d.point((cx + int(round(dx * i / steps)), cy + int(round(dy * i / steps))), fill=C["chair"])
        # caster dot
        d.point((cx + dx, cy + dy), fill=C["chair_h"])
        d.point((cx + dx + 1, cy + dy), fill=md)
        d.point((cx + dx, cy + dy + 1), fill=INK)


def _arm_pad(d, cx, cy):
    d.point((cx, cy), fill=C["mesh_hi"])
    for dx, dy in ((-1, 0), (1, 0), (0, 1), (0, -1), (-1, 1), (1, 1)):
        d.point((cx + dx, cy + dy), fill=C["chair_h"])


def chair_north() -> Image.Image:
    """From behind: mesh back, arms, seat highlight, 5-star — concept far chairs."""
    img = new(30, 34)
    d = ImageDraw.Draw(img)
    for i, (x0, x1, y) in enumerate(((8, 21, 33), (7, 22, 32))):
        hline(d, x0, x1, y, (22, 20, 24, 70 - i * 18))
    _star_base(d, 14, 26)
    vline(d, 13, 20, 25, C["chair"])
    vline(d, 14, 20, 25, C["chair_h"])
    vline(d, 15, 20, 25, C["chair"])
    # seat + cushion
    rect(d, [7, 18, 22, 21], C["chair_h"])
    hline(d, 7, 22, 18, shade(C["chair_h"], 28))
    hline(d, 8, 21, 19, C["mesh_hi"])
    hline(d, 7, 22, 21, C["chair"])
    # arms
    box1(d, 2, 15, 6, 21, C["chair"], C["chair_h"])
    box1(d, 23, 15, 27, 21, C["chair"], C["chair_h"])
    _arm_pad(d, 4, 14)
    _arm_pad(d, 25, 14)
    # mesh backrest — short enough that seated heads sit above it
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
    """From the front: tall solid back + arms (concept near chairs, not a sofa)."""
    img = new(32, 36)
    d = ImageDraw.Draw(img)
    # 3/4 top of the backrest
    hline(d, 9, 22, 1, C["chair_h"])
    hline(d, 8, 23, 2, shade(C["chair_h"], 16))
    # tall rounded solid back
    rect(d, [7, 3, 24, 22], C["chair"])
    rect(d, [8, 4, 23, 21], C["chair_h"])
    hline(d, 10, 21, 5, shade(C["chair_h"], 28))
    hline(d, 11, 20, 6, C["mesh_hi"])
    vline(d, 8, 4, 21, shade(C["chair_h"], 18))
    vline(d, 23, 4, 21, C["chair"])
    # flared top corners
    rect(d, [5, 3, 8, 10], C["chair"])
    rect(d, [23, 3, 26, 10], C["chair"])
    rect(d, [6, 4, 7, 9], C["chair_h"])
    rect(d, [24, 4, 25, 9], C["chair_h"])
    # seat
    rect(d, [8, 23, 23, 27], C["chair_h"])
    hline(d, 9, 22, 24, C["mesh_hi"])
    hline(d, 8, 23, 27, C["chair"])
    # arms + pads
    box1(d, 1, 16, 6, 27, C["chair"], C["chair_h"])
    box1(d, 25, 16, 30, 27, C["chair"], C["chair_h"])
    _arm_pad(d, 3, 15)
    _arm_pad(d, 28, 15)
    return outline_sprite(img)


def _drawer(d, x0, y0, w=24, h=18):
    """Two stacked drawers, each with a handle."""
    face, dark = C["drawer"], C["drawer_d"]
    rect(d, [x0, y0, x0 + w - 1, y0 + h - 1], face)
    hline(d, x0, x0 + w - 1, y0, INK)
    hline(d, x0, x0 + w - 1, y0 + h - 1, INK)
    vline(d, x0, y0, y0 + h - 1, INK)
    vline(d, x0 + w - 1, y0, y0 + h - 1, INK)
    mid = y0 + h // 2
    hline(d, x0 + 1, x0 + w - 2, mid, dark)
    hline(d, x0 + 1, x0 + w - 2, y0 + 1, shade(face, 22))
    hline(d, x0 + 1, x0 + w - 2, mid + 1, shade(face, 16))
    hx0, hx1 = x0 + w // 2 - 4, x0 + w // 2 + 3
    for hy in (y0 + h // 4, y0 + (3 * h) // 4):
        hline(d, hx0, hx1, hy, dark)
        hline(d, hx0, hx1, hy + 1, INK)
        d.point((hx0, hy), fill=INK)
        d.point((hx1, hy), fill=INK)


def desk_sprite(w, top_h, front_h, drawers, legs=True) -> Image.Image:
    sh = 6
    img = new(w + 3, top_h + front_h + sh)
    d = ImageDraw.Draw(img)
    drop_shadow(d, 2, top_h + front_h - 2, w, 8, ox=2, oy=2)
    rect(d, [0, 0, w - 1, top_h - 1], C["desk"])
    plank = 3
    for i, gy in enumerate(range(2, top_h - 2, plank)):
        band = C["desk"] if i % 2 == 0 else shade(C["desk"], -12)
        y1 = min(gy + plank - 2, top_h - 3)
        rect(d, [2, gy, w - 3, y1], band)
        hline(d, 2, w - 3, y1, C["desk_g"])
    hline(d, 1, w - 2, 1, C["desk_hi"])
    hline(d, 1, w - 2, top_h - 2, shade(C["desk_hi"], -8))
    rect(d, [0, top_h, w - 1, top_h + front_h - 1], C["desk_f"])
    hline(d, 1, w - 2, top_h, shade(C["desk_f"], 26))
    dither(d, 2, top_h + 3, w - 3, top_h + front_h - 2, shade(C["desk_f"], -14), 4)
    rect(d, [w, 1, w + 2, top_h + front_h - 1], C["desk_e"])
    cab_h = min(front_h - 2, 18)
    for cx in drawers:
        dw = 24
        x0 = max(4, min(w - dw - 3, cx - dw // 2))
        _drawer(d, x0, top_h + front_h - cab_h, dw, cab_h)
    if legs:
        for lx in (6, w - 10):
            rect(d, [lx, top_h + front_h - 1, lx + 3, top_h + front_h + 3], C["leg"])
            vline(d, lx, top_h + front_h - 1, top_h + front_h + 3, INK)
            vline(d, lx + 3, top_h + front_h - 1, top_h + front_h + 3, INK)
    hline(d, 0, w - 1, 0, INK)
    hline(d, 0, w - 1, top_h - 1, INK)
    hline(d, 0, w - 1, top_h + front_h - 1, INK)
    vline(d, 0, 0, top_h + front_h - 1, INK)
    vline(d, w - 1, 0, top_h + front_h - 1, INK)
    return img


def floor(d, y0):
    tile = 20
    rect(d, [0, y0, BASE_W - 1, BASE_H - 1], C["floor"])
    for ty in range(y0, BASE_H, tile):
        hline(d, 0, BASE_W - 1, ty, C["grout"])
        if ty + 1 < BASE_H:
            hline(d, 0, BASE_W - 1, ty + 1, shade(C["floor"], 8))
    for tx in range(0, BASE_W, tile):
        vline(d, tx, y0, BASE_H - 1, C["grout"])
        if tx + 1 < BASE_H:
            vline(d, tx + 1, y0, BASE_H - 1, shade(C["floor"], 8))
    noise(d, 0, y0, BASE_W - 1, BASE_H - 1, C["floor2"], every=29)
    dither(d, 0, BASE_H - 18, BASE_W - 1, BASE_H - 1, shade(C["floor"], -10), 5)


def _blk(d, sx, sy, w, h, face, dep, hi):
    rect(d, [sx + 2, sy + 2, sx + w + 1, sy + h + 1], dep)
    rect(d, [sx, sy, sx + w - 1, sy + h - 1], face)
    hline(d, sx, sx + w - 2, sy, hi)
    vline(d, sx, sy, sy + h - 2, hi)
    vline(d, sx + w - 1, sy, sy + h - 1, shade(face, -22))
    hline(d, sx, sx + w - 1, sy + h - 1, shade(face, -28))


def draw_ttc(d, x, y):
    face, dep, hi = C["ttc"], C["ttc_d"], C["ttc_hi"]

    def blk(sx, sy, w, h):
        _blk(d, sx, sy, w, h, face, dep, hi)

    # t t c — concept proportions
    blk(x + 6, y, 6, 26)
    blk(x, y + 7, 18, 6)
    blk(x + 28, y, 6, 26)
    blk(x + 22, y + 7, 18, 6)
    blk(x + 46, y + 2, 6, 22)
    blk(x + 46, y + 2, 16, 6)
    blk(x + 46, y + 18, 16, 6)

    def word(wx, wy, text):
        cx = wx
        for ch in text:
            bits = GLYPHS.get(ch)
            if not bits:
                cx += 6
                continue
            for row, rowbits in enumerate(bits):
                for col, bit in enumerate(rowbits):
                    if bit == "1":
                        d.point((cx + col, wy + row), fill=C["sub"])
            cx += len(bits[0]) + 2

    word(x + 68, y + 4, "TRUE")
    word(x + 68, y + 12, "TALENT")
    word(x + 68, y + 20, "CENTER")


def _plaque(d, x, y, s=12):
    box1(d, x, y, x + s - 1, y + s - 1, C["mat"], C["frame"])
    hline(d, x, x + s - 1, y, shade(C["frame"], -18))
    vline(d, x, y, y + s - 1, shade(C["frame"], -18))
    hline(d, x + 1, x + s - 2, y + 1, shade(C["frame"], 16))
    vline(d, x + 1, y + 1, y + s - 2, shade(C["frame"], 16))
    rect(d, [x + 3, y + 3, x + s - 4, y + s - 4], shade(C["mat"], -8))


def wall(d):
    # side walls in perspective — receding planes that widen toward the camera
    for x in range(0, 14):
        t = x / 13
        col = shade(C["side"], int(-22 + 22 * t))
        vline(d, x, 0, B_WALL_H - 1, col)
        vline(d, BASE_W - 1 - x, 0, B_WALL_H - 1, col)
    vline(d, 13, 0, B_WALL_H - 1, C["side_d"])
    vline(d, BASE_W - 14, 0, B_WALL_H - 1, C["side_d"])
    # back wall
    rect(d, [14, 0, BASE_W - 15, B_WALL_H - 1], C["wall"])
    hline(d, 14, BASE_W - 15, 0, shade(C["wall"], -8))
    dither(d, 14, 0, BASE_W - 15, 6, C["wall_s"], 4)
    # baseboard
    rect(d, [14, B_WALL_H - 6, BASE_W - 15, B_WALL_H - 2], C["base"])
    hline(d, 14, BASE_W - 15, B_WALL_H - 6, C["base_d"])
    hline(d, 14, BASE_W - 15, B_WALL_H - 3, shade(C["base"], 16))
    hline(d, 0, BASE_W - 1, B_WALL_H - 1, INK)
    hline(d, 0, BASE_W - 1, B_WALL_H - 2, C["lip"])
    draw_ttc(d, 18, 10)
    size, pitch, col0 = 11, 16, 172
    for fy in (7, 24):
        for c in range(7):
            _plaque(d, col0 + c * pitch, fy, size)


def room_edge(d, y):
    hline(d, 0, BASE_W - 1, y, C["edge"])
    hline(d, 0, BASE_W - 1, y + 1, INK)
    rect(d, [0, y + 2, BASE_W - 1, BASE_H - 1], shade(C["floor"], -12))


def _desk_for(near: bool):
    if near:
        w, top, front, xoff = 304, NEAR_TOP, NEAR_FRONT, 8
        drawers = (22, w - 28)
    else:
        w, top, front, xoff = 288, FAR_TOP, FAR_FRONT, 16
        drawers = (14, 78, 148, 218, w - 24)
    return desk_sprite(w, top, front, drawers), xoff, top, front


def _opaque_top(im: Image.Image) -> int:
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 80:
                return y
    return 0


def _furn_desk(near: bool):
    desk, xoff, top, front = _desk_for(near)
    return zoom(desk, ART), xoff * ART, top * ART, front * ART


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


def row(room, desk_y, chair_y, who, facing):
    north = facing == "north"
    chair = _furn_chair(north)
    desk, xoff, top, front = _furn_desk(near=not north)
    desk_end = desk_y + top + front
    if north:
        blit(room, desk, xoff, desk_y)
    for i, cx in enumerate(SEATS_X):
        chx = cx - chair.size[0] // 2
        if not who[i]:
            ey = chair_y - (EMPTY_SOUTH_LIFT if not north else 0)
            blit(room, chair, chx, ey)
            continue
        if north:
            _seat_back(room, who[i], cx, chair, chx, chair_y, desk_end)
        else:
            _seat_front(room, who[i], cx, chair, chx, chair_y, desk_y)
    if not north:
        blit(room, desk, xoff, desk_y)


def paint_base(view: str) -> Image.Image:
    """Accepted 320 furniture only — people are composited after the 4× zoom."""
    room = new(BASE_W, BASE_H, C["floor"])
    d = ImageDraw.Draw(room)
    if view == "v1":
        floor(d, B_WALL_H)
        wall(d)
    else:
        floor(d, 0)
        room_edge(d, BASE_H - B_ROOM_EDGE)
    return room


def paint(view: str, people: bool = True) -> Image.Image:
    room = zoom(paint_base(view), ART)
    if view == "v1":
        north = HUTONG_NORTH if people else (None,) * 4
        south = HUTONG_SOUTH if people else (None,) * 4
        row(room, FAR_DESK_Y, FAR_CHAIR_Y, north, "north")
        row(room, BOT_DESK_Y, BOT_CHAIR_Y, south, "south")
    else:
        south = tuple(reversed(HUTONG_SOUTH)) if people else (None,) * 4
        north = tuple(reversed(HUTONG_NORTH)) if people else (None,) * 4
        row(room, V2_DESK_Y, V2_CHAIR_Y, south, "north")
        row(room, BOT_DESK_Y, BOT_CHAIR_Y, north, "south")
    return room


def layout_check():
    ch = _furn_chair(True)
    aisle = BOT_CHAIR_Y - (FAR_CHAIR_Y + ch.size[1])
    stand = 272
    print(f"  hutong HD {HUT_W}×{HUT_H} chair {ch.size} aisle {aisle}px (need ≥ {stand})")
    if aisle < stand:
        raise SystemExit(f"aisle {aisle} < standing {stand}")


def crops(v1):
    art = ARTIFACT
    art.mkdir(parents=True, exist_ok=True)
    top = SEATS_X[2]
    bot = SEATS_X[1]
    top_box = (top - 28 * ART, FAR_CHAIR_Y - 44 * ART, top + 28 * ART, FAR_CHAIR_Y + 36 * ART)
    bot_box = (bot - 30 * ART, BOT_DESK_Y - 48 * ART, bot + 30 * ART, BOT_DESK_Y + 24 * ART)
    for dest in (art, PREVIEW):
        dest.mkdir(parents=True, exist_ok=True)
        save(v1.crop(top_box), dest / "hutong_hd_seat_top_x2.png")
        save(v1.crop(bot_box), dest / "hutong_hd_seat_bot_x2.png")


def write_scenes(v1, v2, empty):
    for spec, img in (
        ("hutong", v1),
        ("hutong_reverse", v2),
    ):
        save(img, ASSETS / "scenes" / spec / f"scene_{spec}.png")
        save(img, ASSETS / "rooms" / f"room_{spec}.png")
        save(img.resize((img.size[0] // 2, img.size[1] // 2), Image.Resampling.NEAREST),
             ASSETS / "rooms" / "thumbs" / f"room_{spec}.png")
        save(zoom(img, VIEW_ZOOM), PREVIEW / "zoomed" / f"{spec}.png")
    for dest in (PREVIEW, ARTIFACT):
        dest.mkdir(parents=True, exist_ok=True)
        save(v1, dest / "hutong_view1_hd.png")
        save(v2, dest / "hutong_view2_hd.png")
        save(empty, dest / "hutong_empty_hd.png")
        save(v1, dest / "hutong_view1_hd_v4.png")
        save(v2, dest / "hutong_view2_hd_v4.png")
    crops(v1)


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


def main():
    print("Generating HD hutong…")
    layout_check()
    v1 = paint("v1", True)
    v2 = paint("v2", True)
    empty = paint("v1", False)
    write_scenes(v1, v2, empty)
    patch_manifest()
    print("Done hutong HD.")


if __name__ == "__main__":
    main()
