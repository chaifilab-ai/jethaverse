// Run with:  npm test   (or: node --test tests/search.test.js)
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/search.js");
const D = require("../data/episodes.js");

// Episodes 1-50 are the hand-checked ones (summary, key moments, arcs, cast). The v1 acceptance tests below run on those
// 50 only, exactly as before; the catalogue tests at the bottom run on all 4,872 episodes.
const D50 = Object.assign({}, D, { episodes: D.episodes.filter((e) => e.n <= 50) });
const I = S.createIndex(D50);
const ns = (r) => r.items.map((i) => i.ep.n);
const has = (ep, c) => ep.cast.includes(c);

test("data: 50 episodes, numbered 1..50, each with a video, an arc and known characters", () => {
  assert.equal(D50.episodes.length, 50);
  D50.episodes.forEach((e, i) => {
    assert.equal(e.n, i + 1);
    assert.match(e.videoId, /^[\w-]{11}$/);
    assert.ok(e.watch.length >= 1, `ep ${e.n} has a watch link`);
    assert.ok(e.arcs.length >= 1, `ep ${e.n} has an arc`);
    assert.ok(e.title && e.synopsis && e.summary && e.events.length);
    [...e.cast, ...e.maybe].forEach((c) => assert.ok(D.characters[c], `${c} is a known character`));
  });
});

test("AC1: 'Jethalal in London' says London is missing and falls back to Jethalal's episodes", () => {
  const r = S.search(I, "Jethalal in London");
  assert.equal(r.mode, "partial");
  assert.deepEqual(r.missing, ["london"]);
  assert.deepEqual(r.parsed.characters, ["Jethalal"]);
  assert.ok(r.items.length > 0);
  r.items.forEach((i) => assert.ok(has(i.ep, "Jethalal")));
});

test("AC2: Jethalal AND Goli (multi-select) gives exactly Episode 38", () => {
  const r = S.search(I, "", { characters: ["Jethalal", "Goli"] });
  assert.deepEqual(ns(r), [38]);
  assert.equal(S.countWith(I, { characters: ["Jethalal"] }, "Goli"), 1);
  assert.equal(S.countWith(I, { characters: ["Goli"] }, "Popatlal"), 0);
});

test("AC2: typing both names works the same as picking both chips", () => {
  assert.deepEqual(ns(S.search(I, "Jethalal and Goli")), [38]);
});

test("AC4: topic synonyms, nicknames, typos and Hindi", () => {
  const ganesh = ns(S.search(I, "ganpati"));
  assert.ok(ganesh.length >= 3 && ganesh.every((n) => n >= 23 && n <= 29), `ganpati -> ${ganesh}`);
  const garba = ns(S.search(I, "garba"));
  assert.ok(garba.slice(0, 4).every((n) => n >= 39 && n <= 44), `garba -> ${garba}`);
  assert.deepEqual(S.search(I, "bapuji").parsed.characters, ["Champaklal"]);
  assert.deepEqual(S.search(I, "jethlal").parsed.characters, ["Jethalal"]);
  assert.deepEqual(S.search(I, "जेठालाल").parsed.characters, ["Jethalal"]);
  assert.deepEqual(S.search(I, "daya bhabhi").parsed.characters, ["Daya"]);
  assert.deepEqual(S.search(I, "dr hathi").parsed.characters, ["Dr. Hathi"]);
});

test("precise topics: bomb scare and the kavi sammelan", () => {
  assert.deepEqual(ns(S.search(I, "bomb")).sort((a, b) => a - b), [24, 25]);
  assert.equal(ns(S.search(I, "kavi sammelan"))[0], 28);
  assert.deepEqual(ns(S.search(I, "kidney sheikh")).sort((a, b) => a - b), [45, 46, 47, 48, 49]);
});

test("episode numbers jump straight to the episode", () => {
  assert.equal(ns(S.search(I, "ep 12"))[0], 12);
  assert.equal(ns(S.search(I, "episode 7"))[0], 7);
});

