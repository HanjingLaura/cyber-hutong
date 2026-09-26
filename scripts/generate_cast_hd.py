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
REPLACE_IDS = {2, 4, 6, 8}
KEEP_IDS = {1, 3, 5, 7}
TARGET_STAND_H = 240  # match kept 01/03/05/07 standing body height


def find_sheet(n: int) -> Path:
    stem = f"cast0{n}_sk"
    if n in REPLACE_IDS:
        for d in REF_DIRS:
            if not d.exists():
                continue
            hits = sorted(d.glob(f"{stem}_v3*.png"))
            if hits:
                return hits[0]
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

    # Silhouette hole-fill: ink/skin/coloured cloth is the figure wall.
    # White sheet at the border is exterior. White *inside* the wall (hoodie)
    # is not reached from the border, so it stays.
    definite = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            r, g, b = int(crop[y, x, 0]), int(crop[y, x, 1]), int(crop[y, x, 2])
            if luma[y, x] < 70:
                definite[y, x] = True
            elif r > 190 and 120 < g < 220 and 90 < b < 200 and r > g + 10 and r > b + 20:
                definite[y, x] = True
            elif not (_is_sheet_grey(r, g, b, bgv, thr) or diff[y, x] <= thr):
                definite[y, x] = True

    dil = definite.copy()
    for y in range(h):
        for x in range(w):
            if definite[y, x]:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= ny < h and 0 <= nx < w and definite[ny, nx]:
                    dil[y, x] = True
                    break

    seen = np.zeros((h, w), bool)
    q = deque()

    def try_push(x, y):
        if 0 <= y < h and 0 <= x < w and not seen[y, x] and not dil[y, x]:
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

    # small interior sheet pockets (armpit / inseam), not the hoodie
    leftover = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            if seen[y, x] or luma[y, x] < 70:
                continue
            r, g, b = int(crop[y, x, 0]), int(crop[y, x, 1]), int(crop[y, x, 2])
            if r > 220 and g > 214 and b > 200:
                continue
            if diff[y, x] <= 18:
                leftover[y, x] = True
    vis = np.zeros((h, w), bool)
    for y0 in range(h):
        for x0 in range(w):
            if not leftover[y0, x0] or vis[y0, x0]:
                continue
            q = deque([(x0, y0)])
            vis[y0, x0] = True
            cells = [(x0, y0)]
            while q:
                x, y = q.popleft()
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= ny < h and 0 <= nx < w and leftover[ny, nx] and not vis[ny, nx]:
                        vis[ny, nx] = True
                        q.append((nx, ny))
                        cells.append((nx, ny))
            if len(cells) <= 140:
                for x, y in cells:
                    seen[y, x] = True

    # undo the 1px dilate on sheet-white: that ring is the white halo
    for y in range(h):
        for x in range(w):
            if seen[y, x] or definite[y, x] or not dil[y, x]:
                continue
            r, g, b = int(crop[y, x, 0]), int(crop[y, x, 1]), int(crop[y, x, 2])
            if r < 190 or g < 185 or b < 175:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= ny < h and 0 <= nx < w and seen[ny, nx]:
                    seen[y, x] = True
                    break

    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., :3] = crop
    rgba[..., 3] = np.where(seen, 0, 255)
    punch_limb_gaps(rgba)
    harden_outline(rgba, skip_shadow=False)
    # snapshot alpha so the halo pass cannot eat a white hoodie inward
    alpha0 = rgba[..., 3].copy()

    for y in range(h):
        for x in range(w):
            if alpha0[y, x] < 80 or luma[y, x] < 70:
                continue
            r, g, b = int(rgba[y, x, 0]), int(rgba[y, x, 1]), int(rgba[y, x, 2])
            if r > 220 and g > 214 and b > 200:
                continue
            air = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1)):
                nx, ny = x + dx, y + dy
                if not (0 <= ny < h and 0 <= nx < w) or alpha0[ny, nx] < 80:
                    air = True
                    break
            if air and (_is_sheet_grey(r, g, b, bgv, thr + 24) or diff[y, x] <= thr + 28):
                rgba[y, x] = (0, 0, 0, 0)
    rgba[..., 3] = np.where(rgba[..., 3] > 80, 255, 0)
    out = polish_cutout(rgba, bg)
    punch_limb_gaps(out)
    harden_outline(out, skip_shadow=False)
    return out


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


