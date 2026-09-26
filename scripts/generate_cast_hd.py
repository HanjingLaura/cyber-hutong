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


def clean_alpha(crop: np.ndarray, bg, thr: int = 32) -> np.ndarray:
    """Flood-fill from the border; drop halo; keep dark outline."""
    h, w = crop.shape[:2]
    bg = bg.astype(np.int16)
    diff = np.abs(crop.astype(np.int16) - bg).sum(axis=2)
    luma = crop.astype(np.int16) @ np.array([30, 59, 11]) // 100

    def is_bg_px(y, x):
        if luma[y, x] < 72:
            return False  # black outline stays
        return diff[y, x] <= thr

    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg_px(y, x) and not seen[y, x]:
                seen[y, x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg_px(y, x) and not seen[y, x]:
                seen[y, x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and is_bg_px(ny, nx):
                seen[ny, nx] = True
                q.append((nx, ny))

    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., :3] = crop
    rgba[..., 3] = np.where(seen, 0, 255)

    # halo: near-bg fringe next to transparent, unless it's the dark outline
    for y in range(h):
        for x in range(w):
            if rgba[y, x, 3] < 80 or luma[y, x] < 72:
                continue
            if diff[y, x] > thr + 18:
                continue
            halo = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if not (0 <= ny < h and 0 <= nx < w) or rgba[ny, nx, 3] < 80:
                    halo = True
                    break
            if halo:
                rgba[y, x, 3] = 0
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


def sit_from_back(arr: np.ndarray) -> np.ndarray:
    """Head + shoulders + upper back from the standing back crop."""
    out = arr.copy()
    h, w = out.shape[:2]
    top = next((y for y in range(h) if any(out[y, x, 3] > 80 for x in range(w))), 0)
    out[min(h, top + 148):] = 0
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


def recolor_glasses(arr: np.ndarray) -> None:
    """Paint existing concept rims black. Do not touch eyes / skin / hair."""
    h, w = arr.shape[:2]
    cx, cy = face_center(arr)
    for y in range(max(0, cy - 28), min(h, cy + 16)):
        for x in range(max(0, cx - 40), min(w, cx + 41)):
            r, g, b, a = arr[y, x]
            if a < 80 or _is_skin(arr[y, x]) or _is_dark(arr[y, x]):
                continue
            # hair / bangs
            if max(r, g, b) < 90:
                continue
            # white hoodie
            if r > 200 and g > 195 and b > 190:
                continue
            grey = abs(int(r) - int(g)) < 28 and abs(int(g) - int(b)) < 28
            metal = grey and 90 < r < 230
            if metal:
                arr[y, x] = INK


def shave_head(arr: np.ndarray) -> None:
    """Smooth skin dome. Keep the existing outline. Soft stubble wash, no ring."""
    h, w = arr.shape[:2]
    cx, cy = face_center(arr)
    top = next((y for y in range(h) if any(arr[y, x, 3] > 80 for x in range(w))), 0)
    # head ends around the brow / ears
    scalp_end = min(h, max(cy + 4, top + 90))
    for y in range(top, scalp_end):
        for x in range(w):
            if arr[y, x, 3] < 80 or _is_skin(arr[y, x]):
                continue
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            # keep true outline (very dark on the silhouette)
            edge = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if not (0 <= ny < h and 0 <= nx < w) or arr[ny, nx, 3] < 80:
                    edge = True
                    break
            if edge and max(r, g, b) < 55:
                continue
            # keep pupils (dark touching lots of skin)
            if max(r, g, b) < 50:
                skin_n = sum(
                    1 for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1))
                    if 0 <= y + dy < h and 0 <= x + dx < w and _is_skin(arr[y + dy, x + dx])
                )
                if skin_n >= 3:
                    continue
            # hair / leftover stubble → solid skin
            if max(r, g, b) < 200:
                arr[y, x] = SKIN
    # soft crown wash (wide, low contrast — not a 1px ring)
    for y in range(top + 3, min(top + 22, scalp_end)):
        t = 1.0 - (y - top - 3) / 20.0
        mix = 0.22 * t
        for x in range(w):
            if not _is_skin(arr[y, x]):
                continue
            r, g, b, a = arr[y, x]
            arr[y, x] = (
                int(r * (1 - mix) + SKIN_S[0] * mix),
                int(g * (1 - mix) + SKIN_S[1] * mix),
                int(b * (1 - mix) + SKIN_S[2] * mix),
                255,
            )


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


