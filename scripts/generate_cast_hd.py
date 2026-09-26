#!/usr/bin/env python3
"""HD cast from the concept sheets — keep the artwork, do not resample.

Each pose is cropped from uploads/cast0X_sk.png with a clean flood-fill
alpha. All eight share one canvas / baseline. A 4px-grid snap is tried
and discarded if it degrades the crop. Laura's edits are local recolors
only. Missing frames (bob, second walk, left) are derived by offset/mirror.

Do not write the concept PNGs into the repo.
"""
from __future__ import annotations

import sys
from collections import Counter, deque
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

# Shared canvas: native concept figures are ~125×240–260. Baseline at bottom.
CW, CH = 168, 272
SNAP = 4
SHADOW_A = 110

INK = (16, 14, 18, 255)
SKIN = (246, 208, 180, 255)
SKIN_S = (222, 168, 136, 255)
SKIN_H = (255, 232, 210, 255)
HAIR_K = (20, 18, 20, 255)
CARAMEL = (196, 148, 96, 255)
CARAMEL2 = (168, 118, 72, 255)
WHITE = (246, 244, 240, 255)
BLUE = (164, 196, 226, 255)
GOLD = (220, 176, 64, 255)
GOLD_D = (168, 124, 36, 255)
KNIT = (72, 72, 78, 255)
SWEATER = (32, 32, 36, 255)
BELT = (40, 32, 28, 255)
LENS = (198, 220, 232, 255)
RIM_W = 8  # 2 concept-art px (sheet block = 4)

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


def _font(size=13):
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    try:
        return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()
    except Exception:
        return ImageFont.load_default()


def sheet_bg(rgb: np.ndarray) -> np.ndarray:
    corners = [rgb[2, 2], rgb[2, -3], rgb[8, 8], rgb[-3, 2], rgb[-3, -3]]
    return np.median(np.stack(corners), axis=0)


def _luma(c):
    return 0.299 * int(c[0]) + 0.587 * int(c[1]) + 0.114 * int(c[2])


def _is_sheet_grey(r, g, b, bg, thr):
    if abs(int(r) - int(g)) < 18 and abs(int(g) - int(b)) < 18 and 175 < r < 232:
        return True
    return abs(int(r) - int(bg[0])) + abs(int(g) - int(bg[1])) + abs(int(b) - int(bg[2])) <= thr


def clean_alpha(crop: np.ndarray, bg, thr: int = 28) -> np.ndarray:
    """Flood from the border and interior pockets; drop halo; keep the ink outline."""
    h, w = crop.shape[:2]
    bgv = bg.astype(np.int16)
    diff = np.abs(crop.astype(np.int16) - bgv).sum(axis=2)
    luma = crop.astype(np.int16) @ np.array([30, 59, 11]) // 100

    def is_bg_px(y, x):
        if luma[y, x] < 70:
            return False
        r, g, b = int(crop[y, x, 0]), int(crop[y, x, 1]), int(crop[y, x, 2])
        if r > 234 and g > 230 and b > 220:
            return False
        if r > 190 and r > g + 10 and r > b + 20:
            return False
        return _is_sheet_grey(r, g, b, bgv, thr) or diff[y, x] <= thr

    seen = np.zeros((h, w), bool)
    q = deque()

    def try_push(x, y):
        if 0 <= y < h and 0 <= x < w and not seen[y, x] and is_bg_px(y, x):
            seen[y, x] = True
            q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)
    while q:
        x, y = q.popleft()
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            try_push(x + dx, y + dy)

    # trapped sheet-bg pockets (armpit, inseam, hair gaps) — exact sheet only
    for y in range(h):
        for x in range(w):
            if seen[y, x] or luma[y, x] < 70:
                continue
            if diff[y, x] <= 18:
                seen[y, x] = True

    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., :3] = crop
    rgba[..., 3] = np.where(seen, 0, 255)

    for y in range(h):
        for x in range(w):
            if rgba[y, x, 3] < 80 or luma[y, x] < 70:
                continue
            r, g, b = int(rgba[y, x, 0]), int(rgba[y, x, 1]), int(rgba[y, x, 2])
            air = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1)):
                nx, ny = x + dx, y + dy
                if not (0 <= ny < h and 0 <= nx < w) or rgba[ny, nx, 3] < 80:
                    air = True
                    break
            if air and (_is_sheet_grey(r, g, b, bgv, thr + 24) or diff[y, x] <= thr + 28):
                rgba[y, x] = (0, 0, 0, 0)
    rgba[..., 3] = np.where(rgba[..., 3] > 80, 255, 0)
    return rgba


def segment_poses(path: Path) -> list[np.ndarray]:
    rgb = np.array(Image.open(path).convert("RGB"))[:520]
    bg = sheet_bg(rgb)
    diff = np.abs(rgb.astype(np.int16) - bg.astype(np.int16)).sum(axis=2)
    mask = diff > 22
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
        # 2px pad so the flood has a bg border
        x0, x1 = max(0, x0 - 2), min(rgb.shape[1] - 1, x1 + 2)
        yy0, yy1 = max(0, yy0 - 2), min(rgb.shape[0] - 1, yy1 + 2)
        crop = rgb[yy0:yy1 + 1, x0:x1 + 1]
        figs.append(clean_alpha(crop, bg))
    if len(figs) != 6:
        raise RuntimeError(f"{path.name}: expected 6 poses, got {len(figs)}")
    return figs


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


