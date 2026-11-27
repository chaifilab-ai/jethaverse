// Run with:  npm test   (or: node --test tests/lists.test.js)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../js/lists.js");

test("a backup code writes runs of episodes as ranges and reads back the same lists", () => {
  const watched = [1, 2, 3, 4, 5, 9, 11, 12, 100, 101, 102, 103, 4877];
  const code = L.encode({ watched, saved: [30, 50, 225], last: 4877 });
  assert.equal(code, "JV1|w=1-5,9,11,12,100-103,4877|s=30,50,225|l=4877");
  assert.deepEqual(L.decode(code), { watched, saved: [30, 50, 225], last: 4877 });
});

test("a long run stays short: everything watched is a few characters", () => {
  const all = Array.from({ length: 4872 }, (_, i) => i + 1);
  assert.equal(L.encode({ watched: all, saved: [], last: 4872 }), "JV1|w=1-4872|s=|l=4872");
  assert.equal(L.decode("JV1|w=1-4872|s=|l=4872").watched.length, 4872);
});

test("encode ignores anything that is not an episode number, and writes each once", () => {
  const code = L.encode({ watched: [5, 5, "6", 0, -1, 3.5, NaN, 100000, "x", null, 7], saved: new Set([2, 1]), last: 0 });
  assert.equal(code, "JV1|w=5-7|s=1,2|l=");
  assert.equal(L.encode({}), "JV1|w=|s=|l=");
  assert.equal(L.encode(), "JV1|w=|s=|l=");
});

test("empty lists and no 'last' round-trip", () => {
  assert.deepEqual(L.decode(L.encode({ watched: [], saved: [], last: null })), { watched: [], saved: [], last: null });
});

test("decode finds the code inside a pasted message", () => {
  const got = L.decode("My backup:\n  JV1|w=1-3|s=8|l=3  \nthanks!");
  assert.deepEqual(got, { watched: [1, 2, 3], saved: [8], last: 3 });
});

test("decode refuses anything that is not a backup code", () => {
  const bad = [
    "", null, undefined, 5, "hello", "JV1", "JV1|w=|s=", "JV2|w=1|s=|l=",
    "JV1|w=5-2|s=|l=",            // a range the wrong way round
    "JV1|w=abc|s=|l=",
    "JV1|w=1,,2|s=|l=",
    "JV1|w=-3|s=|l=",
    "JV1|w=0-5|s=|l=",            // there is no episode 0
    "JV1|w=1-100000|s=|l=",       // above the highest allowed number
    "JV1|w=1-99999,1-99999|s=|l=" // more numbers than any real list
  ];
  bad.forEach((b) => assert.equal(L.decode(b), null, JSON.stringify(b)));
});

test("a 'last' that makes no sense is dropped, not fatal", () => {
  assert.equal(L.decode("JV1|w=1|s=|l=0").last, null);
  assert.equal(L.decode("JV1|w=1|s=|l=100000").last, null);
});

test("nextUnwatched: the first episode after 'last' that is not watched yet", () => {
  const nums = [1, 2, 3, 4, 5, 6, 7, 8];
  const watched = new Set([1, 2, 3, 4, 6]);
  const has = (n) => watched.has(n);
  assert.equal(L.nextUnwatched(4, has, nums), 5);     // the very next one
  assert.equal(L.nextUnwatched(5, has, nums), 7);     // 6 is watched, so skip it
  assert.equal(L.nextUnwatched(7, has, nums), 8);
  assert.equal(L.nextUnwatched(8, has, nums), null);  // the end of the list
  assert.equal(L.nextUnwatched(0, has, nums), null);  // nothing watched yet
  assert.equal(L.nextUnwatched(null, has, nums), null);
  assert.equal(L.nextUnwatched(3, has, []), null);
});

test("nextUnwatched works when the episode numbers have gaps, and when 'last' is not in the list", () => {
  const nums = [10, 20, 30, 40];
  assert.equal(L.nextUnwatched(20, () => false, nums), 30);
  assert.equal(L.nextUnwatched(25, () => false, nums), 30);  // 25 is not an episode: continue after it
  assert.equal(L.nextUnwatched(5, () => false, nums), 10);
  assert.equal(L.nextUnwatched(40, () => false, nums), null);
});
