# QA report: v2.2.0 (2026-11-25), clips and Goli

**How it was checked**
- `npm test`: 24/24 and `npm run test:py`: 6/6.
- Clip evidence measured on 194 episodes that have both full-video captions and clips (`pipeline/cast/evaluate_clips.py`). The yardstick is the full-video cast, which is itself a guess, so these numbers show agreement, not absolute truth.

| Evidence for an episode's cast | Found (vs the full-video cast) | Right |
|---|---|---|
| Description only | 53% | (reference) |
| Description + clips, per-character thresholds | 65% | 92% |
| Description + clips, any single mention | 70% | 81% |

- Goli: on the 1,969 captioned videos, "गोली" appears 2 or more times in 121, and the description names Goli in 40. The best rule (2 or more mentions plus a Hathi-family name) caught 10 of those 40 and also flagged episodes the hand-checked cast says do not have him. Not used.
- Not checked: any episode from 51 on by hand.

---

# QA report: v2.1.0 (2026-11-25), who is in each episode

**How it was checked**
- `npm test`: 24/24, `npm run test:py`: 6/6.
- Accuracy measured against the hand-checked cast of Episodes 1-50 (`pipeline/cast/evaluate_*.py`).
- Opened the rebuilt app in the browser pane at 375x812: the window counts, and the episode sheet for a captions episode (52), a text-only one (901) and a hand-checked one (38).

| Cast source | Share of the true cast found | Share of listed names that are right |
|---|---|---|
| Names in the SonyLIV text only | 29% | 84% |
| Text plus captions (per-character thresholds) | 61% | 84% |

- The thresholds were tuned on these same 50 episodes, so the 61% is a little optimistic.
- Caption coverage: 2,019 of 4,820 free videos (302 of 302 official, 1,717 of 2,783 Sony PAL, 0 of 1,735 Sony SAB). The other 2,801 episodes rely on the text only, so for them expect closer to the 29% figure.
- The "maybe" list (names heard once): about half of its names (50 of 103) were really in the episode.
- Not checked: Episodes 51 and up by hand. There is no ground truth for them.

---

# QA report: v2.0.0 (2026-11-25)

