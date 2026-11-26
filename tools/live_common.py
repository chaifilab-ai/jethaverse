"""Shared pieces for the two automation scripts: tools/sync_new.py (new uploads) and tools/check_links.py (dead links).

Standard library only, so it runs anywhere Python 3.9+ does (a GitHub Actions runner, this computer).
Nothing here needs a YouTube API key or a sign-in. It reads three public things:
  * a channel's upload feed          https://www.youtube.com/feeds/videos.xml?channel_id=...   (newest 15 uploads)
  * a video's public page            https://www.youtube.com/watch?v=...                        (length, description)
  * YouTube's "does this video exist" answer   https://www.youtube.com/oembed?url=...           (200 = yes, 404 = gone)

What the scripts find goes into data/live.json, a small list of changes the app lays over its built-in episode list:
  {"v": 1, "updated": "2026-11-26T05:10Z",
   "dead":     ["VIDEOID", ...],                        links that are gone (checked on two different days)
   "links":    {"601": [{"id", "label", "kind": "full" | "highlights", "minutes", "note", "added", "check"?}]},
   "episodes": {"4877": {"title", "synopsis", "aired", "cast", "added"}}}      episode numbers the built-in list lacks
data/live_state.json is the scripts' own notebook (what was seen, which links failed once, a short log).
"""
import datetime, json, os, re, sys, time, urllib.error, urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "data", "episodes.json")
LIVE = os.path.join(ROOT, "data", "live.json")
STATE = os.path.join(ROOT, "data", "live_state.json")
POOL = os.path.join(ROOT, "tools", "pool.json")

CHANNELS = [  # key, YouTube channel id, the label the app shows
    {"key": "official", "id": "UCnSFZ-olBoLGLRUS_3RI2Aw", "label": "Official channel"},
    {"key": "sab", "id": "UC6-F5tO8uklgE9Zy8IvbdFw", "label": "Sony SAB"},
    {"key": "pal", "id": "UCw7xjxzbMwgBSmbeYwqYRMg", "label": "Sony PAL"},
]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
FULL_MIN = 15       # a video this long or longer counts as a full episode (they run 17 to 23 minutes)
NEW_AHEAD = 40      # a brand-new episode number may be at most this far past the highest known one


def today():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


# ----------------------------------------------------------------------------------------------- files
def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)


def load_base():
    return load_json(BASE, None)


def load_live():
    live = load_json(LIVE, {})
    live.setdefault("v", 1)
    live.setdefault("updated", "")
    live.setdefault("dead", [])
    live.setdefault("links", {})
    live.setdefault("episodes", {})
    return live


def load_state():
    st = load_json(STATE, {})
    st.setdefault("seen", {})      # video id -> day it was looked at and left out (not an episode, too short, ...)
    st.setdefault("strikes", {})   # video id -> {"n": times it answered "gone", "first": day, "last": day}
    st.setdefault("need", {})      # episode number -> day its last full-length link died (a replacement is wanted)
    st.setdefault("log", [])       # newest last: {"d": day, "t": text}
    return st


def log(state, text):
    state["log"].append({"d": today(), "t": text})
    del state["log"][:-300]
    print(" *", text)


def watch_url(vid):
    return "https://www.youtube.com/watch?v=" + vid


