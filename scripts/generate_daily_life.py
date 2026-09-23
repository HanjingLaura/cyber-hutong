#!/usr/bin/env python3
"""Generate daily-company rooms, classified props, tiles, thumbs, zoomed previews.

Soul Knight 2.5D — each room is a DISTINCT world (floor / wall / light).
New named rooms: pantry, print, hallway, rooftop, boss, delivery.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
PREVIEW = ROOT / "public" / "preview"
SHOTS = Path("/workspace/cyber-hutong-shots/daily")

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_assets as ga  # noqa: E402
import generate_cast as gc  # noqa: E402

P = ga.P
new = ga.new
rect = ga.rect
save = ga.save
blit = ga.blit
outline_rect = ga.outline_rect
soft_glow = ga.soft_glow
draw_hero = ga.draw_hero
fill_floor = ga.fill_floor

# ---------------------------------------------------------------------------
# Distinct worlds — never reuse hawaii wood / popmart candy / restroom porcelain
# ---------------------------------------------------------------------------
D = {
    # pantry / 茶水间 — terracotta kitchen
    "pn_floor": (210, 118, 82, 255),
    "pn_floor2": (186, 96, 64, 255),
    "pn_grout": (140, 70, 48, 255),
    "pn_wall": (248, 232, 210, 255),
    "pn_wall_d": (214, 186, 154, 255),
    "pn_tile": (255, 236, 214, 255),
    "pn_tile2": (232, 196, 160, 255),
    "pn_wood": (150, 92, 52, 255),
    "pn_wood_hi": (196, 132, 78, 255),
    "pn_steam": (255, 248, 236, 255),
    "pn_coffee": (92, 52, 32, 255),
    "pn_cream": (255, 236, 200, 255),
    "pn_light": (255, 214, 130, 255),
    "pn_accent": (255, 120, 90, 255),
    # print / 打印区 — cool paper grey
    "pr_floor": (176, 188, 198, 255),
    "pr_floor2": (148, 162, 176, 255),
    "pr_grout": (120, 132, 146, 255),
    "pr_wall": (228, 234, 240, 255),
    "pr_wall_d": (186, 196, 208, 255),
    "pr_paper": (252, 250, 246, 255),
    "pr_yellow": (255, 226, 120, 255),
    "pr_blue": (90, 150, 220, 255),
    "pr_machine": (52, 58, 70, 255),
    "pr_led": (80, 255, 180, 255),
    "pr_light": (230, 244, 255, 255),
    # hallway / 楼梯过道 — hutong night corridor
    "hw_floor": (48, 56, 72, 255),
    "hw_floor2": (34, 40, 54, 255),
    "hw_step": (90, 78, 68, 255),
    "hw_step_hi": (140, 118, 96, 255),
    "hw_rail": (200, 196, 186, 255),
    "hw_exit": (80, 230, 140, 255),
    "hw_warn": (255, 170, 60, 255),
    "hw_neon": (61, 255, 240, 255),
    "hw_brick": (118, 72, 52, 255),
    "hw_brick_hi": (168, 108, 74, 255),
    # rooftop / 天台 — night concrete + city
    "rt_floor": (118, 120, 124, 255),
    "rt_floor2": (88, 90, 96, 255),
    "rt_seam": (58, 60, 66, 255),
    "rt_sky": (14, 16, 36, 255),
    "rt_sky2": (28, 24, 58, 255),
    "rt_moon": (255, 244, 210, 255),
    "rt_rail": (70, 74, 84, 255),
    "rt_city": (40, 36, 70, 255),
    "rt_win": (255, 190, 90, 255),
    "rt_ember": (255, 110, 50, 255),
    "rt_wind": (180, 210, 230, 255),
    # boss / 老板办公室 — burgundy + gold
    "bs_floor": (92, 58, 36, 255),
    "bs_floor2": (70, 42, 26, 255),
    "bs_plank": (120, 78, 48, 255),
    "bs_wall": (92, 28, 48, 255),
    "bs_wall_hi": (130, 48, 72, 255),
    "bs_gold": (220, 176, 78, 255),
    "bs_gold_hi": (255, 226, 140, 255),
    "bs_leather": (48, 28, 28, 255),
    "bs_leather_hi": (90, 48, 44, 255),
    "bs_desk": (64, 40, 24, 255),
    "bs_desk_hi": (110, 72, 40, 255),
    "bs_lamp": (255, 210, 120, 255),
    "bs_glass": (40, 70, 110, 255),
    # delivery / 快递门口 — dusk dock
    "dv_floor": (96, 90, 82, 255),
    "dv_floor2": (72, 68, 62, 255),
    "dv_door": (70, 86, 96, 255),
    "dv_door_hi": (120, 140, 150, 255),
    "dv_box": (196, 148, 88, 255),
    "dv_box2": (168, 118, 64, 255),
    "dv_tape": (214, 170, 60, 255),
    "dv_orange": (232, 122, 48, 255),
    "dv_scooter": (40, 44, 52, 255),
    "dv_dusk": (255, 140, 80, 255),
}


def save_any(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    try:
        print(f"  wrote {path.relative_to(ROOT)}")
    except ValueError:
        print(f"  wrote {path}")


def thumb(img: Image.Image) -> Image.Image:
    return img.resize((img.width // 2, img.height // 2), Image.Resampling.NEAREST)


def zoom(img: Image.Image, n: int = 3) -> Image.Image:
    return img.resize((img.width * n, img.height * n), Image.Resampling.NEAREST)


def _shadow(d, cx, cy, rx=10, ry=3):
    for dy in range(-ry, ry + 1):
        for dx in range(-rx, rx + 1):
            if (dx * dx) * ry * ry + (dy * dy) * rx * rx <= rx * rx * ry * ry and (dx + dy) % 2 == 0:
                d.point((cx + dx, cy + dy), fill=(20, 22, 28, 120))


# ===========================================================================
# Tiles
# ===========================================================================
def tile_pantry_floor():
    t = new(32, 32, D["pn_floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 8):
        for x in range(0, 32, 8):
            c = D["pn_floor"] if (x // 8 + y // 8) % 2 else D["pn_floor2"]
            rect(d, [x, y, x + 7, y + 7], c)
            rect(d, [x, y, x + 7, y], D["pn_grout"])
            rect(d, [x, y, x, y + 7], D["pn_grout"])
    d.point((6, 6), fill=D["pn_light"])
    d.point((22, 18), fill=D["pn_cream"])
    return t


def tile_pantry_wall():
    t = new(32, 32, D["pn_wall"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 31, 6], D["pn_wall_d"])
    for y in range(10, 28, 8):
        off = 0 if (y // 8) % 2 == 0 else 4
        for x in range(-4, 36, 10):
            rect(d, [x + off, y, x + off + 8, y + 6], D["pn_tile"])
            rect(d, [x + off, y, x + off + 8, y], D["pn_tile2"])
    rect(d, [0, 28, 31, 31], D["pn_wood"])
    return t


def tile_print_floor():
    t = new(32, 32, D["pr_floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 16):
        for x in range(0, 32, 16):
            c = D["pr_floor"] if (x // 16 + y // 16) % 2 else D["pr_floor2"]
            rect(d, [x, y, x + 15, y + 15], c)
            rect(d, [x, y, x + 15, y], D["pr_grout"])
            rect(d, [x, y, x, y + 15], D["pr_grout"])
    d.point((4, 4), fill=D["pr_paper"])
    d.point((20, 22), fill=D["pr_yellow"])
    return t


def tile_print_wall():
    t = new(32, 32, D["pr_wall"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 31, 4], D["pr_wall_d"])
    for y in (8, 16, 24):
        rect(d, [2, y, 29, y], D["pr_wall_d"])
    rect(d, [0, 30, 31, 31], D["pr_blue"])
    return t


def tile_hall_floor():
    t = new(32, 32, D["hw_floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 8):
        for x in range(0, 32, 8):
            c = D["hw_floor2"] if (x // 8 + y // 8) % 2 else D["hw_floor"]
            rect(d, [x + 1, y + 1, x + 6, y + 6], c)
    d.point((10, 18), fill=D["hw_neon"])
    return t


def tile_hall_brick():
    t = new(32, 32, D["hw_brick"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 6):
        off = 4 if (y // 6) % 2 else 0
        for x in range(-4, 36, 10):
            rect(d, [x + off, y, x + off + 8, y + 4], D["hw_brick"])
            rect(d, [x + off, y, x + off + 8, y], D["hw_brick_hi"])
    rect(d, [0, 14, 31, 15], D["hw_neon"])
    return t


def tile_roof_floor():
    t = new(32, 32, D["rt_floor"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 31, 31], D["rt_floor"])
    rect(d, [0, 15, 31, 16], D["rt_seam"])
    rect(d, [15, 0, 16, 31], D["rt_seam"])
    d.point((6, 8), fill=D["rt_floor2"])
    d.point((24, 22), fill=D["rt_floor2"])
    return t


def tile_boss_floor():
    t = new(32, 32, D["bs_floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 8):
        base = D["bs_plank"] if (y // 8) % 2 == 0 else D["bs_floor"]
        rect(d, [0, y, 31, y + 7], base)
        rect(d, [0, y + 7, 31, y + 7], D["bs_floor2"])
        off = 6 if (y // 8) % 2 else 0
        rect(d, [10 + off, y, 10 + off, y + 6], D["bs_floor2"])
        d.point((4, y + 2), fill=D["bs_gold"])
    return t


def tile_boss_wall():
    t = new(32, 32, D["bs_wall"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 31, 5], D["bs_wall_hi"])
    rect(d, [0, 6, 31, 7], D["bs_gold"])
    for x in (6, 16, 26):
        rect(d, [x, 10, x + 2, 28], D["bs_wall_hi"])
    rect(d, [0, 29, 31, 31], D["bs_gold"])
    return t


def tile_dock_floor():
    t = new(32, 32, D["dv_floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 10):
        for x in range(0, 32, 10):
            c = D["dv_floor"] if (x // 10 + y // 10) % 2 else D["dv_floor2"]
            rect(d, [x, y, min(x + 9, 31), min(y + 9, 31)], c)
    d.point((8, 8), fill=D["dv_dusk"])
    return t


def gen_new_tiles():
    new_tiles = [
        ("pantry_terra", tile_pantry_floor()),
        ("print_lino", tile_print_floor()),
        ("hall_night", tile_hall_floor()),
        ("roof_concrete", tile_roof_floor()),
        ("boss_herring", tile_boss_floor()),
        ("dock_slab", tile_dock_floor()),
    ]
    out = ASSETS / "tiles"
    daily = new(32 * len(new_tiles), 32)
    for i, (name, t) in enumerate(new_tiles):
        save(t, out / f"tile_{name}.png")
        daily.paste(t, (i * 32, 0), t)
    save(daily, out / "tileset_daily_32.png")

    legacy = [
        "floor", "brick", "neon", "roof", "grass", "door", "blind",
        "hawaii_wood", "popmart_candy", "restroom_tile",
    ]
    names = legacy + [n for n, _ in new_tiles]
    strip = new(32 * len(names), 32)
    for i, name in enumerate(names):
        p = out / f"tile_{name}.png"
        if p.exists():
            strip.paste(Image.open(p).convert("RGBA"), (i * 32, 0))
        elif i >= len(legacy):
            strip.paste(new_tiles[i - len(legacy)][1], (i * 32, 0))
    save(strip, out / "tileset_32.png")


# ===========================================================================
# Classified props
# ===========================================================================
def prop_computer():
    img = new(24, 24)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 2, 21, 16], P["dark"], P["black"])
    rect(d, [4, 4, 19, 14], P["screen"])
    d.point((8, 8), fill=P["holo"])
    d.point((12, 7), fill=P["white"])
    rect(d, [10, 16, 13, 19], P["metal"])
    outline_rect(d, [6, 19, 17, 22], P["metal"], P["black"])
    return img


def prop_coffee_cup():
    img = new(12, 12)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 3, 8, 11], P["white"], P["black"])
    rect(d, [2, 4, 7, 6], D["pn_coffee"])
    rect(d, [8, 5, 10, 8], P["metal"])
    d.point((4, 1), fill=D["pn_steam"])
    d.point((6, 2), fill=D["pn_steam"])
    return img


def prop_coffee_machine():
    img = new(28, 32)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 4, 25, 30], D["pn_wood"], P["black"])
    rect(d, [4, 6, 23, 14], P["dark"])
    rect(d, [6, 8, 12, 12], D["pn_cream"])
    rect(d, [14, 8, 21, 12], D["pn_light"])
    outline_rect(d, [8, 16, 18, 24], P["metal"], P["black"])
    rect(d, [10, 14, 16, 16], P["dark"])
    d.point((13, 20), fill=D["pn_coffee"])
    rect(d, [4, 26, 23, 28], D["pn_wood_hi"])
    d.point((8, 2), fill=D["pn_steam"])
    d.point((14, 1), fill=D["pn_steam"])
    return img


def prop_kettle():
    img = new(16, 16)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 5, 12, 14], P["metal"], P["black"])
    rect(d, [4, 7, 10, 12], D["pn_cream"])
    rect(d, [6, 2, 8, 5], P["dark"])
    rect(d, [12, 7, 14, 10], P["metal"])
    return img


def prop_water_cooler():
    img = new(20, 32)
    d = ImageDraw.Draw(img)
    outline_rect(d, [3, 14, 16, 31], P["dark"], P["black"])
    rect(d, [5, 16, 14, 22], P["holo"])
    outline_rect(d, [4, 2, 15, 16], P["screen"], P["black"])
    rect(d, [6, 4, 13, 14], (180, 230, 240, 255))
    d.point((9, 8), fill=P["white"])
    return img


def prop_microwave():
    img = new(24, 16)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 1, 22, 14], P["dark"], P["black"])
    rect(d, [3, 3, 15, 12], P["black"])
    d.point((8, 7), fill=D["pn_light"])
    rect(d, [17, 3, 20, 6], D["pn_accent"])
    rect(d, [17, 8, 20, 12], P["metal"])
    return img


def prop_snack_shelf():
    img = new(28, 32)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 1, 26, 30], D["pn_wood"], P["black"])
    for y, c in ((4, D["pn_accent"]), (12, D["pn_cream"]), (20, P["neon_p"])):
        rect(d, [3, y, 24, y + 6], D["pn_wood_hi"])
        outline_rect(d, [5, y + 1, 11, y + 5], c, P["black"])
        outline_rect(d, [14, y + 1, 22, y + 5], P["lantern"], P["black"])
    return img


def prop_printer():
    img = new(28, 24)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 8, 25, 22], D["pr_machine"], P["black"])
    rect(d, [4, 10, 23, 14], P["metal"])
    outline_rect(d, [6, 2, 21, 10], D["pr_paper"], P["black"])
    rect(d, [8, 4, 19, 8], D["pr_yellow"])
    d.point((20, 16), fill=D["pr_led"])
    d.point((17, 16), fill=P["neon_p"])
    rect(d, [8, 18, 18, 20], D["pr_paper"])
    return img


def prop_paper_stack():
    img = new(16, 12)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 4, 14, 11], D["pr_paper"], P["black"])
    rect(d, [2, 2, 13, 6], D["pr_yellow"])
    rect(d, [3, 0, 12, 3], D["pr_paper"])
    return img


def prop_shredder():
    img = new(20, 18)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 4, 17, 16], D["pr_machine"], P["black"])
    rect(d, [4, 6, 15, 8], P["metal"])
    for x in range(5, 15, 2):
        d.point((x, 7), fill=D["pr_grout"])
    rect(d, [6, 10, 13, 14], D["pr_blue"])
    return img


def prop_inbox():
    img = new(20, 14)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 4, 18, 13], D["pr_blue"], P["black"])
    rect(d, [3, 2, 16, 8], D["pr_paper"])
    rect(d, [4, 0, 12, 3], D["pr_yellow"])
    return img


def prop_whiteboard():
    img = new(40, 28)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, 39, 27], P["metal"], P["black"])
    rect(d, [2, 2, 37, 24], D["pr_paper"])
    # doodles
    rect(d, [6, 6, 18, 7], P["purple"])
    rect(d, [6, 10, 24, 11], P["screen"])
    rect(d, [8, 14, 14, 20], P["neon_p"])
    rect(d, [20, 14, 32, 16], D["pr_blue"])
    d.point((30, 20), fill=P["lantern"])
    return img


def prop_parcel(color=None):
    img = new(16, 14)
    d = ImageDraw.Draw(img)
    c = color or D["dv_box"]
    outline_rect(d, [1, 2, 14, 13], c, P["black"])
    rect(d, [2, 3, 13, 6], D["dv_box2"])
    rect(d, [7, 2, 8, 13], D["dv_tape"])
    rect(d, [1, 7, 14, 8], D["dv_tape"])
    return img


def prop_parcel_stack():
    img = new(24, 22)
    d = ImageDraw.Draw(img)
    blit(img, prop_parcel(D["dv_box2"]), 2, 8)
    blit(img, prop_parcel(D["dv_box"]), 6, 2)
    return img


def prop_door():
    img = new(24, 36)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 2, 21, 34], P["wood"], P["black"])
    rect(d, [4, 4, 19, 32], P["wood_d"])
    rect(d, [6, 6, 11, 16], P["wood"])
    rect(d, [13, 6, 18, 16], P["wood"])
    rect(d, [16, 18, 19, 22], P["holo"])
    return img


def prop_chair_office():
    return ga.prop_chair()


def prop_chair_leather():
    img = new(28, 32)
    d = ImageDraw.Draw(img)
    _shadow(d, 14, 30, 10, 3)
    outline_rect(d, [4, 4, 23, 20], D["bs_leather"], P["black"])
    rect(d, [6, 6, 21, 18], D["bs_leather_hi"])
    outline_rect(d, [2, 16, 25, 24], D["bs_leather"], P["black"])
    rect(d, [4, 18, 23, 22], D["bs_gold"])
    rect(d, [6, 24, 8, 30], P["metal"])
    rect(d, [19, 24, 21, 30], P["metal"])
    return img


def prop_plant_tall():
    img = new(16, 28)
    d = ImageDraw.Draw(img)
    outline_rect(d, [4, 18, 11, 27], P["white"], P["black"])
    rect(d, [5, 19, 10, 21], D["bs_gold"])
    for pts, c in [
        ((8, 2), P["green"]),
        ((5, 6), P["green"]),
        ((11, 6), P["green"]),
        ((3, 10), P["green_d"]),
        ((13, 10), P["green"]),
        ((8, 8), P["green_d"]),
        ((6, 12), P["green"]),
        ((10, 12), P["green"]),
    ]:
        d.point(pts, fill=c)
        d.point((pts[0], pts[1] + 1), fill=c)
    return img


def prop_lamp_desk():
    img = new(16, 20)
    d = ImageDraw.Draw(img)
    outline_rect(d, [4, 16, 11, 19], P["metal"], P["black"])
    rect(d, [7, 8, 8, 16], P["metal"])
    outline_rect(d, [2, 2, 13, 10], D["bs_lamp"], P["black"])
    rect(d, [4, 4, 11, 8], D["bs_gold_hi"])
    return img


def prop_neon_exit():
    img = new(24, 12)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, 23, 11], D["hw_exit"], P["black"])
    rect(d, [2, 2, 21, 9], P["black"])
    rect(d, [4, 4, 8, 7], D["hw_exit"])
    rect(d, [10, 4, 19, 7], D["hw_exit"])
    return img


def prop_fire_extinguisher():
    img = new(10, 20)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 4, 7, 18], P["neon_p2"], P["black"])
    rect(d, [3, 1, 6, 4], P["metal"])
    rect(d, [6, 2, 8, 5], P["metal"])
    return img


def prop_vending():
    img = new(22, 36)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 1, 20, 34], P["dark"], P["black"])
    rect(d, [3, 3, 18, 22], P["holo"])
    for y, c in ((5, P["neon_p"]), (11, D["pn_cream"]), (17, P["lantern"])):
        outline_rect(d, [5, y, 16, y + 4], c, P["black"])
    rect(d, [5, 24, 16, 32], P["black"])
    d.point((10, 28), fill=D["hw_warn"])
    return img


def prop_railing():
    img = new(40, 16)
    d = ImageDraw.Draw(img)
    rect(d, [0, 2, 39, 3], D["rt_rail"])
    for x in range(2, 40, 8):
        rect(d, [x, 2, x + 1, 14], D["rt_rail"])
    rect(d, [0, 14, 39, 15], D["rt_rail"])
    return img


def prop_ac_unit():
    img = new(28, 18)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 3, 26, 16], P["metal"], P["black"])
    for y in range(5, 15, 3):
        rect(d, [4, y, 23, y], D["rt_floor2"])
    d.point((22, 6), fill=D["hw_warn"])
    return img


def prop_scooter():
    img = new(36, 22)
    d = ImageDraw.Draw(img)
    outline_rect(d, [8, 8, 30, 16], D["dv_scooter"], P["black"])
    rect(d, [10, 6, 22, 10], D["dv_orange"])
    rect(d, [24, 2, 28, 12], P["metal"])
    outline_rect(d, [6, 14, 14, 21], P["dark"], P["black"])
    outline_rect(d, [24, 14, 32, 21], P["dark"], P["black"])
    d.point((8, 17), fill=P["metal"])
    d.point((26, 17), fill=P["metal"])
    return img


def prop_boss_desk():
    img = new(64, 32)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 8, 61, 26], D["bs_desk"], P["black"])
    rect(d, [4, 10, 59, 14], D["bs_desk_hi"])
    rect(d, [4, 22, 59, 24], D["bs_gold"])
    rect(d, [8, 26, 12, 31], P["metal"])
    rect(d, [50, 26, 54, 31], P["metal"])
    return img


def prop_sofa():
    img = new(48, 24)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 6, 45, 22], D["bs_leather"], P["black"])
    rect(d, [4, 8, 43, 14], D["bs_leather_hi"])
    rect(d, [4, 16, 20, 20], D["bs_gold"])
    rect(d, [26, 16, 43, 20], D["bs_gold"])
    return img


def prop_award():
    img = new(12, 16)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 6, 9, 15], D["bs_gold"], P["black"])
    rect(d, [4, 2, 7, 6], D["bs_gold_hi"])
    d.point((5, 9), fill=P["white"])
    return img


def prop_books():
    img = new(16, 12)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 2, 5, 11], P["purple"], P["black"])
    outline_rect(d, [5, 1, 9, 11], D["bs_gold"], P["black"])
    outline_rect(d, [9, 3, 14, 11], P["neon_p"], P["black"])
    return img


def prop_cigarette():
    img = new(10, 8)
    d = ImageDraw.Draw(img)
    rect(d, [1, 4, 7, 5], P["white"])
    d.point((8, 4), fill=D["rt_ember"])
    d.point((3, 1), fill=D["rt_wind"])
    d.point((5, 2), fill=D["rt_wind"])
    return img


def prop_water_tank():
    img = new(24, 28)
    d = ImageDraw.Draw(img)
    outline_rect(d, [3, 6, 20, 26], P["metal"], P["black"])
    rect(d, [5, 8, 18, 14], D["rt_wind"])
    rect(d, [5, 16, 18, 24], D["rt_floor2"])
    rect(d, [10, 2, 13, 6], P["dark"])
    return img


def prop_blind_box():
    return ga.prop_blind_box_closed("box_pink")


PROP_MAP = [
    ("devices/computer.png", prop_computer),
    ("devices/printer.png", prop_printer),
    ("devices/coffee_machine.png", prop_coffee_machine),
    ("devices/whiteboard.png", prop_whiteboard),
    ("devices/microwave.png", prop_microwave),
    ("devices/shredder.png", prop_shredder),
    ("devices/water_cooler.png", prop_water_cooler),
    ("drinks/coffee_cup.png", prop_coffee_cup),
    ("drinks/kettle.png", prop_kettle),
    ("parcels/parcel.png", prop_parcel),
    ("parcels/parcel_stack.png", prop_parcel_stack),
    ("parcels/blind_box.png", prop_blind_box),
    ("furniture/door.png", prop_door),
    ("furniture/chair_office.png", prop_chair_office),
    ("furniture/chair_leather.png", prop_chair_leather),
    ("furniture/boss_desk.png", prop_boss_desk),
    ("furniture/sofa.png", prop_sofa),
    ("nature/plant_tall.png", prop_plant_tall),
    ("signs/lamp_desk.png", prop_lamp_desk),
    ("signs/neon_exit.png", prop_neon_exit),
    ("signs/fire_extinguisher.png", prop_fire_extinguisher),
    ("signs/vending.png", prop_vending),
    ("signs/railing.png", prop_railing),
    ("signs/ac_unit.png", prop_ac_unit),
    ("signs/scooter.png", prop_scooter),
    ("signs/award.png", prop_award),
    ("signs/books.png", prop_books),
    ("signs/cigarette.png", prop_cigarette),
    ("signs/water_tank.png", prop_water_tank),
    ("signs/inbox.png", prop_inbox),
    ("signs/paper_stack.png", prop_paper_stack),
    ("signs/snack_shelf.png", prop_snack_shelf),
]


def gen_classified_props():
    root_aliases = {
        "computer.png": prop_computer,
        "coffee_cup.png": prop_coffee_cup,
        "coffee_machine.png": prop_coffee_machine,
        "printer.png": prop_printer,
        "whiteboard.png": prop_whiteboard,
        "parcel.png": prop_parcel,
        "parcel_stack.png": prop_parcel_stack,
        "door.png": prop_door,
        "chair_leather.png": prop_chair_leather,
        "plant_tall.png": prop_plant_tall,
        "lamp_desk.png": prop_lamp_desk,
        "neon_exit.png": prop_neon_exit,
        "scooter.png": prop_scooter,
        "water_cooler.png": prop_water_cooler,
        "vending.png": prop_vending,
    }
    for rel, fn in PROP_MAP:
        save(fn(), ASSETS / "props" / rel)
    for name, fn in root_aliases.items():
        save(fn(), ASSETS / "props" / name)


# ===========================================================================
# Rooms
# ===========================================================================
def _cast(i, view="front", frame=0):
    return gc.draw_cast(gc.CAST[i], view, frame)


def _rug(d, box, fill, edge):
    outline_rect(d, box, fill, edge)


def room_pantry():
    """茶水间 — terracotta kitchen, dense coffee ritual."""
    W, H = 320, 240
    room = new(W, H, D["pn_wall"])
    fill_floor(room, tile_pantry_floor())
    d = ImageDraw.Draw(room)
    wall = tile_pantry_wall()
    for x in range(0, W, 32):
        blit(room, wall, x, 0)
        blit(room, wall, x, 16)
    for y in range(48, H, 32):
        blit(room, wall, 0, y)
        blit(room, wall, 288, y)
    # 2.5D side thickness
    for y in range(48, H):
        rect(d, [0, y, 8, y], D["pn_wall_d"])
        rect(d, [311, y, 319, y], D["pn_wall_d"])
    outline_rect(d, [16, 24, 304, 42], D["pn_light"], P["black"])
    rect(d, [20, 26, 300, 40], D["pn_cream"])
    for gx in (60, 120, 180, 240):
        soft_glow(d, gx, 48, 16, D["pn_light"], 3)
        # hanging lamps
        rect(d, [gx, 42, gx + 2, 52], P["metal"])
        outline_rect(d, [gx - 6, 50, gx + 8, 60], D["pn_light"], P["black"])
    _rug(d, [40, 118, 280, 228], D["pn_tile2"], P["black"])
    rect(d, [46, 124, 274, 222], D["pn_floor"])
    # back counter with thickness
    outline_rect(d, [16, 64, 304, 118], D["pn_wood"], P["black"])
    rect(d, [20, 68, 300, 80], D["pn_wood_hi"])
    rect(d, [20, 108, 300, 114], D["pn_wood"])
    blit(room, prop_coffee_machine(), 28, 48)
    blit(room, prop_coffee_machine(), 56, 48)
    blit(room, prop_kettle(), 90, 74)
    blit(room, prop_kettle(), 108, 76)
    blit(room, prop_microwave(), 128, 72)
    blit(room, prop_snack_shelf(), 172, 46)
    blit(room, prop_snack_shelf(), 202, 46)
    blit(room, prop_water_cooler(), 246, 50)
    blit(room, prop_coffee_cup(), 88, 70)
    blit(room, prop_coffee_cup(), 150, 70)
    blit(room, ga.prop_plant(), 276, 58)
    # island
    outline_rect(d, [70, 138, 230, 184], D["pn_wood"], P["black"])
    rect(d, [74, 142, 226, 152], D["pn_wood_hi"])
    rect(d, [74, 176, 226, 180], D["pn_wood"])
    blit(room, prop_coffee_cup(), 90, 134)
    blit(room, prop_coffee_cup(), 120, 136)
    blit(room, prop_coffee_cup(), 150, 134)
    blit(room, ga.prop_plant(), 190, 128)
    blit(room, ga.prop_folders(), 200, 150)
    for x in (78, 118, 158, 198):
        outline_rect(d, [x, 184, x + 18, 202], D["pn_wood_hi"], P["black"])
        rect(d, [x + 2, 186, x + 16, 192], D["pn_cream"])
        rect(d, [x + 7, 202, x + 11, 216], P["metal"])
    # left fridge block
    outline_rect(d, [16, 150, 48, 210], P["metal"], P["black"])
    rect(d, [18, 152, 46, 168], D["pn_cream"])
    rect(d, [18, 172, 46, 206], D["pn_wood_hi"])
    d.point((40, 160), fill=D["pn_accent"])
    blit(room, ga.prop_plant(), 20, 200)
    blit(room, ga.prop_plant(), 280, 190)
    blit(room, gc.draw_npc_barista("front", 0), 40, 112)
    blit(room, _cast(0, "front", 0), 150, 188)
    blit(room, _cast(5, "side", 0), 248, 160)
    for x, y in [(36, 200), (60, 210), (270, 200), (90, 120), (160, 126)]:
        d.point((x, y), fill=D["pn_steam"])
        d.point((x + 2, y - 2), fill=D["pn_cream"])
    return room


def room_print():
    """打印区 — cool paper factory corner, filled."""
    W, H = 320, 240
    room = new(W, H, D["pr_wall"])
    fill_floor(room, tile_print_floor())
    d = ImageDraw.Draw(room)
    wall = tile_print_wall()
    for x in range(0, W, 32):
        blit(room, wall, x, 0)
        blit(room, wall, x, 16)
    for y in range(48, H, 32):
        blit(room, wall, 0, y)
        blit(room, wall, 288, y)
    outline_rect(d, [12, 26, 308, 46], D["pr_light"], P["metal"])
    rect(d, [16, 28, 304, 44], P["white"])
    blit(room, prop_whiteboard(), 24, 36)
    blit(room, prop_whiteboard(), 200, 36)
    # yellow runner
    outline_rect(d, [48, 120, 272, 228], D["pr_yellow"], P["black"])
    rect(d, [54, 126, 266, 222], D["pr_floor"])
    # copy bar
    outline_rect(d, [16, 64, 304, 118], D["pr_wall_d"], P["black"])
    rect(d, [20, 68, 300, 80], D["pr_paper"])
    rect(d, [20, 108, 300, 114], D["pr_machine"])
    blit(room, prop_printer(), 24, 58)
    blit(room, prop_printer(), 56, 58)
    blit(room, prop_printer(), 88, 58)
    blit(room, prop_shredder(), 130, 68)
    blit(room, prop_inbox(), 160, 76)
    blit(room, prop_inbox(), 184, 76)
    blit(room, prop_paper_stack(), 214, 78)
    blit(room, prop_paper_stack(), 234, 82)
    blit(room, prop_paper_stack(), 254, 78)
    blit(room, ga.prop_plant(), 278, 70)
    # mail slots wall
    for i in range(5):
        outline_rect(d, [20 + i * 40, 128, 52 + i * 40, 168], D["pr_blue"], P["black"])
        rect(d, [22 + i * 40, 130, 50 + i * 40, 142], D["pr_paper"])
        rect(d, [22 + i * 40, 148, 50 + i * 40, 164], D["pr_yellow"] if i % 2 else D["pr_paper"])
    # waiting bench + extra table
    outline_rect(d, [220, 128, 300, 168], P["metal"], P["black"])
    rect(d, [224, 132, 296, 140], D["pr_paper"])
    blit(room, prop_paper_stack(), 230, 136)
    blit(room, prop_inbox(), 260, 140)
    outline_rect(d, [16, 184, 100, 214], D["pr_machine"], P["black"])
    rect(d, [20, 188, 96, 196], D["pr_paper"])
    blit(room, ga.prop_chair(), 24, 198)
    blit(room, ga.prop_chair(), 56, 198)
    blit(room, ga.prop_plant(), 280, 190)
    blit(room, ga.prop_plant(), 16, 150)
    blit(room, _cast(4, "front", 0), 110, 176)
    blit(room, _cast(3, "side", 0), 200, 178)
    for x, y in [(40, 220), (80, 226), (140, 218), (180, 224), (250, 216), (270, 226)]:
        outline_rect(d, [x, y, x + 16, y + 8], D["pr_paper"], P["black"])
        if (x // 20) % 2:
            rect(d, [x + 2, y + 2, x + 12, y + 4], D["pr_yellow"])
    return room


def room_hallway():
    """楼梯 / 过道 — hutong night corridor + chunky stairs."""
    W, H = 320, 240
    room = new(W, H, P["bg"])
    fill_floor(room, tile_hall_floor())
    d = ImageDraw.Draw(room)
    brick = tile_hall_brick()
    for y in range(0, H, 32):
        blit(room, brick, 0, y)
        blit(room, brick, 288, y)
    for x in range(32, 288, 32):
        blit(room, brick, x, 0)
        blit(room, brick, x, 16)
    rect(d, [32, 46, 287, 50], D["hw_neon"])
    rect(d, [32, 50, 287, 52], D["hw_warn"])
    soft_glow(d, 80, 56, 20, D["hw_neon"], 4)
    soft_glow(d, 240, 56, 20, D["hw_neon"], 4)
    blit(room, prop_neon_exit(), 148, 26)
    blit(room, prop_door(), 36, 50)
    blit(room, prop_door(), 70, 50)
    blit(room, prop_vending(), 236, 52)
    blit(room, prop_vending(), 260, 52)
    blit(room, prop_fire_extinguisher(), 100, 86)
    blit(room, ga.prop_lantern(), 20, 70)
    blit(room, ga.prop_lantern(), 284, 70)
    blit(room, ga.prop_neon_sign(), 118, 56)
    # floor arrows / mats
    for y in (130, 160, 190, 220):
        outline_rect(d, [40, y, 88, y + 10], D["hw_warn"], P["black"])
        rect(d, [44, y + 3, 70, y + 7], D["hw_exit"])
    # stair block (chunky 2.5D)
    for i in range(7):
        y = 210 - i * 16
        x = 96 + i * 12
        outline_rect(d, [x, y, x + 130, y + 18], D["hw_step"], P["black"])
        rect(d, [x + 3, y + 2, x + 127, y + 7], D["hw_step_hi"])
        rect(d, [x + 3, y + 14, x + 127, y + 16], P["black"])
    for i in range(7):
        x = 220 + i * 12
        y = 210 - i * 16
        rect(d, [x, y - 20, x + 3, y + 6], D["hw_rail"])
    rect(d, [220, 190, 300, 193], D["hw_rail"])
    blit(room, ga.prop_plant(), 20, 180)
    blit(room, ga.prop_plant(), 20, 210)
    blit(room, _cast(2, "walk", 0), 150, 148)
    blit(room, gc.draw_npc_passerby("walk", 1), 56, 168)
    blit(room, _cast(6, "side", 0), 200, 188)
    return room


def room_rooftop():
    """天台 — night concrete, city rim, smoke / wind, filled deck."""
    W, H = 320, 240
    room = new(W, H, D["rt_sky"])
    d = ImageDraw.Draw(room)
    for y, c in ((0, D["rt_sky"]), (16, D["rt_sky2"]), (36, (36, 28, 70, 255)), (56, (48, 32, 64, 255))):
        rect(d, [0, y, 319, y + 22], c)
    for x, y in [(12, 8), (28, 18), (50, 6), (74, 16), (98, 9), (130, 20),
                 (160, 7), (188, 18), (210, 5), (236, 14), (258, 8), (290, 16), (310, 10)]:
        d.point((x, y), fill=P["white"])
        if x % 3 == 0:
            d.point((x + 1, y), fill=D["rt_moon"])
    outline_rect(d, [268, 6, 288, 26], D["rt_moon"], P["black"])
    rect(d, [272, 10, 282, 20], P["white"])
    for x, h in [(0, 56), (18, 74), (40, 44), (58, 88), (84, 58), (108, 96),
                 (136, 50), (158, 80), (186, 46), (210, 92), (238, 62), (262, 84), (292, 70)]:
        top = 104 - h // 2
        rect(d, [x, top, x + 24, 108], D["rt_city"])
        outline_rect(d, [x, top, x + 24, 108], D["rt_city"], P["black"])
        for wy in range(top + 4, 106, 7):
            for wx in range(x + 3, x + 22, 5):
                d.point((wx, wy), fill=D["rt_win"] if (wx + wy) % 3 == 0 else P["purple"])
    rect(d, [0, 108, 319, 112], D["rt_ember"])
    floor = tile_roof_floor()
    for y in range(112, H, 32):
        for x in range(0, W, 32):
            blit(room, floor, x, y)
    for x in range(0, W, 40):
        blit(room, prop_railing(), x, 104)
    # deck mat
    outline_rect(d, [100, 148, 250, 220], (70, 72, 80, 255), P["black"])
    rect(d, [106, 154, 244, 214], D["rt_floor2"])
    blit(room, prop_ac_unit(), 8, 130)
    blit(room, prop_ac_unit(), 8, 156)
    blit(room, prop_ac_unit(), 260, 130)
    blit(room, prop_ac_unit(), 284, 156)
    blit(room, prop_water_tank(), 36, 168)
    blit(room, prop_water_tank(), 272, 184)
    # chairs + crate table
    outline_rect(d, [124, 164, 156, 196], D["rt_rail"], P["black"])
    rect(d, [128, 168, 152, 178], P["metal"])
    outline_rect(d, [190, 168, 222, 200], D["rt_rail"], P["black"])
    rect(d, [194, 172, 218, 182], P["metal"])
    outline_rect(d, [158, 176, 186, 198], D["dv_box"], P["black"])
    rect(d, [160, 178, 184, 184], D["dv_tape"])
    blit(room, prop_cigarette(), 168, 168)
    blit(room, prop_coffee_cup(), 172, 172)
    blit(room, ga.prop_plant(), 108, 188)
    blit(room, ga.prop_plant(), 232, 188)
    blit(room, ga.prop_lantern(), 148, 128)
    blit(room, ga.prop_lantern(), 200, 128)
    for x, y in [(70, 124), (90, 130), (210, 122), (230, 128), (250, 124)]:
        rect(d, [x, y, x + 18, y], D["rt_wind"])
        rect(d, [x + 4, y + 3, x + 16, y + 3], D["rt_wind"])
    blit(room, _cast(0, "side", 0), 132, 176)
    blit(room, _cast(7, "front", 0), 196, 184)
    soft_glow(d, 172, 168, 10, D["rt_ember"], 2)
    return room


def room_boss():
    """老板办公室 — burgundy, gold, city window, dense."""
    W, H = 320, 240
    room = new(W, H, D["bs_wall"])
    fill_floor(room, tile_boss_floor())
    d = ImageDraw.Draw(room)
    wall = tile_boss_wall()
    for x in range(0, W, 32):
        blit(room, wall, x, 0)
        blit(room, wall, x, 16)
    for y in range(48, H, 32):
        blit(room, wall, 0, y)
        blit(room, wall, 288, y)
    rect(d, [0, 46, 319, 52], D["bs_gold"])
    rect(d, [0, 52, 319, 54], D["bs_gold_hi"])
    # city window (bigger)
    outline_rect(d, [176, 16, 308, 96], D["bs_gold"], P["black"])
    rect(d, [180, 20, 304, 92], D["bs_glass"])
    rect(d, [240, 20, 242, 92], D["bs_gold"])
    rect(d, [180, 54, 304, 56], D["bs_gold"])
    for y in range(24, 90, 8):
        for x in range(186, 300, 10):
            if (x + y) % 3 == 0:
                d.point((x, y), fill=D["bs_lamp"])
            elif (x + y) % 5 == 0:
                d.point((x, y), fill=P["holo"])
    # carpet first so people sit on it
    outline_rect(d, [56, 148, 250, 222], D["bs_leather_hi"], P["black"])
    rect(d, [62, 154, 244, 216], D["bs_wall"])
    for y in range(160, 210, 12):
        rect(d, [70, y, 236, y], D["bs_leather"])
    blit(room, prop_boss_desk(), 88, 96)
    blit(room, prop_boss_desk(), 88, 104)
    blit(room, prop_chair_leather(), 148, 78)
    blit(room, prop_computer(), 112, 92)
    blit(room, prop_lamp_desk(), 154, 88)
    blit(room, prop_books(), 94, 92)
    blit(room, prop_books(), 178, 94)
    blit(room, prop_award(), 188, 90)
    blit(room, prop_award(), 200, 90)
    blit(room, prop_sofa(), 12, 150)
    blit(room, prop_sofa(), 12, 176)
    blit(room, prop_plant_tall(), 276, 100)
    blit(room, prop_plant_tall(), 292, 140)
    blit(room, prop_plant_tall(), 12, 100)
    blit(room, ga.prop_hologram(), 246, 148)
    blit(room, prop_books(), 20, 140)
    blit(room, ga.prop_plant(), 260, 190)
    blit(room, _cast(3, "front", 0), 64, 172)
    blit(room, _cast(0, "side", 0), 118, 176)
    soft_glow(d, 162, 96, 18, D["bs_lamp"], 3)
    return room


def room_delivery():
    """快递门口 — dusk hutong dock, dense boxes + scooter."""
    W, H = 320, 240
    room = new(W, H, (28, 20, 36, 255))
    fill_floor(room, tile_dock_floor())
    d = ImageDraw.Draw(room)
    brick = tile_hall_brick()
    for y in range(0, H, 32):
        blit(room, brick, 0, y)
        blit(room, brick, 288, y)
    for x in range(32, 288, 32):
        blit(room, brick, x, 0)
        blit(room, brick, x, 16)
    rect(d, [32, 6, 287, 44], (60, 30, 70, 255))
    rect(d, [32, 28, 287, 44], D["dv_dusk"])
    soft_glow(d, 160, 40, 28, D["dv_dusk"], 4)
    # roller shutter
    outline_rect(d, [88, 32, 232, 128], D["dv_door"], P["black"])
    for y in range(38, 124, 5):
        rect(d, [92, y, 228, y + 3], D["dv_door_hi"] if (y // 5) % 2 else D["dv_door"])
    rect(d, [88, 32, 232, 38], D["dv_orange"])
    rect(d, [88, 122, 232, 128], D["dv_orange"])
    blit(room, ga.prop_neon_sign(), 36, 44)
    blit(room, ga.prop_neon_sign(), 252, 44)
    blit(room, ga.prop_lantern(), 64, 52)
    blit(room, ga.prop_lantern(), 240, 52)
    blit(room, ga.prop_lantern(), 20, 80)
    blit(room, ga.prop_lantern(), 292, 80)
    # intercom
    outline_rect(d, [72, 96, 86, 118], P["dark"], P["black"])
    d.point((79, 104), fill=D["hw_exit"])
    d.point((79, 110), fill=D["dv_orange"])
    blit(room, prop_scooter(), 16, 148)
    blit(room, prop_scooter(), 16, 176)
    # box mountains
    for pos in [(80, 150), (100, 164), (120, 152), (140, 168), (88, 180),
                (220, 148), (240, 160), (260, 150), (248, 176), (270, 184),
                (200, 172), (160, 186), (110, 196)]:
        blit(room, prop_parcel() if pos[0] % 20 else prop_parcel_stack(), pos[0], pos[1])
    blit(room, ga.prop_plant(), 292, 190)
    blit(room, ga.prop_plant(), 8, 210)
    blit(room, gc.draw_npc_courier("front", 0), 176, 144)
    blit(room, _cast(0, "front", 0), 148, 176)
    blit(room, gc.draw_npc_passerby("side", 0), 284, 176)
    return room


ROOMS = [
    ("pantry", "茶水间 / 咖啡角", "room_pantry.png", room_pantry),
    ("print", "打印区", "room_print.png", room_print),
    ("hallway", "楼梯 / 过道", "room_hallway.png", room_hallway),
    ("rooftop", "天台", "room_rooftop.png", room_rooftop),
    ("boss", "老板办公室", "room_boss.png", room_boss),
    ("delivery", "快递门口", "room_delivery.png", room_delivery),
]


def gen_rooms():
    thumbs_dir = ASSETS / "rooms" / "thumbs"
    zoom_dir = PREVIEW / "zoomed"
    for sid, _title, fname, fn in ROOMS:
        img = fn()
        save(img, ASSETS / "rooms" / fname)
        save(img, ASSETS / "scenes" / sid / f"scene_{sid}.png")
        save_any(thumb(img), thumbs_dir / fname)
        save_any(zoom(img, 3), zoom_dir / fname)
        save_any(zoom(img, 3), SHOTS / f"{sid}-3x.png")
        # scene-local tiles
        scene_dir = ASSETS / "scenes" / sid
        if sid == "pantry":
            save(tile_pantry_floor(), scene_dir / "floor.png")
            save(tile_pantry_wall(), scene_dir / "wall.png")
        elif sid == "print":
            save(tile_print_floor(), scene_dir / "floor.png")
            save(tile_print_wall(), scene_dir / "wall.png")
        elif sid == "hallway":
            save(tile_hall_floor(), scene_dir / "floor.png")
            save(tile_hall_brick(), scene_dir / "wall.png")
        elif sid == "rooftop":
            save(tile_roof_floor(), scene_dir / "floor.png")
        elif sid == "boss":
            save(tile_boss_floor(), scene_dir / "floor.png")
            save(tile_boss_wall(), scene_dir / "wall.png")
        else:
            save(tile_dock_floor(), scene_dir / "floor.png")


def export_existing_zooms():
    zoom_dir = PREVIEW / "zoomed"
    extras = [
        ASSETS / "rooms" / "room_office.png",
        ASSETS / "rooms" / "room_meeting.png",
        ASSETS / "rooms" / "room_hutong_gate.png",
        ASSETS / "scenes" / "hawaii" / "scene_hawaii.png",
        ASSETS / "scenes" / "popmart" / "scene_popmart.png",
        ASSETS / "scenes" / "restroom" / "scene_restroom.png",
    ]
    for p in extras:
        if p.exists():
            im = Image.open(p).convert("RGBA")
            save_any(zoom(im, 3), zoom_dir / p.name)
            save_any(thumb(im), ASSETS / "rooms" / "thumbs" / p.name)


def contact_sheet(paths, cols, cell_w, cell_h, pad=8):
    rows = (len(paths) + cols - 1) // cols
    W = cols * cell_w + (cols + 1) * pad
    H = rows * cell_h + (rows + 1) * pad
    sheet = new(W, H, (11, 14, 26, 255))
    for i, p in enumerate(paths):
        if not p.exists():
            continue
        im = Image.open(p).convert("RGBA")
        im = im.resize((cell_w, cell_h), Image.Resampling.NEAREST)
        x = pad + (i % cols) * (cell_w + pad)
        y = pad + (i // cols) * (cell_h + pad)
        blit(sheet, im, x, y)
    return sheet


def gen_sheets():
    room_paths = [
        ASSETS / "rooms" / "room_hutong_gate.png",
        ASSETS / "rooms" / "room_office.png",
        ASSETS / "rooms" / "room_meeting.png",
        ASSETS / "scenes" / "hawaii" / "scene_hawaii.png",
        ASSETS / "scenes" / "popmart" / "scene_popmart.png",
        ASSETS / "rooms" / "room_pantry.png",
        ASSETS / "rooms" / "room_print.png",
        ASSETS / "rooms" / "room_hallway.png",
        ASSETS / "rooms" / "room_rooftop.png",
        ASSETS / "rooms" / "room_boss.png",
        ASSETS / "rooms" / "room_delivery.png",
        ASSETS / "scenes" / "restroom" / "scene_restroom.png",
    ]
    sheet = contact_sheet(room_paths, 4, 160, 120, 6)
    save_any(sheet, PREVIEW / "room_sheet.png")
    save_any(zoom(sheet, 2), PREVIEW / "zoomed" / "room_sheet_2x.png")
    save_any(zoom(sheet, 2), SHOTS / "room_sheet_2x.png")

    npc_paths = []
    for nid in ("npc_courier", "npc_barista", "npc_passerby"):
        npc_paths.append(ASSETS / "characters" / nid / "idle_front.png")
    for i in range(1, 9):
        npc_paths.append(ASSETS / "characters" / f"cast_{i:02d}" / "idle_front.png")
    ch = contact_sheet(npc_paths, 11, 64, 64, 6)
    save_any(zoom(ch, 4), PREVIEW / "zoomed" / "cast_npc_sheet_4x.png")


def write_manifest():
    rooms = []
    for sid, title, fname, _ in ROOMS:
        rooms.append({
            "id": sid,
            "title": title,
            "src": f"assets/rooms/{fname}",
            "thumb": f"assets/rooms/thumbs/{fname}",
            "zoom": f"preview/zoomed/{fname}",
            "scene": f"assets/scenes/{sid}/scene_{sid}.png",
        })
    props = []
    for rel, _ in PROP_MAP:
        props.append({"src": f"assets/props/{rel}", "id": rel})
    data = {
        "phase": "1.5-daily-life",
        "heroVariant": "B",
        "rooms": rooms,
        "legacyRooms": [
            {"id": "office", "title": "工位", "src": "assets/rooms/room_office.png"},
            {"id": "meeting", "title": "会议室", "src": "assets/rooms/room_meeting.png"},
            {"id": "gate", "title": "胡同口", "src": "assets/rooms/room_hutong_gate.png"},
        ],
        "namedScenes": [
            {"id": "hawaii", "title": "夏威夷", "src": "assets/scenes/hawaii/scene_hawaii.png"},
            {"id": "popmart", "title": "泡泡玛特店", "src": "assets/scenes/popmart/scene_popmart.png"},
            {"id": "restroom", "title": "厕所", "src": "assets/scenes/restroom/scene_restroom.png"},
        ],
        "props": props,
        "castFrames": [
            "idle_front", "idle_front_1", "idle_side", "idle_back",
            "walk_0", "walk_1", "walk_side_0", "walk_side_1",
            "walk_back_0", "walk_back_1",
        ],
        "npcs": ["npc_courier", "npc_barista", "npc_passerby"],
    }
    path = ASSETS / "manifest.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  wrote {path.relative_to(ROOT)}")


def write_scene_docs():
    docs = {
        "pantry.md": """# 场景：茶水间 / 咖啡角（Pantry）

