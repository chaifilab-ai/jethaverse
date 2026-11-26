"""Build data/episodes.js from the research JSON files.

Usage: python tools/build_data.py research data/episodes.js
research/ holds reco.json, sonyliv.json, summaries_*.json and cast_*.json.
Adding Episodes 51+ later = add rows to those files (and an arc below), then re-run.
"""
import glob, json, os, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]

ARCS = [  # id, name, short line, first ep, last ep
    ("intro", "Welcome to Gokuldham", "Neighbours line up to complain about Tapu", 1, 3),
    ("arrest", "Jethalal arrested", "A child-labour complaint lands Jetha in trouble", 4, 5),
    ("bapuji", "Bapuji comes to Mumbai", "Champaklal arrives, leaves in a huff and returns", 5, 10),
    ("mobile", "Bapuji's mobile phone", "Champaklal meets the cellphone", 11, 11),
    ("rakhi", "Raksha Bandhan", "Rakhi day in the society", 12, 13),
    ("kidnap", "The kidnapping", "A scare that shakes Gokuldham", 14, 15),
    ("janmashtami", "Janmashtami", "Card games and the dahi-handi matki", 16, 17),
    ("school", "Complaint from school", "Tapu's school calls the parents", 18, 18),
    ("tantrik", "The tantrik's charm", "A baba promises miracles", 19, 20),
    ("teej", "Hartalika Teej fast", "The wives fast, the husbands suffer", 21, 22),
    ("ganesh", "Ganesh Utsav", "Bomb scare, confessions and a kavi sammelan", 23, 29),
    ("strike", "The husbands' strike", "The men rebel against their wives", 30, 34),
    ("tv", "TV war and the child lock", "One remote, too many viewers", 35, 38),
    ("navratri", "Navratri", "Garba, dandiya and a run-in with goons", 39, 44),
    ("kidney", "The kidney hunt", "A Sheikh needs a kidney and Jetha sees a deal", 45, 49),
    ("diwali", "Diwali", "Festival of lights in Gokuldham", 50, 50),
]

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from characters import CHARACTERS, FAMILIES

WATCH_ORDER = [  # research source key -> label, note. Sony PAL first (owner's preference).
    ("Sony PAL", "Sony PAL", "Preferred channel · checked against the episode's captions"),
    ("Official 1080p (2026)", "Official channel", "Full HD"),
    ("Sony SAB 2024 (with synopsis)", "Sony SAB", "Backup"),
    ("Sony SAB 2017/2020", "Sony SAB", "Backup"),
    ("Official 480p (2021)", "Official channel", "Older upload, about a minute longer"),
]
SONYLIV = "https://www.sonyliv.com/shows/taarak-mehta-ka-ooltah-chashmah-1700000084/episodes/1-100"


def load_rows(pattern):
    rows = {}
    for f in glob.glob(os.path.join(SRC, pattern)):
        for r in json.load(open(f, encoding="utf-8")):
            rows[int(r["episode"])] = r
    return rows


def yt_id(url):
    return url.split("v=")[1].split("&")[0]


reco = {int(k): v for k, v in json.load(open(os.path.join(SRC, "reco.json"), encoding="utf-8")).items()}
liv = {int(k): v for k, v in json.load(open(os.path.join(SRC, "sonyliv.json"), encoding="utf-8")).items()}
summ, cast = load_rows("summaries_*.json"), load_rows("cast_*.json")
PAL = {int(k): v for k, v in json.load(open(os.path.join(SRC, "pal_choice.json"), encoding="utf-8")).items()}

episodes = []
for n in sorted(reco):
    r, s, c = reco[n], summ[n], cast[n]
    title, synopsis = liv[n]
    watch, seen = [], set()
    for key, label, note in WATCH_ORDER:
        src = (r.get("sources") or {}).get(key)
        if not src or src["url"] in seen:
            continue
        seen.add(src["url"])
        watch.append({"label": label, "note": note, "url": src["url"], "id": yt_id(src["url"]),
                      "quality": f"{src['res']}p" if src.get("res") else "",
                      "minutes": round((src.get("dur") or 0) / 60)})
    # main video = first in WATCH_ORDER that exists (Sony PAL where it has the episode)
    main = watch[0]
    pal = PAL.get(n) if main["label"] == "Sony PAL" else None
    if pal:
        views, up = pal.get("view_count") or r["views"], pal.get("upload_date") or r["upload_date"]
    elif main["id"] == r["id"]:
        views, up = r["views"], r["upload_date"]
    else:
        views, up = None, r["upload_date"]
    ep = {
        "n": n,
        "title": title,
        "synopsis": synopsis,
        "summary": s["summary"],
        "events": s["events"],
        "confidence": s["confidence"],
        "cast": [x for x in c["present"] if x in CHARACTERS],
        "maybe": [x for x in c["unsure"] if x in CHARACTERS and x not in c["present"]],
        "arcs": [a[0] for a in ARCS if a[3] <= n <= a[4]],
        "videoId": main["id"],
        "channel": main["label"],
        "minutes": main["minutes"] or round(r["duration"] / 60),
        "views": views,
        "uploaded": f"{up[:4]}-{up[4:6]}-{up[6:]}",
        "watch": watch,
    }
    if n == 34:
        ep["note"] = ("SonyLIV's description for Episode 34 (about Sundar's scheme) doesn't match the Episode 34 video "
                      "on any YouTube channel, which wraps up the husbands' strike. The summary here follows the video.")
    episodes.append(ep)

