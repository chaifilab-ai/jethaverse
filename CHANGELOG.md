# Changelog

All notable changes to Gokuldham Guide. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.7.0] — 2026-11-26

Installable app, with the JethaVerse logo (the pink shirt in the navy stitched circle).

### Added

- **Install it as an app.** On Android, Chrome offers "Install app" for https://jethaverse.com (menu, or the small install button in the top bar of the home screen); it then sits in the app drawer with the logo and opens full screen with no browser bar. On iPhone: Share, then Add to Home Screen (the page says so at the end of the list).
- **Opens with no connection.** `sw.js` (from `tools/sw.js`) keeps a copy of the whole site on the phone after the first visit: page, scripts, the episode list, the pictures. New episodes and replaced links still arrive when it is online; videos still need the internet. A new version of the site is fetched in the background and shows on the visit after.
- **The logo everywhere:** the app icon (plain and Android-cropped versions, iPhone home-screen icon), the browser-tab icon, and the picture WhatsApp shows when the link is shared. `tools/make_icons.py` cuts them out of `assets/icons/logo-source.png`.

### Changed

- `tools/build_site.py` no longer draws a placeholder icon; it copies the real ones and writes the manifest (name, colours, four icons) and the service worker.
- The job no longer installs Pillow (nothing needs it any more).
- Ratings (3.6.0) stay switched off; there is no database and none is planned.

## [3.6.0] — 2026-11-26

Shared star ratings. Built and tested; they stay hidden until the guide is given a database (see `docs/OPERATIONS.md`, "Shared ratings").

### Added