def _is_gap_white(r, g, b, a=255):
    """Sheet / cream trapped between limbs — not skin, not a white hoodie cluster check."""
    if a < 80:
        return False
    if r > 190 and 120 < g < 220 and 90 < b < 200 and r > g + 10 and r > b + 20:
        return False
    return abs(r - g) < 22 and abs(g - b) < 22 and r > 175


def punch_limb_gaps(arr: np.ndarray) -> np.ndarray:
    """Make inseam / armpit sheet-white transparent. Never touch a white hoodie."""
    h, w = arr.shape[:2]
    rows = [y for y in range(h) if (arr[y, :, 3] > 80).any()]
    if not rows:
        return arr
    top, bot = rows[0], rows[-1]
    bh = bot - top + 1

    def flood_band(y0, y1):
        seed = np.zeros((h, w), bool)
        for y in range(y0, y1 + 1):
            for x in range(w):
                r, g, b, a = (int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2]), int(arr[y, x, 3]))
                if not _is_gap_white(r, g, b, a):
                    continue
                air = False
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= ny < h and 0 <= nx < w) or arr[ny, nx, 3] < 80:
                        air = True
                        break
                if air:
                    seed[y, x] = True
        q = deque((x, y) for y in range(h) for x in range(w) if seed[y, x])
        seen = seed.copy()
        while q:
            x, y = q.popleft()
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if not (0 <= ny < h and 0 <= nx < w) or seen[ny, nx]:
                    continue
                if ny < y0 or ny > y1:
                    continue
                r, g, b, a = (int(arr[ny, nx, 0]), int(arr[ny, nx, 1]), int(arr[ny, nx, 2]), int(arr[ny, nx, 3]))
                if _is_gap_white(r, g, b, a):
                    seen[ny, nx] = True
                    q.append((nx, ny))
        return seen

    # inseam: lower 32% (legs only — hoodie hem stays)
    y_in = top + int(bh * 0.68)
    for y, x in zip(*np.where(flood_band(y_in, bot))):
        arr[y, x] = 0

    # armpits: mid band, small white pockets that already touch air
    y_a0, y_a1 = top + int(bh * 0.32), top + int(bh * 0.68)
    vis = np.zeros((h, w), bool)
    for y0 in range(y_a0, y_a1 + 1):
        for x0 in range(w):
            if vis[y0, x0] or arr[y0, x0, 3] < 80:
                continue
            r, g, b = int(arr[y0, x0, 0]), int(arr[y0, x0, 1]), int(arr[y0, x0, 2])
            if not _is_gap_white(r, g, b, int(arr[y0, x0, 3])):
                continue
            q = deque([(x0, y0)])
            vis[y0, x0] = True
            cells = [(x0, y0)]
            touches_air = False
            while q:
                x, y = q.popleft()
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= ny < h and 0 <= nx < w):
                        touches_air = True
                        continue
                    if arr[ny, nx, 3] < 80:
                        touches_air = True
                        continue
                    if vis[ny, nx] or ny < y_a0 or ny > y_a1:
                        continue
                    rr, gg, bb = int(arr[ny, nx, 0]), int(arr[ny, nx, 1]), int(arr[ny, nx, 2])
                    if _is_gap_white(rr, gg, bb, int(arr[ny, nx, 3])):
                        vis[ny, nx] = True
                        q.append((nx, ny))
                        cells.append((nx, ny))
            if touches_air and len(cells) <= 90:
                for x, y in cells:
                    arr[y, x] = 0
    return arr


def harden_outline(arr: np.ndarray, skip_shadow: bool = True) -> np.ndarray:
    """Outermost visible pixel is ink. Kill white fringe; recolor mixed edges."""
    h, w = arr.shape[:2]
    for y in range(h):
        for x in range(w):
            a = int(arr[y, x, 3])
            if a == 0:
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            if skip_shadow and a < 200 and max(r, g, b) < 45:
                continue
            light = abs(r - g) < 24 and abs(g - b) < 24 and r > 150
            if a < 90 or (a < 240 and light and not (r > 226 and g > 220 and b > 208 and a > 200)):
                if a < 160 or light:
                    arr[y, x] = (0, 0, 0, 0)
                    continue
            arr[y, x, 3] = 255

    # one ring only — never walk inward over a white hoodie
    alpha = arr[:, :, 3].copy()
    for y in range(h):
        for x in range(w):
            if alpha[y, x] < 80:
                continue
            if _is_skin(arr[y, x]):
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            air = False
            dark_n = 0
            white_n = 0
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= ny < h and 0 <= nx < w) or alpha[ny, nx] < 80:
                    air = True
                    continue
                rr, gg, bb = int(arr[ny, nx, 0]), int(arr[ny, nx, 1]), int(arr[ny, nx, 2])
                if max(rr, gg, bb) < 70:
                    dark_n += 1
                if _white_cloth(rr, gg, bb, int(arr[ny, nx, 3])):
                    white_n += 1
            if not air:
                continue
            if max(r, g, b) < 70:
                continue
            near_white = r > 200 and g > 194 and b > 184
            light = near_white or (r > 155 and g > 148 and b > 138) or (
                abs(r - g) < 22 and abs(g - b) < 22 and r > 140
            )
            if not light:
                # BOX-mixed outline (mid grey / brown) on the silhouette → ink
                if max(r, g, b) >= 70 and not _goldish(r, g, b):
                    arr[y, x] = INK
                continue
            # isolated / sheet-white halo: erase. fringe next to the figure: ink.
            if near_white and white_n < 2 and dark_n == 0:
                arr[y, x] = (0, 0, 0, 0)
            else:
                arr[y, x] = INK
    return arr


