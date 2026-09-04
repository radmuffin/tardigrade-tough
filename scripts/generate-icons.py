#!/usr/bin/env python3
"""
Generate PWA icons (PNG and SVG) for Tardigrade Tough without external dependencies.
Produces:
  - static/icon.svg
  - static/icon-192.png
  - static/icon-512.png
  - static/icon-maskable-512.png
  - static/icon-32.png
"""

import math
import os
import struct
import zlib

def encode_png(width, height, rgba_buffer):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    raw = bytearray()
    row_bytes = width * 4
    for y in range(height):
        raw.append(0)  # Filter byte None
        start = y * row_bytes
        raw.extend(rgba_buffer[start : start + row_bytes])

    idat = zlib.compress(bytes(raw), 9)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat)
        + chunk(b"IEND", b"")
    )

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip("#")
    return tuple(int(hex_str[i : i + 2], 16) for i in (0, 2, 4))

class Canvas:
    def __init__(self, width, height, bg_color):
        self.width = width
        self.height = height
        self.bg = bg_color
        r, g, b = hex_to_rgb(bg_color)
        pixel = bytes([r, g, b, 255])
        self.buffer = bytearray(pixel * (width * height))

    def set_pixel(self, x, y, r, g, b, a=255):
        if 0 <= x < self.width and 0 <= y < self.height:
            idx = (y * self.width + x) * 4
            if a == 255:
                self.buffer[idx] = r
                self.buffer[idx + 1] = g
                self.buffer[idx + 2] = b
                self.buffer[idx + 3] = a
            else:
                alpha = a / 255.0
                inv_alpha = 1.0 - alpha
                self.buffer[idx] = int(r * alpha + self.buffer[idx] * inv_alpha)
                self.buffer[idx + 1] = int(g * alpha + self.buffer[idx + 1] * inv_alpha)
                self.buffer[idx + 2] = int(b * alpha + self.buffer[idx + 2] * inv_alpha)
                self.buffer[idx + 3] = 255

    def fill_rect(self, x0, y0, w, h, color, rx=0):
        r, g, b = hex_to_rgb(color)
        x1 = x0 + w
        y1 = y0 + h
        for y in range(int(y0), int(math.ceil(y1))):
            for x in range(int(x0), int(math.ceil(x1))):
                if rx > 0:
                    cx = None
                    cy = None
                    if x < x0 + rx and y < y0 + rx:
                        cx, cy = x0 + rx, y0 + rx
                    elif x >= x1 - rx and y < y0 + rx:
                        cx, cy = x1 - rx, y0 + rx
                    elif x < x0 + rx and y >= y1 - rx:
                        cx, cy = x0 + rx, y1 - rx
                    elif x >= x1 - rx and y >= y1 - rx:
                        cx, cy = x1 - rx, y1 - rx
                    if cx is not None and cy is not None:
                        dist = math.hypot(x - cx, y - cy)
                        if dist > rx:
                            continue
                self.set_pixel(x, y, r, g, b)

    def fill_circle(self, cx, cy, radius, color):
        r, g, b = hex_to_rgb(color)
        r_ceil = int(math.ceil(radius))
        for dy in range(-r_ceil, r_ceil + 1):
            for dx in range(-r_ceil, r_ceil + 1):
                dist = math.hypot(dx, dy)
                if dist <= radius:
                    self.set_pixel(int(cx + dx), int(cy + dy), r, g, b)

