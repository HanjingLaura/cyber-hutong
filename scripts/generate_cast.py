#!/usr/bin/env python3
"""Generate 8 refined-pixel chibi cast sprites.

Stylized game avatars from hair + outfit cues — NOT photoreal likenesses.
32×32 · large head / small body · 1px outline · readable at 3–4×.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pxlib import PAL, new, outline_sprite, rect, save, solid_shadow, zoom

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets" / "characters"
PREVIEW = ROOT / "public" / "preview"
DESIGN = ROOT / "design"

INK = PAL["ink"]
SKIN = PAL["skin"]
SKIN_F = PAL["skin_f"]
SKIN_D = PAL["skin_d"]
EYE = PAL["eye"]
HI = PAL["white"]
BLUSH = PAL["blush"]

C = {
    "hair": (28, 22, 24, 255),
    "hair_mid": (52, 40, 36, 255),
    "hair_br": (58, 40, 34, 255),
    "hair_tip": (210, 168, 110, 255),
    "hair_tip2": (186, 140, 88, 255),
    "brown": (92, 62, 42, 255),
    "charcoal": (74, 78, 86, 255),
    "charcoal_d": (50, 52, 60, 255),
    "charcoal_hi": (112, 116, 124, 255),
    "black": (26, 26, 32, 255),
    "black_hi": (48, 50, 58, 255),
    "grey": (140, 144, 152, 255),
    "grey_d": (96, 100, 110, 255),
    "grey_hi": (180, 184, 190, 255),
    "white": (244, 240, 232, 255),
    "white_d": (210, 204, 194, 255),
    "stripe_n": (36, 52, 86, 255),
    "gold": (214, 176, 78, 255),
    "blue": (168, 188, 214, 255),
    "pants": (48, 50, 62, 255),
    "shoe": (24, 24, 28, 255),
    "tee": (34, 36, 42, 255),
}


def face(d, cx, hy, skin, glasses=False):
    """Readable chibi face plate. hy = top of face fill."""
    rect(d, [cx - 5, hy, cx + 4, hy + 9], INK)
    rect(d, [cx - 4, hy + 1, cx + 3, hy + 8], skin)
    rect(d, [cx - 3, hy + 8, cx + 2, hy + 9], skin)
    d.point((cx - 3, hy + 4), fill=EYE)
    d.point((cx - 2, hy + 4), fill=EYE)
    d.point((cx + 1, hy + 4), fill=EYE)
    d.point((cx + 2, hy + 4), fill=EYE)
    d.point((cx - 3, hy + 3), fill=HI)
    d.point((cx + 1, hy + 3), fill=HI)
    d.point((cx - 4, hy + 6), fill=BLUSH)
    d.point((cx + 3, hy + 6), fill=BLUSH)
    # tiny mouth
    d.point((cx - 1, hy + 7), fill=SKIN_D)
    d.point((cx, hy + 7), fill=SKIN_D)
    if glasses:
        # 1px rims only
        # thicker rims so glasses survive 3×
        rect(d, [cx - 5, hy + 3, cx - 1, hy + 5], INK)
        rect(d, [cx, hy + 3, cx + 4, hy + 5], INK)
        d.point((cx - 4, hy + 4), fill=skin)
        d.point((cx - 3, hy + 4), fill=EYE)
        d.point((cx + 1, hy + 4), fill=skin)
        d.point((cx + 2, hy + 4), fill=EYE)
        d.point((cx - 1, hy + 4), fill=INK)
        d.point((cx, hy + 4), fill=INK)


def legs_front(d, cx, fy, frame=0):
    bob = 1 if frame % 4 == 1 else 0
    rect(d, [cx - 3, fy + bob, cx - 1, fy + 4 + bob], C["pants"])
    rect(d, [cx + 1, fy + bob, cx + 3, fy + 4 + bob], C["pants"])
    rect(d, [cx - 4, fy + 4 + bob, cx - 1, fy + 5 + bob], C["shoe"])
    rect(d, [cx + 1, fy + 4 + bob, cx + 4, fy + 5 + bob], C["shoe"])
    d.point((cx - 4, fy + 5 + bob), fill=INK)
    d.point((cx + 4, fy + 5 + bob), fill=INK)


def legs_walk(d, cx, fy, frame=0):
    if frame % 2 == 0:
        rect(d, [cx - 4, fy, cx - 2, fy + 4], C["pants"])
        rect(d, [cx + 1, fy + 1, cx + 3, fy + 5], C["pants"])
        rect(d, [cx - 5, fy + 4, cx - 2, fy + 5], C["shoe"])
        rect(d, [cx + 1, fy + 5, cx + 4, fy + 6], C["shoe"])
    else:
        rect(d, [cx - 4, fy + 1, cx - 2, fy + 5], C["pants"])
        rect(d, [cx + 1, fy, cx + 3, fy + 4], C["pants"])
        rect(d, [cx - 5, fy + 5, cx - 2, fy + 6], C["shoe"])
        rect(d, [cx + 1, fy + 4, cx + 4, fy + 5], C["shoe"])


def legs_side(d, cx, fy, frame=0):
    step = 1 if frame % 2 else 0
    rect(d, [cx - 1, fy + step, cx + 1, fy + 4 + step], C["pants"])
    rect(d, [cx - 2, fy + 4 + step, cx + 2, fy + 5 + step], C["shoe"])


def legs_back(d, cx, fy, frame=0):
    legs_front(d, cx, fy, frame)


def arms(d, cx, by, sleeve, frame=0, side=False):
    ay = by + 2 + (frame % 2)
    if side:
        rect(d, [cx + 3, ay, cx + 5, ay + 5], INK)
        rect(d, [cx + 3, ay + 1, cx + 4, ay + 4], sleeve)
        d.point((cx + 4, ay + 5), fill=SKIN)
        return
    rect(d, [cx - 7, ay, cx - 5, ay + 5], INK)
    rect(d, [cx - 6, ay + 1, cx - 5, ay + 4], sleeve)
    d.point((cx - 6, ay + 5), fill=SKIN)
    rect(d, [cx + 4, ay, cx + 6, ay + 5], INK)
    rect(d, [cx + 4, ay + 1, cx + 5, ay + 4], sleeve)
    d.point((cx + 5, ay + 5), fill=SKIN)


# ---- bodies ----
def body_blazer_open(d, cx, by, jacket=None, lining=None):
    jacket = jacket or C["charcoal"]
    lining = lining or C["black"]
    rect(d, [cx - 6, by, cx + 5, by + 8], INK)
    rect(d, [cx - 5, by + 1, cx + 4, by + 7], jacket)
    rect(d, [cx - 1, by + 1, cx, by + 7], lining)
    d.point((cx - 3, by + 2), fill=C["charcoal_hi"])
    d.point((cx + 2, by + 2), fill=C["charcoal_hi"])


def body_grey_suit(d, cx, by):
    rect(d, [cx - 6, by, cx + 5, by + 8], INK)
    rect(d, [cx - 5, by + 1, cx + 4, by + 7], C["grey"])
    rect(d, [cx - 1, by + 1, cx, by + 7], C["black"])
    d.point((cx - 4, by + 2), fill=C["grey_hi"])
    d.point((cx + 3, by + 2), fill=C["grey_hi"])
    d.point((cx - 3, by + 4), fill=C["grey_hi"])
    d.point((cx + 2, by + 4), fill=C["grey_hi"])


def body_gold_blazer(d, cx, by):
    rect(d, [cx - 6, by, cx + 5, by + 8], INK)
    rect(d, [cx - 5, by + 1, cx + 4, by + 7], C["black"])
    d.point((cx - 3, by + 3), fill=C["gold"])
    d.point((cx + 2, by + 3), fill=C["gold"])
    d.point((cx - 3, by + 5), fill=C["gold"])
    d.point((cx + 2, by + 5), fill=C["gold"])
    d.point((cx - 2, by + 1), fill=C["black_hi"])


def body_dark_top(d, cx, by):
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["black"])
    rect(d, [cx - 3, by + 2, cx + 2, by + 3], C["black_hi"])
    d.point((cx - 1, by + 1), fill=SKIN)
    d.point((cx, by + 1), fill=SKIN)


def body_black_tee(d, cx, by):
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["tee"])
    d.point((cx - 1, by + 1), fill=SKIN)
    d.point((cx, by + 1), fill=SKIN)


def body_white_shirt(d, cx, by):
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["white"])
    d.point((cx - 1, by + 3), fill=PAL["metal"])
    d.point((cx - 1, by + 5), fill=PAL["metal"])
    d.point((cx - 2, by + 1), fill=C["white_d"])
    d.point((cx + 1, by + 1), fill=C["white_d"])
    d.point((cx - 1, by + 1), fill=SKIN)
    d.point((cx, by + 1), fill=SKIN)
    # faint pinstripe
    d.point((cx - 3, by + 4), fill=C["white_d"])
    d.point((cx + 2, by + 4), fill=C["white_d"])


def body_navy_stripe(d, cx, by):
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    for i, y in enumerate(range(by + 1, by + 8)):
        rect(d, [cx - 4, y, cx + 3, y], C["stripe_n"] if i % 2 == 0 else C["white"])
    d.point((cx - 1, by + 1), fill=SKIN)
    d.point((cx, by + 1), fill=SKIN)


def body_sweater_collar(d, cx, by):
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["black"])
    # light-blue collar — a full band so it reads at 4×
    rect(d, [cx - 4, by + 1, cx + 3, by + 3], C["blue"])
    d.point((cx - 1, by + 2), fill=SKIN)
    d.point((cx, by + 2), fill=SKIN)
    rect(d, [cx - 3, by + 4, cx + 2, by + 4], C["black_hi"])


def body_sweater(d, cx, by):
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["black"])
    rect(d, [cx - 3, by + 3, cx + 2, by + 3], C["black_hi"])
    d.point((cx - 1, by + 1), fill=SKIN)
    d.point((cx, by + 1), fill=SKIN)


# ---- hair (drawn AFTER face; never wipe the whole plate) ----
def hair_long_ombre_bangs(d, cx, hy):
    """cast_01: long dark → lighter tips + see-through bangs."""
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 2], C["hair"])
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 2], C["hair"])
    rect(d, [cx - 6, hy, cx - 5, hy + 8], C["hair"])
    rect(d, [cx + 4, hy, cx + 5, hy + 8], C["hair"])
    rect(d, [cx - 7, hy + 1, cx - 6, hy + 7], C["hair"])
    rect(d, [cx + 5, hy + 1, cx + 6, hy + 7], C["hair"])
    rect(d, [cx - 7, hy + 8, cx - 5, hy + 14], C["hair"])
    rect(d, [cx + 4, hy + 8, cx + 6, hy + 14], C["hair"])
    rect(d, [cx - 7, hy + 12, cx - 5, hy + 15], C["hair_tip"])
    rect(d, [cx + 4, hy + 12, cx + 6, hy + 15], C["hair_tip"])
    d.point((cx - 6, hy + 15), fill=C["hair_tip2"])
    d.point((cx + 5, hy + 15), fill=C["hair_tip2"])
    for x in (cx - 4, cx - 3, cx - 2, cx, cx + 1, cx + 3):
        d.point((x, hy + 2), fill=C["hair"])
    d.point((cx - 1, hy + 2), fill=C["hair_mid"])
    d.point((cx + 2, hy + 2), fill=C["hair_mid"])
    # ombre tips must survive 4×
    rect(d, [cx - 7, hy + 13, cx - 5, hy + 16], C["hair_tip"])
    rect(d, [cx + 4, hy + 13, cx + 6, hy + 16], C["hair_tip"])
    d.point((cx - 5, hy - 3), fill=INK)
    d.point((cx + 4, hy - 3), fill=INK)


def hair_pulled_back(d, cx, hy):
    """cast_02: dark hair pulled low, clean forehead (glasses sit on face)."""
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 1], C["hair"])
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 2], C["hair"])
    rect(d, [cx - 6, hy, cx - 5, hy + 6], C["hair"])
    rect(d, [cx + 4, hy, cx + 5, hy + 6], C["hair"])
    # low ponytail hanging right
    rect(d, [cx + 4, hy + 6, cx + 7, hy + 14], C["hair"])
    rect(d, [cx + 5, hy + 14, cx + 6, hy + 15], C["hair_mid"])
    d.point((cx - 5, hy + 3), fill=C["hair"])


def hair_short_male_office(d, cx, hy):
    """cast_03: short black, slightly fuller sides — office man, no front ID."""
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 2], C["hair"])
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 1], C["hair"])
    rect(d, [cx - 6, hy, cx - 5, hy + 5], C["hair"])
    rect(d, [cx + 4, hy, cx + 5, hy + 5], C["hair"])
    d.point((cx - 3, hy - 2), fill=C["hair_mid"])


def hair_shoulder_wave(d, cx, hy):
    """cast_04: shoulder-length soft wave, side-part, no ombre."""
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 2], C["hair"])
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 2], C["hair"])
    # side part
    d.point((cx - 2, hy - 2), fill=SKIN_F)
    rect(d, [cx - 6, hy, cx - 5, hy + 9], C["hair"])
    rect(d, [cx + 4, hy, cx + 5, hy + 9], C["hair"])
    rect(d, [cx - 6, hy + 8, cx - 4, hy + 12], C["hair"])
    rect(d, [cx + 3, hy + 8, cx + 5, hy + 12], C["hair"])
    d.point((cx - 6, hy + 11), fill=C["hair_mid"])
    d.point((cx + 5, hy + 11), fill=C["hair_mid"])
    for x in (cx - 3, cx + 2):
        d.point((x, hy + 2), fill=C["hair"])
    # gold stud
    d.point((cx + 6, hy + 5), fill=C["gold"])


def hair_crew_neat(d, cx, hy):
    """cast_05: neat crew / buzz-top — smaller than other men."""
    rect(d, [cx - 3, hy - 2, cx + 2, hy + 1], C["hair"])
    rect(d, [cx - 4, hy, cx + 3, hy + 2], C["hair"])
    d.point((cx - 4, hy + 2), fill=C["hair_mid"])
    d.point((cx + 3, hy + 2), fill=C["hair_mid"])


def hair_long_brown_bangs(d, cx, hy):
    """cast_06: long brown, fuller bangs (selfie)."""
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 1], C["brown"])
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 2], C["brown"])
    rect(d, [cx - 6, hy, cx - 5, hy + 11], C["brown"])
    rect(d, [cx + 4, hy, cx + 5, hy + 11], C["brown"])
    rect(d, [cx - 7, hy + 2, cx - 6, hy + 13], C["brown"])
    rect(d, [cx + 5, hy + 2, cx + 6, hy + 13], C["brown"])
    rect(d, [cx - 7, hy + 11, cx - 5, hy + 15], C["brown"])
    rect(d, [cx + 4, hy + 11, cx + 6, hy + 15], C["brown"])
    rect(d, [cx - 4, hy + 1, cx + 3, hy + 3], C["brown"])
    d.point((cx - 1, hy + 3), fill=SKIN_F)  # bang gap
    d.point((cx + 6, hy + 8), fill=PAL["metal"])  # watch hint on idle is body; skip


def hair_peak_short(d, cx, hy):
    """cast_07: short neat with a front peak (taller than crew)."""
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 2], C["hair"])
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 1], C["hair"])
    d.point((cx - 1, hy - 5), fill=C["hair"])
    d.point((cx, hy - 4), fill=C["hair"])
    d.point((cx - 2, hy - 4), fill=C["hair"])
    rect(d, [cx - 6, hy, cx - 5, hy + 4], C["hair"])
    rect(d, [cx + 4, hy, cx + 5, hy + 4], C["hair"])


def hair_center_part_long(d, cx, hy):
    """cast_08: long jet center-part, no bangs, tiny stud."""
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 1], C["hair"])
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 2], C["hair"])
    d.point((cx - 1, hy - 2), fill=SKIN_F)
    d.point((cx, hy - 2), fill=SKIN_F)
    d.point((cx - 1, hy - 1), fill=SKIN_D)
    rect(d, [cx - 6, hy, cx - 5, hy + 11], C["hair"])
    rect(d, [cx + 4, hy, cx + 5, hy + 11], C["hair"])
    rect(d, [cx - 7, hy + 2, cx - 6, hy + 14], C["hair"])
    rect(d, [cx + 5, hy + 2, cx + 6, hy + 14], C["hair"])
    rect(d, [cx - 7, hy + 12, cx - 5, hy + 16], C["hair"])
    rect(d, [cx + 4, hy + 12, cx + 6, hy + 16], C["hair"])
    d.point((cx - 3, hy + 2), fill=C["hair"])
    d.point((cx + 2, hy + 2), fill=C["hair"])
    d.point((cx + 6, hy + 5), fill=HI)  # tiny stud


CAST = [
    dict(
        id="cast_01",
        hair="long dark-brown → lighter tips, thin see-through bangs",
        clothes="charcoal grey blazer over black layer",
        notes="From Laura ID cast_01_ref. Fair skin. HAS front face.",
        face_status="has_front",
        hair_fn=hair_long_ombre_bangs,
        body_fn=body_blazer_open,
        sleeve=C["charcoal"],
        skin=SKIN_F,
        glasses=False,
    ),
    dict(
        id="cast_02",
        hair="dark hair pulled low / nape",
        clothes="white pinstripe shirt + thin glasses",
        notes="Office selfie / 合影. 3/4 face visible.",
        face_status="has_front",
        hair_fn=hair_pulled_back,
        body_fn=body_white_shirt,
        sleeve=C["white"],
        skin=SKIN_F,
        glasses=True,
    ),
    dict(
        id="cast_03",
        hair="short black, fuller sides",
        clothes="black tee",
        notes="Office 合影 only (back/side). NEED Laura front ID.",
        face_status="need_front",
        hair_fn=hair_short_male_office,
        body_fn=body_black_tee,
        sleeve=C["tee"],
        skin=SKIN,
        glasses=False,
    ),
    dict(
        id="cast_04",
        hair="shoulder-length soft wave, side-part",
        clothes="black blazer with gold buttons + gold stud",
        notes="From portrait ref. HAS front face.",
        face_status="has_front",
        hair_fn=hair_shoulder_wave,
        body_fn=body_gold_blazer,
        sleeve=C["black"],
        skin=SKIN_F,
        glasses=False,
    ),
    dict(
        id="cast_05",
        hair="neat crew / buzz-top",
        clothes="grey suit jacket over black shirt",
        notes="From portrait ref. HAS front face.",
        face_status="has_front",
        hair_fn=hair_crew_neat,
        body_fn=body_grey_suit,
        sleeve=C["grey"],
        skin=SKIN,
        glasses=False,
    ),
    dict(
        id="cast_06",
        hair="long brown with fuller bangs",
        clothes="navy–white horizontal stripe shirt",
        notes="Office selfie (peace sign). HAS front face.",
        face_status="has_front",
        hair_fn=hair_long_brown_bangs,
        body_fn=body_navy_stripe,
        sleeve=C["stripe_n"],
        skin=SKIN_F,
        glasses=False,
    ),
    dict(
        id="cast_07",
        hair="short neat with a slight front peak",
        clothes="black sweater over light-blue collar",
        notes="From portrait ref. HAS front face.",
        face_status="has_front",
        hair_fn=hair_peak_short,
        body_fn=body_sweater_collar,
        sleeve=C["black"],
        skin=SKIN,
        glasses=False,
    ),
    dict(
        id="cast_08",
        hair="long center-part jet black",
        clothes="black crew-neck sweater + tiny stud",
        notes="From Laura ID ref-b. Fair skin. HAS front face.",
        face_status="has_front",
        hair_fn=hair_center_part_long,
        body_fn=body_sweater,
        sleeve=C["black"],
        skin=SKIN_F,
        glasses=False,
    ),
]


def draw_cast(spec, view="front", frame=0):
    img = new(32, 32)
    d = ImageDraw.Draw(img)
    cx = 16
    bob = 1 if (view in ("front", "back") and frame % 4 == 1) else 0
    hy = 6 + bob
    by = 16 + bob
    fy = 24 + bob

    solid_shadow(d, cx, 30, rx=7, ry=2)

    if view == "side":
        legs_side(d, cx, fy, frame)
        spec["body_fn"](d, cx, by)
        arms(d, cx, by, spec["sleeve"], frame, side=True)
        face(d, cx, hy, spec["skin"], glasses=False)
        rect(d, [cx - 4, hy + 1, cx + 3, hy + 8], spec["skin"])
        d.point((cx + 2, hy + 4), fill=EYE)
        d.point((cx + 2, hy + 3), fill=HI)
        if spec.get("glasses"):
            rect(d, [cx + 1, hy + 3, cx + 3, hy + 5], INK)
            d.point((cx + 2, hy + 4), fill=EYE)
        spec["hair_fn"](d, cx, hy)
        return outline_sprite(img)

    if view == "back":
        legs_back(d, cx, fy, frame)
        spec["body_fn"](d, cx, by)
        arms(d, cx, by, spec["sleeve"], frame)
        # hair covers head
        spec["hair_fn"](d, cx, hy)
        hair_c = C["brown"] if spec["id"] == "cast_06" else C.get("hair", (28, 22, 24, 255))
        rect(d, [cx - 4, hy + 1, cx + 3, hy + 6], hair_c)
        return outline_sprite(img)

    if view == "walk":
        legs_walk(d, cx, fy, frame)
    else:
        legs_front(d, cx, fy, frame)

    spec["body_fn"](d, cx, by)
    arms(d, cx, by, spec["sleeve"], frame)
    face(d, cx, hy, spec["skin"], glasses=spec.get("glasses", False))
    spec["hair_fn"](d, cx, hy)
    return outline_sprite(img)


def write_cast_md():
    lines = [
        "# Cast · 8 refined-pixel chibi",
        "",
        "> Stylized **game avatars** from hair + outfit cues. Not photoreal likenesses.",
        "> Size: 32×32 · large head / small body · 1px outline · 2.5D-readable.",
        "",
        "## Trait table",
        "",
        "| ID | Hair | Clothes | Front face | Notes |",
        "|----|------|---------|------------|-------|",
    ]
    for s in CAST:
        flag = "有正脸" if s["face_status"] == "has_front" else "**缺正脸**"
        lines.append(
            f"| `{s['id']}` | {s['hair']} | {s['clothes']} | {flag} | {s['notes']} |"
        )
    lines += [
        "",
        "## 还缺 Laura 补正脸",
        "",
        "| ID | 现有线索 | 为什么缺 |",
        "|----|----------|----------|",
        "| `cast_03` | 办公室合影：短发、黑 T、侧背影 | 没有一张正脸证件照，发型/五官只能按合影猜 |",
        "",
        "`cast_02` 用合影 3/4 脸（眼镜 + 白衬衫），能辨认但不是证件正脸；若要更准也欢迎补一张。",
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
        "public/assets/characters/cast_sheet.png",
        "```",
        "",
        "## Refs（不入库）",
        "",
        "- `cast_01` ← 证件正脸：刘海 + 棕金发尾 + 炭灰西装",
        "- `cast_02` ← 工位合影：眼镜 + 白细条纹衬衫 + 低马尾",
        "- `cast_03` ← 工位合影侧/背：短发黑 T（**缺正脸**）",
        "- `cast_04` ← 证件正脸：齐肩软波 + 黑西装金扣",
        "- `cast_05` ← 证件正脸：寸平头 + 灰西装黑衬衫",
        "- `cast_06` ← 工位自拍：棕色长发刘海 + 海军细横条",
        "- `cast_07` ← 证件正脸：短发微峰 + 黑毛衣浅蓝领",
        "- `cast_08` ← 证件正脸：中分长直发 + 黑圆领毛衣",
        "",
        "真人照片只作本地对照，**不提交进仓库**。",
        "",
        "## Preview",
        "",
        "- `public/assets/characters/cast_sheet.png`",
        "- `public/preview/cast_sheet.png`",
        "",
    ]
    path = DESIGN / "cast.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"  wrote {path.relative_to(ROOT)}")


def make_sheet(sprites, labels=None):
    scale, pad = 6, 8
    cell = 32 * scale
    cols = 8
    W = cols * cell + (cols + 1) * pad
    H = cell + 2 * pad + 16
    sheet = Image.new("RGBA", (W, H), (18, 20, 28, 255))
    d = ImageDraw.Draw(sheet)
    for i, sp in enumerate(sprites):
        x = pad + i * (cell + pad)
        y = pad
        big = zoom(sp, scale)
        sheet.paste(big, (x, y), big)
        name = labels[i] if labels else f"cast_{i+1:02d}"
        d.text((x + 4, y + cell + 2), name, fill=(168, 176, 192, 255))
    return sheet


def make_grid_sheet(rows):
    """rows: list of (label, [8 sprites])."""
    scale, pad = 4, 6
    cell = 32 * scale
    cols = 8
    W = cols * cell + (cols + 1) * pad
    H = len(rows) * (cell + 14 + pad) + pad
    sheet = Image.new("RGBA", (W, H), (18, 20, 28, 255))
    d = ImageDraw.Draw(sheet)
    for r, (label, sprites) in enumerate(rows):
        y0 = pad + r * (cell + 14 + pad)
        d.text((pad, y0 - 1), label, fill=(200, 168, 120, 255))
        for i, sp in enumerate(sprites):
            x = pad + i * (cell + pad)
            big = zoom(sp, scale)
            sheet.paste(big, (x, y0 + 10), big)
    return sheet


def main():
    print("Generating 8 refined cast sprites…")
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
        save(draw_cast(s, "side", 0), out / "walk_side_0.png")
        save(draw_cast(s, "side", 1), out / "walk_side_1.png")
        fronts.append(front)
    write_cast_md()
    sheet = make_sheet(fronts)
    save(sheet, ASSETS / "cast_sheet.png")
    save(sheet, PREVIEW / "cast_sheet.png")
    grid = make_grid_sheet(
        [
            ("idle_front", fronts),
            ("idle_side", [draw_cast(s, "side", 0) for s in CAST]),
            ("walk_0", [draw_cast(s, "walk", 0) for s in CAST]),
        ]
    )
    save(grid, PREVIEW / "cast_frames.png")
    print("Done cast.")


if __name__ == "__main__":
    main()
