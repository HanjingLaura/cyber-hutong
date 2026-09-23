#!/usr/bin/env python3
"""Generate 8 Soul Knight–style chibi cast sprites for 赛博胡同.

Stylized game avatars from hair/outfit cues — NOT photoreal likenesses.
32×32 · large head / small body · thick outline · readable at small size.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets" / "characters"
SHOTS = Path("/workspace/cyber-hutong-shots")

C = {
    "trans": (0, 0, 0, 0),
    "outline": (14, 12, 18, 255),
    "shadow": (8, 8, 14, 160),
    "skin": (236, 198, 168, 255),
    "skin_d": (210, 160, 130, 255),
    "skin_fair": (244, 214, 190, 255),
    "eye": (22, 20, 28, 255),
    "eye_hi": (250, 248, 240, 255),
    "blush": (236, 130, 140, 255),
    "hair_dk": (32, 24, 28, 255),
    "hair_mid": (58, 42, 36, 255),
    "hair_tip": (186, 140, 92, 255),
    "hair_tip2": (154, 114, 74, 255),
    "charcoal": (78, 82, 90, 255),
    "charcoal_d": (52, 54, 62, 255),
    "charcoal_hi": (110, 114, 122, 255),
    "black": (24, 26, 32, 255),
    "black_hi": (48, 50, 58, 255),
    "white": (245, 240, 230, 255),
    "white_d": (200, 196, 186, 255),
    "stripe_red": (216, 44, 52, 255),
    "stripe_w": (245, 240, 230, 255),
    "blue_collar": (150, 168, 186, 255),
    "pants": (50, 54, 68, 255),
    "shoe": (26, 26, 32, 255),
    "metal": (168, 176, 192, 255),
    "tee_dk": (38, 40, 48, 255),
}


def new(w=32, h=32):
    return Image.new("RGBA", (w, h), C["trans"])


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print(f"  wrote {path}")


def shadow(d, cx=16, cy=29, w=11):
    for dx in range(-(w // 2), w // 2 + 1):
        for dy in range(-2, 3):
            if abs(dx) / max(w / 2, 1) + abs(dy) / 2.3 < 1.05:
                d.point((cx + dx, cy + dy), fill=C["shadow"])


def face(d, cx, hy, skin):
    """Large chibi head face plate (visible center). hy = crown of face fill."""
    # outline box
    d.rectangle([cx - 5, hy, cx + 4, hy + 9], fill=C["outline"])
    d.rectangle([cx - 4, hy + 1, cx + 3, hy + 8], fill=skin)
    # chin
    d.rectangle([cx - 3, hy + 8, cx + 2, hy + 9], fill=skin)
    # eyes (symmetric, readable)
    d.point((cx - 3, hy + 4), fill=C["eye"])
    d.point((cx - 2, hy + 4), fill=C["eye"])
    d.point((cx + 1, hy + 4), fill=C["eye"])
    d.point((cx + 2, hy + 4), fill=C["eye"])
    # tiny highlights above pupils (do not replace eye pixels)
    d.point((cx - 3, hy + 3), fill=C["eye_hi"])
    d.point((cx + 1, hy + 3), fill=C["eye_hi"])
    # blush
    d.point((cx - 4, hy + 6), fill=C["blush"])
    d.point((cx + 3, hy + 6), fill=C["blush"])


def legs_front(d, cx, fy, frame=0):
    bob = 1 if frame % 4 == 1 else 0
    d.rectangle([cx - 3, fy + bob, cx - 1, fy + 4 + bob], fill=C["pants"])
    d.rectangle([cx + 1, fy + bob, cx + 3, fy + 4 + bob], fill=C["pants"])
    d.rectangle([cx - 4, fy + 4 + bob, cx - 1, fy + 5 + bob], fill=C["shoe"])
    d.rectangle([cx + 1, fy + 4 + bob, cx + 4, fy + 5 + bob], fill=C["shoe"])
    # outline feet
    for x in (cx - 4, cx + 4):
        d.point((x, fy + 5 + bob), fill=C["outline"])


def legs_walk(d, cx, fy, frame=0):
    if frame % 2 == 0:
        d.rectangle([cx - 4, fy, cx - 2, fy + 4], fill=C["pants"])
        d.rectangle([cx + 1, fy + 1, cx + 3, fy + 5], fill=C["pants"])
        d.rectangle([cx - 5, fy + 4, cx - 2, fy + 5], fill=C["shoe"])
        d.rectangle([cx + 1, fy + 5, cx + 4, fy + 6], fill=C["shoe"])
    else:
        d.rectangle([cx - 4, fy + 1, cx - 2, fy + 5], fill=C["pants"])
        d.rectangle([cx + 1, fy, cx + 3, fy + 4], fill=C["pants"])
        d.rectangle([cx - 5, fy + 5, cx - 2, fy + 6], fill=C["shoe"])
        d.rectangle([cx + 1, fy + 4, cx + 4, fy + 5], fill=C["shoe"])


def legs_side(d, cx, fy):
    d.rectangle([cx - 1, fy, cx + 1, fy + 4], fill=C["pants"])
    d.rectangle([cx - 2, fy + 4, cx + 2, fy + 5], fill=C["shoe"])


def legs_side_walk(d, cx, fy, frame=0):
    """Side-view walk: leading/trailing foot swap."""
    if frame % 2 == 0:
        d.rectangle([cx - 3, fy + 1, cx - 1, fy + 5], fill=C["pants"])
        d.rectangle([cx, fy, cx + 2, fy + 4], fill=C["pants"])
        d.rectangle([cx - 4, fy + 5, cx - 1, fy + 6], fill=C["shoe"])
        d.rectangle([cx + 1, fy + 4, cx + 4, fy + 5], fill=C["shoe"])
    else:
        d.rectangle([cx - 3, fy, cx - 1, fy + 4], fill=C["pants"])
        d.rectangle([cx, fy + 1, cx + 2, fy + 5], fill=C["pants"])
        d.rectangle([cx - 4, fy + 4, cx - 1, fy + 5], fill=C["shoe"])
        d.rectangle([cx + 1, fy + 5, cx + 4, fy + 6], fill=C["shoe"])


def arms(d, cx, by, sleeve, frame=0):
    ay = by + 2 + (frame % 2)
    # left
    d.rectangle([cx - 7, ay, cx - 5, ay + 5], fill=C["outline"])
    d.rectangle([cx - 6, ay + 1, cx - 5, ay + 4], fill=sleeve)
    d.point((cx - 6, ay + 5), fill=C["skin"])
    # right
    d.rectangle([cx + 4, ay, cx + 6, ay + 5], fill=C["outline"])
    d.rectangle([cx + 4, ay + 1, cx + 5, ay + 4], fill=sleeve)
    d.point((cx + 5, ay + 5), fill=C["skin"])


# ---- bodies ----
def body_blazer(d, cx, by):
    d.rectangle([cx - 6, by, cx + 5, by + 8], fill=C["outline"])
    d.rectangle([cx - 5, by + 1, cx + 4, by + 7], fill=C["charcoal"])
    d.rectangle([cx - 1, by + 1, cx, by + 7], fill=C["black"])  # open over black
    d.point((cx - 3, by + 2), fill=C["charcoal_hi"])
    d.point((cx + 2, by + 2), fill=C["charcoal_hi"])
    d.rectangle([cx - 6, by + 1, cx - 5, by + 3], fill=C["charcoal"])
    d.rectangle([cx + 4, by + 1, cx + 5, by + 3], fill=C["charcoal"])


def body_dark_top(d, cx, by):
    d.rectangle([cx - 5, by, cx + 4, by + 8], fill=C["outline"])
    d.rectangle([cx - 4, by + 1, cx + 3, by + 7], fill=C["black"])
    d.rectangle([cx - 3, by + 2, cx + 2, by + 3], fill=C["black_hi"])
    d.point((cx - 1, by + 1), fill=C["skin"])
    d.point((cx, by + 1), fill=C["skin"])


def body_black_tee(d, cx, by):
    d.rectangle([cx - 5, by, cx + 4, by + 8], fill=C["outline"])
    d.rectangle([cx - 4, by + 1, cx + 3, by + 7], fill=C["tee_dk"])
    d.point((cx - 1, by + 1), fill=C["skin"])
    d.point((cx, by + 1), fill=C["skin"])


def body_white_shirt(d, cx, by):
    d.rectangle([cx - 5, by, cx + 4, by + 8], fill=C["outline"])
    d.rectangle([cx - 4, by + 1, cx + 3, by + 7], fill=C["white"])
    d.point((cx - 1, by + 3), fill=C["metal"])
    d.point((cx - 1, by + 5), fill=C["metal"])
    d.point((cx - 2, by + 1), fill=C["white_d"])
    d.point((cx + 1, by + 1), fill=C["white_d"])
    d.point((cx - 1, by + 1), fill=C["skin"])
    d.point((cx, by + 1), fill=C["skin"])


def body_stripe(d, cx, by):
    d.rectangle([cx - 5, by, cx + 4, by + 8], fill=C["outline"])
    for i, y in enumerate(range(by + 1, by + 8)):
        d.rectangle([cx - 4, y, cx + 3, y], fill=C["stripe_red"] if i % 2 == 0 else C["stripe_w"])
    d.point((cx - 1, by + 1), fill=C["skin"])
    d.point((cx, by + 1), fill=C["skin"])


def body_sweater(d, cx, by):
    d.rectangle([cx - 5, by, cx + 4, by + 8], fill=C["outline"])
    d.rectangle([cx - 4, by + 1, cx + 3, by + 7], fill=C["black"])
    d.rectangle([cx - 3, by + 3, cx + 2, by + 3], fill=C["black_hi"])
    d.point((cx - 1, by + 1), fill=C["skin"])
    d.point((cx, by + 1), fill=C["skin"])


# ---- hair: drawn AFTER face, only crown/sides/bangs (never wipe whole face) ----
def hair_long_ombre(d, cx, hy):
    """cast_01: long dark → lighter tips + thin see-through bangs."""
    # crown
    d.rectangle([cx - 5, hy - 2, cx + 4, hy + 2], fill=C["hair_dk"])
    d.rectangle([cx - 4, hy - 3, cx + 3, hy - 2], fill=C["hair_dk"])
    # side falls (leave face cx-3..cx+2 open below hy+3)
    d.rectangle([cx - 6, hy, cx - 5, hy + 8], fill=C["hair_dk"])
    d.rectangle([cx + 4, hy, cx + 5, hy + 8], fill=C["hair_dk"])
    d.rectangle([cx - 7, hy + 1, cx - 6, hy + 7], fill=C["hair_dk"])
    d.rectangle([cx + 5, hy + 1, cx + 6, hy + 7], fill=C["hair_dk"])
    # long locks past shoulders
    d.rectangle([cx - 7, hy + 8, cx - 5, hy + 14], fill=C["hair_dk"])
    d.rectangle([cx + 4, hy + 8, cx + 6, hy + 14], fill=C["hair_dk"])
    # lighter tips
    d.rectangle([cx - 7, hy + 12, cx - 5, hy + 15], fill=C["hair_tip"])
    d.rectangle([cx + 4, hy + 12, cx + 6, hy + 15], fill=C["hair_tip"])
    d.point((cx - 6, hy + 15), fill=C["hair_tip2"])
    d.point((cx + 5, hy + 15), fill=C["hair_tip2"])
    # thin see-through bangs across forehead (gaps)
    for x in (cx - 3, cx - 2, cx, cx + 1, cx + 3):
        d.point((x, hy + 2), fill=C["hair_dk"])
    for x in (cx - 1, cx + 2):
        d.point((x, hy + 2), fill=C["hair_mid"])  # thinner strand
    # outline top
    d.point((cx - 5, hy - 3), fill=C["outline"])
    d.point((cx + 4, hy - 3), fill=C["outline"])


def hair_twin_buns(d, cx, hy):
    """cast_02: bear-ear twin buns."""
    d.rectangle([cx - 5, hy - 1, cx + 4, hy + 2], fill=C["hair_dk"])
    # left bun
    d.rectangle([cx - 8, hy - 5, cx - 3, hy - 1], fill=C["outline"])
    d.rectangle([cx - 7, hy - 4, cx - 4, hy - 1], fill=C["hair_dk"])
    d.point((cx - 5, hy - 5), fill=C["hair_dk"])
    # right bun
    d.rectangle([cx + 2, hy - 5, cx + 7, hy - 1], fill=C["outline"])
    d.rectangle([cx + 3, hy - 4, cx + 6, hy - 1], fill=C["hair_dk"])
    d.point((cx + 4, hy - 5), fill=C["hair_dk"])
    # side
    d.rectangle([cx - 6, hy + 1, cx - 5, hy + 6], fill=C["hair_dk"])
    d.rectangle([cx + 4, hy + 1, cx + 5, hy + 6], fill=C["hair_dk"])
    # short bangs
    for x in range(cx - 3, cx + 4):
        d.point((x, hy + 2), fill=C["hair_dk"])
    d.point((cx, hy + 2), fill=C["skin"])  # gap


def hair_voluminous(d, cx, hy):
    """cast_03: short voluminous (taller + wider fluff)."""
    d.rectangle([cx - 6, hy - 4, cx + 5, hy + 2], fill=C["hair_dk"])
    d.rectangle([cx - 7, hy - 2, cx + 6, hy + 1], fill=C["hair_dk"])
    # spikes / fluff
    for x, y in [(-5, -5), (-2, -6), (1, -5), (3, -6), (5, -4), (-4, -3), (2, -3)]:
        d.point((cx + x, hy + y), fill=C["hair_dk"])
    d.rectangle([cx - 7, hy + 1, cx - 5, hy + 5], fill=C["hair_dk"])
    d.rectangle([cx + 4, hy + 1, cx + 6, hy + 5], fill=C["hair_dk"])
    # slight bang line
    for x in range(cx - 3, cx + 4):
        d.point((x, hy + 2), fill=C["hair_mid"])


def hair_shoulder(d, cx, hy):
    """cast_04: shoulder-length, no tips."""
    d.rectangle([cx - 5, hy - 2, cx + 4, hy + 2], fill=C["hair_dk"])
    d.rectangle([cx - 4, hy - 3, cx + 3, hy - 2], fill=C["hair_dk"])
    d.rectangle([cx - 6, hy, cx - 5, hy + 9], fill=C["hair_dk"])
    d.rectangle([cx + 4, hy, cx + 5, hy + 9], fill=C["hair_dk"])
    d.rectangle([cx - 6, hy + 8, cx - 4, hy + 11], fill=C["hair_dk"])
    d.rectangle([cx + 3, hy + 8, cx + 5, hy + 11], fill=C["hair_dk"])
    for x in range(cx - 3, cx + 4):
        d.point((x, hy + 2), fill=C["hair_dk"])
    d.point((cx - 1, hy + 2), fill=C["skin"])


def hair_short_neat(d, cx, hy):
    """cast_05: neat short (cleaner top, less width)."""
    d.rectangle([cx - 5, hy - 2, cx + 4, hy + 2], fill=C["hair_dk"])
    d.rectangle([cx - 4, hy - 3, cx + 3, hy - 2], fill=C["hair_dk"])
    d.rectangle([cx - 6, hy, cx - 5, hy + 4], fill=C["hair_dk"])
    d.rectangle([cx + 4, hy, cx + 5, hy + 4], fill=C["hair_dk"])
    # clean side-part hint
    d.point((cx - 2, hy - 2), fill=C["hair_mid"])


def hair_long_bangs(d, cx, hy):
    """cast_06: long + fuller solid bangs."""
    d.rectangle([cx - 5, hy - 2, cx + 4, hy + 1], fill=C["hair_dk"])
    d.rectangle([cx - 4, hy - 3, cx + 3, hy - 2], fill=C["hair_dk"])
    d.rectangle([cx - 6, hy, cx - 5, hy + 10], fill=C["hair_dk"])
    d.rectangle([cx + 4, hy, cx + 5, hy + 10], fill=C["hair_dk"])
    d.rectangle([cx - 7, hy + 2, cx - 6, hy + 12], fill=C["hair_dk"])
    d.rectangle([cx + 5, hy + 2, cx + 6, hy + 12], fill=C["hair_dk"])
    d.rectangle([cx - 7, hy + 10, cx - 5, hy + 14], fill=C["hair_dk"])
    d.rectangle([cx + 4, hy + 10, cx + 6, hy + 14], fill=C["hair_dk"])
    # solid bangs covering forehead more
    d.rectangle([cx - 4, hy + 1, cx + 3, hy + 3], fill=C["hair_dk"])


def hair_short_neat_alt(d, cx, hy):
    """cast_07: short neat but flatter (different from 03/05)."""
    d.rectangle([cx - 5, hy - 1, cx + 4, hy + 2], fill=C["hair_dk"])
    d.rectangle([cx - 4, hy - 2, cx + 3, hy - 1], fill=C["hair_dk"])
    # flatter, no spikes; slight fringe
    for x in range(cx - 3, cx + 4):
        d.point((x, hy + 2), fill=C["hair_dk"])
    d.rectangle([cx - 6, hy + 1, cx - 5, hy + 4], fill=C["hair_dk"])
    d.rectangle([cx + 4, hy + 1, cx + 5, hy + 4], fill=C["hair_dk"])


def hair_center_part(d, cx, hy):
    """cast_08: long center-part."""
    d.rectangle([cx - 5, hy - 2, cx + 4, hy + 1], fill=C["hair_dk"])
    d.rectangle([cx - 4, hy - 3, cx + 3, hy - 2], fill=C["hair_dk"])
    # center part gap
    d.point((cx - 1, hy - 2), fill=C["skin"])
    d.point((cx, hy - 2), fill=C["skin"])
    d.point((cx - 1, hy - 1), fill=C["skin_d"])
    d.rectangle([cx - 6, hy, cx - 5, hy + 10], fill=C["hair_dk"])
    d.rectangle([cx + 4, hy, cx + 5, hy + 10], fill=C["hair_dk"])
    d.rectangle([cx - 7, hy + 2, cx - 6, hy + 13], fill=C["hair_dk"])
    d.rectangle([cx + 5, hy + 2, cx + 6, hy + 13], fill=C["hair_dk"])
    d.rectangle([cx - 7, hy + 11, cx - 5, hy + 15], fill=C["hair_dk"])
    d.rectangle([cx + 4, hy + 11, cx + 6, hy + 15], fill=C["hair_dk"])
    # soft side framing (not full bangs)
    d.point((cx - 3, hy + 2), fill=C["hair_dk"])
    d.point((cx + 2, hy + 2), fill=C["hair_dk"])


CAST = [
    dict(id="cast_01", hair="long dark-brown → lighter tips, thin see-through bangs",
         clothes="charcoal grey blazer over black layer",
         notes="From Laura ref cast_01_ref (=ref-a). Fair skin.",
         hair_fn=hair_long_ombre, body_fn=body_blazer, sleeve=C["charcoal"], skin=C["skin_fair"]),
    dict(id="cast_02", hair="twin top buns (“bear ears”)", clothes="dark top",
         notes="Distinct bun silhouette.",
         hair_fn=hair_twin_buns, body_fn=body_dark_top, sleeve=C["black"], skin=C["skin_fair"]),
    dict(id="cast_03", hair="short voluminous black", clothes="black tee",
         notes="Man · fuller / spiky hair profile.",
         hair_fn=hair_voluminous, body_fn=body_black_tee, sleeve=C["tee_dk"], skin=C["skin"]),
    dict(id="cast_04", hair="shoulder-length dark", clothes="dark blazer",
         notes="Professional · no ombre tips.",
         hair_fn=hair_shoulder, body_fn=body_blazer, sleeve=C["charcoal"], skin=C["skin_fair"]),
    dict(id="cast_05", hair="short neat black", clothes="white button shirt",
         notes="Man · clean-cut.",
         hair_fn=hair_short_neat, body_fn=body_white_shirt, sleeve=C["white"], skin=C["skin"]),
    dict(id="cast_06", hair="long dark hair with bangs", clothes="red–white horizontal stripe shirt",
         notes="High-contrast outfit.",
         hair_fn=hair_long_bangs, body_fn=body_stripe, sleeve=C["stripe_red"], skin=C["skin_fair"]),
    dict(id="cast_07", hair="short neat black (flat)", clothes="dark tee",
         notes="Man · flatter hair than cast_03; darker tee.",
         hair_fn=hair_short_neat_alt, body_fn=body_black_tee, sleeve=C["black"], skin=C["skin"]),
    dict(id="cast_08", hair="long center-part jet black", clothes="black crew-neck sweater",
         notes="From Laura ref-b. Fair skin.",
         hair_fn=hair_center_part, body_fn=body_sweater, sleeve=C["black"], skin=C["skin_fair"]),
]


def _paint_side_portrait(d, spec, cx, hy, by):
    spec["body_fn"](d, cx, by)
    d.rectangle([cx + 3, by + 2, cx + 5, by + 6], fill=C["outline"])
    d.rectangle([cx + 3, by + 3, cx + 4, by + 5], fill=spec["sleeve"])
    d.point((cx + 4, by + 6), fill=C["skin"])
    face(d, cx, hy, spec["skin"])
    d.rectangle([cx - 4, hy + 1, cx + 3, hy + 8], fill=spec["skin"])
    d.point((cx + 2, hy + 4), fill=C["eye"])
    d.point((cx + 2, hy + 3), fill=C["eye_hi"])
    spec["hair_fn"](d, cx, hy)


def _paint_back(d, spec, cx, hy, by):
    """Back view: no face plate — hair covers the head mass."""
    spec["body_fn"](d, cx, by)
    # hide front-facing neck skin
    d.point((cx - 1, by + 1), fill=spec["sleeve"])
    d.point((cx, by + 1), fill=spec["sleeve"])
    arms(d, cx, by, spec["sleeve"], 0)
    # head mass
    d.rectangle([cx - 5, hy, cx + 4, hy + 9], fill=C["outline"])
    d.rectangle([cx - 4, hy + 1, cx + 3, hy + 8], fill=C["hair_dk"])
    spec["hair_fn"](d, cx, hy)
    # extra rear fill so bangs don't punch a face hole
    d.rectangle([cx - 3, hy + 3, cx + 2, hy + 8], fill=C["hair_dk"])


def draw_cast(spec, view="front", frame=0):
    img = new()
    d = ImageDraw.Draw(img)
    cx = 16
    bob = 1 if (view in ("front", "back") and frame % 4 == 1) else 0
    hy = 6 + bob
    by = 16 + bob
    fy = 24 + bob

    shadow(d, cx, 30)

    if view == "side":
        legs_side(d, cx, fy)
        _paint_side_portrait(d, spec, cx, hy, by)
        return img

    if view == "walk_side":
        legs_side_walk(d, cx, fy, frame)
        _paint_side_portrait(d, spec, cx, hy, by)
        return img

    if view in ("back", "walk_back"):
        if view == "walk_back":
            legs_walk(d, cx, fy, frame)
        else:
            legs_front(d, cx, fy, frame)
        _paint_back(d, spec, cx, hy, by)
        return img

    if view == "walk":
        legs_walk(d, cx, fy, frame)
    else:
        legs_front(d, cx, fy, frame)

    spec["body_fn"](d, cx, by)
    arms(d, cx, by, spec["sleeve"], frame)
    face(d, cx, hy, spec["skin"])
    spec["hair_fn"](d, cx, hy)
    return img


def write_cast_md():
    lines = [
        "# Cast · 8 Soul Knight chibi avatars",
        "",
        "> Stylized **game avatars** from hair + outfit cues. Not photoreal likenesses.",
        "> Size: 32×32 · large head / small body · thick outline · 2.5D-readable.",
        "",
        "## Trait table",
        "",
        "| ID | Hair | Clothes | Notes |",
        "|----|------|---------|-------|",
    ]
    for s in CAST:
        lines.append(f"| `{s['id']}` | {s['hair']} | {s['clothes']} | {s['notes']} |")
    lines += [
        "",
        "## Asset paths",
        "",
        "```",
        "public/assets/characters/cast_XX/idle_front.png",
        "public/assets/characters/cast_XX/idle_front_1.png",
        "public/assets/characters/cast_XX/idle_side.png",
        "public/assets/characters/cast_XX/idle_back.png",
        "public/assets/characters/cast_XX/walk_0.png",
        "public/assets/characters/cast_XX/walk_1.png",
        "public/assets/characters/cast_XX/walk_side_0.png",
        "public/assets/characters/cast_XX/walk_side_1.png",
        "public/assets/characters/cast_XX/walk_back_0.png",
        "public/assets/characters/cast_XX/walk_back_1.png",
        "```",
        "",
        "## NPC extras (路人 / 快递 / 咖啡师)",
        "",
        "```",
        "public/assets/characters/npc_courier/{idle_front,idle_side,walk_0,walk_1}.png",
        "public/assets/characters/npc_barista/{idle_front,idle_side,walk_0,walk_1}.png",
        "public/assets/characters/npc_passerby/{idle_front,idle_side,walk_0,walk_1}.png",
        "```",
        "",
        "## Refs",
        "",
        "- `cast_01` ← `cyber-hutong-refs/cast/cast_01_ref.jpg` (= ref-a): ombre tips + charcoal blazer",
        "- `cast_08` ← `cyber-hutong-refs/cast/ref-b.jpg`: center-part + black sweater",
        "- `cast_02`–`cast_07` ← conversation hair/outfit cues (no photo likeness)",
        "",
        "## Preview",
        "",
        "- `/workspace/cyber-hutong-shots/cast-sheet-8x.png`",
        "",
    ]
    path = ROOT / "design" / "cast.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"  wrote {path}")


def make_sheet(sprites):
    scale, pad = 8, 10
    cell = 32 * scale
    cols = 8
    W = cols * cell + (cols + 1) * pad
    H = cell + 2 * pad + 28
    sheet = Image.new("RGBA", (W, H), (11, 14, 26, 255))
    d = ImageDraw.Draw(sheet)
    for i, sp in enumerate(sprites):
        x = pad + i * (cell + pad)
        y = pad
        sheet.paste(sp.resize((cell, cell), Image.Resampling.NEAREST), (x, y), sp.resize((cell, cell), Image.Resampling.NEAREST))
        d.text((x + 8, y + cell + 6), f"cast_{i+1:02d}", fill=(168, 176, 192, 255))
    return sheet


# ---- small-company NPCs (same chibi language, distinct silhouette) ----
NPC = {
    "orange": (232, 122, 48, 255),
    "orange_d": (176, 78, 28, 255),
    "helmet": (48, 52, 62, 255),
    "apron": (122, 72, 48, 255),
    "apron_hi": (168, 110, 72, 255),
    "cream": (240, 220, 190, 255),
    "hoodie": (72, 140, 150, 255),
    "hoodie_d": (40, 88, 96, 255),
    "box": (196, 148, 88, 255),
    "box_d": (140, 98, 52, 255),
    "cup": (245, 240, 230, 255),
    "coffee": (92, 56, 36, 255),
}


def _npc_shadow(d, cx=16, cy=30):
    shadow(d, cx, cy, 11)


def draw_npc_courier(view="front", frame=0):
    img = new()
    d = ImageDraw.Draw(img)
    cx, bob = 16, 1 if frame % 2 else 0
    hy, by, fy = 6 + bob, 16 + bob, 24 + bob
    _npc_shadow(d)
    if view == "side":
        legs_side(d, cx, fy)
    elif view == "walk":
        legs_walk(d, cx, fy, frame)
    else:
        legs_front(d, cx, fy, frame)
    # orange vest
    d.rectangle([cx - 6, by, cx + 5, by + 8], fill=C["outline"])
    d.rectangle([cx - 5, by + 1, cx + 4, by + 7], fill=NPC["orange"])
    d.rectangle([cx - 1, by + 1, cx, by + 7], fill=C["white"])
    d.point((cx - 3, by + 3), fill=NPC["orange_d"])
    if view != "side":
        arms(d, cx, by, NPC["orange"], frame)
    else:
        d.rectangle([cx + 3, by + 2, cx + 5, by + 6], fill=C["outline"])
        d.rectangle([cx + 3, by + 3, cx + 4, by + 5], fill=NPC["orange"])
    # parcel
    bx, byx = (cx + 5, by + 3) if view == "side" else (cx + 4, by + 4)
    d.rectangle([bx, byx, bx + 7, byx + 6], fill=C["outline"])
    d.rectangle([bx + 1, byx + 1, bx + 6, byx + 5], fill=NPC["box"])
    d.rectangle([bx + 1, byx + 3, bx + 6, byx + 3], fill=NPC["box_d"])
    # helmet + visor
    d.rectangle([cx - 6, hy - 2, cx + 5, hy + 5], fill=C["outline"])
    d.rectangle([cx - 5, hy - 1, cx + 4, hy + 4], fill=NPC["helmet"])
    d.rectangle([cx - 4, hy + 2, cx + 3, hy + 4], fill=C["metal"])
    if view != "back":
        d.point((cx - 2, hy + 5), fill=C["skin"])
        d.point((cx + 1, hy + 5), fill=C["skin"])
    return img


def draw_npc_barista(view="front", frame=0):
    img = new()
    d = ImageDraw.Draw(img)
    cx, bob = 16, 1 if frame % 2 else 0
    hy, by, fy = 6 + bob, 16 + bob, 24 + bob
    _npc_shadow(d)
    if view == "side":
        legs_side(d, cx, fy)
    elif view == "walk":
        legs_walk(d, cx, fy, frame)
    else:
        legs_front(d, cx, fy, frame)
    d.rectangle([cx - 5, by, cx + 4, by + 8], fill=C["outline"])
    d.rectangle([cx - 4, by + 1, cx + 3, by + 7], fill=NPC["cream"])
    # apron
    d.rectangle([cx - 3, by + 3, cx + 2, by + 7], fill=NPC["apron"])
    d.rectangle([cx - 2, by + 3, cx + 1, by + 4], fill=NPC["apron_hi"])
    if view != "side":
        arms(d, cx, by, NPC["cream"], frame)
    # coffee cup
    cupx = cx + 5 if view == "side" else cx + 4
    d.rectangle([cupx, by + 3, cupx + 4, by + 8], fill=C["outline"])
    d.rectangle([cupx + 1, by + 4, cupx + 3, by + 7], fill=NPC["cup"])
    d.rectangle([cupx + 1, by + 5, cupx + 3, by + 6], fill=NPC["coffee"])
    d.point((cupx + 2, by + 2), fill=C["white_d"])
    # cap + face
    if view == "back":
        d.rectangle([cx - 5, hy, cx + 4, hy + 8], fill=C["outline"])
        d.rectangle([cx - 4, hy + 1, cx + 3, hy + 7], fill=C["hair_dk"])
    else:
        face(d, cx, hy, C["skin_fair"])
    d.rectangle([cx - 6, hy - 2, cx + 5, hy + 2], fill=C["outline"])
    d.rectangle([cx - 5, hy - 1, cx + 4, hy + 1], fill=NPC["apron"])
    d.rectangle([cx - 4, hy - 2, cx + 3, hy - 1], fill=NPC["apron_hi"])
    return img


def draw_npc_passerby(view="front", frame=0):
    img = new()
    d = ImageDraw.Draw(img)
    cx, bob = 16, 1 if frame % 2 else 0
    hy, by, fy = 6 + bob, 16 + bob, 24 + bob
    _npc_shadow(d)
    if view == "side":
        legs_side(d, cx, fy)
    elif view == "walk":
        legs_walk(d, cx, fy, frame)
    else:
        legs_front(d, cx, fy, frame)
    d.rectangle([cx - 6, by, cx + 5, by + 8], fill=C["outline"])
    d.rectangle([cx - 5, by + 1, cx + 4, by + 7], fill=NPC["hoodie"])
    d.rectangle([cx - 2, by + 1, cx + 1, by + 3], fill=C["skin"])
    d.rectangle([cx - 4, by + 4, cx + 3, by + 5], fill=NPC["hoodie_d"])
    if view != "side":
        arms(d, cx, by, NPC["hoodie"], frame)
    # backpack
    if view != "front":
        d.rectangle([cx - 7, by + 1, cx - 4, by + 7], fill=C["outline"])
        d.rectangle([cx - 6, by + 2, cx - 5, by + 6], fill=C["charcoal"])
    else:
        d.rectangle([cx - 6, by + 2, cx - 5, by + 6], fill=C["charcoal_d"])
        d.rectangle([cx + 4, by + 2, cx + 5, by + 6], fill=C["charcoal_d"])
    if view == "back":
        d.rectangle([cx - 5, hy, cx + 4, hy + 8], fill=C["outline"])
        d.rectangle([cx - 4, hy + 1, cx + 3, hy + 7], fill=C["hair_dk"])
        d.rectangle([cx - 3, hy - 2, cx + 2, hy], fill=C["hair_dk"])
    else:
        face(d, cx, hy, C["skin"])
        d.rectangle([cx - 5, hy - 2, cx + 4, hy + 2], fill=C["hair_dk"])
        d.rectangle([cx - 6, hy, cx - 5, hy + 5], fill=C["hair_dk"])
        d.rectangle([cx + 4, hy, cx + 5, hy + 5], fill=C["hair_dk"])
        for x in range(cx - 3, cx + 4):
            d.point((x, hy + 2), fill=C["hair_dk"])
        d.point((cx, hy + 2), fill=C["skin"])
    return img


NPC_DRAW = {
    "npc_courier": draw_npc_courier,
    "npc_barista": draw_npc_barista,
    "npc_passerby": draw_npc_passerby,
}


def gen_npcs():
    for nid, fn in NPC_DRAW.items():
        out = ASSETS / nid
        save(fn("front", 0), out / "idle_front.png")
        save(fn("front", 1), out / "idle_front_1.png")
        save(fn("side", 0), out / "idle_side.png")
        save(fn("walk", 0), out / "walk_0.png")
        save(fn("walk", 1), out / "walk_1.png")
        save(fn("back", 0), out / "idle_back.png")


def main():
    print("Generating 8 cast sprites + direction frames + NPCs…")
    fronts = []
    for s in CAST:
        out = ASSETS / s["id"]
        front = draw_cast(s, "front", 0)
        save(front, out / "idle_front.png")
        save(draw_cast(s, "front", 1), out / "idle_front_1.png")
        save(draw_cast(s, "side", 0), out / "idle_side.png")
        save(draw_cast(s, "back", 0), out / "idle_back.png")
        save(draw_cast(s, "walk", 0), out / "walk_0.png")
        save(draw_cast(s, "walk", 1), out / "walk_1.png")
        save(draw_cast(s, "walk_side", 0), out / "walk_side_0.png")
        save(draw_cast(s, "walk_side", 1), out / "walk_side_1.png")
        save(draw_cast(s, "walk_back", 0), out / "walk_back_0.png")
        save(draw_cast(s, "walk_back", 1), out / "walk_back_1.png")
        fronts.append(front)
    gen_npcs()
    write_cast_md()
    SHOTS.mkdir(parents=True, exist_ok=True)
    sheet = make_sheet(fronts)
    sheet.save(SHOTS / "cast-sheet-8x.png", "PNG")
    print(f"  wrote {SHOTS / 'cast-sheet-8x.png'}")
    print("Done cast.")


if __name__ == "__main__":
    main()
