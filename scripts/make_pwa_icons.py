#!/usr/bin/env python3
"""Draws the PWA icons in assets/icons.

Run it after changing the icon design:

    python3 scripts/make_pwa_icons.py

It writes PNGs with the standard library alone, so there is no image dependency to
install. Shapes are rendered at 4x and box-filtered down, which is what keeps the
disc and the arc from looking ragged at 192px.
"""

import math
import pathlib
import struct
import zlib

SS = 4  # supersampling factor

GROUND = (0x15, 0x10, 0x0E)
RUST = (0xCB, 0x5B, 0x2E)
RUST_DARK = (0x8E, 0x3C, 0x1C)
OCHRE = (0xE5, 0xA9, 0x3A)

OUT_DIR = pathlib.Path('assets/icons')


def write_png(path, size, rows):
    """Writes `rows` (a list of rows of (r, g, b) tuples) as an 8-bit RGB PNG."""
    raw = bytearray()
    for row in rows:
        raw.append(0)  # filter type: none
        for r, g, b in row:
            raw += bytes((r, g, b))

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    header = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n' +
           chunk(b'IHDR', header) +
           chunk(b'IDAT', zlib.compress(bytes(raw), 9)) +
           chunk(b'IEND', b''))
    path.write_bytes(png)


def render(size, inset):
    """Renders one icon.

    `inset` is the fraction of the canvas left empty around the art, so a maskable
    icon can keep its content inside the safe area a launcher may crop to.
    """
    big = size * SS
    centre = big / 2.0
    art = big * (1.0 - 2.0 * inset)

    disc_r = art * 0.30
    ring_r = art * 0.43
    ring_w = art * 0.055

    # The printed global-parameter tracks curve up the left side of the board, so the
    # arc runs from roughly seven o'clock to eleven o'clock.
    arc_from, arc_to = math.radians(125), math.radians(255)

    pixels = []
    for y in range(big):
        row = []
        dy = y + 0.5 - centre
        for x in range(big):
            dx = x + 0.5 - centre
            distance = math.hypot(dx, dy)
            colour = GROUND
            if distance <= disc_r:
                # A darker limb on the lower right reads as a lit sphere.
                shade = (dx + dy) / (disc_r * 2.4)
                colour = mix(RUST, RUST_DARK, clamp(shade * 0.85 + 0.15))
            elif abs(distance - ring_r) <= ring_w / 2:
                angle = math.atan2(dy, dx) % (2 * math.pi)
                if arc_from <= angle <= arc_to:
                    colour = OCHRE
            row.append(colour)
        pixels.append(row)

    return downsample(pixels, size)


def clamp(value):
    return max(0.0, min(1.0, value))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def downsample(pixels, size):
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            r = g = b = 0
            for sy in range(SS):
                for sx in range(SS):
                    pr, pg, pb = pixels[y * SS + sy][x * SS + sx]
                    r += pr
                    g += pg
                    b += pb
            count = SS * SS
            row.append((r // count, g // count, b // count))
        rows.append(row)
    return rows


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, size, inset in [
        ('icon-192.png', 192, 0.06),
        ('icon-512.png', 512, 0.06),
        ('icon-maskable-512.png', 512, 0.20),
        ('apple-touch-icon.png', 180, 0.06),
    ]:
        write_png(OUT_DIR / name, size, render(size, inset))
        print('wrote', OUT_DIR / name)


if __name__ == '__main__':
    main()
