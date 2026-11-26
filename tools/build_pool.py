"""Build tools/pool.json: other full-length uploads of each episode number, for tools/check_links.py to fall back on
when an episode's links die.

One-off, run on the computer that has the pipeline/ folder (the channel listings made by pipeline/alt/list_channel.py):
    python tools/build_pool.py
Output: {"601": [["official", "VIDEOID", 20], ...]}  up to 4 per episode, best first (the official numbered series,
other official uploads, Sony SAB "Full Episode", other Sony SAB), leaving out videos the guide already links to.
Re-run after re-listing the channels; the daily job does not need the pipeline/ folder, only this file.
"""
import collections, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import live_common as C

base = C.load_base()
have = {w["id"] for e in base["episodes"] for w in e["watch"]}
numbers = {e["n"] for e in base["episodes"]}
cands = collections.defaultdict(list)
for src in ("official", "sab"):
    path = os.path.join(C.ROOT, "pipeline", "alt", src + "_all.jsonl")
    for line in open(path, encoding="utf-8"):
        r = json.loads(line)
        if r["id"] in have:
            continue
        p = C.parse_title(src, r["title"])
        if not p or p["n"] not in numbers or C.decide_kind(p, r["duration"] or 0) != "full" or not r["duration"]:
            continue
        rank = (0 if src == "official" and p["sure"] else 1 if src == "official" else 2 if p["sure"] else 3, abs(r["duration"] - 1200))
        cands[p["n"]].append((rank, src, r["id"], round(r["duration"] / 60)))
pool = {str(n): [[s, i, m] for _, s, i, m in sorted(c)[:4]] for n, c in sorted(cands.items())}
with open(C.POOL, "w", encoding="utf-8", newline="\n") as f:
    json.dump(pool, f, separators=(",", ":"))
print(len(pool), "episodes have a spare;", sum(len(v) for v in pool.values()), "videos;", round(os.path.getsize(C.POOL) / 1024), "KB")
single = [e["n"] for e in base["episodes"] if len(e["watch"]) == 1]
print("episodes with exactly one link:", len(single), "of which with a spare in the pool:", sum(1 for n in single if str(n) in pool))
