#!/usr/bin/env python3
"""HD Soul Knight cast — sample the concept at its native pixel block.

Concept sheets are AI-upscaled 1280×720 six-pose strips. Autocorr peaks at
4 screen px per art pixel, so a standing figure is ~32×60, not 16–20.

Pipeline:
  1. Segment the six poses.
  2. Mode-downsample at the detected block (SCALE=4) so every concept pixel
     survives.
  3. Snap to a shared ~48-color palette. Clean stray / AA specks only.
  4. Keep the concept's faces, hair, blush, outline, shading.
  5. Apply Laura's identity edits (04 black glasses, 06 shaved scalp,
     07 caramel tips, 08 center-part + white collar + necklace).
  6. Sit frames are person-only (chair stripped).

Do not write the concept PNGs into the repo.
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pxlib import ASSETS, PREVIEW, ROOT, zoom  # noqa: E402

ARTIFACT = Path("/opt/cursor/artifacts/screenshots")
REVIEW = Path("/tmp/sk-cast-hd")
REF_DIRS = (
    ROOT / "cyber-hutong-refs" / "sk-cast",
    Path("/home/ubuntu/.cursor/projects/workspace/uploads"),
)
HD_DIR = ASSETS / "characters_hd"

SCALE = 4
CW, CH = 40, 68
SHADOW_A = 110

INK = (16, 14, 18, 255)
SKIN = (246, 208, 180, 255)
SKIN_S = (222, 168, 136, 255)
SKIN_H = (255, 232, 210, 255)
HAIR_K = (20, 18, 20, 255)
HAIR_K2 = (40, 36, 40, 255)
HAIR_BR = (96, 66, 44, 255)
HAIR_BR2 = (128, 88, 58, 255)
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
GLASS = (18, 16, 20, 255)
STUBBLE = (200, 156, 126, 255)
KNIT = (44, 42, 48, 255)
MOUTH = (198, 118, 124, 255)
BLUSH = (236, 150, 154, 255)

SEED = [
    INK, SKIN, SKIN_S, SKIN_H, HAIR_K, HAIR_K2, HAIR_BR, HAIR_BR2,
    CARAMEL, CARAMEL2, WHITE, WHITE_S, PINK, PINK_S, GOLD, BLUE,
    GRAY, GRAY_S, GRAY_L, SHIRT_BLK, PANTS, GLASS, STUBBLE, KNIT, MOUTH, BLUSH,
]

CAST_IDS = [f"cast_0{i}" for i in range(1, 9)]
POSE_NAMES = ("side", "front", "back", "walk", "sitF", "sitB")
PALETTE: list[tuple] = []


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
    nh, nw = max(1, h // scale), max(1, w // scale)
    out = np.zeros((nh, nw, 4), np.uint8)
    need = (scale * scale) // 4
    for y in range(nh):
        for x in range(nw):
            block = rgba[y * scale:(y + 1) * scale, x * scale:(x + 1) * scale].reshape(-1, 4)
            opaque = block[block[:, 3] > 80]
            if len(opaque) < need:
                continue
            q = (opaque[:, :3] // 8) * 8
            rgb, _ = Counter(map(tuple, q)).most_common(1)[0]
            out[y, x] = (*rgb, 255)
    return out


def pad_canvas(src: np.ndarray, w: int = CW, h: int = CH) -> np.ndarray:
    out = np.zeros((h, w, 4), np.uint8)
    sh, sw = src.shape[:2]
    if sh > h:
        src = src[sh - h:]
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


def build_palette(arrays: list[np.ndarray], n: int = 48) -> list[tuple]:
    """Merge near colors; keep the most-used plus identity seeds."""
    counts: Counter = Counter()
    for arr in arrays:
        for px in arr.reshape(-1, 4):
            if px[3] > 80:
                counts[(int(px[0]), int(px[1]), int(px[2]))] += 1
    # merge buckets within distance 16
    merged: list[tuple[tuple, int]] = []
    for col, c in counts.most_common():
        placed = False
        for i, (mc, n_) in enumerate(merged):
            if dist(col, mc) <= 16:
                tot = n_ + c
                merged[i] = (
                    tuple(int((mc[k] * n_ + col[k] * c) / tot) for k in range(3)),
                    tot,
                )
                placed = True
                break
        if not placed:
            merged.append((col, c))
    merged.sort(key=lambda t: -t[1])
    pal = [(*c, 255) for c, _ in merged[: n - len(SEED)]]
    for s in SEED:
        if all(dist(s, p) > 10 for p in pal):
            pal.append(s)
    return pal[:n]


def snap_palette(c):
    if c[3] < 80:
        return (0, 0, 0, 0)
    best, bd = PALETTE[0], 10**9
    for p in PALETTE:
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


def drop_stray(arr: np.ndarray, min_size: int = 6) -> np.ndarray:
    h, w = arr.shape[:2]
    seen = np.zeros((h, w), bool)
    keep = set()
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
            if len(comp) >= min_size:
                keep.update(comp)
    for y in range(h):
        for x in range(w):
            if arr[y, x, 3] > 80 and (x, y) not in keep:
                arr[y, x] = (0, 0, 0, 0)
    return arr


def fill_holes(arr: np.ndarray) -> np.ndarray:
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


def _is_shadow(c):
    r, g, b, a = c
    if a < 80:
        return False
    return abs(int(r) - int(g)) < 28 and abs(int(g) - int(b)) < 28 and 70 < r < 210


def fade_shadow(arr: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    for y in range(max(0, h - 8), h):
        for x in range(w):
            if _is_shadow(arr[y, x]):
                arr[y, x] = (22, 18, 22, SHADOW_A)
    return arr


def clear_shadow(arr: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    for y in range(h):
        for x in range(w):
            r, g, b, a = arr[y, x]
            if a == SHADOW_A or (y > h - 10 and _is_shadow(arr[y, x])):
                arr[y, x] = (0, 0, 0, 0)
    return arr


def _is_skin(c):
    r, g, b, a = (c[0], c[1], c[2], c[3] if len(c) > 3 else 255)
    # skin is warm — white shirts/hoodies must not count
    return a > 80 and r > 190 and 120 < g < 220 and 90 < b < 200 and r > g + 10 and r > b + 20


def _is_dark(c):
    r, g, b, a = (c[0], c[1], c[2], c[3] if len(c) > 3 else 255)
    return a > 80 and max(r, g, b) < 70


def face_center(arr: np.ndarray):
    ys, xs = [], []
    for y in range(arr.shape[0]):
        for x in range(arr.shape[1]):
            if _is_skin(arr[y, x]):
                xs.append(x)
                ys.append(y)
    if not xs:
        return arr.shape[1] // 2, 22
    return int(round(sum(xs) / len(xs))), int(round(sum(ys) / len(ys)))


def put(arr, x, y, c):
    if 0 <= y < arr.shape[0] and 0 <= x < arr.shape[1]:
        arr[y, x] = c


def strip_chair(arr: np.ndarray) -> np.ndarray:
    """Drop stem / star / seat / shadow under the hips. Keep the person."""
    h, w = arr.shape[:2]
    # hip: last row with a wide torso (not a thin stem)
    hip = h - 1
    for y in range(h - 1, h // 2, -1):
        xs = [x for x in range(w) if arr[y, x, 3] > 80]
        if len(xs) >= 8:
            hip = y
            break
    # clear everything below a short hip
    cut = min(h, hip + 3)
    for y in range(cut, h):
        arr[y] = 0
    clear_shadow(arr)
    # thin vertical stem leftovers
    for y in range(max(0, hip - 2), cut):
        xs = [x for x in range(w) if arr[y, x, 3] > 80]
        if xs and max(xs) - min(xs) <= 6 and all(_is_dark(arr[y, x]) or _is_shadow(arr[y, x]) for x in xs):
            for x in xs:
                arr[y, x] = (0, 0, 0, 0)
    return arr


def make_sit_from_idle(idle: np.ndarray) -> np.ndarray:
    sit = idle.copy()
    h, w = sit.shape[:2]
    cut = int(h * 0.72)
    for y in range(cut, h):
        sit[y] = 0
    for y in range(cut, min(cut + 3, h)):
        for x in range(w):
            if idle[min(y, h - 6), x, 3] > 80 and max(idle[min(y, h - 6), x, :3]) < 80:
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
    mid = w // 2
    if frame == 0:
        x0, x1 = mid - 6, mid - 1
    else:
        x0, x1 = mid + 1, mid + 6
    y0, y1 = int(h * 0.72), int(h * 0.92)
    band = wlk[y0:y1, x0:x1].copy()
    wlk[y0:y1, x0:x1] = 0
    wlk[y0 - 1 + dy:y1 - 1 + dy, x0:x1] = band
    return wlk


# ---------------------------------------------------------------------------
# Laura identity edits — scaled to the HD grid. Do not stamp crude 1×2 eyes.
# ---------------------------------------------------------------------------
def patch_01(frames: dict) -> None:
    for key in ("front", "sitF", "walk"):
        a = frames[key]
        cx, cy = face_center(a)
        for y in range(cy + 6, min(cy + 16, a.shape[0])):
            for x in range(a.shape[1]):
                r, g, b, al = a[y, x]
                if al > 80 and r > 200 and g > 190:
                    if x <= cx - 5 or x >= cx + 5:
                        a[y, x] = SKIN if y < cy + 12 else SKIN_S
        put(a, cx + 4, 8, SKIN_S)
        put(a, cx + 9, cy + 3, WHITE)
        put(a, cx + 10, cy + 4, WHITE)
        put(a, cx + 9, cy + 4, WHITE)
    a = frames["side"]
    cx, cy = face_center(a)
    put(a, min(a.shape[1] - 2, cx + 8), cy + 2, WHITE)


def patch_02(frames: dict) -> None:
    for key in ("front", "sitF", "walk", "back", "sitB"):
        a = frames[key]
        cx, cy = face_center(a)
        for x in range(cx - 2, cx + 3):
            put(a, x, cy + 10, BLUE)


def patch_03(frames: dict) -> None:
    for key in ("front", "sitF", "walk"):
        a = frames[key]
        cx, cy = face_center(a)
        put(a, cx - 9, cy + 3, GOLD)
        put(a, cx + 9, cy + 3, GOLD)
    a = frames["side"]
    cx, cy = face_center(a)
    put(a, min(a.shape[1] - 2, cx + 8), cy + 2, GOLD)


def _recolor_glasses(arr: np.ndarray) -> None:
    """Solid black round frames over the concept glasses. Face band only."""
    h, w = arr.shape[:2]
    cx, cy = face_center(arr)
    ey = cy
    # wipe pale/grey frame pixels in the eye band back to skin first
    for y in range(max(0, ey - 5), min(h, ey + 6)):
        for x in range(max(0, cx - 11), min(w, cx + 12)):
            r, g, b, a = arr[y, x]
            if a < 80 or _is_skin(arr[y, x]):
                continue
            pale = r > 170 and g > 170 and b > 170
            grey = abs(int(r) - int(g)) < 18 and abs(int(g) - int(b)) < 18 and 90 < r < 200
            if pale or grey:
                arr[y, x] = SKIN
    # 15×5 round black frames, two lenses
    stamp = [
        "  ####   ####  ",
        " #    # #    # ",
        " # .. #=# .. # ",
        " #    # #    # ",
        "  ####   ####  ",
    ]
    x0 = cx - len(stamp[0]) // 2
    y0 = ey - 2
    for dy, row in enumerate(stamp):
        for dx, ch in enumerate(row):
            x, y = x0 + dx, y0 + dy
            if ch == "#":
                put(arr, x, y, INK)
            elif ch == "=":
                put(arr, x, y, INK)
            elif ch == ".":
                put(arr, x, y, SKIN)
    put(arr, cx - 3, ey + 4, BLUSH)
    put(arr, cx + 3, ey + 4, BLUSH)


def patch_04(frames: dict) -> None:
    for key in ("front", "sitF", "walk"):
        _recolor_glasses(frames[key])
    a = frames["side"]
    cx, cy = face_center(a)
    for y, xs in (
        (cy - 2, (cx + 1, cx + 2, cx + 3)),
        (cy - 1, (cx, cx + 1, cx + 3, cx + 4)),
        (cy,     (cx, cx + 1, cx + 3, cx + 4)),
        (cy + 1, (cx + 1, cx + 2, cx + 3)),
    ):
        for x in xs:
            put(a, x, y, INK)
    put(a, cx + 2, cy - 1, SKIN)
    put(a, cx + 2, cy, INK)
    for x in range(cx + 5, min(a.shape[1] - 1, cx + 9)):
        put(a, x, cy, INK)


def patch_05(frames: dict) -> None:
    for key in ("front", "sitF", "walk"):
        a = frames[key]
        cx, cy = face_center(a)
        put(a, cx - 9, cy + 3, GOLD)
        put(a, cx + 9, cy + 3, GOLD)


def shave_head(arr: np.ndarray) -> None:
    """Near-bald: skin scalp, faint stubble. Keep face / eyes / ears."""
    h, w = arr.shape[:2]
    cx, cy = face_center(arr)
    top = 0
    for y in range(h):
        if any(arr[y, x, 3] > 80 for x in range(w)):
            top = y
            break
    for y in range(top, min(cy + 1, h)):
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            if _is_skin(arr[y, x]):
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            # pupils sit in skin — leave dark pixels that touch a lot of skin
            if tuple(arr[y, x][:3]) == INK[:3] or max(r, g, b) < 40:
                skin_n = sum(
                    1 for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
                    if 0 <= y + dy < h and 0 <= x + dx < w and _is_skin(arr[y + dy, x + dx])
                )
                if skin_n >= 2:
                    continue
            if max(r, g, b) < 190:
                arr[y, x] = STUBBLE if y <= top + 2 else SKIN


def patch_06(frames: dict) -> None:
    for key in frames:
        shave_head(frames[key])


def patch_07(frames: dict) -> None:
    for key in frames:
        a = frames[key]
        h, w = a.shape[:2]
        for x in list(range(0, 12)) + list(range(w - 12, w)):
            ys = [
                y for y in range(h)
                if a[y, x, 3] > 80 and max(a[y, x, :3]) < 140 and y < int(h * 0.55)
            ]
            if not ys:
                continue
            tip = max(ys)
            for y in range(max(0, tip - 2), tip + 1):
                if a[y, x, 3] > 80 and max(a[y, x, :3]) < 160:
                    a[y, x] = CARAMEL if y >= tip - 1 else CARAMEL2


def patch_08(frames: dict) -> None:
    for key in frames:
        a = frames[key]
        h, w = a.shape[:2]
        cx, cy = face_center(a)
        if key in ("front", "sitF", "walk", "back", "sitB"):
            put(a, cx, 6, SKIN)
            put(a, cx, 7, SKIN_S)
            put(a, cx, 8, HAIR_K2)
        if key in ("front", "sitF", "walk"):
            neck = cy + 9
            for x in range(cx - 4, cx + 5):
                put(a, x, neck, WHITE)
            for x in range(cx - 4, cx + 5):
                if 0 <= neck + 1 < h and _is_dark(a[neck + 1, x]):
                    put(a, x, neck + 1, KNIT if x % 2 == 0 else SHIRT_BLK)
            put(a, cx - 2, neck + 3, WHITE)
            put(a, cx + 2, neck + 3, WHITE)
            put(a, cx, neck + 4, WHITE)
        if key in ("back", "sitB"):
            put(a, cx, 7, SKIN)
            put(a, cx - 1, cy + 9, WHITE)
            put(a, cx, cy + 9, WHITE)
            put(a, cx + 1, cy + 9, WHITE)


PATCH = {
    1: patch_01, 2: patch_02, 3: patch_03, 4: patch_04,
    5: patch_05, 6: patch_06, 7: patch_07, 8: patch_08,
}


def process_one(n: int, figs: list[np.ndarray]) -> dict[str, Image.Image]:
    raw = {name: pad_canvas(mode_down(fig)) for name, fig in zip(POSE_NAMES, figs)}
    for k in list(raw):
        raw[k] = quantize(raw[k])
        fade_shadow(raw[k])
    # sit poses on the sheets include chairs; room draws the chair.
    raw["sitF"] = make_sit_from_idle(raw["front"])
    raw["sitB"] = make_sit_from_idle(raw["back"])
    PATCH[n](raw)
    clear_shadow(raw["sitF"])
    clear_shadow(raw["sitB"])
    frames = {
        "idle_front": raw["front"],
        "idle_front_1": bob(raw["front"]),
        "idle_side": raw["side"],
        "idle_back": raw["back"],
        "walk_side_0": raw["walk"],
        "walk_side_1": bob(raw["walk"]),
        "walk_0": walk_front(raw["front"], 0),
        "walk_1": walk_front(raw["front"], 1),
        "sit_front": raw["sitF"],
        "sit_back": raw["sitB"],
    }
    for im in frames.values():
        drop_stray(im)
        fill_holes(im)
    return {k: Image.fromarray(v, "RGBA") for k, v in frames.items()}


def _font(size=13):
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    try:
        return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()
    except Exception:
        return ImageFont.load_default()


def concept_front_crop(n: int) -> Image.Image:
    figs = segment_poses(find_sheet(n))
    rgba = figs[1]  # front
    return Image.fromarray(rgba, "RGBA")


def make_lineup(fronts: list[Image.Image], concepts: list[Image.Image]) -> Image.Image:
    """Concept crop (native) beside our sprite at 4× — same display size."""
    pad, title, gap = 16, 40, 10
    cell_w = 150
    cell_h = 260
    W = pad + 8 * (cell_w + pad)
    H = title + cell_h + 28 + cell_h + 36
    out = Image.new("RGBA", (W, H), (220, 216, 210, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 10), "cast HD  ·  concept crop  |  our sprite ×4 NN  ·  same display size",
           fill=(50, 40, 38, 255), font=_font(16))
    for i, (ours, con) in enumerate(zip(fronts, concepts)):
        x = pad + i * (cell_w + pad)
        # concept already ~4× our art pixel
        cw = min(cell_w, con.size[0])
        ch = min(cell_h - 8, con.size[1])
        cx0 = (con.size[0] - cw) // 2
        cy0 = max(0, con.size[1] - ch)
        crop = con.crop((cx0, cy0, cx0 + cw, cy0 + ch))
        out.paste(crop, (x + (cell_w - crop.size[0]) // 2, title), crop)
        d.text((x, title + cell_h - 2), f"0{i+1} concept", fill=(90, 60, 56, 255), font=_font(12))
        big = zoom(ours, 4)
        out.paste(big, (x + (cell_w - big.size[0]) // 2, title + cell_h + 20), big)
        d.text((x, title + cell_h + 20 + cell_h - 8), f"0{i+1} ours ×4", fill=(90, 60, 56, 255), font=_font(12))
    return out


def make_frames(all_frames: list[dict]) -> Image.Image:
    keys = [
        "idle_front", "idle_front_1", "idle_side", "idle_back",
        "walk_0", "walk_1", "walk_side_0", "walk_side_1",
        "sit_front", "sit_back",
    ]
    scale = 3
    pad, title, cap = 10, 28, 14
    cw, ch = CW * scale + 8, CH * scale + cap
    W = pad + len(keys) * cw
    H = title + 8 * ch + 8
    out = Image.new("RGBA", (W, H), (220, 216, 210, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 6), "cast HD frames  ×3", fill=(50, 40, 38, 255), font=_font(14))
    for r, frames in enumerate(all_frames):
        for c, k in enumerate(keys):
            big = zoom(frames[k], scale)
            x, y = pad + c * cw, title + r * ch
            out.paste(big, (x, y), big)
            if r == 0:
                d.text((x, y + CH * scale + 1), k.replace("_", " "), fill=(90, 80, 74, 255), font=_font(10))
    return out


def write_cast_md():
    text = """# Cast · 8 Soul Knight chibi（HD, concept block = 4px）

