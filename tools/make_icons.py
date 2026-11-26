"""Cut the JethaVerse logo (the pink shirt in a navy circle) out of its picture and make every icon the app needs.

Run from the project folder, only when the logo changes:
    python tools/make_icons.py path/to/logo.png          (the first time; the picture is kept as assets/icons/logo-source.png)
    python tools/make_icons.py                           (again, from the kept picture)

Writes assets/icons/ (committed, so the website build only copies them):
  logo.png               1024 px, the circle alone on a see-through background
  icon-192.png, icon-512.png            "any" icons: the circle, see-through corners
  maskable-192.png, maskable-512.png    the circle on a full navy square, small enough for Android to crop to any shape
  apple-touch-icon.png   180 px, navy square (iPhone home screen; iOS rounds the corners itself)
  favicon.png            64 px, the circle (also packed into index.html as the browser-tab icon, see tools/make_icons.py output)
  favicon.b64            the same favicon as base64 text, for index.html
"""
import base64, io, os, shutil, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "icons")
SOURCE = os.path.join(OUT, "logo-source.png")
os.makedirs(OUT, exist_ok=True)

if len(sys.argv) > 1:
    shutil.copyfile(sys.argv[1], SOURCE)
if not os.path.exists(SOURCE):
    sys.exit("give the logo picture:  python tools/make_icons.py path/to/logo.png")

im = Image.open(SOURCE).convert("RGB")
w, h = im.size
px = im.load()

# the circle = the navy pixels (the picture has a white background and a soft shadow underneath)
xs, ys = [], []
for y in range(0, h, 2):
    for x in range(0, w, 2):
        r, g, b = px[x, y]
        if r < 40 and g < 70 and b < 130 and b > g:
            xs.append(x)
            ys.append(y)
x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
cx, cy, rad = (x0 + x1) / 2.0, (y0 + y1) / 2.0, min(x1 - x0, y1 - y0) / 2.0
NAVY = px[int(cx - rad * 0.9), int(cy)]          # the ring's own colour, used behind the maskable icons
print("circle: centre (%.0f, %.0f), radius %.0f, navy %s" % (cx, cy, rad, NAVY))

SS = 4  # draw the mask 4x bigger and shrink it, for a smooth edge
inset = 3  # px of the picture: drop the thin anti-aliased fringe of the old white background
R = rad - inset
big = 1024 * SS
mask = Image.new("L", (big, big), 0)
ImageDraw.Draw(mask).ellipse([0, 0, big - 1, big - 1], fill=255)
mask = mask.resize((1024, 1024), Image.LANCZOS)
crop = im.crop((int(round(cx - R)), int(round(cy - R)), int(round(cx + R)), int(round(cy + R)))).resize((1024, 1024), Image.LANCZOS)
logo = crop.convert("RGBA")
logo.putalpha(mask)
logo.save(os.path.join(OUT, "logo.png"), optimize=True)


def circle(size):
    return logo.resize((size, size), Image.LANCZOS)


def on_navy(size, fraction):
    canvas = Image.new("RGBA", (size, size), NAVY + (255,))
    d = int(round(size * fraction))
    c = circle(d)
    canvas.alpha_composite(c, ((size - d) // 2, (size - d) // 2))
    return canvas.convert("RGB")


circle(192).save(os.path.join(OUT, "icon-192.png"), optimize=True)
circle(512).save(os.path.join(OUT, "icon-512.png"), optimize=True)
on_navy(192, 0.78).save(os.path.join(OUT, "maskable-192.png"), optimize=True)   # 0.78 < 0.80: the whole circle stays inside the safe zone
on_navy(512, 0.78).save(os.path.join(OUT, "maskable-512.png"), optimize=True)
on_navy(180, 0.90).save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)
fav = circle(64)
fav.save(os.path.join(OUT, "favicon.png"), optimize=True)
small = fav.convert("RGBA").quantize(colors=48, method=Image.FASTOCTREE)  # a palette keeps the tab icon to a few KB inside index.html
buf = io.BytesIO()
small.save(buf, "PNG", optimize=True)
with open(os.path.join(OUT, "favicon.b64"), "w") as f:
    f.write(base64.b64encode(buf.getvalue()).decode())
for name in sorted(os.listdir(OUT)):
    print("  %-22s %6.1f KB" % (name, os.path.getsize(os.path.join(OUT, name)) / 1024.0))
