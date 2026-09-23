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
from pxlib import PAL, hline, new, outline_sprite, rect, save, shade, solid_shadow, vline, zoom

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
    "charcoal": (108, 112, 122, 255),
    "charcoal_d": (72, 76, 86, 255),
    "charcoal_hi": (156, 160, 170, 255),
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
    "polo": (28, 28, 32, 255),
    "mint": (214, 232, 214, 255),
    "mint_d": (170, 196, 176, 255),
    "sky": (176, 204, 230, 255),
    "red": (200, 56, 64, 255),
    "red_hi": (240, 120, 120, 255),
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
        hline(d, cx - 4, cx - 1, hy + 3, INK)
        hline(d, cx - 4, cx - 1, hy + 5, INK)
        vline(d, cx - 4, hy + 3, hy + 5, INK)
        vline(d, cx - 1, hy + 3, hy + 5, INK)
        hline(d, cx, cx + 3, hy + 3, INK)
        hline(d, cx, cx + 3, hy + 5, INK)
        vline(d, cx, hy + 3, hy + 5, INK)
        vline(d, cx + 3, hy + 3, hy + 5, INK)
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


def body_polo(d, cx, by):
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["polo"])
    d.point((cx - 1, by + 1), fill=SKIN)
    d.point((cx, by + 1), fill=SKIN)
    # collar V
    d.point((cx - 2, by + 1), fill=C["black_hi"])
    d.point((cx + 1, by + 1), fill=C["black_hi"])
    d.point((cx - 1, by + 2), fill=C["black_hi"])
    d.point((cx, by + 2), fill=C["black_hi"])


def body_mint_shirt(d, cx, by):
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["mint"])
    d.point((cx - 2, by + 1), fill=C["mint_d"])
    d.point((cx + 1, by + 1), fill=C["mint_d"])
    d.point((cx - 1, by + 1), fill=SKIN)
    d.point((cx, by + 1), fill=SKIN)


def body_sky_shirt(d, cx, by):
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["sky"])
    d.point((cx - 1, by + 1), fill=SKIN)
    d.point((cx, by + 1), fill=SKIN)
    d.point((cx - 3, by + 4), fill=shade(C["sky"], -20))


def body_red_stripe(d, cx, by):
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    for i, y in enumerate(range(by + 1, by + 8)):
        rect(d, [cx - 4, y, cx + 3, y], C["red"] if i % 2 == 0 else C["white"])
    d.point((cx - 1, by + 1), fill=SKIN)
    d.point((cx, by + 1), fill=SKIN)


def hair_double_buns(d, cx, hy):
    """Guessed silhouette — not confirmed on the group photo."""
    rect(d, [cx - 5, hy - 1, cx + 4, hy + 2], C["hair"])
    # two buns
    rect(d, [cx - 8, hy - 3, cx - 4, hy + 1], C["hair"])
    rect(d, [cx + 3, hy - 3, cx + 7, hy + 1], C["hair"])
    d.point((cx - 7, hy - 3), fill=C["hair_mid"])
    d.point((cx + 6, hy - 3), fill=C["hair_mid"])
    rect(d, [cx - 6, hy, cx - 5, hy + 6], C["hair"])
    rect(d, [cx + 4, hy, cx + 5, hy + 6], C["hair"])


def hair_long_ombre_heavy(d, cx, hy):
    hair_long_ombre_bangs(d, cx, hy)
    for x in range(cx - 4, cx + 4):
        d.point((x, hy + 2), fill=C["hair"])


def hair_center_part_soft(d, cx, hy):
    hair_center_part_long(d, cx, hy)
    d.point((cx - 2, hy + 2), fill=SKIN_F)
    d.point((cx + 1, hy + 2), fill=SKIN_F)


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


def _v(tag, label, hair_fn, body_fn, sleeve, skin, glasses=False):
    return dict(tag=tag, label=label, hair_fn=hair_fn, body_fn=body_fn,
                sleeve=sleeve, skin=skin, glasses=glasses)