def fill_interior_holes(arr: np.ndarray, limit: int = 80) -> np.ndarray:
    """Fill small holes left after chair strip with neighbouring cloth."""
    h, w = arr.shape[:2]
    ext = np.zeros((h, w), bool)
    q = deque()

    def push(x, y):
        if 0 <= y < h and 0 <= x < w and not ext[y, x] and arr[y, x, 3] < 80:
            ext[y, x] = True
            q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)
    while q:
        x, y = q.popleft()
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            push(x + dx, y + dy)

    vis = np.zeros((h, w), bool)
    for y0 in range(h):
        for x0 in range(w):
            if vis[y0, x0] or ext[y0, x0] or arr[y0, x0, 3] > 80:
                continue
            q = deque([(x0, y0)])
            vis[y0, x0] = True
            cells = [(x0, y0)]
            while q:
                x, y = q.popleft()
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= ny < h and 0 <= nx < w) or vis[ny, nx]:
                        continue
                    if arr[ny, nx, 3] < 80 and not ext[ny, nx]:
                        vis[ny, nx] = True
                        q.append((nx, ny))
                        cells.append((nx, ny))
            if len(cells) > limit:
                continue
            samples = []
            for x, y in cells:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= ny < h and 0 <= nx < w and arr[ny, nx, 3] > 80:
                        if not _is_skin(arr[ny, nx]):
                            samples.append(tuple(int(v) for v in arr[ny, nx]))
            if not samples:
                continue
            fill = samples[len(samples) // 2]
            for x, y in cells:
                arr[y, x] = fill
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
    """Person-only sit: drop star / stem / seat / chair back. Do not hole the torso."""
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

    # skin bands: merge glasses gaps so the face is one band, then hands, then feet.
    raw_bands = []
    in_band, start = False, 0
    for y in range(top, h):
        n = sum(1 for x in range(w) if _is_skin(arr[y, x]))
        if n >= 2 and not in_band:
            start, in_band = y, True
        elif n < 2 and in_band:
            raw_bands.append((start, y - 1))
            in_band = False
    if in_band:
        raw_bands.append((start, h - 1))
    bands = []
    for a, b in raw_bands:
        if bands and a - bands[-1][1] <= 16:
            bands[-1] = (bands[-1][0], b)
        else:
            bands.append((a, b))
    last_skin = None
    if bands:
        face_end = bands[0][1]
        for a, b in bands[1:]:
            if a >= face_end + 20:
                last_skin = b
                break
        if last_skin is None:
            last_skin = min(h - 1, face_end + 78)
    # only trust a stem cut below the hands — never a mid-torso pinch
    stem_y = None
    search_from = (last_skin + 4) if last_skin is not None else int(h * 0.70)
    for y in range(h - 1, min(h - 1, search_from) - 1, -1):
        if y < int(h * 0.62):
            break
        span, dark = _row_span(arr, y)
        if 8 <= span <= 40 and dark > 0.55:
            stem_y = y
            break
    if last_skin is not None:
        cut = min(h, last_skin + 8)
        if stem_y is not None and stem_y >= last_skin:
            cut = min(cut, stem_y)
    elif stem_y is not None:
        cut = stem_y
    else:
        cut = int(h * 0.78)
    arr[cut:] = 0
    return arr


def _span_hw(arr, y):
    xs = [x for x in range(arr.shape[1]) if arr[y, x, 3] > 80]
    if not xs:
        return 0
    return (max(xs) - min(xs)) // 2


def clip_sit_to_stand(sit: np.ndarray, stand: np.ndarray, pad: int = 6) -> np.ndarray:
    """Drop sheet-chair pixels outside a head-tight / body-reasonable envelope."""
    sh, sw = stand.shape[:2]
    h, w = sit.shape[:2]
    st = next((y for y in range(sh) if (stand[y, :, 3] > 80).any()), 0)
    sb = next((y for y in range(sh - 1, -1, -1) if (stand[y, :, 3] > 80).any()), sh - 1)
    si = next((y for y in range(h) if (sit[y, :, 3] > 80).any()), 0)
    se = next((y for y in range(h - 1, -1, -1) if (sit[y, :, 3] > 80).any()), h - 1)
    ixs = [x for y in range(si, min(h, si + 80)) for x in range(w) if _is_skin(sit[y, x])]
    icx = int(round(sum(ixs) / len(ixs))) if ixs else w // 2
    stand_h = max(1, sb - st + 1)
    sit_h = max(1, se - si + 1)

    def band_hw(arr, y0, y1):
        vals = [_span_hw(arr, y) for y in range(y0, y1) if _span_hw(arr, y)]
        return max(vals) if vals else 20

    head_hw = band_hw(sit, si, si + max(8, int(sit_h * 0.24)))
    if head_hw < 8:
        head_hw = band_hw(stand, st, st + max(8, int(stand_h * 0.28)))
    neck_vals = [_span_hw(stand, y) for y in range(st + int(stand_h * 0.22), st + int(stand_h * 0.40))]
    neck_vals = [v for v in neck_vals if v]
    neck_hw = min(neck_vals) if neck_vals else max(10, head_hw - 6)
    body_hw = max(head_hw + 10, neck_hw + 16) + pad
    lap_hw = max(head_hw + 8, neck_hw + 14) + pad

    for y in range(h):
        rel = (y - si) / sit_h
        if rel < 0.34:
            hw = head_hw + 3
        elif rel < 0.70:
            hw = body_hw
        else:
            hw = lap_hw
        for x in range(w):
            if sit[y, x, 3] < 80:
                continue
            if _is_skin(sit[y, x]) or _white_cloth(
                int(sit[y, x, 0]), int(sit[y, x, 1]), int(sit[y, x, 2]), int(sit[y, x, 3])
            ):
                continue
            if abs(x - icx) > hw and (_is_dark(sit[y, x]) or max(sit[y, x, :3]) < 110):
                sit[y, x] = 0
    return sit


def keep_largest_body(arr: np.ndarray) -> np.ndarray:
    """Drop detached chair arms / stem bits after the envelope clip."""
    h, w = arr.shape[:2]
    seen = np.zeros((h, w), bool)
    best, best_n = None, 0
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0, x0] or arr[y0, x0, 3] < 80:
                continue
            q = deque([(x0, y0)])
            seen[y0, x0] = True
            cells = [(x0, y0)]
            while q:
                x, y = q.popleft()
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and arr[ny, nx, 3] > 80:
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
    return arr


