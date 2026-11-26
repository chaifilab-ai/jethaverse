/* JethaVerse: shared star ratings.
 *
 * Everyone's ratings live in one small Firebase Realtime Database, talked to over plain web requests (no Firebase
 * library is loaded):
 *
 *   /agg/<episode>            { s: sum of stars, c: number of ratings }   anyone may read; this is all the app downloads
 *   /votes/<episode>/<uid>    1..5                                        only that visitor may read or write it
 *
 * A visitor needs no account: the first time they rate, Firebase hands this browser an anonymous id, kept on the device.
 * One id, one rating per episode; rating again replaces the old one. The database's own rules (database.rules.json)
 * refuse any write where the total and the visitor's vote do not change together, so a page cannot add to a total
 * without casting its one vote. The app never counts ratings by downloading votes.
 *
 * Reads are budgeted: the totals are one request, kept on the device and asked for again at most every 10 minutes.
 * Pure of the page: runs in Node with a fake fetch and storage (tests/ratings.test.js).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GGRatings = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // The hosted guide's own database. These two values are public by design: they only name the project; what a visitor
  // may do is decided by the database rules. Empty = ratings are switched off and nothing about them is shown.
  var SITE = { apiKey: "", db: "" };

  var FRESH_MS = 10 * 60 * 1000;   // ask for the totals again at most this often
  var TRIES = 3;                   // someone else rated the same episode at the same moment: read again, try again
  var KEY = { agg: "gokuldham.ratings.v1", mine: "gokuldham.myratings.v1", who: "gokuldham.rater.v1" };
  var SIGN_UP = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=";
  var REFRESH = "https://securetoken.googleapis.com/v1/token?key=";

  function validEp(n) { return typeof n === "number" && n % 1 === 0 && n >= 1 && n <= 99999; }
  function validStars(s) { return typeof s === "number" && s % 1 === 0 && s >= 1 && s <= 5; }

  // What the database sent -> { "<episode>": { s, c } }, dropping anything that is not a sane total. Firebase returns a
  // list instead of an object when the keys are mostly consecutive numbers, so both shapes are read.
  function cleanAgg(raw) {
    var out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach(function (k) {
      var v = raw[k], n = Number(k);
      if (!v || typeof v !== "object" || !validEp(n)) return;
      var s = v.s, c = v.c;
      if (typeof s !== "number" || typeof c !== "number" || c % 1 !== 0 || c < 1 || s < c || s > 5 * c) return;
      out[n] = { s: s, c: c };
    });
    return out;
  }

  function memoryStorage() { var m = {}; return { get: function (k) { return m[k] === undefined ? null : m[k]; }, set: function (k, v) { m[k] = v; } }; }

  /**
   * create({ config, fetch, storage, now }) -> ratings object
   *   config   { apiKey, db } ; undefined = the hosted guide's own (SITE) ; null / empty = off
   *   storage  { get(key) -> value or null, set(key, value) }  (JSON values)
   */
  function create(o) {
    o = o || {};
    var cfg = o.config === undefined ? SITE : o.config;
    var doFetch = o.fetch || (typeof fetch === "function" ? function (u, i) { return fetch(u, i); } : null);
    var st = o.storage || memoryStorage();
    var now = o.now || function () { return Date.now(); };
    var on = !!(cfg && cfg.apiKey && cfg.db && doFetch);
    var db = on ? String(cfg.db).replace(/\/+$/, "") : "";

    var cache = st.get(KEY.agg);
    if (!cache || typeof cache !== "object" || typeof cache.t !== "number") cache = { t: 0, agg: {} };
    cache.agg = cleanAgg(cache.agg);
    var mine = st.get(KEY.mine);
    if (!mine || typeof mine !== "object") mine = {};
    var who = st.get(KEY.who);
    if (!who || typeof who !== "object" || !who.uid) who = null;
    var loading = null;

    function ask(url, init) {
      return doFetch(url, init).then(function (r) {
        if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
        return r.json();
      });
    }

    function summary(n) {
      var a = cache.agg[n];
      return a ? { avg: a.s / a.c, count: a.c } : null;
    }
    function myRating(n) { return validStars(mine[n]) ? mine[n] : 0; }

    /** Fetch everyone's totals if the copy at hand is older than 10 minutes. Resolves true when something changed. */
    function load(force) {
      if (!on) return Promise.resolve(false);
      if (!force && cache.t > 0 && now() >= cache.t && now() - cache.t < FRESH_MS) return Promise.resolve(false);
      if (loading) return loading;
      loading = ask(db + "/agg.json").then(function (raw) {
        var fresh = cleanAgg(raw), changed = JSON.stringify(fresh) !== JSON.stringify(cache.agg);
        cache = { t: now(), agg: fresh }; st.set(KEY.agg, cache); loading = null;
        return changed;
      }, function (e) { loading = null; throw e; });
      return loading;
    }

    function keep(uid, token, refresh, seconds) {
      who = { uid: uid, token: token, refresh: refresh, exp: now() + (Number(seconds) || 3600) * 1000 };
      st.set(KEY.who, who);
      return who;
    }
    function signUp() {
      return ask(SIGN_UP + encodeURIComponent(cfg.apiKey), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) })
        .then(function (r) { return keep(r.localId, r.idToken, r.refreshToken, r.expiresIn); });
    }
    // This browser's anonymous id with a pass that is still good: the one at hand, a renewed one, or a new id.
    function pass(renew) {
      if (who && who.token && !renew && who.exp - now() > 60000) return Promise.resolve(who);
      if (who && who.refresh) {
        return ask(REFRESH + encodeURIComponent(cfg.apiKey), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(who.refresh) })
          .then(function (r) { return keep(r.user_id, r.id_token, r.refresh_token, r.expires_in); },
            function (e) { if (e.status === 400 || e.status === 403) { who = null; return signUp(); } throw e; });
      }
      return signUp();
    }

    function attempt(n, stars, left, renewed) {
      return pass(renewed).then(function (w) {
        var auth = "?auth=" + encodeURIComponent(w.token);
        return Promise.all([ask(db + "/agg/" + n + ".json"), ask(db + "/votes/" + n + "/" + w.uid + ".json" + auth)]).then(function (got) {
          var a = got[0] && typeof got[0] === "object" ? got[0] : {}, prev = validStars(got[1]) ? got[1] : 0;
          var total = { s: (Number(a.s) || 0) + stars - prev, c: (Number(a.c) || 0) + (prev ? 0 : 1) };
          if (prev === stars) return total;                       // the database already has this vote: nothing to send
          var change = {}; change["agg/" + n] = total; change["votes/" + n + "/" + w.uid] = stars;
          return ask(db + "/.json" + auth, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) })
            .then(function () { return total; });
        });
      }).then(null, function (e) {
        // 401 / 403: the pass ran out, or the total moved between our read and our write. Both are worth one more go.
        if (left > 1 && (e.status === 401 || e.status === 403)) return attempt(n, stars, left - 1, true);
        throw e;
      });
    }

    /** Save this visitor's rating of episode n (1..5). Resolves with the episode's new { avg, count }. */
    function rate(n, stars) {
      if (!on) return Promise.reject(new Error("ratings are off"));
      if (!validEp(n) || !validStars(stars)) return Promise.reject(new Error("not a rating"));
      return attempt(n, stars, TRIES, false).then(function (total) {
        mine[n] = stars; st.set(KEY.mine, mine);
        cache.agg[n] = total; st.set(KEY.agg, cache);
        return summary(n);
      });
    }

    return { on: on, load: load, rate: rate, summary: summary, mine: myRating };
  }

  return { create: create, cleanAgg: cleanAgg, SITE: SITE, KEY: KEY, FRESH_MS: FRESH_MS };
});
