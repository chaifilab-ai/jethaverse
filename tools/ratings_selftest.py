"""Does the real ratings database refuse cheating? Run after publishing database.rules.json, and after any change to it.

Run from the project folder:   python tools/ratings_selftest.py
Exit code 0 = every honest rating was accepted and every cheat was refused.

It reads the database's address from js/ratings.js (SITE), makes two throwaway anonymous visitors, and rates the
made-up episode 99999 (the app has no such episode, so nobody ever sees these test ratings). Each run adds two
anonymous users and leaves that one test total behind; visitors cannot delete ratings, which is the point.
"""
import json, os, re, sys, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EP = "99999"


def site():
    with open(os.path.join(ROOT, "js", "ratings.js"), encoding="utf-8") as f:
        m = re.search(r'var SITE = \{ apiKey: "([^"]*)", db: "([^"]*)" \};', f.read())
    if not m or not m.group(1) or not m.group(2):
        sys.exit("js/ratings.js names no database yet (SITE is empty): nothing to test.")
    return m.group(1), m.group(2).rstrip("/")


def call(method, url, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, None


def main():
    key, db = site()
    bad = []

    def visitor():
        status, r = call("POST", "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + urllib.parse.quote(key), {"returnSecureToken": True})
        if status != 200:
            sys.exit("could not get an anonymous visitor (answer %s): is Anonymous sign-in switched on in Firebase?" % status)
        return r["localId"], "?auth=" + urllib.parse.quote(r["idToken"])

    def total():
        status, a = call("GET", db + "/agg/" + EP + ".json")
        assert status == 200, status
        return (a or {}).get("s", 0), (a or {}).get("c", 0)

    def expect(name, want_ok, status):
        ok = (status == 200) == want_ok
        print("  %-4s %s (answer %s)" % ("ok" if ok else "BAD", name, status))
        if not ok:
            bad.append(name)

    def write(auth, change):
        return call("PATCH", db + "/.json" + auth, change)[0]

    (u1, a1), (u2, a2) = visitor(), visitor()
    s, c = total()
    print("before: sum %s from %s ratings" % (s, c))

    print("a stranger with no id:")
    expect("cannot read the whole database", False, call("GET", db + "/.json")[0])
    expect("cannot read anyone's vote", False, call("GET", db + "/votes/" + EP + "/" + u1 + ".json")[0])
    expect("cannot write a total", False, write("", {"agg/" + EP: {"s": s + 5, "c": c + 1}}))
    expect("can read the totals", True, call("GET", db + "/agg.json")[0])

    print("visitor 1, cheating before they have voted:")
    expect("a total without a vote", False, write(a1, {"agg/" + EP: {"s": s + 5, "c": c + 1}}))
    expect("a vote without a total", False, write(a1, {"votes/" + EP + "/" + u1: 5}))
    expect("6 stars", False, write(a1, {"agg/" + EP: {"s": s + 6, "c": c + 1}, "votes/" + EP + "/" + u1: 6}))
    expect("0 stars", False, write(a1, {"agg/" + EP: {"s": s, "c": c + 1}, "votes/" + EP + "/" + u1: 0}))
    expect("half a star", False, write(a1, {"agg/" + EP: {"s": s + 2.5, "c": c + 1}, "votes/" + EP + "/" + u1: 2.5}))
    expect("one vote counted twice", False, write(a1, {"agg/" + EP: {"s": s + 10, "c": c + 2}, "votes/" + EP + "/" + u1: 5}))
    expect("one vote worth more than its stars", False, write(a1, {"agg/" + EP: {"s": s + 50, "c": c + 1}, "votes/" + EP + "/" + u1: 5}))
    expect("voting as somebody else", False, write(a1, {"agg/" + EP: {"s": s + 5, "c": c + 1}, "votes/" + EP + "/" + u2: 5}))
    expect("an extra field in the total", False, write(a1, {"agg/" + EP: {"s": s + 5, "c": c + 1, "x": 1}, "votes/" + EP + "/" + u1: 5}))
    expect("an episode that is not a number", False, write(a1, {"agg/abc": {"s": 5, "c": 1}, "votes/abc/" + u1: 5}))
    expect("writing somewhere else", False, write(a1, {"notes/x": "hello"}))

    print("visitor 1, honestly:")
    expect("first rating, 5 stars", True, write(a1, {"agg/" + EP: {"s": s + 5, "c": c + 1}, "votes/" + EP + "/" + u1: 5}))
    expect("their own vote can be read back", True, call("GET", db + "/votes/" + EP + "/" + u1 + ".json" + a1)[0])
    expect("visitor 2 cannot read it", False, call("GET", db + "/votes/" + EP + "/" + u1 + ".json" + a2)[0])
    expect("changing it to 2 stars", True, write(a1, {"agg/" + EP: {"s": s + 2, "c": c + 1}, "votes/" + EP + "/" + u1: 2}))

    print("visitor 1, cheating after voting:")
    expect("counting a second vote", False, write(a1, {"agg/" + EP: {"s": s + 6, "c": c + 2}, "votes/" + EP + "/" + u1: 4}))
    expect("moving the total, keeping the vote", False, write(a1, {"agg/" + EP: {"s": s + 5, "c": c + 1}}))
    expect("moving the vote, keeping the total", False, write(a1, {"votes/" + EP + "/" + u1: 5}))
    expect("deleting their vote", False, write(a1, {"votes/" + EP + "/" + u1: None}))
    expect("deleting the total", False, write(a1, {"agg/" + EP: None}))
    expect("deleting both", False, write(a1, {"agg/" + EP: None, "votes/" + EP + "/" + u1: None}))

    print("visitor 2, honestly:")
    expect("first rating, 4 stars", True, write(a2, {"agg/" + EP: {"s": s + 6, "c": c + 2}, "votes/" + EP + "/" + u2: 4}))

    s2, c2 = total()
    print("after:  sum %s from %s ratings (expected %s from %s)" % (s2, c2, s + 6, c + 2))
    if (s2, c2) != (s + 6, c + 2):
        bad.append("the total after the run")
    print("ALL GOOD" if not bad else "%d PROBLEM(S): %s" % (len(bad), "; ".join(bad)))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