test("a character missing from Episodes 1-50 is reported, not silently ignored", () => {
  const r = S.search(I, "popatlal");
  assert.equal(r.mode, "none");
  assert.deepEqual(r.missingCharacters, ["Popatlal"]);
});

test("filters: arc, watched and 'maybe' appearances", () => {
  assert.deepEqual(ns(S.search(I, "", { arc: "navratri" })), [39, 40, 41, 42, 43, 44]);
  const w = new Set([1, 2, 3]);
  assert.deepEqual(ns(S.search(I, "", { watched: "watched", watchedSet: w })), [1, 2, 3]);
  assert.equal(S.search(I, "", { watched: "unwatched", watchedSet: w }).items.length, 47);
  const strict = S.search(I, "", { characters: ["Goli"] }).items.length;
  const loose = S.search(I, "", { characters: ["Goli"], includeMaybe: true }).items.length;
  assert.equal(strict, 1);
  assert.ok(loose > strict, "maybe appearances add episodes");
});

test("AC3: Surprise picks from the given pool, prefers unwatched, avoids repeating", () => {
  const pool = D.episodes.filter((e) => e.n <= 5);
  const watched = new Set([1, 2, 3, 4]);
  for (let k = 0; k < 20; k++) assert.equal(S.pickSurprise(pool, watched, Math.random).n, 5);
  const all = new Set([1, 2, 3, 4, 5]);
  for (let k = 0; k < 20; k++) assert.ok(pool.includes(S.pickSurprise(pool, all, Math.random)), "falls back to watched ones");
  for (let k = 0; k < 20; k++) assert.notEqual(S.pickSurprise(pool, new Set(), Math.random, 3).n, 3);
  assert.equal(S.pickSurprise([], new Set(), Math.random), null);
  assert.equal(S.pickSurprise(pool, new Set(), () => 0.999).n, 5);
});

test("highlighting marks whole words that start with a hit and is safe with special characters", () => {
  const re = S.highlightRegex(["husband", "garba"]);
  assert.deepEqual("The husbands' strike; Garba night".match(re), ["husbands", "Garba"]);
  const weird = S.highlightRegex(["a+b(", "x"]);
  assert.ok(weird instanceof RegExp);
  assert.equal(S.highlightRegex([]), null);
});

test("normalisation: case, accents and Devanagari nukta", () => {
  assert.deepEqual(S.words("Café  JETHALAL!"), ["cafe", "jethalal"]);
  assert.equal(S.norm("भिड़े"), S.norm("भिडे"));
});

/* ---------------------------------------------------------------------------------------------
 * Catalogue: all 4,872 episodes (SonyLIV text + best link per episode)
 * ------------------------------------------------------------------------------------------- */
const IALL = S.createIndex(D);
const MISSING = new Set([3859, 3860, 3861, 3862]); // SonyLIV has no such episodes

test("catalogue: 4,872 episodes, numbered 1-4876 except the four SonyLIV skips, each with text", () => {
  assert.equal(D.episodes.length, 4872);
  const seen = new Set(D.episodes.map((e) => e.n));
  for (let n = 1; n <= 4876; n++) assert.equal(seen.has(n), !MISSING.has(n), `episode ${n}`);
  D.episodes.forEach((e) => {
    assert.ok(e.title && e.synopsis, `ep ${e.n} has title and synopsis`);
    assert.ok(Array.isArray(e.cast) && e.cast.every((c) => D.characters[c]), `ep ${e.n} cast is known`);
  });
});

test("catalogue: every episode has a YouTube link, except the few with no free upload", () => {
  const none = D.episodes.filter((e) => !e.videoId);
  assert.ok(none.length > 0 && none.length < 100, `${none.length} without a free upload`);
  none.forEach((e) => assert.equal(e.watch.length, 0));
  D.episodes.filter((e) => e.videoId).forEach((e) => {
    assert.match(e.videoId, /^[\w-]{11}$/, `ep ${e.n}`);
    assert.ok(e.watch.length >= 1 && e.watch[0].id === e.videoId, `ep ${e.n} main link is first`);
    e.watch.forEach((w) => assert.match(w.url, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/));
  });
});

