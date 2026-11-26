"""Pack the guide as a website that any static host can serve (GitHub Pages, Netlify, Cloudflare Pages), installable as an app.

Usage (from the tmkoc-episode-guide folder):  python tools/build_site.py
Output: dist/site/  (index.html, css/, js/, data/, assets/stickers/, the app icons, manifest.webmanifest, sw.js)

Unlike the one-file version this keeps the files apart, so a returning visitor's browser re-downloads only what changed.
Installable: the manifest and the icons (assets/icons/, made from the logo by tools/make_icons.py) let a phone offer
"Install app" / "Add to Home screen" and open it full-screen like an app; sw.js (from tools/sw.js) keeps a copy on the phone
so it also opens without a connection. `.nojekyll` tells GitHub Pages to serve the folder as it is.
"""
import hashlib, json, os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dist", "site")
SITE = json.load(open(os.path.join(ROOT, "site.config.json"), encoding="utf-8")) if os.path.exists(os.path.join(ROOT, "site.config.json")) else {}
SITE_URL = SITE.get("siteUrl", "").rstrip("/")  # where the guide lives, for the link-preview tags; "" = leave them out
THEME = "#A8D8F0"                               # the sky at the top of the app: status bar and splash screen match it
TITLE = "JethaVerse · Find any Taarak Mehta episode"
BLURB = "An unofficial fan guide to Taarak Mehta Ka Ooltah Chashmah. Search all episodes by who is in them or what happens."

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

# the app icons (tools/make_icons.py makes them from the logo): same names at the top of the site
ICONS = ["icon-192.png", "icon-512.png", "maskable-192.png", "maskable-512.png", "apple-touch-icon.png"]
for name in ICONS:
    src = os.path.join(ROOT, "assets", "icons", name)
    assert os.path.exists(src), name + " is missing: run  python tools/make_icons.py"
    shutil.copyfile(src, os.path.join(OUT, name))

manifest = {
    "id": "./", "name": "JethaVerse", "short_name": "JethaVerse", "description": BLURB, "lang": "en",
    "start_url": "./", "scope": "./", "display": "standalone", "categories": ["entertainment"],
    "background_color": THEME, "theme_color": THEME,
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
        {"src": "maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}
with open(os.path.join(OUT, "manifest.webmanifest"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
open(os.path.join(OUT, ".nojekyll"), "w").close()

# index.html: the manifest, the icons, the link preview, and the service worker's registration
with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
    html = f.read()
extra = ('  <link rel="manifest" href="manifest.webmanifest">\n  <link rel="apple-touch-icon" href="apple-touch-icon.png">\n'
         '  <meta name="mobile-web-app-capable" content="yes">\n  <meta name="apple-mobile-web-app-capable" content="yes">\n'
         '  <meta name="apple-mobile-web-app-title" content="JethaVerse">\n')
if SITE_URL:  # what WhatsApp and others show when the link is shared
    extra += ('  <meta property="og:type" content="website">\n  <meta property="og:title" content="%s">\n  <meta property="og:description" content="%s">\n'
              '  <meta property="og:url" content="%s/">\n  <meta property="og:image" content="%s/icon-512.png">\n  <meta name="twitter:card" content="summary">\n'
              % (TITLE, BLURB, SITE_URL, SITE_URL))
assert '  <link rel="stylesheet" href="css/tokens.css">' in html
html = html.replace('  <link rel="stylesheet" href="css/tokens.css">', extra + '  <link rel="stylesheet" href="css/tokens.css">', 1)
register = ('  <script>\n  if ("serviceWorker" in navigator) addEventListener("load", function () {\n'
            '    navigator.serviceWorker.register("sw.js").then(function (r) { r.update(); }).catch(function () {});\n  });\n  </script>\n')
assert html.count("</body>") == 1
html = html.replace("</body>", register + "</body>", 1)
with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

missing = [m for m in re.findall(r'(?:src|href)="((?:css|js|data|assets)/[^"]+)"', html) if not os.path.exists(os.path.join(OUT, m))]
assert not missing, missing
for icon in manifest["icons"]:
    assert os.path.exists(os.path.join(OUT, icon["src"])), icon["src"]

# the service worker: every file of the site except itself and the changing list of live updates, and a version that
# changes exactly when any of those files does (so a new deploy of unchanged files does not make phones fetch it all again)
shell = []
for dirpath, _, files in os.walk(OUT):
    for fn in files:
        rel = os.path.relpath(os.path.join(dirpath, fn), OUT).replace(os.sep, "/")
        if rel not in ("sw.js", "data/live.json", ".nojekyll"):
            shell.append(rel)
shell.sort()
digest = hashlib.sha256()
for rel in shell:
    digest.update(rel.encode() + b"\0")
    with open(os.path.join(OUT, rel), "rb") as f:
        digest.update(f.read())
with open(os.path.join(ROOT, "tools", "sw.js"), encoding="utf-8") as f:
    sw = f.read()
assert "__VERSION__" in sw and "__SHELL__" in sw
sw = sw.replace("__VERSION__", digest.hexdigest()[:12]).replace("__SHELL__", json.dumps(["./"] + shell, indent=1))
with open(os.path.join(OUT, "sw.js"), "w", encoding="utf-8", newline="\n") as f:
    f.write(sw)

files = sum(len(fs) for _, _, fs in os.walk(OUT))
size = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fs in os.walk(OUT) for fn in fs)
print("wrote dist/site:", files, "files,", round(size / 1024 / 1024, 1), "MB; the phone keeps", len(shell) + 1, "of them, version", digest.hexdigest()[:12])