def _is_brown_hair_px(c):
    r, g, b, a = int(c[0]), int(c[1]), int(c[2]), int(c[3] if len(c) > 3 else 255)
    if a < 80 or _is_skin(c):
        return False
    return 35 < r < 175 and g < r + 8 and b < g + 10 and r >= g - 4 and (r - b) > 8


def _is_grey_cloth(c):
    r, g, b, a = int(c[0]), int(c[1]), int(c[2]), int(c[3] if len(c) > 3 else 255)
    if a < 80:
        return False
    mx = max(r, g, b)
    return 55 <= mx < 155 and abs(r - g) < 20 and abs(g - b) < 20


def _is_blue_collar(c):
    r, g, b, a = int(c[0]), int(c[1]), int(c[2]), int(c[3] if len(c) > 3 else 255)
    return a > 80 and b > 140 and g > 130 and b > r + 8


def _is_person_color(c):
    if _is_skin(c) or _white_cloth(int(c[0]), int(c[1]), int(c[2]), int(c[3] if len(c) > 3 else 255)):
        return True
    if _goldish(int(c[0]), int(c[1]), int(c[2]), int(c[3] if len(c) > 3 else 255)):
        return True
    return _is_brown_hair_px(c) or _is_grey_cloth(c) or _is_blue_collar(c)