> 日常公司最像「人还在」的房间。Soul Knight 2.5D，独立世界。

## 场景身份

| 维度 | 本场景 |
|------|--------|
| 地板 | **陶土斜铺暖砖** — 禁止木地板 / 糖果格 / 瓷砖厕 |
| 墙面 | 奶油墙 + 暖色小砖腰线 |
| 光照 | 暖黄吊灯 + 蒸汽高光 |
| 情绪 | 续命、聊天、等咖啡 |

## 布局

- 后墙操作台：咖啡机、热水壶、微波炉、零食架、饮水机
- 中央高桌 + 三凳，两只咖啡杯
- 咖啡师 NPC 站在机旁；cast 在桌边

路径：`public/assets/rooms/room_pantry.png` · `public/assets/scenes/pantry/`
""",
        "print.md": """# 场景：打印区（Print）

> 纸、机器、黄便签。冷荧光办公后勤。

## 场景身份

| 维度 | 本场景 |
|------|--------|
| 地板 | **冷灰油地胶格** |
| 墙面 | 浅灰办公墙 + 蓝踢脚 |
| 光照 | 冷白灯管 |
| 情绪 | 等打印、取文件、碎纸

## 布局

- 后墙复印吧：双打印机、碎纸机、收件盒、纸堆
- 白板草稿
- 一排文件格
- 地上散落纸页