test("catalogue: links the story check flagged are marked", () => {
  const flagged = D.episodes.filter((e) => e.check);
  assert.ok(flagged.length > 300 && flagged.length < 600, `${flagged.length} flagged`);
  flagged.forEach((e) => assert.ok(e.videoId, `ep ${e.n} flagged but has no link`));
});

test("catalogue: character cast is found from the SonyLIV text", () => {
  const e881 = D.episodes.find((e) => e.n === 881);
  ["Jethalal", "Daya", "Babita", "Abdul"].forEach((c) => assert.ok(e881.cast.includes(c), c));
  assert.ok(!e881.cast.includes("Goli"));
  assert.ok(D.episodes.find((e) => e.n === 882).cast.includes("Goli"));
});

test("windows: the 12 characters on the building exist in the data and have at least 50 episodes each (Sundar has the fewest)", () => {
  ["Champaklal", "Popatlal", "Goli", "Sundar", "Jethalal", "Daya", "Tapu", "Nattu Kaka", "Bhide", "Iyer", "Babita", "Sodhi"].forEach((c) => {
    assert.ok(D.characters[c], c);
    assert.ok(D.episodes.filter((e) => e.cast.includes(c)).length >= 50, `${c} appears in at least 50 episodes`);
  });
});

test("search over the whole catalogue: Jethalal AND Goli finds the known stories, first the old Episode 38", () => {
  const r = S.search(IALL, "Jethalal Goli");
  assert.equal(r.mode, "all");
  assert.ok(r.items.length >= 28 && r.items.length <= 60, `${r.items.length} results`);
  [38, 65, 233, 882].forEach((n) => assert.ok(ns(r).includes(n), `includes ${n}`));
  assert.equal(ns(r)[0], 38);
  r.items.forEach((i) => assert.ok(has(i.ep, "Jethalal") && has(i.ep, "Goli")));
});

test("search over the whole catalogue: topics, nicknames and Hindi still work", () => {
  assert.ok(ns(S.search(IALL, "tubelight")).includes(881));
  assert.ok(S.search(IALL, "garba").items.length > 50);
  assert.deepEqual(S.search(IALL, "bagha").parsed.characters, ["Bagha"]);
  assert.deepEqual(S.search(IALL, "natwar").parsed.characters, ["Nattu Kaka"]);
  assert.ok(S.search(IALL, "जेठालाल").items.length > 2000);
  assert.equal(ns(S.search(IALL, "episode 4000"))[0], 4000);
});

test("search over the whole catalogue is fast enough for typing", () => {
  const t0 = Date.now();
  ["jethalal goli", "garba", "bomb scare", "jethlal", "navratri dandiya", "popatlal marriage"].forEach((q) => S.search(IALL, q));
  assert.ok(Date.now() - t0 < 2500, `six searches took ${Date.now() - t0} ms`);
});

test("watched / unwatched filters work across the whole catalogue", () => {
  const w = new Set([38, 65]);
  const o = { characters: ["Jethalal", "Goli"], watchedSet: w };
  assert.deepEqual(ns(S.search(IALL, "", Object.assign({ watched: "watched" }, o))).sort((a, b) => a - b), [38, 65]);
  assert.equal(S.search(IALL, "", Object.assign({ watched: "unwatched" }, o)).items.length, S.search(IALL, "", { characters: ["Jethalal", "Goli"] }).items.length - 2);
});

/* ---------------------------------------------------------------------------------------------
 * Who is in each episode: wider names, phrase rules and caption names
 * ------------------------------------------------------------------------------------------- */
