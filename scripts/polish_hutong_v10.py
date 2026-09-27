#!/usr/bin/env python3
"""v9 → v10: fix floor-strip grout, floating feet, end-grain seams.

Starts from the committed v9 PNG so everything else stays bit-identical.
View 2 is view 1 cropped at y>=176.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
V9 = ROOT / "assets" / "hutong" / "room" / "hutong_empty_view1_v9.png"
V8_CANDIDATES = (
    Path("/tmp/hutong_v8/view1.png"),
    Path("/home/ubuntu/.cursor/projects/workspace/uploads/hutong_empty_view1_v8_35f5.png"),
)
OUT_DIR = ROOT / "assets" / "hutong" / "room"
ART = Path("/opt/cursor/artifacts/screenshots")
PREVIEW = ROOT / "public" / "preview"
CROP_Y = 176

BOT_TOP_Y0, BOT_TOP_Y1 = 497, 577
BOT_PANEL_Y1 = 662
BOT_XL, BOT_XR = 163, 1114

INK = np.array([26, 21, 15], np.uint8)
FOOT = np.array([58, 42, 28], np.uint8)
FOOT_HI = np.array([78, 58, 38], np.uint8)

# v9 stamped ~25px of tiled mid-desk grain at each end
LEFT_GRAIN = (BOT_XL + 3, BOT_XL + 27)   # 166..189 inclusive
RIGHT_GRAIN = (BOT_XR - 26, BOT_XR - 3)  # 1088..1111 inclusive
FOOT_W, FOOT_H = 12, 4
LEFT_FOOT_X = BOT_XL + 6
RIGHT_FOOT_X = BOT_XR - 18


def is_floor(p) -> bool:
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    return abs(r - g) < 18 and abs(g - b) < 18 and 140 < r < 230


def is_wood(p) -> bool:
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    return r > 70 and r > g + 8 and g > b and (r - b) > 20


def is_ink(p) -> bool:
    return int(p[0]) < 50 and int(p[1]) < 45


def shade(c, amt):
    return np.array(
        [max(0, min(255, int(c[0]) + amt)),
         max(0, min(255, int(c[1]) + amt)),
         max(0, min(255, int(c[2]) + amt))],
        np.uint8,
    )


def in_desk_body(x, y) -> bool:
    return BOT_XL <= x <= BOT_XR and BOT_TOP_Y0 - 1 <= y <= BOT_PANEL_Y1


def restore_floor_strips(v10, v8):
    """Copy v8 floor at the exact (x, y) so H grout stays on the same rows
    and leaning V grout continues along its measured slope to the desk.
    """
    strips = ((100, 163), (1115, 1160))
    y0, y1 = 490, min(680, v10.shape[0] - 1)
    for x0, x1 in strips:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1):
                if in_desk_body(x, y):
                    continue
                src = v8[y, x]
                if is_floor(src):
                    v10[y, x] = src
                elif is_floor(v10[y, x]) and not is_wood(src) and not is_ink(src):
                    # leftover v8 desk-edge mud on a v9 floor pixel: keep
                    # same-y floor from this strip, 8px further from the desk
                    fx = x - 8 if x < 400 else min(v8.shape[1] - 1, x + 8)
                    far = v8[y, fx]
                    if is_floor(far):
                        v10[y, x] = far


def continue_end_grain(v10, v9):
    """Replace the tiled ~25px end patches by mirroring native same-row grain.

    v8's desk was narrower, so copying v8[y,x] here would stamp the old
    stepped outline as a dark vertical crack. Source only from the
    unpatched interior (x>=190 / x<=1087), which is bit-identical in v8/v9.
    """
    left_join = LEFT_GRAIN[1] + 1   # 190 — first native column
    right_join = RIGHT_GRAIN[0] - 1  # 1087 — last native column
    for y in range(BOT_TOP_Y0, BOT_TOP_Y1 + 1):
        for x in range(LEFT_GRAIN[0], LEFT_GRAIN[1] + 1):
            if is_ink(v10[y, x]) or not is_wood(v10[y, x]):
                continue
            # x=189 ← v9[y,191], so 189|190 are original neighbors 191|190
            srcx = left_join + (left_join - x)
            if 0 <= srcx < v9.shape[1] and is_wood(v9[y, srcx]):
                v10[y, x] = v9[y, srcx]
        for x in range(RIGHT_GRAIN[0], RIGHT_GRAIN[1] + 1):
            if is_ink(v10[y, x]) or not is_wood(v10[y, x]):
                continue
            srcx = right_join - (x - right_join)
            if 0 <= srcx < v9.shape[1] and is_wood(v9[y, srcx]):
                v10[y, x] = v9[y, srcx]


def _neighbor_floor(v10, x, y, toward):
    for k in range(1, 20):
        nx = x + toward * k
        if 0 <= nx < v10.shape[1] and is_floor(v10[y, nx]):
            return v10[y, nx].copy()
    return None


def attach_feet(v10):
    """12×4 feet flush on the panel's bottom outline. Shadow starts under them."""
    y_panel = BOT_PANEL_Y1
    y0 = y_panel + 1  # first row below the outline — no floor gap

    def place(cx):
        toward = -1 if cx < 400 else 1
        # wipe the old 12×6 floating foot + the 1px floor gap
        for y in range(y0, y0 + 10):
            for x in range(cx - 1, cx + FOOT_W + 1):
                if y <= y_panel and BOT_XL <= x <= BOT_XR:
                    continue
                src = _neighbor_floor(v10, x, y, toward)
                if src is not None:
                    v10[y, x] = src

        for y in range(y0, y0 + FOOT_H):
            for x in range(cx, cx + FOOT_W):
                on_edge = y == y0 or y == y0 + FOOT_H - 1 or x == cx or x == cx + FOOT_W - 1
                if on_edge:
                    v10[y, x] = INK
                elif y == y0 + 1 and 2 <= x - cx <= 5:
                    v10[y, x] = FOOT_HI
                else:
                    v10[y, x] = FOOT

        # shadow starts UNDER the foot
        for y in range(y0 + FOOT_H, y0 + FOOT_H + 6):
            for x in range(cx - 2, cx + FOOT_W + 2):
                if is_floor(v10[y, x]):
                    v10[y, x] = shade(v10[y, x], -18)

    place(LEFT_FOOT_X)
    place(RIGHT_FOOT_X)


