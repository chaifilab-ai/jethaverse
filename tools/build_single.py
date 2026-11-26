"""Pack the guide into ONE html file that works by itself (open it from the phone's Files app, or host it anywhere).

CSS, search code, app code, all 4,872 episodes and the stickers are inside the file (about 3.3 MB). Only the two
fonts come from Google Fonts when online; offline the phone's own fonts are used.

Usage (from the tmkoc-episode-guide folder):  python tools/build_single.py
Output: dist/JethaVerse.html
"""
import base64, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dist", "JethaVerse.html")


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


html = read("index.html")
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)

head = re.sub(r'\s*<link rel="preload"[^>]*>', "", head)
head = re.sub(r'\s*<link rel="stylesheet" href="css/[^"]+">', "", head)
head += "\n<style>\n" + read("css/tokens.css") + "\n" + read("css/app.css") + "\n</style>\n"

stickers = {}
sdir = os.path.join(ROOT, "assets", "stickers")
for name in sorted(os.listdir(sdir)):
    if name.endswith(".webp") and not name.endswith("_bust.webp"):  # the face crops are not used by the app any more
        with open(os.path.join(sdir, name), "rb") as f:
            stickers[name[:-5]] = "data:image/webp;base64," + base64.b64encode(f.read()).decode()

app = read("js/app.js")
#   src="assets/stickers/' + p + '.webp"   ->  src="' + window.GG_STICKERS[p] + '"
#   src="assets/stickers/' + EXPR + '.webp"   ->  src="' + window.GG_STICKERS[EXPR] + '"   (a sticker chosen in code)
app, n_dyn = re.subn(r"assets/stickers/' \+ ([^+']+?) \+ '\.webp", lambda m: "' + window.GG_STICKERS[" + m.group(1) + "] + '", app)
assert n_dyn == 1, n_dyn
#   src="assets/stickers/NAME.webp"        ->  src="' + window.GG_STICKERS.NAME + '"
app = re.sub(r"assets/stickers/(\w+)\.webp", lambda m: "' + window.GG_STICKERS." + m.group(1) + " + '", app)
assert "assets/stickers/" not in app.replace("data/episodes.js, or fetched", ""), "sticker path left in app.js"

data = read("data/episodes.json").strip().replace("</", "<\\/")
# the list of live changes as it is today, and where to ask for a newer one (site.config.json: the website's address,
# "" until the guide is hosted; the file then simply keeps the copy packed in here)
live = json.dumps(json.loads(read("data/live.json")), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") \
    if os.path.exists(os.path.join(ROOT, "data", "live.json")) else "null"
site = json.loads(read("site.config.json")) if os.path.exists(os.path.join(ROOT, "site.config.json")) else {}
config = json.dumps({"live": site.get("liveUrl", "")})
for name, js in (("search", read("js/search.js")), ("app", app)):
    assert "</script" not in js.lower(), name

body = body.replace('<script src="data/episodes.js"></script>', "")
body = body.replace('<script src="js/search.js"></script>', "<script>\n" + read("js/search.js") + "\n</script>")
body = body.replace(
    '<script src="js/app.js" defer></script>',
    "<script>\nwindow.GG_CONFIG = " + config + ";\nwindow.GG_LIVE = " + live + ";\nwindow.GG_STICKERS = " + json.dumps(stickers) +
    ";\nwindow.TMKOC_DATA = " + data + ";\n</script>\n"
    "<script>\n" + app + "\n</script>")
assert 'src="js/' not in body and 'src="data/' not in body and 'href="css/' not in head

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write("<!doctype html>\n<html lang=\"en\">\n<head>" + head + "</head>\n<body>" + body + "</body>\n</html>\n")
print("wrote", os.path.relpath(OUT, ROOT), round(os.path.getsize(OUT) / 1024), "KB")