def render_icon(size, padding_ratio=0.15):
    canvas = Canvas(size, size, "#0b1120")

    avail_size = size * (1.0 - 2 * padding_ratio)
    scale = min(avail_size / 32.0, avail_size / 24.0)
    draw_w = 32.0 * scale
    draw_h = 24.0 * scale
    ox = (size - draw_w) / 2.0
    oy = (size - draw_h) / 2.0

    def gx(x): return ox + x * scale
    def gy(y): return oy + y * scale
    def gw(w): return w * scale
    def gh(h): return h * scale

    # Main Body: rect x=2, y=5, w=22, h=14, rx=4
    canvas.fill_rect(gx(2), gy(5), gw(22), gh(14), "#10b981", rx=gw(4))

    # Segment bands
    canvas.fill_rect(gx(7), gy(5), gw(2.5), gh(14), "#059669")
    canvas.fill_rect(gx(13), gy(5), gw(2.5), gh(14), "#059669")
    canvas.fill_rect(gx(19), gy(5), gw(2.5), gh(14), "#059669")

    # Snout / Head
    canvas.fill_rect(gx(22), gy(8), gw(7), gh(8), "#34d399", rx=gw(2))

    # Eyes
    canvas.fill_circle(gx(28), gy(12), gw(1.5), "#064e3b")
    canvas.fill_circle(gx(24), gy(9), gw(1.0), "#0f172a")

    # Legs & Claws
    legs = [4, 10, 16, 22]
    for leg_x in legs:
        canvas.fill_rect(gx(leg_x), gy(18), gw(3), gh(4), "#059669")
        canvas.fill_rect(gx(leg_x - 1), gy(21), gw(1.5), gh(2), "#f59e0b")
        canvas.fill_rect(gx(leg_x + 1.5), gy(21), gw(1.5), gh(2), "#f59e0b")

    return encode_png(size, size, canvas.buffer)

def main():
    target_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
    os.makedirs(target_dir, exist_ok=True)

    # 1. Generate icon.svg
    svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="100" fill="#0B1120"/>
  <g transform="translate(48, 80) scale(13)">
    <rect x="2" y="5" width="22" height="14" rx="4" fill="#10B981"/>
    <rect x="7" y="5" width="2.5" height="14" fill="#059669"/>
    <rect x="13" y="5" width="2.5" height="14" fill="#059669"/>
    <rect x="19" y="5" width="2.5" height="14" fill="#059669"/>
    <rect x="22" y="8" width="7" height="8" rx="2" fill="#34D399"/>
    <circle cx="28" cy="12" r="1.5" fill="#064E3B"/>
    <circle cx="24" cy="9" r="1" fill="#0F172A"/>
    <rect x="4" y="18" width="3" height="4" fill="#059669"/>
    <rect x="3" y="21" width="1.5" height="2" fill="#F59E0B"/>
    <rect x="5.5" y="21" width="1.5" height="2" fill="#F59E0B"/>
    <rect x="10" y="18" width="3" height="4" fill="#059669"/>
    <rect x="9" y="21" width="1.5" height="2" fill="#F59E0B"/>
    <rect x="11.5" y="21" width="1.5" height="2" fill="#F59E0B"/>
    <rect x="16" y="18" width="3" height="4" fill="#059669"/>
    <rect x="15" y="21" width="1.5" height="2" fill="#F59E0B"/>
    <rect x="17.5" y="21" width="1.5" height="2" fill="#F59E0B"/>
    <rect x="22" y="18" width="3" height="4" fill="#059669"/>
    <rect x="21" y="21" width="1.5" height="2" fill="#F59E0B"/>
    <rect x="23.5" y="21" width="1.5" height="2" fill="#F59E0B"/>
  </g>
</svg>
'''
    with open(os.path.join(target_dir, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(svg_content)
    print("Created static/icon.svg")

    # 2. icon-192.png
    png_192 = render_icon(192, padding_ratio=0.15)
    with open(os.path.join(target_dir, "icon-192.png"), "wb") as f:
        f.write(png_192)
    print("Created static/icon-192.png")

    # 3. icon-512.png
    png_512 = render_icon(512, padding_ratio=0.15)
    with open(os.path.join(target_dir, "icon-512.png"), "wb") as f:
        f.write(png_512)
    print("Created static/icon-512.png")

    # 4. icon-maskable-512.png
    png_maskable = render_icon(512, padding_ratio=0.22)
    with open(os.path.join(target_dir, "icon-maskable-512.png"), "wb") as f:
        f.write(png_maskable)
    print("Created static/icon-maskable-512.png")

    # 5. icon-32.png
    png_32 = render_icon(32, padding_ratio=0.1)
    with open(os.path.join(target_dir, "icon-32.png"), "wb") as f:
        f.write(png_32)
    print("Created static/icon-32.png")

if __name__ == "__main__":
    main()