def grout_rows(im, x0, x1, y0, y1):
    sl = im[y0:y1, x0:x1].astype(np.int16)
    m = sl.mean(axis=(1, 2))
    med = np.median(m)
    return [y0 + i for i, v in enumerate(m) if v < med - 6]


def vgrout_xs(im, x0, x1, y, med_delta=8):
    row = im[y, x0:x1].astype(np.int16).mean(axis=1)
    med = np.median(row)
    return [x0 + j for j, v in enumerate(row) if v < med - med_delta]


def verify_grout(v10):
    far_l = grout_rows(v10, 20, 80, 490, 680)
    strip_l = grout_rows(v10, 110, 150, 490, 680)
    far_r = grout_rows(v10, 1200, 1260, 490, 680)
    strip_r = grout_rows(v10, 1130, 1158, 490, 680)
    print(f"  grout far-L {far_l}")
    print(f"  grout strip-L {strip_l}")
    print(f"  grout far-R {far_r}")
    print(f"  grout strip-R {strip_r}")
    extra_l = set(strip_l) - set(far_l)
    extra_r = set(strip_r) - set(far_r)
    missing_l = set(far_l) - set(strip_l)
    missing_r = set(far_r) - set(strip_r)
    print(f"  extra-in-strip L={sorted(extra_l)} R={sorted(extra_r)}")
    print(f"  missing-in-strip L={sorted(missing_l)} R={sorted(missing_r)}")

    # V grout in the left strip should keep leaning (x decreases as y grows)
    print("  V grout strip-L (every 20y):")
    xs_prev = None
    lean_ok = True
    for y in range(490, 541, 10):
        xs = vgrout_xs(v10, 100, 155, y)
        print(f"    y={y} {xs[:6]}")
        if xs and xs_prev:
            if np.median(xs[:3]) > np.median(xs_prev[:3]) + 1:
                lean_ok = False
        if xs:
            xs_prev = xs
    print("  V grout strip-R (every 20y, expect none / far from desk):")
    for y in range(490, 661, 20):
        xs = vgrout_xs(v10, 1115, 1160, y)
        print(f"    y={y} {xs[:8]}")

    ok = not extra_l and not extra_r and not missing_l and not missing_r and lean_ok
    return ok


def verify_feet(v10):
    ok = True
    for cx, name in ((LEFT_FOOT_X, "L"), (RIGHT_FOOT_X, "R")):
        # no floor between panel outline and foot
        gap = any(is_floor(v10[BOT_PANEL_Y1 + 1, x]) for x in range(cx, cx + FOOT_W))
        # foot occupies 4 rows
        ink_top = all(is_ink(v10[BOT_PANEL_Y1 + 1, x]) or not is_floor(v10[BOT_PANEL_Y1 + 1, x])
                      for x in range(cx, cx + FOOT_W))
        print(f"  foot {name} gap={gap} attached={ink_top} "
              f"y663={tuple(int(c) for c in v10[663, cx+2])} "
              f"y666={tuple(int(c) for c in v10[666, cx+2])} "
              f"y667_floor={is_floor(v10[667, cx-1])}")
        if gap:
            ok = False
    return ok


