// How the app lays data/live.json (new episodes, added links, dead links) over the built-in list.
// Run with:  npm test   (or: node --test tests/live.test.js)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../js/search.js");

const w = (id, label, minutes, note) => ({ label, note: note || "", url: "https://www.youtube.com/watch?v=" + id, id, quality: "", minutes });
const A = "aaaaaaaaaaa", B = "bbbbbbbbbbb", C = "ccccccccccc", E = "eeeeeeeeeee", F = "fffffffffff", G = "ggggggggggg";
function data() {
  return {
    arcs: [], families: [], characters: { Jethalal: { about: "", aliases: [] }, Popatlal: { about: "", aliases: [] } },
    episodes: [
      { n: 1, title: "One", synopsis: "Jethalal opens the shop.", cast: ["Jethalal"], videoId: A, channel: "Sony PAL", minutes: 21, check: 1, watch: [w(A, "Sony PAL", 21), w(B, "Sony SAB", 20)] },
      { n: 2, title: "Two", synopsis: "A short one.", cast: [], videoId: C, channel: "Sony PAL", minutes: 9, note: "The only video found for this episode is 9 minutes long, so it may be only part of the episode.", watch: [w(C, "Sony PAL", 9)] },
      { n: 3, title: "Three", synopsis: "No video yet.", cast: [], videoId: null, channel: "SonyLIV", minutes: 20, watch: [] }
    ]
  };
}
const ep = (d, n) => d.episodes.find((e) => e.n === n);

test("a dead main link hands over to the backup, and its 'may not match' note goes with it", () => {
  const d = data();
  S.applyLive(d, { dead: [A] });
  assert.deepEqual([ep(d, 1).videoId, ep(d, 1).channel, ep(d, 1).minutes, ep(d, 1).check], [B, "Sony SAB", 20, undefined]);
  assert.deepEqual(ep(d, 1).watch.map((x) => x.id), [B]);
});

test("an episode whose every link is dead falls back to SonyLIV", () => {
  const d = data();
  S.applyLive(d, { dead: [A, B] });
  assert.deepEqual([ep(d, 1).videoId, ep(d, 1).channel, ep(d, 1).watch.length], [null, "SonyLIV", 0]);
});

test("an added full-length link is a backup when the episode has one, and the main link when it only had a short one", () => {
  const d = data();
  S.applyLive(d, { links: { 1: [{ id: E, label: "Official channel", kind: "full", minutes: 21 }], 2: [{ id: F, label: "Official channel", kind: "full", minutes: 22, check: 1 }] } });
  assert.deepEqual(ep(d, 1).watch.map((x) => x.id), [A, B, E]);
  assert.equal(ep(d, 1).videoId, A);
  assert.equal(ep(d, 1).check, 1, "the main link did not change, so its note stays");
  assert.deepEqual(ep(d, 2).watch.map((x) => x.id), [F, C]);
  assert.deepEqual([ep(d, 2).videoId, ep(d, 2).channel, ep(d, 2).minutes, ep(d, 2).check, ep(d, 2).note], [F, "Official channel", 22, 1, undefined]);
});

test("highlights are the main link only while there is nothing longer, and say so", () => {
  const d = data();
  const hl = { id: E, label: "Official channel", kind: "highlights", minutes: 10 };
  S.applyLive(d, { links: { 3: [hl], 1: [hl] } });
  assert.deepEqual([ep(d, 3).videoId, ep(d, 3).hl, ep(d, 3).minutes, ep(d, 3).watch[0].note], [E, 1, 10, "highlights"]);
  assert.equal(ep(d, 1).hl, undefined);
  assert.equal(ep(d, 1).watch[2].note, "highlights");
  S.applyLive(d, { links: { 3: [hl, { id: F, label: "Sony SAB", kind: "full", minutes: 20 }] } });
  assert.deepEqual([ep(d, 3).videoId, ep(d, 3).hl, ep(d, 3).channel], [F, undefined, "Sony SAB"]);
  assert.deepEqual(ep(d, 3).watch.map((x) => x.id), [F, E]);
});