def mode_down(rgba: np.ndarray, scale: int) -> np.ndarray:
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


def snap_degrades(src: np.ndarray, scale: int = SNAP, limit: float = 12.0) -> bool:
    """True if 4px mode-down + NN up looks worse than the crop."""
    d = mode_down(src, scale)
    up = np.array(
        Image.fromarray(d, "RGBA").resize((d.shape[1] * scale, d.shape[0] * scale), Image.Resampling.NEAREST)
    )
    h = min(src.shape[0], up.shape[0])
    w = min(src.shape[1], up.shape[1])
    a, b = src[:h, :w], up[:h, :w]
    keep = a[:, :, 3] > 80
    if keep.sum() < 20:
        return True
    mad = np.abs(a[keep, :3].astype(np.int16) - b[keep, :3].astype(np.int16)).mean()
    print(f"    snap{scale} MAD={mad:.2f} ({'degrades' if mad > limit else 'ok'})")
    return mad > limit


def _row_span(arr, y):
    xs = [x for x in range(arr.shape[1]) if arr[y, x, 3] > 80]
    if not xs:
        return 0, 0.0
    dark = sum(1 for x in xs if max(arr[y, x, :3]) < 60)
    return max(xs) - min(xs) + 1, dark / len(xs)


def strip_chair(arr: np.ndarray, back: bool = False) -> np.ndarray:
    """Person-only sit: drop star / stem / seat / chair back."""
    h, w = arr.shape[:2]
    top = next((y for y in range(h) if any(arr[y, x, 3] > 80 for x in range(w))), 0)

    if back:
        last_skin = None
        for y in range(top, min(h, top + 150)):
            if sum(1 for x in range(w) if _is_skin(arr[y, x])) >= 8:
                last_skin = y
        if last_skin is not None and last_skin < top + 115:
            cut = min(h, last_skin + 18)
        else:
            cut = min(h, top + 112)
        arr[cut:] = 0
        return arr

    # sit front: walk up from the 5-star stem through the seat, stop at the body
    stem_y = None
    for y in range(h - 1, int(h * 0.55), -1):
        span, dark = _row_span(arr, y)
        if 8 <= span <= 52 and dark > 0.55:
            stem_y = y
            break
    cut = int(h * 0.78)
    if stem_y is not None:
        cut = stem_y
        for y in range(stem_y, max(top + 80, int(h * 0.40)), -1):
            span, dark = _row_span(arr, y)
            body = sum(
                1 for x in range(w)
                if arr[y, x, 3] > 80 and (not _is_dark(arr[y, x])) and max(arr[y, x, :3]) > 80
            )
            # seat: mid-wide, mostly black. body: wider, or cloth/skin.
            if body >= 10 or span >= 108:
                cut = y + 4
                break
            if 60 <= span <= 104 and dark > 0.65:
                cut = y
                continue
            if span < 56:
                continue
            cut = y + 4
            break
    arr[cut:] = 0
    for y in range(max(0, cut - 4), h):
        for x in range(w):
            r, g, b, a = arr[y, x]
            if a < 80:
                continue
            if max(r, g, b) < 70 or (abs(int(r) - int(g)) < 24 and abs(int(g) - int(b)) < 24 and 70 < r < 210):
                arr[y, x] = (0, 0, 0, 0)
    return arr


def sit_from_back(arr: np.ndarray, tall: bool = False) -> np.ndarray:
    """Head + shoulders + upper back from the standing back crop.

    Long-hair 08 needs extra depth so the nape collar stays in the sit_back frame.
    """
    out = arr.copy()
    h, w = out.shape[:2]
    top = next((y for y in range(h) if any(out[y, x, 3] > 80 for x in range(w))), 0)
    depth = 208 if tall else 148
    out[min(h, top + depth):] = 0
    return out


def _is_skin(c):
    r, g, b, a = (c[0], c[1], c[2], c[3] if len(c) > 3 else 255)
    return a > 80 and r > 190 and 120 < g < 220 and 90 < b < 200 and r > g + 10 and r > b + 20


def _is_dark(c):
    return (c[3] if len(c) > 3 else 255) > 80 and max(c[0], c[1], c[2]) < 70


def face_center(arr: np.ndarray):
    h, w = arr.shape[:2]
    y_hi = min(h, max(90, int(h * 0.42)))
    ys, xs = [], []
    for y in range(y_hi):
        for x in range(w):
            if _is_skin(arr[y, x]):
                xs.append(x)
                ys.append(y)
    if not xs:
        return w // 2, 90
    return int(round(sum(xs) / len(xs))), int(round(sum(ys) / len(ys)))


def put(arr, x, y, c):
    if 0 <= y < arr.shape[0] and 0 <= x < arr.shape[1]:
        arr[y, x] = c


