// Run with:  npm test   (or: node --test tests/best.test.js)
// data/best.js is edited by hand, so a typo must never reach the published site.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const D = require("../data/episodes.js");
const live = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/live.json"), "utf8"));
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../data/best.js"), "utf8"), ctx);
const B = ctx.window.GG_BEST;

test("the Best list has a short label and a list of episode numbers", () => {
  assert.ok(B && typeof B === "object", "data/best.js must set window.GG_BEST");
  assert.equal(typeof B.label, "string");
  assert.ok(B.label.trim().length > 0 && B.label.length <= 20, "the label is a word or two");
  assert.ok(Array.isArray(B.episodes));
});

test("every number in the Best list is a real episode, listed once", () => {
  const known = new Set(D.episodes.map((e) => e.n).concat(Object.keys(live.episodes || {}).map(Number)));
  const seen = new Set();
  for (const n of B.episodes) {
    assert.ok(Number.isInteger(n) && n > 0, `${JSON.stringify(n)} is not an episode number`);
    assert.ok(known.has(n), `episode ${n} is not in the guide`);
    assert.ok(!seen.has(n), `episode ${n} is listed twice`);
    seen.add(n);
  }
});
