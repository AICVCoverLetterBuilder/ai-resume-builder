#!/usr/bin/env python3
"""
Generate Android launcher icons from the master icon image.

Master: 1024x1024 RGB image with:
  - White outer margin area
  - Dark-blue rounded-square background (#032F86)
  - White document artwork (CV document, person, "CV" text, lines, sparkle, "AI" badge)

Safe-zone scaling:
  to ~64% of the canvas and centered. This leaves ~184px transparent padding on
  every side at 1024px canvas. Under ANY launcher mask, the complete blue
  rounded-square, the document, and the AI badge are fully visible with balanced
  spacing. The mask clips only transparent areas, never the icon content.

  Reason: Android launcher masks (especially circle/teardrop) clip the corners
  of a full-canvas icon. By shrinking the icon inward, the mask opening is
  always larger than the visible content.

Outputs:
  - adaptive-icon-background.png: scaled-down blue square, centered, on
    transparent canvas (so masks clip transparent space, not the blue)
  - adaptive-icon-foreground.png: scaled-down design elements, centered, on
    transparent canvas (same size/position as background for perfect overlay)
  - app-icon.png / playstore-icon.png / mipmap ic_launcher*.png: scaled
    composited (blue bg + artwork) and centered
"""

import os
from PIL import Image, ImageDraw, ImageFilter
from collections import Counter

SOURCE = "public/assets/cv-pro-ai-icon-master.png"
RES_BASE = "android/app/src/main/res"

SIZES = {
    "mipmap-mdpi":   108,
    "mipmap-hdpi":   162,
    "mipmap-xhdpi":  216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

# Scale factor — reduces the full icon to 64% of canvas size
# The blue square is ~870px at full canvas; at 64% it is ~655px,
# which fits comfortably inside ALL launcher masks including Circle and Teardrop
ICON_SCALE = 0.64

NAVY_DISTANCE = 35
DESIGN_DIST = 60


def find_dominant_blue(img):
    pixels = img.load()
    w, h = img.size
    blues = []
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            if r < 30 and g < 80 and b > 100:
                blues.append((r, g, b))
    if not blues:
        return (3, 47, 134)
    counter = Counter(blues)
    return counter.most_common(1)[0][0]


def distance_to_bg(r, g, b, bg_r, bg_g, bg_b):
    return max(abs(r - bg_r), abs(g - bg_g), abs(b - bg_b))


def create_icon_region_mask(img, bg_r, bg_g, bg_b):
    w, h = img.size
    pixels = img.load()
    navy = Image.new("L", (w, h), 0)
    navy_px = navy.load()

    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            if distance_to_bg(r, g, b, bg_r, bg_g, bg_b) <= NAVY_DISTANCE:
                navy_px[x, y] = 255

    bbox = navy.getbbox()
    if bbox is None:
        mask = Image.new("L", (w, h), 255)
        return mask.filter(ImageFilter.GaussianBlur(radius=6))

    x0, y0, x1, y1 = bbox
    margin = 6
    x0 = max(0, x0 - margin)
    y0 = max(0, y0 - margin)
    x1 = min(w, x1 + margin)
    y1 = min(h, y1 + margin)

    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    corner_r = min(x1 - x0, y1 - y0) // 5
    draw.rounded_rectangle((x0, y0, x1, y1), radius=corner_r, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=6))
    return mask


def extract_foreground(img, icon_mask, bg_r, bg_g, bg_b):
    """Extract design elements on transparent bg. Full canvas, no crop."""
    w, h = img.size
    pixels = img.load()
    mask_px = icon_mask.load()

    result = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = result.load()

    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            mask_val = mask_px[x, y]

            if mask_val == 0:
                dst[x, y] = (r, g, b, 0)
            else:
                d = distance_to_bg(r, g, b, bg_r, bg_g, bg_b)
                if d <= NAVY_DISTANCE:
                    dst[x, y] = (r, g, b, 0)
                elif d >= DESIGN_DIST:
                    alpha = int(mask_val)
                    dst[x, y] = (r, g, b, alpha)
                else:
                    base_alpha = int((d - NAVY_DISTANCE) /
                                     (DESIGN_DIST - NAVY_DISTANCE) * 255)
                    alpha = min(255, int(base_alpha * mask_val / 255))
                    dst[x, y] = (r, g, b, alpha)
    return result


def scale_and_center(img, scale, canvas_size=None):
    """Scale image by `scale` and center on a transparent canvas."""
    if canvas_size is None:
        canvas_size = img.size
    w, h = img.size
    new_w = int(w * scale)
    new_h = int(h * scale)
    scaled = img.resize((new_w, new_h), Image.LANCZOS)
    cw, ch = canvas_size
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ox = (cw - new_w) // 2
    oy = (ch - new_h) // 2
    if img.mode == "RGBA":
        canvas.paste(scaled, (ox, oy), scaled)
    else:
        canvas.paste(scaled, (ox, oy))
    return canvas


