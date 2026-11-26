"""The automation's rules (tools/live_common.py, sync_new.py, check_links.py), with YouTube faked.
Run:  python -m unittest tests.test_live      (from the project folder)"""
import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import live_common as C
import sync_new, check_links

A, B, D, E, F, G = "aaaaaaaaaaa", "bbbbbbbbbbb", "ddddddddddd", "eeeeeeeeeee", "fffffffffff", "ggggggggggg"


def base():
    def w(i, label="Sony PAL", minutes=21, note=""):
        return {"label": label, "note": note, "url": C.watch_url(i), "id": i, "quality": "", "minutes": minutes}
    return {"episodes": [
        {"n": 601, "title": "Sodhi Is Unwell", "synopsis": "Sodhi has a severe stomach ache and is examined by Dr. Hathi before the picnic.", "watch": [w(A), w(B, "Sony SAB")]},
        {"n": 602, "title": "The Hospital Scare", "synopsis": "Bhide rushes Sodhi to hospital for a scan after he swallowed broken glass at a party.", "watch": [w(D)]},
        {"n": 4876, "title": "A Misunderstanding Gives Popatlal Hope", "synopsis": "Popatlal overhears Bhide and thinks he is searching for a bride.", "watch": []},
    ]}


def fresh():
    return {"v": 1, "updated": "", "dead": [], "links": {}, "episodes": {}}, {"seen": {}, "strikes": {}, "need": {}, "log": []}


def info(seconds, desc=""):
    return lambda vid: {"seconds": seconds, "title": "", "desc": desc, "published": "2026-11-25T15:30:02+00:00", "status": "OK"}


