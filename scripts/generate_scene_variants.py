#!/usr/bin/env python3
"""Generate Soul Knight–style scene VARIANTS (A/B/C) for Laura to pick.

Style lock: cute chunky 2.5D, clean outlines, charming (not grimy),
readable props, pleasant lighting. Avoid muddy greys + empty rooms.

Outputs:
  public/assets/scenes/{restroom,popmart,hawaii}/variants/{a,b,c}/scene.png
  /workspace/cyber-hutong-shots/variants/*-abc-4x.png + compare-all.png

Trait matrix (also in design/scenes/variants.md):
  A — pastel / cleaner palette, moderate props, soft cool-pleasant light
  B — denser props + warmer light
  C — alternate accent palette + medium density + punchier rim light
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
SHOTS = Path("/workspace/cyber-hutong-shots/variants")

# Reuse shared helpers / hero from generate_assets
sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_assets as ga  # noqa: E402

P = ga.P
new = ga.new
rect = ga.rect
save = ga.save
blit = ga.blit
outline_rect = ga.outline_rect
soft_glow = ga.soft_glow
draw_hero = ga.draw_hero


def save_any(img: Image.Image, path: Path):
    """Save anywhere (repo or /workspace shots); print path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    try:
        print(f"  wrote {path.relative_to(ROOT)}")
    except ValueError:
        print(f"  wrote {path}")



# ---------------------------------------------------------------------------
# Extended palettes per variant (pastel / charming / not muddy)
# ---------------------------------------------------------------------------
VAR = {
    "restroom": {
        "a": {  # mint pastel dungeon-shop toilet
            "floor_a": (210, 235, 230, 255),
            "floor_b": (245, 250, 248, 255),
            "grout": (160, 200, 195, 255),
            "wall": (230, 245, 240, 255),
            "wall_hi": (250, 255, 252, 255),
            "wall_d": (170, 205, 198, 255),
            "stall": (180, 220, 210, 255),
            "stall_d": (120, 175, 165, 255),
            "stall_edge": (60, 110, 105, 255),
            "metal": (150, 175, 185, 255),
            "porcelain": (250, 252, 255, 255),
            "basin": (190, 230, 240, 255),
            "light": (255, 250, 230, 255),
            "light2": (200, 240, 230, 255),
            "accent": (120, 220, 200, 255),
            "accent2": (255, 170, 190, 255),
            "mat": (150, 210, 200, 255),
            "plant": (90, 180, 120, 255),
            "soap": (255, 190, 210, 255),
            "sign": (255, 240, 200, 255),
        },
        "b": {  # warmer peach + denser props
            "floor_a": (245, 225, 215, 255),
            "floor_b": (255, 245, 238, 255),
            "grout": (210, 180, 170, 255),
            "wall": (255, 236, 228, 255),
            "wall_hi": (255, 250, 245, 255),
            "wall_d": (220, 185, 175, 255),
            "stall": (235, 195, 175, 255),
            "stall_d": (190, 140, 120, 255),
            "stall_edge": (120, 75, 60, 255),
            "metal": (175, 160, 155, 255),
            "porcelain": (255, 250, 245, 255),
            "basin": (210, 230, 235, 255),
            "light": (255, 235, 190, 255),
            "light2": (255, 210, 160, 255),
            "accent": (255, 150, 130, 255),
            "accent2": (120, 200, 180, 255),
            "mat": (255, 180, 160, 255),
            "plant": (100, 170, 100, 255),
            "soap": (180, 220, 255, 255),
            "sign": (255, 220, 160, 255),
        },
        "c": {  # lilac / sky cute arcade toilet
            "floor_a": (220, 215, 245, 255),
            "floor_b": (245, 242, 255, 255),
            "grout": (175, 170, 210, 255),
            "wall": (235, 230, 255, 255),
            "wall_hi": (250, 248, 255, 255),
            "wall_d": (180, 175, 220, 255),
            "stall": (190, 185, 235, 255),
            "stall_d": (130, 125, 185, 255),
            "stall_edge": (70, 65, 120, 255),
            "metal": (160, 165, 190, 255),
            "porcelain": (250, 248, 255, 255),
            "basin": (200, 220, 255, 255),
            "light": (255, 245, 255, 255),
            "light2": (200, 190, 255, 255),
            "accent": (170, 140, 255, 255),
            "accent2": (255, 160, 200, 255),
            "mat": (180, 170, 240, 255),
            "plant": (110, 190, 150, 255),
            "soap": (255, 200, 140, 255),
            "sign": (220, 210, 255, 255),
        },
    },
    "popmart": {
        "a": {  # classic candy pink×mint, medium density
            "floor_a": (255, 220, 235, 255),
            "floor_b": (200, 245, 235, 255),
            "grout": (255, 160, 190, 255),
            "wall": (130, 80, 175, 255),
            "wall_hi": (180, 120, 230, 255),
            "neon": (255, 90, 170, 255),
            "neon2": (80, 255, 220, 255),
            "shelf": (255, 248, 252, 255),
            "counter": (255, 180, 205, 255),
            "counter_d": (230, 100, 155, 255),
            "glass": (210, 255, 250, 255),
            "banner": (255, 110, 175, 255),
            "carpet": (255, 150, 190, 255),
        },
        "b": {  # warmer peach candy + denser shelves
            "floor_a": (255, 230, 210, 255),
            "floor_b": (255, 210, 230, 255),
            "grout": (255, 170, 140, 255),
            "wall": (160, 70, 140, 255),
            "wall_hi": (220, 110, 170, 255),
            "neon": (255, 120, 80, 255),
            "neon2": (255, 220, 100, 255),
            "shelf": (255, 250, 240, 255),
            "counter": (255, 200, 160, 255),
            "counter_d": (240, 130, 100, 255),
            "glass": (255, 245, 220, 255),
            "banner": (255, 160, 90, 255),
            "carpet": (255, 190, 140, 255),
        },
        "c": {  # lilac×sky cooler neon, punchy rim
            "floor_a": (230, 220, 255, 255),
            "floor_b": (200, 235, 255, 255),
            "grout": (170, 150, 230, 255),
            "wall": (90, 70, 170, 255),
            "wall_hi": (140, 120, 230, 255),
            "neon": (180, 140, 255, 255),
            "neon2": (100, 220, 255, 255),
            "shelf": (245, 245, 255, 255),
            "counter": (200, 190, 255, 255),
            "counter_d": (130, 110, 210, 255),
            "glass": (220, 240, 255, 255),
            "banner": (150, 130, 255, 255),
            "carpet": (180, 170, 255, 255),
        },
    },
    "hawaii": {
        "a": {  # honey wood + soft cool-warm daylight
            "floor": (210, 170, 120, 255),
            "floor2": (180, 140, 95, 255),
            "plank": (230, 195, 145, 255),
            "gap": (130, 95, 60, 255),
            "wall": (245, 230, 205, 255),
            "wall_d": (210, 185, 155, 255),
            "trim": (150, 115, 75, 255),
            "sun": (255, 245, 200, 255),
            "sun2": (255, 220, 140, 255),
            "desk": (195, 150, 95, 255),
            "desk_hi": (235, 195, 140, 255),
            "desk_edge": (120, 85, 50, 255),
            "chair": (75, 85, 105, 255),
            "chair_hi": (120, 130, 150, 255),
            "blind": (225, 215, 200, 255),
            "blind_d": (160, 150, 135, 255),
            "accent": (90, 190, 170, 255),
        },
        "b": {  # amber warmer + denser desk clutter
            "floor": (200, 145, 90, 255),
            "floor2": (165, 110, 65, 255),
            "plank": (225, 175, 115, 255),
            "gap": (110, 75, 45, 255),
            "wall": (255, 235, 200, 255),
            "wall_d": (230, 195, 150, 255),
            "trim": (160, 110, 60, 255),
            "sun": (255, 240, 170, 255),
            "sun2": (255, 200, 100, 255),
            "desk": (185, 125, 70, 255),
            "desk_hi": (230, 175, 110, 255),
            "desk_edge": (100, 65, 35, 255),
            "chair": (90, 70, 55, 255),
            "chair_hi": (140, 110, 85, 255),
            "blind": (240, 220, 185, 255),
            "blind_d": (175, 150, 115, 255),
            "accent": (255, 150, 100, 255),
        },
        "c": {  # cream-olive cooler rim + plants denser
            "floor": (195, 175, 130, 255),
            "floor2": (160, 140, 100, 255),
            "plank": (220, 200, 155, 255),
            "gap": (120, 105, 70, 255),
            "wall": (240, 235, 215, 255),
            "wall_d": (195, 190, 165, 255),
            "trim": (130, 125, 90, 255),
            "sun": (245, 250, 220, 255),
            "sun2": (220, 230, 160, 255),
            "desk": (170, 150, 105, 255),
            "desk_hi": (210, 190, 145, 255),
            "desk_edge": (95, 85, 55, 255),
            "chair": (70, 95, 85, 255),
            "chair_hi": (110, 140, 125, 255),
            "blind": (215, 220, 200, 255),
            "blind_d": (150, 155, 135, 255),
            "accent": (100, 170, 140, 255),
        },
    },
}

