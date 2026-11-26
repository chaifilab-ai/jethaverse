// Run with:  npm test   (or: node --test tests/ratings.test.js)
// The database is faked here: an in-memory copy that answers the same web requests and refuses the same writes as
// database.rules.json (a total and the visitor's own vote must change together). tools/ratings_selftest.py runs the
// same cheating attempts against the real database.
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../js/ratings.js");

const CFG = { apiKey: "KEY", db: "https://example-db.test/" };

function fakeFirebase() {
  const db = { agg: {}, votes: {} };
  const tokens = {};          // token -> uid
  const log = [];
  let users = 0, fail = null, beforeWrite = null;
  const res = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
  const issue = (uid) => { const t = "tok-" + uid + "-" + Math.random().toString(36).slice(2); tokens[t] = uid; return t; };

  function fetch(url, init) {
    init = init || {};
    const method = init.method || "GET";
    log.push(method + " " + url.replace(/auth=[^&]+/, "auth=…"));
    if (fail) { const f = fail; return f(url, init) || res(500, {}); }
    if (url.startsWith("https://identitytoolkit.googleapis.com/v1/accounts:signUp")) {
      const uid = "u" + (++users);
      return res(200, { localId: uid, idToken: issue(uid), refreshToken: "ref-" + uid, expiresIn: "3600" });
    }
    if (url.startsWith("https://securetoken.googleapis.com/v1/token")) {
      const m = /refresh_token=ref-(u\d+)$/.exec(init.body || "");
      if (!m) return res(400, { error: "bad" });
      return res(200, { user_id: m[1], id_token: issue(m[1]), refresh_token: "ref-" + m[1], expires_in: "3600" });
    }
    const u = new URL(url), uid = tokens[u.searchParams.get("auth")] || null, path = u.pathname.replace(/\.json$/, "").split("/").filter(Boolean);
    if (method === "GET") {
      if (path[0] === "agg") return res(200, path[1] ? (db.agg[path[1]] || null) : (Object.keys(db.agg).length ? db.agg : null));
      if (path[0] === "votes" && path.length === 3) return uid === path[2] ? res(200, (db.votes[path[1]] || {})[uid] ?? null) : res(401, { error: "Permission denied" });
      return res(401, { error: "Permission denied" });
    }
    if (method === "PATCH" && path.length === 0) {
      if (beforeWrite) { const b = beforeWrite; beforeWrite = null; b(db); }
      const change = JSON.parse(init.body), keys = Object.keys(change);
      // the rules, in plain code: one total and this visitor's own vote, moving together
      const a = keys.find((k) => k.startsWith("agg/")), v = keys.find((k) => k.startsWith("votes/"));
      if (!uid || keys.length !== 2 || !a || !v) return res(401, { error: "Permission denied" });
      const ep = a.slice(4), stars = change[v], old = (db.votes[ep] || {})[uid] || 0, cur = db.agg[ep] || { s: 0, c: 0 };
      const ok = v === "votes/" + ep + "/" + uid && /^[1-9]\d{0,4}$/.test(ep) && Number.isInteger(stars) && stars >= 1 && stars <= 5 &&
        change[a].c === cur.c + (old ? 0 : 1) && change[a].s === cur.s + stars - old;
      if (!ok) return res(401, { error: "Permission denied" });
      db.agg[ep] = change[a]; (db.votes[ep] = db.votes[ep] || {})[uid] = stars;
      return res(200, change);
    }
    return res(401, { error: "Permission denied" });
  }
  return { fetch, db, log, tokens, failWith: (f) => { fail = f; }, onNextWrite: (f) => { beforeWrite = f; } };
}

function device() { const m = {}; return { m, get: (k) => (k in m ? JSON.parse(m[k]) : null), set: (k, v) => { m[k] = JSON.stringify(v); } }; }
const make = (fb, storage, extra) => G.create(Object.assign({ config: CFG, fetch: fb.fetch, storage: storage || device() }, extra));

test("off: no database named means nothing is asked and nothing can be rated", async () => {
  const fb = fakeFirebase();
  for (const config of [null, {}, { apiKey: "x" }, { db: "https://x" }]) {
    const r = G.create({ config, fetch: fb.fetch, storage: device() });
    assert.equal(r.on, false);
    assert.equal(await r.load(), false);
    await assert.rejects(r.rate(5, 4));
  }
  assert.equal(fb.log.length, 0);
  assert.deepEqual(G.SITE && Object.keys(G.SITE).sort(), ["apiKey", "db"]);
});

test("first rating: the visitor gets an anonymous id, and the total and their vote are written together", async () => {
  const fb = fakeFirebase(), r = make(fb);
  assert.equal(r.summary(601), null);
  assert.deepEqual(await r.rate(601, 4), { avg: 4, count: 1 });
  assert.deepEqual(fb.db, { agg: { 601: { s: 4, c: 1 } }, votes: { 601: { u1: 4 } } });
  assert.equal(r.mine(601), 4);
  assert.equal(fb.log.filter((l) => l.startsWith("PATCH")).length, 1);
});

test("rating again replaces the vote: the count stays, the sum moves", async () => {
  const fb = fakeFirebase(), r = make(fb);
  await r.rate(7, 5);
  assert.deepEqual(await r.rate(7, 2), { avg: 2, count: 1 });
  assert.deepEqual(fb.db.agg[7], { s: 2, c: 1 });
  assert.equal(fb.log.filter((l) => l.includes("accounts:signUp")).length, 1, "one id per device, not one per rating");
});