class Titles(unittest.TestCase):
    def test_real_titles(self):
        p = C.parse_title("official", "SE 02 EP 605 - Iyer Ko कहाँ से मिली Jethalal Ka मज़ेदार Photo ! | Taarak Mehta Ka Ooltah Chashmah")
        self.assertEqual((p["n"], p["kind"], p["sure"]), (605, "full", True))
        p = C.parse_title("official", "NEW! Ep 4877 - क्या Popatlal Time Par लगा पाएगा दिया ! | Taarak Mehta ka Ooltah  Chashmah")
        self.assertEqual((p["n"], p["kind"], p["name"]), (4877, "highlights", "क्या Popatlal Time Par लगा पाएगा दिया!"))
        p = C.parse_title("official", "FULL EPISODE 4858 - Kisne Roka Popat Ko Navratri Ki Aarti Karne Se !| Taarak Mehta ka Ooltah Chasmah")
        self.assertEqual((p["n"], p["kind"], p["sure"], p["name"]), (4858, "full", True, "Kisne Roka Popat Ko Navratri Ki Aarti Karne Se!"))
        p = C.parse_title("sab", "Jethalal's Relief Is Short-Lived | Taarak Mehta Ka Ooltah Chashmah | Full Episode 4846 | 20 Oct 2026")
        self.assertEqual((p["n"], p["kind"], p["name"], p["aired"]), (4846, "full", "Jethalal's Relief Is Short-Lived", "2026-10-20"))
        p = C.parse_title("sab", "NEW! Taarak Mehta Ka Ooltah Chashmah | Ep 4877 | 25 Nov 2026 | Teaser")
        self.assertEqual((p["n"], p["kind"], p["name"], p["aired"]), (4877, "highlights", "", "2026-11-25"))

    def test_left_out(self):
        for ch, t in [
            ("official", "PRECAP! 4878 | Taarak Mehta Ka Ooltah Chashmah | तारक मेहता का उल्टा चश्मा"),
            ("official", "Latest Episode ! 4877 #tmkoc #comedy #latestepisode #jethalal"),
            ("official", "Jethalal Ne Babitaji Ko Kyu Bola Item ! | Haste Raho Hasate Raho! | Taarak Mehta ka Ooltah Chashmah"),
            ("sab", "Taarak Mehta Ka Ooltah Chashmah | तारक मेहता | Ep 4878 | Coming Up Next"),
            ("sab", "Pushpa's Growing Worries | Pushpa Impossible | Ep 1372 | Full Episode | 24 Oct 2026"),  # another show
            ("pal", "Bhide को Tuition Enquiry की Call ने किया Confuse! | Taarak Mehta Ka Ooltah Chashmah | 25 Nov 2026"),  # no number
        ]:
            self.assertIsNone(C.parse_title(ch, t), t)

    def test_length_decides(self):
        full = {"kind": "full", "sure": True}
        new = {"kind": "highlights", "sure": False}
        self.assertEqual(C.decide_kind(full, 1200), "full")
        self.assertIsNone(C.decide_kind(full, 420))            # says "full episode" but is 7 minutes: left out
        self.assertEqual(C.decide_kind(new, 615), "highlights")
        self.assertEqual(C.decide_kind(new, 1300), "full")     # the length wins over the wording
        self.assertIsNone(C.decide_kind(full, 3 * 3600))       # a marathon
        self.assertEqual(C.decide_kind(full, 0), "full")       # length unreadable: only a title that says "full" is trusted
        self.assertIsNone(C.decide_kind({"kind": "full", "sure": False}, 0))

    def test_lengths_from_a_playlist_page(self):
        row = ('{"url":"https://i.ytimg.com/vi/%s/hqdefault.jpg?sqp=x","width":336}]},"overlays":[{"thumbnailBottomOverlayViewModel":'
               '{"badges":[{"thumbnailBadgeViewModel":{"text":"%s","badgeStyle":"X"}}]}}]')
        page = row % ("AAAAAAAAAAA", "19:42") + row % ("BBBBBBBBBBB", "1:02:03") + row % ("CCCCCCCCCCC", "0:41")
        self.assertEqual(C.parse_lengths(page), {"AAAAAAAAAAA": 1182, "BBBBBBBBBBB": 3723, "CCCCCCCCCCC": 41})
        self.assertEqual(C.parse_lengths("nothing here"), {})
        old = '{"playlistVideoRenderer":{"videoId":"DDDDDDDDDDD","thumbnail":{},"title":{"runs":[{"text":"x"}]},"lengthSeconds":"1260","isPlayable":true}}'
        self.assertEqual(C.parse_lengths(old + old.replace("DDDDDDDDDDD", "EEEEEEEEEEE").replace("1260", "600")),
                         {"DDDDDDDDDDD": 1260, "EEEEEEEEEEE": 600})

    def test_descriptions(self):
        official = ("Click here to Subscribe to Taarak Mehta Ka Ooltah Chashmah Official Channel: https://www.youtube.com/x\n\n"
                    "Popatlal rushes to Abdul's store to buy matches, but gets delayed by another customer.\n\n"
                    "Step into Jethalal's world with Gada Electronics!  Manage the shop.\n\nPlay now: https://g.page.link/x")
        self.assertEqual(C.synopsis_from("official", official, 4877), ("", "Popatlal rushes to Abdul's store to buy matches, but gets delayed by another customer."))
        sab = ("Saare episodes sirf :\nhttps://www.sonyliv.com/x\n\nClick here to subscribe to SAB: https://y\n\n"
               "Episode 4858: Is Vishwasur Really Genuine?\n--------------------------------------\n"
               "Vishwasur arrives in Gokuldham, but his actions disappoint residents.\n\nShow Name – Taarak Mehta Ka Ooltah Chashmah")
        self.assertEqual(C.synopsis_from("sab", sab, 4858), ("Is Vishwasur Really Genuine?", "Vishwasur arrives in Gokuldham, but his actions disappoint residents."))
        self.assertEqual(C.synopsis_from("sab", sab, 4859), ("", ""))  # the text is about another episode: not used

    def test_story_check(self):
        text_of = {e["n"]: e["title"] + " " + e["synopsis"] for e in base()["episodes"]}
        glass = "Sodhi swallowed broken glass at the party, Bhide takes him to hospital for a scan"
        self.assertEqual(C.story_verdict(glass, 601, text_of), "shifted")
        self.assertEqual(C.story_verdict(glass, 602, text_of), "match")
        self.assertEqual(C.story_verdict("", 601, text_of), "no text")