# ----------------------------------------------------------------------------------------------- network
def http_get(url, timeout=25, tries=3, head=False):
    """-> (status, bytes). status 0 = the request never got an answer (network trouble)."""
    last = 0
    for k in range(tries):
        req = urllib.request.Request(url, method="HEAD" if head else "GET",
                                     headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.8", "Cookie": "SOCS=CAI; CONSENT=YES+1"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, (b"" if head else r.read())
        except urllib.error.HTTPError as e:
            last = e.code
            if e.code not in (429, 500, 502, 503, 504):
                return e.code, b""
        except Exception:
            last = 0
        time.sleep(1.5 * (k + 1))
    return last, b""


NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015", "m": "http://search.yahoo.com/mrss/"}


def parse_feed(xml_bytes):
    out = []
    for e in ET.fromstring(xml_bytes).findall("a:entry", NS):
        d = e.find("m:group/m:description", NS)
        out.append({"id": e.find("yt:videoId", NS).text, "title": e.find("a:title", NS).text or "",
                    "desc": (d.text if d is not None else "") or "", "published": (e.find("a:published", NS).text or "")})
    return out


def feed(channel_id):
    """The channel's newest uploads: its 15 newest of any kind plus its 15 newest long videos (no Shorts, no live)."""
    items, seen, ok = [], set(), False
    urls = ["https://www.youtube.com/feeds/videos.xml?channel_id=" + channel_id,
            "https://www.youtube.com/feeds/videos.xml?playlist_id=UULF" + channel_id[2:]]
    for u in urls:
        status, body = http_get(u)
        if status != 200:
            continue
        try:
            got = parse_feed(body)
        except ET.ParseError:
            continue
        ok = True
        for it in got:
            if it["id"] not in seen:
                seen.add(it["id"])
                items.append(it)
    return items if ok else None


def deep_list(channel_id, count):
    """Optional: the newest `count` uploads (id, title, length) through yt-dlp, for runs that want to look further back
    than the feed's 15. Returns [] when yt-dlp is not installed or the listing fails."""
    import subprocess
    try:
        r = subprocess.run([sys.executable, "-m", "yt_dlp", "--flat-playlist", "--dump-json", "--no-warnings", "--playlist-end", str(count),
                            "https://www.youtube.com/channel/" + channel_id + "/videos"], capture_output=True, text=True, encoding="utf-8", timeout=300)
    except Exception:
        return []
    out = []
    for line in r.stdout.splitlines():
        try:
            d = json.loads(line)
        except ValueError:
            continue
        out.append({"id": d["id"], "title": d.get("title") or "", "desc": "", "published": "", "seconds": d.get("duration") or 0})
    return out


def _js_string(raw):
    try:
        return json.loads('"' + raw + '"')
    except ValueError:
        return ""


def video_info(vid):
    """Length, title, description and upload day from the video's public page. Every field may be missing."""
    status, body = http_get(watch_url(vid))
    info = {"seconds": 0, "title": "", "desc": "", "published": "", "status": ""}
    if status != 200:
        return info
    page = body.decode("utf-8", "replace")
    m = re.search(r'"lengthSeconds":"(\d+)"', page)
    if m:
        info["seconds"] = int(m.group(1))
    m = re.search(r'"videoDetails":\{"videoId":"[\w-]{11}","title":"((?:[^"\\]|\\.)*)"', page)
    if m:
        info["title"] = _js_string(m.group(1))
    m = re.search(r'"shortDescription":"((?:[^"\\]|\\.)*)"', page)
    if m:
        info["desc"] = _js_string(m.group(1))
    m = re.search(r'"(?:uploadDate|publishDate)":"([^"]+)"', page)
    if m:
        info["published"] = m.group(1)
    m = re.search(r'"playabilityStatus":\{"status":"([A-Z_]+)"', page)
    if m:
        info["status"] = m.group(1)
    return info


def link_status(vid):
    """'ok' (the video exists), 'gone' (deleted, private or never existed) or 'unknown' (no clear answer; change nothing).
    oEmbed answers 200 for a public video, 401 when the owner only switched off embedding (it still plays on YouTube),
    and 400 / 403 / 404 for a video that is deleted, private or not there."""
    status, _ = http_get("https://www.youtube.com/oembed?format=json&url=" + urllib.request.quote(watch_url(vid), safe=""), timeout=20)
    if status in (200, 401):
        return "ok"
    if status in (400, 403, 404):
        return "gone"
    return "unknown"


# ----------------------------------------------------------------------------------------------- reading titles
TK = re.compile(r"taarak|tarak|tmkoc|ooltah|oolta|chashm|chasma", re.I)
SKIP = re.compile(r"#\s*\w|precap|coming up|\bpromo\b|trailer|best of|compilation|jukebox|marathon|non[- ]?stop|\bhours?\b|"
                  r"behind the scenes|latest episode\s*!|haste raho|\bmovie\b", re.I)  # no bare "short": "Short-Lived" is a real title
HIGHLIGHTS = re.compile(r"\bNEW\s*!|teaser|highlights", re.I)
NUMBER = [  # pattern, True when the wording itself says "this is the whole episode"
    (re.compile(r"\bSE\s*\d+\s*EP\s*(\d{1,4})\b", re.I), True),
    (re.compile(r"\bFull\s*Episode\s*[-:#]?\s*(\d{1,4})\b", re.I), True),
    (re.compile(r"\bFull\s*EP\s*[-:#]?\s*(\d{1,4})\b", re.I), True),
    (re.compile(r"\bFE\s*[-:#]?\s*(\d{1,4})\b"), True),
    (re.compile(r"\bEpisode\s*[-:#]?\s*(\d{1,4})\b", re.I), False),
    (re.compile(r"\bEp\.?\s*[-:#]?\s*(\d{1,4})\b", re.I), False),
]
MONTHS = {m: i + 1 for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}
DATE = re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(20\d\d)\b", re.I)


def clean_name(s):
    s = re.sub(r"\s+", " ", s or "").strip(" -|")
    return re.sub(r"\s+([!?])", r"\1", s)


def parse_title(channel, title):
    """-> None (not an episode upload) or {"n", "kind": "full" | "highlights", "sure", "name", "aired"}.
    `sure` = the title itself says it is the whole episode ("SE 02 EP 601", "Full Episode 4858")."""
    t = title or ""
    if channel != "official" and not TK.search(t):
        return None
    if SKIP.search(t):
        return None
    n = sure = None
    for rx, strong in NUMBER:
        m = rx.search(t)
        if m:
            n, sure = int(m.group(1)), strong
            break
    if not n:
        return None
    kind = "highlights" if HIGHLIGHTS.search(t) else "full"
    name = ""
    if channel == "official":
        m = re.search(r"\bEP(?:ISODE)?\.?\s*\d{1,4}\s*-\s*(.+?)\s*(?:\||$)", t, re.I)
        name = clean_name(m.group(1)) if m else ""
    else:
        first = t.split("|")[0]
        if not TK.search(first) and not HIGHLIGHTS.search(first):
            name = clean_name(first)
    aired = ""
    m = DATE.search(t)
    if m:
        aired = "%s-%02d-%02d" % (m.group(3), MONTHS[m.group(2).lower()[:3]], int(m.group(1)))
    return {"n": n, "kind": kind, "sure": bool(sure) and kind == "full", "name": name, "aired": aired}


def decide_kind(parsed, seconds):
    """Title wording + real length -> 'full', 'highlights' or None (leave it out)."""
    if not seconds:  # length not readable: trust only titles that say "full episode"; highlights say so themselves
        return "full" if parsed["sure"] else ("highlights" if parsed["kind"] == "highlights" else None)
    minutes = seconds / 60.0
    if minutes > 40:
        return None  # a compilation or a film, not one episode
    if minutes >= FULL_MIN:
        return "full"
    if parsed["kind"] == "highlights" and minutes >= 4:
        return "highlights"
    return None


BOILER = re.compile(r"https?://|click here|subscribe|#\w|play now|are you ready|gada electronics|we bring to you|about (?:the show|taarak)|"
                    r"show name|star cast|produced by|episodes? no\b|sonyliv|sony liv|keep watching|coming up next", re.I)


def synopsis_from(channel, desc, n):
    """-> (title or "", synopsis or "") read from a video description.
    Sony SAB full episodes carry "Episode 4858: Title / ------ / synopsis" (trusted only when the number is this episode's:
    their short videos often carry the previous day's text). The official channel puts a one-paragraph synopsis between
    its subscribe line and its adverts."""
    desc = (desc or "").replace("\r", "")
    m = re.search(r"Episode\s*(\d{1,4})\s*:\s*([^\n]+)\n\s*-{5,}\s*\n(.+?)(?:\n\s*\n|\Z)", desc, re.S)
    if m:
        if int(m.group(1)) != n:
            return "", ""
        return clean_name(m.group(2)), re.sub(r"\s+", " ", m.group(3)).strip()
    if channel != "official":
        return "", ""
    for para in re.split(r"\n\s*\n", desc):
        p = re.sub(r"\s+", " ", para).strip()
        if len(p.split()) >= 6 and not BOILER.search(p):
            return "", p[:600]
    return "", ""


def aired_from_published(published):
    """The official channel posts the day's episode at about 9 pm India time: the upload day in India is the air date."""
    try:
        t = datetime.datetime.fromisoformat(published.replace("Z", "+00:00"))
    except ValueError:
        return ""
    return (t.astimezone(datetime.timezone(datetime.timedelta(hours=5, minutes=30)))).strftime("%Y-%m-%d")


# ----------------------------------------------------------------------------------------------- story check
# The same word-overlap test the catalogue was built with (pipeline/alt/choose.py): the video's own text against the
# guide's text for episode N and its neighbours. 'shifted' = a neighbour fits clearly better, so the link gets a
# "may not match" note in the app. It finds likely slips; it does not prove the rest right.
STOP = set("the a an and of to in on at is are was were for with by he she it his her their they them this that as from be has have had "
           "will not but or so all one two who what when after before then there here into out up down about more also very just now "
           "taarak mehta ooltah chashmah episode full gokuldham society jethalal watch latest new subscribe channel sony sab tmkoc comedy show".split())


def toks(s):
    return {w for w in re.findall(r"[a-z]{3,}", (s or "").lower()) if w not in STOP}


def story_verdict(text, n, text_of):
    """text_of: {episode number: the guide's title + synopsis}. -> 'match', 'shifted' or 'no text'."""
    p = toks(text)
    sc = {}
    for k in range(n - 3, n + 4):
        if k in text_of:
            q = toks(text_of[k])
            sc[k] = len(p & q) / (len(p | q) or 1)
    if not sc:
        return "no text"
    best = max(sc, key=sc.get)
    own, top = sc.get(n, 0), sc[best]
    if top < 0.04:
        return "no text"
    return "match" if best == n or own >= 0.8 * top else "shifted"


# ----------------------------------------------------------------------------------------------- the guide's links
def all_links(base, live):
    """-> {video id: episode number} for every link the app can show (built-in ones and added ones), dead ones included."""
    out = {}
    for e in base["episodes"]:
        for w in e.get("watch") or []:
            out[w["id"]] = e["n"]
    for n, links in live["links"].items():
        for x in links:
            out[x["id"]] = int(n)
    return out


def is_short(w):
    return "short upload" in (w.get("note") or "") or 0 < (w.get("minutes") or 0) < FULL_MIN


def full_links(ep, live, n):
    """Ids of the episode's working full-length links, built-in and added."""
    dead = set(live["dead"])
    ids = [w["id"] for w in (ep.get("watch") or []) if ep and w["id"] not in dead and not is_short(w)] if ep else []
    ids += [x["id"] for x in live["links"].get(str(n), []) if x["id"] not in dead and x.get("kind") == "full"]
    return ids