CAST = [
    dict(
        id="cast_01",
        hair="薄刘海 + 深棕→浅发尾",
        clothes="炭灰西装 / 黑内搭",
        photo="cast01-ref 证件正脸",
        group_pos="—（独立证件照，不在合影里点名）",
        face_status="has_front",
        notes="灰西装、浅发尾、薄刘海。多版仍贴这张正脸。",
        variants=[
            _v("A", "薄刘海+浅发尾+炭灰西装", hair_long_ombre_bangs, body_blazer_open, C["charcoal"], SKIN_F),
            _v("B", "刘海更密", hair_long_ombre_heavy, body_blazer_open, C["charcoal"], SKIN_F),
            _v("C", "西装略浅", hair_long_ombre_bangs, body_grey_suit, C["grey"], SKIN_F),
        ],
    ),
    dict(
        id="cast_02",
        hair="深发挽低 / 后颈",
        clothes="白衬衫 + 细框眼镜",
        photo="hutong-wall-seats 合影",
        group_pos="朝墙长桌·中间那位（白衬衫、眼镜、手撑头、侧对镜头）",
        face_status="need_front",
        notes="仅合影 3/4 侧。A=眼镜白衫（推荐）。",
        variants=[
            _v("A", "眼镜+白衬衫+低马尾", hair_pulled_back, body_white_shirt, C["white"], SKIN_F, True),
            _v("B", "同发型无眼镜", hair_pulled_back, body_white_shirt, C["white"], SKIN_F, False),
            _v("C", "头发放下", hair_shoulder_wave, body_white_shirt, C["white"], SKIN_F, True),
        ],
    ),
    dict(
        id="cast_03",
        hair="短黑、两侧略厚",
        clothes="黑 polo",
        photo="hutong-inward 合影",
        group_pos="前排左二：黑 polo、短发、转向镜头（3/4 脸）",
        face_status="need_front",
        notes="合影有 3/4 脸，不是证件正脸。黑 polo 男。",
        variants=[
            _v("A", "黑 polo 短发", hair_short_male_office, body_polo, C["polo"], SKIN),
            _v("B", "黑 T", hair_short_male_office, body_black_tee, C["tee"], SKIN),
            _v("C", "白衬衫男（拉开差异，合影未穿）", hair_short_male_office, body_white_shirt, C["white"], SKIN),
        ],
    ),
    dict(
        id="cast_04",
        hair="短黑 + 眼镜",
        clothes="黑 T",
        photo="hutong-inward 合影",
        group_pos="前排右：黑 T、眼镜、托腮看屏幕",
        face_status="need_front",
        notes="仅合影侧/3/4。眼镜是辨认点。",
        variants=[
            _v("A", "黑T+眼镜", hair_peak_short, body_black_tee, C["tee"], SKIN, True),
            _v("B", "黑T无眼镜", hair_peak_short, body_black_tee, C["tee"], SKIN, False),
            _v("C", "灰西装+眼镜", hair_peak_short, body_grey_suit, C["grey"], SKIN, True),
        ],
    ),
    dict(
        id="cast_05",
        hair="深发、侧对墙",
        clothes="浅薄荷短袖",
        photo="hutong-inward 合影",
        group_pos="前排最左：浅色短袖、坐着打平板，侧/背对镜头",
        face_status="need_front",
        notes="仅合影侧/背。衣服颜色是辨认点。",
        variants=[
            _v("A", "薄荷短袖+深发", hair_pulled_back, body_mint_shirt, C["mint"], SKIN_F),
            _v("B", "白短袖", hair_pulled_back, body_white_shirt, C["white"], SKIN_F),
            _v("C", "短发薄荷衫", hair_crew_neat, body_mint_shirt, C["mint"], SKIN_F),
        ],
    ),
    dict(
        id="cast_06",
        hair="褐长发",
        clothes="浅蓝衬衫",
        photo="hutong-wall-seats 合影",
        group_pos="朝墙长桌·右侧那位（褐发、蓝衬衫、打电话、背影）",
        face_status="need_front",
        notes="仅合影背。B 红白条 / C 双丸子是拉开差异的变体，合影未确认。",
        variants=[
            _v("A", "褐长发+浅蓝衫", hair_long_brown_bangs, body_sky_shirt, C["sky"], SKIN_F),
            _v("B", "红白横条（变体，合影未穿）", hair_long_brown_bangs, body_red_stripe, C["red"], SKIN_F),
            _v("C", "双丸子头（变体，合影看不清）", hair_double_buns, body_sky_shirt, C["sky"], SKIN_F),
        ],
    ),
    dict(
        id="cast_07",
        hair="深发、远",
        clothes="深色衣",
        photo="hutong-inward 合影",
        group_pos="后排靠绿墙 / ttc 字：深衣深发，只看见背或很小的侧影",
        face_status="need_front",
        notes="仅合影背/远。A 深衣短发；B 黑毛衣蓝领；C 双丸子（猜测）。",
        variants=[
            _v("A", "短发深衣", hair_peak_short, body_dark_top, C["black"], SKIN),
            _v("B", "黑毛衣浅蓝领", hair_peak_short, body_sweater_collar, C["black"], SKIN),
            _v("C", "双丸子+深衣（猜测）", hair_double_buns, body_dark_top, C["black"], SKIN_F),
        ],
    ),
    dict(
        id="cast_08",
        hair="中分黑长直",
        clothes="黑圆领毛衣 + 小耳钉",
        photo="cast08-ref 证件正脸",
        group_pos="—（独立证件照）",
        face_status="has_front",
        notes="中分黑长直、黑毛衣。多版仍贴这张正脸。",
        variants=[
            _v("A", "中分长直+黑毛衣", hair_center_part_long, body_sweater, C["black"], SKIN_F),
            _v("B", "中分略露额", hair_center_part_soft, body_sweater, C["black"], SKIN_F),
            _v("C", "同发型+开衫感", hair_center_part_long, body_blazer_open, C["charcoal"], SKIN_F),
        ],
    ),
]