def drop_sheet_chair(arr: np.ndarray, stand: np.ndarray) -> np.ndarray:
    """Remove chair back / arms. Never scanline-cut a dark sweater."""
    h, w = arr.shape[:2]
    sh = stand.shape[0]
    st = next((y for y in range(sh) if (stand[y, :, 3] > 80).any()), 0)
    sb = next((y for y in range(sh - 1, -1, -1) if (stand[y, :, 3] > 80).any()), sh - 1)
    stand_h = max(1, sb - st + 1)
    top = next((y for y in range(h) if (arr[y, :, 3] > 80).any()), 0)
    bot = next((y for y in range(h - 1, -1, -1) if (arr[y, :, 3] > 80).any()), h - 1)
    ixs = [x for y in range(top, min(h, top + 120)) for x in range(w) if _is_skin(arr[y, x])]
    icx = int(round(sum(ixs) / len(ixs))) if ixs else w // 2
    chin = top
    for y in range(top, min(h, top + 140)):
        if sum(1 for x in range(w) if _is_skin(arr[y, x])) >= 8:
            chin = y

    torso_vals = [_span_hw(stand, y) * 2 + 1 for y in range(st + int(stand_h * 0.56), st + int(stand_h * 0.72))]
    torso_vals = [v for v in torso_vals if v >= 30]
    torso_w = int(sorted(torso_vals)[len(torso_vals) // 2]) if torso_vals else 80

    # 04: black chair vs white hoodie — only below the chin (avoid eye-white)
    last_white = None
    for y in range(chin + 2, h):
        whites = [x for x in range(w) if _white_cloth(
            int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2]), int(arr[y, x, 3])
        )]
        if len(whites) >= 12 and max(whites) - min(whites) >= 28:
            last_white = (min(whites) - 3, max(whites) + 3)
        elif last_white is None:
            continue
        lo, hi = last_white
        for x in range(w):
            if arr[y, x, 3] < 80 or lo <= x <= hi:
                continue
            if _is_skin(arr[y, x]) or _is_brown_hair_px(arr[y, x]):
                continue
            if _is_dark(arr[y, x]) or max(arr[y, x, :3]) < 110:
                arr[y, x] = 0

    # chair back: stencil the head→shoulder band from the standing crop
    s_face = [y for y in range(st, min(sh, st + 140)) for x in range(stand.shape[1]) if _is_skin(stand[y, x])]
    s_cy = int(round(sum(s_face) / len(s_face))) if s_face else st + 70
    i_face = [y for y in range(top, min(h, top + 140)) for x in range(w) if _is_skin(arr[y, x])]
    i_cy = int(round(sum(i_face) / len(i_face))) if i_face else chin
    for y in range(top, min(h, chin + 34)):
        sy = s_cy + (y - i_cy)
        if sy < 0 or sy >= sh:
            continue
        hw = _span_hw(stand, sy) + 3
        if hw < 8:
            continue
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            if _is_skin(arr[y, x]) or _white_cloth(
                int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2]), int(arr[y, x, 3])
            ):
                continue
            if _is_brown_hair_px(arr[y, x]) or _is_grey_cloth(arr[y, x]) or _is_blue_collar(arr[y, x]):
                continue
            if abs(x - icx) > hw and (_is_dark(arr[y, x]) or max(arr[y, x, :3]) < 100):
                arr[y, x] = 0

    # armrests / leftover seat: only the lower third, never the chest
    lap0 = top + int((bot - top) * 0.62)
    hw = max(28, torso_w // 2)
    for y in range(lap0, h):
        for x in range(w):
            if arr[y, x, 3] < 80:
                continue
            if _is_skin(arr[y, x]) or _white_cloth(
                int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2]), int(arr[y, x, 3])
            ):
                continue
            if abs(x - icx) > hw and (_is_dark(arr[y, x]) or max(arr[y, x, :3]) < 100):
                arr[y, x] = 0
    return arr


def extract_sit_person(sit: np.ndarray, stand: np.ndarray) -> np.ndarray:
    """Seated person + own lap; no sheet chair, no torso holes, no bars."""
    arr = sit.copy()
    strip_chair(arr, back=False)
    drop_sheet_chair(arr, stand)
    keep_largest_body(arr)
    fill_interior_holes(arr, limit=200)
    harden_outline(arr, skip_shadow=False)
    return arr


def clip_sit_width(sit: np.ndarray, stand: np.ndarray, pad: int = 8) -> np.ndarray:
    """Keep sit_front no wider than the standing crop, so sheet chairs don't double."""
    ys, xs = np.where(stand[:, :, 3] > 80)
    iy, ix = np.where(sit[:, :, 3] > 80)
    if len(xs) < 20 or len(ix) < 20:
        return sit
    half = int(xs.max() - xs.min() + 1) // 2 + pad
    cx = (int(ix.min()) + int(ix.max())) // 2
    if cx - half > 0:
        sit[:, : cx - half] = 0
    if cx + half + 1 < sit.shape[1]:
        sit[:, cx + half + 1 :] = 0
    return sit