> Shared ~40×68 canvas · downsample ×4 from 16:9 concept sheets · ~48-color palette.
> Concept sheets are **not** in git.

Standing sprites are ~32×60 art pixels (the concept's real grid), not 16–20.

## 辨认点

| ID | 像素辨认点 |
|----|------------|
| `cast_01` | 侧分长黑发 · 白露肩 · 白花耳饰 |
| `cast_02` | 男 · 短刺发 · 黑毛衣 · 浅蓝领 |
| `cast_03` | 齐下巴波浪波波 · 粉针织 · 金圈 |
| `cast_04` | 直波波刘海 · 黑圆框眼镜 · 白卫衣 |
| `cast_05` | 齐肩微卷 · 黑西装金扣 · 金圈 |
| `cast_06` | 男 · 近光头浅茬（肤色头皮）· 深灰西装 |
| `cast_07` | 褐长发浅焦糖发尾 · 灰西装 |
| `cast_08` | 中分超长黑直 · 黑毛衣白领边/细项链 · 无耳饰 |

坐姿是人（不带椅）。胡同椅子由房间画。
"""
    (ROOT / "design" / "cast.md").write_text(text, encoding="utf-8")


def main():
    global PALETTE
    PREVIEW.mkdir(parents=True, exist_ok=True)
    ARTIFACT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    HD_DIR.mkdir(parents=True, exist_ok=True)

    sheets = []
    for n in range(1, 9):
        path = find_sheet(n)
        print(f"  cast_0{n} from {path.name}")
        sheets.append(segment_poses(path))

    downs = []
    for figs in sheets:
        for fig in figs:
            downs.append(mode_down(fig))
    PALETTE = build_palette(downs, 48)
    print(f"  palette {len(PALETTE)} colors, canvas {CW}×{CH}, block {SCALE}")

    all_frames = []
    fronts = []
    concepts = []
    for n, figs in enumerate(sheets, 1):
        cid = f"cast_0{n}"
        frames = process_one(n, figs)
        dest = HD_DIR / cid
        dest.mkdir(parents=True, exist_ok=True)
        for name, im in frames.items():
            im.save(dest / f"{name}.png")
        fronts.append(frames["idle_front"])
        concepts.append(Image.fromarray(figs[1], "RGBA"))
        all_frames.append(frames)
        bb = frames["idle_front"].getbbox()
        print(f"    {cid} idle {frames['idle_front'].size} bbox={bb}")

    lineup = make_lineup(fronts, concepts)
    frames_sheet = make_frames(all_frames)
    for dest in (PREVIEW, ARTIFACT, REVIEW):
        lineup.save(dest / "cast_hd_lineup.png")
        frames_sheet.save(dest / "cast_hd_frames.png")
    write_cast_md()
    print("Done HD cast (concept sheets not written).")


if __name__ == "__main__":
    main()
