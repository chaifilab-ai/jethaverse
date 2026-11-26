"""Find new Taarak Mehta uploads on YouTube and add them to the guide (data/live.json).

Run from the project folder:   python tools/sync_new.py            (add --deep 150 to look further back, needs yt-dlp;
                                                                    add --dry to print what it would do and save nothing)

What it reads: the upload feeds of the official show channel, Sony SAB and Sony PAL (see tools/live_common.py).
What it does with an upload whose title names an episode number:
  * a full-length video (15+ minutes) of an episode the guide already has  -> one more place to watch it; it becomes the
    main link only when the episode had no full-length link
  * the official "NEW! Ep 4877 - ..." video of an episode the guide does not have yet -> a new episode: number, the
    channel's own title, the synopsis from the description, the air date, who is in it, and the 10-minute highlights
    video (marked as highlights: the channels put the full episode up about a month later)
  * the Sony SAB "... | Full Episode 4877 | 25 Nov 2026" video, when it arrives -> the full-length link takes over and
    the title and synopsis switch to Sony's English ones
Everything else (Shorts, precaps, "coming up next", compilations, clips without a number) is left out.
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import live_common as C
from characters import detect_cast

LABEL = {c["key"]: c["label"] for c in C.CHANNELS}
ORDER = {"official": 0, "sab": 1, "pal": 2}
MAX_LOOKUPS = 60  # video pages read per run, to stay gentle


def sync(base, live, state, feeds, info=C.video_info, day=None):
    """feeds: {channel key: [{"id", "title", "desc", "published", "seconds"?}, ...]}. Changes `live` and `state` in place.
    Returns the list of changes, as sentences."""
    day = day or C.today()
    eps = {e["n"]: e for e in base["episodes"]}
    text_of = {n: e["title"] + " " + (e.get("synopsis") or "") for n, e in eps.items()}
    for n, e in live["episodes"].items():
        text_of[int(n)] = e["title"] + " " + (e.get("synopsis") or "")
    known = set(C.all_links(base, live)) | set(live["dead"])
    top = max(list(eps) + [int(n) for n in live["episodes"]])
    changes, lookups = [], 0

    todo = []
    for key, items in feeds.items():
        for it in items or []:
            if it["id"] in known or it["id"] in state["seen"]:
                continue
            p = C.parse_title(key, it["title"])
            if p:
                todo.append((p["n"], ORDER[key], key, it, p))
    todo.sort(key=lambda x: x[:2])

    for n, _, key, it, p in todo:
        vid = it["id"]
        if vid in known:
            continue
        is_new = n not in eps
        if is_new and str(n) not in live["episodes"] and not (key in ("official", "sab") and top < n <= top + C.NEW_AHEAD):
            continue  # a number the guide has never heard of and that is not "the next ones": most likely not an episode number
        if lookups >= MAX_LOOKUPS:
            break
        seconds, desc, published = it.get("seconds") or 0, it.get("desc") or "", it.get("published") or ""
        if not seconds or not desc:
            lookups += 1
            got = info(vid)
            seconds, desc, published = seconds or got["seconds"], desc or got["desc"], published or got["published"]
        kind = C.decide_kind(p, seconds)
        if not kind:
            if seconds:  # really too short or too long: never look at it again. No length read = try again next run.
                state["seen"][vid] = day
            continue
        minutes = round(seconds / 60) if seconds else 0
        sab_title, synopsis = C.synopsis_from(key, desc, n)
        link = {"id": vid, "label": LABEL[key], "kind": kind, "minutes": minutes, "added": day}

        if not is_new:
            has_full = bool(C.full_links(eps[n], live, n))
            mine = live["links"].setdefault(str(n), [])
            if kind == "highlights":
                if has_full or any(x["kind"] == "highlights" and x["label"] == link["label"] for x in mine):
                    state["seen"][vid] = day
                    if not mine:
                        del live["links"][str(n)]
                    continue
            elif C.story_verdict(p["name"] + " " + synopsis, n, text_of) == "shifted":
                link["check"] = 1
            mine.append(link)
            known.add(vid)
            changes.append("Episode %d: %s from %s added%s" % (
                n, "full-length link" if kind == "full" else "highlights", LABEL[key],
                "" if has_full or kind != "full" else " (now the main link)"))
            continue

        ep = live["episodes"].get(str(n))
        fresh = ep is None
        if fresh:
            ep = live["episodes"][str(n)] = {"title": "", "synopsis": "", "aired": "", "cast": [], "added": day}
            top = max(top, n)
        placeholder = not ep["title"] or ep["title"] == "Episode %d" % n
        if key == "sab" and kind == "full" and (sab_title or p["name"]):
            ep["title"] = sab_title or p["name"]  # Sony's English title, the same wording as the rest of the guide
            if synopsis:
                ep["synopsis"] = synopsis
        else:
            if placeholder and p["name"]:
                ep["title"] = p["name"]
            if not ep["synopsis"] and synopsis:
                ep["synopsis"] = synopsis
        if not ep["title"]:
            ep["title"] = "Episode %d" % n
        if not ep["aired"]:
            ep["aired"] = p["aired"] or (C.aired_from_published(published) if kind == "highlights" else "")
        ep["cast"] = detect_cast(ep["title"] + " " + ep["synopsis"])
        text_of[n] = ep["title"] + " " + ep["synopsis"]
        live["links"].setdefault(str(n), []).append(link)
        known.add(vid)
        changes.append(("New episode %d added: %s (%s from %s)" if fresh else "Episode %d: %s (%s from %s) added") % (
            n, ep["title"], "full-length link" if kind == "full" else "highlights", LABEL[key]))

    for c in changes:
        C.log(state, c)
    if changes:
        live["updated"] = C.stamp()
    return changes


def main():
    deep = int(sys.argv[sys.argv.index("--deep") + 1]) if "--deep" in sys.argv else 0
    dry = "--dry" in sys.argv
    base, live, state = C.load_base(), C.load_live(), C.load_state()
    feeds, failed = {}, []
    for ch in C.CHANNELS:
        items = C.feed(ch["id"])
        if items is None:
            failed.append(ch["label"])
            items = []
        if deep:
            have = {i["id"] for i in items}
            items += [i for i in C.deep_list(ch["id"], deep) if i["id"] not in have]
        feeds[ch["key"]] = items
        print("%-16s %3d uploads read" % (ch["label"], len(items)))
    before = (len(live["links"]), len(live["episodes"]), len(state["seen"]))
    changes = sync(base, live, state, feeds)
    print("%d change(s)" % len(changes))
    if not dry and (changes or before != (len(live["links"]), len(live["episodes"]), len(state["seen"])) or not os.path.exists(C.LIVE)):
        C.save_json(C.LIVE, live)
        C.save_json(C.STATE, state)
    if failed:
        print("could not read:", ", ".join(failed))
    if len(failed) == len(C.CHANNELS):
        sys.exit(2)  # nothing could be read at all: make the run show as failed


if __name__ == "__main__":
    main()