路径：`public/assets/rooms/room_print.png`
""",
        "hallway.md": """# 场景：楼梯 / 过道（Hallway）

> 胡同夜廊 + 2.5D 台阶。连接所有房间的「过场」。

## 场景身份

| 维度 | 本场景 |
|------|--------|
| 地板 | **暗青夜砖** |
| 墙面 | 青砖 + 青色霓虹腰线 |
| 光照 | 青霓虹 + 出口绿灯 |
| 情绪 | 路过、上楼、撞见路人 |

## 布局

- 左侧门 + 灭火器
- 右侧自动贩卖机、灯笼
- 中央斜向台阶 + 栏杆
- 路人 NPC 与行走中的 cast

路径：`public/assets/rooms/room_hallway.png`
""",
        "rooftop.md": """# 场景：天台（Rooftop）

> 夜风、城市剪影、烟点或只是吹风。平行宇宙一天的收束。

## 场景身份

| 维度 | 本场景 |
|------|--------|
| 地板 | **水泥缝混凝土** |
| 墙面 | 夜空 + 窗点城市剪影（无室内墙） |
| 光照 | 月光 + 城市暖窗 + 烟头火星 |
| 情绪 | 下班前透气 / 回避会议 |

## 布局

- 栏杆贴天际线
- 空调外机、水箱
- 两把折叠椅 + 烟头微光 + 风线
- 两名 cast 并肩

