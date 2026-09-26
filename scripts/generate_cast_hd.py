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
FOOT_PAD = 10  # room for a clean ellipse under the shoes
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
KNIT = (52, 52, 56, 255)
SWEATER = (32, 32, 36, 255)
PART = (214, 192, 176, 255)  # 1px centre part — skin-light, not orange
RIM_W = 4  # 1 concept-art px (sheet block = 4)

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
    return polish_cutout(rgba, bg)


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


def _neutral(r, g, b, lo=155, hi=232):
    return abs(r - g) < 16 and abs(g - b) < 16 and lo < r < hi


def _white_cloth(r, g, b, a=255):
    return a > 80 and r > 226 and g > 220 and b > 208


def _goldish(r, g, b, a=255):
    return a > 80 and r > 170 and 90 < g < 200 and b < 140 and r > b + 40


def polish_cutout(arr: np.ndarray, bg=None) -> np.ndarray:
    """Hard alpha, drop specks / sheet pockets / outline halo, restore ink."""
    h, w = arr.shape[:2]
    arr[..., 3] = np.where(arr[..., 3] > 80, 255, 0)
    bgv = None if bg is None else np.asarray(bg, np.int16).reshape(3)

    def dark(c):
        return c[3] > 80 and max(int(c[0]), int(c[1]), int(c[2])) < 70

    def neigh(x, y):
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                yield nx, ny

    # keep the largest 8-connected body (kills floating sheet specks)
    seen = np.zeros((h, w), bool)
    best = None
    best_n = 0
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0, x0] or arr[y0, x0, 3] < 80:
                continue
            q = deque([(x0, y0)])
            seen[y0, x0] = True
            cells = [(x0, y0)]
            while q:
                x, y = q.popleft()
                for nx, ny in neigh(x, y):
                    if not seen[ny, nx] and arr[ny, nx, 3] > 80:
                        seen[ny, nx] = True
                        q.append((nx, ny))
                        cells.append((nx, ny))
            if len(cells) > best_n:
                best_n = len(cells)
                best = cells
    if best:
        keep = np.zeros((h, w), bool)
        for x, y in best:
            keep[y, x] = True
        arr[~keep] = 0

    # tiny leftover islands that survived if they were attached by a halo we
    # are about to delete — also drop 1–5 px specks now.
    seen[:] = False
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0, x0] or arr[y0, x0, 3] < 80:
                continue
            q = deque([(x0, y0)])
            seen[y0, x0] = True
            cells = [(x0, y0)]
            while q:
                x, y = q.popleft()
                for nx, ny in neigh(x, y):
                    if not seen[ny, nx] and arr[ny, nx, 3] > 80:
                        seen[ny, nx] = True
                        q.append((nx, ny))
                        cells.append((nx, ny))
            if len(cells) <= 5:
                for x, y in cells:
                    arr[y, x] = 0

    # sheet-grey pockets (armpit / inseam / hoop / hair gap)
    for y in range(h):
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            if _white_cloth(r, g, b) or _is_skin(arr[y, x]) or _goldish(r, g, b) or dark(arr[y, x]):
                continue
            sheetish = _neutral(r, g, b, 188, 230)
            if bgv is not None:
                sheetish = sheetish or (
                    abs(r - int(bgv[0])) + abs(g - int(bgv[1])) + abs(b - int(bgv[2])) <= 24
                    and abs(r - g) < 20
                )
            if not sheetish:
                continue
            dark_n = sum(1 for nx, ny in neigh(x, y) if dark(arr[ny, nx]))
            # hair sheen sits on dark hair — keep. trapped sheet has few dark neighbours.
            if dark_n >= 3 and r < 186:
                continue
            arr[y, x] = 0

    # outline halo: light grey / near-white on the outer ring that is not cloth
    for y in range(h):
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            if _is_skin(arr[y, x]) or _goldish(r, g, b) or dark(arr[y, x]):
                continue
            air = any(
                not (0 <= nx < w and 0 <= ny < h) or arr[ny, nx, 3] < 80
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if not air:
                continue
            dark_n = sum(1 for nx, ny in neigh(x, y) if dark(arr[ny, nx]))
            cloth_n = sum(
                1 for nx, ny in neigh(x, y) if _white_cloth(int(arr[ny, nx, 0]), int(arr[ny, nx, 1]), int(arr[ny, nx, 2]), int(arr[ny, nx, 3]))
            )
            # isolated near-white specks are not a shirt / flower (those cluster)
            if _white_cloth(r, g, b) and (cloth_n >= 2 or y > int(h * 0.42)):
                continue
            # AA between white cloth and hair → ink, not grey
            if cloth_n and dark_n:
                arr[y, x] = INK
                continue
            if _neutral(r, g, b, 150, 236) or (r > 220 and g > 218 and b > 210):
                if dark_n >= 3 and r < 186:
                    continue  # hair highlight on the silhouette
                arr[y, x] = 0

    # restore a continuous ink outline where halo removal bit into hair / skin
    for y in range(h):
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            if _white_cloth(r, g, b) or _goldish(r, g, b) or dark(arr[y, x]):
                continue
            air = any(
                not (0 <= nx < w and 0 <= ny < h) or arr[ny, nx, 3] < 80
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if air and (_is_skin(arr[y, x]) or max(r, g, b) < 90 or (r < 80 and g < 70 and b < 65)):
                # skin on the silhouette already has ink in the concept; only
                # fill if this pixel is hair-dark leftover without an ink neighbour
                if not _is_skin(arr[y, x]) and not any(dark(arr[ny, nx]) for nx, ny in neigh(x, y) if 0 <= nx < w):
                    arr[y, x] = INK

    # last pass: 1–2 px near-white islands in the head band (sheet specks)
    for y in range(h):
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            if not (r > 220 and g > 218 and b > 210):
                continue
            if y > int(h * 0.52):
                continue
            n = sum(1 for nx, ny in neigh(x, y) if arr[ny, nx, 3] > 80)
            if n <= 2 and not _is_skin(arr[y, x]) and not _goldish(r, g, b):
                arr[y, x] = 0

    arr[..., 3] = np.where(arr[..., 3] > 80, 255, 0)
    return arr


def strip_concept_shadow(arr: np.ndarray) -> np.ndarray:
    """Drop the baked sheet oval under the shoes. Standing frames only."""
    h, w = arr.shape[:2]

    def leg_col(x, y0):
        run = 0
        for y in range(y0, max(0, y0 - 22), -1):
            if arr[y, x, 3] < 80:
                break
            if max(arr[y, x, :3]) < 70 or _is_skin(arr[y, x]):
                run += 1
            else:
                break
        return run >= 8

    rows = [y for y in range(h) if (arr[y, :, 3] > 80).any()]
    if not rows:
        return arr
    bottom = rows[-1]
    for y in range(max(0, bottom - 14), bottom + 1):
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            if leg_col(x, y):
                continue
            arr[y, x] = 0
    return arr


def clean_ankles(arr: np.ndarray) -> np.ndarray:
    """Drop grey sole-bars and dangling specks; leave shoes, then the ellipse."""
    h, w = arr.shape[:2]
    rows = [y for y in range(h) if (arr[y, :, 3] > 80).any()]
    if not rows:
        return arr
    bottom = rows[-1]
    band0 = max(0, bottom - 24)

    foot_skin = []
    wide_sole = None
    for y in range(band0, bottom + 1):
        run = 0
        best = 0
        for x in range(w):
            if arr[y, x, 3] > 80 and max(arr[y, x, :3]) < 70:
                run += 1
                best = max(best, run)
            else:
                run = 0
            if _is_skin(arr[y, x]) and y > int(h * 0.70):
                foot_skin.append(y)
        if best >= 8:
            wide_sole = y

    if foot_skin:
        sole_y = max(foot_skin)
    elif wide_sole is not None:
        sole_y = wide_sole
    else:
        sole_y = bottom

    for y in range(band0, bottom + 1):
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            if _is_skin(arr[y, x]) and y <= sole_y:
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            mx = max(r, g, b)
            grey = abs(r - g) < 28 and abs(g - b) < 28 and 45 <= mx <= 200
            if grey:
                dark_n = 0
                air = False
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < w and 0 <= ny < h) or arr[ny, nx, 3] < 80:
                        air = True
                    elif max(arr[ny, nx, :3]) < 70:
                        dark_n += 1
                # leftover shadow sits on the silhouette; shoe leather is boxed in by ink
                if air and dark_n < 3:
                    arr[y, x] = 0
            elif y > sole_y and mx < 90:
                arr[y, x] = 0
    return arr


def add_foot_shadow(arr: np.ndarray) -> np.ndarray:
    """Clean separate soft ellipse strictly below the shoes."""
    h, w = arr.shape[:2]
    xs, ys = [], []
    for y in range(int(h * 0.72), h):
        for x in range(w):
            if arr[y, x, 3] > 80 and max(arr[y, x, :3]) < 70:
                xs.append(x)
                ys.append(y)
    if len(xs) < 8:
        return arr
    cx = int(round(sum(xs) / len(xs)))
    foot_y = max(ys)
    rx, ry = 24, 5
    cy = min(h - 3, foot_y + 5)
    for y in range(foot_y + 1, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if not (0 <= y < h and 0 <= x < w):
                continue
            if arr[y, x, 3] > 80:
                continue
            t = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if t <= 1.0:
                a = int(SHADOW_A * (1.0 - t * 0.35))
                arr[y, x] = (22, 18, 22, a)
    return arr


def pad_canvas(src: np.ndarray, w: int = CW, h: int = CH, foot_pad: int = 0) -> np.ndarray:
    out = np.zeros((h, w, 4), np.uint8)
    sh, sw = src.shape[:2]
    room = h - foot_pad
    if sh > room:
        src = src[sh - room:]
        sh = src.shape[0]
    if sw > w:
        extra = sw - w
        src = src[:, extra // 2: extra // 2 + w]
        sw = w
    x = (w - sw) // 2
    y = h - sh - foot_pad
    if y < 0:
        src = src[-y:]
        sh = src.shape[0]
        y = 0
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
    """White-of-eye centroids, split by face center (not hoodie / one-eye median)."""
    h, w = arr.shape[:2]
    cx, cy = face_center(arr)
    top = next((y for y in range(h) if (arr[y, :, 3] > 80).any()), 0)
    ys, xs = np.where(
        (arr[:, :, 3] > 80) & (arr[:, :, 0] > 230) & (arr[:, :, 1] > 230) & (arr[:, :, 2] > 220)
    )
    if len(xs) < 4:
        return []
    keep = (ys > top + 24) & (ys < min(top + 110, cy + 28)) & (xs > 16) & (xs < w - 16)
    xs, ys = xs[keep], ys[keep]
    if len(xs) < 4:
        return []
    clusters = []
    for mask in (xs < cx - 4, xs > cx + 4):
        if mask.sum() >= 3:
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


def _is_metal_rim(c):
    r, g, b, a = int(c[0]), int(c[1]), int(c[2]), int(c[3] if len(c) > 3 else 255)
    if a < 80:
        return False
    if _is_eye_white(c) or _is_blush(c) or _is_skin(c) or _is_dark(c):
        return False
    if abs(r - g) >= 28 or abs(g - b) >= 28:
        return False
    if r <= 70 or r >= 210:
        return False
    if r > g + 16:
        return False
    return True


def black_rims(arr: np.ndarray, side: bool = False) -> None:
    """Concept glasses, same size: recolor metal rims to 1-art-px black. No lens fill."""
    h, w = arr.shape[:2]
    cx, fcy = face_center(arr)
    eyes = _find_eyes(arr)
    if not eyes:
        eyes = [(cx - 18, fcy + 6), (cx + 18, fcy + 6)] if not side else [(cx + 14, fcy + 6)]
    elif (not side) and len(eyes) == 1:
        ex, ey = eyes[0]
        eyes = [(cx - abs(ex - cx), ey), (cx + abs(ex - cx), ey)]

    def near_eye(x, y):
        return any(abs(x - ex) <= 22 and abs(y - ey) <= 18 for ex, ey in eyes)

    metal = np.zeros((h, w), bool)
    y0 = max(0, min(p[1] for p in eyes) - 20)
    y1 = min(h, max(p[1] for p in eyes) + 20)
    x0 = max(0, min(p[0] for p in eyes) - 30)
    x1 = min(w, max(p[0] for p in eyes) + 30)
    if side:
        x0, x1 = max(0, cx - 8), w
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not near_eye(x, y) and not side:
                continue
            if not _is_metal_rim(arr[y, x]):
                continue
            metal[y, x] = True
            continue
        # also grab grey that touches an eye-white even if the centroid missed
    for y in range(y0, y1):
        for x in range(x0, x1):
            if metal[y, x] or not _is_metal_rim(arr[y, x]):
                continue
            if any(
                0 <= y + dy < h and 0 <= x + dx < w and _is_eye_white(arr[y + dy, x + dx])
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1))
            ):
                metal[y, x] = True

    # one 1px dilate onto skin only — keeps diameter at the concept frames
    extra = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not metal[y, x]:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if not (0 <= ny < h and 0 <= nx < w):
                    continue
                if metal[ny, nx] or arr[ny, nx, 3] < 80:
                    continue
                if _is_eye_white(arr[ny, nx]) or _is_dark(arr[ny, nx]) or _is_blush(arr[ny, nx]):
                    continue
                if _is_skin(arr[ny, nx]) or _is_metal_rim(arr[ny, nx]):
                    extra.append((nx, ny))
    for x, y in extra:
        metal[y, x] = True

    for y in range(h):
        for x in range(w):
            if metal[y, x]:
                arr[y, x] = INK

    # black bridge between the two rims (front only)
    if not side and len(eyes) >= 2:
        (lx, ly), (rx, ry) = eyes[0], eyes[-1]
        by = (ly + ry) // 2
        # inner edges of the new black rims
        left_in = lx
        for x in range(lx, rx):
            if any(metal[by + t, x] for t in range(-3, 4) if 0 <= by + t < h):
                left_in = x
        right_in = rx
        for x in range(rx, lx, -1):
            if any(metal[by + t, x] for t in range(-3, 4) if 0 <= by + t < h):
                right_in = x
        if 3 < right_in - left_in <= 18:
            for x in range(left_in, right_in + 1):
                for t in range(2):
                    yy = by - 1 + t
                    if 0 <= yy < h and arr[yy, x, 3] > 80 and not _is_eye_white(arr[yy, x]):
                        put(arr, x, yy, INK)

    # tiny white glint on each lens (does not hide the eye bars)
    for ex, ey in eyes:
        gx, gy = ex - 4, ey - 5
        if 0 <= gy < h and 0 <= gx < w and _is_skin(arr[gy, gx]):
            put(arr, gx, gy, WHITE)


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


def _is_hair_px(c):
    """Grey / brown hair — not skin, not jacket, not eye bars."""
    if (c[3] if len(c) > 3 else 255) < 80:
        return False
    if _is_skin(c) or _is_eye_white(c) or _is_blush(c):
        return False
    r, g, b = int(c[0]), int(c[1]), int(c[2])
    if max(r, g, b) < 40:
        return False  # ink / pupils
    brown = 40 < max(r, g, b) < 175 and r >= g - 4 and g >= b - 6 and (r - b) > 6
    grey = 40 < max(r, g, b) < 160 and abs(r - g) < 22 and abs(g - b) < 22
    return brown or grey


def shave_head(arr: np.ndarray, back: bool = False) -> None:
    """Scalp only: hair → face skin. Never touch eyes / brows / mouth."""
    h, w = arr.shape[:2]
    top = next((y for y in range(h) if any(arr[y, x, 3] > 80 for x in range(w))), 0)
    cloth = _cloth_y(arr, top)
    cx, _ = face_center(arr)

    if back:
        brow = cloth
    else:
        eyes = _find_eyes(arr)
        if eyes:
            brow = min(p[1] for p in eyes) - 8
        else:
            brow = top + 48
        brow = max(top + 28, min(brow, cloth - 20))

    samples = []
    for y in range(brow, min(h, cloth)):
        for x in range(w):
            if _is_skin(arr[y, x]) and not _is_blush(arr[y, x]):
                samples.append(arr[y, x, :3])
    face = tuple(int(v) for v in np.median(np.stack(samples), 0)) + (255,) if samples else SKIN

    def in_face(x, y):
        return (not back) and y >= brow and abs(x - cx) <= 38

    # hair above the brow (and side hair only, never the face) → scalp
    for y in range(top, cloth):
        for x in range(w):
            if in_face(x, y):
                continue
            if not _is_hair_px(arr[y, x]):
                continue
            if y >= brow and abs(x - cx) <= 40:
                continue
            arr[y, x] = face

    # crown highlight + side shade — scalp rows only
    scalp_ys = [y for y in range(top, brow) if any(_is_skin(arr[y, x]) for x in range(w))]
    if scalp_ys:
        hy0, hy1 = min(scalp_ys), max(scalp_ys)
        xs = [x for y in range(hy0, hy1 + 1) for x in range(w) if _is_skin(arr[y, x])]
        if xs:
            mx = int(round(sum(xs) / len(xs)))
            mw = max(8, (max(xs) - min(xs)) // 2)
            mh = max(6, (hy1 - hy0) // 2)
            for y in range(hy0, hy1 + 1):
                for x in range(w):
                    if not _is_skin(arr[y, x]) or in_face(x, y):
                        continue
                    t = 1.0 - ((y - (hy0 + 6)) / max(1, mh))
                    side = abs(x - mx) / max(1, mw)
                    if t > 0.40 and side < 0.50:
                        mix = 0.40 * min(1.0, t)
                        arr[y, x] = (
                            int(face[0] * (1 - mix) + SKIN_H[0] * mix),
                            int(face[1] * (1 - mix) + SKIN_H[1] * mix),
                            int(face[2] * (1 - mix) + SKIN_H[2] * mix),
                            255,
                        )
                    elif side > 0.70:
                        mix = 0.22 * min(1.0, side)
                        arr[y, x] = (
                            int(face[0] * (1 - mix) + SKIN_S[0] * mix),
                            int(face[1] * (1 - mix) + SKIN_S[1] * mix),
                            int(face[2] * (1 - mix) + SKIN_S[2] * mix),
                            255,
                        )

    # continuous ink outline on the scalp only
    for y in range(top, brow):
        for x in range(w):
            if not _is_skin(arr[y, x]) or in_face(x, y):
                continue
            edge = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if not (0 <= ny < h and 0 <= nx < w) or arr[ny, nx, 3] < 80:
                    edge = True
                    break
            if edge:
                arr[y, x] = INK


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


def _inseam_y(arr, cx):
    """Crotch / sweater-hem: first split walking down from the waist, not the feet."""
    h, w = arr.shape[:2]
    for y in range(int(h * 0.48), h - 8):
        xs = [x for x in range(w) if arr[y, x, 3] > 80 and (_is_sweater(arr[y, x]) or _is_dark(arr[y, x]))]
        if len(xs) < 8:
            continue
        xs.sort()
        gap = max((xs[i + 1] - xs[i] for i in range(len(xs) - 1)), default=0)
        if gap >= 8 and min(xs) < cx - 6 and max(xs) > cx + 6:
            return y
    return int(h * 0.62)


def dress_08(arr: np.ndarray, back: bool = False, side: bool = False) -> None:
    """White collar + cuffs + gold pendant. At most 2–3 hem/cuff ribs. No trouser stripes."""
    h, w = arr.shape[:2]
    cx, cy = face_center(arr)
    if back:
        top = next((y for y in range(h) if any(arr[y, x, 3] > 80 for x in range(w))), 0)
        # nape is under the head, never the waist / hem
        y_lo, y_hi = top + 70, min(int(h * 0.48), top + 130)
        nape = None
        prev_w = 0
        for y in range(y_lo, y_hi):
            xs = [x for x in range(w) if arr[y, x, 3] > 80]
            if not xs:
                continue
            span = max(xs) - min(xs)
            if 28 <= span <= 56 and prev_w > 70:
                nape = y
                break
            prev_w = span
        if nape is None:
            return
        for y in range(nape, min(y_hi, nape + 3)):
            xs = [x for x in range(w) if arr[y, x, 3] > 80]
            if not xs or not (24 <= max(xs) - min(xs) <= 64):
                continue
            for x in range(cx - 12, cx + 13):
                if _is_sweater(arr[y, x]) or _is_dark(arr[y, x]):
                    put(arr, x, y, WHITE)
        return

    neck = _neckline(arr, cx, cy)
    if not side:
        for y in range(neck - 6, neck + 3):
            for x in range(cx - 20, cx + 21):
                if 0 <= x < w and 0 <= y < h and arr[y, x, 3] > 80:
                    if _is_sweater(arr[y, x]) or _is_skin(arr[y, x]) or _is_dark(arr[y, x]):
                        put(arr, x, y, WHITE)
    if side:
        # small collar edge just under the chin — not a chest bar
        chin = cy + 18
        for y in range(0, min(h, int(h * 0.42))):
            if any(_is_skin(arr[y, x]) and abs(x - cx) < 22 for x in range(w)):
                chin = y
        for y in range(chin + 1, chin + 5):
            for x in range(cx + 4, cx + 12):
                if 0 <= x < w and 0 <= y < h and arr[y, x, 3] > 80:
                    if _is_sweater(arr[y, x]) or _is_dark(arr[y, x]):
                        put(arr, x, y, WHITE)
        put(arr, cx + 8, chin + 7, GOLD)
        put(arr, cx + 8, chin + 8, GOLD_D)
    else:
        _collar_point(arr, cx - 20, neck - 1, cx - 2, neck - 1, cx - 12, neck + 18)
        _collar_point(arr, cx + 2, neck - 1, cx + 20, neck - 1, cx + 12, neck + 18)
        for i in range(14):
            put(arr, cx - 10 + i, neck + 10 + abs(i - 7), GOLD)
            put(arr, cx - 10 + i, neck + 11 + abs(i - 7), GOLD)
        for dx, dy in ((0, 0), (-1, 1), (1, 1), (0, 1), (0, 2), (-1, 2), (1, 2), (0, 3)):
            put(arr, cx + dx, neck + 18 + dy, GOLD if dy < 3 else GOLD_D)
        # 1px skin-light centre part — not orange
        top = next((y for y in range(h) if arr[y, cx, 3] > 80), 8)
        for y in range(top + 1, min(top + 16, cy - 28)):
            if arr[y, cx, 3] > 80 and not _is_skin(arr[y, cx]):
                put(arr, cx, y, PART)

    hem = _inseam_y(arr, cx) - 4
    x_lo, x_hi = cx - (14 if side else 26), cx + (20 if side else 26)
    for i, y in enumerate((hem, hem - 4, hem - 8)):
        if y <= neck + 20:
            continue
        for x in range(x_lo, x_hi + 1):
            if 0 <= x < w and 0 <= y < h and _is_sweater(arr[y, x]):
                put(arr, x, y, KNIT)

    # white cuffs + 2 rib lines just above them — never the feet
    cuff_hi = min(h - 40, neck + 88, hem - 10)
    for y in range(neck + 40, cuff_hi):
        skins = [x for x in range(w) if _is_skin(arr[y, x])]
        if len(skins) < 4:
            continue
        left = [x for x in skins if x < cx - 16]
        right = [x for x in skins if x > cx + 16]
        for cluster in (left, right):
            if len(cluster) < 3:
                continue
            hx = int(sum(cluster) / len(cluster))
            for yy in range(y - 8, y - 1):
                for x in range(hx - 7, hx + 8):
                    if 0 <= x < w and 0 <= yy < h and (_is_sweater(arr[yy, x]) or _is_dark(arr[yy, x])):
                        put(arr, x, yy, WHITE)
            for yy in (y - 10, y - 12):
                for x in range(hx - 6, hx + 7):
                    if 0 <= x < w and 0 <= yy < h and _is_sweater(arr[yy, x]):
                        put(arr, x, yy, KNIT)


def apply_laura(n: int, frames: dict) -> None:
    if n == 2:
        for k in ("front", "walk", "back", "sitF"):
            if k in frames:
                patch_02(frames[k])
    if n == 4:
        for k in frames:
            if k in ("back", "sitB"):
                continue
            black_rims(frames[k], side=k in ("side", "walk"))
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
        raw[name] = pad_canvas(raw[name], foot_pad=(0 if name in ("sitF", "sitB") else FOOT_PAD))
    apply_laura(n, raw)
    for name in ("front", "side", "back", "walk"):
        strip_concept_shadow(raw[name])
        polish_cutout(raw[name])
        clean_ankles(raw[name])
    polish_cutout(raw["sitF"])
    polish_cutout(raw["sitB"])
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
    sit = {"sit_front", "sit_back"}
    for k, v in frames.items():
        if k not in sit:
            add_foot_shadow(v)
    return {k: Image.fromarray(v, "RGBA") for k, v in frames.items()}


def make_lineup(fronts: list[Image.Image], concepts: list[Image.Image]) -> Image.Image:
    pad, title = 20, 44
    cell_w = 180
    cell_h = 300
    W = pad + 8 * (cell_w + pad)
    H = title + cell_h + 28 + cell_h + 36
    out = Image.new("RGBA", (W, H), (220, 216, 210, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 10), "cast HD v5  ·  concept crop  |  ours (same pixels + restrained Laura edits)",
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
    d.text((pad, 6), "cast HD v5 frames  ·  native crops + restrained 04/06/08", fill=(50, 40, 38, 255), font=_font(14))
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


def _hutong_floor_tile():
    path = PREVIEW / "hutong_empty_hd.png"
    if path.exists():
        im = np.array(Image.open(path).convert("RGB"))
        # mid-room floor, not the wall
        y0 = min(im.shape[0] - 80, max(0, int(im.shape[0] * 0.55)))
        x0 = min(im.shape[1] - 80, 200)
        return im[y0:y0 + 80, x0:x0 + 80]
    return np.full((80, 80, 3), (208, 206, 204), np.uint8)


def _fill_bg(cell, bg):
    if isinstance(bg, np.ndarray):
        arr = np.array(cell)
        th, tw = bg.shape[:2]
        for y in range(0, arr.shape[0], th):
            for x in range(0, arr.shape[1], tw):
                h = min(th, arr.shape[0] - y)
                w = min(tw, arr.shape[1] - x)
                arr[y:y + h, x:x + w, :3] = bg[:h, :w]
                arr[y:y + h, x:x + w, 3] = 255
        return Image.fromarray(arr, "RGBA")
    return cell


def make_cutout_check(all_frames: list[dict]) -> Image.Image:
    """All 8 idle_front + sit_front + sit_back on #222, #fff, and hutong floor."""
    keys = ("idle_front", "sit_front", "sit_back")
    cell_w, cell_h = 170, 290
    pad, title = 12, 36
    bgs = (
        ("#222", (34, 34, 34, 255)),
        ("#fff", (255, 255, 255, 255)),
        ("hutong floor", _hutong_floor_tile()),
    )
    W = pad + 8 * (cell_w + 8)
    H = title + len(bgs) * (3 * (cell_h + 8)) + 20
    out = Image.new("RGBA", (W, H), (160, 160, 160, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 8), "cast cutout check  ·  #222  ·  #fff  ·  hutong floor  ·  idle / sitF / sitB",
           fill=(30, 30, 30, 255), font=_font(14))
    for row, (label, bg) in enumerate(bgs):
        for i, frames in enumerate(all_frames):
            for c, k in enumerate(keys):
                im = frames[k]
                bb = im.getbbox()
                body = im.crop(bb) if bb else im
                if isinstance(bg, np.ndarray):
                    cell = _fill_bg(Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 255)), bg)
                else:
                    cell = Image.new("RGBA", (cell_w, cell_h), bg)
                ox = (cell_w - body.size[0]) // 2
                oy = 8
                cell.paste(body, (ox, oy), body)
                x = pad + i * (cell_w + 8)
                y = title + row * (3 * (cell_h + 8)) + c * (cell_h + 8)
                out.paste(cell, (x, y))
    return out


def make_cutout_x4(all_frames: list[dict]) -> Image.Image:
    """4× idle_front of all 8 on #222, #fff, and hutong floor."""
    floor = _hutong_floor_tile()
    bgs = ((34, 34, 34), (255, 255, 255), floor)
    labels = ("#222 ×4", "#fff ×4", "hutong floor ×4")
    cw, ch = CW * 4 + 12, CH * 4 + 28
    pad, title = 10, 32
    W = pad + 8 * cw
    H = title + 3 * ch + 8
    out = Image.new("RGBA", (W, H), (140, 140, 140, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 6), "cast cutout ×4  ·  idle_front on #222 / #fff / hutong floor",
           fill=(20, 20, 20, 255), font=_font(14))
    for row, (bg, lab) in enumerate(zip(bgs, labels)):
        d.text((pad, title + row * ch), lab, fill=(30, 30, 30, 255), font=_font(12))
        for i, frames in enumerate(all_frames):
            im = frames["idle_front"]
            big = im.resize((im.size[0] * 4, im.size[1] * 4), Image.Resampling.NEAREST)
            ba = np.array(big)
            if isinstance(bg, np.ndarray):
                canvas = np.zeros((ch - 20, cw - 8, 3), np.uint8)
                th, tw = bg.shape[:2]
                for y in range(0, canvas.shape[0], th):
                    for x in range(0, canvas.shape[1], tw):
                        hh = min(th, canvas.shape[0] - y)
                        ww = min(tw, canvas.shape[1] - x)
                        canvas[y:y + hh, x:x + ww] = bg[:hh, :ww]
            else:
                canvas = np.zeros((ch - 20, cw - 8, 3), np.uint8)
                canvas[:] = bg
            # center the sprite
            ox = max(0, (canvas.shape[1] - ba.shape[1]) // 2)
            oy = max(0, 8)
            bh = min(ba.shape[0], canvas.shape[0] - oy)
            bw = min(ba.shape[1], canvas.shape[1] - ox)
            m = ba[:bh, :bw, 3] > 0
            canvas[oy:oy + bh, ox:ox + bw][m] = ba[:bh, :bw, :3][m]
            x = pad + i * cw
            y = title + row * ch + 16
            out.paste(Image.fromarray(canvas), (x, y))
    return out


def write_cast_md():
    text = """# Cast · 8 Soul Knight chibi（HD v5, concept crops）

> Native crops from the 16:9 concept sheets · shared 168×272 canvas · no 4px crush.
> Concept sheets are **not** in git.

Laura edits (recolor, not redraw): 04 concept-size 1-art-px black rims (transparent lenses), 06 shaved scalp only (concept face kept), 07 caramel tips, 08 white collar / cuffs / gold pendant + 2–3 hem/cuff ribs.
Cutouts: hard alpha, no sheet halo / trapped gaps, ink outline kept, standing shadow is a separate soft ellipse (no ankle grey bar).

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
    cutout_x4 = make_cutout_x4(all_frames)
    for dest in (PREVIEW, ARTIFACT, REVIEW):
        dest.mkdir(parents=True, exist_ok=True)
        lineup.save(dest / "cast_hd_lineup.png")
        lineup.save(dest / "cast_hd_lineup_v5.png")
        frames_sheet.save(dest / "cast_hd_frames.png")
        cutout.save(dest / "cast_cutout_check.png")
        cutout_x4.save(dest / "cast_cutout_x4.png")

    for n, tag in ((4, "04"), (6, "06"), (8, "08")):
        fr = all_frames[n - 1]
        big = head_x4(fr["idle_front"], body=(n == 8))
        name = f"cast_{tag}_front_x4.png"
        for dest in (PREVIEW, ARTIFACT, REVIEW):
            big.save(dest / name)

    write_cast_md()
    print("Done HD cast v5 (restrained 04/06/08, clean ankles).")


if __name__ == "__main__":
    main()