def patch_08(arr: np.ndarray, back: bool) -> None:
    h, w = arr.shape[:2]
    cx, cy = face_center(arr)
    if not back:
        # 1px center part on the front only — a short skin line at the crown
        top = next((y for y in range(h) if _is_dark(arr[y, cx]) or max(arr[y, cx, :3]) < 80), 8)
        for y in range(top + 2, min(top + 22, cy - 28)):
            if arr[y, cx, 3] > 80 and not _is_skin(arr[y, cx]):
                put(arr, cx, y, SKIN_S)
        # white collar: first sweater row under the chin
        neck = None
        for y in range(cy + 18, min(cy + 70, h)):
            if _is_dark(arr[y, cx]) and _is_dark(arr[y, cx - 6]) and _is_dark(arr[y, cx + 6]):
                neck = y
                break
        if neck is not None:
            for x in range(cx - 16, cx + 17):
                if 0 <= x < w and arr[neck, x, 3] > 80 and (_is_dark(arr[neck, x]) or _is_skin(arr[neck, x])):
                    put(arr, x, neck, WHITE)
            # thin V necklace on the sweater
            for i, half in enumerate(range(1, 11)):
                y = neck + 2 + i
                put(arr, cx - half, y, WHITE)
                put(arr, cx + half, y, WHITE)
            put(arr, cx, neck + 12, WHITE)
    else:
        for y in range(min(90, h)):
            if _is_skin(arr[y, cx]):
                arr[y, cx] = HAIR_K


def apply_laura(n: int, frames: dict) -> None:
    if n == 2:
        for k in ("front", "walk", "back", "sitF"):
            if k in frames:
                patch_02(frames[k])
    if n == 4:
        for k in ("front", "walk", "sitF", "side"):
            if k in frames:
                recolor_glasses(frames[k])
    if n == 6:
        for k in frames:
            shave_head(frames[k])
    if n == 7:
        for k in frames:
            caramel_tips(frames[k])
    if n == 8:
        for k in frames:
            patch_08(frames[k], back=k in ("back", "sitB"))


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
    raw["sitB"] = sit_from_back(raw["back"])
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
    d.text((pad, 10), "cast HD v3  ·  concept crop  |  our crop (same pixels + Laura edits)",
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
    d.text((pad, 6), "cast HD v3 frames  ·  native crops", fill=(50, 40, 38, 255), font=_font(14))
    for r, frames in enumerate(all_frames):
        for c, k in enumerate(keys):
            im = frames[k]
            x, y = pad + c * cw, title + r * ch
            out.paste(im, (x, y), im)
            if r == 0:
                d.text((x, y + CH + 1), k.replace("_", " "), fill=(90, 80, 74, 255), font=_font(10))
    return out


def head_x4(im: Image.Image) -> Image.Image:
    bb = im.getbbox() or (0, 0, im.size[0], im.size[1])
    # head is the top ~45% of the opaque box
    x0, y0, x1, y1 = bb
    y1 = y0 + max(80, int((y1 - y0) * 0.48))
    x0 = max(0, x0 - 8)
    x1 = min(im.size[0], x1 + 8)
    crop = im.crop((x0, y0, x1, y1))
    return zoom(crop, 4)


def write_cast_md():
    text = """# Cast · 8 Soul Knight chibi（HD v3, concept crops）

> Native crops from the 16:9 concept sheets · shared 168×272 canvas · no 4px crush.
> Concept sheets are **not** in git.

Laura edits only: 04 black rims, 06 shaved scalp, 07 caramel tips, 08 front part + collar + necklace.

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
    for dest in (PREVIEW, ARTIFACT, REVIEW):
        dest.mkdir(parents=True, exist_ok=True)
        lineup.save(dest / "cast_hd_lineup.png")
        lineup.save(dest / "cast_hd_lineup_v3.png")
        frames_sheet.save(dest / "cast_hd_frames.png")

    # 4× head crops of 04 and 06
    for n, tag in ((4, "04"), (6, "06")):
        fr = all_frames[n - 1]
        for view, key in (("front", "idle_front"), ("back", "idle_back")):
            big = head_x4(fr[key])
            name = f"cast_{tag}_{view}_x4.png"
            for dest in (PREVIEW, ARTIFACT, REVIEW):
                big.save(dest / name)

    write_cast_md()
    print("Done HD cast v3 (native concept crops).")


if __name__ == "__main__":
    main()