class Sync(unittest.TestCase):
    def test_full_upload_of_a_known_episode_is_added_as_a_backup(self):
        live, st = fresh()
        feeds = {"official": [{"id": E, "title": "SE 02 EP 601 - Sodhi Ko Hua Pet Dard | Taarak Mehta Ka Ooltah Chashmah", "desc": "", "published": ""}]}
        ch = sync_new.sync(base(), live, st, feeds, info=info(1260, "Sodhi has a severe stomach ache; Dr. Hathi examines him before the picnic."), day="2026-11-26")
        self.assertEqual(len(ch), 1)
        self.assertEqual(live["links"]["601"], [{"id": E, "label": "Official channel", "kind": "full", "minutes": 21, "added": "2026-11-26"}])
        self.assertEqual(sync_new.sync(base(), live, st, feeds, info=info(1260)), [])  # the same upload is not added twice

    def test_new_episode_then_full_episode_takes_over_the_title(self):
        live, st = fresh()
        feeds = {"official": [{"id": E, "title": "NEW! Ep 4877 - क्या Popatlal Time Par लगा पाएगा दिया ! | Taarak Mehta ka Ooltah  Chashmah",
                               "desc": "Click here to Subscribe: https://x\n\nPopatlal rushes to Abdul's store to buy matches, but gets delayed by another customer.",
                               "published": "2026-11-25T15:30:02+00:00"}]}
        sync_new.sync(base(), live, st, feeds, info=info(615), day="2026-11-26")
        ep = live["episodes"]["4877"]
        self.assertEqual(ep["title"], "क्या Popatlal Time Par लगा पाएगा दिया!")
        self.assertEqual(ep["aired"], "2026-11-25")
        self.assertEqual(ep["cast"], ["Popatlal", "Abdul"])
        self.assertEqual(live["links"]["4877"][0]["kind"], "highlights")
        sab = "Click here: https://y\n\nEpisode 4877: Popatlal's Race Against Time\n----------------------\nPopatlal hurries to light the lamp in time.\n\nShow Name"
        feeds = {"sab": [{"id": F, "title": "Popatlal's Race Against Time | Taarak Mehta Ka Ooltah Chashmah | Full Episode 4877 | 25 Nov 2026", "desc": sab, "published": ""}]}
        sync_new.sync(base(), live, st, feeds, info=info(1230), day="2026-12-16")
        ep = live["episodes"]["4877"]
        self.assertEqual((ep["title"], ep["synopsis"]), ("Popatlal's Race Against Time", "Popatlal hurries to light the lamp in time."))
        self.assertEqual([x["kind"] for x in live["links"]["4877"]], ["highlights", "full"])

    def test_guards(self):
        live, st = fresh()
        feeds = {"official": [
            {"id": E, "title": "NEW! Ep 9999 - Kuch Bhi | Taarak Mehta", "desc": "", "published": ""},          # far past the newest number
            {"id": F, "title": "NEW! Ep 601 - Purana Clip | Taarak Mehta", "desc": "", "published": ""},        # highlights of an episode that has a full link
        ], "pal": [{"id": G, "title": "Taarak Mehta Ka Ooltah Chashmah | Full Episode 4880", "desc": "", "published": ""}]}  # Sony PAL may not create numbers
        self.assertEqual(sync_new.sync(base(), live, st, feeds, info=info(600)), [])
        self.assertEqual((live["links"], live["episodes"]), ({}, {}))

    def test_highlights_fill_an_episode_with_no_video(self):
        live, st = fresh()
        feeds = {"official": [{"id": E, "title": "NEW! Ep 4876 - Mahila Mandal Ka Plan | Taarak Mehta", "desc": "", "published": ""}]}
        sync_new.sync(base(), live, st, feeds, info=info(535))
        self.assertEqual(live["links"]["4876"][0]["kind"], "highlights")
        self.assertEqual(live["episodes"], {})  # the guide already had this number: its title and synopsis stay