unknown = {x for n in cast for x in cast[n]["present"] + cast[n]["unsure"]} - set(CHARACTERS)
assert not unknown, unknown

# ---------------------------------------------------------------------------------------------
# Stage 5: the rest of the catalogue (Episodes 51 and up), from the Excel master sheet
# ("All episodes (best link)": SonyLIV title + synopsis + best link) and pipeline/alt/fallback.json.
# Episodes 1-50 keep their richer, hand-checked entries above.
# ---------------------------------------------------------------------------------------------
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "TMKOC_SonyPAL_episodes.xlsx")
FALLBACK = os.path.join(ROOT, "pipeline", "alt", "fallback.json")
SRC_LABEL = {"Sony PAL": "Sony PAL", "Sony SAB channel": "Sony SAB", "Official TMKOC channel": "Official channel"}
# Who is in each episode (Episodes 51 and up). Three sources, in this order of trust:
#   1. names in SonyLIV's title and synopsis, plus "Hathi's son"-style phrases (tools/characters.py: detect_cast)
#   2. names spoken in the video's Hindi auto-captions (pipeline/cast/counts.jsonl; Sony PAL and the official channel only,
#      Sony SAB uploads have no captions). A name needs pipeline/cast/thresholds.json mentions to count as cast; fewer = "maybe".
#   3. otherwise nothing. Episodes 1-50 keep their hand-checked cast.
from characters import detect_cast


def load_captions():
    cf, tf = os.path.join(ROOT, "pipeline", "cast", "counts.jsonl"), os.path.join(ROOT, "pipeline", "cast", "thresholds.json")
    if not (os.path.exists(cf) and os.path.exists(tf)):
        return {}, {}, {}
    counts = {}
    for line in open(cf, encoding="utf-8"):
        r = json.loads(line)
        counts[r["id"]] = r["counts"]
    # short official clips of the episode (for episodes whose own video has no captions): names summed over the clips
    clips = {}
    kf, kc = os.path.join(ROOT, "pipeline", "cast", "clips.json"), os.path.join(ROOT, "pipeline", "cast", "clips_counts.jsonl")
    if os.path.exists(kf) and os.path.exists(kc):
        cc = {}
        for line in open(kc, encoding="utf-8"):
            r = json.loads(line)
            cc[r["id"]] = r["counts"]
        for n, ids in json.load(open(kf)).items():
            tot = {}
            for i in ids:
                for name, k in cc.get(i, {}).items():
                    tot[name] = tot.get(name, 0) + k
            if any(i in cc for i in ids):
                clips[int(n)] = tot
    return counts, json.load(open(tf, encoding="utf-8")), clips


CAP, THRESH, CLIPS = load_captions()


def merge_cast(text, vid, n):
    """-> (cast, maybe, source): 'c' = text + the video's captions, 'k' = text + short clips of the episode, 't' = text only."""
    base = set(detect_cast(text))
    c, how = CAP.get(vid), "c"
    if c is None:
        c, how = CLIPS.get(n), "k"
    if c is None:
        return [x for x in CHARACTERS if x in base], [], "t"
    cast = base | {x for x, k in c.items() if k >= THRESH.get(x, 2)}
    maybe = {x for x, k in c.items() if k >= 1} - cast
    return [x for x in CHARACTERS if x in cast], [x for x in CHARACTERS if x in maybe], how


# Episodes whose Sony PAL / Sony SAB link is under 15 minutes (a part, not the whole episode): pipeline/alt/short_choose.py
# picks a full-length video (title names the episode number, 17+ minutes) from the official channel or Sony SAB.
SHORT_FIX = {}
_sf = os.path.join(ROOT, "pipeline", "alt", "short_fix.json")
if os.path.exists(_sf):
    SHORT_FIX = {int(k): v for k, v in json.load(open(_sf, encoding="utf-8")).items()}
