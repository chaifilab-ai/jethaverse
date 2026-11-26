"""Cut a character sticker sheet (3x2 poses on white) into single transparent WebP stickers: assets/stickers/<prefix>_<pose>.webp
Usage (from the tmkoc-episode-guide folder):  python tools/make_character.py goli|sundar|bapuji|daya|babita|tapu|iyer|sodhi|bhide|nattu|popat <sheet.png>
Reuses the cut-out code from make_stickers.py. Goli, Bapuji, Daya, Babita and Tapu also get a head-and-shoulders crop (<name>_bust) for their windows."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_stickers import cutout, cells, save

POSES = {  # left to right, top row then bottom row
    "goli": ["snack", "laugh", "dreamy", "whoa", "ok", "cheer"],
    "sundar": ["point", "phone", "heart", "whoa", "laugh", "ok"],
    "bapuji": ["angry", "arms", "shock", "paper", "laugh", "think"],
    "daya": ["whoa", "phone", "heart", "gasp", "ok", "namaste"],
    "babita": ["wave", "gasp", "heart", "laugh", "idea", "thumbs"],
    "tapu": ["wave", "cheer", "idea", "whoa", "laugh", "thumbs"],
    "iyer": ["stop", "scratch", "plead", "point", "nails", "headache"],
    "sodhi": ["point", "laugh", "warn", "cheer", "idea", "ok"],
    "bhide": ["arms", "point", "worry", "think", "calm", "angry"],
    "nattu": ["grumpy", "laugh", "glasses", "stop", "namaste", "point"],
    "popat": ["welcome", "love", "specs", "bride", "phone", "hip"],
}
KEEP_WHITES = {"bapuji", "sodhi"}  # white cap and dhoti: do not cut large white areas inside the outline
BUST = {"goli": 1, "bapuji": 4, "daya": 5, "babita": 5, "tapu": 5, "sundar": 0, "iyer": 2, "sodhi": 3, "bhide": 4, "nattu": 4, "popat": 1}  # pose (index) whose head and shoulders peek out of the character's window
# poses whose hand or prop crosses a cell edge: crop box (left, top, right, bottom) on a 1254 px sheet, used instead of the plain cell
CROP = {("sundar", "phone"): (400, 0, 870, 627), ("sundar", "heart"): (870, 0, 1254, 627)}
ROW2_TOP = {"tapu": 645, "iyer": 640, "sodhi": 640, "bhide": 640, "nattu": 640, "popat": 632}
ROW1_BOTTOM = {"popat": 614}  # likewise the other way: stop the top row above the bottom row's first marks (1254 px sheet)  # the top row's ground shadow reaches into the bottom row's cells: start the bottom row's crop lower (1254 px sheet)
LEG_GAP = {"sodhi"}  # white shirt: large whites are kept, so the white wedge between the legs is cleared by position instead
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "stickers")

def clear_leg_gap(img):
    """Make near-white pixels transparent in the lower 26% / middle 60% of a cut-out (only the gap between the legs is white there)."""
    from PIL import ImageChops
    r, g, b, a = img.split()
    white = ImageChops.darker(ImageChops.darker(r, g), b).point(lambda v: 255 if v >= 238 else 0)
    w, h = img.size
    box = Image.new("L", (w, h), 0)
    box.paste(255, (round(w * 0.2), round(h * 0.74), round(w * 0.8), h))
    a = ImageChops.subtract(a, ImageChops.multiply(white, box))
    img.putalpha(a)
    return img


if __name__ == "__main__":
    from PIL import Image
    who, path = sys.argv[1], sys.argv[2]
    sheet = Image.open(path).convert("RGB")
    cut = []
    k = sheet.width / 1254
    for i, (name, cell) in enumerate(zip(POSES[who], cells(sheet))):
        if i < 3 and who in ROW1_BOTTOM:
            cell = cell.crop((0, 0, cell.width, round(ROW1_BOTTOM[who] * k)))
        if i >= 3 and who in ROW2_TOP:
            cell = cell.crop((0, round(ROW2_TOP[who] * k) - sheet.height // 2, cell.width, cell.height))
        if (who, name) in CROP:
            cell = sheet.crop(tuple(round(v * k) for v in CROP[(who, name)]))
        img = cutout(cell, pockets=who not in KEEP_WHITES)
        if who in LEG_GAP:
            img = clear_leg_gap(img)
        cut.append(img)
        out = os.path.join(OUT, f"{who}_{name}.webp")
        print(name, save(img, out, 420), os.path.getsize(out) // 1024, "KB")
    if who in BUST:
        full = cut[BUST[who]]
        bust = full.crop((0, 0, full.width, round(full.width * 1.05)))
        print("bust", save(bust, os.path.join(OUT, f"{who}_bust.webp"), 300))