def sit_from_back(arr: np.ndarray, tall: bool = False) -> np.ndarray:
    """Head + shoulders + upper back from the standing back crop.

    Long-hair 08 needs extra depth so the nape collar stays in the sit_back frame.
    """
    out = arr.copy()
    h, w = out.shape[:2]
    top = next((y for y in range(h) if any(out[y, x, 3] > 80 for x in range(w))), 0)
    depth = 148
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
    # 02/04/06/08 v3 sheets already include identity — do not recolor.
    if n == 7:
        for k in frames:
            caramel_tips(frames[k])


def flip_h(arr: np.ndarray) -> np.ndarray:
    return arr[:, ::-1].copy()


def scale_to_height(figs: list[np.ndarray], target_h: int = TARGET_STAND_H) -> list[np.ndarray]:
    """Downscale a character's poses together so standing height matches the kept cast."""
    front = figs[1]
    ys, xs = np.where(front[:, :, 3] > 80)
    if len(ys) < 20:
        return figs
    bh = int(ys.max() - ys.min() + 1)
    if bh <= target_h + 6:
        print(f"    height {bh} already matches target {target_h}")
        return figs
    scale = target_h / bh
    print(f"    scale standing {bh}→{target_h}  factor={scale:.3f} (BOX, no 4px grid)")
    out = []
    for fig in figs:
        nh = max(1, int(round(fig.shape[0] * scale)))
        nw = max(1, int(round(fig.shape[1] * scale)))
        im = Image.fromarray(fig, "RGBA").resize((nw, nh), Image.Resampling.BOX)
        a = np.array(im)
        punch_limb_gaps(a)
        harden_outline(a, skip_shadow=False)
        out.append(a)
    return out


def load_existing(n: int) -> dict[str, Image.Image]:
    dest = HD_DIR / f"cast_0{n}"
    frames = {}
    for p in sorted(dest.glob("*.png")):
        frames[p.stem] = Image.open(p).convert("RGBA")
    if "idle_front" not in frames:
        raise FileNotFoundError(f"missing existing {dest}/idle_front.png")
    return frames


def process_one(n: int, figs: list[np.ndarray]) -> dict[str, Image.Image]:
    if n in REPLACE_IDS:
        figs = scale_to_height(figs, TARGET_STAND_H)
    raw = {}
    for name, fig in zip(POSE_NAMES, figs):
        # 4px snap is measured for the record, but any MAD is visible on faces
        # and sweaters — keep the native crop and render nearest at 1:1.
        snap_degrades(fig)
        print(f"    {name}: keeping native crop")
        raw[name] = fig
    # strip chairs on the native sit crops, then pad so we never clip a head
    raw["sitF"] = extract_sit_person(raw["sitF"], raw["front"])
    # concept sit_back is almost all chair; head + shoulders from standing back
    raw["sitB"] = sit_from_back(raw["back"], tall=False)
    harden_outline(raw["sitB"], skip_shadow=False)
    for name in list(raw):
        raw[name] = pad_canvas(raw[name], foot_pad=(0 if name in ("sitF", "sitB") else FOOT_PAD))
    apply_laura(n, raw)
    for name in ("front", "side", "back", "walk"):
        strip_concept_shadow(raw[name])
        punch_limb_gaps(raw[name])
        clean_ankles(raw[name])
        harden_outline(raw[name], skip_shadow=False)
    harden_outline(raw["sitF"], skip_shadow=False)
    harden_outline(raw["sitB"], skip_shadow=False)
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


