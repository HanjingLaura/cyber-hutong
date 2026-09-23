#!/usr/bin/env python3
"""Generate Phase-1 pixel assets for 赛博胡同 (Cyber Hutong).

Soul Knight / 元气骑士 style: chunky pixels, strong silhouettes,
rich lighting accents, oblique top-down 2.5D, game-ready readability.

Each named scene is a DISTINCT world (floor / wall / palette / light)
— never the same dark-blue grid with swapped props.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"

# ---------------------------------------------------------------------------
# Shared + per-scene palettes (opaque RGBA; nearest-neighbor friendly)
# ---------------------------------------------------------------------------
P = {
    # shared / hero / UI
    "bg": (11, 14, 26, 255),
    "white": (245, 240, 230, 255),
    "metal": (168, 176, 192, 255),
    "dark": (74, 85, 104, 255),
    "black": (20, 22, 28, 255),
    "shadow": (8, 10, 18, 180),
    "skin": (232, 190, 160, 255),
    "hair": (40, 36, 50, 255),
    "purple": (123, 97, 255, 255),
    "holo": (61, 255, 240, 255),
    "screen": (0, 194, 184, 255),
    "neon_p": (255, 107, 157, 255),
    "neon_p2": (255, 61, 127, 255),
    "lantern": (232, 195, 106, 255),
    "green": (45, 106, 79, 255),
    "green_d": (27, 67, 50, 255),
    "jacket": (220, 215, 200, 255),
    "trans": (0, 0, 0, 0),
    # legacy / hutong shared
    "floor": (26, 39, 68, 255),
    "floor2": (46, 58, 92, 255),
    "brick": (139, 90, 60, 255),
    "brick_hi": (196, 120, 74, 255),
    "wood": (210, 180, 140, 255),
    "wood_d": (160, 120, 80, 255),
    "blind": (120, 128, 140, 255),
    "blind_d": (90, 96, 108, 255),
    "blue_folder": (70, 130, 220, 255),
    # --- HAWAII: warm daylight office ---
    "hw_floor": (196, 158, 110, 255),
    "hw_floor2": (168, 128, 82, 255),
    "hw_plank": (214, 178, 128, 255),
    "hw_gap": (120, 86, 52, 255),
    "hw_wall": (232, 214, 186, 255),
    "hw_wall_d": (198, 172, 140, 255),
    "hw_trim": (140, 108, 72, 255),
    "hw_sun": (255, 236, 180, 255),
    "hw_sun2": (255, 210, 120, 255),
    "hw_blind": (210, 200, 185, 255),
    "hw_blind_d": (150, 142, 128, 255),
    "hw_blind_hi": (240, 232, 215, 255),
    "hw_desk": (186, 140, 88, 255),
    "hw_desk_hi": (220, 178, 120, 255),
    "hw_desk_edge": (130, 92, 52, 255),
    "hw_chair": (70, 78, 92, 255),
    "hw_chair_hi": (110, 120, 138, 255),
    # --- POPMART: candy / neon retail ---
    "pm_floor": (255, 228, 240, 255),
    "pm_floor2": (255, 200, 220, 255),
    "pm_tile_a": (255, 214, 230, 255),
    "pm_tile_b": (200, 245, 235, 255),
    "pm_grout": (255, 160, 190, 255),
    "pm_wall": (120, 70, 160, 255),
    "pm_wall_hi": (170, 110, 220, 255),
    "pm_panel": (255, 120, 170, 255),
    "pm_panel2": (90, 230, 210, 255),
    "pm_shelf": (255, 245, 250, 255),
    "pm_neon": (255, 80, 160, 255),
    "pm_neon2": (80, 255, 220, 255),
    "pm_counter": (255, 190, 210, 255),
    "pm_counter_d": (220, 100, 150, 255),
    "pm_glass": (200, 255, 250, 255),
    "box_pink": (255, 140, 180, 255),
    "box_mint": (100, 230, 200, 255),
    "box_yellow": (255, 220, 90, 255),
    "box_lilac": (190, 150, 255, 255),
    "box_sky": (120, 200, 255, 255),
    "box_orange": (255, 160, 80, 255),
    # --- RESTROOM: pastel game-toilet (NOT muddy public-toilet grey) ---
    "rr_floor": (210, 235, 230, 255),
    "rr_floor2": (180, 215, 208, 255),
    "rr_grout": (160, 200, 195, 255),
    "rr_wet": (190, 230, 240, 255),
    "rr_wet2": (160, 210, 220, 255),
    "rr_wall": (230, 245, 240, 255),
    "rr_wall_d": (170, 205, 198, 255),
    "rr_tile_hi": (250, 255, 252, 255),
    "rr_stall": (180, 220, 210, 255),
    "rr_stall_d": (120, 175, 165, 255),
    "rr_metal": (150, 175, 185, 255),
    "rr_porcelain": (250, 252, 255, 255),
    "rr_fluoro": (255, 250, 230, 255),
    "rr_fluoro2": (200, 240, 230, 255),
    "rr_caution": (255, 170, 190, 255),
    # supporting rooms
    "of_floor": (32, 48, 72, 255),
    "of_floor2": (48, 68, 98, 255),
    "of_carpet": (55, 45, 85, 255),
    "mt_floor": (18, 16, 40, 255),
    "mt_floor2": (40, 30, 70, 255),
    "mt_glow": (90, 60, 180, 255),
    "hg_stone": (90, 85, 78, 255),
    "hg_stone2": (70, 66, 60, 255),
    "hg_dirt": (55, 50, 45, 255),
    # aliases used by older props
    "tile_white": (220, 224, 232, 255),
    "tile_grout": (160, 168, 180, 255),
    "porcelain": (230, 235, 242, 255),
    "sink_steel": (140, 150, 168, 255),
    "stall_beige": (180, 170, 150, 255),
}


def new(w: int, h: int, fill=None) -> Image.Image:
    return Image.new("RGBA", (w, h), fill or P["trans"])


def rect(draw, box, c):
    draw.rectangle(box, fill=c)


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print(f"  wrote {path.relative_to(ROOT)}")


def blit(dst: Image.Image, src: Image.Image, x: int, y: int):
    dst.paste(src, (x, y), src)


def fill_floor(room: Image.Image, tile: Image.Image):
    for y in range(0, room.height, tile.height):
        for x in range(0, room.width, tile.width):
            blit(room, tile, x, y)


def outline_rect(d, box, fill, edge, thick=1):
    """Filled rect with chunky silhouette edge (Soul Knight readability)."""
    x0, y0, x1, y1 = box
    rect(d, [x0, y0, x1, y1], edge)
    rect(d, [x0 + thick, y0 + thick, x1 - thick, y1 - thick], fill)


def soft_glow(d, cx, cy, r, color, step=2):
    """Sparse radial accent (no alpha blend — hard pixels)."""
    r2 = r * r
    for dy in range(-r, r + 1, step):
        for dx in range(-r, r + 1, step):
            if dx * dx + dy * dy <= r2 and (dx + dy) % (step * 2) == 0:
                d.point((cx + dx, cy + dy), fill=color)


# ---------- character idle (32x32, 4 frames) — chunkier silhouette ----------
def draw_hero(frame: int) -> Image.Image:
    img = new(32, 32)
    d = ImageDraw.Draw(img)
    bob = (0, 0, 1, 0)[frame]
    sway = (0, 1, 0, -1)[frame]
    ox, oy = 16 + sway, 22 + bob

    for dx in range(-6, 7):
        for dy in range(-2, 3):
            if abs(dx) / 6 + abs(dy) / 2.5 < 1:
                d.point((ox + dx, oy + 7 + dy), fill=P["shadow"])

    # legs + chunky boots
    rect(d, [ox - 4, oy + 1, ox - 1, oy + 6], P["dark"])
    rect(d, [ox + 1, oy + 1, ox + 4, oy + 6], P["dark"])
    outline_rect(d, [ox - 5, oy + 5, ox - 1, oy + 7], P["neon_p2"], P["black"])
    outline_rect(d, [ox + 1, oy + 5, ox + 5, oy + 7], P["neon_p2"], P["black"])

    # body
    outline_rect(d, [ox - 6, oy - 9, ox + 6, oy + 1], P["purple"], P["black"])
    rect(d, [ox - 4, oy - 7, ox + 4, oy - 1], P["floor2"])
    rect(d, [ox - 5, oy - 3, ox + 5, oy - 2], P["holo"])

    arm_y = oy - 6 + (1 if frame % 2 else 0)
    rect(d, [ox - 8, arm_y, ox - 5, arm_y + 6], P["purple"])
    rect(d, [ox + 5, arm_y, ox + 8, arm_y + 6], P["purple"])
    d.point((ox - 7, arm_y + 6), fill=P["skin"])
    d.point((ox + 7, arm_y + 6), fill=P["skin"])

    hy = oy - 15 + bob
    outline_rect(d, [ox - 5, hy, ox + 5, hy + 7], P["skin"], P["black"])
    rect(d, [ox - 5, hy - 2, ox + 5, hy + 2], P["hair"])
    rect(d, [ox - 6, hy, ox - 5, hy + 4], P["hair"])
    rect(d, [ox + 5, hy, ox + 6, hy + 4], P["hair"])
    d.point((ox - 2, hy + 3), fill=P["holo"])
    d.point((ox + 2, hy + 3), fill=P["holo"])
    d.point((ox - 3, hy + 5), fill=P["neon_p"])
    rect(d, [ox + 4, hy - 1, ox + 6, hy + 1], P["metal"])
    d.point((ox + 6, hy - 2), fill=P["neon_p2"])
    return img


def gen_characters():
    for i in range(4):
        save(draw_hero(i), ASSETS / "characters" / f"hero_idle_{i}.png")


# ---------- shared / supporting tiles ----------
def tile_floor() -> Image.Image:
    """工位 dark teal checker — NOT used by named scenes."""
    t = new(32, 32, P["of_floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 8):
        for x in range(0, 32, 8):
            c = P["of_floor2"] if (x // 8 + y // 8) % 2 == 0 else P["of_floor"]
            rect(d, [x, y, x + 7, y + 7], c)
    d.point((6, 6), fill=P["screen"])
    d.point((22, 18), fill=P["purple"])
    return t


def tile_brick_wall() -> Image.Image:
    t = new(32, 32, P["brick"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 31, 7], P["brick_hi"])
    for y in range(8, 32, 6):
        offset = 4 if (y // 6) % 2 else 0
        for x in range(-4, 36, 10):
            rect(d, [x + offset, y, x + offset + 8, y + 4], P["brick"])
            rect(d, [x + offset, y, x + offset + 8, y], P["brick_hi"])
    rect(d, [4, 18, 28, 19], P["neon_p"])
    return t


def tile_neon_floor() -> Image.Image:
    """Meeting-room purple-dark neon (supporting only)."""
    t = new(32, 32, P["mt_floor"])
    d = ImageDraw.Draw(t)
    rect(d, [1, 1, 30, 30], P["mt_floor2"])
    for i in range(0, 32, 8):
        for j in range(32):
            d.point((i, j), fill=P["mt_glow"])
            d.point((j, i), fill=P["mt_glow"])
    rect(d, [14, 14, 17, 17], P["holo"])
    return t


def tile_hutong_roof() -> Image.Image:
    t = new(32, 32, P["dark"])
    d = ImageDraw.Draw(t)
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
    outline_rect(d, [4, 2, 27, 31], P["wood"], P["black"])
    rect(d, [6, 4, 25, 29], P["wood_d"])
    rect(d, [8, 6, 14, 16], P["wood"])
    rect(d, [17, 6, 23, 16], P["wood"])
    rect(d, [8, 18, 14, 28], P["wood"])
    rect(d, [17, 18, 23, 28], P["wood"])
    rect(d, [22, 14, 25, 18], P["holo"])
    d.point((24, 16), fill=P["neon_p2"])
    return t


def tile_blind() -> Image.Image:
    """Warm daylight roller blind (Hawaii)."""
    t = new(32, 32, P["hw_blind"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 3):
        rect(d, [0, y, 31, y + 1], P["hw_blind_d"])
        rect(d, [0, y + 2, 31, y + 2], P["hw_blind_hi"])
    # sun bleed through slats
    for y in range(2, 30, 6):
        rect(d, [6, y, 24, y], P["hw_sun"])
    rect(d, [0, 0, 31, 1], P["hw_trim"])
    rect(d, [0, 0, 1, 31], P["hw_trim"])
    rect(d, [30, 0, 31, 31], P["hw_trim"])
    for y in range(4, 28):
        d.point((28, y), fill=P["white"])
    d.point((28, 28), fill=P["lantern"])
    return t


def tile_hawaii_floor() -> Image.Image:
    """Warm wood plank floor — office daylight."""
    t = new(32, 32, P["hw_floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 8):
        base = P["hw_plank"] if (y // 8) % 2 == 0 else P["hw_floor"]
        rect(d, [0, y, 31, y + 7], base)
        rect(d, [0, y + 7, 31, y + 7], P["hw_gap"])
        # plank seams
        for x in (8, 20):
            offset = 4 if (y // 8) % 2 else 0
            rect(d, [x + offset, y, x + offset, y + 6], P["hw_floor2"])
        # warm highlight grain
        d.point((4, y + 2), fill=P["hw_sun"])
        d.point((18, y + 4), fill=P["hw_desk_hi"])
    return t


def tile_hawaii_wall() -> Image.Image:
    """Cream plaster wall with warm trim."""
    t = new(32, 32, P["hw_wall"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 31, 4], P["hw_wall_d"])
    rect(d, [0, 28, 31, 31], P["hw_trim"])
    for x in range(4, 28, 6):
        d.point((x, 12), fill=P["hw_wall_d"])
    return t


def tile_popmart_floor() -> Image.Image:
    """Candy checker — pink / mint retail."""
    t = new(32, 32, P["pm_tile_a"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 16):
        for x in range(0, 32, 16):
            c = P["pm_tile_a"] if ((x // 16) + (y // 16)) % 2 == 0 else P["pm_tile_b"]
            rect(d, [x, y, x + 15, y + 15], c)
            rect(d, [x, y, x + 15, y], P["pm_grout"])
            rect(d, [x, y, x, y + 15], P["pm_grout"])
    # glossy sparkle
    d.point((5, 5), fill=P["white"])
    d.point((21, 21), fill=P["pm_neon2"])
    d.point((12, 26), fill=P["pm_neon"])
    return t


def tile_popmart_wall() -> Image.Image:
    """Purple/pink retail panel wall."""
    t = new(32, 32, P["pm_wall"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 31, 6], P["pm_wall_hi"])
    rect(d, [0, 7, 31, 8], P["pm_neon"])
    for y in range(10, 28, 8):
        rect(d, [2, y, 14, y + 5], P["pm_panel"])
        rect(d, [17, y, 29, y + 5], P["pm_panel2"])
        rect(d, [3, y + 1, 13, y + 2], P["white"])
        rect(d, [18, y + 1, 28, y + 2], P["white"])
    rect(d, [0, 30, 31, 31], P["pm_neon2"])
    return t


def tile_restroom_floor() -> Image.Image:
    """Cool porcelain with wet sheen."""
    t = new(32, 32, P["rr_floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 10):
        for x in range(0, 32, 10):
            c = P["rr_porcelain"] if ((x // 10) + (y // 10)) % 2 == 0 else P["rr_floor"]
            rect(d, [x, y, min(x + 9, 31), min(y + 9, 31)], c)
            rect(d, [x, y, min(x + 9, 31), y], P["rr_grout"])
            rect(d, [x, y, x, min(y + 9, 31)], P["rr_grout"])
    # cute sparkle hints (not grimy puddles)
    for pts in [(8, 10), (22, 20), (14, 24)]:
        d.point(pts, fill=P["rr_fluoro"])
    d.point((9, 10), fill=P["white"])
    d.point((23, 20), fill=P["rr_caution"])
    return t


def tile_restroom_wall() -> Image.Image:
    """Cool subway tile wall."""
    t = new(32, 32, P["rr_wall"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 6):
        offset = 0 if (y // 6) % 2 == 0 else 8
        for x in range(-8, 40, 16):
            rect(d, [x + offset, y, x + offset + 14, y + 4], P["rr_tile_hi"])
            rect(d, [x + offset, y, x + offset + 14, y], P["rr_grout"])
            rect(d, [x + offset, y, x + offset, y + 4], P["rr_grout"])
            rect(d, [x + offset + 1, y + 1, x + offset + 4, y + 1], P["white"])
    rect(d, [0, 0, 31, 2], P["rr_wall_d"])
    return t


def tile_hutong_stone() -> Image.Image:
    """Outdoor alley cobble for 胡同口."""
    t = new(32, 32, P["hg_stone"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 8):
        for x in range(0, 32, 8):
            c = P["hg_stone2"] if (x // 8 + y // 8) % 2 else P["hg_stone"]
            rect(d, [x + 1, y + 1, x + 6, y + 6], c)
            rect(d, [x, y, x + 7, y], P["hg_dirt"])
            rect(d, [x, y, x, y + 7], P["hg_dirt"])
    d.point((12, 14), fill=P["lantern"])
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
        tile_hawaii_floor(),
        tile_popmart_floor(),
        tile_restroom_floor(),
    ]
    labels = [
        "floor", "brick", "neon", "roof", "grass", "door", "blind",
        "hawaii_wood", "popmart_candy", "restroom_tile",
    ]
    strip = new(32 * len(tiles), 32)
    for i, t in enumerate(tiles):
        strip.paste(t, (i * 32, 0), t)
        save(t, ASSETS / "tiles" / f"tile_{labels[i]}.png")
    save(strip, ASSETS / "tiles" / "tileset_32.png")


# ---------- props ----------
def prop_desk() -> Image.Image:
    img = new(32, 32)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 10, 29, 18], P["wood"], P["black"])
    rect(d, [2, 10, 29, 12], P["wood_d"])
    rect(d, [4, 18, 6, 28], P["metal"])
    rect(d, [25, 18, 27, 28], P["metal"])
    outline_rect(d, [10, 4, 22, 11], P["screen"], P["black"])
    d.point((16, 7), fill=P["holo"])
    return img


def prop_chair() -> Image.Image:
    img = new(32, 32)
    d = ImageDraw.Draw(img)
    outline_rect(d, [8, 16, 23, 22], P["hw_chair"], P["black"])
    rect(d, [9, 16, 22, 18], P["hw_chair_hi"])
    outline_rect(d, [10, 4, 21, 16], P["hw_chair"], P["black"])
    for y in range(5, 15, 2):
        for x in range(11, 21, 2):
            d.point((x, y), fill=P["metal"])
    rect(d, [6, 12, 8, 18], P["metal"])
    rect(d, [23, 12, 25, 18], P["metal"])
    rect(d, [14, 22, 17, 28], P["metal"])
    rect(d, [10, 27, 21, 29], P["dark"])
    return img


def prop_chair_jacket() -> Image.Image:
    img = prop_chair()
    d = ImageDraw.Draw(img)
    rect(d, [9, 6, 22, 14], P["jacket"])
    rect(d, [10, 8, 14, 18], P["jacket"])
    rect(d, [18, 9, 21, 17], P["dark"])
    return img


def prop_neon_sign() -> Image.Image:
    img = new(32, 32)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 8, 29, 24], P["floor"], P["black"])
    rect(d, [6, 12, 10, 20], P["neon_p"])
    rect(d, [12, 12, 16, 20], P["holo"])
    rect(d, [18, 12, 26, 14], P["neon_p2"])
    rect(d, [18, 16, 26, 18], P["purple"])
    soft_glow(d, 16, 16, 10, P["neon_p"], step=3)
    return img


def prop_lantern() -> Image.Image:
    img = new(16, 24)
    d = ImageDraw.Draw(img)
    rect(d, [7, 0, 8, 3], P["metal"])
    outline_rect(d, [3, 4, 12, 18], P["lantern"], P["neon_p2"])
    rect(d, [5, 7, 10, 10], P["white"])
    rect(d, [4, 3, 11, 4], P["dark"])
    rect(d, [4, 18, 11, 19], P["dark"])
    d.point((5, 20), fill=P["neon_p"])
    d.point((8, 21), fill=P["neon_p"])
    d.point((10, 20), fill=P["neon_p"])
    return img


def prop_plant() -> Image.Image:
    img = new(16, 20)
    d = ImageDraw.Draw(img)
    outline_rect(d, [4, 12, 11, 19], P["white"], P["black"])
    rect(d, [5, 13, 10, 18], P["metal"])
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
    outline_rect(d, [2, 2, 21, 31], P["black"], P["dark"])
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
    rect(d, [8, 22, 15, 27], P["metal"])
    rect(d, [6, 20, 17, 22], P["dark"])
    for x in range(7, 18):
        for y in range(3, 18):
            if abs(x - 12) + abs(y - 10) < 8 and (x + y) % 2 == 0:
                d.point((x, y), fill=P["screen"])
    for x, y in [(12, 4), (10, 8), (14, 8), (12, 12), (8, 10), (16, 10), (12, 16)]:
        d.point((x, y), fill=P["holo"])
    rect(d, [8, 10, 16, 10], P["white"])
    return img


def prop_laptop() -> Image.Image:
    img = new(16, 16)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 10, 13, 14], P["metal"], P["black"])
    rect(d, [3, 11, 12, 13], P["dark"])
    outline_rect(d, [3, 2, 12, 10], P["screen"], P["black"])
    d.point((7, 5), fill=P["holo"])
    d.point((8, 6), fill=P["white"])
    # warm screen glow for hawaii
    d.point((5, 4), fill=P["hw_sun"])
    return img


def prop_thermos() -> Image.Image:
    img = new(8, 16)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 2, 5, 14], P["black"], P["metal"])
    rect(d, [2, 2, 5, 4], P["metal"])
    rect(d, [3, 6, 4, 10], P["dark"])
    d.point((3, 1), fill=P["metal"])
    return img


def prop_folders() -> Image.Image:
    img = new(16, 12)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 4, 14, 11], P["blue_folder"], P["black"])
    rect(d, [2, 2, 13, 9], P["white"])
    rect(d, [3, 3, 12, 8], P["blue_folder"])
    rect(d, [4, 1, 11, 3], P["metal"])
    return img


def prop_long_desk_segment() -> Image.Image:
    img = new(32, 24)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 4, 31, 14], P["hw_desk"], P["hw_desk_edge"])
    rect(d, [0, 4, 31, 6], P["hw_desk_hi"])
    rect(d, [0, 14, 31, 16], P["hw_desk_edge"])
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


# ---------- supporting rooms (distinct worlds) ----------
def room_office() -> Image.Image:
    """工位 — dark teal carpet + brick, cyber monitors (not hawaii wood)."""
    W, H = 320, 240
    room = new(W, H, P["bg"])
    fill_floor(room, tile_floor())
    brick = tile_brick_wall()
    for x in range(0, W, 32):
        blit(room, brick, x, 0)
        blit(room, brick, x, 16)
    d = ImageDraw.Draw(room)
    rect(d, [0, 48, 319, 50], P["holo"])
    desk = prop_desk()
    chair = prop_chair()
    for i, x in enumerate([40, 120, 200]):
        blit(room, desk, x, 80)
        blit(room, chair, x + 4, 108)
        if i == 1:
            blit(room, prop_laptop(), x + 8, 78)
    blit(room, prop_plant(), 280, 100)
    blit(room, prop_neon_sign(), 140, 36)
    blit(room, prop_server_rack(), 16, 70)
    blit(room, draw_hero(0), 160, 160)
    return room


def room_meeting() -> Image.Image:
    """会议室 — deep purple neon grid + hologram table."""
    W, H = 320, 240
    room = new(W, H, P["mt_floor"])
    fill_floor(room, tile_neon_floor())
    d = ImageDraw.Draw(room)
    # purple velvet back wall
    for x in range(0, W, 32):
        rect(d, [x, 0, x + 31, 40], P["mt_glow"])
        rect(d, [x + 2, 4, x + 28, 36], P["purple"])
    rect(d, [0, 40, 319, 42], P["holo"])
    outline_rect(d, [80, 90, 240, 150], P["wood"], P["black"])
    rect(d, [84, 94, 236, 146], P["wood_d"])
    blit(room, prop_hologram(), 148, 100)
    soft_glow(d, 160, 120, 28, P["holo"], step=4)
    ch = prop_chair()
    for pos in [(100, 70), (160, 70), (220, 70), (90, 150), (160, 155), (230, 150)]:
        blit(room, ch, pos[0], pos[1])
    blit(room, prop_neon_sign(), 120, 18)
    blit(room, draw_hero(1), 60, 180)
    return room


def room_hutong_gate() -> Image.Image:
    """胡同口 — night cobble alley + paifang (outdoor stone)."""
    W, H = 320, 240
    room = new(W, H, P["bg"])
    fill_floor(room, tile_hutong_stone())
    brick = tile_brick_wall()
    for y in range(0, 160, 32):
        blit(room, brick, 0, y)
        blit(room, brick, 288, y)
    roof = tile_hutong_roof()
    for x in range(64, 256, 32):
        blit(room, roof, x, 16)
        blit(room, roof, x, 0)
    blit(room, tile_door(), 144, 48)
    d = ImageDraw.Draw(room)
    rect(d, [100, 70, 220, 72], P["neon_p"])
    rect(d, [110, 40, 210, 42], P["holo"])
    soft_glow(d, 160, 80, 40, P["neon_p"], step=5)
    lan = prop_lantern()
    blit(room, lan, 100, 48)
    blit(room, lan, 204, 48)
    blit(room, prop_neon_sign(), 72, 100)
    blit(room, prop_plant(), 48, 160)
    blit(room, prop_plant(), 260, 160)
    blit(room, draw_hero(2), 152, 140)
    for x in range(120, 200, 4):
        d.point((x, 100), fill=P["holo"])
        d.point((x + 1, 102), fill=P["screen"])
    return room


def gen_rooms():
    save(room_office(), ASSETS / "rooms" / "room_office.png")
    save(room_meeting(), ASSETS / "rooms" / "room_meeting.png")
    save(room_hutong_gate(), ASSETS / "rooms" / "room_hutong_gate.png")


def gen_dialog():
    img = new(256, 64)
    d = ImageDraw.Draw(img)
    rect(d, [0, 0, 255, 63], P["neon_p"])
    rect(d, [2, 2, 253, 61], P["purple"])
    rect(d, [4, 4, 251, 59], P["bg"])
    rect(d, [8, 8, 247, 55], P["floor"])
    rect(d, [10, 10, 245, 53], P["bg"])
    for cx, cy in [(6, 6), (249, 6), (6, 57), (249, 57)]:
        rect(d, [cx - 2, cy - 2, cx + 2, cy + 2], P["holo"])
    rect(d, [12, 4, 80, 14], P["dark"])
    rect(d, [14, 6, 78, 12], P["neon_p2"])
    for row, y in enumerate([20, 28, 36, 44]):
        for x in range(16, 200 - row * 10, 4):
            d.point((x, y), fill=P["metal"] if (x // 4) % 3 else P["white"])
    d.point((240, 48), fill=P["lantern"])
    d.point((238, 46), fill=P["lantern"])
    d.point((242, 46), fill=P["lantern"])
    save(img, ASSETS / "ui" / "dialog_frame.png")


# ---------- Hawaii: warm daylight window office ----------
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
    save(tile_hawaii_floor(), out / "floor_wood.png")
    save(tile_hawaii_wall(), out / "wall_cream.png")

    W, H = 320, 288
    scene = new(W, H, P["hw_wall"])
    fill_floor(scene, tile_hawaii_floor())
    d = ImageDraw.Draw(scene)

    # cream side walls (2.5D thickness)
    for y in range(52, H):
        rect(d, [0, y, 10, y], P["hw_wall_d"])
        rect(d, [309, y, 319, y], P["hw_wall_d"])

    # window wall with blinds + sun shafts
    for x in range(0, W, 32):
        blit(scene, tile_hawaii_wall(), x, 0)
        blit(scene, blind, x, 8)
        blit(scene, blind, x, 28)
    # sill
    rect(d, [0, 56, 319, 62], P["hw_trim"])
    rect(d, [0, 56, 319, 58], P["hw_desk_hi"])

    # warm sun beams onto floor (chunky diagonal shafts)
    for i, x0 in enumerate([40, 100, 160, 220]):
        for k in range(0, 90, 3):
            xx = x0 + k // 3
            yy = 64 + k
            if 12 < xx < 300 and yy < 250:
                d.point((xx, yy), fill=P["hw_sun"] if k % 6 == 0 else P["hw_sun2"])

    # continuous window-side long desk (horizontal ledge)
    outline_rect(d, [24, 64, 296, 88], P["hw_desk"], P["hw_desk_edge"])
    rect(d, [26, 66, 294, 70], P["hw_desk_hi"])
    rect(d, [26, 84, 294, 86], P["hw_desk_edge"])

    # vertical desk run — 3 seats in a vertical line toward the window
    dx = 118
    outline_rect(d, [dx, 78, dx + 60, 262], P["hw_desk"], P["hw_desk_edge"])
    rect(d, [dx + 2, 80, dx + 58, 84], P["hw_desk_hi"])
    rect(d, [dx, 78, dx + 6, 262], P["hw_desk_edge"])
    # leg hints
    for ly in (110, 178, 246):
        rect(d, [dx + 8, ly, dx + 10, ly + 8], P["metal"])
        rect(d, [dx + 48, ly, dx + 50, ly + 8], P["metal"])

    chairs = [
        (dx + 64, 86, prop_chair()),
        (dx + 64, 154, prop_chair_jacket()),
        (dx + 64, 222, prop_chair()),
    ]
    for x, y, spr in chairs:
        blit(scene, spr, x, y)

    blit(scene, prop_laptop(), dx + 16, 92)
    blit(scene, prop_thermos(), dx + 40, 162)
    blit(scene, prop_folders(), dx + 14, 234)
    blit(scene, prop_plant(), 260, 66)
    blit(scene, prop_plant(), dx + 40, 80)
    # cyber hutong accent (small) — not a neon shop strip
    rect(d, [16, 120, 18, 200], P["screen"])
    blit(scene, prop_folders(), 20, 180)
    blit(scene, draw_hero(1), 248, 168)

    # soft warm ambient dots
    for x, y in [(50, 200), (90, 240), (200, 250), (280, 200)]:
        d.point((x, y), fill=P["hw_sun"])

    save(scene, out / "scene_hawaii.png")


# ---------- Pop Mart: candy neon retail ----------
def prop_blind_box_closed(color_key: str = "box_pink") -> Image.Image:
    img = new(16, 16)
    d = ImageDraw.Draw(img)
    c = P[color_key]
    outline_rect(d, [2, 2, 13, 14], c, P["black"])
    rect(d, [3, 3, 12, 5], P["white"])
    rect(d, [4, 6, 11, 12], P["white"])
    rect(d, [6, 7, 9, 8], P["purple"])
    rect(d, [8, 8, 9, 10], P["purple"])
    d.point((7, 11), fill=P["purple"])
    rect(d, [13, 4, 14, 14], P["dark"])
    return img


def prop_blind_box_open() -> Image.Image:
    img = new(16, 20)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 10, 13, 18], P["box_yellow"], P["black"])
    rect(d, [3, 11, 12, 17], P["white"])
    rect(d, [1, 6, 4, 11], P["box_yellow"])
    rect(d, [11, 6, 14, 11], P["box_yellow"])
    rect(d, [4, 5, 11, 8], P["box_mint"])
    rect(d, [6, 2, 9, 12], P["black"])
    rect(d, [5, 3, 10, 6], P["black"])
    d.point((6, 4), fill=P["holo"])
    d.point((9, 4), fill=P["neon_p"])
    rect(d, [4, 7, 5, 9], P["black"])
    rect(d, [10, 7, 11, 9], P["black"])
    return img


def prop_figure_silhouette() -> Image.Image:
    img = new(16, 24)
    d = ImageDraw.Draw(img)
    for dx in range(-4, 5):
        for dy in range(-1, 2):
            if abs(dx) / 4 + abs(dy) / 1.5 < 1:
                d.point((8 + dx, 22 + dy), fill=P["shadow"])
    outline_rect(d, [5, 10, 10, 18], P["box_lilac"], P["black"])
    rect(d, [6, 11, 9, 17], P["purple"])
    outline_rect(d, [4, 3, 11, 10], P["skin"], P["black"])
    rect(d, [4, 2, 11, 5], P["hair"])
    d.point((6, 6), fill=P["holo"])
    d.point((9, 6), fill=P["holo"])
    d.point((5, 8), fill=P["neon_p"])
    d.point((10, 8), fill=P["neon_p"])
    rect(d, [5, 18, 7, 21], P["dark"])
    rect(d, [8, 18, 10, 21], P["dark"])
    return img


def prop_shelf_boxes() -> Image.Image:
    """Tall blind-box wall shelf — chunky candy cubes."""
    img = new(56, 56)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, 55, 55], P["pm_shelf"], P["black"])
    rect(d, [2, 2, 53, 6], P["pm_neon"])
    colors = [
        "box_pink", "box_mint", "box_yellow", "box_lilac",
        "box_sky", "box_orange", "neon_p", "holo",
    ]
    for row, y in enumerate([8, 22, 36]):
        rect(d, [2, y + 12, 53, y + 14], P["pm_wall"])
        for col, x in enumerate([4, 16, 28, 40]):
            c = P[colors[(row * 4 + col) % len(colors)]]
            outline_rect(d, [x, y, x + 10, y + 11], c, P["black"])
            rect(d, [x + 1, y + 1, x + 9, y + 3], P["white"])
            d.point((x + 5, y + 6), fill=P["purple"])
    return img


def prop_display_counter() -> Image.Image:
    img = new(80, 40)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 12, 77, 38], P["pm_counter"], P["black"])
    rect(d, [4, 14, 75, 36], P["pm_counter_d"])
    # glass top with neon edge
    outline_rect(d, [4, 2, 75, 14], P["pm_glass"], P["pm_neon2"])
    rect(d, [6, 4, 73, 10], P["white"])
    rect(d, [2, 12, 77, 13], P["pm_neon"])
    rect(d, [12, 20, 34, 30], P["pm_wall"])
    rect(d, [46, 20, 68, 30], P["pm_wall"])
    d.point((23, 25), fill=P["pm_neon2"])
    d.point((57, 25), fill=P["pm_neon2"])
    return img


def prop_blind_box_wall() -> Image.Image:
    """Full-height colorful blind-box wall panel."""
    img = new(48, 64)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, 47, 63], P["pm_wall"], P["black"])
    colors = [
        "box_pink", "box_mint", "box_yellow", "box_lilac",
        "box_sky", "box_orange", "pm_neon", "pm_neon2",
    ]
    for row in range(5):
        for col in range(3):
            x, y = 4 + col * 14, 4 + row * 12
            c = P[colors[(row * 3 + col) % len(colors)]]
            outline_rect(d, [x, y, x + 11, y + 10], c, P["black"])
            rect(d, [x + 1, y + 1, x + 10, y + 3], P["white"])
            d.point((x + 5, y + 6), fill=P["purple"])
    return img


def gen_popmart():
    out = ASSETS / "scenes" / "popmart"
    save(prop_blind_box_closed("box_pink"), out / "box_closed.png")
    save(prop_blind_box_open(), out / "box_opened.png")
    save(prop_figure_silhouette(), out / "figure.png")
    save(prop_shelf_boxes(), out / "shelf_boxes.png")
    save(prop_display_counter(), out / "counter.png")
    save(prop_blind_box_wall(), out / "box_wall.png")
    save(tile_popmart_floor(), out / "floor_candy.png")
    save(tile_popmart_wall(), out / "wall_retail.png")

    save(prop_blind_box_closed("box_mint"), ASSETS / "props" / "blind_box.png")
    save(prop_blind_box_open(), ASSETS / "props" / "blind_box_open.png")
    save(prop_figure_silhouette(), ASSETS / "props" / "popmart_figure.png")
    save(prop_shelf_boxes(), ASSETS / "props" / "shelf_boxes.png")
    save(prop_display_counter(), ASSETS / "props" / "display_counter.png")

    W, H = 320, 240
    scene = new(W, H, P["pm_wall"])
    fill_floor(scene, tile_popmart_floor())
    d = ImageDraw.Draw(scene)

    # retail back wall panels
    for x in range(0, W, 32):
        blit(scene, tile_popmart_wall(), x, 0)
        blit(scene, tile_popmart_wall(), x, 20)

    # pink/mint strip lights
    rect(d, [0, 52, 319, 54], P["pm_neon"])
    rect(d, [0, 55, 319, 56], P["pm_neon2"])
    soft_glow(d, 80, 60, 20, P["pm_neon"], step=4)
    soft_glow(d, 240, 60, 20, P["pm_neon2"], step=4)

    # blind-box walls + shelves
    wall = prop_blind_box_wall()
    blit(scene, wall, 8, 40)
    blit(scene, wall, 264, 40)
    shelf = prop_shelf_boxes()
    blit(scene, shelf, 70, 36)
    blit(scene, shelf, 150, 36)

    # store neon marquee
    outline_rect(d, [100, 58, 220, 78], P["pm_wall_hi"], P["black"])
    rect(d, [104, 62, 216, 74], P["pm_neon"])
    for x in range(110, 210, 12):
        rect(d, [x, 64, x + 6, 72], P["white"])
        d.point((x + 3, 68), fill=P["pm_neon2"])

    # central display counter
    counter = prop_display_counter()
    blit(scene, counter, 120, 130)

    for i, ck in enumerate(["box_pink", "box_mint", "box_yellow", "box_lilac", "box_sky"]):
        blit(scene, prop_blind_box_closed(ck), 128 + i * 14, 122)

    # openable boxes on floor + 拆盲盒 moment
    blit(scene, prop_blind_box_closed("box_orange"), 36, 160)
    blit(scene, prop_blind_box_closed("box_mint"), 50, 170)
    blit(scene, prop_blind_box_closed("box_yellow"), 42, 182)
    blit(scene, prop_blind_box_open(), 210, 118)
    blit(scene, prop_figure_silhouette(), 240, 148)

    # candy floor path lights
    for x in range(16, 304, 20):
        d.point((x, 220), fill=P["pm_neon"] if (x // 20) % 2 else P["pm_neon2"])

    blit(scene, draw_hero(0), 90, 168)
    save(scene, out / "scene_popmart.png")


# ---------- Restroom: pastel game-toilet (charming, not grimy) ----------
def prop_stall() -> Image.Image:
    img = new(44, 60)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 4, 3, 56], P["rr_stall"], P["black"])
    outline_rect(d, [40, 4, 43, 56], P["rr_stall"], P["black"])
    outline_rect(d, [4, 6, 39, 54], P["rr_stall"], P["black"])
    rect(d, [6, 8, 37, 50], P["rr_stall_d"])
    # gap under door
    rect(d, [6, 50, 37, 54], P["rr_floor2"])
    outline_rect(d, [0, 0, 43, 6], P["rr_metal"], P["black"])
    # cyber lock
    outline_rect(d, [30, 26, 36, 32], P["dark"], P["black"])
    d.point((33, 29), fill=P["neon_p2"])
    return img


def prop_stall_open() -> Image.Image:
    img = prop_stall()
    d = ImageDraw.Draw(img)
    rect(d, [8, 10, 32, 52], P["rr_wall_d"])
    # toilet bowl
    outline_rect(d, [14, 30, 28, 46], P["rr_porcelain"], P["black"])
    rect(d, [16, 22, 26, 30], P["rr_porcelain"])
    rect(d, [18, 33, 24, 40], P["rr_wet"])
    # door ajar
    outline_rect(d, [32, 8, 42, 52], P["rr_stall"], P["black"])
    rect(d, [33, 10, 41, 50], P["rr_metal"])
    return img


def prop_sink() -> Image.Image:
    img = new(32, 28)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 10, 29, 24], P["rr_metal"], P["black"])
    rect(d, [4, 12, 27, 22], P["rr_porcelain"])
    rect(d, [8, 14, 23, 19], P["rr_wet"])
    d.point((15, 16), fill=P["white"])
    # faucet
    outline_rect(d, [13, 2, 18, 12], P["rr_metal"], P["black"])
    rect(d, [10, 2, 21, 5], P["rr_metal"])
    d.point((15, 1), fill=P["rr_fluoro2"])
    rect(d, [6, 5, 10, 8], P["dark"])
    rect(d, [21, 5, 25, 8], P["dark"])
    rect(d, [12, 24, 19, 27], P["dark"])
    return img


def prop_mirror() -> Image.Image:
    img = new(28, 24)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, 27, 23], P["rr_metal"], P["black"])
    rect(d, [2, 2, 25, 21], P["rr_fluoro"])
    rect(d, [4, 4, 23, 18], P["rr_wet2"])
    rect(d, [1, 1, 26, 1], P["rr_fluoro2"])
    rect(d, [1, 22, 26, 22], P["holo"])
    return img


def gen_restroom():
    out = ASSETS / "scenes" / "restroom"
    save(prop_stall(), out / "stall.png")
    save(prop_stall_open(), out / "stall_open.png")
    save(prop_sink(), out / "sink.png")
    save(prop_mirror(), out / "mirror.png")
    save(tile_restroom_floor(), out / "floor_tile.png")
    save(tile_restroom_wall(), out / "wall_subway.png")
    save(prop_stall(), ASSETS / "props" / "stall.png")
    save(prop_sink(), ASSETS / "props" / "sink.png")

    W, H = 320, 240
    scene = new(W, H, P["rr_wall"])
    fill_floor(scene, tile_restroom_floor())
    d = ImageDraw.Draw(scene)

    # cool subway tile back + side walls
    for x in range(0, W, 32):
        blit(scene, tile_restroom_wall(), x, 0)
        blit(scene, tile_restroom_wall(), x, 16)
    for y in range(48, H, 32):
        blit(scene, tile_restroom_wall(), 0, y)
        # right wall only below sink zone starts later

    # fluorescent tube with cool bloom
    outline_rect(d, [24, 36, 296, 44], P["rr_fluoro"], P["rr_metal"])
    rect(d, [28, 38, 292, 42], P["white"])
    soft_glow(d, 160, 48, 36, P["rr_fluoro2"], step=4)

    # Four stalls
    stall = prop_stall()
    stall_open = prop_stall_open()
    positions = [20, 68, 116, 164]
    for i, x in enumerate(positions):
        blit(scene, stall_open if i == 2 else stall, x, 48)

    # Outside stalls: two sinks + mirrors
    sink = prop_sink()
    mirror = prop_mirror()
    blit(scene, mirror, 236, 48)
    blit(scene, mirror, 276, 48)
    blit(scene, sink, 234, 74)
    blit(scene, sink, 274, 74)

    # charm mats + sparkles (fill empty aisle)
    outline_rect(d, [80, 130, 130, 210], P["rr_stall"], P["black"])
    for y in range(136, 205, 10):
        rect(d, [84, y, 126, y + 4], P["rr_caution"] if (y // 10) % 2 else P["rr_fluoro"])
    outline_rect(d, [220, 110, 300, 120], P["rr_stall"], P["black"])
    outline_rect(d, [220, 175, 300, 185], P["rr_stall"], P["black"])

    # pastel trash
    outline_rect(d, [298, 150, 314, 185], P["rr_metal"], P["black"])
    rect(d, [300, 152, 312, 160], P["rr_caution"])

    # cute exit / sign
    rect(d, [6, 100, 10, 150], P["rr_caution"])
    outline_rect(d, [12, 108, 40, 128], P["rr_wall_d"], P["black"])
    rect(d, [14, 110, 38, 126], P["rr_fluoro"])
    d.point((26, 118), fill=P["holo"])
    # plant accents
    blit(scene, prop_plant(), 196, 100)
    blit(scene, prop_plant(), 50, 180)

    # stall / wash zone divider
    for y in range(110, 200, 2):
        d.point((214, y), fill=P["rr_grout"])

    blit(scene, draw_hero(3), 220, 140)
    save(scene, out / "scene_restroom.png")


def main():
    print("Generating cyber-hutong Phase-1 assets (Soul Knight 2.5D, distinct worlds)…")
    gen_characters()
    gen_tileset()
    gen_props()
    gen_rooms()
    gen_dialog()
    gen_hawaii()
    gen_popmart()
    gen_restroom()
    # Scene A/B/C variants (prettier options; does not touch cast sprites)
    try:
        from generate_scene_variants import main as gen_variants
        gen_variants()
        # Promote densest/warmer B as default scene mocks
        import shutil
        for scene, name in (
            ("restroom", "scene_restroom.png"),
            ("popmart", "scene_popmart.png"),
            ("hawaii", "scene_hawaii.png"),
        ):
            src = ASSETS / "scenes" / scene / "variants" / "b" / "scene.png"
            dst = ASSETS / "scenes" / scene / name
            if src.exists():
                shutil.copy2(src, dst)
                print(f"  promoted variants/b -> {dst.relative_to(ROOT)}")
    except Exception as e:
        print(f"  (variants skipped: {e})")
    try:
        from generate_cast import main as gen_cast
        gen_cast()
    except Exception as e:
        print(f"  (cast skipped: {e})")
    try:
        from generate_daily_life import main as gen_daily
        gen_daily()
    except Exception as e:
        print(f"  (daily life skipped: {e})")
    print("Done.")


if __name__ == "__main__":
    main()
