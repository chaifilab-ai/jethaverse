# JethaVerse (formerly Jethiya, Gokuldham Guide): spec (v2)

An **unofficial fan guide** to *Taarak Mehta Ka Ooltah Chashmah* (TMKOC). It helps a fan find the episode they're thinking of and press play.

## Purpose and users

- **Who:** TMKOC fans, mostly on phones.
- **What they need:** find episodes by who is in them ("Jethalal and Goli"), by what happens ("garba", "bomb scare"), or let the app pick one. Keep track of what they've watched or want to watch.
- **Devices:** phone 360px, tablet 768px, desktop 1280px+. Hindi names typed in Devanagari also work.

## Screen and flows

One screen, plus a sheet.

1. **Home.**
   - A search box.
   - **Gokuldham Society:** a building with 12 windows, one per character (Bapuji, Popatlal, Goli, Abdul, Jethalal, Daya, Tapu, Bagha, Bhide, Iyer, Babita, Sodhi). Tapping a window lights it and adds the name to the search box. Typing a name lights its window. Each window shows how many stories name that character.
   - **Lift panel:** the story count, a filter (All / To watch / Watched / Saved) and the result cards. The count rolls to each new number and the lift doors close and open when the list changes.
   - On a phone the building starts folded away (only the lit names show as chips under the search box). "Show windows" opens it. On screens 900px and wider the building and search sit on the left and the results on the right.
   - Night mode turns the building to night.
2. **Episode sheet.** A bottom sheet on a phone and a side drawer on a wide screen. The Watch button comes first, then Watched and Save, then the story, key moments and who's in it (Episodes 1-50), other places to watch, and previous / next.
3. **Surprise me.** The dice button picks a random episode from the current results, preferring ones not watched yet. The number rolls like an odometer, then the sheet opens.

Primary journey: open, type or tap names, scan cards, open an episode, watch on YouTube, mark it watched.

## Data model

| Entity | Fields | Source | Operations |
|---|---|---|---|
| Episode | n, title, synopsis, cast[], maybe[], castBy, videoId, channel, minutes, watch[], check?; Episodes 1-50 also summary, events[], arcs[], note? | `data/episodes.js` (built by `tools/build_data.py` from SonyLIV text, `research/` and the pipeline) | read only |
| Character | name, about, aliases[] (English and Hindi), family | same | read only |
| Watched set | episode numbers | `localStorage["gokuldham.watched.v1"]` | add / remove; "Clear watched list" asks to tap twice |
| Saved set | episode numbers | `localStorage["gokuldham.saved.v1"]` | add / remove; same clear |
| Night mode | true / false | `localStorage["gokuldham.night.v1"]` | toggle |
| View state | q, filter, open episode | URL hash (not in the hosted page) | read / write |

## Auth and roles

None. No backend, login or personal data. Watched, saved and night mode stay in this browser only.

## Stack

- Static HTML + CSS + vanilla JS. No build step for the app itself; `tools/build_data.py` builds the data and `tools/build_artifact.py` the hosted page.
- Fonts from Google Fonts (Anton, Hind), with system fallbacks. No other third-party scripts.

## Acceptance criteria (done when ...)

1. **Names.** "Jethalal Goli", typed or made by lighting both windows, gives the same list: every episode naming both. It includes Episodes 38, 65, 233 and 882, and Episode 38 comes first.
2. **Windows and box agree.** Lighting a window adds its name to the box. Typing a name, a nickname or a Hindi name lights its window. Removing a name (in the box, on its chip or by tapping its window again) switches the window off.
3. **Topics.** `ganpati` finds Ganesh Utsav episodes, `garba` finds Navratri, `bapuji` is read as Champaklal, `jethlal` as Jethalal, and Devanagari names work. A word no story mentions (for example "Jethalal zzqx") is named in a notice, and the closest stories are shown.
4. **Episode sheet.** The Watch button is first. Other uploads are listed with their quality. The 52 episodes with no free upload say so and link to SonyLIV (Premium). The 436 links whose own description fits a neighbouring number better carry a short warning.
5. **Surprise me** picks from the current results, prefers unwatched ones, and opens an episode in about 1.5 s (instantly with reduced motion).
6. **Watched and Saved** survive a reload. The filter row and the cards show them at once.
7. **Layout.** Every view works at 360, 375, 768 and 1280 with no sideways page scroll. Touch targets are at least 44px. The keyboard alone can search (`/`), pick (`S`), open, step through episodes (`<-` `->`) and close (`Esc`).
8. **States.** Loading (skeleton), empty (with Jethalal), error with a retry button, and populated all exist.
9. **Motion.** `prefers-reduced-motion` turns off non-essential motion.
10. **Speed.** Typing waits 90 ms, then searches all 4,872 episodes in well under 100 ms on a laptop.
11. **Staying current (v3.5).** A new episode is in the guide within a few hours of its first upload on the official channel, with its number, title, synopsis and air date. While only the 10-minute highlights exist it says "highlights only" and never calls them the episode; the full upload takes over by itself when it arrives.
12. **Dead links (v3.5).** A link that is gone from YouTube stops being shown within about 8 days and the episode's next link, or a spare full-length upload, takes its place. One bad answer, a network error or a broken run never removes a link.
19. **Share, continue, back up (v3.12).** Share sends "Episode N: title" and a link that opens that episode. The Episodes list shows a Continue card after the last episode marked watched. My list has Copy backup and Restore; a restore adds to the phone's lists, never removes, and refuses text that is not a backup code.
18. **Picking characters (v3.11).** After a pick, a window that would leave nothing is greyed and cannot be added: tapping it explains why and changes nothing. The small numbers are explained once. Typing names that no episode has together still shows the closest matches.
17. **Recommended list (v3.10).** With episodes in `data/best.js`: a Recommended chip in the Episodes filter row, a "★ Best" badge on those episodes' cards and sheets, and the chip combines with the search; with the list empty none of it shows. A wrong number fails `npm test`.
16. **Get in touch (v3.8).** A tab of its own with the Jethalal picture, "Born out of love for Jethalal ♥", "Get in touch:" and a working email link, and all the other characters in one row of equal height at the bottom; one screen with no scrolling on phones 640 px tall and up. The makers' small print sits at the bottom of the Episodes list only.
15. **Installable (v3.7).** On Android Chrome the website can be installed from the browser menu or the in-app install button, shows the logo as its icon, opens full screen, and opens with no connection after the first visit (episode list, search and pictures work; videos and new updates need the internet).
14. **Ratings (v3.6).** With a database named: tapping a star in the sheet saves it within a few seconds, the average and count update, and the card shows the average. A failed save puts the old stars back and says so. With no database named, nothing about ratings is shown anywhere.
13. **No hand work (v3.5).** Once hosted, both happen without anyone opening the project, and a phone that already has the guide (website or one-file version) shows the changes the next time it is opened online.

## Out of scope for v2

- Summaries, key moments and a hand-checked cast for Episodes 51 and up. The cast comes from SonyLIV's text and, where a video has captions, the names spoken in them. It is a best guess (docs/QA.md says how often it is right).
- An in-page video player. "Watch" opens YouTube.
- Real air dates (SonyLIV's early dates are all a placeholder), story arcs and the story strip beyond Episodes 1-50.
- Accounts, sync across devices, comments and ratings.
- Hosting or publishing. This uses the show's name and caricatures of a real actor, so the owner decides whether and where it goes public.