BOX_COLORS = [
    (255, 140, 180, 255),
    (100, 230, 200, 255),
    (255, 220, 90, 255),
    (190, 150, 255, 255),
    (120, 200, 255, 255),
    (255, 160, 80, 255),
    (255, 107, 157, 255),
    (61, 255, 240, 255),
]


def _shadow_ellipse(d, cx, cy, rx, ry, color=(20, 22, 28, 120)):
    for dy in range(-ry, ry + 1):
        for dx in range(-rx, rx + 1):
            if (dx * dx) * ry * ry + (dy * dy) * rx * rx <= rx * rx * ry * ry:
                if (dx + dy) % 2 == 0:
                    d.point((cx + dx, cy + dy), fill=color)


# ========================= RESTROOM =========================
def rr_floor_tile(C: dict) -> Image.Image:
    t = new(32, 32, C["floor_a"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 10):
        for x in range(0, 32, 10):
            c = C["floor_b"] if ((x // 10) + (y // 10)) % 2 == 0 else C["floor_a"]
            rect(d, [x, y, min(x + 9, 31), min(y + 9, 31)], c)
            rect(d, [x, y, min(x + 9, 31), y], C["grout"])
            rect(d, [x, y, x, min(y + 9, 31)], C["grout"])
            # cute sparkle (not wet grim)
            if (x + y) % 20 == 0:
                d.point((x + 3, y + 3), fill=C["light"])
    return t


def rr_wall_tile(C: dict) -> Image.Image:
    t = new(32, 32, C["wall"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 6):
        off = 0 if (y // 6) % 2 == 0 else 8
        for x in range(-8, 40, 16):
            rect(d, [x + off, y, x + off + 14, y + 4], C["wall_hi"])
            rect(d, [x + off, y, x + off + 14, y], C["grout"])
            rect(d, [x + off, y, x + off, y + 4], C["grout"])
            rect(d, [x + off + 1, y + 1, x + off + 4, y + 1], P["white"])
    rect(d, [0, 0, 31, 2], C["wall_d"])
    return t


def rr_stall(C: dict, open_=False) -> Image.Image:
    img = new(48, 64)
    d = ImageDraw.Draw(img)
    # side posts
    outline_rect(d, [0, 6, 4, 60], C["stall"], C["stall_edge"])
    outline_rect(d, [43, 6, 47, 60], C["stall"], C["stall_edge"])
    # header bar
    outline_rect(d, [0, 0, 47, 8], C["metal"], C["stall_edge"])
    rect(d, [2, 2, 45, 5], C["light"])
    if open_:
        # interior back
        rect(d, [6, 10, 36, 56], C["wall_d"])
        # toilet (cute chunky)
        outline_rect(d, [14, 32, 32, 52], C["porcelain"], C["stall_edge"])
        rect(d, [16, 34, 30, 48], C["basin"])
        outline_rect(d, [16, 22, 30, 34], C["porcelain"], C["stall_edge"])
        rect(d, [18, 24, 28, 28], C["light"])
        # door ajar right
        outline_rect(d, [34, 10, 46, 56], C["stall"], C["stall_edge"])
        rect(d, [36, 12, 44, 54], C["stall_d"])
        d.point((42, 32), fill=C["accent2"])
    else:
        outline_rect(d, [5, 10, 42, 56], C["stall"], C["stall_edge"])
        rect(d, [7, 12, 40, 52], C["stall_d"])
        # undercut gap
        rect(d, [7, 52, 40, 56], C["floor_a"])
        # cute lock pill
        outline_rect(d, [32, 28, 40, 36], C["metal"], C["stall_edge"])
        d.point((36, 32), fill=C["accent"])
        # panel lines
        rect(d, [10, 18, 37, 18], C["stall"])
        rect(d, [10, 44, 37, 44], C["stall"])
    return img


def rr_sink(C: dict) -> Image.Image:
    img = new(36, 32)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 12, 33, 28], C["metal"], C["stall_edge"])
    rect(d, [4, 14, 31, 26], C["porcelain"])
    rect(d, [8, 16, 27, 22], C["basin"])
    d.point((17, 18), fill=P["white"])
    # faucet
    outline_rect(d, [15, 2, 20, 14], C["metal"], C["stall_edge"])
    rect(d, [11, 2, 24, 6], C["metal"])
    d.point((17, 1), fill=C["accent"])
    # soap dish
    outline_rect(d, [4, 6, 10, 11], C["soap"], C["stall_edge"])
    d.point((7, 8), fill=P["white"])
    rect(d, [14, 28, 21, 31], C["stall_edge"])
    return img


def rr_mirror(C: dict) -> Image.Image:
    img = new(32, 28)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, 31, 27], C["metal"], C["stall_edge"])
    rect(d, [2, 2, 29, 25], C["light"])
    rect(d, [4, 4, 27, 22], C["basin"])
    # light strip on top
    rect(d, [2, 1, 29, 3], C["light2"])
    for x in (8, 16, 24):
        d.point((x, 2), fill=P["white"])
    return img


def rr_plant_pot(C: dict) -> Image.Image:
    img = new(22, 28)
    d = ImageDraw.Draw(img)
    outline_rect(d, [4, 16, 17, 27], C["porcelain"], C["stall_edge"])
    rect(d, [5, 17, 16, 20], C["accent2"])
    # chunky leaves
    for pts in [(11, 2), (7, 6), (15, 6), (5, 10), (17, 10), (9, 12), (13, 8), (11, 14), (8, 9), (14, 9)]:
        d.point(pts, fill=C["plant"])
    d.point((11, 4), fill=P["green_d"] if "green_d" in P else C["plant"])
    rect(d, [10, 14, 12, 16], C["plant"])
    return img


def rr_mat(C: dict, w=40, h=10) -> Image.Image:
    img = new(w, h)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, w - 1, h - 1], C["mat"], C["stall_edge"])
    for x in range(3, w - 3, 4):
        rect(d, [x, 2, x + 1, h - 3], C["accent"])
    return img