def bob(arr: np.ndarray, dy: int = 2) -> np.ndarray:
    out = np.zeros_like(arr)
    if dy > 0:
        out[dy:] = arr[:-dy]
    else:
        out[: arr.shape[0] + dy] = arr[-dy:]
    return out


def walk_front(idle: np.ndarray, frame: int) -> np.ndarray:
    wlk = idle.copy()
    h, w = wlk.shape[:2]
    mid = w // 2
    if frame == 0:
        x0, x1 = mid - 22, mid - 4
    else:
        x0, x1 = mid + 4, mid + 22
    y0, y1 = int(h * 0.72), int(h * 0.94)
    band = wlk[y0:y1, x0:x1].copy()
    wlk[y0:y1, x0:x1] = 0
    dest = y0 - 2
    wlk[dest: dest + (y1 - y0), x0:x1] = band
    return wlk


# ---------------------------------------------------------------------------
# Laura edits — recolor only, never redraw a face.
# ---------------------------------------------------------------------------
def patch_02(arr: np.ndarray) -> None:
    cx, cy = face_center(arr)
    for x in range(cx - 8, cx + 9):
        for y in range(cy + 28, cy + 40):
            if _is_dark(arr[y, x]) or (arr[y, x, 3] > 80 and max(arr[y, x, :3]) < 90):
                # only the collar band
                if abs(x - cx) <= 8:
                    put(arr, x, y, (*BLUE[:3], 255) if abs(x - cx) <= 6 and y < cy + 36 else arr[y, x])


def _is_eye_white(c):
    r, g, b, a = int(c[0]), int(c[1]), int(c[2]), int(c[3] if len(c) > 3 else 255)
    return a > 80 and r > 230 and g > 230 and b > 220


def _is_blush(c):
    r, g, b, a = int(c[0]), int(c[1]), int(c[2]), int(c[3] if len(c) > 3 else 255)
    return a > 80 and r > 220 and 120 < g < 190 and 120 < b < 190 and r > g + 30


def _find_eyes(arr: np.ndarray):
    """White-of-eye centroids in the face band."""
    h, w = arr.shape[:2]
    cx, cy = face_center(arr)
    # 06's face_center drifts up into the scalp — prefer the eye-white band
    ys, xs = np.where(
        (arr[:, :, 3] > 80) & (arr[:, :, 0] > 230) & (arr[:, :, 1] > 230) & (arr[:, :, 2] > 220)
    )
    if len(xs) < 6:
        return []
    # keep whites near the mid-face, not hoodie highlights
    keep = (ys > 70) & (ys < 140) & (xs > 20) & (xs < w - 20)
    xs, ys = xs[keep], ys[keep]
    if len(xs) < 6:
        return []
    # split left/right of median x
    mid = int(np.median(xs))
    clusters = []
    for mask in (xs < mid - 4, xs > mid + 4):
        if mask.sum() >= 4:
            clusters.append((int(round(xs[mask].mean())), int(round(ys[mask].mean()))))
    if not clusters:
        clusters.append((int(round(xs.mean())), int(round(ys.mean()))))
    clusters.sort()
    return clusters


def _ring(arr, cx, cy, r_out, r_in, color, clip=False):
    r_out2, r_in2 = r_out * r_out, r_in * r_in
    for y in range(int(cy - r_out), int(cy + r_out) + 1):
        for x in range(int(cx - r_out), int(cx + r_out) + 1):
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            if not (r_in2 <= d2 <= r_out2 + 2):
                continue
            if clip and not (0 <= y < arr.shape[0] and 0 <= x < arr.shape[1] and arr[y, x, 3] > 80):
                continue
            put(arr, x, y, color)


