#!/usr/bin/env python3
"""Derive the eight-person Soul Knight cast from concept sheets.

Concept sheets (NOT committed — live in cyber-hutong-refs/sk-cast or uploads/):
  16:9, six poses L→R: side-right, front, back, walk-right, sit-front+chair,
  sit-back+chair. AI-upscaled, not a clean grid.

Pipeline:
  1. Segment each pose, mode-downsample at the shared integer scale (6).
  2. Pad to one 24×40 canvas, feet on the same baseline.
  3. Snap to a shared ~28-color palette. Solid black 1px outline.
  4. Drop or fade the oval ground shadow. Sit frames are person-only.
  5. Hand-clean: 1×2 eyes, identity details (off-shoulder, caramel tips,
     08 center-part + longer hair, etc.).

Do not write the concept PNGs into the repo.
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pxlib import ASSETS, PREVIEW, ROOT, new, zoom  # noqa: E402

ARTIFACT = Path("/opt/cursor/artifacts/screenshots")
REVIEW = Path("/tmp/sk-cast-review")
REF_DIRS = (
    ROOT / "cyber-hutong-refs" / "sk-cast",
    Path("/home/ubuntu/.cursor/projects/workspace/uploads"),
)

SCALE = 6
CW, CH = 24, 40
SHADOW_A = 110
INK = (0, 0, 0, 255)
SKIN = (246, 208, 180, 255)
SKIN_S = (222, 168, 136, 255)
SKIN_H = (255, 230, 208, 255)
HAIR_K = (18, 16, 18, 255)
HAIR_K2 = (36, 32, 36, 255)
HAIR_BR = (92, 62, 42, 255)
HAIR_BR2 = (122, 84, 56, 255)
CARAMEL = (196, 148, 96, 255)
CARAMEL2 = (168, 118, 72, 255)
WHITE = (246, 244, 240, 255)
WHITE_S = (214, 208, 200, 255)
PINK = (236, 176, 184, 255)
PINK_S = (210, 140, 150, 255)
GOLD = (220, 176, 72, 255)
BLUE = (164, 196, 226, 255)
GRAY = (118, 118, 124, 255)
GRAY_S = (86, 86, 92, 255)
GRAY_L = (168, 168, 174, 255)
SHIRT_BLK = (28, 28, 32, 255)
PANTS = (24, 24, 28, 255)
GLASS = (70, 70, 76, 255)
STUBBLE = (200, 156, 126, 255)
KNIT = (44, 42, 48, 255)
MOUTH = (198, 118, 124, 255)
BLUSH = (236, 150, 154, 255)

LOCKED = [
    INK, SKIN, SKIN_S, SKIN_H, HAIR_K, HAIR_K2, HAIR_BR, HAIR_BR2,
    CARAMEL, CARAMEL2, WHITE, WHITE_S, PINK, PINK_S, GOLD, BLUE,
    GRAY, GRAY_S, GRAY_L, SHIRT_BLK, PANTS, GLASS, STUBBLE, KNIT, MOUTH, BLUSH,
    (48, 48, 52, 255), (80, 52, 40, 255), (140, 140, 146, 255),
    (40, 36, 32, 255),
]

CAST_IDS = [f"cast_0{i}" for i in range(1, 9)]
POSE_NAMES = ("side", "front", "back", "walk", "sitF", "sitB")


def find_sheet(n: int) -> Path:
    stem = f"cast0{n}_sk"
    for d in REF_DIRS:
        if not d.exists():
            continue
        exact = d / f"{stem}.png"
        if exact.exists():
            return exact
        hits = sorted(d.glob(f"{stem}*.png"))
        if hits:
            return hits[0]
    raise FileNotFoundError(f"missing concept sheet for cast_0{n}")


def fg_mask(rgb: np.ndarray, thr: int = 22) -> np.ndarray:
    corners = [rgb[2, 2], rgb[2, -3], rgb[8, 8]]
    bg = np.median(np.stack(corners), axis=0)
    diff = np.abs(rgb.astype(np.int16) - bg.astype(np.int16)).sum(axis=2)
    return diff > thr


def segment_poses(path: Path) -> list[np.ndarray]:
    rgb = np.array(Image.open(path).convert("RGB"))[:520]
    mask = fg_mask(rgb)
    col = mask.any(axis=0)
    runs, on, s = [], False, 0
    for i, v in enumerate(col):
        if v and not on:
            s, on = i, True
        elif (not v) and on:
            if i - s > 20:
                runs.append((s, i - 1))
            on = False
    if on and len(col) - s > 20:
        runs.append((s, len(col) - 1))
    merged: list[tuple[int, int]] = []
    for a, b in runs:
        if merged and a - merged[-1][1] < 10:
            merged[-1] = (merged[-1][0], b)
        else:
            merged.append((a, b))
    ys = np.where(mask.any(axis=1))[0]
    y0, y1 = int(ys.min()), int(ys.max())
    figs = []
    for a, b in merged:
        sub = mask[y0:y1 + 1, a:b + 1]
        ys2, xs2 = np.where(sub)
        if len(xs2) < 50:
            continue
        x0, x1 = a + int(xs2.min()), a + int(xs2.max())
        yy0, yy1 = y0 + int(ys2.min()), y0 + int(ys2.max())
        crop = rgb[yy0:yy1 + 1, x0:x1 + 1]
        m = mask[yy0:yy1 + 1, x0:x1 + 1]
        rgba = np.zeros((crop.shape[0], crop.shape[1], 4), np.uint8)
        rgba[..., :3] = crop
        rgba[..., 3] = np.where(m, 255, 0)
        figs.append(rgba)
    if len(figs) != 6:
        raise RuntimeError(f"{path.name}: expected 6 poses, got {len(figs)}")
    return figs


def mode_down(rgba: np.ndarray, scale: int = SCALE) -> np.ndarray:
    h, w = rgba.shape[:2]
    nh, nw = h // scale, w // scale
    out = np.zeros((nh, nw, 4), np.uint8)
    for y in range(nh):
        for x in range(nw):
            block = rgba[y * scale:(y + 1) * scale, x * scale:(x + 1) * scale].reshape(-1, 4)
            opaque = block[block[:, 3] > 80]
            if len(opaque) < (scale * scale) // 3:
                continue
            q = (opaque[:, :3] // 10) * 10
            rgb, _ = Counter(map(tuple, q)).most_common(1)[0]
            out[y, x] = (*rgb, 255)
    return out


def pad_canvas(src: np.ndarray, w: int = CW, h: int = CH) -> np.ndarray:
    """Feet-align onto the shared canvas. Clip extra shadow, not the head."""
    out = np.zeros((h, w, 4), np.uint8)
    sh, sw = src.shape[:2]
    if sh > h:
        src = src[:h]
        sh = h
    if sw > w:
        extra = sw - w
        src = src[:, extra // 2: extra // 2 + w]
        sw = w
    x = (w - sw) // 2
    y = h - sh
    out[y:y + sh, x:x + sw] = src
    return out


def dist(a, b):
    return abs(int(a[0]) - b[0]) + abs(int(a[1]) - b[1]) + abs(int(a[2]) - b[2])


def snap_palette(c):
    if c[3] < 80:
        return (0, 0, 0, 0)
    best, bd = LOCKED[0], 10**9
    for p in LOCKED:
        d = dist(c, p)
        if d < bd:
            best, bd = p, d
    return best


def quantize(arr: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    out = np.zeros_like(arr)
    for y in range(h):
        for x in range(w):
            out[y, x] = snap_palette(tuple(arr[y, x]))
    return out


def is_opaque(arr, x, y):
    return 0 <= y < arr.shape[0] and 0 <= x < arr.shape[1] and arr[y, x, 3] > 80


def strip_outline(arr: np.ndarray) -> np.ndarray:
    """Remove a 1px ink ring so we can redraw a single outline."""
    h, w = arr.shape[:2]
    kill = []
    for y in range(h):
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            if tuple(arr[y, x][:3]) != INK[:3]:
                continue
            if any(
                not is_opaque(arr, x + dx, y + dy)
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
            ):
                kill.append((x, y))
    for x, y in kill:
        arr[y, x] = (0, 0, 0, 0)
    return arr


def outline_black(arr: np.ndarray) -> np.ndarray:
    strip_outline(arr)
    h, w = arr.shape[:2]
    extra = []
    for y in range(h):
        for x in range(w):
            if arr[y, x, 3] > 80:
                continue
            if any(is_opaque(arr, x + dx, y + dy) for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                extra.append((x, y))
    for x, y in extra:
        arr[y, x] = INK
    return arr


def fill_holes(arr: np.ndarray) -> np.ndarray:
    """Fill enclosed transparent pixels with a neighbor's color (no hollow bodies)."""
    h, w = arr.shape[:2]
    trans = arr[:, :, 3] < 80
    seen = np.zeros((h, w), bool)
    q = []
    for x in range(w):
        for y in (0, h - 1):
            if trans[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if trans[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((x, y))
    i = 0
    while i < len(q):
        x, y = q[i]
        i += 1
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if 0 <= ny < h and 0 <= nx < w and trans[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((nx, ny))
    for y in range(h):
        for x in range(w):
            if trans[y, x] and not seen[y, x]:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    if is_opaque(arr, x + dx, y + dy):
                        arr[y, x] = arr[y + dy, x + dx]
                        break
    return arr


def drop_stray(arr: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    seen = np.zeros((h, w), bool)
    best = []
    for y in range(h):
        for x in range(w):
            if seen[y, x] or arr[y, x, 3] < 80:
                continue
            stack = [(x, y)]
            seen[y, x] = True
            comp = []
            while stack:
                cx, cy = stack.pop()
                comp.append((cx, cy))
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and arr[ny, nx, 3] > 80:
                        seen[ny, nx] = True
                        stack.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    keep = set(best)
    for y in range(h):
        for x in range(w):
            if arr[y, x, 3] > 80 and (x, y) not in keep:
                arr[y, x] = (0, 0, 0, 0)
    return arr


def fade_shadow(arr: np.ndarray) -> np.ndarray:
    """Bottom gray oval → semi-transparent. Sit frames call clear_shadow."""
    h, w = arr.shape[:2]
    for y in range(h - 4, h):
        for x in range(w):
            r, g, b, a = arr[y, x]
            if a < 80:
                continue
            if abs(int(r) - int(g)) < 28 and abs(int(g) - int(b)) < 28 and 70 < r < 200:
                arr[y, x] = (22, 18, 22, SHADOW_A)
    return arr


def clear_shadow(arr: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    for y in range(h - 4, h):
        for x in range(w):
            r, g, b, a = arr[y, x]
            if a < 80:
                continue
            if abs(int(r) - int(g)) < 28 and abs(int(g) - int(b)) < 28 and 70 < r < 200:
                arr[y, x] = (0, 0, 0, 0)
            if a == SHADOW_A:
                arr[y, x] = (0, 0, 0, 0)
    return arr


def face_center(arr: np.ndarray):
    ys, xs = [], []
    for y in range(arr.shape[0]):
        for x in range(arr.shape[1]):
            r, g, b, a = arr[y, x]
            if a > 80 and r > 180 and g > 140 and b > 110 and r >= g - 5:
                xs.append(x)
                ys.append(y)
    if not xs:
        return arr.shape[1] // 2, 14
    return int(round(sum(xs) / len(xs))), int(round(sum(ys) / len(ys)))


def put(arr, x, y, c):
    if 0 <= y < arr.shape[0] and 0 <= x < arr.shape[1]:
        arr[y, x] = c


def clean_eyes(arr: np.ndarray, glasses: bool = False) -> np.ndarray:
    """1×2 black bars, symmetric. Optional 1px glasses."""
    cx, cy = face_center(arr)
    ey = max(11, min(cy, 16))
    gap = 2
    lx, rx = cx - gap - 1, cx + gap + 1
    for y in range(ey - 1, ey + 3):
        for x in range(lx - 1, rx + 2):
            if not (0 <= y < arr.shape[0] and 0 <= x < arr.shape[1]):
                continue
            r, g, b, a = arr[y, x]
            if a > 80 and r > 160 and g > 120:
                put(arr, x, y, SKIN)
    for x in (lx, rx):
        put(arr, x, ey, INK)
        put(arr, x, ey + 1, INK)
    if glasses:
        put(arr, lx - 1, ey, GLASS)
        put(arr, lx - 1, ey + 1, GLASS)
        put(arr, rx + 1, ey, GLASS)
        put(arr, rx + 1, ey + 1, GLASS)
        put(arr, (lx + rx) // 2, ey, GLASS)
        put(arr, (lx + rx) // 2, ey + 1, SKIN)
    put(arr, cx, ey + 4, MOUTH)
    put(arr, cx - 2, ey + 3, BLUSH)
    put(arr, cx + 2, ey + 3, BLUSH)
    return arr


def make_sit(idle: np.ndarray) -> np.ndarray:
    """Person only: keep head+torso, drop legs/chair/shadow."""
    sit = idle.copy()
    h, w = sit.shape[:2]
    # pants start ~ row 28 on these sprites; keep a short hip
    cut = 29
    for y in range(cut, h):
        sit[y] = 0
    # 2px hip so the silhouette still reads seated
    for y in range(cut, min(cut + 2, h)):
        for x in range(w):
            if idle[min(y, h - 5), x, 3] > 80 and max(idle[min(y, h - 5), x, :3]) < 80:
                sit[y, x] = PANTS
    clear_shadow(sit)
    return sit


def bob(arr: np.ndarray) -> np.ndarray:
    out = np.zeros_like(arr)
    out[1:] = arr[:-1]
    return out


def walk_front(idle: np.ndarray, frame: int) -> np.ndarray:
    wlk = idle.copy()
    h, w = wlk.shape[:2]
    dy = 1 if frame == 0 else 0
    # nudge one leg up
    x0, x1 = w // 2 - 3, w // 2 + 2
    if frame == 0:
        x0, x1 = w // 2 - 4, w // 2 - 1
    else:
        x0, x1 = w // 2 + 1, w // 2 + 4
    band = wlk[30:37, x0:x1].copy()
    wlk[30:37, x0:x1] = 0
    wlk[29 + dy:36 + dy, x0:x1] = band
    return wlk


def walk_side_1(walk0: np.ndarray) -> np.ndarray:
    """Second walk-side frame: 1px bob so the stride reads without breaking legs."""
    return bob(walk0)


def patch_01(frames: dict) -> None:
    """Long side-part, white off-shoulder, white flower earring."""
    for key in ("front", "sitF", "walk"):
        a = frames[key]
        cx, cy = face_center(a)
        # off-shoulder: top shirt row, outer pixels → skin
        for y in range(20, 27):
            for x in range(a.shape[1]):
                r, g, b, al = a[y, x]
                if al > 80 and r > 200 and g > 190:
                    if x <= cx - 3 or x >= cx + 3:
                        a[y, x] = SKIN if y < 24 else SKIN_S
        # side-part: 1px notch at the hairline, not a streak
        put(a, cx + 3, 5, SKIN_S)
        # flower earring touching right jaw
        put(a, cx + 6, cy + 2, WHITE)
        put(a, cx + 7, cy + 3, WHITE)
        put(a, cx + 6, cy + 3, WHITE)
        clean_eyes(a)
    for key in ("side",):
        a = frames[key]
        for y in range(20, 23):
            for x in range(a.shape[1]):
                r, g, b, al = a[y, x]
                if al > 80 and r > 200 and g > 190 and x < a.shape[1] // 2:
                    a[y, x] = SKIN
        put(a, 16, 16, WHITE)


def patch_02(frames: dict) -> None:
    for key in ("front", "sitF", "walk"):
        a = frames[key]
        clean_eyes(a)
        cx, cy = face_center(a)
        # light-blue collar under the chin
        put(a, cx - 1, cy + 7, BLUE)
        put(a, cx, cy + 7, BLUE)
        put(a, cx + 1, cy + 7, BLUE)
    put(frames["side"], 12, 20, BLUE)


def patch_03(frames: dict) -> None:
    for key in ("front", "sitF", "walk"):
        a = frames[key]
        clean_eyes(a)
        cx, cy = face_center(a)
        put(a, cx - 6, cy + 2, GOLD)
        put(a, cx + 6, cy + 2, GOLD)
    put(frames["side"], 16, 16, GOLD)


def draw_black_glasses(arr: np.ndarray) -> None:
    """Solid black round frames, readable at 1x. Stamp overwrites the eye band."""
    cx, cy = face_center(arr)
    ey = 14 if cy >= 13 else max(13, min(cy, 14))
    # 13×4 stamp, #=frame/pupil, .=lens skin, -=bridge
    stamp = [
        "  ###   ###  ",
        " #.#.# #.#.# ",
        " #.#.#-#.#.# ",
        "  ###   ###  ",
    ]
    x0 = cx - len(stamp[0]) // 2
    for dy, row in enumerate(stamp):
        for dx, ch in enumerate(row):
            x, y = x0 + dx, ey - 1 + dy
            if ch == "#":
                put(arr, x, y, INK)
            elif ch in ".-":
                put(arr, x, y, SKIN)
    put(arr, cx, ey + 1, INK)  # bridge pixel
    put(arr, cx - 2, ey + 4, BLUSH)
    put(arr, cx + 2, ey + 4, BLUSH)
    put(arr, cx, ey + 5, MOUTH)


def patch_04(frames: dict) -> None:
    for key in ("front", "sitF", "walk"):
        clean_eyes(frames[key], glasses=False)
        draw_black_glasses(frames[key])
    a = frames["side"]
    cx, cy = face_center(a)
    ey = max(12, min(cy, 14))
    # round black lens + temple stem, readable in profile
    for y, xs in ((ey - 1, (cx + 1, cx + 2, cx + 3)),
                  (ey,     (cx, cx + 1, cx + 3, cx + 4)),
                  (ey + 1, (cx, cx + 1, cx + 3, cx + 4)),
                  (ey + 2, (cx + 1, cx + 2, cx + 3))):
        for x in xs:
            put(a, x, y, INK)
    put(a, cx + 2, ey, SKIN)
    put(a, cx + 2, ey + 1, INK)
    for x in range(cx + 5, cx + 8):
        put(a, x, ey, INK)


def patch_05(frames: dict) -> None:
    for key in ("front", "sitF", "walk"):
        a = frames[key]
        clean_eyes(a)
        cx, cy = face_center(a)
        put(a, cx - 6, cy + 2, GOLD)
        put(a, cx + 6, cy + 2, GOLD)
        put(a, cx - 1, cy + 10, GOLD)
        put(a, cx + 1, cy + 12, GOLD)
    put(frames["side"], 16, 16, GOLD)


def _is_skin(c):
    r, g, b, a = (c[0], c[1], c[2], c[3] if len(c) > 3 else 255)
    return a > 80 and r > 180 and g > 140 and b > 110 and r >= g - 10


def _is_stubble(c):
    return tuple(c)[:3] == STUBBLE[:3]


def shave_head(arr: np.ndarray) -> None:
    """Near-bald: skin-tone scalp, faint stubble, no hair volume.

    Converts the whole head band (not just the crown). Idempotent.
    """
    h, w = arr.shape[:2]

    def is_pupil(x, y):
        if tuple(arr[y, x][:3]) != INK[:3] or arr[y, x, 3] < 80 or y < 8:
            return False
        skin_n = 0
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if 0 <= ny < h and 0 <= nx < w and _is_skin(arr[ny, nx]):
                skin_n += 1
        return skin_n >= 2

    for y in range(0, min(16, h)):
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            if _is_skin(arr[y, x]) or _is_stubble(arr[y, x]):
                continue
            if is_pupil(x, y):
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            mx = max(r, g, b)
            # gray / brown / dark hair — suit starts ~row 17
            if mx < 180:
                arr[y, x] = STUBBLE if y <= 2 else SKIN


def patch_06(frames: dict) -> None:
    for key in frames:
        shave_head(frames[key])
    for key in ("front", "sitF", "walk"):
        clean_eyes(frames[key])


def patch_07(frames: dict) -> None:
    """Add caramel tips the concept missed."""
    for key in frames:
        a = frames[key]
        h, w = a.shape[:2]
        for x in list(range(0, 8)) + list(range(w - 8, w)):
            ys = [y for y in range(h) if a[y, x, 3] > 80 and max(a[y, x, :3]) < 120 and y < 30]
            if not ys:
                continue
            tip = max(ys)
            for y in range(max(0, tip - 1), tip + 1):
                if a[y, x, 3] > 80:
                    a[y, x] = CARAMEL if y >= tip else CARAMEL2
        if key in ("front", "sitF", "walk"):
            clean_eyes(a)


def patch_08(frames: dict) -> None:
    """Center part, longer hair, no earring, crew-neck black sweater."""
    for key in frames:
        a = frames[key]
        h, w = a.shape[:2]
        cx = w // 2
        # center part on top of the crown
        if key in ("front", "sitF", "walk", "back", "sitB"):
            put(a, cx, 3, SKIN)
            put(a, cx, 4, SKIN_S)
            put(a, cx, 5, HAIR_K2)
        # drop any earring-like white near the jaw
        if key in ("front", "sitF", "walk", "side"):
            for y in range(12, 22):
                for x in range(w):
                    r, g, b, al = a[y, x]
                    if al > 80 and r > 220 and g > 220 and b > 220 and (x < 6 or x > w - 7):
                        a[y, x] = HAIR_K
        # hair to the knees — side falls continue past the thigh
        if key in ("front", "back", "side", "walk"):
            for y in range(32, 37):
                for x in list(range(3, 7)) + list(range(w - 7, w - 3)):
                    if a[min(y, 31), x, 3] > 80 or a[31, x, 3] > 80:
                        put(a, x, y, HAIR_K)
        if key in ("front", "sitF", "walk"):
            clean_eyes(a)
        refine_08_sweater(a, key)


def refine_08_sweater(arr: np.ndarray, key: str) -> None:
    """White collar edge, ribbed collar/cuffs, thin necklace. Clean at 1x."""
    h, w = arr.shape[:2]
    cx = w // 2
    _, cy = face_center(arr)
    neck = min(h - 6, cy + 7)
    front = key in ("front", "sitF", "walk")

    def is_dark(x, y):
        if not (0 <= y < h and 0 <= x < w):
            return False
        r, g, b, a = arr[y, x]
        return a > 80 and max(r, g, b) < 70

    def already_collared():
        for y in range(16, 24):
            whites = sum(
                1 for x in range(cx - 3, cx + 4)
                if arr[y, x, 3] > 80 and int(arr[y, x, 0]) > 220 and int(arr[y, x, 1]) > 220
            )
            if whites >= 2:
                return True
        return False

    if already_collared():
        return

    if front:
        collar_y = neck
        for y in range(neck - 1, min(neck + 4, h)):
            if sum(1 for x in range(cx - 2, cx + 3) if is_dark(x, y)) >= 3:
                collar_y = y
                break
        for x in range(cx - 2, cx + 3):
            if is_dark(x, collar_y):
                put(arr, x, collar_y, WHITE)
        for x in range(cx - 3, cx + 4):
            if is_dark(x, collar_y + 1):
                put(arr, x, collar_y + 1, KNIT if x % 2 == 0 else SHIRT_BLK)
        put(arr, cx - 1, collar_y + 2, WHITE)
        put(arr, cx + 1, collar_y + 2, WHITE)
        put(arr, cx, collar_y + 3, WHITE)
        for y in range(collar_y + 4, min(28, h)):
            for x in (cx - 2, cx + 2):
                if is_dark(x, y):
                    arr[y, x] = KNIT
        for y in range(24, min(28, h)):
            for x in (cx - 5, cx + 5):
                if is_dark(x, y):
                    arr[y, x] = KNIT
        return

    # back / sit-back: tiny white nape (not a belt) + two torso ribs
    nape = 18 if key in ("back", "sitB") else 17
    put(arr, cx, nape, WHITE)
    put(arr, cx - 1, nape, WHITE)
    put(arr, cx + 1, nape, WHITE)
    for x in range(cx - 2, cx + 3):
        if is_dark(x, nape + 1):
            put(arr, x, nape + 1, KNIT if x % 2 == 0 else SHIRT_BLK)
    for y in range(nape + 3, min(27, h)):
        for x in (cx - 2, cx + 2):
            if is_dark(x, y):
                arr[y, x] = KNIT


PATCH = {
    1: patch_01, 2: patch_02, 3: patch_03, 4: patch_04,
    5: patch_05, 6: patch_06, 7: patch_07, 8: patch_08,
}


def process_one(n: int) -> dict[str, Image.Image]:
    figs = segment_poses(find_sheet(n))
    raw = {name: pad_canvas(mode_down(fig)) for name, fig in zip(POSE_NAMES, figs)}
    for k in list(raw):
        raw[k] = quantize(raw[k])
        fade_shadow(raw[k])
    PATCH[n](raw)
    raw["sitF"] = make_sit(raw["front"])
    raw["sitB"] = make_sit(raw["back"])
    PATCH[n](raw)
    clear_shadow(raw["sitF"])
    clear_shadow(raw["sitB"])
    frames = {
        "idle_front": raw["front"],
        "idle_front_1": bob(raw["front"]),
        "idle_side": raw["side"],
        "idle_back": raw["back"],
        "walk_side_0": raw["walk"],
        "walk_side_1": walk_side_1(raw["walk"]),
        "walk_0": walk_front(raw["front"], 0),
        "walk_1": walk_front(raw["front"], 1),
        "sit_front": raw["sitF"],
        "sit_back": raw["sitB"],
    }
    for im in frames.values():
        drop_stray(im)
        fill_holes(im)
        outline_black(im)
        fill_holes(im)
    return {k: Image.fromarray(v, "RGBA") for k, v in frames.items()}


def _font(size=12):
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    try:
        return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()
    except Exception:
        return ImageFont.load_default()


def make_lineup(fronts: list[Image.Image]) -> Image.Image:
    """idle_front of all 8 at 1x and at 6x NN, labelled."""
    pad, title = 12, 36
    cell_1 = CW + 8
    cell_6 = CW * 6 + 12
    W = pad + 8 * max(cell_1, cell_6)
    H = title + CH + 16 + CH * 6 + 28
    out = Image.new("RGBA", (W, H), (214, 210, 204, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 8), "cast_sk lineup  idle_front  1x / 6x NN", fill=(60, 44, 40, 255), font=_font(14))
    for i, im in enumerate(fronts):
        x = pad + i * max(cell_1, cell_6)
        out.paste(im, (x + 8, title), im)
        big = zoom(im, 6)
        out.paste(big, (x, title + CH + 10), big)
        d.text((x, title + CH + 10 + CH * 6 + 4), f"0{i+1}", fill=(90, 50, 56, 255), font=_font(12))
    return out


def make_frames(all_frames: list[dict]) -> Image.Image:
    keys = [
        "idle_front", "idle_front_1", "idle_side", "idle_back",
        "walk_0", "walk_1", "walk_side_0", "walk_side_1",
        "sit_front", "sit_back",
    ]
    scale = 4
    pad, title, cap = 10, 28, 12
    cw, ch = CW * scale + 8, CH * scale + cap
    W = pad + len(keys) * cw
    H = title + 8 * ch + 8
    out = Image.new("RGBA", (W, H), (214, 210, 204, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 6), "cast_sk frames  x4", fill=(60, 44, 40, 255), font=_font(13))
    for r, frames in enumerate(all_frames):
        for c, k in enumerate(keys):
            big = zoom(frames[k], scale)
            x, y = pad + c * cw, title + r * ch
            out.paste(big, (x, y), big)
            if r == 0:
                d.text((x, y + CH * scale + 1), k.replace("_", " "), fill=(90, 80, 74, 255), font=_font(9))
    return out


def write_cast_md():
    text = """# Cast · 8 Soul Knight chibi（concept sheets → true low-res）

> 24×40 shared canvas · integer downsample ×6 from 16:9 concept sheets · ~28-color palette · 1px black outline.
> Concept sheets are **not** in git (same as photo refs).

## 辨认点

| ID | 像素辨认点 |
|----|------------|
| `cast_01` | 侧分长黑发 · 白露肩 · 白花耳饰 |
| `cast_02` | 男 · 短刺发 · 黑毛衣 · 浅蓝领 |
| `cast_03` | 齐下巴波浪波波 · 粉针织 · 金圈 |
| `cast_04` | 直波波刘海 · 黑圆框眼镜 · 白卫衣 |
| `cast_05` | 齐肩微卷 · 黑西装金扣 · 金圈 |
| `cast_06` | 男 · 近光头浅茬（肤色头皮）· 深灰西装 · 黑衬衫 |
| `cast_07` | 褐长发浅焦糖发尾 · 灰西装 |
| `cast_08` | 中分超长黑直（及膝）· 黑毛衣罗纹领/细项链 · 无耳饰 |

坐姿是人（不带椅）。胡同椅子由房间画。
"""
    (ROOT / "design" / "cast.md").write_text(text, encoding="utf-8")


def enclosed_holes(img: Image.Image) -> int:
    w, h = img.size
    px = img.load()

    def trans(x, y):
        return px[x, y][3] < 80

    seen = [[False] * w for _ in range(h)]
    q = []
    for x in range(w):
        for y in (0, h - 1):
            if trans(x, y) and not seen[y][x]:
                seen[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if trans(x, y) and not seen[y][x]:
                seen[y][x] = True
                q.append((x, y))
    i = 0
    while i < len(q):
        x, y = q[i]
        i += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and trans(nx, ny) and not seen[ny][nx]:
                seen[ny][nx] = True
                q.append((nx, ny))
    return sum(1 for y in range(h) for x in range(w) if trans(x, y) and not seen[y][x])


def main():
    PREVIEW.mkdir(parents=True, exist_ok=True)
    ARTIFACT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)

    all_frames = []
    fronts = []
    for n in range(1, 9):
        cid = f"cast_0{n}"
        print(f"  {cid} from {find_sheet(n).name}")
        frames = process_one(n)
        dest = ASSETS / "characters" / cid
        dest.mkdir(parents=True, exist_ok=True)
        for name, im in frames.items():
            im.save(dest / f"{name}.png")
            zoom(im, 6).save(REVIEW / f"{cid}_{name}_x6.png")
        fronts.append(frames["idle_front"])
        all_frames.append(frames)
        holes = enclosed_holes(frames["idle_front"])
        print(f"    canvas {frames['idle_front'].size} holes={holes}")

    lineup = make_lineup(fronts)
    frames_sheet = make_frames(all_frames)
    for dest in (PREVIEW, ARTIFACT, REVIEW):
        lineup.save(dest / "cast_sk_lineup.png")
        frames_sheet.save(dest / "cast_sk_frames.png")
    lineup.save(ASSETS / "characters" / "cast_lineup.png")
    lineup.save(ASSETS / "characters" / "cast_sheet.png")
    lineup.save(PREVIEW / "cast_lineup.png")
    lineup.save(PREVIEW / "cast_sheet.png")
    frames_sheet.save(PREVIEW / "cast_frames.png")
    write_cast_md()
    print("Done SK cast (concept sheets not written).")


if __name__ == "__main__":
    main()