路径：`public/assets/rooms/room_rooftop.png`
""",
        "boss.md": """# 场景：老板办公室（Boss）

> 酒红墙、金线、皮椅、城市窗。权力感但仍然是像素游戏房。

## 场景身份

| 维度 | 本场景 |
|------|--------|
| 地板 | **深色人字纹木** |
| 墙面 | 酒红绒墙 + 金线脚线 |
| 光照 | 台灯暖光 + 窗外城市点 |
| 情绪 | 一对一会 / 被叫进去 |

## 布局

- 大班台 + 皮椅 + 电脑/台灯/奖杯/书
- 落地窗城市
- 沙发、高植、全息点缀
- 地毯上的对谈位

路径：`public/assets/rooms/room_boss.png`
""",
        "delivery.md": """# 场景：快递门口（Delivery）

> 黄昏胡同卸货口。一天从「进门」或「取件」开始。

## 场景身份

| 维度 | 本场景 |
|------|--------|
| 地板 | **户外水泥板** |
| 墙面 | 青砖 + 卷帘门 |
| 光照 | 黄昏橙边 + 灯笼 + 招牌 |
| 情绪 | 到了、签收、和骑手擦肩 |

## 布局

- 中央橙色压条卷帘
- 电驴 + 成堆纸箱
- 快递 NPC 抱盒
- 对讲机按钮

路径：`public/assets/rooms/room_delivery.png`
""",
    }
    out = ROOT / "design" / "scenes"
    out.mkdir(parents=True, exist_ok=True)
    for name, text in docs.items():
        p = out / name
        p.write_text(text, encoding="utf-8")
        print(f"  wrote {p.relative_to(ROOT)}")


def main():
    print("Generating daily-company rooms / props / tiles / previews…")
    PREVIEW.mkdir(parents=True, exist_ok=True)
    SHOTS.mkdir(parents=True, exist_ok=True)
    gen_classified_props()
    gen_new_tiles()
    gen_rooms()
    export_existing_zooms()
    gen_sheets()
    write_manifest()
    write_scene_docs()
    print("Done daily life.")


if __name__ == "__main__":
    main()