def clip_to_circle(img):
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, w - 1, h - 1), fill=255)
    if img.mode == "RGBA":
        r_ch, g_ch, b_ch, a_ch = img.split()
        a_data = a_ch.load()
        m_data = mask.load()
        for y in range(h):
            for x in range(w):
                a_data[x, y] = min(a_data[x, y], m_data[x, y])
        return Image.merge("RGBA", (r_ch, g_ch, b_ch, a_ch))
    else:
        result = img.convert("RGBA")
        result.putalpha(mask)
        return result


def main():
    print("Loading source image...")
    source_rgb = Image.open(SOURCE).convert("RGB")
    print(f"  Source: {source_rgb.size}")

    bg_r, bg_g, bg_b = find_dominant_blue(source_rgb)
    print(f"  Detected blue: RGB({bg_r},{bg_g},{bg_b})")

    # Step 1: Extract foreground (artwork only, blue bg → transparent)
    print("Extracting foreground layer...")
    icon_mask = create_icon_region_mask(source_rgb, bg_r, bg_g, bg_b)
    foreground = extract_foreground(source_rgb, icon_mask, bg_r, bg_g, bg_b)

    # Step 2: Create full-size blue background
    blue_bg = Image.new("RGBA", source_rgb.size, (bg_r, bg_g, bg_b, 255))

    # Step 3: Composite full icon (blue bg + artwork) at native resolution
    composited = Image.alpha_composite(blue_bg, foreground)

    # Step 4: Scale the composited icon down and center it on transparent canvas
    # This is the KEY fix: the entire icon (blue + artwork) shrinks inward
    print(f"\nApplying safe-zone scaling: {int(ICON_SCALE*100)}% of canvas")
    scaled_composited = scale_and_center(composited, ICON_SCALE)
    scaled_fg = scale_and_center(foreground, ICON_SCALE)
    scaled_bg = scale_and_center(blue_bg, ICON_SCALE)

    fg_bbox = scaled_fg.getbbox()
    print(f"  Scaled foreground bounds: {fg_bbox}")
    if fg_bbox:
        left, top, right, bottom = fg_bbox
        cw, ch = source_rgb.size
        print(f"  Left pad: {left}px, Top pad: {top}px")
        print(f"  Right pad: {cw - right}px, Bottom pad: {ch - bottom}px")

    # ── Adaptive icon layers ──
    # Background: scaled blue square centered on transparent canvas
    # so the mask clips transparent padding, not the blue square itself
    print("\nGenerating adaptive-icon-background.png...")
    scaled_bg.save("public/android/adaptive-icon-background.png")
    print("  ✓ Saved (scaled blue, centered)")

    # Foreground: scaled design elements on transparent, same position
    print("Generating adaptive-icon-foreground.png...")
    scaled_fg.save("public/android/adaptive-icon-foreground.png")
    print("  ✓ Saved (scaled artwork, centered)")

    # ── Mipmap density variants ──
    print("\nGenerating mipmap images...")
    for mip_dir, size_px in SIZES.items():
        dir_path = os.path.join(RES_BASE, mip_dir)
        os.makedirs(dir_path, exist_ok=True)

        full = scaled_composited.resize((size_px, size_px), Image.LANCZOS)
        full.save(os.path.join(dir_path, "ic_launcher.png"))

        round_full = clip_to_circle(full)
        round_full.save(os.path.join(dir_path, "ic_launcher_round.png"))

        fg_resized = scaled_fg.resize((size_px, size_px), Image.LANCZOS)
        fg_resized.save(os.path.join(dir_path, "ic_launcher_foreground.png"))

        bg_resized = scaled_bg.resize((size_px, size_px), Image.LANCZOS)
        bg_resized.save(os.path.join(dir_path, "ic_launcher_background.png"))

        print(f"  ✓ {mip_dir:20s} ({size_px:3d}x{size_px:3d})")

    # ── Public assets ──
    print("\nGenerating app-icon.png...")
    scaled_composited.save("public/android/app-icon.png")
    print("  ✓ Saved (1024x1024)")

    print("Generating playstore-icon.png...")
    ps = scaled_composited.resize((512, 512), Image.LANCZOS)
    ps.save("public/android/playstore-icon.png")
    print("  ✓ Saved (512x512)")

    print(f"\nDone — icon scaled to {int(ICON_SCALE*100)}% with centered safe padding.")
    print("Complete blue rounded-square visible under all launcher masks.")


if __name__ == "__main__":
    main()
