#!/usr/bin/env python3
"""Strip a white background from an 8-bit RGB PNG via edge-flood-fill.

Stdlib only. Reads a PNG (color_type=2, bit_depth=8, non-interlaced),
makes every whiteish pixel reachable from the image border transparent,
and writes an 8-bit RGBA PNG (color_type=6).

Usage: python3 scripts/strip_white.py [input_path] [output_path]
Defaults: /tmp/user_attached_0.png  ->  trollyashka.png
"""
import struct
import sys
import zlib
from collections import deque


PNG_SIG = b"\x89PNG\r\n\x1a\n"
WHITE_THRESHOLD = 235  # min(R,G,B) >= this counts as whiteish


def parse_png(data):
    if data[:8] != PNG_SIG:
        raise ValueError("not a PNG (bad signature)")
    i = 8
    ihdr = None
    idat_parts = []
    while i < len(data):
        length = struct.unpack(">I", data[i : i + 4])[0]
        ctype = data[i + 4 : i + 8]
        cdata = data[i + 8 : i + 8 + length]
        # crc = data[i+8+length : i+12+length]  # not validated
        i += 12 + length
        if ctype == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", cdata)
        elif ctype == b"IDAT":
            idat_parts.append(cdata)
        elif ctype == b"IEND":
            break
    if ihdr is None:
        raise ValueError("missing IHDR")
    return ihdr, b"".join(idat_parts)


def paeth(a, b, c):
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def unfilter(raw, width, height, bpp):
    """Reverse PNG row filters; return flat bytearray of width*height*bpp bytes."""
    stride = width * bpp
    out = bytearray(stride * height)
    pos = 0
    prev_row_start = -1  # index in `out` of previous unfiltered row, or -1
    for y in range(height):
        ftype = raw[pos]
        pos += 1
        row_start = y * stride
        if ftype == 0:  # None
            out[row_start : row_start + stride] = raw[pos : pos + stride]
        elif ftype == 1:  # Sub
            for x in range(stride):
                left = out[row_start + x - bpp] if x >= bpp else 0
                out[row_start + x] = (raw[pos + x] + left) & 0xFF
        elif ftype == 2:  # Up
            for x in range(stride):
                up = out[prev_row_start + x] if prev_row_start >= 0 else 0
                out[row_start + x] = (raw[pos + x] + up) & 0xFF
        elif ftype == 3:  # Average
            for x in range(stride):
                left = out[row_start + x - bpp] if x >= bpp else 0
                up = out[prev_row_start + x] if prev_row_start >= 0 else 0
                out[row_start + x] = (raw[pos + x] + ((left + up) >> 1)) & 0xFF
        elif ftype == 4:  # Paeth
            for x in range(stride):
                left = out[row_start + x - bpp] if x >= bpp else 0
                up = out[prev_row_start + x] if prev_row_start >= 0 else 0
                upleft = (
                    out[prev_row_start + x - bpp]
                    if (prev_row_start >= 0 and x >= bpp)
                    else 0
                )
                out[row_start + x] = (raw[pos + x] + paeth(left, up, upleft)) & 0xFF
        else:
            raise ValueError("unknown filter type: %d" % ftype)
        pos += stride
        prev_row_start = row_start
    return out


def write_chunk(out, ctype, data):
    out.append(struct.pack(">I", len(data)))
    out.append(ctype)
    out.append(data)
    crc = zlib.crc32(ctype + data) & 0xFFFFFFFF
    out.append(struct.pack(">I", crc))


def encode_png_rgba(width, height, rgba):
    # Prepend filter byte 0 to each scanline.
    stride = width * 4
    rows = bytearray((stride + 1) * height)
    for y in range(height):
        rows[y * (stride + 1)] = 0
        rows[y * (stride + 1) + 1 : (y + 1) * (stride + 1)] = rgba[
            y * stride : (y + 1) * stride
        ]
    compressed = zlib.compress(bytes(rows), 9)
    out = [PNG_SIG]
    ihdr = struct.pack(
        ">IIBBBBB",
        width,
        height,
        8,   # bit depth
        6,   # color type RGBA
        0,   # compression
        0,   # filter
        0,   # interlace
    )
    write_chunk(out, b"IHDR", ihdr)
    write_chunk(out, b"IDAT", compressed)
    write_chunk(out, b"IEND", b"")
    return b"".join(out)


def main(argv):
    in_path = argv[1] if len(argv) > 1 else "/tmp/user_attached_0.png"
    out_path = argv[2] if len(argv) > 2 else "trollyashka.png"

    with open(in_path, "rb") as f:
        data = f.read()

    ihdr, idat = parse_png(data)
    width, height, bit_depth, color_type, comp, filt, interlace = ihdr
    if bit_depth != 8 or color_type != 2 or interlace != 0:
        raise ValueError(
            "unsupported PNG: bit_depth=%d color_type=%d interlace=%d"
            % (bit_depth, color_type, interlace)
        )

    raw = zlib.decompress(idat)
    pixels = unfilter(raw, width, height, 3)  # flat RGB

    n = width * height
    # whiteish mask
    mask = bytearray(n)
    for i in range(n):
        r = pixels[i * 3]
        g = pixels[i * 3 + 1]
        b = pixels[i * 3 + 2]
        if r >= WHITE_THRESHOLD and g >= WHITE_THRESHOLD and b >= WHITE_THRESHOLD:
            mask[i] = 1

    bg = bytearray(n)
    q = deque()
    # seed: every whiteish border pixel
    for x in range(width):
        top = x
        bot = (height - 1) * width + x
        if mask[top] and not bg[top]:
            bg[top] = 1
            q.append(top)
        if mask[bot] and not bg[bot]:
            bg[bot] = 1
            q.append(bot)
    for y in range(height):
        left = y * width
        right = y * width + (width - 1)
        if mask[left] and not bg[left]:
            bg[left] = 1
            q.append(left)
        if mask[right] and not bg[right]:
            bg[right] = 1
            q.append(right)

    while q:
        idx = q.popleft()
        y, x = divmod(idx, width)
        # 4-connected neighbors
        if x > 0:
            j = idx - 1
            if mask[j] and not bg[j]:
                bg[j] = 1
                q.append(j)
        if x < width - 1:
            j = idx + 1
            if mask[j] and not bg[j]:
                bg[j] = 1
                q.append(j)
        if y > 0:
            j = idx - width
            if mask[j] and not bg[j]:
                bg[j] = 1
                q.append(j)
        if y < height - 1:
            j = idx + width
            if mask[j] and not bg[j]:
                bg[j] = 1
                q.append(j)

    rgba = bytearray(n * 4)
    alpha_pixels = 0
    for i in range(n):
        rgba[i * 4] = pixels[i * 3]
        rgba[i * 4 + 1] = pixels[i * 3 + 1]
        rgba[i * 4 + 2] = pixels[i * 3 + 2]
        if bg[i]:
            rgba[i * 4 + 3] = 0
            alpha_pixels += 1
        else:
            rgba[i * 4 + 3] = 255

    png = encode_png_rgba(width, height, rgba)
    with open(out_path, "wb") as f:
        f.write(png)

    print("OK %d %d alpha_pixels=%d" % (width, height, alpha_pixels))


if __name__ == "__main__":
    main(sys.argv)
