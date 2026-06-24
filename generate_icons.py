#!/usr/bin/env python3
"""Generate CV Pro AI launcher icon assets from the approved master image.

Important:
- The complete approved icon (blue frame + white CV/AI artwork) is used as
  the adaptive foreground.
- It is centered at 76% of the canvas.
- The adaptive background is solid blue.
- This preserves the full star, CV text, AI badge and blue border on OEM
  launchers such as Honor, Samsung, Xiaomi and Pixel.
"""

from pathlib import Path
from PIL import Image, ImageDraw

SOURCE = Path("public/assets/cv-pro-ai-icon-master.png")
RES_BASE = Path("android/app/src/main/res")
FOREGROUND_SCALE = 0.76
BACKGROUND_BLUE = (2, 48, 145, 255)

SIZES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

def scale_center(image: Image.Image, scale: float) -> Image.Image:
    canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
    size = int(image.width * scale)
    resized = image.resize((size, size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(
        resized,
        ((image.width - size) // 2, (image.height - size) // 2),
    )
    return canvas

def circle_crop(image: Image.Image) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).ellipse(
        (0, 0, image.width - 1, image.height - 1),
        fill=255,
    )
    result = image.copy()
    result.putalpha(mask)
    return result

def main() -> None:
    master = Image.open(SOURCE).convert("RGBA").resize(
        (1024, 1024),
        Image.Resampling.LANCZOS,
    )
    master.save(SOURCE)

    foreground = scale_center(master, FOREGROUND_SCALE)
    background = Image.new("RGBA", (1024, 1024), BACKGROUND_BLUE)
    composite = Image.alpha_composite(background, foreground)

    Path("public/android").mkdir(parents=True, exist_ok=True)
    master.save("public/android/app-icon.png")
    master.resize((512, 512), Image.Resampling.LANCZOS).save(
        "public/android/playstore-icon.png"
    )
    foreground.save("public/android/adaptive-icon-foreground.png")
    background.save("public/android/adaptive-icon-background.png")

    for folder, px in SIZES.items():
        dest = RES_BASE / folder
        dest.mkdir(parents=True, exist_ok=True)

        master.resize((px, px), Image.Resampling.LANCZOS).save(
            dest / "ic_launcher.png"
        )
        circle_crop(
            composite.resize((px, px), Image.Resampling.LANCZOS)
        ).save(dest / "ic_launcher_round.png")
        foreground.resize((px, px), Image.Resampling.LANCZOS).save(
            dest / "ic_launcher_foreground.png"
        )
        background.resize((px, px), Image.Resampling.LANCZOS).save(
            dest / "ic_launcher_background.png"
        )

    print("Generated CV Pro AI icons with full design at 76% adaptive scale.")

if __name__ == "__main__":
    main()