def verify_unchanged(v10, v9):
    """Everything outside the three fix regions must stay v9."""
    mask = np.zeros(v10.shape[:2], dtype=bool)
    mask[490:681, 100:163] = True
    mask[490:681, 1115:1160] = True
    mask[BOT_TOP_Y0:BOT_TOP_Y1 + 1, LEFT_GRAIN[0]:LEFT_GRAIN[1] + 1] = True
    mask[BOT_TOP_Y0:BOT_TOP_Y1 + 1, RIGHT_GRAIN[0]:RIGHT_GRAIN[1] + 1] = True
    for cx in (LEFT_FOOT_X, RIGHT_FOOT_X):
        mask[BOT_PANEL_Y1 + 1:BOT_PANEL_Y1 + 12, cx - 2:cx + FOOT_W + 2] = True
    diff = np.any(v10 != v9, axis=2) & ~mask
    n = int(diff.sum())
    ys, xs = np.where(diff)
    print(f"  pixels changed outside fix regions: {n}")
    if n:
        print(f"    bbox x={xs.min()}-{xs.max()} y={ys.min()}-{ys.max()}")
        for i in range(min(8, n)):
            print(f"    ({xs[i]},{ys[i]}) v9={tuple(int(c) for c in v9[ys[i], xs[i]])} "
                  f"v10={tuple(int(c) for c in v10[ys[i], xs[i]])}")
    return n == 0


def crop4(im, box, z=4):
    c = Image.fromarray(im).crop(box)
    return c.resize((c.size[0] * z, c.size[1] * z), Image.Resampling.NEAREST)


def side_by_side(a, b):
    out = Image.new("RGB", (a.size[0] + b.size[0] + 8, max(a.size[1], b.size[1])), (32, 32, 32))
    out.paste(a, (0, 0))
    out.paste(b, (a.size[0] + 8, 0))
    return out


def main():
    print("Polishing hutong empty v9 → v10…")
    v8_path = next(p for p in V8_CANDIDATES if p.exists())
    v9 = np.array(Image.open(V9).convert("RGB"))
    v8 = np.array(Image.open(v8_path).convert("RGB"))
    v10 = v9.copy()

    restore_floor_strips(v10, v8)
    continue_end_grain(v10, v9)
    attach_feet(v10)

    dark_l = [(x, y) for y in range(BOT_TOP_Y0, BOT_TOP_Y1 + 1)
              for x in range(LEFT_GRAIN[0], LEFT_GRAIN[1] + 1)
              if is_wood(v10[y, x]) and int(v10[y, x, 0]) < 140]
    dark_r = [(x, y) for y in range(BOT_TOP_Y0, BOT_TOP_Y1 + 1)
              for x in range(RIGHT_GRAIN[0], RIGHT_GRAIN[1] + 1)
              if is_wood(v10[y, x]) and int(v10[y, x, 0]) < 140]
    print(f"  dark grain pixels L={len(dark_l)} R={len(dark_r)}")

    ok_g = verify_grout(v10)
    ok_f = verify_feet(v10)
    ok_u = verify_unchanged(v10, v9)
    print("  grout verify", "OK" if ok_g else "CHECK")
    print("  feet verify", "OK" if ok_f else "CHECK")
    print("  unchanged verify", "OK" if ok_u else "CHECK")
    print("  grain verify", "OK" if not dark_l and not dark_r else "CHECK")

    img = Image.fromarray(v10)
    v2 = img.crop((0, CROP_Y, img.size[0], img.size[1]))
    assert img.size == (1280, 720)
    assert v2.size == (1280, 544)
    assert np.array_equal(np.array(v2), v10[CROP_Y:])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    p1 = OUT_DIR / "hutong_empty_view1_v10.png"
    p2 = OUT_DIR / "hutong_empty_view2_v10.png"
    img.save(p1)
    v2.save(p2)
    print(f"  wrote {p1.relative_to(ROOT)}")
    print(f"  wrote {p2.relative_to(ROOT)}")

    ART.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    img.save(ART / "hutong_empty_view1_v10.png")
    v2.save(ART / "hutong_empty_view2_v10.png")
    img.save(PREVIEW / "hutong_empty_view1_v10.png")
    v2.save(PREVIEW / "hutong_empty_view2_v10.png")

    ends = {
        "left": (90, 488, 220, 690),
        "right": (1060, 488, 1200, 690),
    }
    for name, box in ends.items():
        b = crop4(v9, box, 4)
        a = crop4(v10, box, 4)
        b.save(ART / f"hutong_v9_{name}_end_4x.png")
        a.save(ART / f"hutong_v10_{name}_end_4x_b.png")
        side_by_side(b, a).save(ART / f"hutong_v9v10_{name}_end_4x_b.png")
        print(f"  crop {name}")

    print("Done v10.")


if __name__ == "__main__":
    main()
