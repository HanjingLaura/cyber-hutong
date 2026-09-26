#!/usr/bin/env python3
"""Automated silhouette QA for every cast frame.

For each 32×40 frame:
  1. Flood-fill transparent pixels from the border. Any transparent pixel
     the fill cannot reach is an enclosed hole (hollow body / bubble).
  2. Find 4-connected opaque components. Any component other than the
     main silhouette fails — including blobs smaller than 4px (stray
     dots, detached earrings). Intended earrings must touch ear/hair so
     they join the main body.

Exit 0 on pass, 1 on fail. Used by generate_cast.py and as a standalone
check: `python3 scripts/qa_cast.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_cast as gc  # noqa: E402


def enclosed_transparent(img: Image.Image) -> list[tuple[int, int]]:
    return gc.enclosed_transparent(img)


def stray_components(img: Image.Image, min_size: int = 4) -> list[list[tuple[int, int]]]:
    """Opaque 4-connected blobs that are not the main body.

    `min_size` is the threshold called out in the review: any separate
    component smaller than 4px is always a failure. Larger separate
    blobs also fail — a character should be one silhouette.
    """
    comps = gc.stray_components(img, min_size=min_size)
    return [c for c in comps if c and (len(c) < min_size or len(c) >= min_size)]


def check_frame(img: Image.Image) -> list[str]:
    notes = []
    holes = enclosed_transparent(img)
    if holes:
        notes.append(f"enclosed holes {holes[:8]}…{len(holes)}")
    stray = stray_components(img)
    if stray:
        notes.append(f"stray blobs {[(len(c), c[:3]) for c in stray[:4]]}")
    return notes


def check_all() -> list[str]:
    notes: list[str] = []
    views = (
        ("front", 0), ("front", 1), ("back", 0), ("side", 0), ("side", 1),
        ("sit_front", 0), ("sit_back", 0), ("walk", 0), ("walk", 1),
    )
    for spec in gc.CAST:
        for view, frame in views:
            img = gc.draw_cast(spec, view, frame)
            for n in check_frame(img):
                notes.append(f"{spec['id']} {view}:{frame}: {n}")
    return notes


def main() -> int:
    notes = check_all()
    if notes:
        print("QA FAIL:")
        for n in notes:
            print(" ", n)
        return 1
    print("QA PASS: no enclosed transparent pixels, no stray components.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