test("names: new characters and spelling variants are understood", () => {
  const one = (q) => S.search(IALL, q).parsed.characters;
  assert.deepEqual(one("chalu pandey"), ["Chalu Pandey"]);
  assert.deepEqual(one("rita reporter"), ["Rita"]);
  assert.deepEqual(one("bawri"), ["Bawri"]);
  assert.deepEqual(one("madhvi"), ["Madhavi"]);
  assert.deepEqual(one("baagha"), ["Bagha"]);
  assert.deepEqual(one("haathi"), ["Dr. Hathi"]);
  assert.deepEqual(one("tapu sena"), ["Tapu Sena"], "the gang is not read as Tapu alone");
});

test("cast: every episode from 51 on says where its cast came from", () => {
  const later = D.episodes.filter((e) => e.n > 50);
  later.forEach((e) => assert.ok(["t", "c", "k"].includes(e.castBy), `ep ${e.n}`));
  const withCaptions = later.filter((e) => e.castBy === "c");
  assert.ok(withCaptions.length > 1900, `${withCaptions.length} episodes read from captions`);
  // the captions belong to a Sony PAL or official upload; that upload may now be a backup behind a full-length replacement
  withCaptions.forEach((e) => assert.ok(["Sony PAL", "Official channel"].includes(e.channel) || e.watch.some((w) => w.label === "Sony PAL"), `ep ${e.n}: Sony SAB has no captions`));
  const fromClips = later.filter((e) => e.castBy === "k");
  assert.ok(fromClips.length > 1500, `${fromClips.length} episodes read from short clips`);
  later.filter((e) => e.maybe && e.maybe.length).forEach((e) => {
    assert.ok(e.castBy === "c" || e.castBy === "k", `ep ${e.n}: only caption or clip mentions give a "maybe"`);
    e.maybe.forEach((c) => assert.ok(!e.cast.includes(c), `ep ${e.n}: ${c} is in both lists`));
  });
});

test("cast: the caption read added people, and Episodes 1-50 kept their hand-checked cast", () => {
  const nobody = D.episodes.filter((e) => e.cast.length === 0).length;
  assert.ok(nobody < 200, `${nobody} episodes list nobody`);
  assert.ok(D.episodes.filter((e) => e.cast.includes("Dr. Hathi")).length > 400);
  assert.ok(!("castBy" in D.episodes[0]), "Episode 1 is hand-checked and carries no source note");
  assert.deepEqual(D.episodes.find((e) => e.n === 38).cast.slice().sort(), D50.episodes.find((e) => e.n === 38).cast.slice().sort());
});

test("links: a main link under 13 minutes carries a caution, and short Sony PAL uploads yield to a full-length video", () => {
  const short = D.episodes.filter((e) => e.n > 50 && e.videoId && e.minutes <= 13);
  assert.ok(short.length < 15, `${short.length} main links still 13 minutes or shorter`);
  short.forEach((e) => assert.ok(e.note && /only part/.test(e.note), `ep ${e.n} is ${e.minutes} min with no caution`));
  const swapped = D.episodes.filter((e) => e.watch.some((w) => /short upload/.test(w.note || "")));
  assert.ok(swapped.length > 40, `${swapped.length} episodes moved their short upload to a backup`);
  swapped.forEach((e) => assert.ok(e.minutes >= 14 && e.watch[0].id === e.videoId && !/short upload/.test(e.watch[0].note || ""), `ep ${e.n}`));
});

test("closest matches: when nothing has every picked character, only the episodes with the most of them are shown", () => {
  const r = S.search(IALL, "goli sundar bhide sodhi");
  assert.equal(r.mode, "partial");
  assert.equal(r.asked, 4);
  assert.ok(r.best >= 2 && r.best < 4, `best tier has ${r.best} of 4`);
  assert.ok(r.items.length > 0 && r.items.length < 200, `${r.items.length} closest episodes, not every episode with any one of them`);
  r.items.forEach((it) => { assert.equal(it.matched, r.best); assert.equal(it.lacks.length, 4 - r.best); });
  const exact = S.search(IALL, "goli bhide");
  assert.equal(exact.mode, "all");
  exact.items.forEach((it) => assert.equal(it.lacks.length, 0));
});