**How it was checked**
- `npm test`: 21/21 passing (the 12 original search tests on Episodes 1-50, plus 9 on the full catalogue).
- Manual run in the browser pane at 360x740, 375x812 (phone) and about 1024x768 (wide), against `python tools/serve.py` and against the hosted build in `dist/artifact/` (served with a wrapper that adds the viewport and `[hidden]` rules the artifact host adds).
- **Not checked:** a real phone, the live claude.ai artifact URL itself, Safari or Firefox, a screen reader, and `prefers-reduced-motion` (the code honours it; it wasn't switched on). The test pane also pauses animations, so motion was judged from the code and from screenshots taken mid-motion, not watched at full speed.

## Acceptance criteria (docs/SPEC.md, v2)

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | "Jethalal Goli" gives the same list typed or via windows; includes 38, 65, 233, 882; 38 first | **Pass** | 34 stories. Typed `jethalal goli` and lighting both windows give the same count. Test "search over the whole catalogue: Jethalal AND Goli ...". |
| 2 | Windows and box agree | **Pass** | Tapping Goli added "goli" to the box and lit the window. Typing "tapu bhide" lit those two windows and switched the others off. Removing a chip removes the name. |
| 3 | Topics, nicknames, Hindi, missing words | **Pass** | Test "topics, nicknames and Hindi still work". `ganpati` 49 results, `garba` 114. "Jethalal zzqx" is partial mode and names "zzqx". |
| 4 | Sheet: Watch first, other places, SonyLIV fallback, warning on 436 | **Pass** | Ep 38: Watch button, "Sony PAL . 18 min", 4 other places. Ep 4870: "Open on SonyLIV (Premium)". Ep 101 (flagged): warning shown. |
| 5 | Surprise me | **Pass** | With "goli" results, the dice rolled an odometer, then opened Ep 1414 (about 2 s in the test pane). |
| 6 | Watched and Saved survive a reload | **Pass** | Marked Ep 38 both ways, reloaded: filters show it under Watched and Saved, and its card has both badges. |
| 7 | Layout, targets, keyboard | **Pass, with a caveat** | `scrollWidth` equals the viewport at 360 and 375, with the building open and closed and with the sheet open. All buttons measure 44px or more (a 18px reading was a button mid-animation). `/`, `Esc`, `<-` `->` checked. Not checked at 768. |
| 8 | Loading, empty, error, populated | **Pass** | Skeleton is in the HTML. Empty state checked on Watched with nothing watched. Error state checked by loading the hosted page with no data file: message and "Try again". |
| 9 | Reduced motion | **Not run** | CSS and JS both honour it; not switched on in the pane. |
| 10 | Speed | **Pass** | Node: index builds in about 0.1 s; six searches took 0.23 s in total. |

## Bugs found and fixed during this pass

- The episode sheet could stay stuck open if the host paused animations: closing now has a timer, and a pending close can't hide a sheet that was reopened.
- The Watch button was far down the sheet on a phone: it is now first.
- The sun overlapped the buttons on a phone and the results panel on a wide screen.
- Several small buttons were under 44px.

## Known gaps

- 436 links are flagged as possibly not matching their number; they were found by word overlap, not by watching.
- 394 episodes have no recognised character in their SonyLIV text, so character search can't find them.
- The data is from 2026-11-25: SonyLIV adds episodes daily, so numbers above 4876 are missing until the pipeline is re-run.

---

# Earlier reports (the archived v1 screen, Episodes 1-50 only)

## v1.1.1 (2026-11-24)

**How it was checked:**
- `npm test`: 12/12 passing.
- Manual run in the browser pane at 360×780, 375×812 (Android user agent), 768×1024 and 1280×800.
- Checked both versions: the local site, and the hosted build in `dist/artifact/`.

## What changed and how it was checked

| Change | Result | Evidence |
|---|---|---|
| Sony PAL first | **Pass** | 31 episodes use Sony PAL as the main video and 19 use the official channel. In the Ep 7 sheet, the first badge reads "Sony PAL", and "Where to watch" lists Sony PAL first, marked Main. |
| YouTube links | **Fixed in 1.1.1** | A screen recording from a real Android phone showed 1.1.0's intent links doing nothing in the hosted page. All links are now plain youtube.com links with `target=_blank` (checked in the Ep 11 sheet). |
| Sideways swipe | **Fixed in 1.1.1** | The owner reported the character row couldn't be swiped on the phone. It now wraps. `scrollWidth` equals the viewport at 375. |
| Idle expressions | **Pass** | With no input, the pose moved celebrate → thinking (about 12s after the last reaction) → pointing (about 7s later), and the bubble text changed each time. |
| Road rail, arc milestones, checkpoint | **Pass** | 16 arc milestones in browse mode. "Jethalal in London" shows the checkpoint with ✓ Jethalal and London struck out. The car moves with the scroll. |
| Surprise | **Pass** | Tapping the milestone rolls the stone's odometer over the moving road and opens the picked episode. |
| No sideways scroll | **Pass** | `scrollWidth` equals the viewport width at 360. At 768 and 1280 it is the viewport minus the scrollbar. |

The 1.0.0 acceptance criteria below were not re-run one by one. Search logic and data are unchanged apart from the main-video choice, and the tests cover them.

---

# Earlier report — v1.0.0 (2026-11-24)

**How it was checked:**
- `npm test`: 12/12 passing.
- Manual run in a Chromium browser served from `tools/serve.py`, at 360×780, 768×1024 and 1280×860.

## Acceptance criteria (from docs/SPEC.md)

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | "Jethalal in London" explains London is missing, falls back to Jethalal, offers a filter chip | **Pass** | The notice reads "Nothing in Episodes 1–50 mentions “London”. Showing episodes with Jethalal instead." Tapping "+ Add Jethalal as a filter" leaves 50 episodes and the hash `#c=Jethalal`. Test AC1. |
| 2 | Jethalal AND Goli → Ep 38; live counts; 0-result chips disabled | **Pass** | Shows 1 card (Ep 38). Only the 7 characters in Ep 38 stay enabled. Test AC2. |
| 3 | Surprise picks from the current set, prefers unwatched, opens in ~1.5s | **Pass** | `S` rolled the odometer and opened Ep 37 about 1.4s later, with focus inside the sheet. Test AC3. |
| 4 | ganpati / bapuji / garba / jethlal / जेठालाल | **Pass** | Test AC4. Matches are highlighted on the cards (garba, plus Navratri and dandiya as synonyms). |
| 5 | Watched survives reload; strip and counter update | **Pass** | Marked Ep 37, reloaded: the pill shows 1/50 and the strip block is filled. |
| 6 | 360 / 768 / 1280 with no sideways scroll; ≥44px targets; keyboard-only use | **Pass** | `scrollWidth` equals the viewport at all three sizes. `/`, `S`, `Esc`, `←` `→` and `W` were checked. Focus returns to the card after closing. |
| 7 | Loading / empty / error / populated states | **Pass** | Skeletons sit in the HTML. Empty state checked with Goli + Diwali. Error state checked by hiding `data/episodes.js`. |
| 8 | Reduced motion | **Pass (code review)** | The CSS media query cuts all durations, and the JS skips Flip, the count-up, the odometer and sticker pops. Not tested with the OS setting turned on. |

## Other checks

- **In-page player:** the YouTube embed played Ep 38.
- **Back button:** Back after opening an episode closes the sheet.
- **GSAP:** 3.12.5 and Flip loaded. The reorder animation leaves no inline styles behind.
- **Console:** clean after the fixes, apart from the deliberate 404 during the missing-data test.

## Not verified

- A real phone (only emulated sizes), Safari / iOS, and PageSpeed score.
- Opening from `file://`: the code path is there, but it was only tested over http.