def make_fronts_lineup(fronts: list[Image.Image], x4s: list[tuple[str, Image.Image]]) -> Image.Image:
    """All 8 idle_front at 1×, plus 4× crops of the four replaced casts."""
    pad, title = 16, 40
    cell_w, cell_h = CW + 12, CH + 24
    x4_w = pad + sum(im.size[0] + 16 for _, im in x4s)
    W = max(pad + 8 * (cell_w + 8), x4_w)
    x4_h = max((im.size[1] for _, im in x4s), default=200) + 36
    H = title + cell_h + 20 + x4_h + 16
    out = Image.new("RGBA", (W, H), (220, 216, 210, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 10), "cast HD v6  ·  8 fronts at 1×  ·  02/04/06/08 are new v3 cutouts  ·  01/03/05/07 kept",
           fill=(50, 40, 38, 255), font=_font(16))
    for i, ours in enumerate(fronts):
        x = pad + i * (cell_w + 8)
        bb = ours.getbbox()
        body = ours.crop(bb) if bb else ours
        ox = x + (cell_w - body.size[0]) // 2
        oy = title + (cell_h - 16 - body.size[1])
        out.paste(body, (ox, oy), body)
        tag = "new" if (i + 1) in REPLACE_IDS else "keep"
        d.text((x, title + cell_h - 14), f"0{i+1} {tag}", fill=(90, 60, 56, 255), font=_font(12))
    y0 = title + cell_h + 8
    d.text((pad, y0), "4× crops  ·  02 / 04 / 06 / 08", fill=(50, 40, 38, 255), font=_font(14))
    x = pad
    for tag, im in x4s:
        out.paste(im, (x, y0 + 22), im)
        d.text((x, y0 + 22 + im.size[1] + 2), tag, fill=(90, 60, 56, 255), font=_font(12))
        x += im.size[0] + 16
    return out


def make_v3_compare(pairs: list[tuple[int, Image.Image, Image.Image]]) -> Image.Image:
    """Side-by-side concept crop vs our cutout for the four replaced casts."""
    pad, title, cap = 16, 40, 18
    cell_w, cell_h = 200, 300
    W = pad + 4 * (2 * cell_w + 28)
    H = title + cell_h + cap + 16
    out = Image.new("RGBA", (W, H), (220, 216, 210, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 10), "cast v3 compare  ·  concept (scaled, no edits)  |  ours (same cutout + shadow)",
           fill=(50, 40, 38, 255), font=_font(16))
    for i, (n, con, ours) in enumerate(pairs):
        x = pad + i * (2 * cell_w + 28)
        for col, (im, lab) in enumerate(((con, "concept"), (ours, "ours"))):
            bb = im.getbbox()
            body = im.crop(bb) if bb else im
            if body.size[1] > cell_h - 8:
                ratio = (cell_h - 8) / body.size[1]
                nw = max(1, int(body.size[0] * ratio))
                body = body.resize((nw, cell_h - 8), Image.Resampling.NEAREST)
            ox = x + col * cell_w + (cell_w - body.size[0]) // 2
            oy = title + (cell_h - 8 - body.size[1])
            out.paste(body, (ox, oy), body)
            d.text((x + col * cell_w, title + cell_h), f"0{n} {lab}", fill=(90, 60, 56, 255), font=_font(12))
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
    d.text((pad, 6), "cast HD v6 frames  ·  02/04/06/08 v3 cutouts  ·  01/03/05/07 kept", fill=(50, 40, 38, 255), font=_font(14))
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