def rr_sign(C: dict) -> Image.Image:
    img = new(28, 20)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, 27, 19], C["sign"], C["stall_edge"])
    rect(d, [2, 2, 25, 17], C["light"])
    # cute emoji-ish mark
    outline_rect(d, [8, 4, 18, 14], C["accent"], C["stall_edge"])
    d.point((11, 8), fill=P["white"])
    d.point((15, 8), fill=P["white"])
    return img


def rr_towel(C: dict) -> Image.Image:
    img = new(14, 18)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 0, 11, 3], C["metal"], C["stall_edge"])
    outline_rect(d, [1, 3, 12, 17], C["accent2"], C["stall_edge"])
    rect(d, [3, 5, 10, 15], C["light"])
    return img



def rr_cabinet(C: dict) -> Image.Image:
    img = new(28, 40)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 4, 27, 39], C["porcelain"], C["stall_edge"])
    rect(d, [2, 6, 25, 12], C["accent"])
    rect(d, [2, 14, 25, 24], C["wall_hi"])
    rect(d, [2, 26, 25, 37], C["wall_hi"])
    outline_rect(d, [10, 18, 16, 20], C["metal"], C["stall_edge"])
    outline_rect(d, [10, 30, 16, 32], C["metal"], C["stall_edge"])
    # bottles on top
    outline_rect(d, [4, 0, 10, 6], C["soap"], C["stall_edge"])
    outline_rect(d, [14, 0, 20, 6], C["accent2"], C["stall_edge"])
    return img


def rr_bench(C: dict) -> Image.Image:
    img = new(56, 20)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 6, 55, 18], C["stall"], C["stall_edge"])
    rect(d, [2, 8, 53, 12], C["stall_d"])
    rect(d, [4, 14, 8, 18], C["metal"])
    rect(d, [47, 14, 51, 18], C["metal"])
    rect(d, [2, 6, 53, 7], C["light"])
    return img


