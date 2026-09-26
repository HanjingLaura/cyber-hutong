#!/usr/bin/env python3
"""Generate 8 refined-pixel chibi cast sprites from p1–p8 ID photos.

One final version per person. Stylized game avatars from hair + outfit +
accessories — NOT photoreal likenesses.
32×32 · large head / small body · 1px outline · readable at 3–4×.

Real photographs stay in local cyber-hutong-refs/ and are never committed.
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
REF_DIR = ROOT / "cyber-hutong-refs" / "cast-photos-0926"
ARTIFACT = Path("/opt/cursor/artifacts/screenshots")

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
    "hair_hi": (68, 52, 46, 255),
    "brown": (92, 62, 42, 255),
    "brown_mid": (122, 86, 58, 255),
    "hair_tip": (210, 168, 110, 255),
    "hair_tip2": (186, 140, 88, 255),
    "charcoal": (96, 100, 110, 255),
    "charcoal_d": (68, 72, 82, 255),
    "charcoal_hi": (140, 144, 154, 255),
    "black": (26, 26, 32, 255),
    "black_hi": (48, 50, 58, 255),
    "grey": (148, 152, 160, 255),
    "grey_d": (108, 112, 122, 255),
    "grey_hi": (184, 188, 196, 255),
    "white": (246, 242, 236, 255),
    "white_d": (214, 208, 198, 255),
    "gold": (214, 176, 78, 255),
    "gold_hi": (236, 208, 120, 255),
    "blue": (168, 196, 226, 255),
    "blue_d": (132, 164, 200, 255),
    "pants": (48, 50, 62, 255),
    "shoe": (24, 24, 28, 255),
    "pink": (236, 164, 180, 255),
    "pink_d": (204, 124, 144, 255),
    "pink_hi": (248, 196, 208, 255),
    "silver": (200, 204, 212, 255),
    "flower": (250, 246, 238, 255),
    "flower_d": (228, 216, 200, 255),
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
    d.point((cx - 1, hy + 7), fill=SKIN_D)
    d.point((cx, hy + 7), fill=SKIN_D)
    if glasses:
        # two round-ish lenses with a gap so they don't become a black visor
        hline(d, cx - 4, cx - 2, hy + 3, INK)
        hline(d, cx - 4, cx - 2, hy + 5, INK)
        vline(d, cx - 4, hy + 3, hy + 5, INK)
        vline(d, cx - 2, hy + 3, hy + 5, INK)
        hline(d, cx + 1, cx + 3, hy + 3, INK)
        hline(d, cx + 1, cx + 3, hy + 5, INK)
        vline(d, cx + 1, hy + 3, hy + 5, INK)
        vline(d, cx + 3, hy + 3, hy + 5, INK)
        d.point((cx - 1, hy + 4), fill=INK)
        d.point((cx, hy + 4), fill=INK)
        d.point((cx - 5, hy + 4), fill=INK)
        d.point((cx + 4, hy + 4), fill=INK)


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


def arms(d, cx, by, sleeve, frame=0, side=False, bare=False):
    ay = by + 2 + (frame % 2)
    fill = SKIN_F if bare else sleeve
    if side:
        rect(d, [cx + 3, ay, cx + 5, ay + 5], INK)
        rect(d, [cx + 3, ay + 1, cx + 4, ay + 4], fill)
        d.point((cx + 4, ay + 5), fill=SKIN)
        return ay
    rect(d, [cx - 7, ay, cx - 5, ay + 5], INK)
    rect(d, [cx - 6, ay + 1, cx - 5, ay + 4], fill)
    d.point((cx - 6, ay + 5), fill=SKIN)
    rect(d, [cx + 4, ay, cx + 6, ay + 5], INK)
    rect(d, [cx + 4, ay + 1, cx + 5, ay + 4], fill)
    d.point((cx + 5, ay + 5), fill=SKIN)
    return ay


# ---- bodies ----
def body_off_shoulder(d, cx, by):
    """p1: white ruffled off-shoulder top, bare shoulders."""
    rect(d, [cx - 6, by, cx + 5, by + 8], INK)
    # wide skin band so the off-shoulder reads at 4×
    rect(d, [cx - 5, by + 1, cx + 4, by + 4], SKIN_F)
    rect(d, [cx - 5, by + 4, cx + 4, by + 7], C["white"])
    for x in (cx - 4, cx - 2, cx, cx + 2):
        d.point((x, by + 4), fill=C["white_d"])
        d.point((x, by + 3), fill=C["white"])
    d.point((cx - 5, by + 2), fill=SKIN)
    d.point((cx + 4, by + 2), fill=SKIN)
    d.point((cx - 4, by + 6), fill=C["white_d"])
    d.point((cx + 3, by + 6), fill=C["white_d"])


def body_sweater_collar(d, cx, by):
    """p2: black crew sweater over a light-blue collared shirt."""
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["black"])
    rect(d, [cx - 4, by + 1, cx + 3, by + 3], C["blue"])
    d.point((cx - 2, by + 1), fill=C["blue_d"])
    d.point((cx + 1, by + 1), fill=C["blue_d"])
    d.point((cx - 1, by + 2), fill=SKIN)
    d.point((cx, by + 2), fill=SKIN)
    rect(d, [cx - 3, by + 4, cx + 2, by + 4], C["black_hi"])


def body_pink_knit(d, cx, by):
    """p3: pink crew-neck knit."""
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["pink"])
    for y in range(by + 3, by + 7, 2):
        hline(d, cx - 3, cx + 2, y, C["pink_d"])
    d.point((cx - 3, by + 2), fill=C["pink_hi"])
    d.point((cx + 2, by + 2), fill=C["pink_hi"])
    d.point((cx - 1, by + 1), fill=SKIN_F)
    d.point((cx, by + 1), fill=SKIN_F)


def body_white_hoodie(d, cx, by):
    """p4: white hoodie, drawstrings + kangaroo pocket."""
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["white"])
    # hood band
    rect(d, [cx - 4, by + 1, cx + 3, by + 2], C["white_d"])
    # drawstrings
    d.point((cx - 2, by + 3), fill=C["white_d"])
    d.point((cx + 1, by + 3), fill=C["white_d"])
    d.point((cx - 2, by + 4), fill=C["white_d"])
    d.point((cx + 1, by + 4), fill=C["white_d"])
    # pocket
    rect(d, [cx - 3, by + 5, cx + 2, by + 6], C["white_d"])
    d.point((cx - 1, by + 1), fill=SKIN_F)
    d.point((cx, by + 1), fill=SKIN_F)


def body_gold_blazer(d, cx, by):
    """p5: black blazer, gold buttons, black top."""
    rect(d, [cx - 6, by, cx + 5, by + 8], INK)
    rect(d, [cx - 5, by + 1, cx + 4, by + 7], C["black"])
    rect(d, [cx - 1, by + 1, cx, by + 7], C["black_hi"])
    d.point((cx - 3, by + 3), fill=C["gold"])
    d.point((cx - 3, by + 5), fill=C["gold_hi"])
    d.point((cx + 2, by + 3), fill=C["gold"])
    d.point((cx + 2, by + 5), fill=C["gold_hi"])
    d.point((cx - 4, by + 2), fill=C["black_hi"])
    d.point((cx + 3, by + 2), fill=C["black_hi"])


def body_grey_blazer_black(d, cx, by):
    """p6: dark-grey blazer over a closed black shirt."""
    rect(d, [cx - 6, by, cx + 5, by + 8], INK)
    rect(d, [cx - 5, by + 1, cx + 4, by + 7], C["charcoal"])
    rect(d, [cx - 1, by + 1, cx, by + 7], C["black"])
    d.point((cx - 4, by + 2), fill=C["charcoal_hi"])
    d.point((cx + 3, by + 2), fill=C["charcoal_hi"])
    d.point((cx - 3, by + 4), fill=C["charcoal_hi"])
    d.point((cx + 2, by + 4), fill=C["charcoal_hi"])


def body_grey_blazer_open(d, cx, by):
    """p7: lighter grey blazer open over a black top."""
    rect(d, [cx - 6, by, cx + 5, by + 8], INK)
    rect(d, [cx - 5, by + 1, cx + 4, by + 7], C["grey"])
    rect(d, [cx - 1, by + 1, cx, by + 7], C["black"])
    d.point((cx - 4, by + 2), fill=C["grey_hi"])
    d.point((cx + 3, by + 2), fill=C["grey_hi"])
    d.point((cx - 3, by + 5), fill=C["grey_d"])
    d.point((cx + 2, by + 5), fill=C["grey_d"])


def body_sweater(d, cx, by):
    """p8: black crew-neck sweater, no collar."""
    rect(d, [cx - 5, by, cx + 4, by + 8], INK)
    rect(d, [cx - 4, by + 1, cx + 3, by + 7], C["black"])
    rect(d, [cx - 3, by + 3, cx + 2, by + 3], C["black_hi"])
    d.point((cx - 1, by + 1), fill=SKIN_F)
    d.point((cx, by + 1), fill=SKIN_F)


# ---- hair (drawn AFTER face; never wipe the whole plate) ----
def hair_side_part_long(d, cx, hy, hc=None):
    """p1: long dark, slight side part, no bangs. Outer fall only — keep shoulders open."""
    hc = hc or C["hair"]
    mid = shade(hc, 22)
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 1], hc)
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 2], hc)
    d.point((cx - 3, hy - 2), fill=SKIN_F)
    d.point((cx - 2, hy - 2), fill=SKIN_F)
    d.point((cx - 3, hy - 1), fill=SKIN_D)
    # sides stop at the jaw so the off-shoulder skin stays visible
    rect(d, [cx - 6, hy, cx - 5, hy + 8], hc)
    rect(d, [cx + 4, hy, cx + 5, hy + 8], hc)
    # long fall only on the outer columns
    rect(d, [cx - 7, hy + 2, cx - 6, hy + 15], hc)
    rect(d, [cx + 6, hy + 2, cx + 7, hy + 15], hc)
    d.point((cx - 7, hy + 15), fill=mid)
    d.point((cx + 7, hy + 15), fill=mid)
    d.point((cx - 5, hy - 3), fill=INK)
    d.point((cx + 4, hy - 3), fill=INK)


def hair_spike_short(d, cx, hy, hc=None):
    """p2: short black with a textured / slightly spiky top."""
    hc = hc or C["hair"]
    mid = shade(hc, 22)
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 2], hc)
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 1], hc)
    # spikes
    d.point((cx - 2, hy - 5), fill=hc)
    d.point((cx - 1, hy - 4), fill=hc)
    d.point((cx, hy - 5), fill=hc)
    d.point((cx + 1, hy - 4), fill=hc)
    d.point((cx + 2, hy - 4), fill=hc)
    rect(d, [cx - 6, hy, cx - 5, hy + 4], hc)
    rect(d, [cx + 4, hy, cx + 5, hy + 4], hc)
    d.point((cx - 3, hy - 2), fill=mid)
    d.point((cx + 2, hy - 2), fill=mid)


def hair_chin_bob_wave(d, cx, hy, hc=None):
    """p3: chin-length wavy dark bob — wider, jagged hem."""
    hc = hc or C["hair"]
    mid = shade(hc, 22)
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 2], hc)
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 2], hc)
    rect(d, [cx - 7, hy, cx - 5, hy + 7], hc)
    rect(d, [cx + 4, hy, cx + 6, hy + 7], hc)
    d.point((cx - 7, hy + 6), fill=mid)
    d.point((cx - 6, hy + 8), fill=hc)
    d.point((cx - 5, hy + 9), fill=hc)
    d.point((cx - 4, hy + 7), fill=mid)
    d.point((cx + 6, hy + 6), fill=mid)
    d.point((cx + 5, hy + 8), fill=hc)
    d.point((cx + 4, hy + 9), fill=hc)
    d.point((cx + 3, hy + 7), fill=mid)
    d.point((cx - 3, hy + 2), fill=hc)
    d.point((cx + 2, hy + 2), fill=hc)
    d.point((cx - 5, hy - 3), fill=INK)
    d.point((cx + 4, hy - 3), fill=INK)


def hair_straight_bob(d, cx, hy, hc=None):
    """p4: straight black bob, even jaw line, forehead open for glasses."""
    hc = hc or C["hair"]
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 1], hc)
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 2], hc)
    rect(d, [cx - 6, hy, cx - 5, hy + 7], hc)
    rect(d, [cx + 4, hy, cx + 5, hy + 7], hc)
    # straight hem
    hline(d, cx - 6, cx - 4, hy + 7, hc)
    hline(d, cx + 3, cx + 5, hy + 7, hc)
    d.point((cx - 5, hy - 3), fill=INK)
    d.point((cx + 4, hy - 3), fill=INK)


def hair_shoulder_wave(d, cx, hy, hc=None):
    """p5: shoulder-length soft wave — shorter than 01/08."""
    hc = hc or C["hair"]
    mid = shade(hc, 22)
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 2], hc)
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 2], hc)
    d.point((cx - 2, hy - 2), fill=SKIN_F)
    rect(d, [cx - 6, hy, cx - 5, hy + 8], hc)
    rect(d, [cx + 4, hy, cx + 5, hy + 8], hc)
    rect(d, [cx - 6, hy + 7, cx - 4, hy + 10], hc)
    rect(d, [cx + 3, hy + 7, cx + 5, hy + 10], hc)
    d.point((cx - 6, hy + 10), fill=mid)
    d.point((cx + 5, hy + 10), fill=mid)
    d.point((cx - 3, hy + 2), fill=hc)
    d.point((cx + 2, hy + 2), fill=hc)
    d.point((cx - 5, hy - 3), fill=INK)
    d.point((cx + 4, hy - 3), fill=INK)


def hair_buzz(d, cx, hy, hc=None):
    """p6: very short buzz, almost a dark cap."""
    hc = hc or C["hair"]
    mid = shade(hc, 18)
    rect(d, [cx - 3, hy - 1, cx + 2, hy + 1], hc)
    rect(d, [cx - 4, hy, cx + 3, hy + 2], hc)
    d.point((cx - 4, hy + 2), fill=mid)
    d.point((cx + 3, hy + 2), fill=mid)
    d.point((cx - 2, hy - 1), fill=mid)
    d.point((cx + 1, hy - 1), fill=mid)


def hair_brown_bangs_ombre(d, cx, hy, hc=None):
    """p7: long brown, thin see-through bangs, lighter tips."""
    hc = hc or C["brown"]
    mid = C["brown_mid"]
    tip, tip2 = C["hair_tip"], C["hair_tip2"]
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 2], hc)
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 2], hc)
    rect(d, [cx - 6, hy, cx - 5, hy + 8], hc)
    rect(d, [cx + 4, hy, cx + 5, hy + 8], hc)
    rect(d, [cx - 7, hy + 1, cx - 6, hy + 7], hc)
    rect(d, [cx + 5, hy + 1, cx + 6, hy + 7], hc)
    rect(d, [cx - 7, hy + 8, cx - 5, hy + 12], hc)
    rect(d, [cx + 4, hy + 8, cx + 6, hy + 12], hc)
    # ombre tips
    rect(d, [cx - 7, hy + 12, cx - 5, hy + 16], tip)
    rect(d, [cx + 4, hy + 12, cx + 6, hy + 16], tip)
    d.point((cx - 6, hy + 15), fill=tip2)
    d.point((cx + 5, hy + 15), fill=tip2)
    # thin see-through bangs (gaps show skin)
    for x in (cx - 4, cx - 3, cx - 2, cx, cx + 1, cx + 3):
        d.point((x, hy + 2), fill=hc)
    d.point((cx - 1, hy + 2), fill=SKIN_F)
    d.point((cx + 2, hy + 2), fill=mid)
    d.point((cx - 5, hy - 3), fill=INK)
    d.point((cx + 4, hy - 3), fill=INK)


def hair_center_part_long(d, cx, hy, hc=None):
    """p8: very long jet center-part, no bangs, tiny stud."""
    hc = hc or C["hair"]
    rect(d, [cx - 5, hy - 2, cx + 4, hy + 1], hc)
    rect(d, [cx - 4, hy - 3, cx + 3, hy - 2], hc)
    d.point((cx - 1, hy - 2), fill=SKIN_F)
    d.point((cx, hy - 2), fill=SKIN_F)
    d.point((cx - 1, hy - 1), fill=SKIN_D)
    d.point((cx, hy - 1), fill=SKIN_D)
    rect(d, [cx - 6, hy, cx - 5, hy + 11], hc)
    rect(d, [cx + 4, hy, cx + 5, hy + 11], hc)
    rect(d, [cx - 7, hy + 2, cx - 6, hy + 14], hc)
    rect(d, [cx + 5, hy + 2, cx + 6, hy + 14], hc)
    rect(d, [cx - 7, hy + 12, cx - 5, hy + 17], hc)
    rect(d, [cx + 4, hy + 12, cx + 6, hy + 17], hc)
    d.point((cx - 3, hy + 2), fill=hc)
    d.point((cx + 2, hy + 2), fill=hc)
    d.point((cx - 5, hy - 3), fill=INK)
    d.point((cx + 4, hy - 3), fill=INK)


def _acc_flower(d, cx, hy):
    """White flower earring — sits outside the hair fall."""
    d.point((cx + 7, hy + 4), fill=C["flower"])
    d.point((cx + 8, hy + 4), fill=HI)
    d.point((cx + 7, hy + 5), fill=C["flower"])
    d.point((cx + 8, hy + 5), fill=C["flower_d"])


def _acc_hood(d, cx, hy):
    """White hoodie hood rim around the neck / sides."""
    d.point((cx - 6, hy + 1), fill=C["white_d"])
    d.point((cx + 5, hy + 1), fill=C["white_d"])
    d.point((cx - 6, hy + 2), fill=C["white"])
    d.point((cx + 5, hy + 2), fill=C["white"])
    d.point((cx - 5, hy + 8), fill=C["white_d"])
    d.point((cx + 4, hy + 8), fill=C["white_d"])


def _acc_hoop(d, cx, hy, col=None):
    col = col or C["silver"]
    d.point((cx + 6, hy + 5), fill=col)
    d.point((cx + 7, hy + 5), fill=col)
    d.point((cx + 6, hy + 6), fill=col)
    d.point((cx + 7, hy + 6), fill=col)


def _acc_stud(d, cx, hy):
    d.point((cx + 6, hy + 5), fill=HI)


def _draw_accessories(d, spec, cx, hy):
    acc = spec.get("acc")
    if acc == "flower":
        _acc_flower(d, cx, hy)
    elif acc == "hoop":
        _acc_hoop(d, cx, hy, C["silver"])
    elif acc == "gold_hoop":
        _acc_hoop(d, cx, hy, C["gold"])
    elif acc == "stud":
        _acc_stud(d, cx, hy)
    if spec.get("hood"):
        _acc_hood(d, cx, hy)


CAST = [
    dict(
        id="cast_01",
        photo="p1",
        photo_desc="长黑发浅侧分，白露肩荷叶上衣，白花耳饰",
        cues="侧分长直黑发 · 白露肩荷叶边 · 白花耳饰",
        hair_fn=hair_side_part_long,
        body_fn=body_off_shoulder,
        sleeve=C["white"],
        skin=SKIN_F,
        glasses=False,
        bare_arms=True,
        acc="flower",
        hair_c=C["hair"],
        hair_len="long",
    ),
    dict(
        id="cast_02",
        photo="p2",
        photo_desc="短黑刺发，黑圆领毛衣套浅蓝衬衫领",
        cues="短刺发 · 黑毛衣 · 浅蓝衬衫领",
        hair_fn=hair_spike_short,
        body_fn=body_sweater_collar,
        sleeve=C["black"],
        skin=SKIN,
        glasses=False,
        acc=None,
        hair_c=C["hair"],
        hair_len="short",
    ),
    dict(
        id="cast_03",
        photo="p3",
        photo_desc="齐下巴波浪短黑波波，粉针织衫，小圈耳饰与戒指",
        cues="波浪短波波 · 粉针织 · 银圈耳饰 · 戒指",
        hair_fn=hair_chin_bob_wave,
        body_fn=body_pink_knit,
        sleeve=C["pink"],
        skin=SKIN_F,
        glasses=False,
        acc="hoop",
        rings=True,
        hair_c=C["hair"],
        hair_len="bob",
    ),
    dict(
        id="cast_04",
        photo="p4",
        photo_desc="齐刘海感直黑波波，圆框黑眼镜，白卫衣（只用她，忽略右侧男人）",
        cues="直黑波波 · 圆框眼镜 · 白卫衣抽绳",
        hair_fn=hair_straight_bob,
        body_fn=body_white_hoodie,
        sleeve=C["white"],
        skin=SKIN_F,
        glasses=True,
        acc=None,
        hood=True,
        hair_c=C["hair"],
        hair_len="bob",
    ),
    dict(
        id="cast_05",
        photo="p5",
        photo_desc="齐肩微卷黑发，黑西装金扣，金圈耳饰",
        cues="齐肩微卷 · 黑西装金扣 · 金圈耳饰",
        hair_fn=hair_shoulder_wave,
        body_fn=body_gold_blazer,
        sleeve=C["black"],
        skin=SKIN_F,
        glasses=False,
        acc="gold_hoop",
        hair_c=C["hair"],
        hair_len="shoulder",
    ),
    dict(
        id="cast_06",
        photo="p6",
        photo_desc="极短寸头，深灰西装套黑衬衫",
        cues="寸头 · 深灰西装 · 黑衬衫",
        hair_fn=hair_buzz,
        body_fn=body_grey_blazer_black,
        sleeve=C["charcoal"],
        skin=SKIN,
        glasses=False,
        acc=None,
        hair_c=C["hair"],
        hair_len="buzz",
    ),
    dict(
        id="cast_07",
        photo="p7",
        photo_desc="褐长发浅发尾，薄透刘海，灰西装黑内搭",
        cues="褐长发浅发尾 · 薄刘海 · 浅灰开衫西装",
        hair_fn=hair_brown_bangs_ombre,
        body_fn=body_grey_blazer_open,
        sleeve=C["grey"],
        skin=SKIN_F,
        glasses=False,
        acc=None,
        hair_c=C["brown"],
        hair_len="long",
        hair_tip=C["hair_tip"],
    ),
    dict(
        id="cast_08",
        photo="p8",
        photo_desc="中分超长黑直发，黑圆领毛衣，小耳钉",
        cues="中分超长黑直 · 黑毛衣 · 小耳钉",
        hair_fn=hair_center_part_long,
        body_fn=body_sweater,
        sleeve=C["black"],
        skin=SKIN_F,
        glasses=False,
        acc="stud",
        hair_c=C["hair"],
        hair_len="long",
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
    bare = spec.get("bare_arms", False)

    if view == "side":
        legs_side(d, cx, fy, frame)
        spec["body_fn"](d, cx, by)
        arms(d, cx, by, spec["sleeve"], frame, side=True, bare=bare)
        face(d, cx, hy, spec["skin"], glasses=False)
        rect(d, [cx - 4, hy + 1, cx + 3, hy + 8], spec["skin"])
        d.point((cx + 2, hy + 4), fill=EYE)
        d.point((cx + 2, hy + 3), fill=HI)
        if spec.get("glasses"):
            rect(d, [cx + 1, hy + 3, cx + 3, hy + 5], INK)
            d.point((cx + 2, hy + 4), fill=EYE)
        spec["hair_fn"](d, cx, hy, spec.get("hair_c"))
        _draw_accessories(d, spec, cx, hy)
        return outline_sprite(img)

    if view == "back":
        legs_back(d, cx, fy, frame)
        spec["body_fn"](d, cx, by)
        arms(d, cx, by, spec["sleeve"], frame, bare=bare)
        spec["hair_fn"](d, cx, hy, spec.get("hair_c"))
        hair_c = spec.get("hair_c", C["hair"])
        rect(d, [cx - 4, hy + 1, cx + 3, hy + 6], hair_c)
        return outline_sprite(img)

    if view == "walk":
        legs_walk(d, cx, fy, frame)
    else:
        legs_front(d, cx, fy, frame)

    spec["body_fn"](d, cx, by)
    ay = arms(d, cx, by, spec["sleeve"], frame, bare=bare)
    if spec.get("rings"):
        d.point((cx - 6, ay + 5), fill=C["silver"])
        d.point((cx + 5, ay + 5), fill=C["gold"])
    face(d, cx, hy, spec["skin"], glasses=spec.get("glasses", False))
    spec["hair_fn"](d, cx, hy, spec.get("hair_c"))
    _draw_accessories(d, spec, cx, hy)
    return outline_sprite(img)


def write_cast_md():
    lines = [
        "# Cast · 8 refined-pixel chibi（p1–p8 证件照，每人一版）",
        "",
        "> Q 版游戏头，抓发型 / 眼镜 / 衣服颜色 / 耳饰。**不要写真脸**。",
        "> 八张证件照就是八个人；旧合影猜测映射已作废。每人一版，无 A/B/C。",
        "> 真人 JPG / PNG **不入库**（只放本地 `cyber-hutong-refs/` 或 `uploads/`）。",
        "",
        "## 照片映射",
        "",
        "| ID | 照片 | 照片描述 | 像素辨认点 |",
        "|----|------|----------|------------|",
    ]
    for s in CAST:
        lines.append(
            f"| `{s['id']}` | {s['photo']} | {s['photo_desc']} | {s['cues']} |"
        )
    lines += [
        "",
        "## 辨认要点（游戏尺度）",
        "",
        "- `cast_01` 白露肩 + 白花耳饰 + 侧分长黑发 — 全场唯一露肩白上衣。",
        "- `cast_02` 短刺发 + 黑毛衣浅蓝领 — 全场唯一蓝领。",
        "- `cast_03` 粉衣 + 波浪短波波 + 圈耳饰/戒指 — 全场唯一粉色。",
        "- `cast_04` 白卫衣 + 圆框眼镜 + 直波波 — 全场唯一眼镜。",
        "- `cast_05` 黑西装金扣 + 金圈 + 齐肩微卷。",
        "- `cast_06` 寸头 + 深灰西装黑衬衫 — 全场最短发。",
        "- `cast_07` 褐长发浅发尾 + 薄刘海 + 浅灰开衫 — 全场唯一褐发。",
        "- `cast_08` 中分超长黑直 + 黑毛衣 + 小耳钉 — 头发最长、中分最清楚。",
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
        "public/preview/cast_sheet.png",
        "public/preview/cast_lineup.png",
        "public/preview/cast_frames.png",
        "```",
        "",
        "对照表 `cast_photo_compare.png`（左栏真人缩略图）只作为本地 / artifact 审阅，",
        "**不提交进仓库**。",
        "",
    ]
    path = DESIGN / "cast.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"  wrote {path.relative_to(ROOT)}")


def make_sheet(sprites, labels=None, title=None):
    scale, pad = 6, 8
    cell = 32 * scale
    cols = 8
    W = cols * cell + (cols + 1) * pad
    H = cell + 2 * pad + 18
    sheet = Image.new("RGBA", (W, H), (18, 20, 28, 255))
    d = ImageDraw.Draw(sheet)
    if title:
        d.text((pad, 2), title, fill=(200, 168, 120, 255))
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


def find_photo(person):
    pid = person["photo"]
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        p = REF_DIR / f"{pid}{ext}"
        if p.exists():
            return p
    return None


def _face_thumb(im: Image.Image, size=160, person=None):
    """Center-biased square thumb. p4 crops out the man on the right."""
    w, h = im.size
    if person and person["id"] == "cast_04":
        im = im.crop((0, 0, max(1, int(w * 0.70)), max(1, int(h * 0.88))))
        w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = max(0, (h - side) // 5)
    im = im.crop((left, top, left + side, min(h, top + side)))
    return im.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)


def make_photo_compare(fronts):
    """Left: real photo thumb. Right: nearest-neighbor scaled idle. Artifact only."""
    scale = 8
    cell = 32 * scale
    thumb = 160
    pad = 16
    label_h = 22
    row_h = max(thumb, cell) + pad + label_h
    W = pad + thumb + pad + cell + pad
    H = pad + 8 * row_h + 20
    sheet = Image.new("RGBA", (W, H), (18, 20, 28, 255))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 4), "cast_photo_compare  |  left=photo  |  right=idle_front x8 nearest", fill=(200, 168, 120, 255))
    missing = []
    for i, (person, sp) in enumerate(zip(CAST, fronts)):
        y0 = 22 + i * row_h
        d.text((pad, y0), f"{person['id']}  {person['photo']}  {person['cues']}", fill=(200, 176, 130, 255))
        src = find_photo(person)
        if src is None:
            missing.append(person["id"])
            rect(d, [pad, y0 + label_h, pad + thumb - 1, y0 + label_h + thumb - 1], (44, 40, 48, 255))
            d.text((pad + 8, y0 + label_h + 70), "photo missing", fill=(168, 176, 192, 255))
        else:
            ph = _face_thumb(Image.open(src), thumb, person)
            sheet.paste(ph, (pad, y0 + label_h), ph if ph.mode == "RGBA" else None)
        big = zoom(sp, scale)
        sheet.paste(big, (pad + thumb + pad, y0 + label_h), big)
    dests = []
    ARTIFACT.mkdir(parents=True, exist_ok=True)
    REF_DIR.mkdir(parents=True, exist_ok=True)
    for dest in (ARTIFACT / "cast_photo_compare.png", REF_DIR / "cast_photo_compare.png"):
        sheet.save(dest, "PNG")
        dests.append(str(dest))
        print(f"  wrote {dest}")
    if missing:
        print("  WARN photo compare missing files for:", ", ".join(missing))
    return sheet, missing


def _wipe_old_variants(out: Path):
    for name in ("variant_A.png", "variant_B.png", "variant_C.png"):
        p = out / name
        if p.exists():
            p.unlink()


def main():
    print("Generating 8 p1–p8 cast sprites (one version each)…")
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
        _wipe_old_variants(out)
        fronts.append(front)
    write_cast_md()
    labels = [s["id"] for s in CAST]
    sheet = make_sheet(fronts, labels)
    save(sheet, ASSETS / "cast_sheet.png")
    save(sheet, PREVIEW / "cast_sheet.png")
    lineup = make_sheet(fronts, labels, title="cast lineup  idle_front x6")
    save(lineup, PREVIEW / "cast_lineup.png")
    save(lineup, ASSETS / "cast_lineup.png")
    ARTIFACT.mkdir(parents=True, exist_ok=True)
    lineup.save(ARTIFACT / "cast_lineup.png", "PNG")
    print(f"  wrote {ARTIFACT / 'cast_lineup.png'}")
    grid = make_grid_sheet(
        [
            ("idle_front", fronts),
            ("idle_side", [draw_cast(s, "side", 0) for s in CAST]),
            ("idle_back", [draw_cast(s, "back", 0) for s in CAST]),
            ("walk_0", [draw_cast(s, "walk", 0) for s in CAST]),
        ]
    )
    save(grid, PREVIEW / "cast_frames.png")
    for stale in ("cast_variants_sheet.png", "cast_photo_map.png"):
        p = PREVIEW / stale
        if p.exists():
            p.unlink()
            print(f"  removed {p.relative_to(ROOT)}")
    make_photo_compare(fronts)
    print("Done cast.")


if __name__ == "__main__":
    main()