def make_dark_poses_x4(all_frames: list[dict]) -> Image.Image:
    """4× idle_side / front / back / walk / sitF / sitB of 02/04/06/08 on #222."""
    keys = ("idle_side", "idle_front", "idle_back", "walk_side_0", "sit_front", "sit_back")
    ids = (2, 4, 6, 8)
    cell_w, cell_h = CW * 4 + 16, CH * 4 + 24
    pad, title = 12, 36
    W = pad + len(keys) * cell_w
    H = title + len(ids) * cell_h + 8
    out = Image.new("RGBA", (W, H), (20, 20, 22, 255))
    d = ImageDraw.Draw(out)
    d.text((pad, 8), "02/04/06/08  ·  6 poses ×4 on #222  ·  outline must be ink, no bars, no chair",
           fill=(230, 230, 230, 255), font=_font(14))
    for r, n in enumerate(ids):
        frames = all_frames[n - 1]
        for c, k in enumerate(keys):
            im = frames[k]
            big = im.resize((im.size[0] * 4, im.size[1] * 4), Image.Resampling.NEAREST)
            ba = np.array(big)
            canvas = np.full((cell_h - 16, cell_w - 8, 3), 34, np.uint8)
            ox = max(0, (canvas.shape[1] - ba.shape[1]) // 2)
            oy = 4
            bh = min(ba.shape[0], canvas.shape[0] - oy)
            bw = min(ba.shape[1], canvas.shape[1] - ox)
            m = ba[:bh, :bw, 3] > 0
            canvas[oy:oy + bh, ox:ox + bw][m] = ba[:bh, :bw, :3][m]
            x = pad + c * cell_w
            y = title + r * cell_h
            out.paste(Image.fromarray(canvas), (x, y))
            if r == 0:
                d.text((x, title - 16), k.replace("_", " "), fill=(200, 200, 200, 255), font=_font(11))
    return out


def write_cast_md():
    text = """# Cast · 8 Soul Knight chibi（HD v6, concept crops）

> Native crops from the 16:9 concept sheets · shared 168×272 canvas · no 4px crush.
> 02 / 04 / 06 / 08 are the v3 sheets, scaled to the kept-cast standing height.
> 01 / 03 / 05 / 07 are unchanged from v5. Concept sheets are **not** in git.

No hand pixel edits on 02/04/06/08 — glasses, fade, earrings, and outfits come from the sheet.
07 still has caramel tips. Cutouts: hard alpha, no sheet halo / trapped gaps, ink outline kept,
standing shadow is a separate soft ellipse (no ankle grey bar).

| ID | 像素辨认点 |
|----|------------|
| `cast_01` | 侧分长黑发 · 白露肩 · 白花耳饰 |
| `cast_02` | 男 · 短刺发 · 黑 V 领毛衣 · 浅蓝衬衫领 |
| `cast_03` | 齐下巴波浪波波 · 粉针织 · 金圈 |
| `cast_04` | 直波波刘海 · 黑圆框眼镜 · 白卫衣 |
| `cast_05` | 齐肩微卷 · 黑西装金扣 · 金圈 |
| `cast_06` | 男 · 短寸 fade · 深灰西装 · 黑衬衫 |
| `cast_07` | 褐长发浅焦糖发尾 · 灰西装 |
| `cast_08` | 超长黑直发 · 黑毛衣 · 小耳钉 |

坐姿是人（椅已剥）。胡同椅子由房间画。
"""
    (ROOT / "design" / "cast.md").write_text(text, encoding="utf-8")


def main():
    PREVIEW.mkdir(parents=True, exist_ok=True)
    ARTIFACT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    HD_DIR.mkdir(parents=True, exist_ok=True)

    all_frames: list[dict] = []
    fronts: list[Image.Image] = []
    pairs: list[tuple[int, Image.Image, Image.Image]] = []
    for n in range(1, 9):
        cid = f"cast_0{n}"
        dest = HD_DIR / cid
        dest.mkdir(parents=True, exist_ok=True)
        if n in KEEP_IDS:
            frames = load_existing(n)
            print(f"  {cid} KEEP existing ({len(frames)} frames)")
        else:
            path = find_sheet(n)
            print(f"  {cid} REPLACE from {path.name}")
            figs = segment_poses(path)
            concept = scale_to_height([f.copy() for f in figs], TARGET_STAND_H)[1]
            frames = process_one(n, figs)
            for name, im in frames.items():
                im.save(dest / f"{name}.png")
            pairs.append((n, Image.fromarray(concept, "RGBA"), frames["idle_front"]))
        fronts.append(frames["idle_front"])
        all_frames.append(frames)
        bb = frames["idle_front"].getbbox()
        print(f"    {cid} idle {frames['idle_front'].size} bbox={bb}")

    x4s = []
    for n in (2, 4, 6, 8):
        big = head_x4(all_frames[n - 1]["idle_front"], body=True)
        x4s.append((f"0{n} ×4", big))
        name = f"cast_0{n}_front_x4.png"
        for dest in (PREVIEW, ARTIFACT, REVIEW):
            dest.mkdir(parents=True, exist_ok=True)
            big.save(dest / name)

    lineup = make_fronts_lineup(fronts, x4s)
    compare = make_v3_compare(pairs)
    frames_sheet = make_frames(all_frames)
    cutout = make_cutout_check(all_frames)
    cutout_x4 = make_cutout_x4(all_frames)
    dark_poses = make_dark_poses_x4(all_frames)
    for dest in (PREVIEW, ARTIFACT, REVIEW):
        dest.mkdir(parents=True, exist_ok=True)
        lineup.save(dest / "cast_hd_lineup.png")
        lineup.save(dest / "cast_hd_lineup_v6.png")
        compare.save(dest / "cast_v3_compare.png")
        frames_sheet.save(dest / "cast_hd_frames.png")
        cutout.save(dest / "cast_cutout_check.png")
        cutout_x4.save(dest / "cast_cutout_x4.png")
        dark_poses.save(dest / "cast_new4_poses_x4_dark.png")

    write_cast_md()
    print("Done HD cast v6b (clean outlines, sit person-only, 01/03/05/07 kept).")


if __name__ == "__main__":
    main()