class Check(unittest.TestCase):
    def test_two_days_of_gone_retire_a_link(self):
        live, st = fresh()
        gone = lambda vid: "gone" if vid == A else "ok"
        ch, touched = check_links.check(base(), live, st, [A, B, D], status=gone, day="2026-11-26")
        self.assertEqual((ch, live["dead"], st["strikes"][A]["n"]), ([], [], 1))
        check_links.check(base(), live, st, [A], status=gone, day="2026-11-26")      # the same day again does not count twice
        self.assertEqual((live["dead"], st["strikes"][A]["n"]), ([], 1))
        ch, touched = check_links.check(base(), live, st, [A], status=gone, day="2026-11-27")
        self.assertEqual((live["dead"], touched, st["strikes"]), ([A], {601}, {}))

    def test_one_bad_day_is_forgotten_and_no_answer_changes_nothing(self):
        live, st = fresh()
        check_links.check(base(), live, st, [A], status=lambda v: "gone", day="2026-11-26")
        check_links.check(base(), live, st, [A], status=lambda v: "unknown", day="2026-11-27")
        self.assertEqual(st["strikes"][A]["n"], 1)
        check_links.check(base(), live, st, [A], status=lambda v: "ok", day="2026-11-28")
        self.assertEqual((st["strikes"], live["dead"]), ({}, []))

    def test_a_run_where_everything_is_gone_is_not_believed(self):
        big = {"episodes": [{"n": i + 1, "title": "t", "synopsis": "s", "watch": [{"id": "x%010d" % i, "label": "Sony PAL", "minutes": 21}]} for i in range(60)]}
        live, st = fresh()
        ch, _ = check_links.check(big, live, st, [e["watch"][0]["id"] for e in big["episodes"]], status=lambda v: "gone", day="2026-11-26")
        self.assertIsNone(ch)
        self.assertEqual((st["strikes"], live["dead"]), ({}, []))

    def test_a_revived_link_comes_back(self):
        live, st = fresh()
        live["dead"] = [A]
        ch, touched = check_links.check(base(), live, st, [A], status=lambda v: "ok", day="2026-12-20")
        self.assertEqual((live["dead"], touched), ([], {601}))

    def test_replacement_only_when_no_full_length_link_is_left(self):
        live, st = fresh()
        pool = {"601": [["official", E, 20]], "602": [["sab", G, 9], ["official", F, 20]]}
        live["dead"] = [A]  # 601 still has its Sony SAB backup
        self.assertEqual(check_links.replace(base(), live, st, pool, {601}, status=lambda v: "ok", info=info(1200)), [])
        live["dead"] = [A, D]  # 602 has nothing left
        ch = check_links.replace(base(), live, st, pool, {601, 602}, status=lambda v: "ok" if v == F else "gone", info=info(1210), day="2026-11-27")
        self.assertEqual(len(ch), 1)
        self.assertEqual(live["links"]["602"][0]["id"], F)
        self.assertEqual(live["links"]["602"][0]["note"], "replacement")
        self.assertEqual(st["need"], {})

    def test_nothing_in_the_pool_is_remembered_for_later(self):
        live, st = fresh()
        live["dead"] = [D]
        ch = check_links.replace(base(), live, st, {}, {602}, status=lambda v: "ok", info=info(1200), day="2026-11-27")
        self.assertEqual(st["need"], {"602": "2026-11-27"})
        self.assertEqual(len(ch), 1)

    def test_every_link_is_checked_within_a_week(self):
        b, (live, st) = base(), fresh()
        seen = set()
        for d in range(1, 8):
            seen |= set(check_links.todays_ids(b, live, st, "2026-12-%02d" % d))
        self.assertEqual(seen, {A, B, D})


if __name__ == "__main__":
    unittest.main()