- **Rate an episode, 1 to 5 stars**, in the episode sheet under Watched / Save. The sheet shows your rating and everyone's average ("★ 4.3 from 27 ratings"); cards in the list show the average.
- No account: the first time someone rates, their browser is given an anonymous id that stays on the device. One id, one rating per episode; rating again replaces it.
- Everyone's totals are one small download, kept on the device and asked for again at most every 10 minutes.
- A rating shows at once and is taken back, with a message, if it could not be saved.
- `js/ratings.js` (the whole feature's logic, no Firebase library), `database.rules.json` (what the database allows), `tools/ratings_selftest.py` (tries 20 ways of cheating against the real database), 11 tests in `tests/ratings.test.js`.

## [3.5.2] — 2026-11-26

### Changed

- The search box's hint now reads "Search: Jethalal, Goli, London, Chai…".
- The end of the list is rewritten: "Born out of love for Jethalal" with a heart, a "Get in touch" email link, then the small print (made for fans and not for money, unofficial, where the text and videos come from, when links were last checked).

### Fixed

- **A whole-word match now always ranks above a longer word that merely starts the same way.** Searching "chai" used to list "fake gold chain" episodes ahead of tea ones, and "tea" could surface "teacher". The word itself (or its synonym) now comes first.
- "chai" and "tea" find each other's episodes.

## [3.5.1] — 2026-11-26

The guide is live and updating itself.

### Added

- **Published.** The project is at github.com/chaifilab-ai/jethaverse and the site at https://jethaverse.com (domain bought at Hostinger and pointed at GitHub Pages). The scheduled job ran there for the first time today: it reads the three channels every 3 hours, checks links once a day, and republishes.
- **The one-file version now updates itself.** `site.config.json` points it at `data/live.json` in the GitHub project, so a phone that has `JethaVerse.html` picks up new episodes and replaced links whenever it is opened online.
- `tools/probe.py`: a self-test that says whether the machine it runs on can read YouTube's feed, playlist pages, video pages and link check. The job runs it on manual runs.

### Fixed

- **Video lengths on GitHub's servers.** YouTube answers "sign in" when a cloud server asks for a video page, so the job could not read how long an upload runs. Lengths now come from the channel's upload playlist pages (`C.lengths`), which it does show; the video page is only a fallback.
- A Hindi title printed to a Windows console that cannot show it stopped the run; it now prints "?" for those letters.

## [3.5.0] — 2026-11-26

The guide now keeps itself current: new uploads are added and dead links are replaced without anyone touching it.

### Added

- **New uploads are picked up automatically** (`tools/sync_new.py`). It reads the upload feeds of the official show channel, Sony SAB and Sony PAL. A full-length upload of an episode the guide has becomes one more place to watch it (the main link when the episode had none). A brand-new episode gets its number, the channel's title, the synopsis from the video description, the air date and who is in it.
- **Newest episodes appear the day they air, marked honestly.** The channels post a 10-minute highlights video on the day and the full episode about three weeks later. Until then the episode says "highlights only", the button says "Watch highlights on YouTube", and SonyLIV (Premium) is offered for the full episode. When the full upload arrives it takes over by itself, and Sony's English title and synopsis replace the channel's Hindi-English ones. Episodes 4859-4876, which had no video, got their highlights the same way.
- **Dead links are found and replaced automatically** (`tools/check_links.py`). Every link is asked about once a week. A link is retired only after YouTube says "no such video" on two different days; the episode's backup link then becomes the main one. If no full-length link is left, a spare is taken from `tools/pool.json` (5,436 other full-length uploads covering 2,699 episodes). A link that comes back is restored.
- **The app reads the changes by itself.** They live in one small file, `data/live.json`. The website version loads it on every visit; the one-file version carries the copy from the day it was built and asks the website for a newer one when it is online (once the site address is set in `site.config.json`). The foot of the list says when the last check ran.
- **The daily job** is `.github/workflows/update.yml` (GitHub Actions): every 3 hours it runs both scripts, runs the tests, saves `data/live.json` and republishes the site. It needs no API key or sign-in. It starts working when the project is put on GitHub.
- 24 more tests (8 for the app laying the changes over the list, 16 for the scripts' rules with YouTube faked).

### Checked today

- First real run: 6 full-length links added (official re-uploads of Episodes 601-605 and 4858), Episode 4877 added, highlights for 4859-4876.
- All 5,900 links in the guide were asked about: every one exists on YouTube.

## [3.4.0] — 2026-11-26

Picking several characters, reworked after testing on a real phone.

### Changed

- **"Closest" now means closest.** When no episode has everyone you picked, the app used to show every episode with any one of them (Goli + Sundar + Bhide + Sodhi gave "1,687 close matches"). It now shows only the episodes with the most of them: for that pick, 5 episodes that have 3 of the 4. The notice says so ("No episode has Sundar, Bhide, Sodhi and Goli together. These 5 have 3 of the 4.") and each card says who is missing ("no Sundar").
- **The windows show what adding each character would give.** Once someone is picked, every other window carries a small number: the episodes you would get by adding that character. A character who would leave nothing is dimmed (still tappable). Picked windows show a tick; the count for your pick is on the button.

### Added

- **Swipe between filters.** On the Episodes tab, swipe left or right on the list to move through All, To watch, Watched and Saved; in My list, between Saved and Watched. Up-and-down scrolling is not affected.
- 1 more test (26): closest matches are only the best tier.

## [3.3.1] — 2026-11-25

### Added

- "Born out of love for Jethalal!" at the foot of the episode list and My list, above the unofficial-fan-guide note.

## [3.3.0] — 2026-11-25

### Changed

- **The app is now called JethaVerse** (it was Jethiya for one version, and Gokuldham Guide before that), with the line "Find any Taarak Mehta episode" under the name. The one-file version is `dist/JethaVerse.html`. The hint "tap who you want to watch" moved onto the home button, where it shows while nobody is picked. Watched and Saved lists are kept.

## [3.2.0] — 2026-11-25

### Changed

- **The app is now called Jethiya** (what Bapuji calls Jethalal); it was "Gokuldham Guide". The name is on the home screen, the browser tab and the home-screen icon. The one-file version is now `dist/Jethiya.html`. The building still says "Gokuldham Society". Watched and Saved lists are kept (their storage names did not change).

### Added

- `tools/build_site.py` writes `dist/site/`, a small website any static host can serve (GitHub Pages, Netlify), with a home-screen icon and manifest so a phone can "Add to Home screen".

## [3.1.0] — 2026-11-25

### Changed

- **Tapping a video opens the YouTube app and it starts playing.** In Chrome on Android every play link (the picture on an episode, the big picture and the Watch button on the episode screen, and "Other places to watch") now names the YouTube app directly; if the app is not installed the phone opens the YouTube website instead. On iPhone and on computers the links are plain youtube.com links as before (an iPhone already hands those to the app). In-app browsers and the hosted page keep plain links, because they reject app links (that is what broke the Watch buttons in 1.1.0).

## [3.0.0] — 2026-11-25

The design review, built: six changes that came out of an end-to-end UI/UX review on a real phone.

### Fixed

- **Back could reopen an old episode** instead of going home. Opening an episode used to rewrite the list's history entry; now the episode sheet gets its own entry, the X goes back over it, and Back from the list always lands on the home screen.
- **The app forgot your place.** The view, search, filter, how many episodes were loaded and how far you had scrolled are kept for the tab, so a reload after coming back from YouTube puts you where you were. On a phone file or a hosted frame (no usable address) the views now live in the browser's history entries, so the phone's Back button works there too.

### Added

- **Thumbnails with one-tap play.** Every episode shows its YouTube picture with the episode number, length and a play button; tapping the picture plays it straight away, tapping the text opens the details. The episode sheet opens with a large picture. Pictures come from YouTube when online; without them the green number tile stays.
- **A bottom bar**: Characters, Episodes, My list. My list shows what you saved or watched (with counts), no search needed. A badge shows how many are saved.
- **Names in "Who's in it" are buttons**: tap one to see that character's episodes.
- The home button names your picks ("Show 747 episodes · Jethalal + Babita") and has a Clear next to it.

### Changed

- **Colour system.** Sky-blue page, sand building with a roof and floor lines, pale-blue rooms behind the characters (yellow shirts no longer vanish), white cards on a sand panel. **Yellow now means only "tap here" and "picked"**; the chosen filter is a dark pill. Small grey text is darker (5.4:1) and 13px.
- **Night is a full dark theme**: list, cards, episode sheet and bottom bar, not just the sky.
- **Type.** Headings in Baloo 2 instead of Anton; episode titles in sentence case (a word is lowered only when the descriptions themselves write it in lower case, so names and places keep their capital); name plates 14px.
- **Shorter list header**: 217px before the first episode instead of 295px. The title bar is hidden on the list, the count is one line with the dice beside it, chips are 36px.
- **One word**: "episodes" everywhere (was videos / stories / Ep). A search with no exact match says "3,259 close matches · no exact match".
- **Windows reordered**: Jethalal first, the Gada family on the top row. The decorative sun is gone.
- The episode sheet shows the sticker of the character the title names (Episode 7, about Champaklal, shows Bapuji).

### Not done (suggested in the review)

- Previous / next still go by episode number, not through your results. Fonts still come from Google Fonts when online (packing them into the file needs a download I have not been asked to make). "Other places to watch" can still list two similar Sony SAB rows.

## [2.4.0] — 2026-11-25

A new home screen on phones: every character, full screen, then a button to the videos.

### Changed

- **Home = every character behind a door, filling the screen.** All 12 windows are on one screen (4 across, 3 down, nothing scrolls). Each time you open the app the doors swing open one after another and every character steps out in a **random pose** from their own sheet. Tap a character to pick them (yellow ring and an episode count); tap again to un-pick. A picked character pops out in a new pose. Nothing is picked at the start.
- **A "Show videos" button** at the bottom takes you to the list (`Show all 4,872 videos`, or `Show 981 videos` once you have picked someone; Enter in the search box does the same). The list has a back arrow, chips for who is picked, the filters and the videos. The phone's Back button goes back to the home screen, and each return reshuffles the poses.
- **No more highlighting** of searched words in the list or the episode sheet.
- The "Show windows / Hide windows" fold is gone. Wide screens still show the building and the list side by side (no button needed).
- The address now carries `v=list` for the list view. Links made before this (`q=`, `f=`, `ep=` only) still open on the list.

## [2.3.0] — 2026-11-25

Phone screen revamp (found on a real phone in the Claude app).

### Changed

- **The whole page scrolls on phones.** Before, the list was a box inside a fixed-height screen, so an open building left the list with about 40% of the height. Now the building, the filters and the list are one page: scroll past the building to use the full screen. The search box stays on top. Wide screens keep the two-column layout.
- **Counts moved off the faces.** The episode count on a lit window is now a small badge on its top-right corner instead of sitting over the character's face.
- The chip row under the search box is gone on phones (the lit windows and the search text already show who is picked). The subtitle under the title is gone. New searches scroll the first result up under the search box.

### Fixed

- **Stray yellow lines under the story text.** A highlighted word on a clipped line painted a sliver over the line above. The highlight is now a band shorter than the line.

## [2.2.1] — 2026-11-25

Phone layout fixes, and a single-file version.

### Added

- **One-file version** (`dist/Gokuldham-Guide.html`, `python tools/build_single.py`): all 4,872 episodes, the code and the stickers inside one 3.3 MB file. It opens full-screen in the phone's own browser, so it is not limited to the half-height frame the hosted page sits in. Only the fonts come from Google Fonts when online.

### Added

- **Own artwork for Goli, Sundar, Bapuji, Daya, Babita, Tapu, Iyer, Sodhi, Bhide, Nattu Kaka and Popatlal** (`assets/stickers/goli_*.webp`, `sundar_*.webp`, `bapuji_*.webp`, `daya_*.webp`, `babita_*.webp`, `tapu_*.webp`, `iyer_*.webp`, `sodhi_*.webp`, `bhide_*.webp`, `nattu_*.webp`, `popat_*.webp`, cut by `tools/make_character.py` from the sheets in `assets/`). Goli, Bapuji, Daya, Babita, Tapu, Iyer, Sodhi, Bhide, Nattu Kaka, Popatlal and Sundar peek out of their windows instead of a letter. Their poses appear on the episode sheet of the episodes they are in (Goli 110, Sundar 52, Bapuji 1,078, Daya 1,253, Babita 865, Tapu 1,451, Iyer 491, Sodhi 430, Bhide 1,321, Nattu Kaka 292, Popatlal 1,046; they take turns when more than one is in an episode). More characters: add a pose list in `make_character.py` and an entry in `OWN_ART` in `js/app.js`.

### Changed

- **New windows:** Sundar (52 episodes) replaces Abdul and Nattu Kaka (292) replaces Bagha. The 12 are now Bapuji, Popatlal, Goli, Sundar / Jethalal, Daya, Tapu, Nattu Kaka / Bhide, Iyer, Babita, Sodhi. Abdul and Bagha are still found by typing. All 12 windows now have artwork.
- **Full-length videos first.** 72 episodes had a main link under 15 minutes (mostly Sony PAL parts of 1-13 minutes). For 55 of them a full-length upload (17+ minutes, title names the episode number) from the official channel or Sony SAB is now the main link, and the short upload stays as a backup labelled "short upload". 5 of the 55 are flagged "may not match" (word overlap). 9 episodes with no full-length upload found (743, 1191, 1490, 1771, 2705, 2944, 2958, 95, 742) say the video may be only part of the episode. 25 tests.

### Fixed

- **Results panel slid sideways** (about 96px) when the building was opened, because the lift-door animation reaches past the panel and the browser scrolled it. The panel and list are now clipped (`overflow: clip`).
- **Too little room for results on short phones** (under 760px tall): smaller header, search and windows, one-line story snippets, and the chip row hidden while the building is open.

## [2.2.0] — 2026-11-25

Cast for the episodes with no captions of their own.

### Added

- **Cast from short clips.** For 1,708 episodes (1,566 of the 1,735 Sony SAB ones) the official channel has short clips of the same episode with Hindi captions. 2,632 clips were read and the names in them now count. These episodes say "From the description and short clips" in the sheet.

### Changed

- Sony SAB episodes list 3.3 characters on average, up from 2.1. Episodes listing nobody: 281 before, 126 now. Examples (episodes): Abdul 267 to 402, Roshan 311 to 426, Babita 702 to 865, Madhavi 370 to 503.

### Tried and not used

- **Goli from captions.** The Hindi word for him also means bullet, pill and marbles. The best context rule found him in 16 of the 40 captioned episodes whose description names him, but also flagged episodes 1, 2, 7, 15 and 41, where the hand-checked cast says he isn't there. He stays at 110 episodes.

### Known limits

- Against the full-video cast (not against hand-checking), text plus clips found 65% where text alone found 53%, at 92% precision. 1,145 episodes (no captions and no clips) still rely on the description alone.

## [2.1.0] — 2026-11-25

Better answers to "who is in this episode".

### Added

- **Captions read for 2,019 videos** (all 302 official-channel uploads and 1,717 of Sony PAL's 2,783). Names spoken in the Hindi captions now count towards an episode's cast. Names heard only once show as "maybe" in the episode sheet.
- **Four new characters:** Inspector Chalu Pandey (138 episodes), Bawri (149), Rita Reporter (28) and the Tapu Sena gang (584), plus spelling variants (Madhvi, Baagha, Haathi, Chachaji).
- **Phrase rules:** "Hathi's son" finds Goli, "Bhide's wife" finds Madhavi, and so on (19 rules).
- **A note in the sheet** saying where each cast list came from: description only, or description and captions. Episodes 1-50 were checked by hand and carry no note.
- `tools/characters.py` (the shared character list), `pipeline/cast/` (caption pipeline) and `tests/test_cast.py`. 3 more JS tests.

### Changed

- Characters found per episode (Episodes 51+): 2.2 on average before, 3.2 now. Episodes that list nobody: 394 before, 281 now. Examples (episodes): Dr. Hathi 144 to 536, Daya 698 to 1,177, Babita 417 to 702, Madhavi 181 to 370, Roshan 108 to 311.

### Known limits

- Measured on the 50 hand-checked episodes (the same ones the thresholds were tuned on, so a bit optimistic): text names alone found 29% of the true cast, text plus captions 61%, with 84% of the listed names right either way.
- The 1,735 Sony SAB episodes and 1,066 Sony PAL episodes without captions still rely on the description alone.
- Goli stays at 110 episodes: the Hindi word for him also means "bullet" and "pill", so it is not counted from captions.

## [2.0.0] — 2026-11-25

A new home screen and the whole catalogue: all 4,872 episodes, not just 1-50.

### Added

- **Search with Gokuldham Society as the character picker.** 12 windows, one per character: tap one and its name is typed into the search box; type a name and its window lights. Tubelight flicker, curtains, a peeking character, a rolling story count, lift doors that close and open on each change, and a night mode.
- **All 4,872 episodes**, with SonyLIV's full title and synopsis for each (`data/episodes.js` and `data/episodes.json`).
- **A free link for 4,820 of them**: Sony PAL for 2,782, Sony SAB for 1,738 and the official channel for 300. The other 52 say so and link to SonyLIV (Premium). 5,767 links in all, so most episodes list backups.
- **A "may not match" note** on the 436 links whose own description fits a neighbouring episode number slightly better.
- **Saved** (a star) next to Watched, and an All / To watch / Watched / Saved filter.
- **Bagha** as a character; "natwar" now finds Nattu Kaka.
- **Wide screens:** building and search on the left, results on the right, the sheet as a side drawer.
- Search keeps working on the bigger list (index in about 0.1 s). 9 new tests.
- Pipeline for the other 4,822 episodes (`pipeline/`): the SonyLIV read, Sony PAL matching, a story check, and fallback links from Sony SAB and the official channel.

### Changed

- The home screen is now one screen: search box, building, results. The sheet shows the Watch button first.
- The hosted page fetches `data/episodes.json` instead of inlining the data.
- Search tolerates episodes with no summary, key moments or arcs (Episodes 51+).

### Removed (kept in `archive/v1-finder/`)

- The hero scene, the character filter bar, story arcs, the story strip, the in-page player and thumbnails. The archived screen still works for Episodes 1-50.

## [1.1.1] — 2026-11-24

Fixes found on a real phone.

### Fixed

- **Watch buttons did nothing in the hosted page.** The page's sandbox blocked the Android `intent://` links from 1.1.0. All Watch links are plain youtube.com links again. The phone hands these to the YouTube app when it's installed, though it may ask first.
- **The character row couldn't be swiped sideways** in the phone app. It now wraps onto several lines, showing the 8 most frequent characters, anyone you've selected, and an "All 22 characters" button that opens Filters. The story strip wraps the same way on phones.
- **Wide screens:** the headline no longer disappears into the road.

### Removed

- The "Open in the browser instead" line, which was only needed for app links.

## [1.1.0] — 2026-11-24

New "road to Gokuldham" look, YouTube app links, Sony PAL first, and a livelier Jethalal.

### Added

- **Hero scene:** a flat illustrated road running to Gokuldham society, with a milestone stone. Tap the stone for a surprise episode. It shows how many episodes you have left.
- **Road rail:** a road runs down the left of the episode list, and a small car follows your scroll.
- **Arc milestones** split the list into story arcs whenever it is in episode order.
- **Checkpoint card:** for a partial search it ticks the words it found and strikes out the ones it didn't (e.g. ✓ Jethalal, ✗ London).
- **Idle expressions:** when you're not doing anything, Jethalal crossfades through calm poses and one-liners every few seconds, with a gentle sway. This is off with reduced motion.
- **"Open in the browser instead"** link under the Watch button.

### Changed

- **Sony PAL comes first.** Where Sony PAL has the episode (31 of 50), it is the main video. Otherwise the main video is the official 1080p upload. The sheet shows the channel name, and "Where to watch" marks the main one.
- **YouTube links open the app.** On Android, links name the YouTube app directly, falling back to the website if the app isn't installed. On iPhone, youtube.com links already open the app.
- **New visual system:** sand, asphalt, road-paint yellow and highway-sign green. Anton for display text, Hind for reading.
  - Counts sit on a green highway sign.
  - The header shows "N episodes to go".
  - The phone dock has a full-width yellow Surprise button.
  - The surprise animation is now a milestone stone rolling its number while the road rushes by.
- Ending section is now an "end of the road" sign.

### Removed

- The purple yoke band and the chashmah progress line under the header. The milestone counter replaces them.

## [1.0.0] — 2026-11-24

First version: an unofficial fan guide to Taarak Mehta Ka Ooltah Chashmah, Episodes 1–50.

### Added

- **Topic search** across title, key moments, story arc, summary and SonyLIV synopsis.
  - Handles synonyms (ganpati → Ganesh, garba → Navratri) and typos (jethlal).
  - Understands nicknames and Hindi names (Bapuji, Daya bhabhi, जेठालाल) and episode numbers (`ep 12`).
- **Honest partial results.** "Jethalal in London" says nothing in 1–50 mentions London, shows Jethalal's episodes instead, and offers a one-tap filter.
- **Character multi-select (AND logic):**
  - 22 characters grouped by family, with live counts.
  - A chip that would give 0 results is disabled.
  - Optional "brief or unconfirmed appearances" switch.
- **Story arc filter** (16 arcs) and an All / Not watched / Watched switch.
- **Surprise me:**
  - Picks at random from what you're looking at and prefers unwatched episodes.
  - An odometer rolls to the number while Jethalal reacts; press `S` from anywhere.
- **Episode sheet:**
  - Drawer on desktop, bottom sheet on phone.
  - Click-to-play YouTube embed (youtube-nocookie), with Story, Key moments and Who's in it tabs.
  - Every known upload is listed with its quality, plus SonyLIV.
- **Watched progress** saved in the browser. The story strip and the chashmah on the top line move as you watch.
- **Story strip:** all 50 episodes in order, grouped by arc, with your results highlighted.
- **Reacting Jethalal:** 12 poses cut from the supplied artwork, mapped to what you're doing.
- **Shareable URLs.** Search, filters and the open episode live in the address hash; Back closes the sheet.
- **Keyboard:** `/` search, `S` surprise, `Esc` close, `←` `→` previous/next episode, `W` toggle watched.
- **Accessibility:** focus trap in dialogs, focus returns to where you were, 44px touch targets, reduced-motion support.
- **States:** loading skeletons, empty state with ways out, and an error state with retry.
- **Tooling:**
  - `tools/build_data.py` builds the data file.
  - `tools/make_stickers.py` cuts the sticker art.
  - `tools/serve.py` is a no-cache preview server.
  - `npm test` runs 12 tests.
