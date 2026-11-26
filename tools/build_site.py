"""Pack the guide as a small website that any static host can serve (GitHub Pages, Netlify, Cloudflare Pages).

Usage (from the tmkoc-episode-guide folder):  python tools/build_site.py
Output: dist/site/  (index.html, css/, js/, data/episodes.js, assets/stickers/, the home-screen icons and manifest)

Unlike the one-file version this keeps the files apart, so a returning visitor's browser re-downloads only what changed.
The manifest and icons let a phone "Add to Home screen" and open it full-screen like an app. `.nojekyll` tells GitHub
Pages to serve the folder as it is.
"""
import json, os, re, shutil
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dist", "site")


def icon(size):
    """The app icon: a lit window of the society (the same drawing as the browser-tab icon)."""
    s = size / 48.0
    img = Image.new("RGB", (size, size), "#22201E")
    d = ImageDraw.Draw(img)
    # the arched window: white pane, yellow arch
    d.rectangle([13 * s, 24 * s, 35 * s, 41 * s], fill="#FFFFFF")
    d.pieslice([13 * s, 10 * s, 35 * s, 32 * s], 180, 360, fill="#FFC928")
    d.rectangle([13 * s, 21 * s, 35 * s, 25 * s], fill="#FFC928")
    return img


shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(os.path.join(OUT, "assets", "stickers"))
for folder in ("css", "js"):
    shutil.copytree(os.path.join(ROOT, folder), os.path.join(OUT, folder))
os.makedirs(os.path.join(OUT, "data"))
shutil.copyfile(os.path.join(ROOT, "data", "episodes.js"), os.path.join(OUT, "data", "episodes.js"))
if os.path.exists(os.path.join(ROOT, "data", "live.json")):  # new episodes and replaced links (tools/sync_new.py, check_links.py)
    shutil.copyfile(os.path.join(ROOT, "data", "live.json"), os.path.join(OUT, "data", "live.json"))
for name in sorted(os.listdir(os.path.join(ROOT, "assets", "stickers"))):
    if name.endswith(".webp") and not name.endswith("_bust.webp"):  # the face crops are not used by the app
        shutil.copyfile(os.path.join(ROOT, "assets", "stickers", name), os.path.join(OUT, "assets", "stickers", name))

icon(192).save(os.path.join(OUT, "icon-192.png"))
icon(512).save(os.path.join(OUT, "icon-512.png"))
icon(180).save(os.path.join(OUT, "apple-touch-icon.png"))
with open(os.path.join(OUT, "manifest.webmanifest"), "w", encoding="utf-8") as f:
    json.dump({
        "name": "JethaVerse", "short_name": "JethaVerse", "description": "An unofficial fan guide to Taarak Mehta Ka Ooltah Chashmah episodes.",
        "start_url": ".", "scope": ".", "display": "standalone", "background_color": "#A8D8F0", "theme_color": "#A8D8F0",
        "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}],
    }, f, indent=2)
open(os.path.join(OUT, ".nojekyll"), "w").close()

with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
    html = f.read()
extra = ('  <link rel="manifest" href="manifest.webmanifest">\n  <link rel="apple-touch-icon" href="apple-touch-icon.png">\n'
         '  <meta name="mobile-web-app-capable" content="yes">\n  <meta name="apple-mobile-web-app-title" content="JethaVerse">\n')
assert '  <link rel="stylesheet" href="css/tokens.css">' in html
html = html.replace('  <link rel="stylesheet" href="css/tokens.css">', extra + '  <link rel="stylesheet" href="css/tokens.css">', 1)
with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

missing = [m for m in re.findall(r'(?:src|href)="((?:css|js|data|assets)/[^"]+)"', html) if not os.path.exists(os.path.join(OUT, m))]
assert not missing, missing
files = sum(len(fs) for _, _, fs in os.walk(OUT))
size = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fs in os.walk(OUT) for fn in fs)
print("wrote dist/site:", files, "files,", round(size / 1024 / 1024, 1), "MB")
