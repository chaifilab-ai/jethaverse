"""Check that the guide's YouTube links still exist, retire the ones that are gone, and find a replacement.

Run from the project folder:   python tools/check_links.py          one day's share: a seventh of the links, so every
                                                                    link is checked once a week, plus every link that
                                                                    failed last time
                               python tools/check_links.py --all    every link now (about 6,000 requests, a few minutes)
                               add --dry to save nothing

How a link is retired: YouTube must say "no such video" on two different days (one bad answer can be a hiccup).
The id then goes into "dead" in data/live.json and the app stops showing it; the episode's next link (its backups
were chosen when the guide was built) becomes the main one by itself.
If that leaves an episode with no full-length link, the script looks in tools/pool.json, a list of other full-length
uploads of each episode number on the official channel and Sony SAB, takes the first one that exists, and adds it.
An episode with nothing left shows "SonyLIV only" until tools/sync_new.py sees a new upload of it.
A dead link is asked about again roughly once a month; if it is back (a video made public again) it is restored.
Safety: when an unusual share of one run's links come back "gone", the run is treated as broken and changes nothing.
"""
import os, sys, zlib
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import live_common as C

LABEL = {"official": "Official channel", "sab": "Sony SAB", "pal": "Sony PAL"}


def bucket(vid, parts):
    return zlib.crc32(vid.encode()) % parts


def check(base, live, state, ids, status=C.link_status, day=None, workers=8):
    """Ask about `ids`, record strikes, move twice-failed links to live["dead"], restore revived ones.
    -> (changes, numbers) or (None, set()) when the run looks broken."""
    day = day or C.today()
    owner = C.all_links(base, live)
    with ThreadPoolExecutor(workers) as ex:
        answers = dict(zip(ids, ex.map(status, ids)))
    gone = [i for i, a in answers.items() if a == "gone"]
    print("answers: %d exist, %d gone, %d no clear answer" % (
        sum(1 for a in answers.values() if a == "ok"), len(gone), sum(1 for a in answers.values() if a == "unknown")))
    dead = set(live["dead"])
    fresh_gone = [i for i in gone if i not in dead and i not in state["strikes"]]
    if len(fresh_gone) > max(15, len(ids) // 20):
        print("!! %d of %d links answered 'gone' in one run. That is not believable, so nothing was changed." % (len(fresh_gone), len(ids)))
        return None, set()
    changes, touched = [], set()
    for vid, a in answers.items():
        n = owner.get(vid)
        if a == "ok":
            state["strikes"].pop(vid, None)
            if vid in dead:
                dead.discard(vid)
                touched.add(n)
                changes.append("Episode %s: link %s is back on YouTube and shown again" % (n, vid))
        elif a == "gone" and vid not in dead:
            s = state["strikes"].setdefault(vid, {"n": 0, "first": day, "last": ""})
            if s["last"] != day:
                s["n"], s["last"] = s["n"] + 1, day
            if s["n"] >= 2:
                dead.add(vid)
                del state["strikes"][vid]
                touched.add(n)
                changes.append("Episode %s: link %s is gone from YouTube and was removed" % (n, vid))
    live["dead"] = sorted(dead)
    return changes, touched


def replace(base, live, state, pool, numbers, status=C.link_status, info=C.video_info, day=None):
    """For each episode in `numbers` left without a working full-length link, add one from the pool."""
    day = day or C.today()
    eps = {e["n"]: e for e in base["episodes"]}
    text_of = {n: e["title"] + " " + (e.get("synopsis") or "") for n, e in eps.items()}
    known = set(C.all_links(base, live)) | set(live["dead"])
    changes = []
    for n in sorted(x for x in numbers if x):
        if C.full_links(eps.get(n), live, n):
            state["need"].pop(str(n), None)
            continue
        state["need"].setdefault(str(n), day)
        for src, vid, minutes in pool.get(str(n), []):
            if vid in known or status(vid) != "ok":
                continue
            got = info(vid)
            mins = round(got["seconds"] / 60) if got["seconds"] else minutes
            if mins < C.FULL_MIN:
                continue
            link = {"id": vid, "label": LABEL.get(src, src), "kind": "full", "minutes": mins, "added": day, "note": "replacement"}
            _, syn = C.synopsis_from(src, got["desc"], n)
            if C.story_verdict(got["title"].split("|")[0] + " " + syn, n, text_of) == "shifted":
                link["check"] = 1
            live["links"].setdefault(str(n), []).append(link)
            known.add(vid)
            state["need"].pop(str(n), None)
            changes.append("Episode %d: replacement link from %s added" % (n, link["label"]))
            break
        else:
            if state["need"].get(str(n)) == day:
                changes.append("Episode %d: no other full-length upload found yet; it shows its remaining links or SonyLIV" % n)
    return changes


def todays_ids(base, live, state, day, everything=False):
    links = C.all_links(base, live)
    dead = set(live["dead"])
    if everything:
        return sorted(links)
    import datetime
    ordinal = datetime.date(int(day[:4]), int(day[5:7]), int(day[8:])).toordinal()
    picked = {i for i in links if i not in dead and bucket(i, 7) == ordinal % 7}
    picked |= {i for i in state["strikes"] if i in links}             # failed last time: ask again
    picked |= {i for i in dead if i in links and bucket(i, 28) == ordinal % 28}   # gone: ask again once in four weeks
    picked |= {x["id"] for xs in live["links"].values() for x in xs if x["id"] not in dead and x.get("added", "") >= _days_ago(day, 3)}
    return sorted(picked)


def _days_ago(day, k):
    import datetime
    return (datetime.date(int(day[:4]), int(day[5:7]), int(day[8:])) - datetime.timedelta(days=k)).isoformat()


def main():
    dry, everything = "--dry" in sys.argv, "--all" in sys.argv
    base, live, state = C.load_base(), C.load_live(), C.load_state()
    day = C.today()
    if not everything and state.get("checked", {}).get("day") == day:
        print("today's share was already checked")
        return
    ids = todays_ids(base, live, state, day, everything)
    print("checking %d of %d links" % (len(ids), len(C.all_links(base, live))))
    changes, touched = check(base, live, state, ids)
    if changes is None:
        sys.exit(3)
    pool = C.load_json(C.POOL, {})
    need = touched | {int(n) for n in state["need"]}
    changes += replace(base, live, state, pool, need)
    for n, since in list(state["need"].items()):  # stop asking the pool after 45 days; sync_new.py may still find an upload
        if since < _days_ago(day, 45):
            del state["need"][n]
    for c in changes:
        C.log(state, c)
    waiting = len(state["strikes"])
    print("%d change(s); %d link(s) failed once and will be asked again; %d retired in all" % (len(changes), waiting, len(live["dead"])))
    state["checked"] = {"day": day, "links": len(ids)}
    live["checked"] = day
    if changes:
        live["updated"] = C.stamp()
    if not dry:
        C.save_json(C.LIVE, live)
        C.save_json(C.STATE, state)


if __name__ == "__main__":
    main()
