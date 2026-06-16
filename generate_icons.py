#!/usr/bin/env python3
"""
Generate Android adaptive launcher icons from the master icon image.
- Extracts foreground layer (design elements on transparent bg)
- Generates round icons (full icon clipped to circle)
- Generates full fallback icons (full source image resized)
- All five mipmap densities: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi

Strategy:
  Source: 1024x1024 RGB image with a white outer border, a navy-blue rounded-
  square icon area, and white/colored design elements on the navy background.

  For the foreground layer mask:
    1. Detect navy-blue pixels (the icon background) — these are distinctly
       colored so they don't overlap with the white border or white design elements.
    2. Morphologically dilate the navy mask to fill in the white design elements
       that sit inside the icon area.
    3. The dilated mask covers the entire icon region but NOT the outer white border.
    4. Within that mask, make navy-blue pixels transparent (background layer
       handles them) and keep design elements opaque.
"""

import os
from PIL import Image, ImageDraw, ImageFilter

SOURCE = "public/assets/cv-pro-ai-icon-master.png"
RES_BASE = "android/app/src/main/res"

# Adaptive icon layer canvas size (108dp) per density
SIZES = {
    "mipmap-mdpi":   108,
    "mipmap-hdpi":   162,
    "mipmap-xhdpi":  216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

# Navy blue background color (#0D3184)
BG_R, BG_G, BG_B = 13, 49, 132

# Thresholds
NAVY_THRESHOLD = 30    # Max channel distance to be considered "navy blue"
DESIGN_THRESHOLD = 70  # Min channel distance to be considered "design element"


def distance_to_bg(r, g, b):
    return max(abs(r - BG_R), abs(g - BG_G), abs(b - BG_B))


def create_icon_area_mask(img):
    """
    Create mask of the icon region.
    The icon is a navy-blue rounded square on a white background.
    We detect navy pixels, compute their bounding box (which encloses the
    entire icon including design elements), then fill that region.
    """
    w, h = img.size
    pixels = img.load()

    # Step 1: Mark navy-blue pixels (the icon background)
    navy = Image.new("L", (w, h), 0)
    navy_px = navy.load()

    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            if distance_to_bg(r, g, b) <= NAVY_THRESHOLD:
                navy_px[x, y] = 255

    # Step 2: Compute bounding box of navy pixels — this covers the full icon
    # area including white design elements inside it.
    bbox = navy.getbbox()
    if bbox is None:
        # Fallback: use whole image
        mask = Image.new("L", (w, h), 255)
        return mask.filter(ImageFilter.GaussianBlur(radius=6))

    x0, y0, x1, y1 = bbox

    # Step 3: Create a filled rounded-rectangle mask from the bounding box.
    # The icon has rounded corners, so we approximate with a slightly inset
    # rounded rectangle.
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    corner_r = min(x1 - x0, y1 - y0) // 5  # approximate corner radius
    draw.rounded_rectangle(bbox, radius=corner_r, fill=255)

    # Step 4: Blur for smooth anti-aliased edges
    mask = mask.filter(ImageFilter.GaussianBlur(radius=8))

    return mask


def extract_foreground(img, icon_mask):
    """
    Build the foreground layer: design elements on transparent background.
    Inside the icon mask: navy pixels → transparent, design → opaque.
    Outside the icon mask: fully transparent.
    """
    w, h = img.size
    pixels = img.load()
    mask_px = icon_mask.load()

    result = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = result.load()

    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            mask_val = mask_px[x, y]  # 0-255

            if mask_val == 0:
                dst[x, y] = (r, g, b, 0)
            else:
                d = distance_to_bg(r, g, b)

                if d <= NAVY_THRESHOLD:
                    # Navy background → transparent
                    alpha = 0
                elif d >= DESIGN_THRESHOLD:
                    # Design element → opaque, modulated by mask edge
                    alpha = int(mask_val)
                else:
                    # Anti-aliased transition
                    base_alpha = int((d - NAVY_THRESHOLD) /
                                     (DESIGN_THRESHOLD - NAVY_THRESHOLD) * 255)
                    alpha = min(255, int(base_alpha * mask_val / 255))

                dst[x, y] = (r, g, b, alpha)

    return result


def clip_to_circle(img):
    """Apply a circular alpha mask."""
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

    print("Creating icon area mask from navy-blue detection + dilation...")
    icon_mask = create_icon_area_mask(source_rgb)

    print("Extracting foreground layer (design elements on transparent bg)...")
    foreground = extract_foreground(source_rgb, icon_mask)

    # Crop bounds from mask
    bbox = icon_mask.getbbox()
    print(f"  Icon crop bounds: {bbox}")

    print("Generating mipmap images...")

    # Build the full composited icon (foreground over navy background) for fallback
    navy_bg = Image.new("RGBA", source_rgb.size, (BG_R, BG_G, BG_B, 255))
    composited = Image.alpha_composite(navy_bg, foreground)

    for mip_dir, size_px in SIZES.items():
        dir_path = os.path.join(RES_BASE, mip_dir)
        os.makedirs(dir_path, exist_ok=True)

        # -- ic_launcher.png: pre-API 26 fallback --
        if bbox:
            full_cropped = composited.crop(bbox)
            full = full_cropped.resize((size_px, size_px), Image.LANCZOS)
        else:
            full = composited.resize((size_px, size_px), Image.LANCZOS)
        full.save(os.path.join(dir_path, "ic_launcher.png"))

        # -- ic_launcher_round.png: circle-clipped fallback --
        round_full = clip_to_circle(full)
        round_full.save(os.path.join(dir_path, "ic_launcher_round.png"))

        # -- ic_launcher_foreground.png: design elements on transparent bg --
        if bbox:
            fg_cropped = foreground.crop(bbox)
            fg_resized = fg_cropped.resize((size_px, size_px), Image.LANCZOS)
        else:
            fg_resized = foreground.resize((size_px, size_px), Image.LANCZOS)
        fg_resized.save(os.path.join(dir_path, "ic_launcher_foreground.png"))

        print(f"  ✓ {mip_dir:20s} ({size_px:3d}x{size_px:3d})")

    print("\nDone — all Android icon files regenerated from master image.")


if __name__ == "__main__":
    main()