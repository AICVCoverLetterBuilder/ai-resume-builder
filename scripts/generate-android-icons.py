#!/usr/bin/env python3
"""Generate proper Android adaptive icon assets for CV Pro AI.

Source: public/android/adaptive-icon-foreground.png (1024x1024)
- Has blue background (RGB ~13, 49, 132) and white logo elements
- We extract only the white elements for the foreground (replace blue with transparent)
- Background will be a solid blue matching the logo

Output mipmap directories:
  mipmap-mdpi/    48x48 (launcher), 108x108 (foreground)
  mipmap-hdpi/    72x72, 162x162
  mipmap-xhdpi/   96x96, 216x216
  mipmap-xxhdpi/  144x144, 324x324
  mipmap-xxxhdpi/ 192x192, 432x432
"""

import os
from PIL import Image
import shutil

PROJECT_DIR = "/home/user/computer/ai-cv-cover-letter-builder"
MIPMAP_DIR = os.path.join(PROJECT_DIR, "android/app/src/main/res")
SOURCE_FG = os.path.join(PROJECT_DIR, "public/android/adaptive-icon-foreground.png")

# Density targets: (launcher_size, foreground_size)
DENSITY_TARGETS = {
    "mipmap-mdpi":    (48, 108),
    "mipmap-hdpi":    (72, 162),
    "mipmap-xhdpi":   (96, 216),
    "mipmap-xxhdpi":  (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}


def extract_foreground(img):
    """Extract white logo elements by replacing everything non-white with transparency.

    Uses a luminance-based threshold:
    - White logo has RGB ~255 → luminance ~255
    - Blue background has RGB ~13,50,131 → luminance ~54
    - Anti-aliased edges have intermediate values
    """
    img = img.convert("RGBA")
    pixels = img.load()

    LUMINANCE_THRESHOLD = 200

    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue  # Already transparent

            luminance = 0.299 * r + 0.587 * g + 0.114 * b

            if luminance >= LUMINANCE_THRESHOLD:
                # This is a white logo element - keep it fully opaque white
                alpha_factor = min(1.0, (luminance - LUMINANCE_THRESHOLD) / 55.0)
                pixels[x, y] = (
                    255, 255, 255,
                    int(255 * alpha_factor)
                )
            else:
                # Blue background or edge - make transparent
                pixels[x, y] = (0, 0, 0, 0)

    return img


def make_background_color():
    """Create the background color vector drawable matching the logo blue."""
    bg_xml = '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportHeight="108"
    android:viewportWidth="108">
    <path
        android:fillColor="#0D3184"
        android:pathData="M0,0h108v108h-108z" />
</vector>
'''
    res_drawable = os.path.join(MIPMAP_DIR, "drawable")
    os.makedirs(res_drawable, exist_ok=True)
    path = os.path.join(res_drawable, "ic_launcher_background.xml")
    with open(path, "w") as f:
        f.write(bg_xml)
    print(f"✓ Created {path}")
    return path


def make_foreground_drawable():
    """Create a foreground vector that references the mipmap PNG."""
    # For adaptive icons on API 26+, we use mipmap PNGs.
    # This placeholder is not actually used (mipmap-anydpi-v26 uses @mipmap/ic_launcher_foreground)
    # But we keep the drawable-v24 dir consistent.
    pass


def regenerate_mipmaps():
    """Regenerate all mipmap PNGs from the source image."""
    print("\n=== Regenerating mipmap icon assets ===")

    source = Image.open(SOURCE_FG).convert("RGBA")
    foreground = extract_foreground(source)

    for density, (launcher_size, fg_size) in DENSITY_TARGETS.items():
        density_dir = os.path.join(MIPMAP_DIR, density)
        os.makedirs(density_dir, exist_ok=True)

        # Clean old files
        for old_file in ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]:
            old_path = os.path.join(density_dir, old_file)
            if os.path.exists(old_path):
                os.remove(old_path)

        # Scale foreground (extracted white logo) to foreground size
        fg_resized = foreground.resize((fg_size, fg_size), Image.LANCZOS)
        fg_path = os.path.join(density_dir, "ic_launcher_foreground.png")
        fg_resized.save(fg_path)
        print(f"  ✓ Created {density}/ic_launcher_foreground.png ({fg_size}x{fg_size})")

        # For the launcher icon (non-adaptive), compose background + foreground
        # Background: solid blue (#0D3184)
        bg = Image.new("RGBA", (launcher_size, launcher_size), (13, 49, 132, 255))

        # Scale foreground to launcher size, paste onto background
        # The launcher foreground should be centered and slightly smaller
        # (Android ic_launcher.png is the full icon = solid bg + logo)
        # We compose the extracted white logo over the blue background
        fg_for_launcher = foreground.resize((launcher_size, launcher_size), Image.LANCZOS)
        composed = bg.copy()
        composed.paste(fg_for_launcher, (0, 0), fg_for_launcher)

        launcher_path = os.path.join(density_dir, "ic_launcher.png")
        composed.save(launcher_path)
        print(f"  ✓ Created {density}/ic_launcher.png ({launcher_size}x{launcher_size})")

        round_path = os.path.join(density_dir, "ic_launcher_round.png")
        composed.save(round_path)
        print(f"  ✓ Created {density}/ic_launcher_round.png ({launcher_size}x{launcher_size})")


def update_anydpi_xml():
    """Update the mipmap-anydpi-v26 XML files to reference proper drawables."""
    xml_content = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''

    v26_dir = os.path.join(MIPMAP_DIR, "mipmap-anydpi-v26")
    os.makedirs(v26_dir, exist_ok=True)

    for name in ["ic_launcher.xml", "ic_launcher_round.xml"]:
        path = os.path.join(v26_dir, name)
        with open(path, "w") as f:
            f.write(xml_content)
        print(f"✓ Updated {path}")


def update_values_background_color():
    """Set the ic_launcher_background color to match the logo blue."""
    values_dir = os.path.join(MIPMAP_DIR, "values")
    os.makedirs(values_dir, exist_ok=True)

    xml_content = '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0D3184</color>
</resources>
'''
    path = os.path.join(values_dir, "ic_launcher_background.xml")
    with open(path, "w") as f:
        f.write(xml_content)
    print(f"✓ Updated {path}")


def remove_old_grid_background():
    """Remove the old grid-pattern background drawable."""
    old_path = os.path.join(MIPMAP_DIR, "drawable/ic_launcher_background.xml")
    if os.path.exists(old_path):
        old_content = open(old_path).read()
        # We're overwriting it anyway in make_background_color()
        print(f"  Note: {old_path} will be replaced with solid color")


def update_drawable_v24():
    """Update or remove the old foreground drawable."""
    old_path = os.path.join(MIPMAP_DIR, "drawable-v24/ic_launcher_foreground.xml")
    if os.path.exists(old_path):
        os.remove(old_path)
        print(f"✓ Removed {old_path} (no longer needed, using PNG foreground)")


def main():
    print("=" * 60)
    print("CV Pro AI - Android Icon Asset Generator")
    print("=" * 60)

    # 1. Remove old grid background
    remove_old_grid_background()

    # 2. Create new background drawable (solid blue)
    make_background_color()

    # 3. Update background color resource
    update_values_background_color()

    # 4. Regenerate all mipmap PNGs
    regenerate_mipmaps()

    # 5. Update anydpi-v26 XMLs
    update_anydpi_xml()

    # 6. Clean up old vector foreground
    update_drawable_v24()

    print("\n" + "=" * 60)
    print("Icon assets generated successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()