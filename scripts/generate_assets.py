#!/usr/bin/env python3
"""Generate Phase-1 pixel assets for 赛博胡同 (Cyber Hutong).
Nearest-neighbor friendly, limited palette, 2.5D oblique top-down.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"

# cyber-hutong-16
P = {
    "bg": (11, 14, 26, 255),
    "floor": (26, 39, 68, 255),
    "floor2": (46, 58, 92, 255),
    "brick": (139, 90, 60, 255),
    "brick_hi": (196, 120, 74, 255),
    "lantern": (232, 195, 106, 255),
    "neon_p": (255, 107, 157, 255),
    "neon_p2": (255, 61, 127, 255),
    "holo": (61, 255, 240, 255),
    "screen": (0, 194, 184, 255),
    "purple": (123, 97, 255, 255),
    "white": (245, 240, 230, 255),
    "metal": (168, 176, 192, 255),
    "dark": (74, 85, 104, 255),
    "green": (45, 106, 79, 255),
    "green_d": (27, 67, 50, 255),
    "shadow": (8, 10, 18, 255),
    "wood": (210, 180, 140, 255),
    "wood_d": (160, 120, 80, 255),
    "blind": (120, 128, 140, 255),
    "blind_d": (90, 96, 108, 255),
    "blue_folder": (70, 130, 220, 255),
    "skin": (232, 190, 160, 255),
    "hair": (40, 36, 50, 255),
    "jacket": (220, 215, 200, 255),
    "black": (20, 22, 28, 255),
    "trans": (0, 0, 0, 0),
}


def new(w: int, h: int, fill=None) -> Image.Image:
    img = Image.new("RGBA", (w, h), fill or P["trans"])
    return img


def px(draw: ImageDraw.ImageDraw, xy, c):
    if isinstance(xy[0], (list, tuple)):
        for p in xy:
            draw.point(p, fill=c)
    else:
        draw.point(xy, fill=c)


def rect(draw, box, c):
    draw.rectangle(box, fill=c)


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print(f"  wrote {path.relative_to(ROOT)}")


# ---------- character idle (32x32, 4 frames) ----------
def draw_hero(frame: int) -> Image.Image:
    img = new(32, 32)
    d = ImageDraw.Draw(img)
    # foot shadow
    bob = (0, 0, 1, 0)[frame]
    sway = (0, 1, 0, -1)[frame]
    ox, oy = 16 + sway, 22 + bob

    # shadow ellipse-ish
    for dx in range(-5, 6):
        for dy in range(-2, 3):
            if abs(dx) / 5 + abs(dy) / 2.5 < 1:
                d.point((ox + dx, oy + 6 + dy), fill=P["shadow"])

    # legs
    rect(d, [ox - 3, oy + 1, ox - 1, oy + 5], P["dark"])
    rect(d, [ox + 1, oy + 1, ox + 3, oy + 5], P["dark"])
    # boots
    rect(d, [ox - 4, oy + 5, ox - 1, oy + 6], P["neon_p2"])
    rect(d, [ox + 1, oy + 5, ox + 4, oy + 6], P["neon_p2"])

    # body (hoodie + cyber vest)
    rect(d, [ox - 5, oy - 8, ox + 5, oy + 1], P["purple"])
    rect(d, [ox - 4, oy - 7, ox + 4, oy - 1], P["floor2"])
    # neon trim
    rect(d, [ox - 5, oy - 3, ox + 5, oy - 2], P["holo"])

    # arms
    arm_y = oy - 6 + (1 if frame % 2 else 0)
    rect(d, [ox - 7, arm_y, ox - 5, arm_y + 5], P["purple"])
    rect(d, [ox + 5, arm_y, ox + 7, arm_y + 5], P["purple"])
    # hands
    d.point((ox - 6, arm_y + 5), fill=P["skin"])
    d.point((ox + 6, arm_y + 5), fill=P["skin"])

    # head
    hy = oy - 14 + bob
    rect(d, [ox - 4, hy, ox + 4, hy + 6], P["skin"])
    # hair (messy top + bangs)
    rect(d, [ox - 4, hy - 2, ox + 4, hy + 1], P["hair"])
    rect(d, [ox - 5, hy, ox - 4, hy + 3], P["hair"])
    rect(d, [ox + 4, hy, ox + 5, hy + 3], P["hair"])
    # eyes
    d.point((ox - 2, hy + 3), fill=P["holo"])
    d.point((ox + 2, hy + 3), fill=P["holo"])
    # cheek neon
    d.point((ox - 3, hy + 5), fill=P["neon_p"])
    # antenna / earpiece
    rect(d, [ox + 4, hy - 1, ox + 5, hy + 1], P["metal"])
    d.point((ox + 5, hy - 2), fill=P["neon_p2"])

    return img


def gen_characters():
    for i in range(4):
        save(draw_hero(i), ASSETS / "characters" / f"hero_idle_{i}.png")


# ---------- tileset strip ----------
def tile_floor() -> Image.Image:
    t = new(32, 32, P["floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 8):
        for x in range(0, 32, 8):
            c = P["floor2"] if (x // 8 + y // 8) % 2 == 0 else P["floor"]
            rect(d, [x, y, x + 7, y + 7], c)
            d.point((x + 1, y + 1), fill=P["dark"])
    # subtle neon grit
    d.point((10, 12), fill=P["screen"])
    d.point((22, 20), fill=P["purple"])
    return t


def tile_brick_wall() -> Image.Image:
    t = new(32, 32, P["brick"])
    d = ImageDraw.Draw(t)
    # top face (lighter) for 2.5D
    rect(d, [0, 0, 31, 7], P["brick_hi"])
    for y in range(8, 32, 6):
        offset = 4 if (y // 6) % 2 else 0
        for x in range(-4, 36, 10):
            rect(d, [x + offset, y, x + offset + 8, y + 4], P["brick"])
            rect(d, [x + offset, y, x + offset + 8, y], P["brick_hi"])
    # neon graffiti line
    rect(d, [4, 18, 28, 19], P["neon_p"])
    return t


def tile_neon_floor() -> Image.Image:
    t = new(32, 32, P["bg"])
    d = ImageDraw.Draw(t)
    rect(d, [1, 1, 30, 30], P["floor"])
    # cyan grid
    for i in range(0, 32, 8):
        for j in range(32):
            d.point((i, j), fill=P["screen"])
            d.point((j, i), fill=P["screen"])
    rect(d, [14, 14, 17, 17], P["holo"])
    return t


def tile_hutong_roof() -> Image.Image:
    t = new(32, 32, P["dark"])
    d = ImageDraw.Draw(t)
    # wavy tile rows (oblique)
    for y in range(0, 32, 4):
        c = P["metal"] if (y // 4) % 2 == 0 else P["dark"]
        rect(d, [0, y, 31, y + 2], c)
        for x in range(0, 32, 4):
            d.point((x + (y % 8) // 2, y + 1), fill=P["white"])
    return t


def tile_grass() -> Image.Image:
    t = new(32, 32, P["green_d"])
    d = ImageDraw.Draw(t)
    for x, y in [(3, 5), (8, 12), (14, 4), (20, 18), (25, 8), (10, 22), (28, 26)]:
        d.point((x, y), fill=P["green"])
        d.point((x, y - 1), fill=P["green"])
    return t


def tile_door() -> Image.Image:
    t = new(32, 32, P["wood_d"])
    d = ImageDraw.Draw(t)
    rect(d, [4, 2, 27, 31], P["wood"])
    rect(d, [6, 4, 25, 29], P["wood_d"])
    # panels
    rect(d, [8, 6, 14, 16], P["wood"])
    rect(d, [17, 6, 23, 16], P["wood"])
    rect(d, [8, 18, 14, 28], P["wood"])
    rect(d, [17, 18, 23, 28], P["wood"])
    # cyber lock
    rect(d, [22, 14, 25, 18], P["holo"])
    d.point((24, 16), fill=P["neon_p2"])
    return t


def tile_blind() -> Image.Image:
    """Roller blind window wall for Hawaii scene."""
    t = new(32, 32, P["blind"])
    d = ImageDraw.Draw(t)
    # horizontal slats
    for y in range(0, 32, 3):
        rect(d, [0, y, 31, y + 1], P["blind_d"])
        rect(d, [0, y + 2, 31, y + 2], P["metal"])
    # frame
    rect(d, [0, 0, 31, 1], P["white"])
    rect(d, [0, 0, 1, 31], P["white"])
    rect(d, [30, 0, 31, 31], P["white"])
    # pull cord
    for y in range(4, 28):
        d.point((28, y), fill=P["white"])
    d.point((28, 28), fill=P["lantern"])
    return t


def gen_tileset():
    tiles = [
        tile_floor(),
        tile_brick_wall(),
        tile_neon_floor(),
        tile_hutong_roof(),
        tile_grass(),
        tile_door(),
        tile_blind(),
    ]
    labels = ["floor", "brick", "neon", "roof", "grass", "door", "blind"]
    strip = new(32 * len(tiles), 32)
    for i, t in enumerate(tiles):
        strip.paste(t, (i * 32, 0), t)
        save(t, ASSETS / "tiles" / f"tile_{labels[i]}.png")
    save(strip, ASSETS / "tiles" / "tileset_32.png")


# ---------- props ----------
def prop_desk() -> Image.Image:
    img = new(32, 32)
    d = ImageDraw.Draw(img)
    # top (oblique)
    rect(d, [2, 10, 29, 18], P["wood"])
    rect(d, [2, 10, 29, 12], P["wood_d"])
    # legs
    rect(d, [4, 18, 6, 28], P["metal"])
    rect(d, [25, 18, 27, 28], P["metal"])
    # monitor glow
    rect(d, [10, 4, 22, 11], P["dark"])
    rect(d, [11, 5, 21, 10], P["screen"])
    d.point((16, 7), fill=P["holo"])
    return img


def prop_chair() -> Image.Image:
    img = new(32, 32)
    d = ImageDraw.Draw(img)
    # seat
    rect(d, [8, 16, 23, 22], P["black"])
    rect(d, [9, 16, 22, 18], P["dark"])
    # back mesh
    rect(d, [10, 4, 21, 16], P["dark"])
    for y in range(5, 15, 2):
        for x in range(11, 21, 2):
            d.point((x, y), fill=P["metal"])
    # arms
    rect(d, [6, 12, 8, 18], P["metal"])
    rect(d, [23, 12, 25, 18], P["metal"])
    # base
    rect(d, [14, 22, 17, 28], P["metal"])
    rect(d, [10, 27, 21, 29], P["dark"])
    return img


def prop_chair_jacket() -> Image.Image:
    img = prop_chair()
    d = ImageDraw.Draw(img)
    # draped jacket
    rect(d, [9, 6, 22, 14], P["jacket"])
    rect(d, [10, 8, 14, 18], P["jacket"])
    rect(d, [18, 9, 21, 17], P["dark"])
    return img


def prop_neon_sign() -> Image.Image:
    img = new(32, 32)
    d = ImageDraw.Draw(img)
    rect(d, [2, 8, 29, 24], P["bg"])
    rect(d, [3, 9, 28, 23], P["floor"])
    # 胡 characters simplified as neon bars
    rect(d, [6, 12, 10, 20], P["neon_p"])
    rect(d, [12, 12, 16, 20], P["holo"])
    rect(d, [18, 12, 26, 14], P["neon_p2"])
    rect(d, [18, 16, 26, 18], P["purple"])
    # glow pixels
    d.point((4, 10), fill=P["neon_p"])
    d.point((27, 22), fill=P["holo"])
    return img


def prop_lantern() -> Image.Image:
    img = new(16, 24)
    d = ImageDraw.Draw(img)
    # string
    rect(d, [7, 0, 8, 3], P["metal"])
    # body
    rect(d, [3, 4, 12, 18], P["neon_p2"])
    rect(d, [4, 5, 11, 17], P["lantern"])
    rect(d, [5, 7, 10, 10], P["white"])
    # top/bottom caps
    rect(d, [4, 3, 11, 4], P["dark"])
    rect(d, [4, 18, 11, 19], P["dark"])
    # tassels
    d.point((5, 20), fill=P["neon_p"])
    d.point((8, 21), fill=P["neon_p"])
    d.point((10, 20), fill=P["neon_p"])
    return img


def prop_plant() -> Image.Image:
    img = new(16, 20)
    d = ImageDraw.Draw(img)
    # pot
    rect(d, [4, 12, 11, 19], P["white"])
    rect(d, [5, 13, 10, 18], P["metal"])
    # leaves
    for pts, c in [
        ([(8, 2), (7, 3), (8, 4), (9, 3)], P["green"]),
        ([(5, 5), (4, 6), (5, 8), (6, 6)], P["green"]),
        ([(10, 4), (11, 5), (12, 7), (10, 6)], P["green"]),
        ([(7, 6), (6, 8), (7, 10), (8, 8)], P["green_d"]),
        ([(9, 7), (10, 9), (9, 11), (8, 9)], P["green"]),
    ]:
        for p in pts:
            d.point(p, fill=c)
    return img


def prop_server_rack() -> Image.Image:
    img = new(24, 32)
    d = ImageDraw.Draw(img)
    rect(d, [2, 2, 21, 31], P["dark"])
    rect(d, [3, 3, 20, 30], P["black"])
    for y in range(5, 28, 5):
        rect(d, [5, y, 18, y + 3], P["floor2"])
        d.point((7, y + 1), fill=P["holo"])
        d.point((10, y + 1), fill=P["neon_p"])
        d.point((13, y + 1), fill=P["screen"])
        d.point((16, y + 1), fill=P["lantern"])
    return img


def prop_hologram() -> Image.Image:
    img = new(24, 28)
    d = ImageDraw.Draw(img)
    # pedestal
    rect(d, [8, 22, 15, 27], P["metal"])
    rect(d, [6, 20, 17, 22], P["dark"])
    # holo figure / diamond
    pts = [(12, 2), (18, 10), (12, 18), (6, 10)]
    for x, y in [(12, 4), (10, 8), (14, 8), (12, 12), (8, 10), (16, 10), (12, 16)]:
        d.point((x, y), fill=P["holo"])
    for x in range(7, 18):
        for y in range(3, 18):
            if abs(x - 12) + abs(y - 10) < 8 and (x + y) % 2 == 0:
                d.point((x, y), fill=P["screen"])
    # scanline
    rect(d, [8, 10, 16, 10], P["white"])
    return img


def prop_laptop() -> Image.Image:
    img = new(16, 16)
    d = ImageDraw.Draw(img)
    # base
    rect(d, [2, 10, 13, 14], P["metal"])
    rect(d, [3, 11, 12, 13], P["dark"])
    # screen
    rect(d, [3, 2, 12, 10], P["dark"])
    rect(d, [4, 3, 11, 9], P["screen"])
    d.point((7, 5), fill=P["holo"])
    d.point((8, 6), fill=P["white"])
    return img


def prop_thermos() -> Image.Image:
    img = new(8, 16)
    d = ImageDraw.Draw(img)
    rect(d, [2, 2, 5, 14], P["black"])
    rect(d, [2, 2, 5, 4], P["metal"])
    rect(d, [3, 6, 4, 10], P["dark"])
    d.point((3, 1), fill=P["metal"])
    return img


def prop_folders() -> Image.Image:
    img = new(16, 12)
    d = ImageDraw.Draw(img)
    rect(d, [1, 4, 14, 11], P["blue_folder"])
    rect(d, [2, 2, 13, 9], P["white"])
    rect(d, [3, 3, 12, 8], P["blue_folder"])
    rect(d, [4, 1, 11, 3], P["metal"])
    return img


def prop_long_desk_segment() -> Image.Image:
    """One 32px segment of window-side long desk."""
    img = new(32, 24)
    d = ImageDraw.Draw(img)
    # top surface
    rect(d, [0, 4, 31, 14], P["wood"])
    rect(d, [0, 4, 31, 6], P["wood_d"])
    # front edge
    rect(d, [0, 14, 31, 16], P["wood_d"])
    # legs
    rect(d, [2, 16, 4, 23], P["metal"])
    rect(d, [27, 16, 29, 23], P["metal"])
    return img


def gen_props():
    mapping = {
        "desk.png": prop_desk(),
        "chair.png": prop_chair(),
        "chair_jacket.png": prop_chair_jacket(),
        "neon_sign.png": prop_neon_sign(),
        "lantern.png": prop_lantern(),
        "plant.png": prop_plant(),
        "server_rack.png": prop_server_rack(),
        "hologram.png": prop_hologram(),
        "laptop.png": prop_laptop(),
        "thermos.png": prop_thermos(),
        "folders.png": prop_folders(),
        "long_desk.png": prop_long_desk_segment(),
    }
    for name, img in mapping.items():
        save(img, ASSETS / "props" / name)


# ---------- room composites ----------
def blit(dst: Image.Image, src: Image.Image, x: int, y: int):
    dst.paste(src, (x, y), src)


def fill_floor(room: Image.Image, tile: Image.Image):
    for y in range(0, room.height, 32):
        for x in range(0, room.width, 32):
            blit(room, tile, x, y)


def room_office() -> Image.Image:
    W, H = 320, 240
    room = new(W, H, P["bg"])
    floor = tile_floor()
    fill_floor(room, floor)
    # back wall
    brick = tile_brick_wall()
    for x in range(0, W, 32):
        blit(room, brick, x, 0)
        blit(room, brick, x, 16)
    # desks row
    desk = prop_desk()
    chair = prop_chair()
    plant = prop_plant()
    neon = prop_neon_sign()
    for i, x in enumerate([40, 120, 200]):
        blit(room, desk, x, 80)
        blit(room, chair, x + 4, 108)
        if i == 1:
            blit(room, prop_laptop(), x + 8, 78)
    blit(room, plant, 280, 100)
    blit(room, neon, 140, 36)
    blit(room, prop_server_rack(), 16, 70)
    # hero
    blit(room, draw_hero(0), 160, 160)
    return room


def room_meeting() -> Image.Image:
    W, H = 320, 240
    room = new(W, H, P["bg"])
    fill_floor(room, tile_neon_floor())
    brick = tile_brick_wall()
    for x in range(0, W, 32):
        blit(room, brick, x, 0)
    # big table (compose from wood rects)
    d = ImageDraw.Draw(room)
    rect(d, [80, 90, 240, 150], P["wood_d"])
    rect(d, [84, 94, 236, 146], P["wood"])
    # hologram center
    blit(room, prop_hologram(), 148, 100)
    # chairs around
    ch = prop_chair()
    for pos in [(100, 70), (160, 70), (220, 70), (90, 150), (160, 155), (230, 150)]:
        blit(room, ch, pos[0], pos[1])
    blit(room, prop_neon_sign(), 120, 28)
    blit(room, draw_hero(1), 60, 180)
    return room


def room_hutong_gate() -> Image.Image:
    W, H = 320, 240
    room = new(W, H, P["bg"])
    fill_floor(room, tile_floor())
    # side walls
    brick = tile_brick_wall()
    for y in range(0, 160, 32):
        blit(room, brick, 0, y)
        blit(room, brick, 288, y)
    # gate / paifang
    roof = tile_hutong_roof()
    for x in range(64, 256, 32):
        blit(room, roof, x, 16)
        blit(room, roof, x, 0)
    door = tile_door()
    blit(room, door, 144, 48)
    # neon gate glow
    d = ImageDraw.Draw(room)
    rect(d, [100, 70, 220, 72], P["neon_p"])
    rect(d, [110, 40, 210, 42], P["holo"])
    # lanterns
    lan = prop_lantern()
    blit(room, lan, 100, 48)
    blit(room, lan, 204, 48)
    blit(room, prop_neon_sign(), 72, 100)
    blit(room, prop_plant(), 48, 160)
    blit(room, prop_plant(), 260, 160)
    blit(room, draw_hero(2), 152, 140)
    # scanline barrier
    for x in range(120, 200, 4):
        d.point((x, 100), fill=P["holo"])
        d.point((x + 1, 102), fill=P["screen"])
    return room


def gen_rooms():
    save(room_office(), ASSETS / "rooms" / "room_office.png")
    save(room_meeting(), ASSETS / "rooms" / "room_meeting.png")
    save(room_hutong_gate(), ASSETS / "rooms" / "room_hutong_gate.png")


# ---------- dialog UI ----------
def gen_dialog():
    img = new(256, 64)
    d = ImageDraw.Draw(img)
    # outer neon
    rect(d, [0, 0, 255, 63], P["neon_p"])
    rect(d, [2, 2, 253, 61], P["purple"])
    rect(d, [4, 4, 251, 59], P["bg"])
    # inner panel
    rect(d, [8, 8, 247, 55], P["floor"])
    rect(d, [10, 10, 245, 53], P["bg"])
    # corner ornaments
    for cx, cy in [(6, 6), (249, 6), (6, 57), (249, 57)]:
        rect(d, [cx - 2, cy - 2, cx + 2, cy + 2], P["holo"])
    # speaker nameplate
    rect(d, [12, 4, 80, 14], P["dark"])
    rect(d, [14, 6, 78, 12], P["neon_p2"])
    # fake text dots (placeholder)
    for row, y in enumerate([20, 28, 36, 44]):
        for x in range(16, 200 - row * 10, 4):
            d.point((x, y), fill=P["metal"] if (x // 4) % 3 else P["white"])
    # continue chevron
    d.point((240, 48), fill=P["lantern"])
    d.point((238, 46), fill=P["lantern"])
    d.point((242, 46), fill=P["lantern"])
    save(img, ASSETS / "ui" / "dialog_frame.png")


# ---------- Hawaii scene ----------
def gen_hawaii():
    out = ASSETS / "scenes" / "hawaii"
    blind = tile_blind()
    save(blind, out / "blind_tile.png")
    save(prop_long_desk_segment(), out / "long_desk.png")
    save(prop_chair(), out / "chair.png")
    save(prop_chair_jacket(), out / "chair_jacket.png")
    save(prop_laptop(), out / "laptop.png")
    save(prop_thermos(), out / "thermos.png")
    save(prop_plant(), out / "plant.png")
    save(prop_folders(), out / "folders.png")

    # Window top + 靠窗长桌; three seats in a vertical line toward the window
    W, H = 320, 288
    scene = new(W, H, P["bg"])
    fill_floor(scene, tile_floor())
    for x in range(0, W, 32):
        blit(scene, blind, x, 0)
        blit(scene, blind, x, 20)

    d = ImageDraw.Draw(scene)
    rect(d, [0, 50, 319, 55], P["white"])
    rect(d, [0, 55, 319, 57], P["metal"])

    # Horizontal ledge under window
    rect(d, [32, 58, 288, 78], P["wood_d"])
    rect(d, [34, 60, 286, 76], P["wood"])
    rect(d, [34, 60, 286, 63], P["wood_d"])

    # Vertical desk run — seats line up along it (toward window)
    dx = 120
    rect(d, [dx, 70, dx + 56, 260], P["wood_d"])
    rect(d, [dx + 2, 72, dx + 54, 258], P["wood"])
    rect(d, [dx, 70, dx + 8, 260], P["wood_d"])
    for ly in (100, 170, 240):
        rect(d, [dx + 10, ly, dx + 12, ly + 10], P["metal"])
        rect(d, [dx + 44, ly, dx + 46, ly + 10], P["metal"])

    chairs = [
        (dx + 60, 78, prop_chair()),
        (dx + 60, 148, prop_chair_jacket()),
        (dx + 60, 218, prop_chair()),
    ]
    for x, y, spr in chairs:
        blit(scene, spr, x, y)

    blit(scene, prop_laptop(), dx + 14, 86)
    blit(scene, prop_thermos(), dx + 36, 156)
    blit(scene, prop_folders(), dx + 12, 228)
    blit(scene, prop_plant(), 250, 58)
    blit(scene, prop_plant(), dx + 38, 72)
    blit(scene, prop_neon_sign(), 16, 120)
    blit(scene, draw_hero(1), 250, 170)
    for y in range(80, 280, 4):
        d.point((290, y), fill=P["screen"])

    save(scene, out / "scene_hawaii.png")


def main():
    print("Generating cyber-hutong Phase-1 assets…")
    gen_characters()
    gen_tileset()
    gen_props()
    gen_rooms()
    gen_dialog()
    gen_hawaii()
    print("Done.")


if __name__ == "__main__":
    main()