def _apply_variant(person, variant=None):
    """Copy A (or given) variant fields onto the person dict for draw_cast."""
    v = variant or person["variants"][0]
    person["hair_fn"] = v["hair_fn"]
    person["body_fn"] = v["body_fn"]
    person["sleeve"] = v["sleeve"]
    person["skin"] = v["skin"]
    person["glasses"] = v["glasses"]
    return person


for _p in CAST:
    _apply_variant(_p)


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


def draw_variant(person, tag="A", view="front", frame=0):
    v = next(x for x in person["variants"] if x["tag"] == tag)
    tmp = dict(person)
    _apply_variant(tmp, v)
    return draw_cast(tmp, view, frame)


def cue_chip(person) -> Image.Image:
    """Stylized 48×48 photo-cue — NOT a real photograph."""
    img = new(48, 48, (28, 30, 38, 255))
    d = ImageDraw.Draw(img)
    v = person["variants"][0]
    # colored plate
    rect(d, [4, 4, 43, 43], (44, 40, 48, 255))
    # hair block
    hc = C["brown"] if "褐" in person["hair"] or person["id"] == "cast_06" else C["hair"]
    if person["id"] == "cast_01":
        hc = C["hair_br"]
    rect(d, [14, 8, 33, 22], hc)
    if person["id"] == "cast_01":
        rect(d, [14, 20, 18, 28], C["hair_tip"])
        rect(d, [29, 20, 33, 28], C["hair_tip"])
    if person["id"] == "cast_08":
        d.point((23, 8), fill=SKIN_F)
        d.point((24, 8), fill=SKIN_F)
    if person["id"] == "cast_06" and True:
        rect(d, [12, 18, 16, 34], C["brown"])
        rect(d, [31, 18, 35, 34], C["brown"])
    # face
    rect(d, [18, 16, 29, 26], v["skin"])
    d.point((20, 20), fill=EYE)
    d.point((26, 20), fill=EYE)
    if v["glasses"]:
        rect(d, [18, 19, 23, 22], INK)
        rect(d, [24, 19, 29, 22], INK)
    # body
    rect(d, [15, 28, 32, 42], v["sleeve"])
    if person["id"] == "cast_01":
        rect(d, [22, 28, 25, 42], C["black"])
    return outline_sprite(img)


