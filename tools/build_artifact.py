"""Pack the guide for hosts that only allow inline CSS/JS (e.g. a claude.ai artifact).

CSS, search code and app code are inlined into one page. The episode list (about 2.6 MB) is too big to inline
sensibly, so it sits beside the page as data/episodes.json and the app fetches it. Stickers sit beside the page too.

Usage (from the tmkoc-episode-guide folder):  python tools/build_artifact.py
Output: dist/artifact/index.html + dist/artifact/data/episodes.json + dist/artifact/assets/stickers/*.webp

The hosted page runs with GG_CONFIG = {noHash}: such hosts keep the address bar to themselves.
"""
import os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dist", "artifact")


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def script(rel, pre=""):
    js = read(rel)
    assert "</script" not in js.lower(), rel
    return f"<script>\n{pre}{js}\n</script>"


html = read("index.html")
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)

# head: keep title/meta/fonts, swap our stylesheets for inline CSS
head = re.sub(r'\s*<meta charset[^>]*>|\s*<meta name="viewport"[^>]*>', "", head)
head = re.sub(r"<title>.*?</title>", "<title>JethaVerse</title>", head)
head = re.sub(r'\s*<link rel="stylesheet" href="css/[^"]+">', "", head)
css = read("css/tokens.css") + "\n" + read("css/app.css") + """
/* hosted page: the host already pads the page by the phone's safe areas */
.app { padding-top: 0; }
.orb { top: 14px; }
"""
head += f"\n<style>\n{css}\n</style>\n"

# body: no data script (the app fetches data/episodes.json); inline our own scripts
body = body.replace('<script src="data/episodes.js"></script>', "")
body = body.replace('<script src="data/best.js"></script>', script("data/best.js"))
body = body.replace('<script src="js/search.js"></script>', script("js/search.js"))
body = body.replace('<script src="js/ratings.js"></script>', script("js/ratings.js"))
body = body.replace('<script src="js/lists.js"></script>', script("js/lists.js"))
# ratings: null = off. A hosted page like this one cannot reach the ratings database.
body = body.replace('<script src="js/app.js" defer></script>', script("js/app.js", "window.GG_CONFIG = { noHash: true, ratings: null };\n"))
assert 'src="js/' not in body and 'src="data/' not in body

os.makedirs(os.path.join(OUT, "assets"), exist_ok=True)
os.makedirs(os.path.join(OUT, "data"), exist_ok=True)
shutil.rmtree(os.path.join(OUT, "assets", "stickers"), ignore_errors=True)
shutil.copytree(os.path.join(ROOT, "assets", "stickers"), os.path.join(OUT, "assets", "stickers"))
shutil.copyfile(os.path.join(ROOT, "data", "episodes.json"), os.path.join(OUT, "data", "episodes.json"))
if os.path.exists(os.path.join(ROOT, "data", "live.json")):
    shutil.copyfile(os.path.join(ROOT, "data", "live.json"), os.path.join(OUT, "data", "live.json"))
with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
    f.write('<meta charset="utf-8">\n' + head.strip() + "\n" + body.strip() + "\n")
print("wrote", os.path.relpath(os.path.join(OUT, "index.html"), ROOT),
      round(os.path.getsize(os.path.join(OUT, "index.html")) / 1024), "KB + data/episodes.json",
      round(os.path.getsize(os.path.join(OUT, "data", "episodes.json")) / 1024), "KB")