test("two visitors: one vote each, and the average is theirs together", async () => {
  const fb = fakeFirebase(), a = make(fb), b = make(fb);
  await a.rate(10, 5);
  assert.deepEqual(await b.rate(10, 2), { avg: 3.5, count: 2 });
  assert.deepEqual(fb.db.votes[10], { u1: 5, u2: 2 });
});

test("the same vote already in the database is not sent again (a new phone copy of the same id)", async () => {
  const fb = fakeFirebase(), dev = device(), r = make(fb, dev);
  await r.rate(3, 4);
  delete dev.m[G.KEY.mine];                      // the device forgot its own ratings, kept its id
  const again = make(fb, dev);
  assert.equal(again.mine(3), 0);
  assert.deepEqual(await again.rate(3, 4), { avg: 4, count: 1 });
  assert.equal(fb.log.filter((l) => l.startsWith("PATCH")).length, 1);
  assert.equal(again.mine(3), 4);
});

test("a rating that lands at the same moment as someone else's is read again and retried", async () => {
  const fb = fakeFirebase(), a = make(fb), b = make(fb);
  await a.rate(20, 1);
  fb.onNextWrite((db) => { db.agg[20] = { s: 6, c: 2 }; db.votes[20].u9 = 5; });   // someone slips in before b's write
  assert.deepEqual(await b.rate(20, 3), { avg: 3, count: 3 });
  assert.deepEqual(fb.db.agg[20], { s: 9, c: 3 });
});

test("a refused or failed save changes nothing on the device", async () => {
  const fb = fakeFirebase(), dev = device(), r = make(fb, dev);
  await r.rate(8, 5);
  fb.failWith(() => Promise.reject(new Error("offline")));
  await assert.rejects(r.rate(8, 1));
  await assert.rejects(r.rate(9, 3));
  assert.equal(r.mine(8), 5); assert.equal(r.mine(9), 0);
  assert.deepEqual(r.summary(8), { avg: 5, count: 1 }); assert.equal(r.summary(9), null);
});

test("not a rating: 0, 6, 2.5 stars or a made-up episode never reach the database", async () => {
  const fb = fakeFirebase(), r = make(fb);
  for (const [n, s] of [[5, 0], [5, 6], [5, 2.5], [5, "4"], [0, 3], [-1, 3], [1.5, 3], [100000, 3]]) await assert.rejects(r.rate(n, s));
  assert.equal(fb.log.length, 0);
});

test("an expired pass is renewed, not replaced by a new id", async () => {
  let t = 1000;
  const fb = fakeFirebase(), dev = device(), r = make(fb, dev, { now: () => t });
  await r.rate(1, 5);
  t += 2 * 3600 * 1000;                          // two hours later the pass has run out
  await r.rate(2, 4);
  assert.equal(fb.log.filter((l) => l.includes("accounts:signUp")).length, 1);
  assert.equal(fb.log.filter((l) => l.includes("securetoken")).length, 1);
  assert.deepEqual(fb.db.votes, { 1: { u1: 5 }, 2: { u1: 4 } });
});

test("totals: one request, kept on the device, asked for again only after 10 minutes", async () => {
  let t = 5000;
  const fb = fakeFirebase(), dev = device();
  fb.db.agg = { 12: { s: 9, c: 2 }, 4877: { s: 5, c: 1 } };
  const r = make(fb, dev, { now: () => t });
  assert.equal(await r.load(), true);
  assert.deepEqual(r.summary(12), { avg: 4.5, count: 2 });
  assert.equal(await r.load(), false);
  t += G.FRESH_MS - 1; await r.load();
  assert.equal(fb.log.filter((l) => l.startsWith("GET")).length, 1, "still the copy on the device");
  const reopened = make(fb, dev, { now: () => t });        // the app is opened again: the stars are there at once
  assert.deepEqual(reopened.summary(4877), { avg: 5, count: 1 });
  t += 2; fb.db.agg[12] = { s: 14, c: 3 };
  assert.equal(await reopened.load(), true);
  assert.equal(fb.log.filter((l) => l.startsWith("GET")).length, 2);
  assert.equal(await make(fb, dev, { now: () => t + G.FRESH_MS + 1 }).load(), false, "asked again, nothing new");
});

test("totals that make no sense are ignored, and Firebase's list form is read", () => {
  assert.deepEqual(G.cleanAgg({ 5: { s: 9, c: 2 }, 6: { s: 99, c: 2 }, 7: { s: 1, c: 2 }, 8: { s: 3, c: 0 }, x: { s: 3, c: 1 }, 9: "hi", 10: { s: 4.5, c: 1 }, 11: { s: 3, c: 1.5 } }),
    { 5: { s: 9, c: 2 }, 10: { s: 4.5, c: 1 } });
  assert.deepEqual(G.cleanAgg([null, { s: 5, c: 1 }, { s: 8, c: 2 }]), { 1: { s: 5, c: 1 }, 2: { s: 8, c: 2 } });
  for (const junk of [null, undefined, "x", 3, []]) assert.deepEqual(G.cleanAgg(junk), {});
});
