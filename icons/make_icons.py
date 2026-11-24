"""Generate StudyFlow PWA icons with Pillow (no SVG renderer required).

    pip install Pillow
    python icons/make_icons.py

The source of truth for the isotype is icons/icon.svg; this script draws the
same open-book silhouette at high resolution and downsamples it with LANCZOS.
"""
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SIZES = (180, 192, 512)
SCALE = 4
BG = (13, 13, 13, 255)        # #0D0D0D
AMBER = (224, 169, 109, 255)  # #E0A96D
SPINE = (162, 119, 78, 255)   # amber at ~68% over bg
RULES = (127, 94, 63, 255)    # amber at ~52% over bg


def cubic(p0, p1, p2, p3, steps=18):
    """Sample a cubic Bézier curve."""
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        out.append((
            u**3 * p0[0] + 3 * u*u*t * p1[0] + 3 * u*t*t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u*u*t * p1[1] + 3 * u*t*t * p2[1] + t**3 * p3[1],
        ))
    return out


def page_outline(mirror=False):
    """Open-book left page outline in the 512x512 icon coordinate space."""
    pts = [(64, 120)]
    pts += cubic((64, 120), (64, 97), (82, 79), (104, 79))
    pts += [(224, 79)]
    pts += cubic((224, 79), (241, 79), (256, 93), (256, 111))
    pts += [(256, 400)]
    pts += cubic((256, 400), (256, 381), (241, 368), (224, 368))
    pts += [(104, 368)]
    pts += cubic((104, 368), (82, 368), (64, 350), (64, 328))
    pts += [(64, 120)]
    if mirror:
        pts = [(512 - x, y) for x, y in pts]
    return pts


def draw_icon(size):
    base = 512 * SCALE
    img = Image.new("RGBA", (base, base), BG)
    d = ImageDraw.Draw(img)

    def sc(points):
        return [(round(x * SCALE), round(y * SCALE)) for x, y in points]

    for mirror in (False, True):
        d.line(sc(page_outline(mirror)), fill=AMBER, width=21 * SCALE, joint="curve")
    d.line(sc([(256, 145), (256, 302)]), fill=SPINE, width=18 * SCALE)
    for x0, length in ((126, 78), (126, 62), (308, 78), (308, 62)):
        y = 169 if length == 78 else 226
        d.line(sc([(x0, y), (x0 + length, y)]), fill=RULES, width=17 * SCALE)

    return img.resize((size, size), Image.Resampling.LANCZOS)


def main():
    for size in SIZES:
        target = HERE / f"icon-{size}.png"
        draw_icon(size).save(target, optimize=True)
        print(f"wrote {target.name} ({size}x{size})")


if __name__ == "__main__":
    main()