def _fill_lens(arr, cx, cy, r_in):
    r2 = r_in * r_in
    for y in range(int(cy - r_in), int(cy + r_in) + 1):
        for x in range(int(cx - r_in), int(cx + r_in) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 > r2:
                continue
            if not (0 <= y < arr.shape[0] and 0 <= x < arr.shape[1]):
                continue
            if arr[y, x, 3] < 80:
                continue
            if _is_eye_white(arr[y, x]) or _is_dark(arr[y, x]) or _is_blush(arr[y, x]):
                continue
            if max(arr[y, x, :3]) < 90:
                continue
            r, g, b, a = arr[y, x]
            arr[y, x] = (
                int(r * 0.55 + LENS[0] * 0.45),
                int(g * 0.55 + LENS[1] * 0.45),
                int(b * 0.55 + LENS[2] * 0.45),
                255,
            )


def _restore_old_rims(arr, box):
    """Turn leftover metal / thin black rims back into skin so new rims sit clean."""
    x0, y0, x1, y1 = box
    h, w = arr.shape[:2]
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            if arr[y, x, 3] < 80 or _is_eye_white(arr[y, x]) or _is_blush(arr[y, x]) or _is_skin(arr[y, x]):
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            grey = abs(r - g) < 28 and abs(g - b) < 28 and 70 < r < 230
            # old thin rim sitting on the face (not hair, not outline-of-head)
            if grey or (max(r, g, b) < 80 and _is_skin(arr[min(h - 1, y + 1), x])):
                arr[y, x] = SKIN


def bold_glasses(arr: np.ndarray, side: bool = False) -> None:
    """2-art-px (8 native) solid black round rims, bridge, temples, faint lenses."""
    cx, fcy = face_center(arr)
    eyes = _find_eyes(arr)
    if side:
        if not eyes:
            eyes = [(cx + 18, fcy + 10)]
        ex, ey = max(eyes, key=lambda p: p[0])
        r_out, r_in = 14, 8
        _restore_old_rims(arr, (ex - 28, ey - 24, ex + 28, ey + 24))
        _fill_lens(arr, ex, ey, r_in)
        _ring(arr, ex, ey, r_out, r_in, INK, clip=True)
        # temple along the face into the hair
        for i in range(16):
            for t in range(6):
                x, y = ex - r_out + 2 - i, ey - 1 + t // 2
                if 0 <= y < arr.shape[0] and 0 <= x < arr.shape[1] and arr[y, x, 3] > 80:
                    put(arr, x, y, INK)
        return
    if len(eyes) < 2:
        ly = ry = (eyes[0][1] if eyes else fcy + 12)
        eyes = [(cx - 26, ly), (cx + 26, ry)]
    (lx, ly), (rx, ry) = eyes[0], eyes[-1]
    if rx - lx < 30:
        lx, rx = cx - 26, cx + 26
    r_out, r_in = 20, 12
    _restore_old_rims(arr, (lx - 28, min(ly, ry) - 24, rx + 28, max(ly, ry) + 24))
    _fill_lens(arr, lx, ly, r_in)
    _fill_lens(arr, rx, ry, r_in)
    _ring(arr, lx, ly, r_out, r_in, INK)
    _ring(arr, rx, ry, r_out, r_in, INK)
    by0 = (ly + ry) // 2 - RIM_W // 2
    for x in range(lx + r_in - 1, rx - r_in + 2):
        for t in range(RIM_W):
            put(arr, x, by0 + t, INK)
    for i in range(10):
        for t in range(RIM_W):
            put(arr, lx - r_out - i, ly - 1 + t // 2, INK)
            put(arr, rx + r_out + i, ry - 1 + t // 2, INK)


def _cloth_y(arr, top):
    """Jacket / sweater row — neutral dark, not brownish hair."""
    h, w = arr.shape[:2]
    for y in range(top + 88, min(h, top + 170)):
        jacket = 0
        skins = 0
        for x in range(w):
            r, g, b, a = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2]), int(arr[y, x, 3])
            if a < 80:
                continue
            if _is_skin(arr[y, x]):
                skins += 1
                continue
            if max(r, g, b) < 90 and abs(r - g) < 14 and abs(g - b) < 14:
                jacket += 1
        if jacket >= 24 and jacket >= skins:
            return y
    return min(h, top + 130)


def shave_head(arr: np.ndarray, back: bool = False) -> None:
    """Smaller round skull, face-matched skin, highlight, side shade, clean outline."""
    h, w = arr.shape[:2]
    top = next((y for y in range(h) if any(arr[y, x, 3] > 80 for x in range(w))), 0)
    cloth = _cloth_y(arr, top)
    # sample real face skin (cheeks / lower face), not leftover hair
    samples = []
    for y in range(max(top + 50, cloth - 50), cloth):
        for x in range(w):
            if _is_skin(arr[y, x]) and not _is_blush(arr[y, x]):
                samples.append(arr[y, x, :3])
    face = tuple(int(v) for v in np.median(np.stack(samples), 0)) + (255,) if samples else SKIN
    hi = SKIN_H
    shade = SKIN_S

    # original head occupancy
    head = np.zeros((h, w), bool)
    for y in range(top, cloth):
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            if _is_eye_white(arr[y, x]) or _is_blush(arr[y, x]):
                head[y, x] = True
                continue
            # skip jacket
            if max(arr[y, x, :3]) < 90 and y > cloth - 12:
                continue
            head[y, x] = True

    brow = cloth - 8 if back else cloth - 42
    if not back:
        eyes = _find_eyes(arr)
        if eyes:
            brow = min(p[1] for p in eyes) - 10
    brow = max(top + 36, min(brow, cloth - 8))

    # inset the dome (above the brow) by 6 px — smaller than the hair volume
    inset = 6
    new = head.copy()
    for y in range(top, brow + 4):
        xs = np.where(head[y])[0]
        if len(xs) == 0:
            continue
        extra = inset + max(0, (inset + 2) - (y - top))  # rounder crown
        lo, hi_x = int(xs.min()) + extra, int(xs.max()) - extra
        new[y, :] = False
        if lo <= hi_x:
            new[y, lo: hi_x + 1] = True
    for y in range(top, top + inset + 2):
        new[y] = False

    # apply: every hair-coloured pixel in the skull becomes face skin
    for y in range(top, cloth):
        for x in range(w):
            if _is_eye_white(arr[y, x]) or _is_blush(arr[y, x]):
                continue
            # keep pupils / brows / mouth (dark on the face, touching skin)
            if y >= brow and _is_dark(arr[y, x]) and not back:
                skin_n = sum(
                    1 for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1))
                    if 0 <= y + dy < h and 0 <= x + dx < w and _is_skin(arr[y + dy, x + dx])
                )
                if skin_n >= 2:
                    continue
            if y >= brow and _is_skin(arr[y, x]) and not back:
                continue
            if new[y, x]:
                arr[y, x] = face
            elif head[y, x]:
                arr[y, x] = (0, 0, 0, 0)

    # highlight on the crown + darker sides / back
    xs_all = np.where(new.any(axis=0))[0]
    ys_all = np.where(new.any(axis=1))[0]
    if len(xs_all) and len(ys_all):
        hx0, hx1 = int(xs_all.min()), int(xs_all.max())
        hy0, hy1 = int(ys_all.min()), min(int(ys_all.max()), brow + 8)
        mx = (hx0 + hx1) // 2
        mw = max(8, (hx1 - hx0) // 2)
        mh = max(6, (hy1 - hy0) // 2)
        for y in range(hy0, hy1 + 1):
            for x in range(hx0, hx1 + 1):
                if not new[y, x]:
                    continue
                if _is_eye_white(arr[y, x]) or _is_blush(arr[y, x]) or _is_dark(arr[y, x]):
                    continue
                # top highlight oval
                t = 1.0 - ((y - (hy0 + 8)) / max(1, mh))
                side = abs(x - mx) / max(1, mw)
                if t > 0.35 and side < 0.55:
                    mix = 0.55 * min(1.0, t)
                    arr[y, x] = (
                        int(face[0] * (1 - mix) + hi[0] * mix),
                        int(face[1] * (1 - mix) + hi[1] * mix),
                        int(face[2] * (1 - mix) + hi[2] * mix),
                        255,
                    )
                elif side > 0.62 or (back and t < 0.15):
                    mix = (0.42 if back else 0.32) * min(1.0, max(side, 0.55 if back else side))
                    arr[y, x] = (
                        int(face[0] * (1 - mix) + shade[0] * mix),
                        int(face[1] * (1 - mix) + shade[1] * mix),
                        int(face[2] * (1 - mix) + shade[2] * mix),
                        255,
                    )

    # continuous dark outline on the new skull
    for y in range(top, cloth):
        for x in range(w):
            if not new[y, x]:
                continue
            if _is_eye_white(arr[y, x]) or _is_blush(arr[y, x]):
                continue
            edge = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if not (0 <= ny < h and 0 <= nx < w) or arr[ny, nx, 3] < 80 or not new[ny, nx]:
                    edge = True
                    break
            if edge:
                arr[y, x] = INK

    # leftover brown/grey hair (nape, sides) above the jacket → face skin
    for y in range(top, min(h, cloth + 8)):
        for x in range(w):
            if arr[y, x, 3] < 80 or _is_skin(arr[y, x]) or _is_eye_white(arr[y, x]) or _is_blush(arr[y, x]):
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            brown_hair = 40 < max(r, g, b) < 170 and r >= g - 4 and g >= b - 6 and (r - b) > 6
            grey_hair = 40 < max(r, g, b) < 140 and abs(r - g) < 20 and abs(g - b) < 20 and y < cloth
            if brown_hair or grey_hair:
                arr[y, x] = face


def _is_brown_hair(c):
    r, g, b, a = int(c[0]), int(c[1]), int(c[2]), int(c[3] if len(c) > 3 else 255)
    if a < 80 or _is_skin(c):
        return False
    return 35 < r < 175 and g < r + 4 and b < g + 8 and r >= g >= b - 6


def caramel_tips(arr: np.ndarray) -> None:
    h, w = arr.shape[:2]
    cx, cy = face_center(arr)
    lock_y0, lock_y1 = cy + 8, min(h - 8, int(h * 0.72))
    for x in range(w):
        if abs(x - cx) < 16:
            continue
        ys = [y for y in range(lock_y0, lock_y1) if _is_brown_hair(arr[y, x])]
        if len(ys) < 6:
            continue
        tip = max(ys)
        span = 16
        for y in range(max(lock_y0, tip - span), tip + 1):
            if not _is_brown_hair(arr[y, x]):
                continue
            t = (y - (tip - span)) / span
            arr[y, x] = CARAMEL if t > 0.50 else CARAMEL2


def _is_sweater(c):
    r, g, b, a = int(c[0]), int(c[1]), int(c[2]), int(c[3] if len(c) > 3 else 255)
    return a > 80 and max(r, g, b) < 80 and abs(r - g) < 18 and abs(g - b) < 18


def _neckline(arr, cx, cy):
    h, w = arr.shape[:2]
    for y in range(cy + 16, min(cy + 80, h)):
        if _is_sweater(arr[y, cx]) and _is_sweater(arr[y, max(0, cx - 8)]) and _is_sweater(arr[y, min(w - 1, cx + 8)]):
            return y
    return cy + 40


def _collar_point(arr, x0, y0, x1, y1, x_tip, y_tip):
    """Filled triangle collar point in white with a 1px ink edge."""
    xs = (x0, x1, x_tip)
    ys = (y0, y1, y_tip)
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            # barycentric
            den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if den == 0:
                continue
            a = ((ys[1] - ys[2]) * (x - xs[2]) + (xs[2] - xs[1]) * (y - ys[2])) / den
            b = ((ys[2] - ys[0]) * (x - xs[2]) + (xs[0] - xs[2]) * (y - ys[2])) / den
            c = 1 - a - b
            if a >= -0.02 and b >= -0.02 and c >= -0.02:
                put(arr, x, y, WHITE)
    for x, y in ((x0, y0), (x1, y1), (x_tip, y_tip)):
        put(arr, x, y, INK)


def dress_08(arr: np.ndarray, back: bool = False, side: bool = False) -> None:
    """Dressier black knit: white shirt collar + cuffs, gold pendant, knit, belt."""
    h, w = arr.shape[:2]
    cx, cy = face_center(arr)
    if back:
        # collar edge at the nape: where hair width drops onto the sweater
        nape = None
        prev_w = 0
        for y in range(max(80, h // 3), h - 16):
            xs = [x for x in range(w) if arr[y, x, 3] > 80]
            if not xs:
                continue
            span = max(xs) - min(xs)
            if prev_w > 90 and span < prev_w - 12:
                nape = y
                break
            prev_w = span
        if nape is None:
            nape = min(h - 20, 180)
        # only on torso-narrow rows (not the hair mass). sit_back may still be
        # hair-wide — then stamp a short white nape band on the last opaque rows.
        painted = 0
        for y in range(nape, min(h, nape + 6)):
            xs = [x for x in range(w) if arr[y, x, 3] > 80]
            if not xs or max(xs) - min(xs) > 96:
                continue
            for x in range(cx - 16, cx + 17):
                if _is_sweater(arr[y, x]) or _is_dark(arr[y, x]):
                    put(arr, x, y, WHITE)
                    painted += 1
        if painted < 8:
            last = next((y for y in range(h - 1, 40, -1) if any(arr[y, x, 3] > 80 for x in range(w))), nape)
            for y in range(max(40, last - 5), last + 1):
                for x in range(cx - 16, cx + 17):
                    if 0 <= x < w and arr[y, x, 3] > 80 and not _is_skin(arr[y, x]):
                        put(arr, x, y, WHITE)
        for y in range(nape + 10, min(h - 8, nape + 56), 6):
            for x in range(cx - 24, cx + 25):
                if _is_sweater(arr[y, x]):
                    put(arr, x, y, KNIT)
        return

    neck = _neckline(arr, cx, cy)
    # shirt band under the chin
    for y in range(neck - 6, neck + 3):
        for x in range(cx - 20, cx + 21):
            if 0 <= x < w and 0 <= y < h and arr[y, x, 3] > 80:
                if _is_sweater(arr[y, x]) or _is_skin(arr[y, x]) or _is_dark(arr[y, x]):
                    put(arr, x, y, WHITE)
    # two collar points
    if side:
        # collar wrap sitting on the neck (not a floating triangle)
        for y in range(neck - 8, neck + 8):
            for x in range(cx - 6, cx + 22):
                if 0 <= x < w and 0 <= y < h and arr[y, x, 3] > 80:
                    if _is_sweater(arr[y, x]) or _is_skin(arr[y, x]) or _is_dark(arr[y, x]):
                        # keep the face: only the neck band
                        if y >= neck - 4 or _is_sweater(arr[y, x]):
                            put(arr, x, y, WHITE)
        # one collar point on the chest
        _collar_point(arr, cx + 2, neck + 4, cx + 16, neck + 4, cx + 10, neck + 18)
        for i in range(8):
            put(arr, cx + 4, neck + 10 + i, GOLD)
            put(arr, cx + 5, neck + 10 + i, GOLD)
        put(arr, cx + 5, neck + 18, GOLD_D)
    else:
        _collar_point(arr, cx - 20, neck - 1, cx - 2, neck - 1, cx - 12, neck + 18)
        _collar_point(arr, cx + 2, neck - 1, cx + 20, neck - 1, cx + 12, neck + 18)
        # gold chain + pendant
        for i in range(14):
            put(arr, cx - 10 + i, neck + 10 + abs(i - 7), GOLD)
            put(arr, cx - 10 + i, neck + 11 + abs(i - 7), GOLD)
        for dx, dy in ((0, 0), (-1, 1), (1, 1), (0, 1), (0, 2), (-1, 2), (1, 2), (0, 3)):
            put(arr, cx + dx, neck + 18 + dy, GOLD if dy < 3 else GOLD_D)
        # front part stays (short, obvious)
        top = next((y for y in range(h) if arr[y, cx, 3] > 80), 8)
        for y in range(top + 2, min(top + 20, cy - 24)):
            if arr[y, cx, 3] > 80 and not _is_skin(arr[y, cx]):
                put(arr, cx, y, SKIN_S)

    # knit texture on the torso (center, not the hanging hair)
    waist = neck + 66
    for y in range(h - 1, neck, -1):
        xs = [x for x in range(cx - 36, cx + 37) if 0 <= x < w and _is_sweater(arr[y, x])]
        if len(xs) >= 20:
            waist = y
            break
    x_lo, x_hi = cx - (14 if side else 28), cx + (22 if side else 28)
    for y in range(neck + 8, waist):
        if (y - neck) % 6 == 0:
            for x in range(x_lo, x_hi + 1):
                if 0 <= x < w and _is_sweater(arr[y, x]):
                    put(arr, x, y, KNIT)

    # slim belt
    for y in range(waist - 1, min(h, waist + 4)):
        for x in range(x_lo - 4, x_hi + 5):
            if 0 <= x < w and _is_sweater(arr[y, x]):
                put(arr, x, y, BELT if y != waist + 1 else GOLD_D)
    if not side:
        for x in range(cx - 4, cx + 5):
            put(arr, x, waist + 1, GOLD)

    # white cuffs at the wrists (skin hands meeting dark sleeves)
    for y in range(neck + 40, min(h - 8, neck + 90)):
        skins = [x for x in range(w) if _is_skin(arr[y, x])]
        if len(skins) < 4:
            continue
        # left / right clusters
        left = [x for x in skins if x < cx - 16]
        right = [x for x in skins if x > cx + 16]
        for cluster in (left, right):
            if len(cluster) < 3:
                continue
            hx = int(sum(cluster) / len(cluster))
            # cuff just above the hand
            for yy in range(y - 8, y - 1):
                for x in range(hx - 7, hx + 8):
                    if 0 <= x < w and 0 <= yy < h and (_is_sweater(arr[yy, x]) or _is_dark(arr[yy, x])):
                        put(arr, x, yy, WHITE)


def apply_laura(n: int, frames: dict) -> None:
    if n == 2:
        for k in ("front", "walk", "back", "sitF"):
            if k in frames:
                patch_02(frames[k])
    if n == 4:
        for k in frames:
            if k in ("back", "sitB"):
                continue
            bold_glasses(frames[k], side=k in ("side", "walk"))
    if n == 6:
        for k in frames:
            shave_head(frames[k], back=k in ("back", "sitB"))
    if n == 7:
        for k in frames:
            caramel_tips(frames[k])
    if n == 8:
        for k in frames:
            dress_08(frames[k], back=k in ("back", "sitB"), side=k in ("side", "walk"))


def flip_h(arr: np.ndarray) -> np.ndarray:
    return arr[:, ::-1].copy()


def process_one(n: int, figs: list[np.ndarray]) -> dict[str, Image.Image]:
    raw = {}
    for name, fig in zip(POSE_NAMES, figs):
        # 4px snap is measured for the record, but any MAD is visible on faces
        # and sweaters — keep the native crop and render nearest at 1:1.
        snap_degrades(fig)
        print(f"    {name}: keeping native crop")
        raw[name] = fig
    # strip chairs on the native sit crops, then pad so we never clip a head
    raw["sitF"] = strip_chair(raw["sitF"], back=False)
    # concept sit_back is almost all chair; keep the person's back crop
    # from crown through upper back so seating can show head+shoulders.
    raw["sitB"] = sit_from_back(raw["back"], tall=(n == 8))
    for name in list(raw):
        raw[name] = pad_canvas(raw[name])
    apply_laura(n, raw)
    frames = {
        "idle_front": raw["front"],
        "idle_front_1": bob(raw["front"], 2),
        "idle_side": raw["side"],
        "idle_side_l": flip_h(raw["side"]),
        "idle_back": raw["back"],
        "walk_side_0": raw["walk"],
        "walk_side_1": bob(raw["walk"], 2),
        "walk_side_l_0": flip_h(raw["walk"]),
        "walk_side_l_1": flip_h(bob(raw["walk"], 2)),
        "walk_0": walk_front(raw["front"], 0),
        "walk_1": walk_front(raw["front"], 1),
        "sit_front": raw["sitF"],
        "sit_back": raw["sitB"],
    }
    return {k: Image.fromarray(v, "RGBA") for k, v in frames.items()}


def make_lineup(fronts: list[Image.Image], concepts: list[Image.Image]) -> Image.Image:
    pad, title = 20, 44
    cell_w = 180
    cell_h = 300
    W = pad + 8 * (cell_w + pad)
    H = title + cell_h + 28 + cell_h + 36
    out = Image.new("RGBA", (W, H), (220, 216, 210, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 10), "cast HD v4  ·  concept crop  |  ours (same pixels + bold Laura edits)",
           fill=(50, 40, 38, 255), font=_font(16))
    for i, (ours, con) in enumerate(zip(fronts, concepts)):
        x = pad + i * (cell_w + pad)
        cw = min(cell_w, con.size[0])
        ch = min(cell_h - 8, con.size[1])
        cx0 = (con.size[0] - cw) // 2
        cy0 = max(0, con.size[1] - ch)
        crop = con.crop((cx0, cy0, cx0 + cw, cy0 + ch))
        out.paste(crop, (x + (cell_w - crop.size[0]) // 2, title), crop)
        d.text((x, title + cell_h - 2), f"0{i+1} concept", fill=(90, 60, 56, 255), font=_font(12))
        # ours is already native — show at 1:1, same display size
        bb = ours.getbbox()
        body = ours.crop(bb) if bb else ours
        if body.size[1] > cell_h - 8:
            # only if canvas padding is huge; should not scale
            pass
        ox = x + (cell_w - body.size[0]) // 2
        oy = title + cell_h + 20 + (cell_h - 8 - body.size[1])
        out.paste(body, (ox, oy), body)
        d.text((x, title + cell_h + 20 + cell_h - 8), f"0{i+1} ours", fill=(90, 60, 56, 255), font=_font(12))
    return out


def make_frames(all_frames: list[dict]) -> Image.Image:
    keys = [
        "idle_front", "idle_front_1", "idle_side", "idle_back",
        "walk_0", "walk_1", "walk_side_0", "walk_side_1",
        "sit_front", "sit_back",
    ]
    # show at 1:1 (already ~168×272)
    pad, title, cap = 8, 28, 14
    cw, ch = CW + 8, CH + cap
    W = pad + len(keys) * cw
    H = title + 8 * ch + 8
    out = Image.new("RGBA", (W, H), (220, 216, 210, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 6), "cast HD v4 frames  ·  native crops + bold 04/06/08", fill=(50, 40, 38, 255), font=_font(14))
    for r, frames in enumerate(all_frames):
        for c, k in enumerate(keys):
            im = frames[k]
            x, y = pad + c * cw, title + r * ch
            out.paste(im, (x, y), im)
            if r == 0:
                d.text((x, y + CH + 1), k.replace("_", " "), fill=(90, 80, 74, 255), font=_font(10))
    return out


def head_x4(im: Image.Image, body: bool = False) -> Image.Image:
    bb = im.getbbox() or (0, 0, im.size[0], im.size[1])
    # head is the top ~45% of the opaque box; 08 needs torso for the outfit
    x0, y0, x1, y1 = bb
    frac = 0.78 if body else 0.48
    y1 = y0 + max(80, int((y1 - y0) * frac))
    x0 = max(0, x0 - 8)
    x1 = min(im.size[0], x1 + 8)
    crop = im.crop((x0, y0, x1, y1))
    return zoom(crop, 4)


def make_cutout_check(all_frames: list[dict]) -> Image.Image:
    """All 8 idle_front + sit_front + sit_back on #222 and #fff."""
    keys = ("idle_front", "sit_front", "sit_back")
    cell_w, cell_h = 170, 290
    pad, title = 12, 36
    W = pad + 8 * (cell_w + 8)
    H = title + 2 * (3 * (cell_h + 8)) + 20
    out = Image.new("RGBA", (W, H), (160, 160, 160, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 8), "cast cutout check  ·  top #222  ·  bottom #fff  ·  idle / sitF / sitB",
           fill=(30, 30, 30, 255), font=_font(14))
    for row, bg in enumerate(((34, 34, 34, 255), (255, 255, 255, 255))):
        for i, frames in enumerate(all_frames):
            for c, k in enumerate(keys):
                im = frames[k]
                bb = im.getbbox()
                body = im.crop(bb) if bb else im
                cell = Image.new("RGBA", (cell_w, cell_h), bg)
                ox = (cell_w - body.size[0]) // 2
                oy = 8
                cell.paste(body, (ox, oy), body)
                x = pad + i * (cell_w + 8)
                y = title + row * (3 * (cell_h + 8)) + c * (cell_h + 8)
                out.paste(cell, (x, y))
    return out


def write_cast_md():
    text = """# Cast · 8 Soul Knight chibi（HD v4, concept crops）

> Native crops from the 16:9 concept sheets · shared 168×272 canvas · no 4px crush.
> Concept sheets are **not** in git.

Laura edits (obvious at 1×): 04 bold 2-art-px black glasses, 06 shaved smaller skull, 07 caramel tips, 08 dress shirt collar / cuffs / gold pendant / knit.

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

坐姿是人（椅已剥）。胡同椅子由房间画。
"""
    (ROOT / "design" / "cast.md").write_text(text, encoding="utf-8")


def main():
    PREVIEW.mkdir(parents=True, exist_ok=True)
    ARTIFACT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    HD_DIR.mkdir(parents=True, exist_ok=True)

    sheets = []
    for n in range(1, 9):
        path = find_sheet(n)
        print(f"  cast_0{n} from {path.name}")
        sheets.append(segment_poses(path))

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
    cutout = make_cutout_check(all_frames)
    for dest in (PREVIEW, ARTIFACT, REVIEW):
        dest.mkdir(parents=True, exist_ok=True)
        lineup.save(dest / "cast_hd_lineup.png")
        lineup.save(dest / "cast_hd_lineup_v4.png")
        frames_sheet.save(dest / "cast_hd_frames.png")
        cutout.save(dest / "cast_cutout_check.png")

    for n, tag in ((4, "04"), (6, "06"), (8, "08")):
        fr = all_frames[n - 1]
        for view, key in (("front", "idle_front"), ("back", "idle_back")):
            big = head_x4(fr[key], body=(n == 8))
            name = f"cast_{tag}_{view}_x4.png"
            for dest in (PREVIEW, ARTIFACT, REVIEW):
                big.save(dest / name)

    write_cast_md()
    print("Done HD cast v4 (bold 04/06/08).")


if __name__ == "__main__":
    main()