def rr_runner(C: dict, w=60, h=80) -> Image.Image:
    img = new(w, h)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, w - 1, h - 1], C["mat"], C["stall_edge"])
    for y in range(4, h - 4, 8):
        rect(d, [4, y, w - 5, y + 3], C["accent"] if (y // 8) % 2 == 0 else C["light"])
    return img


def rr_dispenser(C: dict) -> Image.Image:
    img = new(18, 22)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 0, 15, 18], C["metal"], C["stall_edge"])
    rect(d, [4, 2, 13, 8], C["light"])
    rect(d, [4, 10, 13, 16], C["accent"])
    d.point((8, 5), fill=C["accent2"])
    rect(d, [6, 18, 11, 21], C["stall_edge"])
    return img


def rr_hanging_lamp(C: dict) -> Image.Image:
    img = new(16, 20)
    d = ImageDraw.Draw(img)
    for y in range(0, 8):
        d.point((8, y), fill=C["metal"])
    outline_rect(d, [2, 8, 13, 18], C["light"], C["stall_edge"])
    rect(d, [4, 10, 11, 16], C["light2"])
    d.point((8, 13), fill=P["white"])
    return img


def gen_restroom_variant(key: str) -> Image.Image:
    C = VAR["restroom"][key]
    dense = key != "a"  # B and C denser; A still filled but lighter
    W, H = 320, 240
    scene = new(W, H, C["wall"])
    floor = rr_floor_tile(C)
    wall = rr_wall_tile(C)
    for y in range(48, H, 32):
        for x in range(0, W, 32):
            blit(scene, floor, x, y)
    d = ImageDraw.Draw(scene)

    for x in range(0, W, 32):
        blit(scene, wall, x, 0)
        blit(scene, wall, x, 16)
    for y in range(48, H, 32):
        blit(scene, wall, 0, y)
        blit(scene, wall, 288, y)

    # pleasant light bar + hanging lamps
    outline_rect(d, [16, 32, 304, 46], C["light"], C["metal"])
    rect(d, [20, 34, 300, 44], C["light2"] if key != "b" else C["light"])
    for gx in (50, 110, 170, 230, 280):
        soft_glow(d, gx, 48, 16, C["light2"], step=3)
    blit(scene, rr_hanging_lamp(C), 70, 28)
    blit(scene, rr_hanging_lamp(C), 150, 28)
    blit(scene, rr_hanging_lamp(C), 250, 28)

    rect(d, [10, 48, 309, 52], C["wall_d"])

    # 4 stalls (chunkier)
    positions = [14, 64, 114, 164]
    for i, x in enumerate(positions):
        blit(scene, rr_stall(C, open_=(i == 2)), x, 44)
        _shadow_ellipse(d, x + 24, 110, 18, 5)

    # big aisle runner + wash mats (kill empty floor)
    blit(scene, rr_runner(C, 48, 90), 80, 120)
    blit(scene, rr_mat(C, 80, 12), 220, 110)
    blit(scene, rr_mat(C, 80, 12), 220, 175)
    if dense:
        blit(scene, rr_mat(C, 56, 10), 20, 175)

    # wash zone: 2 sinks + mirrors + dispensers
    blit(scene, rr_mirror(C), 228, 44)
    blit(scene, rr_mirror(C), 268, 44)
    blit(scene, rr_sink(C), 226, 70)
    blit(scene, rr_sink(C), 266, 70)
    blit(scene, rr_dispenser(C), 210, 68)
    blit(scene, rr_dispenser(C), 304, 68)
    blit(scene, rr_towel(C), 248, 68)

    # left wall life: sign + cabinet + bench
    blit(scene, rr_sign(C), 12, 96)
    blit(scene, rr_cabinet(C), 12, 130)
    blit(scene, rr_bench(C), 50, 200)

    # plants (bigger footprint via multiple)
    blit(scene, rr_plant_pot(C), 196, 86)
    blit(scene, rr_plant_pot(C), 300, 100)
    blit(scene, rr_plant_pot(C), 20, 190)
    blit(scene, rr_plant_pot(C), 160, 200)
    if dense:
        blit(scene, rr_plant_pot(C), 280, 200)
        blit(scene, rr_plant_pot(C), 120, 160)
        # soap shelf
        outline_rect(d, [210, 128, 250, 170], C["porcelain"], C["stall_edge"])
        rect(d, [212, 130, 248, 138], C["accent"])
        for i, ck in enumerate([C["soap"], C["accent2"], C["accent"], C["light2"]]):
            outline_rect(d, [214 + (i % 2) * 16, 142 + (i // 2) * 12,
                             226 + (i % 2) * 16, 152 + (i // 2) * 12], ck, C["stall_edge"])
        # cute floor stickers
        for x, y in [(70, 140), (100, 155), (140, 145), (180, 160), (60, 165)]:
            outline_rect(d, [x, y, x + 12, y + 8], C["accent2"], C["stall_edge"])
            d.point((x + 5, y + 3), fill=P["white"])
        # wall shelf bottles above stalls gap
        for i, ck in enumerate([C["soap"], C["accent"], C["accent2"]]):
            outline_rect(d, [30 + i * 14, 36, 40 + i * 14, 46], ck, C["stall_edge"])

    # pastel trash
    outline_rect(d, [294, 145, 314, 192], C["metal"], C["stall_edge"])
    rect(d, [296, 147, 312, 156], C["accent"])
    rect(d, [298, 160, 310, 188], C["wall_hi"])

    # sparkles
    for pts in [(95, 195), (145, 185), (200, 195), (255, 205), (55, 155), (175, 125)]:
        d.point(pts, fill=C["light"])
        d.point((pts[0] + 1, pts[1]), fill=C["accent2"])

    for y in range(118, 200, 5):
        d.point((214, y), fill=C["grout"])

    rect(d, [6, 110, 10, 165], C["accent"])
    outline_rect(d, [12, 118, 38, 142], C["sign"], C["stall_edge"])
    rect(d, [14, 120, 36, 140], C["light"])

    blit(scene, draw_hero(3), 230, 145)
    return scene


# ========================= POPMART =========================
def pm_floor_tile(C: dict) -> Image.Image:
    t = new(32, 32, C["floor_a"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 16):
        for x in range(0, 32, 16):
            c = C["floor_a"] if ((x // 16) + (y // 16)) % 2 == 0 else C["floor_b"]
            rect(d, [x, y, x + 15, y + 15], c)
            rect(d, [x, y, x + 15, y], C["grout"])
            rect(d, [x, y, x, y + 15], C["grout"])
    d.point((5, 5), fill=P["white"])
    d.point((21, 21), fill=C["neon2"])
    return t


def pm_wall_tile(C: dict) -> Image.Image:
    t = new(32, 32, C["wall"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 31, 6], C["wall_hi"])
    rect(d, [0, 7, 31, 8], C["neon"])
    for y in range(10, 28, 8):
        rect(d, [2, y, 14, y + 5], C["neon"])
        rect(d, [17, y, 29, y + 5], C["neon2"])
        rect(d, [3, y + 1, 13, y + 2], P["white"])
        rect(d, [18, y + 1, 28, y + 2], P["white"])
    rect(d, [0, 30, 31, 31], C["neon2"])
    return t


def pm_box(color, qmark=True) -> Image.Image:
    img = new(16, 16)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 1, 14, 14], color, P["black"])
    rect(d, [2, 2, 13, 4], P["white"])
    rect(d, [3, 5, 12, 12], P["white"])
    if qmark:
        rect(d, [6, 6, 9, 7], P["purple"])
        rect(d, [8, 7, 9, 9], P["purple"])
        d.point((7, 11), fill=P["purple"])
    rect(d, [14, 3, 15, 14], P["dark"])
    return img


def pm_box_open() -> Image.Image:
    img = new(16, 20)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 10, 13, 18], BOX_COLORS[2], P["black"])
    rect(d, [3, 11, 12, 17], P["white"])
    rect(d, [1, 6, 4, 11], BOX_COLORS[2])
    rect(d, [11, 6, 14, 11], BOX_COLORS[2])
    rect(d, [4, 5, 11, 8], BOX_COLORS[1])
    # figure peek
    outline_rect(d, [5, 1, 10, 12], P["black"], P["black"])
    rect(d, [6, 2, 9, 5], P["skin"])
    d.point((7, 3), fill=P["holo"])
    d.point((8, 3), fill=P["neon_p"])
    return img


def pm_figure() -> Image.Image:
    img = new(16, 24)
    d = ImageDraw.Draw(img)
    _shadow_ellipse(d, 8, 22, 5, 2)
    outline_rect(d, [5, 10, 10, 18], BOX_COLORS[3], P["black"])
    rect(d, [6, 11, 9, 17], P["purple"])
    outline_rect(d, [4, 3, 11, 10], P["skin"], P["black"])
    rect(d, [4, 2, 11, 5], P["hair"])
    d.point((6, 6), fill=P["holo"])
    d.point((9, 6), fill=P["holo"])
    rect(d, [5, 18, 7, 21], P["dark"])
    rect(d, [8, 18, 10, 21], P["dark"])
    return img


def pm_shelf(C: dict, tall=False) -> Image.Image:
    h = 64 if tall else 56
    w = 48 if tall else 56
    img = new(w, h)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, w - 1, h - 1], C["shelf"], P["black"])
    rect(d, [2, 2, w - 3, 6], C["neon"])
    rows = 5 if tall else 3
    cols = 3 if tall else 4
    for row in range(rows):
        y = 8 + row * ((h - 14) // rows)
        rect(d, [2, y + 10, w - 3, y + 12], C["wall"])
        for col in range(cols):
            x = 4 + col * ((w - 8) // cols)
            c = BOX_COLORS[(row * cols + col) % len(BOX_COLORS)]
            outline_rect(d, [x, y, x + 10, y + 9], c, P["black"])
            rect(d, [x + 1, y + 1, x + 9, y + 2], P["white"])
            d.point((x + 5, y + 5), fill=P["purple"])
    return img


def pm_counter(C: dict) -> Image.Image:
    img = new(88, 44)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 14, 85, 42], C["counter"], P["black"])
    rect(d, [4, 16, 83, 40], C["counter_d"])
    outline_rect(d, [4, 2, 83, 16], C["glass"], C["neon2"])
    rect(d, [6, 4, 81, 12], P["white"])
    rect(d, [2, 14, 85, 15], C["neon"])
    rect(d, [14, 22, 36, 34], C["wall"])
    rect(d, [52, 22, 74, 34], C["wall"])
    d.point((25, 28), fill=C["neon2"])
    d.point((63, 28), fill=C["neon2"])
    return img


def pm_balloon(C: dict, color) -> Image.Image:
    img = new(12, 20)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 1, 10, 12], color, P["black"])
    rect(d, [3, 3, 8, 5], P["white"])
    for y in range(12, 19):
        d.point((6, y), fill=P["dark"])
    return img


