"""Cut the Jethalal sticker sheets into single transparent WebP stickers.

Usage: python tools/make_stickers.py <sheet1.png> <sheet2.png> <hero.png> <out_dir>
Each sheet is a 3x2 grid of poses on a white background.
"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SHEET1 = ["shy", "welcome", "crying", "sheepish", "proud", "angry"]
SHEET2 = ["explain", "whoa", "thinking", "pointing", "celebrate", "shrug"]
KEY = (255, 0, 255)

def cutout(img, pockets=True):
    """Make the white background transparent (flood-filled from the edges only, so white eyes/towels stay)."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    work = rgb.copy()
    seeds = [(x, 0) for x in range(0, w, 12)] + [(x, h - 1) for x in range(0, w, 12)] + \
            [(0, y) for y in range(0, h, 12)] + [(w - 1, y) for y in range(0, h, 12)]
    for s in seeds:
        if work.getpixel(s) != KEY and min(work.getpixel(s)) > 200:
            ImageDraw.floodfill(work, s, KEY, thresh=60)
    # Second pass: white pockets enclosed by the figure (e.g. between the legs).
    # Small whites (eyes, teeth, hanky) stay; large near-pure-white pockets go.
    probe = Image.new("RGB", (w, h), (0, 255, 0))
    for y in range(0, h, 6 if pockets else h + 1):  # pockets=False: keep large white parts of the figure (cap, dhoti)
        for x in range(0, w, 6):
            px = work.getpixel((x, y))
            if px == KEY or min(px) < 246:
                continue
            test = work.copy()
            ImageDraw.floodfill(test, (x, y), (0, 255, 0), thresh=18)
            mask = ImageChops.difference(test, probe).convert("L").point(lambda v: 255 if v < 4 else 0)
            area = mask.histogram()[255]
            if area > 900:
                ImageDraw.floodfill(work, (x, y), KEY, thresh=18)
            else:
                ImageDraw.floodfill(work, (x, y), (245, 245, 244), thresh=18)  # mark as visited, keep near-white
    key = Image.new("RGB", (w, h), KEY)
    diff = ImageChops.difference(work, key).convert("L")
    alpha = diff.point(lambda v: 255 if v > 8 else 0)
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    return out.crop(bbox) if bbox else out

def save(img, path, max_h):
    if img.height > max_h:
        img = img.resize((round(img.width * max_h / img.height), max_h), Image.LANCZOS)
    img.save(path, "WEBP", quality=80, method=6)
    return img.size

def cells(sheet):
    w, h = sheet.size
    for r in range(2):
        for c in range(3):
            yield sheet.crop((c * w // 3, r * h // 2, (c + 1) * w // 3, (r + 1) * h // 2))

if __name__ == "__main__":
    s1, s2, hero, out = sys.argv[1:5]
    os.makedirs(out, exist_ok=True)
    for path, names in ((s1, SHEET1), (s2, SHEET2)):
        for name, cell in zip(names, cells(Image.open(path))):
            print(name, save(cutout(cell), os.path.join(out, f"{name}.webp"), 420))
    print("hero", save(cutout(Image.open(hero)), os.path.join(out, "hero.webp"), 720))
