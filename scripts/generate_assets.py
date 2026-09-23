#!/usr/bin/env python3
"""赛博胡同 refined-pixel pipeline.

Generates shared tiles / props / UI, then the 8-person cast (A/B/C
variants + photo map) and the 11 Laura-named scenes.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pxlib import (  # noqa: E402
    ASSETS,
    INK,
    PAL,
    ROOT,
    WHITE,
    box1,
    hline,
    new,
    rect,
    save,
    vline,
)
import generate_cast  # noqa: E402
import generate_rooms as rooms  # noqa: E402


def tile_hutong_floor():
    t = new(32, 32, rooms.HT["floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 16):
        for x in range(0, 32, 16):
            c = rooms.HT["floor"] if ((x + y) // 16) % 2 == 0 else rooms.HT["floor2"]
            rect(d, [x, y, min(x + 15, 31), min(y + 15, 31)], c)
            hline(d, x, min(x + 15, 31), y, rooms.HT["gap"])
            vline(d, x, y, min(y + 15, 31), rooms.HT["gap"])
    return t


def tile_elevator_stone():
    t = new(32, 32, rooms.EL["stone"])
    d = ImageDraw.Draw(t)
    hline(d, 0, 31, 0, rooms.EL["grout"])
    hline(d, 0, 31, 16, rooms.EL["grout"])
    vline(d, 0, 0, 31, rooms.EL["grout"])
    vline(d, 16, 0, 15, rooms.EL["grout"])
    vline(d, 8, 16, 31, rooms.EL["grout"])
    return t


def tile_hawaii_wood():
    t = new(32, 32, rooms.HW["floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 8):
        base = rooms.HW["floor"] if (y // 8) % 2 == 0 else rooms.HW["floor2"]
        rect(d, [0, y, 31, y + 7], base)
        hline(d, 0, 31, y + 7, rooms.HW["gap"])
    return t


def tile_popmart():
    t = new(32, 32, rooms.PM["a"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 15, 15], rooms.PM["a"])
    rect(d, [16, 16, 31, 31], rooms.PM["a"])
    rect(d, [16, 0, 31, 15], rooms.PM["b"])
    rect(d, [0, 16, 15, 31], rooms.PM["b"])
    return t


def tile_restroom():
    t = new(32, 32, rooms.RR["floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 10):
        for x in range(0, 32, 10):
            c = rooms.RR["porc"] if ((x + y) // 10) % 2 == 0 else rooms.RR["floor"]
            rect(d, [x, y, min(x + 9, 31), min(y + 9, 31)], c)
            hline(d, x, min(x + 9, 31), y, rooms.RR["grout"])
    return t


def tile_office():
    t = new(32, 32, rooms.OF["floor"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 15, 15], rooms.OF["floor"])
    rect(d, [16, 16, 31, 31], rooms.OF["floor"])
    rect(d, [16, 0, 31, 15], rooms.OF["floor2"])
    rect(d, [0, 16, 15, 31], rooms.OF["floor2"])
    return t


def tile_meeting():
    t = new(32, 32, rooms.MT["floor"])
    d = ImageDraw.Draw(t)
    rect(d, [1, 1, 30, 30], rooms.MT["floor2"])
    hline(d, 0, 31, 0, rooms.MT["holo"])
    vline(d, 0, 0, 31, rooms.MT["holo"])
    return t


def tile_concert():
    t = new(32, 32, rooms.CN["floor"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 31, 31], rooms.CN["floor"])
    rect(d, [4, 4, 27, 27], rooms.CN["floor2"])
    return t


def tile_cafe():
    t = new(32, 32, rooms.CF["floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 8):
        base = rooms.CF["floor"] if (y // 8) % 2 == 0 else rooms.CF["floor2"]
        rect(d, [0, y, 31, y + 7], base)
        hline(d, 0, 31, y + 7, rooms.CF["gap"])
    return t


def tile_gym():
    t = new(32, 32, rooms.GY["floor"])
    d = ImageDraw.Draw(t)
    rect(d, [0, 0, 31, 31], rooms.GY["floor"])
    hline(d, 0, 31, 16, rooms.GY["floor2"])
    vline(d, 16, 0, 31, rooms.GY["floor2"])
    return t


def tile_mixian():
    t = new(32, 32, rooms.MX["floor"])
    d = ImageDraw.Draw(t)
    for y in range(0, 32, 8):
        base = rooms.MX["floor"] if (y // 8) % 2 == 0 else rooms.MX["floor2"]
        rect(d, [0, y, 31, y + 7], base)
        hline(d, 0, 31, y + 7, rooms.MX["wood_e"])
    return t


def gen_tileset():
    labels = [
        ("hutong", tile_hutong_floor()),
        ("elevator", tile_elevator_stone()),
        ("hawaii", tile_hawaii_wood()),
        ("popmart", tile_popmart()),
        ("restroom", tile_restroom()),
        ("office", tile_office()),
        ("meeting", tile_meeting()),
        ("concert", tile_concert()),
        ("cafe", tile_cafe()),
        ("gym", tile_gym()),
        ("mixian", tile_mixian()),
    ]
    strip = new(32 * len(labels), 32)
    for i, (name, t) in enumerate(labels):
        strip.paste(t, (i * 32, 0), t)
        save(t, ASSETS / "tiles" / f"tile_{name}.png")
    save(strip, ASSETS / "tiles" / "tileset_32.png")


def gen_props():
    mapping = {
        "cup.png": rooms.prop_cup(),
        "notebook.png": rooms.prop_notebook(),
        "laptop.png": rooms.prop_laptop(),
        "blind_box.png": rooms.prop_blindbox(),
        "plant.png": rooms.prop_plant(),
        "chair.png": rooms.chair_back(),
        "chair_jacket.png": rooms.chair_back(jacket=True),
    }
    desk = new(32, 16)
    d = ImageDraw.Draw(desk)
    from pxlib import prism, empty_pad
    prism(d, 1, 2, 28, 6, 5, rooms.HT["desk"], rooms.HT["desk_e"])
    empty_pad(d, 8, 3, 16, 4, rooms.HT["pad"], rooms.HT["desk_e"])
    mapping["desk.png"] = desk
    for name, img in mapping.items():
        save(img, ASSETS / "props" / name)


def gen_dialog():
    img = new(256, 48)
    d = ImageDraw.Draw(img)
    box1(d, 0, 0, 255, 47, (22, 24, 34, 255), (255, 120, 160, 255))
    rect(d, [3, 3, 252, 44], (16, 18, 28, 255))
    hline(d, 10, 80, 8, (90, 220, 210, 255))
    save(img, ASSETS / "ui" / "dialog_frame.png")


def main():
    print("Generating cyber-hutong refined-pixel assets…")
    gen_tileset()
    gen_props()
    gen_dialog()
    generate_cast.main()
    rooms.main()
    print("Done.")


if __name__ == "__main__":
    main()