def pm_carpet(C: dict) -> Image.Image:
    img = new(64, 20)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, 63, 19], C["carpet"], P["black"])
    for x in range(4, 60, 8):
        rect(d, [x, 4, x + 4, 15], C["neon2"])
    return img


def gen_popmart_variant(key: str) -> Image.Image:
    C = VAR["popmart"][key]
    dense = key == "b"
    W, H = 320, 240
    scene = new(W, H, C["wall"])
    floor = pm_floor_tile(C)
    for y in range(56, H, 32):
        for x in range(0, W, 32):
            blit(scene, floor, x, y)
    d = ImageDraw.Draw(scene)
    wall = pm_wall_tile(C)
    for x in range(0, W, 32):
        blit(scene, wall, x, 0)
        blit(scene, wall, x, 20)

    # neon strips
    rect(d, [0, 52, 319, 54], C["neon"])
    rect(d, [0, 55, 319, 56], C["neon2"])
    soft_glow(d, 80, 58, 22, C["neon"], step=3)
    soft_glow(d, 240, 58, 22, C["neon2"], step=3)

    shelf = pm_shelf(C, tall=False)
    wall_s = pm_shelf(C, tall=True)
    blit(scene, wall_s, 4, 36)
    blit(scene, wall_s, 268, 36)
    blit(scene, shelf, 64, 32)
    blit(scene, shelf, 148, 32)
    if dense or key == "c":
        # extra mid shelf row
        blit(scene, shelf, 100, 88)

    # marquee
    outline_rect(d, [96, 56, 224, 78], C["wall_hi"], P["black"])
    rect(d, [100, 60, 220, 74], C["banner"])
    for x in range(108, 212, 14):
        rect(d, [x, 62, x + 8, 72], P["white"])
        d.point((x + 4, 67), fill=C["neon2"])

    # carpet runner
    blit(scene, pm_carpet(C), 128, 200)

    counter = pm_counter(C)
    blit(scene, counter, 116, 128)
    for i, c in enumerate(BOX_COLORS[:5]):
        blit(scene, pm_box(c), 124 + i * 14, 118)

    # floor boxes + unbox moment
    blit(scene, pm_box(BOX_COLORS[5]), 32, 158)
    blit(scene, pm_box(BOX_COLORS[1]), 48, 170)
    blit(scene, pm_box(BOX_COLORS[2]), 40, 184)
    blit(scene, pm_box_open(), 208, 116)
    blit(scene, pm_figure(), 236, 148)

    if dense:
        blit(scene, pm_box(BOX_COLORS[3]), 70, 200)
        blit(scene, pm_box(BOX_COLORS[0]), 86, 208)
        blit(scene, pm_box(BOX_COLORS[4]), 280, 170)
        blit(scene, pm_balloon(C, C["neon"]), 60, 100)
        blit(scene, pm_balloon(C, C["neon2"]), 250, 96)
        blit(scene, pm_balloon(C, BOX_COLORS[2]), 160, 100)
        # hanging price tags
        for x in (80, 170, 250):
            outline_rect(d, [x, 86, x + 12, 96], C["neon2"], P["black"])
    if key == "c":
        blit(scene, pm_balloon(C, C["neon"]), 40, 110)
        blit(scene, pm_balloon(C, C["neon2"]), 290, 110)
        # rim light floor dots
        for x in range(20, 300, 16):
            d.point((x, 226), fill=C["neon"] if (x // 16) % 2 else C["neon2"])

    # path lights
    for x in range(16, 304, 18):
        d.point((x, 216), fill=C["neon"] if (x // 18) % 2 else C["neon2"])

    blit(scene, draw_hero(0), 90, 168)
    return scene


# ========================= HAWAII =========================
def hw_floor_tile(C: dict) -> Image.Image:
    t = new(32, 32, C["floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 8):
        base = C["plank"] if (y // 8) % 2 == 0 else C["floor"]
        rect(d, [0, y, 31, y + 7], base)
        rect(d, [0, y + 7, 31, y + 7], C["gap"])
        for x in (8, 20):
            off = 4 if (y // 8) % 2 else 0
            rect(d, [x + off, y, x + off, y + 6], C["floor2"])
        d.point((4, y + 2), fill=C["sun"])
        d.point((18, y + 4), fill=C["desk_hi"])
    return t


def hw_wall_tile(C: dict) -> Image.Image:
    t = new(32, 32, C["wall"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 31, 4], C["wall_d"])
    rect(d, [0, 28, 31, 31], C["trim"])
    for x in range(4, 28, 6):
        d.point((x, 12), fill=C["wall_d"])
    return t


def hw_blind(C: dict) -> Image.Image:
    t = new(32, 32, C["blind"])
    d = ImageDraw.Draw(t)
    for y in range(2, 30, 4):
        rect(d, [2, y, 29, y + 2], C["blind_d"])
        rect(d, [2, y, 29, y], P["white"])
    rect(d, [15, 0, 16, 31], C["trim"])
    d.point((15, 30), fill=C["accent"])
    return t


def hw_chair(C: dict, jacket=False) -> Image.Image:
    img = new(28, 32)
    d = ImageDraw.Draw(img)
    _shadow_ellipse(d, 14, 30, 10, 3)
    # back
    outline_rect(d, [6, 2, 21, 18], C["chair"], P["black"])
    rect(d, [8, 4, 19, 16], C["chair_hi"])
    # mesh lines
    for y in range(6, 16, 3):
        rect(d, [9, y, 18, y], C["chair"])
    # seat
    outline_rect(d, [4, 16, 23, 24], C["chair"], P["black"])
    rect(d, [6, 18, 21, 22], C["chair_hi"])
    # legs
    rect(d, [7, 24, 9, 30], P["metal"])
    rect(d, [18, 24, 20, 30], P["metal"])
    if jacket:
        outline_rect(d, [10, 6, 20, 16], P["jacket"], P["black"])
        rect(d, [12, 8, 18, 14], C["accent"])
    return img


def hw_laptop() -> Image.Image:
    img = new(20, 14)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 0, 17, 10], P["dark"], P["black"])
    rect(d, [4, 2, 15, 8], P["screen"])
    d.point((6, 4), fill=P["holo"])
    outline_rect(d, [0, 10, 19, 13], P["metal"], P["black"])
    return img


def hw_thermos(C: dict) -> Image.Image:
    img = new(10, 16)
    d = ImageDraw.Draw(img)
    outline_rect(d, [2, 2, 7, 15], C["accent"], P["black"])
    rect(d, [3, 0, 6, 3], P["metal"])
    rect(d, [3, 5, 6, 7], P["white"])
    return img


def hw_folders() -> Image.Image:
    img = new(16, 12)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 2, 14, 11], P["blue_folder"], P["black"])
    rect(d, [2, 0, 12, 4], P["white"])
    rect(d, [1, 4, 13, 5], P["lantern"])
    return img


def hw_plant(C: dict) -> Image.Image:
    img = new(16, 20)
    d = ImageDraw.Draw(img)
    outline_rect(d, [3, 12, 12, 19], P["white"], P["black"])
    rect(d, [4, 13, 11, 15], C["accent"])
    for pts in [(8, 2), (5, 6), (11, 6), (7, 9), (9, 5), (4, 10), (12, 10)]:
        d.point(pts, fill=P["green"])
    d.point((8, 4), fill=P["green_d"])
    return img


def hw_mug(C: dict) -> Image.Image:
    img = new(10, 10)
    d = ImageDraw.Draw(img)
    outline_rect(d, [1, 2, 7, 9], P["white"], P["black"])
    rect(d, [2, 3, 6, 5], C["accent"])
    rect(d, [7, 4, 9, 7], P["metal"])
    return img


def hw_poster(C: dict) -> Image.Image:
    img = new(20, 24)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, 19, 23], C["desk_hi"], P["black"])
    rect(d, [2, 2, 17, 21], C["sun"])
    rect(d, [4, 4, 15, 10], C["accent"])
    rect(d, [4, 12, 15, 18], C["desk"])
    return img



def hw_rug(C: dict) -> Image.Image:
    img = new(72, 160)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 0, 71, 159], C["accent"], P["black"])
    rect(d, [3, 3, 68, 156], C["sun"])
    for y in range(10, 150, 16):
        rect(d, [8, y, 63, y + 6], C["desk_hi"])
    return img