SHORT_MAX = 13  # a link this short or shorter, with no full-length replacement, gets a caution note


def full_length_first(ep, n):
    """Put the full-length replacement first; keep the short upload as a labelled backup."""
    f = SHORT_FIX[n]
    new = []
    for x in [f["best"]] + f["backups"]:
        h = x.get("height") or 0
        new.append({"label": SRC_LABEL.get(x["source"], x["source"]), "note": quality_note(h), "url": x["url"], "id": yt_id(x["url"]),
                    "quality": f"{h}p" if h else "", "minutes": x["minutes"]})
    old = ep["watch"]
    if old:
        old[0] = dict(old[0], note=(old[0]["note"] + " · " if old[0]["note"] else "") + "short upload")
    ep["watch"] = new + [w for w in old if w["id"] not in {x["id"] for x in new}]
    ep["videoId"], ep["channel"], ep["minutes"] = new[0]["id"], new[0]["label"], new[0]["minutes"]
    if f["best"]["verdict"] == "shifted":
        ep["check"] = 1


def quality_note(height):
    return "Full HD" if height and height >= 1080 else (f"{height}p" if height else "")


def build_catalogue(have):
    import openpyxl
    if not (os.path.exists(XLSX) and os.path.exists(FALLBACK)):
        print("catalogue inputs not found; keeping Episodes 1-50 only")
        return []
    fb = {int(k): v for k, v in json.load(open(FALLBACK, encoding="utf-8")).items()}
    ws = openpyxl.load_workbook(XLSX, read_only=True)["All episodes (best link)"]
    out = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        n, title, syn, url, src, pic, mins, story = r[:8]
        if n in have:
            continue
        watch, vid = [], None
        if "youtube.com" in (url or ""):
            vid = yt_id(url)
            q = int(pic[:-1]) if isinstance(pic, str) and pic.endswith("p") else 0
            watch.append({"label": SRC_LABEL[src], "note": quality_note(q), "url": url, "id": vid, "quality": f"{q}p" if q else "", "minutes": mins or 0})
            for b in (fb.get(n) or {}).get("backups", []):
                watch.append({"label": SRC_LABEL.get(b["source"], b["source"]),
                              "note": quality_note(b["height"]), "url": b["url"], "id": yt_id(b["url"]),
                              "quality": f"{b['height']}p" if b["height"] else "", "minutes": b["minutes"]})
        cast, maybe, how = merge_cast(title + " " + syn, vid, n)
        ep = {"n": n, "title": title, "synopsis": syn, "cast": cast, "videoId": vid,
              "channel": SRC_LABEL.get(src, "SonyLIV"), "minutes": mins or 0, "watch": watch, "castBy": how}
        if maybe:
            ep["maybe"] = maybe
        if story in ("Possible mismatch", "Different? (check)"):
            ep["check"] = 1  # the link's own text fits a neighbouring number slightly better; show a gentle note
        if n in SHORT_FIX:
            full_length_first(ep, n)
        elif vid and 0 < ep["minutes"] <= SHORT_MAX:
            ep["note"] = (f"The only video found for this episode is {ep['minutes']} minutes long, so it may be only part of the episode. "
                          "Try the previous and next episode, or SonyLIV (Premium), for the rest.")
        out.append(ep)
    return out


have = {e["n"] for e in episodes}
extra = build_catalogue(have)
episodes = sorted(episodes + extra, key=lambda e: e["n"])
data = {
    "show": "Taarak Mehta Ka Ooltah Chashmah",
    "built": "2026-11-25",
    "sonyliv": SONYLIV,
    "arcs": [{"id": a, "name": nm, "line": ln, "from": f, "to": t} for a, nm, ln, f, t in ARCS],
    "families": [{"house": h, "members": m} for h, m in FAMILIES],
    "characters": {k: {"about": v[0], "aliases": v[1]} for k, v in CHARACTERS.items()},
    "episodes": episodes,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write("/* Generated by tools/build_data.py. Do not edit by hand. */\n")
    f.write("(function (root, data) { if (typeof module === 'object' && module.exports) module.exports = data; "
            "else root.TMKOC_DATA = data; })(this, ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(");\n")
# the same data as plain JSON, for hosts that cannot load a script file (the hosted page fetches this)
with open(os.path.splitext(OUT)[0] + ".json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
print(len(episodes), "episodes;", sum(len(e["watch"]) for e in episodes), "watch links")