test("a new episode number is added with its links, searchable by who is in it", () => {
  const d = data();
  S.applyLive(d, {
    updated: "2026-11-26T05:00Z", checked: "2026-11-26",
    episodes: { 4: { title: "Popatlal Ka Diya", synopsis: "Popatlal runs for matches.", aired: "2026-11-25", cast: ["Popatlal", "Nobody Known"] }, 2: { title: "must not replace a built-in episode" } },
    links: { 4: [{ id: G, label: "Official channel", kind: "highlights", minutes: 10 }] }
  });
  assert.deepEqual(d.episodes.map((e) => e.n), [1, 2, 3, 4]);
  assert.equal(ep(d, 2).title, "Two");
  assert.deepEqual([ep(d, 4).title, ep(d, 4).cast, ep(d, 4).aired, ep(d, 4).videoId, ep(d, 4).hl], ["Popatlal Ka Diya", ["Popatlal"], "2026-11-25", G, 1]);
  assert.deepEqual(d.live, { updated: "2026-11-26T05:00Z", checked: "2026-11-26" });
  const r = S.search(S.createIndex(d), "popatlal");
  assert.deepEqual(r.items.map((i) => i.ep.n), [4]);
});

test("applying again starts from the built-in list: a newer file fully replaces an older one", () => {
  const d = data();
  S.applyLive(d, { dead: [A], links: { 2: [{ id: F, label: "Official channel", kind: "full", minutes: 22 }] }, episodes: { 4: { title: "Four" } } });
  S.applyLive(d, { dead: [B] });
  assert.deepEqual(ep(d, 1).watch.map((x) => x.id), [A]);
  assert.deepEqual(ep(d, 2).watch.map((x) => x.id), [C]);
  assert.equal(d.episodes.length, 3);
  S.applyLive(d, null);
  assert.deepEqual(d.episodes, data().episodes);
});

test("bad entries are ignored rather than shown", () => {
  const d = data();
  S.applyLive(d, { dead: "nope", links: { 1: [{ id: "not-an-id", kind: "full" }, null, { id: E }] }, episodes: { x: { title: "?" }, 5: {} } });
  assert.deepEqual(ep(d, 1).watch.map((x) => x.id), [A, B, E]);
  assert.equal(d.episodes.length, 3);
});

test("the shipped data/live.json is well formed and applies cleanly to the real episode list", () => {
  const file = path.join(__dirname, "..", "data", "live.json");
  if (!fs.existsSync(file)) return;
  const live = JSON.parse(fs.readFileSync(file, "utf8"));
  const D = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "episodes.json"), "utf8"));
  const builtIn = new Set(D.episodes.map((e) => e.n)), top = Math.max(...builtIn);
  assert.ok(Array.isArray(live.dead) && live.dead.every((id) => /^[\w-]{11}$/.test(id)));
  for (const [n, links] of Object.entries(live.links)) {
    assert.ok(builtIn.has(+n) || live.episodes[n], `links for ${n} belong to an episode`);
    for (const x of links) {
      assert.match(x.id, /^[\w-]{11}$/);
      assert.ok(x.kind === "full" || x.kind === "highlights", `kind of ${x.id}`);
      assert.ok(x.label && x.minutes >= 0 && x.minutes <= 40);
      if (x.kind === "full" && x.minutes) assert.ok(x.minutes >= 15, `${x.id} is called full-length but is ${x.minutes} minutes`);
    }
  }
  for (const [n, e] of Object.entries(live.episodes)) {
    assert.ok(!builtIn.has(+n) && +n > top && +n <= top + 400, `new episode number ${n} is believable`);
    assert.ok(e.title && typeof e.synopsis === "string" && Array.isArray(e.cast));
    e.cast.forEach((c) => assert.ok(D.characters[c], `${c} is a known character`));
  }
  S.applyLive(D, live);
  const ns = D.episodes.map((e) => e.n);
  assert.deepEqual(ns, [...ns].sort((a, b) => a - b));
  assert.equal(new Set(ns).size, ns.length);
  const dead = new Set(live.dead);
  D.episodes.forEach((e) => {
    assert.ok(e.watch.every((x) => !dead.has(x.id)), `episode ${e.n} shows no dead link`);
    assert.equal(e.videoId, e.watch.length ? e.watch[0].id : null);
    if (e.hl) assert.ok(e.watch.every((x) => x.hl), `episode ${e.n}: highlights lead only when nothing longer exists`);
  });
  S.createIndex(D);
});
