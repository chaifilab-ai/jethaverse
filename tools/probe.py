"""Can this machine read what the automation needs from YouTube? Prints four answers and changes nothing.

Run from the project folder:   python tools/probe.py
Exit code 0 = everything the job relies on works, 1 = at least one does not (the line says which).

The scheduled job runs this on manual runs only, so a look at the log tells whether a quiet week means
"nothing new" or "YouTube stopped answering this machine".
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import live_common as C


def main():
    bad = 0
    items = C.feed(C.CHANNELS[0]["id"])
    print("upload feed:      " + ("%d uploads read" % len(items) if items else "NOT readable"))
    if not items:
        return 1
    vid = items[0]["id"]
    secs = C.lengths(C.CHANNELS[0]["id"])
    known = sum(1 for i in items if i["id"] in secs)
    print("playlist pages:   %d lengths read, covering %d of the feed's %d uploads" % (len(secs), known, len(items)))
    if not known:
        bad = 1
    got = C.video_info(vid)
    if got["seconds"] and got["desc"]:
        print("video page:       length %d s and description read (%s)" % (got["seconds"], vid))
    else:  # normal on cloud servers; the playlist pages above are what the job relies on there
        print("video page:       not readable here (status %r) for %s; lengths come from the playlist pages"
              % (got["status"], vid))
    status = C.link_status(vid)
    fake = C.link_status("AAAAAAAAAAA")
    print("link check:       newest upload answers %r, a made-up id answers %r" % (status, fake))
    if status != "ok" or fake != "gone":
        bad = 1
    return bad


if __name__ == "__main__":
    sys.exit(main())