def hw_side_table(C: dict) -> Image.Image:
    img = new(36, 28)
    d = ImageDraw.Draw(img)
    outline_rect(d, [0, 8, 35, 26], C["desk"], C["desk_edge"])
    rect(d, [2, 10, 33, 14], C["desk_hi"])
    rect(d, [4, 20, 6, 26], P["metal"])
    rect(d, [28, 20, 30, 26], P["metal"])
    return img


def gen_hawaii_variant(key: str) -> Image.Image:
    C = VAR["hawaii"][key]
    dense = key != "a"
    W, H = 320, 288
    scene = new(W, H, C["wall"])
    floor = hw_floor_tile(C)
    for y in range(56, H, 32):
        for x in range(0, W, 32):
            blit(scene, floor, x, y)
    d = ImageDraw.Draw(scene)

    wall = hw_wall_tile(C)
    blind = hw_blind(C)
    for y in range(56, H):
        rect(d, [0, y, 10, y], C["wall_d"])
        rect(d, [309, y, 319, y], C["wall_d"])
    for x in range(0, W, 32):
        blit(scene, wall, x, 0)
        blit(scene, blind, x, 8)
        blit(scene, blind, x, 28)
    rect(d, [0, 56, 319, 62], C["trim"])
    rect(d, [0, 56, 319, 58], C["desk_hi"])

    # stronger sun shafts
    for i, x0 in enumerate([30, 80, 130, 180, 230, 280]):
        for k in range(0, 110, 2):
            xx = x0 + k // 3
            yy = 64 + k
            if 12 < xx < 305 and yy < 270:
                col = C["sun"] if k % 4 == 0 else C["sun2"]
                if key == "c" and k % 8 == 0:
                    col = C["accent"]
                d.point((xx, yy), fill=col)

    # window long desk with clutter
    outline_rect(d, [18, 64, 302, 92], C["desk"], C["desk_edge"])
    rect(d, [20, 66, 300, 74], C["desk_hi"])
    rect(d, [20, 88, 300, 90], C["desk_edge"])

    # rug under seating column
    blit(scene, hw_rug(C), 178, 90)

    # vertical desk — 3 seats
    dx = 112
    outline_rect(d, [dx, 78, dx + 66, 268], C["desk"], C["desk_edge"])
    rect(d, [dx + 2, 80, dx + 64, 88], C["desk_hi"])
    rect(d, [dx, 78, dx + 8, 268], C["desk_edge"])
    for ly in (112, 180, 248):
        rect(d, [dx + 10, ly, dx + 12, ly + 8], P["metal"])
        rect(d, [dx + 52, ly, dx + 54, ly + 8], P["metal"])
        rect(d, [dx + 10, ly - 22, dx + 58, ly - 20], C["desk_hi"])

    chairs = [
        (dx + 70, 88, False),
        (dx + 70, 156, True),
        (dx + 70, 224, False),
    ]
    for x, y, jk in chairs:
        blit(scene, hw_chair(C, jacket=jk), x, y)

    # desk props per seat
    blit(scene, hw_laptop(), dx + 16, 94)
    blit(scene, hw_mug(C), dx + 42, 100)
    blit(scene, hw_thermos(C), dx + 48, 158)
    blit(scene, hw_laptop(), dx + 14, 166)
    blit(scene, hw_folders(), dx + 14, 236)
    blit(scene, hw_mug(C), dx + 48, 242)
    blit(scene, hw_laptop(), dx + 16, 210)

    # window sill plants / clutter
    blit(scene, hw_plant(C), 40, 66)
    blit(scene, hw_plant(C), 260, 66)
    blit(scene, hw_plant(C), dx + 44, 80)
    blit(scene, hw_laptop(), 70, 70)
    blit(scene, hw_thermos(C), 100, 72)
    blit(scene, hw_folders(), 200, 70)

    # left zone fill
    blit(scene, hw_poster(C), 14, 100)
    blit(scene, hw_side_table(C), 20, 160)
    blit(scene, hw_plant(C), 28, 148)
    blit(scene, hw_folders(), 24, 200)
    blit(scene, hw_mug(C), 40, 175)

    if dense:
        blit(scene, hw_plant(C), 280, 170)
        blit(scene, hw_plant(C), 292, 100)
        blit(scene, hw_plant(C), 50, 230)
        blit(scene, hw_plant(C), 250, 250)
        blit(scene, hw_poster(C), 290, 200)
        blit(scene, hw_side_table(C), 250, 120)
        blit(scene, hw_thermos(C), 260, 112)
        blit(scene, hw_folders(), 256, 140)
        for x, y, col in [
            (dx + 10, 130, C["accent"]),
            (dx + 52, 130, C["sun2"]),
            (dx + 10, 200, P["neon_p"]),
            (dx + 52, 200, C["accent"]),
            (30, 80, C["sun2"]),
        ]:
            outline_rect(d, [x, y, x + 8, y + 8], col, P["black"])

    for x, y in [(50, 210), (90, 255), (210, 270), (280, 220), (160, 140), (70, 120)]:
        d.point((x, y), fill=C["sun"])

    rect(d, [14, 130, 16, 220], C["accent"])
    blit(scene, draw_hero(1), 248, 175)
    return scene