def write_cast_md():
    lines = [
        "# Cast · 8 refined-pixel chibi（多版 A/B/C）",
        "",
        "> Q 版游戏头，抓发型/衣服。**不要写真脸**。每人 2–3 个变体，默认 idle 用 **A**。",
        "> 真人 JPG **不入库**。对照页左栏是像素 cue，不是照片。",
        "",
        "## 照片映射",
        "",
        "| ID | 照片 | 合影里第几个 / 衣服发型 | 正脸 | 推荐 A | B / C |",
        "|----|------|------------------------|------|--------|-------|",
    ]
    for s in CAST:
        flag = "有正脸" if s["face_status"] == "has_front" else "**仅合影侧/背**"
        if s["id"] == "cast_03":
            flag = "合影 3/4 脸（非证件）"
        b = s["variants"][1]["label"] if len(s["variants"]) > 1 else "—"
        c = s["variants"][2]["label"] if len(s["variants"]) > 2 else "—"
        lines.append(
            f"| `{s['id']}` | {s['photo']} | {s['group_pos']} | {flag} | {s['variants'][0]['label']} | {b} / {c} |"
        )
    lines += [
        "",
        "## 还缺 Laura 补正脸",
        "",
        "| ID | 现有线索 | 为什么缺 |",
        "|----|----------|----------|",
        "| `cast_02` | wall-seats 中间：白衬衫+眼镜+挽发 | 只有 3/4 侧，不是证件正脸 |",
        "| `cast_03` | inward 左二：黑 polo 短发看镜头 | 有 3/4 脸，仍缺证件正脸 |",
        "| `cast_04` | inward 右：黑 T + 眼镜托腮 | 仅侧/3/4 |",
        "| `cast_05` | inward 最左：薄荷短袖打平板 | 仅侧/背 |",
        "| `cast_06` | wall-seats 右：褐发蓝衫打电话 | 仅背影。B 红白条 / C 丸子是拉开差异，合影未确认 |",
        "| `cast_07` | inward 后排绿墙边深衣 | 只看见远/背。C 丸子是猜测 |",
        "",
        "合影里**没有**清楚的「白衬衫男」正脸；`cast_03` C 是拉开差异的白衬衫变体，已标明合影未穿。",
        "合影里**没有**确认的双丸子头；只作为 `cast_06` C / `cast_07` C 的猜测剪影。",
        "",
        "## Asset paths",
        "",
        "```",
        "public/assets/characters/cast_XX/idle_front.png          # 推荐 A",
        "public/assets/characters/cast_XX/variant_A.png",
        "public/assets/characters/cast_XX/variant_B.png",
        "public/assets/characters/cast_XX/variant_C.png",
        "public/preview/cast_sheet.png",
        "public/preview/cast_variants_sheet.png",
        "public/preview/cast_photo_map.png",
        "```",
        "",
        "真人照片只放本地 `uploads/`，**不提交进仓库**。",
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


def make_variants_sheet():
    scale, pad = 5, 8
    cell = 32 * scale
    cols = 3
    rows = 8
    W = 70 + cols * (cell + pad) + pad
    H = pad + rows * (cell + 22) + pad
    sheet = Image.new("RGBA", (W, H), (18, 20, 28, 255))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 2), "cast variants A / B / C  (default idle = A)", fill=(200, 168, 120, 255))
    for r, person in enumerate(CAST):
        y0 = pad + 12 + r * (cell + 22)
        d.text((pad, y0 + cell // 2), person["id"], fill=(168, 176, 192, 255))
        for c, v in enumerate(person["variants"]):
            sp = draw_variant(person, v["tag"])
            x = 70 + c * (cell + pad)
            big = zoom(sp, scale)
            sheet.paste(big, (x, y0), big)
            d.text((x + 4, y0 + cell + 2), v["tag"], fill=(200, 176, 130, 255))
    return sheet


def make_photo_map():
    """Left: stylized cue (not a photo). Right: A/B/C sprites."""
    scale, pad = 4, 8
    cell = 32 * scale
    cue = 96
    note_w = 220
    W = pad + cue + 12 + 3 * (cell + pad) + note_w
    H = pad + 8 * (max(cell, cue) + 22) + 28
    sheet = Image.new("RGBA", (W, H), (18, 20, 28, 255))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 2), "photo map  |  left=stylized cue (NOT a photo)  |  A B C", fill=(200, 168, 120, 255))
    cues = {
        "cast_01": "ID front  grey blazer  light tips",
        "cast_02": "wall-seats MID  white shirt+glasses  3/4",
        "cast_03": "inward L2  black polo  3/4",
        "cast_04": "inward RIGHT  black tee+glasses",
        "cast_05": "inward LEFT  mint shirt  side/back",
        "cast_06": "wall-seats RIGHT  brown/blue  BACK",
        "cast_07": "inward BACK wall  dark clothes",
        "cast_08": "ID front  center-part  black sweater",
    }
    for r, person in enumerate(CAST):
        y0 = 18 + r * (cell + 22)
        chip = zoom(cue_chip(person), 2)
        sheet.paste(chip, (pad, y0), chip)
        flag = "FRONT" if person["face_status"] == "has_front" else "side/back"
        if person["id"] == "cast_03":
            flag = "3/4"
        d.text((pad, y0 + cue + 2), person["id"] + " " + flag, fill=(168, 176, 192, 255))
        for c, v in enumerate(person["variants"]):
            sp = draw_variant(person, v["tag"])
            x = pad + cue + 12 + c * (cell + pad)
            big = zoom(sp, scale)
            sheet.paste(big, (x, y0), big)
            d.text((x + 2, y0 + cell + 1), v["tag"], fill=(200, 176, 130, 255))
        nx = pad + cue + 12 + 3 * (cell + pad)
        d.text((nx, y0 + 20), cues.get(person["id"], ""), fill=(200, 176, 130, 255))
        d.text((nx, y0 + 36), person["photo"], fill=(140, 148, 164, 255))
    return sheet


def main():
    print("Generating 8 refined cast sprites + A/B/C variants…")
    fronts = []
    for s in CAST:
        _apply_variant(s)
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
        for v in s["variants"]:
            save(draw_variant(s, v["tag"]), out / f"variant_{v['tag']}.png")
        fronts.append(front)
    write_cast_md()
    sheet = make_sheet(fronts)
    save(sheet, ASSETS / "cast_sheet.png")
    save(sheet, PREVIEW / "cast_sheet.png")
    grid = make_grid_sheet(
        [
            ("idle_front A", fronts),
            ("idle_side", [draw_cast(s, "side", 0) for s in CAST]),
            ("walk_0", [draw_cast(s, "walk", 0) for s in CAST]),
        ]
    )
    save(grid, PREVIEW / "cast_frames.png")
    save(make_variants_sheet(), PREVIEW / "cast_variants_sheet.png")
    save(make_photo_map(), PREVIEW / "cast_photo_map.png")
    print("Done cast.")


if __name__ == "__main__":
    main()
