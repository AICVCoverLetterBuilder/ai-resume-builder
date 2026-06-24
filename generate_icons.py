#!/usr/bin/env python3
"""Generate the user-approved CV Pro AI icon assets.

The master artwork is used as approved. Only the outside edge-connected
near-white canvas is made transparent for the adaptive foreground.
The artwork is rendered at 90% over a full dark-blue adaptive background,
which keeps the star, CV text and AI badge visible under circle and
squircle launcher masks while minimizing the surrounding blue margin.
"""

from pathlib import Path
from collections import deque
from PIL import Image, ImageDraw
import numpy as np

SOURCE = Path("public/assets/cv-pro-ai-icon-master.png")
RES_BASE = Path("android/app/src/main/res")
BACKGROUND_BLUE = (1, 46, 140, 255)
FOREGROUND_SCALE = 0.90

SIZES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

def remove_edge_white(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    arr = np.array(image)
    h, w = arr.shape[:2]
    white = (arr[:, :, :3] >= 245).all(axis=2) & (arr[:, :, 3] > 0)
    visited = np.zeros((h, w), dtype=bool)
    queue = deque()

    for x in range(w):
        for y in (0, h - 1):
            if white[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if white[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

    arr[visited, 3] = 0
    return Image.fromarray(arr, "RGBA")

def scale_center(image: Image.Image, scale: float) -> Image.Image:
    canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
    new_size = (int(image.width * scale), int(image.height * scale))
    resized = image.resize(new_size, Image.Resampling.LANCZOS)
    canvas.alpha_composite(
        resized,
        ((image.width - new_size[0]) // 2, (image.height - new_size[1]) // 2),
    )
    return canvas

def circular_icon(image: Image.Image) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, image.width - 1, image.height - 1), fill=255)
    result = image.copy()
    result.putalpha(mask)
    return result

def main() -> None:
    master = Image.open(SOURCE).convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
    master.save(SOURCE)

    foreground = scale_center(remove_edge_white(master), FOREGROUND_SCALE)
    background = Image.new("RGBA", (1024, 1024), BACKGROUND_BLUE)
    composited = Image.alpha_composite(background, foreground)

    Path("public/android").mkdir(parents=True, exist_ok=True)
    composited.save("public/android/app-icon.png")
    composited.resize((512, 512), Image.Resampling.LANCZOS).save(
        "public/android/playstore-icon.png"
    )
    background.save("public/android/adaptive-icon-background.png")
    foreground.save("public/android/adaptive-icon-foreground.png")

    for folder, px in SIZES.items():
        dest = RES_BASE / folder
        dest.mkdir(parents=True, exist_ok=True)

        full = composited.resize((px, px), Image.Resampling.LANCZOS)
        full.save(dest / "ic_launcher.png")
        circular_icon(full).save(dest / "ic_launcher_round.png")
        foreground.resize((px, px), Image.Resampling.LANCZOS).save(
            dest / "ic_launcher_foreground.png"
        )
        background.resize((px, px), Image.Resampling.LANCZOS).save(
            dest / "ic_launcher_background.png"
        )

    print("Generated approved CV Pro AI icon: foreground 90%, full blue background.")

if __name__ == "__main__":
    main()