# ========================= IO / sheets =========================
def upscale(img: Image.Image, n: int = 4) -> Image.Image:
    return img.resize((img.width * n, img.height * n), Image.NEAREST)


def label_bar(text: str, w: int, color=(40, 36, 50, 255)) -> Image.Image:
    bar = new(w, 16, color)
    d = ImageDraw.Draw(bar)
    # tiny pixel font via blocks — just colored strip with letter marks
    # draw simple A/B/C glyphs
    x = 6
    for ch in text[:12]:
        if ch == " ":
            x += 4
            continue
        # 3x5 block letter approximation
        rect(d, [x, 4, x + 2, 12], P["white"])
        x += 5
    return bar


def sheet_abc(scenes: dict[str, Image.Image], title: str) -> Image.Image:
    """Horizontal A|B|C sheet with labels, already native res; caller upscales."""
    # pad hawaii (taller) vs others
    h = max(im.height for im in scenes.values())
    w = scenes["a"].width
    gap = 8
    label_h = 14
    out = new(w * 3 + gap * 4, h + label_h + gap * 2 + 8, (20, 22, 28, 255))
    d = ImageDraw.Draw(out)
    # title strip
    rect(d, [0, 0, out.width - 1, label_h - 1], (60, 50, 90, 255))
    for i, ch in enumerate(title[:24]):
        d.point((8 + i * 3, 6), fill=P["lantern"])

    labels = {"a": "A", "b": "B", "c": "C"}
    for i, key in enumerate(["a", "b", "c"]):
        x = gap + i * (w + gap)
        y = label_h + gap
        # label pill
        outline_rect(d, [x, y, x + 20, y + 12], P["purple"], P["black"])
        # mark A/B/C
        rect(d, [x + 6, y + 3, x + 14, y + 9], P["white"])
        blit(out, scenes[key], x, y + 14)
        # thin frame
        d.rectangle([x - 1, y + 13, x + w, y + 13 + scenes[key].height], outline=P["holo"])
    return out


def compare_all(sheets: dict[str, Image.Image]) -> Image.Image:
    """Stack restroom / popmart / hawaii ABC sheets vertically."""
    gap = 12
    ws = [im.width for im in sheets.values()]
    hs = [im.height for im in sheets.values()]
    W = max(ws)
    H = sum(hs) + gap * (len(sheets) + 1)
    out = new(W, H, (12, 14, 22, 255))
    y = gap
    for key in ("restroom", "popmart", "hawaii"):
        im = sheets[key]
        x = (W - im.width) // 2
        blit(out, im, x, y)
        y += im.height + gap
    return out


def write_variant(scene: str, key: str, img: Image.Image):
    out = ASSETS / "scenes" / scene / "variants" / key / "scene.png"
    save(img, out)


def main():
    print("Generating Soul Knight scene variants A/B/C…")
    SHOTS.mkdir(parents=True, exist_ok=True)

    rest = {k: gen_restroom_variant(k) for k in "abc"}
    pop = {k: gen_popmart_variant(k) for k in "abc"}
    haw = {k: gen_hawaii_variant(k) for k in "abc"}

    for k, im in rest.items():
        write_variant("restroom", k, im)
    for k, im in pop.items():
        write_variant("popmart", k, im)
    for k, im in haw.items():
        write_variant("hawaii", k, im)

    # also write separate 4x per variant for close look
    for scene, mapping in (("restroom", rest), ("popmart", pop), ("hawaii", haw)):
        for k, im in mapping.items():
            u = upscale(im, 4)
            save_any(u, SHOTS / f"{scene}-{k}-4x.png")

    sheet_rr = sheet_abc(rest, "RESTROOM A B C")
    sheet_pm = sheet_abc(pop, "POPMART A B C")
    sheet_hw = sheet_abc(haw, "HAWAII A B C")
    save_any(upscale(sheet_rr, 4), SHOTS / "restroom-abc-4x.png")
    save_any(upscale(sheet_pm, 4), SHOTS / "popmart-abc-4x.png")
    save_any(upscale(sheet_hw, 4), SHOTS / "hawaii-abc-4x.png")

    # compare-all at 2x (4x of full stack is huge)
    compare = compare_all({"restroom": sheet_rr, "popmart": sheet_pm, "hawaii": sheet_hw})
    save_any(upscale(compare, 2), SHOTS / "compare-all.png")
    # also a 3x for gallery viewing
    save_any(upscale(compare, 3), SHOTS / "compare-all-3x.png")

    print("Done. Variants + shots written.")


if __name__ == "__main__":
    main()
