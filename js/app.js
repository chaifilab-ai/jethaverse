/* JethaVerse (formerly Jethiya, Gokuldham Guide) v3: UI. Depends on window.TMKOC_DATA (data/episodes.js, or fetched from data/episodes.json when the
 * host cannot load a script file) and window.GGSearch (js/search.js).
 *
 * Three views on a phone, switched by the bottom bar:
 *   HOME  the Gokuldham Society building fills the screen: 12 windows = 12 characters behind their doors. Each opens
 *         with a random pose; tapping one picks it (two-way linked to the search box). A button shows the episodes.
 *   LIST  the episodes for the search: thumbnail (plays in one tap), title, filters.
 *   MINE  "My list": the episodes you saved or watched.
 * On wide screens the building and the list sit side by side. Tapping an episode opens the episode sheet. */
(function () {
  "use strict";

  var S = window.GGSearch, CFG = window.GG_CONFIG || {};
  var app = document.getElementById("app");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var wide = window.matchMedia("(min-width: 900px)");
  // The address can carry the state only on a normal web address. A file on the phone or a hosted frame keeps it in the
  // browser's history entries instead (so Back still works) and in this tab's session (so a reload keeps your place).
  var useHash = !CFG.noHash && /^https?:$/.test(location.protocol);
  // the storage names keep the old "gokuldham" prefix on purpose: renaming them would empty everyone's Watched and Saved
  var KEY = { watched: "gokuldham.watched.v1", saved: "gokuldham.saved.v1", night: "gokuldham.night.v1", place: "gokuldham.place.v1" };
  var SONYLIV = "https://www.sonyliv.com/shows/taarak-mehta-ka-ooltah-chashmah-1700000084/episodes/";
  var THUMB = "https://i.ytimg.com/vi/";
  var PAGE = 40;
  var VIEWS = ["home", "list", "mine"], FILTERS = ["all", "unwatched", "watched", "saved"];
  // where an episode's cast list came from (Episodes 1-50 were checked by hand and carry no note)
  var CAST_NOTE = {
    t: "From the description only, so others may be in it.",
    c: "From the description and the spoken captions. A name with a ? was only heard once.",
    k: "From the description and short clips of this episode, so others may be in it. A name with a ? was only heard once."
  };

  /* ---------- small helpers ---------- */
  function $(sel, el) { return (el || app).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || app).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString("en-IN"); }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dayText(iso) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso || ""); return m ? +m[3] + " " + MON[+m[2] - 1] + " " + m[1] : ""; }
  function icon(id, cls) { return '<svg class="i' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function motionOK() { return !reduce.matches; }
  function D(ms) { return motionOK() ? ms : 0; }
  function listJoin(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  function store(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage may be blocked */ } }
  function sget(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch (e) { return null; } }
  function sset(key, v) { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage may be blocked */ } }
  // A YouTube link that opens the YouTube app and starts playing. In Chrome on Android a plain youtube.com link often
  // stays in the browser, so there the link names the app itself (with the web page as the fallback when the app is
  // not installed). In-app browsers (the "wv" in their name) and hosted frames reject such links, and on iPhone a plain
  // youtube.com link already opens the app, so everywhere else it stays a plain link in a new tab.
  var UA = navigator.userAgent || "";
  var YT_APP = /Android/i.test(UA) && !/\bwv\b/.test(UA) && !CFG.noHash;
  function playAttrs(url) {
    var m = /[?&]v=([\w-]{11})/.exec(url || "");
    if (YT_APP && m) {
      return 'href="intent://www.youtube.com/watch?v=' + m[1] + "#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=" + encodeURIComponent(url) + ';end"';
    }
    return 'href="' + esc(url) + '" target="_blank" rel="noopener"';
  }
  function stickerSrc(p) { return 'assets/stickers/' + p + '.webp'; }
  function sticker(p, w, cls) { return '<img' + (cls ? ' class="' + cls + '"' : "") + ' src="' + stickerSrc(p) + '" alt="" width="' + w + '" height="' + w + '">'; }
  var POSES = ["hero", "welcome", "whoa", "pointing", "explain", "thinking", "shrug", "proud", "celebrate", "sheepish", "shy"];  // Jethalal
  var OWN_ART = {  // every other window's character has their own sticker sheet
    Goli: ["goli_snack", "goli_laugh", "goli_dreamy", "goli_whoa", "goli_ok", "goli_cheer"],
    Sundar: ["sundar_point", "sundar_phone", "sundar_heart", "sundar_whoa", "sundar_laugh", "sundar_ok"],
    Champaklal: ["bapuji_angry", "bapuji_arms", "bapuji_shock", "bapuji_paper", "bapuji_laugh", "bapuji_think"],
    Daya: ["daya_whoa", "daya_phone", "daya_heart", "daya_gasp", "daya_ok", "daya_namaste"],
    Babita: ["babita_wave", "babita_gasp", "babita_heart", "babita_laugh", "babita_idea", "babita_thumbs"],
    Tapu: ["tapu_wave", "tapu_cheer", "tapu_idea", "tapu_whoa", "tapu_laugh", "tapu_thumbs"],
    Iyer: ["iyer_stop", "iyer_scratch", "iyer_plead", "iyer_point", "iyer_nails", "iyer_headache"],
    Sodhi: ["sodhi_point", "sodhi_laugh", "sodhi_warn", "sodhi_cheer", "sodhi_idea", "sodhi_ok"],
    Bhide: ["bhide_arms", "bhide_point", "bhide_worry", "bhide_think", "bhide_calm", "bhide_angry"],
    "Nattu Kaka": ["nattu_grumpy", "nattu_laugh", "nattu_glasses", "nattu_stop", "nattu_namaste", "nattu_point"],
    Popatlal: ["popat_welcome", "popat_love", "popat_specs", "popat_bride", "popat_phone", "popat_hip"]
  };
  function artFor(name) { return name === "Jethalal" ? POSES : OWN_ART[name]; }
  // a window's character steps out with a random pose from their own sheet
  function randomPose(name, not) {
    var a = artFor(name) || POSES, p;
    do { p = a[Math.random() * a.length | 0]; } while (a.length > 1 && p === not);
    return p;
  }
  function snip(s, re) {
    var start = 0;
    if (re) { re.lastIndex = 0; var m = re.exec(s); re.lastIndex = 0; if (m && m.index > 70) { start = s.lastIndexOf(" ", m.index - 30); if (start < 0) start = 0; } }
    var out = s.slice(start, start + 170);
    return (start ? "… " : "") + out + (start + 170 < s.length ? " …" : "");
  }
  function roll(el, to, ms) {
    var from = +el.dataset.v || 0; el.dataset.v = to; cancelAnimationFrame(el._raf);
    if (!motionOK() || from === to) { el.textContent = fmt(to); return; }
    var t0 = performance.now(); ms = ms || 420;
    (function step(t) {
      var p = Math.min(1, (t - t0) / ms), k = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * k));
      if (p < 1) el._raf = requestAnimationFrame(step);
    })(t0);
  }
  function burst(btn) {
    if (!motionOK() || !btn) return;
    for (var i = 0; i < 10; i++) {
      var s = document.createElement("i"), a = i / 10 * Math.PI * 2, d = 30 + Math.random() * 18;
      s.className = "spark";
      s.style.cssText = "--x:" + Math.cos(a) * d + "px;--y:" + Math.sin(a) * d + "px;--c:" + ["var(--c-yellow)", "var(--c-green)", "var(--c-asphalt)"][i % 3];
      btn.appendChild(s);
      s.addEventListener("animationend", function (e) { e.target.remove(); });
    }
  }
  var toastTimer;
  function toast(msg) {
    var old = document.querySelector(".toast"); if (old) old.remove();
    var t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.remove(); }, 2600);
  }
  // a video picture that does not load (offline, or a host that blocks outside images) just disappears; the number stays
  document.addEventListener("error", function (e) { var t = e.target; if (t && t.tagName === "IMG" && t.src.indexOf(THUMB) === 0) t.remove(); }, true);

  /* ---------- live changes: new episodes and replaced links, kept up to date by the daily job (data/live.json) ----------
   * Start with the newest copy at hand (packed into the file, or kept from the last visit), then ask the website for a
   * newer one. CFG.live is where to ask: "data/live.json" beside the page by default; the one-file version is given the
   * website's full address; "" switches asking off. */
  var LIVE_KEY = "gokuldham.live.v1";
  function liveVer(l) { return l ? String(l.updated || "") + "~" + String(l.checked || "") : ""; }
  function bestLive() { var a = window.GG_LIVE || null, b = store(LIVE_KEY, null); return liveVer(b) > liveVer(a) ? b : a; }

  /* ---------- load the data (script file, or fetch for hosts that block script files) ---------- */
  function boot() {
    if (window.TMKOC_DATA) return start(window.TMKOC_DATA);
    fetch("data/episodes.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(start).catch(function () {
      var res = $(".results");
      if (res) res.innerHTML = '<div class="empty">' + sticker("sheepish", 100) + '<p>The episode list did not load. Check the connection and try again.</p><button class="btn" id="retry">Try again</button></div>';
      var b = $("#retry"); if (b) b.onclick = function () { location.reload(); };
    });
  }

  function start(D0) {
    var liveNow = bestLive();
    S.applyLive(D0, liveNow);
    var I, byN, nums, posOf, counts;
    // everyone's star ratings (js/ratings.js). Off when the page has no database to ask: nothing about ratings shows.
    var R = window.GGRatings ? window.GGRatings.create({ config: CFG.ratings, storage: { get: function (k) { return store(k, null); }, set: save } }) : { on: false };
    var rating = null;  // { n, stars } while a rating is on its way to the database
    function load() {  // everything worked out from the episode list; run again when a newer live file arrives
      I = S.createIndex(D0);
      byN = new Map(D0.episodes.map(function (e) { return [e.n, e]; }));
      nums = D0.episodes.map(function (e) { return e.n; }).sort(function (a, b) { return a - b; });
      posOf = new Map(nums.map(function (n, i) { return [n, i]; }));
      counts = {};
      D0.episodes.forEach(function (e) { e.cast.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; }); });
    }
    load();
    var watched = new Set(store(KEY.watched, [])), saved = new Set(store(KEY.saved, []));

    // the 12 windows: canonical character name (as in the data), the label on the nameplate. The Gada family is the top row.
    var ROWS = [
      [["Jethalal", "Jethalal"], ["Daya", "Daya"], ["Tapu", "Tapu"], ["Champaklal", "Bapuji"]],
      [["Babita", "Babita"], ["Iyer", "Iyer"], ["Bhide", "Bhide"], ["Sodhi", "Sodhi"]],
      [["Popatlal", "Popatlal"], ["Goli", "Goli"], ["Sundar", "Sundar"], ["Nattu Kaka", "Nattu Kaka"]]
    ];
    var FLATS = [].concat.apply([], ROWS);
    var LABEL = {}; FLATS.forEach(function (f) { LABEL[f[0]] = f[1]; });

    /* ---------- titles in sentence case ----------
     * SonyLIV Writes Every Word With A Capital. A word is lowered only when the descriptions themselves write it in
     * lower case more often than not (so "trip" is lowered, "London" and "Jethalal" are kept). */
    var lower = Object.create(null), upper = Object.create(null);
    D0.episodes.forEach(function (e) {
      var ws = (e.synopsis || "").split(/\s+/);
      for (var i = 1; i < ws.length; i++) {
        if (/[.!?:"“”]$/.test(ws[i - 1])) continue;  // the first word of a sentence says nothing
        var w = ws[i].replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, ""); if (!w) continue;
        var k = w.toLowerCase().replace(/'s$/, "");
        if (w.charAt(0) === w.charAt(0).toLowerCase()) lower[k] = (lower[k] || 0) + 1; else upper[k] = (upper[k] || 0) + 1;
      }
    });
    var niceCache = new Map();
    function nice(title) {
      if (niceCache.has(title)) return niceCache.get(title);
      if (/[\u0900-\u097F]/.test(title || "")) return title;  // a channel's own Hindi-English title is kept as written
      var out = String(title || "").split(" ").map(function (w, i) {
        if (i === 0) return w;
        var m = /^([^A-Za-z]*)([A-Za-z][A-Za-z']*)(.*)$/.exec(w); if (!m) return w;
        if (m[2].length > 1 && m[2] === m[2].toUpperCase()) return w;  // TV, SMS
        var k = m[2].toLowerCase().replace(/'s$/, "");
        return (lower[k] || 0) > (upper[k] || 0) ? m[1] + m[2].charAt(0).toLowerCase() + m[2].slice(1) + m[3] : w;
      }).join(" ");
      niceCache.set(title, out); return out;
    }

    var state = { q: "", filter: "all", mine: "saved", limit: PAGE, open: null, view: "home", night: false, armed: false };
    var night = store(KEY.night, null);
    state.night = night == null ? window.matchMedia("(prefers-color-scheme: dark)").matches : !!night;

    /* ---------- where you are: the address (web), the history entries (Back) and this tab's session (reload) ---------- */
    var restoreY = 0, sheetPushed = false;
    function validFilter(f) { return FILTERS.indexOf(f) >= 0 ? f : "all"; }
    function validMine(m) { return m === "watched" ? "watched" : "saved"; }
    function readHash(initial) {
      var p = new URLSearchParams(location.hash.slice(1));
      state.q = p.get("q") || "";
      state.filter = validFilter(p.get("f"));
      state.mine = validMine(p.get("m"));
      var n = parseInt(p.get("ep"), 10), v = p.get("v");
      // links made before the home screen existed (q=, f=, ep= without v=) open straight on the list
      state.view = VIEWS.indexOf(v) >= 0 ? v : (byN.has(n) || (initial && (p.has("q") || p.has("f"))) ? "list" : "home");
      return byN.has(n) ? n : null;
    }
    function hashFor() {
      var p = new URLSearchParams();
      if (state.view !== "home") p.set("v", state.view);
      if (state.q) p.set("q", state.q);
      if (state.filter !== "all") p.set("f", state.filter);
      if (state.view === "mine" && state.mine !== "saved") p.set("m", state.mine);
      if (state.open) p.set("ep", state.open);
      var s = p.toString();
      return s ? "#" + s : location.pathname + location.search;
    }
    function savePlace() { sset(KEY.place, { q: state.q, filter: state.filter, mine: state.mine, view: state.view, limit: state.limit, y: wide.matches ? 0 : window.scrollY }); }
    function writeNav(push) {
      var ok = true, st = { gg: 1, view: state.view, q: state.q, filter: state.filter, mine: state.mine, sheet: state.open || null };
      try { if (useHash) history[push ? "pushState" : "replaceState"](st, "", hashFor()); else history[push ? "pushState" : "replaceState"](st, ""); } catch (e) { ok = false; }
      savePlace();
      return ok;
    }
    var openFromHash = null, pl = sget(KEY.place);
    if (useHash && location.hash.length > 1) {
      openFromHash = readHash(true);
      // same place as before the reload: go back to the same spot in the list too
      if (pl && pl.view === state.view && (pl.q || "") === state.q) { state.limit = Math.min(Math.max(+pl.limit || PAGE, PAGE), 400); restoreY = +pl.y || 0; }
    } else if (pl) {
      state.q = pl.q || ""; state.filter = validFilter(pl.filter); state.mine = validMine(pl.mine);
      state.view = VIEWS.indexOf(pl.view) >= 0 ? pl.view : "home"; state.limit = Math.min(Math.max(+pl.limit || PAGE, PAGE), 400); restoreY = +pl.y || 0;
    }

    /* ---------- build the screen ---------- */
    var stars = ""; for (var s = 0; s < 16; s++) stars += '<i style="left:' + (Math.random() * 96).toFixed(1) + "%;top:" + (Math.random() * 90).toFixed(1) + "%;--d:" + (Math.random() * 2.4).toFixed(2) + 's"></i>';
    app.removeAttribute("data-state");
    app.innerHTML =
      '<div class="sky"></div><div class="stars">' + stars + '</div><img class="buddy" src="assets/stickers/welcome.webp" alt="" width="280" height="280">' +
      '<header class="appbar"><div class="brand">JethaVerse<small>Find any Taarak Mehta episode</small></div>' +
      '<div class="bar-actions"><button class="iconbtn" data-act="surprise" aria-label="Surprise me: pick a random episode">' + icon("dice") + "</button>" +
      '<button class="iconbtn" data-act="night" aria-pressed="false" aria-label="Switch to night">' + icon("moon") + "</button></div></header>" +
      '<form class="search" role="search" onsubmit="return false">' + icon("search") +
      '<input id="q" type="search" placeholder="Search: Jethalal, Goli, London, Chai…" autocomplete="off" enterkeyhint="search" aria-label="Search all ' + fmt(D0.episodes.length) + ' episodes by who is in them or what happens">' +
      '<button type="button" class="clear" data-act="clear" aria-label="Clear search" hidden>' + icon("x") + "</button></form>" +
      '<div class="tags" aria-label="Characters in this search" hidden></div>' +
      '<div class="scene"><div class="scene-in"><div class="building"><div class="grid3">' +
      FLATS.map(function (f, i) {
        var p = randomPose(f[0]);
        return '<button class="flat" data-k="' + f[0] + '" data-pose="' + p + '" aria-pressed="false" style="--i:' + i + '" aria-label="' + f[1] + ", " + fmt(counts[f[0]] || 0) + ' episodes">' +
          '<span class="win"><span class="light"></span><span class="peek"><img src="' + stickerSrc(p) + '" alt=""></span>' +
          '<span class="cur l"></span><span class="cur r"></span></span><span class="cnt">' + fmt(counts[f[0]] || 0) + '</span><span class="plate">' + f[1] + "</span></button>";
      }).join("") + '</div><div class="ground"></div></div></div></div>' +
      '<div class="cta"><button class="btn ghost unpick" data-act="unpick" hidden>Clear</button>' +
      '<button class="btn go" data-act="list">' + icon("play") + '<span class="gotx"><b data-cta>Show episodes</b><small data-ctasub hidden></small></span></button></div>' +
      '<section class="panel" aria-label="Episodes">' +
      '<h1 class="ptitle">My list</h1>' +
      '<div class="phead"><span class="tx"><b data-count>0</b> <span data-pl>episodes</span><small data-ps></small></span>' +
      '<button class="iconbtn dice2" data-act="surprise" aria-label="Surprise me: pick a random episode from these">' + icon("dice") + "</button></div>" +
      '<div class="filters"><div class="seg" role="group" aria-label="Show"><span class="pillbg"></span>' +
      [["all", "All"], ["unwatched", "To watch"], ["watched", "Watched"], ["saved", "Saved"]].map(function (f) { return '<button data-f="' + f[0] + '" aria-pressed="false">' + f[1] + "</button>"; }).join("") +
      '</div></div><div class="plist"><div class="results" aria-live="polite"></div><div class="doors"><i></i><i></i></div></div></section>' +
      '<nav class="tabs" aria-label="Sections">' +
      '<button data-tab="home">' + icon("people") + "<span>Characters</span></button>" +
      '<button data-tab="list">' + icon("list") + "<span>Episodes</span></button>" +
      '<button data-tab="mine">' + icon("star") + '<span>My list</span><b data-minecount hidden></b></button></nav>';

    var q = $("#q"), clearBtn = $(".clear"), tagsEl = $(".tags"), res = $(".results"), doors = $$(".doors i"), seg = $(".seg");
    q.value = state.q;
    function setNight() {
      app.classList.toggle("night", state.night); document.body.classList.toggle("night", state.night);
      var b = $('[data-act="night"]');
      b.innerHTML = icon(state.night ? "sun" : "moon"); b.setAttribute("aria-pressed", state.night); b.setAttribute("aria-label", state.night ? "Switch to day" : "Switch to night");
      var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", state.night ? "#1D2342" : "#A8D8F0");
    }
    setNight();

    /* ---------- running a search ---------- */
    // phones scroll the whole page, wide screens scroll the list
    function getY() { return wide.matches ? res.scrollTop : window.scrollY; }
    function setY(y) { if (wide.matches) res.scrollTop = y; else window.scrollTo(0, y); }
    function toTop() {  // after a new search: bring the first result up under the search box
      if (wide.matches) { res.scrollTop = 0; return; }
      if (state.view === "home") return;
      var y = $(".panel").getBoundingClientRect().top + window.scrollY - $(".search").offsetHeight;
      if (window.scrollY > y) window.scrollTo(0, y);
    }
    function isMine() { return state.view === "mine" && !wide.matches; }
    function curFilter() { return isMine() ? state.mine : state.filter; }
    var cur = { r: null, items: [] };
    function compute() {
      var f = curFilter();
      var r = S.search(I, isMine() ? "" : state.q, { watched: f === "watched" || f === "unwatched" ? f : "all", watchedSet: watched });
      var items = r.items;
      if (f === "saved") items = items.filter(function (i) { return saved.has(i.ep.n); });
      cur = { r: r, items: items };
    }
    function charWords(name) {
      var c = D0.characters[name]; if (!c) return [];
      var out = [];
      [name].concat(c.aliases || []).forEach(function (a) { if (/^[\x00-\x7f]+$/.test(a)) S.words(a).forEach(function (w) { if (w.length >= 4) out.push(w); }); });
      return out;
    }
    function cardRe(item) {  // only used to start a snippet near the words you searched; nothing is highlighted
      var hits = item.hits.slice();
      cur.r.parsed.characters.forEach(function (c) { hits = hits.concat(charWords(c)); });
      return S.highlightRegex(hits);
    }
    // the video's picture: tapping it plays the episode on YouTube straight away
    function thumbHTML(e, cls) {
      var main = e.watch && e.watch[0];
      var inner = (e.videoId ? '<img src="' + THUMB + e.videoId + '/mqdefault.jpg" alt="" loading="lazy" decoding="async">' : "") +
        '<span class="epn">' + e.n + "</span>" + (main && e.minutes ? '<span class="dur">' + e.minutes + " min</span>" : "");
      if (!main) return '<span class="' + cls + ' none">' + inner + '<span class="nov">SonyLIV only</span></span>';
      return '<a class="' + cls + '" ' + playAttrs(main.url) + ' aria-label="Play episode ' + e.n + ' on YouTube">' + inner + '<span class="pl">' + icon("play") + "</span></a>";
    }
    function cardHTML(item, i) {
      var e = item.ep, re = cardRe(item), done = watched.has(e.n);
      var flags = (done ? "<i title=\"Watched\">" + icon("check") + "</i>" : "") + (saved.has(e.n) ? "<i class=\"s\" title=\"Saved\">" + icon("star") + "</i>" : "");
      var where = e.videoId ? (e.channel || "") + (e.hl ? " \u00b7 highlights only" : "") : "SonyLIV Premium only";
      if (cur.r.mode === "partial" && item.lacks && item.lacks.length) where += " \u00b7 no " + item.lacks.map(labelFor).join(", ");
      var rt = R.on && R.summary(e.n);
      if (rt) where += " \u00b7 \u2605 " + rt.avg.toFixed(1);
      return '<div class="ecard' + (done ? " done" : "") + '" role="button" tabindex="0" data-n="' + e.n + '" style="--i:' + Math.min(i, 12) + '">' + thumbHTML(e, "thumb") +
        '<span class="cbody"><b class="ctitle">' + esc(nice(e.title)) + '</b><span class="csnip">' + esc(snip(e.synopsis, re)) + '</span><span class="cmeta">' + esc(where) + '</span></span><span class="flags">' + flags + "</span></div>";
    }
    function labelFor(c) { return LABEL[c] || c; }
    function whatWords(p) {
      return p.characters.map(labelFor).concat(p.topics.map(function (t) { return "“" + t.word + "”"; }), p.numbers.map(function (n) { return "episode " + n; }));
    }
    function noticeHTML(r) {
      if (isMine()) return "";
      if (r.mode !== "partial") return "";
      var miss = r.missing.map(function (w) { return "“" + w + "”"; }).concat(r.missingCharacters.map(labelFor));
      var n = cur.items.length, have = (n === 1 ? "This one has " : "These " + fmt(n) + " have ") + r.best + " of the " + r.asked + ".";
      if (miss.length) return '<p class="notice">No episode mentions ' + listJoin(miss) + ". " + have + "</p>";
      return '<p class="notice">No episode has ' + listJoin(whatWords(r.parsed)) + " together. " + have + "</p>";
    }
    function emptyHTML() {
      var f = curFilter(), searching = !isMine() && !!state.q.trim(), m;
      if (f === "saved") m = searching ? ["thinking", "None of your saved episodes match this search."] : ["shy", "Nothing saved yet. Open an episode and tap Save."];
      else if (f === "watched") m = searching ? ["thinking", "None of the episodes you watched match this search."] : ["thinking", "You haven't marked anything watched yet."];
      else if (f === "unwatched") m = ["celebrate", "You've watched everything here."];
      else m = ["crying", "No episode has all of these. Take one word out."];
      return '<div class="empty">' + sticker(m[0], 100) + "<p>" + m[1] + "</p>" + (searching ? '<button class="btn ghost" data-act="clear">Clear search</button>' : "") + "</div>";
    }
    function footHTML() {
      var f = curFilter();
      var reset = (f === "watched" || f === "saved") && cur.items.length
        ? '<button class="linkbtn" data-act="reset">' + (state.armed ? "Tap again to clear " + cur.items.length : "Clear " + f + " list") + "</button> " : "";
      var lv = D0.live, when = lv && (lv.checked || lv.updated.slice(0, 10));
      var fresh = when ? " New uploads and dead links were last checked on " + dayText(when) + "." : "";
      return '<div class="foot">' + reset +
        '<p class="love">Born out of love for Jethalal <span class="heart" aria-hidden="true">\u2665</span></p>' +
        '<p class="touch">Get in touch: <a href="mailto:chaifilab@gmail.com">chaifilab@gmail.com</a></p>' +
        '<p class="fine">Made for fans, not for money: no ads, no fees, no sign-up. An unofficial fan guide. Episode text is from SonyLIV; videos and their pictures are from the YouTube channels shown. Not affiliated with the show or its makers.' + fresh + "</p></div>";
    }
    function renderResults(animate) {
      var r = cur.r, items = cur.items;
      if (!items.length) { res.innerHTML = emptyHTML() + footHTML(); return; }
      var shown = items.slice(0, state.limit);
      res.innerHTML = noticeHTML(r) + shown.map(function (it, i) { return cardHTML(it, animate === false ? 0 : i); }).join("") +
        (items.length > state.limit ? '<button class="more" data-act="more">Show ' + Math.min(PAGE, items.length - state.limit) + " more</button>" : "") + footHTML();
    }
    function syncWindows() {
      var lit = {}; cur.r.parsed.characters.forEach(function (c) { lit[c] = 1; });
      // While something is picked or searched, every other window shows how many episodes you would get by adding that
      // character, and one that would leave nothing is dimmed. Picked windows show the count you have now.
      var narrowing = cur.r.mode === "all" && !isMine();
      $$(".flat").forEach(function (f) {
        var k = f.dataset.k, on = !!lit[k];
        if ((f.getAttribute("aria-pressed") === "true") !== on) f.setAttribute("aria-pressed", on);
        var badge = $(".cnt", f);
        if (on) { f.removeAttribute("data-add"); badge.textContent = "✓"; }  // picked: a tick, not a number (the button below has the count)
        else if (narrowing) { var n = 0; cur.items.forEach(function (it) { if (it.ep.cast.indexOf(k) >= 0) n++; }); f.setAttribute("data-add", n); badge.textContent = fmt(n); }
        else { f.removeAttribute("data-add"); badge.textContent = fmt(counts[k] || 0); }
      });
      var chars = cur.r.parsed.characters;
      tagsEl.hidden = !chars.length;  // chips show on the list (phones); the lit windows show it on the home screen
      tagsEl.innerHTML = chars.map(function (c) {
        return '<button class="tag" data-off="' + esc(c) + '" aria-label="Remove ' + esc(labelFor(c)) + '">' + esc(labelFor(c)) + icon("x") + "</button>";
      }).join("");
    }
    function syncHeader() {
      var n = cur.items.length, mine = isMine(), f = curFilter(), partial = !mine && cur.r.mode === "partial";
      roll($("[data-count]"), n);
      $("[data-pl]").textContent = partial ? (n === 1 ? "closest episode" : "closest episodes") : (n === 1 ? "episode" : "episodes");
      var w = mine ? [] : whatWords(cur.r.parsed), bits = [];
      if (partial) bits.push("none has all " + cur.r.asked); else if (w.length) bits.push("with " + w.join(" + "));
      if (f === "unwatched") bits.push("not watched yet"); else if (f === "watched") bits.push("watched"); else if (f === "saved") bits.push("saved");
      $("[data-ps]").textContent = bits.length ? " · " + bits.join(" · ") : "";
      // the filter pill: four choices on the list, two in My list
      var order = mine ? ["saved", "watched"] : FILTERS;
      seg.style.setProperty("--n", order.length); seg.style.setProperty("--k", Math.max(0, order.indexOf(f)));
      $$("button", seg).forEach(function (b) {
        b.setAttribute("aria-pressed", b.dataset.f === f);
        if (b.dataset.f === "saved") b.textContent = mine ? "Saved (" + fmt(saved.size) + ")" : "Saved";
        if (b.dataset.f === "watched") b.textContent = mine ? "Watched (" + fmt(watched.size) + ")" : "Watched";
      });
      clearBtn.hidden = !state.q;
      // the home button says what you will get
      var picked = !!state.q.trim();
      $("[data-cta]").textContent = partial ? "Show the " + fmt(n) + " closest" : "Show " + (picked ? "" : "all ") + fmt(n) + (n === 1 ? " episode" : " episodes");
      var sub = $("[data-ctasub]");
      sub.textContent = partial ? "No episode has all " + cur.r.asked + " \u00b7 " + (n === 1 ? "this has " : "these have ") + cur.r.best : (w.length ? w.join(" + ") : "or tap who you want to watch");
      sub.hidden = false;
      $(".unpick").hidden = !picked;
      var mc = $("[data-minecount]"); mc.textContent = saved.size ? fmt(saved.size) : ""; mc.hidden = !saved.size;
    }
    function syncTabs() { $$(".tabs button").forEach(function (b) { if (b.dataset.tab === state.view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }); }
    function doorsCycle() {
      if (!motionOK() || !doors[0].animate) return;
      var o = { duration: 720, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" };
      doors[0].animate([{ transform: "translateX(-100%)" }, { transform: "none", offset: .42 }, { transform: "none", offset: .5 }, { transform: "translateX(-100%)" }], o);
      doors[1].animate([{ transform: "translateX(100%)" }, { transform: "none", offset: .42 }, { transform: "none", offset: .5 }, { transform: "translateX(100%)" }], o);
    }
    function render(opts) {
      opts = opts || {};
      compute(); syncWindows(); syncHeader();
      var paint = function () { renderResults(opts.animate); if (opts.top) toTop(); };
      if (opts.doors && motionOK() && (state.view !== "home" || wide.matches)) { doorsCycle(); setTimeout(paint, 260); } else paint();
    }

    /* ---------- query edits (typing, windows, chips) ---------- */
    var typeTimer;
    function setQuery(v, opts) { state.q = v; q.value = v; state.limit = PAGE; state.armed = false; render(opts || { doors: true, top: true }); writeNav(false); }
    function isChar(token, name) { return S.parseQuery(I, token).characters.indexOf(name) >= 0; }
    function flip(name) {
      var tokens = state.q.split(/\s+/).filter(Boolean);
      var has = cur.r.parsed.characters.indexOf(name) >= 0;
      if (has) {
        var drop = tokens.map(function (t) { return isChar(t, name); });
        // "Dr. Hathi": take the title with the name
        tokens = tokens.filter(function (t, i) { return !drop[i] && !(drop[i + 1] && /^(dr\.?|mr|mrs|doctor)$/i.test(t)); });
        // "nattu kaka" is two words for one person: when one goes, the other goes too
        if (/\s/.test(labelFor(name))) { var parts = labelFor(name).toLowerCase().split(/\s+/); tokens = tokens.filter(function (t) { return parts.indexOf(t.toLowerCase()) < 0; }); }
      } else {
        tokens = tokens.concat(labelFor(name).toLowerCase());
      }
      setQuery(tokens.join(" "));
    }
    q.addEventListener("input", function () {
      state.q = q.value; state.limit = PAGE; state.armed = false; clearBtn.hidden = !q.value;
      clearTimeout(typeTimer); typeTimer = setTimeout(function () { render({ top: true }); writeNav(false); }, 90);
    });
    q.addEventListener("keydown", function (e) {
      if (e.key === "Escape") q.blur();
      if (e.key === "Enter" && state.view === "home" && !wide.matches) { e.preventDefault(); q.blur(); go("list"); }
    });

    /* ---------- the views (phones) ---------- */
    function openDoors() {  // the doors swing open one after another and each character steps out
      requestAnimationFrame(function () { requestAnimationFrame(function () { $$(".flat").forEach(function (f) { f.classList.add("open"); }); }); });
    }
    function shuffleAll() {  // close every door, pick a new random pose for everyone, open again
      $$(".flat").forEach(function (f) {
        var p = randomPose(f.dataset.k, f.dataset.pose); f.dataset.pose = p; $("img", f).src = stickerSrc(p); f.classList.remove("open");
      });
      void app.offsetWidth;
      openDoors();
    }
    function reroll(f) {  // a tapped character pops out in a new pose
      var img = $("img", f), p = randomPose(f.dataset.k, f.dataset.pose); f.dataset.pose = p;
      img.classList.remove("pop"); img.src = stickerSrc(p); void img.offsetWidth; img.classList.add("pop");
    }
    function applyView(changed) {
      app.dataset.view = state.view; syncTabs();
      if (changed) { window.scrollTo(0, 0); if (state.view === "home") shuffleAll(); }
    }
    function go(view) {
      if (state.view === view) { if (view !== "home") window.scrollTo(0, 0); return; }
      state.view = view; state.limit = PAGE; state.armed = false;
      applyView(true); render({ animate: true }); writeNav(true);
    }

    /* ---------- watched / saved ---------- */
    function toggleSet(set, key, n) {
      if (set.has(n)) set.delete(n); else set.add(n);
      save(key, Array.from(set));
    }
    function refreshAfterMark() { var y = getY(); compute(); syncHeader(); renderResults(false); setY(y); }

    /* ---------- the episode sheet ---------- */
    var sheet = null, scrim = null, opener = null, gen = 0;
    function watchLink(n) { var lo = ((n - 1) / 100 | 0) * 100 + 1; return SONYLIV + lo + "-" + (lo + 99); }
    // whose sticker goes on the sheet: the character the title names, else one you searched for, else whoever is in it
    function sheetPose(e) {
      var hasArt = function (c) { return !!artFor(c); };
      var inIt = e.cast.filter(hasArt);
      var who = S.parseQuery(I, e.title).characters.filter(hasArt)[0] ||
        cur.r.parsed.characters.filter(function (c) { return hasArt(c) && e.cast.indexOf(c) >= 0; })[0] ||
        inIt[e.n % Math.max(1, inIt.length)] || "Jethalal";
      var set = artFor(who);
      return set[e.n % set.length];
    }
    function rateHTML(e) {
      if (!R.on) return "";
      var busy = !!rating && rating.n === e.n, my = busy ? rating.stars : R.mine(e.n), sum = R.summary(e.n), b = "";
      for (var i = 1; i <= 5; i++) {
        b += '<button data-rate="' + i + '"' + (i <= my ? ' class="on"' : "") + ' aria-pressed="' + (i === my) + '" aria-label="' + i + (i === 1 ? " star" : " stars") + '"' + (busy ? " disabled" : "") + ">" + icon(i <= my ? "starf" : "star") + "</button>";
      }
      var all = sum ? "\u2605 " + sum.avg.toFixed(1) + " from " + fmt(sum.count) + (sum.count === 1 ? " rating" : " ratings") : "No ratings yet. Be the first.";
      return '<div class="rate"><div class="rate-row"><span class="rate-l" id="rate-l">' + (busy ? "Saving\u2026" : my ? "Your rating" : "Rate this episode") + '</span><span class="rate-stars" role="group" aria-labelledby="rate-l">' + b + '</span></div><p class="rate-all">' + all + "</p></div>";
    }
    function paintRate(e, focusStar) {  // redraw just the stars of the open sheet
      var box = sheet && state.open === e.n && $(".rate", sheet); if (!box) return;
      box.outerHTML = rateHTML(e);
      var f = focusStar && $('[data-rate="' + focusStar + '"]', sheet); if (f) f.focus();
    }
    function sheetHTML(e) {
      var rich = !!e.summary, w = watched.has(e.n), sv = saved.has(e.n), p = posOf.get(e.n);
      var prev = p > 0 ? nums[p - 1] : null, next = p < nums.length - 1 ? nums[p + 1] : null;
      var h = '<div class="grab"></div><button class="x" data-sheet="close" aria-label="Close">' + icon("x") + "</button>";
      if (e.watch && e.watch.length) h += thumbHTML(e, "hero");
      h += '<div class="sheet-top"><div><span class="epline">Episode ' + e.n + (e.aired ? " \u00b7 " + dayText(e.aired) : "") + "</span><h2 id=\"sheet-title\">" + esc(nice(e.title)) + "</h2></div>" + sticker(sheetPose(e), 76, "stk") + "</div>";
      // the main action first: it is what people came for
      if (e.watch && e.watch.length) {
        var m0 = e.watch[0];
        h += '<a class="btn watch" ' + playAttrs(m0.url) + ">" + icon("play") + (e.hl ? " Watch highlights on YouTube" : " Watch on YouTube") + "</a>" +
          '<p class="watchmeta">' + esc(m0.label) + (m0.quality ? " · " + esc(m0.quality) : "") + (m0.minutes ? " · " + m0.minutes + " min" : "") + (e.hl ? " · not the full episode" : "") + "</p>";
      } else {
        h += '<a class="btn watch" href="' + watchLink(e.n) + '" target="_blank" rel="noopener">' + icon("ext") + " Open on SonyLIV (Premium)</a>" +
          '<p class="watchmeta">No free upload found for this episode yet.</p>';
      }
      h += '<div class="row2"><button class="btn ghost' + (w ? " on" : "") + '" data-sheet="w" aria-pressed="' + w + '">' + icon("check") + (w ? " Watched" : " Mark watched") + "</button>" +
        '<button class="btn ghost' + (sv ? " on" : "") + '" data-sheet="s" aria-pressed="' + sv + '">' + icon("star") + (sv ? " Saved" : " Save") + "</button></div>";
      h += rateHTML(e);
      h += '<p class="syn">' + esc(rich ? e.summary : e.synopsis) + "</p>";
      if (rich && e.events.length) h += "<h3>Key moments</h3><ul class=\"moments\">" + e.events.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>";
      var who = e.cast.map(function (c) { return '<button data-who="' + esc(c) + '" aria-label="Show episodes with ' + esc(c) + '">' + esc(c) + "</button>"; }).join("") +
        (e.maybe || []).map(function (c) { return '<span class="maybe" title="Maybe in this episode">' + esc(c) + "?</span>"; }).join("");
      if (who) h += "<h3>Who's in it</h3><div class=\"who\">" + who + "</div>" + '<p class="hint">Tap a name to see their episodes. ' + (CAST_NOTE[e.castBy] || "") + "</p>";
      if (e.hl) h += '<p class="caution">The full episode is not on YouTube yet. The channels usually put it up about three weeks after it airs, and this guide switches to it by itself. Until then: the 10-minute highlights above, or the full episode on SonyLIV (Premium).</p>';
      if (e.note) h += '<p class="caution">' + esc(e.note) + "</p>";
      if (e.check) h += '<p class="caution">This video\'s own description fits a nearby episode slightly better, so the story may not match. If it doesn\'t, try another place to watch or the previous and next episode.</p>';
      var sony = e.hl ? '<a href="' + watchLink(e.n) + '" target="_blank" rel="noopener"><span>SonyLIV · full episode (Premium)</span><span>' + icon("ext") + "</span></a>" : "";
      if (sony || (e.watch && e.watch.length > 1)) h += "<h3>Other places to watch</h3><div class=\"others\">" + sony + e.watch.slice(1).map(function (x) {
        return "<a " + playAttrs(x.url) + "><span>" + esc(x.label) + (x.note ? " · " + esc(x.note) : "") + "</span><span>" + (x.minutes ? x.minutes + " min " : "") + icon("ext") + "</span></a>";
      }).join("") + "</div>";
      h += '<div class="pn"><button data-sheet="prev"' + (prev ? "" : " disabled") + ">" + icon("prev") + (prev ? " Episode " + prev : " Start") + '</button><button data-sheet="next"' + (next ? "" : " disabled") + ">" + (next ? "Episode " + next + " " : "End ") + icon("next") + "</button></div>";
      return h;
    }
    function ensureSheet() {
      if (sheet) return;
      scrim = document.createElement("div"); scrim.className = "scrim"; scrim.hidden = true;
      sheet = document.createElement("section"); sheet.className = "sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "sheet-title"); sheet.hidden = true;
      document.body.appendChild(scrim); document.body.appendChild(sheet);
      scrim.addEventListener("click", function () { closeSheet(); });
      sheet.addEventListener("click", function (ev) {
        var who = ev.target.closest("[data-who]");
        if (who) {  // a name in "Who's in it": show that character's episodes
          state.q = (LABEL[who.dataset.who] || who.dataset.who).toLowerCase(); q.value = state.q; state.filter = "all"; state.limit = PAGE;
          var was = state.view; if (!wide.matches) state.view = "list";
          hideSheet(); applyView(was !== state.view); render({ animate: true, top: true }); writeNav(false);
          return;
        }
        var star = ev.target.closest("[data-rate]");
        if (star) {  // rate the open episode: show it at once, take it back if the database says no
          var ep = byN.get(state.open), stars = +star.dataset.rate;
          if (rating || !ep || R.mine(ep.n) === stars) return;
          rating = { n: ep.n, stars: stars }; paintRate(ep);
          R.rate(ep.n, stars).then(function () { rating = null; toast("Thanks! Your rating is saved."); },
            function () { rating = null; toast("Couldn't save your rating. Check your connection and try again."); })
            .then(function () { paintRate(ep, stars); var y = getY(); renderResults(false); setY(y); });
          return;
        }
        var b = ev.target.closest("[data-sheet]"); if (!b || b.disabled) return;
        var a = b.dataset.sheet, e = byN.get(state.open);
        if (a === "close") return closeSheet();
        if (a === "prev" || a === "next") { var p = posOf.get(state.open) + (a === "next" ? 1 : -1); return showEpisode(nums[p]); }
        toggleSet(a === "w" ? watched : saved, a === "w" ? KEY.watched : KEY.saved, e.n);
        sheet.innerHTML = sheetHTML(e); burst($('[data-sheet="' + a + '"]', sheet)); refreshAfterMark();
      });
    }
    function showEpisode(n) {  // previous / next inside the open sheet: same history entry
      var e = byN.get(n); if (!e) return;
      state.open = n; sheet.innerHTML = sheetHTML(e); sheet.scrollTop = 0;
      writeNav(false);
    }
    function openSheet(n, from, fromNav) {
      var e = byN.get(n); if (!e) return;
      ensureSheet(); opener = from || document.activeElement;
      var wasOpen = !sheet.hidden;
      gen++; // a pending close must not hide a sheet that was just reopened
      state.open = n; sheet.innerHTML = sheetHTML(e); sheet.scrollTop = 0;
      scrim.hidden = false; sheet.hidden = false;
      if (!wasOpen) {
        scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D(200), fill: "both" });
        sheet.animate(wide.matches ? [{ transform: "translateX(100%)" }, { transform: "none" }] : [{ transform: "translateY(100%)" }, { transform: "none" }], { duration: D(300), easing: "cubic-bezier(.2,.9,.25,1.05)", fill: "both" });
      }
      // the sheet gets its own history entry, so the phone's Back button closes it
      if (fromNav) sheetPushed = true; else if (!wasOpen) sheetPushed = writeNav(true); else writeNav(false);
      var x = $(".x", sheet); if (x) x.focus({ preventScroll: true });
    }
    function hideSheet() {  // take the sheet off the screen (the caller looks after the history)
      if (!sheet || sheet.hidden) return;
      state.open = null; sheetPushed = false;
      var mine = ++gen;
      function fin() {
        if (gen !== mine || sheet.hidden) return;
        sheet.hidden = true; scrim.hidden = true;
        if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
      }
      scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(160), fill: "both" });
      sheet.animate(wide.matches ? [{ transform: "none" }, { transform: "translateX(100%)" }] : [{ transform: "none" }, { transform: "translateY(100%)" }], { duration: D(200), easing: "ease-in", fill: "both" }).finished.then(fin, fin);
      setTimeout(fin, D(200) + 120); // some hosts pause animations in the background; never leave the sheet stuck open
    }
    function closeSheet() {  // the X, the dark area or Esc: go back over the sheet's own history entry
      if (!sheet || sheet.hidden) return;
      if (sheetPushed) { sheetPushed = false; try { history.back(); return; } catch (e) { /* fall through */ } }
      hideSheet(); writeNav(false);
    }
    window.addEventListener("popstate", function (ev) {
      var st = ev.state, was = state.view, n = null;
      if (st && st.gg) { state.view = VIEWS.indexOf(st.view) >= 0 ? st.view : "home"; state.q = st.q || ""; state.filter = validFilter(st.filter); state.mine = validMine(st.mine); n = st.sheet; }
      else if (useHash) n = readHash(false);
      else { state.view = "home"; }
      q.value = state.q; state.limit = PAGE;
      applyView(was !== state.view); render({ animate: false });
      if (n && byN.has(n)) openSheet(n, null, true); else hideSheet();
      savePlace();
    });

    /* ---------- surprise me ---------- */
    var lastPick = null, rolling = false;
    function surprise() {
      if (rolling) return;
      var eps = cur.items.map(function (i) { return i.ep; }).filter(function (e) { return e.videoId; });
      var pick = S.pickSurprise(eps, watched, Math.random, lastPick);
      if (!pick) { toast("Nothing to pick from. Clear the search first."); return; }
      lastPick = pick.n;
      if (!motionOK()) { openSheet(pick.n); return; }
      rolling = true;
      var o = document.createElement("div"); o.className = "surprise"; o.setAttribute("role", "status");
      o.innerHTML = sticker("whoa", 140) + "<b>0</b><p>Jethalal is choosing…</p>"; document.body.appendChild(o);
      var b = $("b", o), t = 0, timer = setInterval(function () {
        t++; b.textContent = eps[Math.random() * eps.length | 0].n;
        if (t >= 13) { clearInterval(timer); b.textContent = pick.n; setTimeout(function () { o.remove(); rolling = false; openSheet(pick.n); }, 450); }
      }, 70);
    }

    /* ---------- clicks and keys ---------- */
    app.addEventListener("click", function (ev) {
      var t = ev.target;
      var tab = t.closest("[data-tab]"); if (tab) return go(tab.dataset.tab);
      var f = t.closest(".flat"); if (f) { flip(f.dataset.k); reroll(f); return; }
      var off = t.closest("[data-off]"); if (off) return flip(off.dataset.off);
      var sg = t.closest("[data-f]");
      if (sg) {
        if (isMine()) state.mine = validMine(sg.dataset.f); else state.filter = sg.dataset.f;
        state.limit = PAGE; state.armed = false; render({ doors: true, top: true }); writeNav(false); return;
      }
      if (t.closest("a.thumb")) return;  // the picture is a link: it plays the episode
      var c = t.closest(".ecard"); if (c) return openSheet(+c.dataset.n, c);
      var a = t.closest("[data-act]"); if (!a) return;
      switch (a.dataset.act) {
        case "clear": setQuery(""); q.focus(); break;
        case "unpick": setQuery(""); break;
        case "list": go("list"); break;
        case "more": state.limit += PAGE; var y = getY(); renderResults(false); setY(y); savePlace(); break;
        case "surprise": surprise(); break;
        case "night": state.night = !state.night; save(KEY.night, state.night); setNight(); break;
        case "reset":
          if (!state.armed) { state.armed = true; a.textContent = "Tap again to clear " + cur.items.length; setTimeout(function () { state.armed = false; var b2 = $('[data-act="reset"]'); if (b2) b2.textContent = "Clear " + curFilter() + " list"; }, 4000); break; }
          var set = curFilter() === "watched" ? watched : saved; cur.items.forEach(function (i) { set.delete(i.ep.n); });
          save(curFilter() === "watched" ? KEY.watched : KEY.saved, Array.from(set)); state.armed = false; render({ top: true }); toast("Cleared."); break;
      }
    });
    // swipe left / right on the list to move between All, To watch, Watched and Saved (or Saved and Watched in My list)
    var sw = null, panelEl = $(".panel");
    function stepFilter(dir) {
      var order = isMine() ? ["saved", "watched"] : FILTERS, i = order.indexOf(curFilter()) + dir;
      if (i < 0 || i >= order.length) return;
      if (isMine()) state.mine = order[i]; else state.filter = order[i];
      state.limit = PAGE; state.armed = false; render({ top: true }); writeNav(false);
      res.classList.remove("slide-l", "slide-r"); void res.offsetWidth; res.classList.add(dir > 0 ? "slide-l" : "slide-r");
    }
    panelEl.addEventListener("touchstart", function (e) {
      sw = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
    }, { passive: true });
    panelEl.addEventListener("touchend", function (e) {
      if (!sw || wide.matches) return;
      var t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y, quick = Date.now() - sw.t < 700; sw = null;
      if (quick && Math.abs(dx) > 64 && Math.abs(dx) > 2.2 * Math.abs(dy)) stepFilter(dx < 0 ? 1 : -1);
    }, { passive: true });
    res.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("ecard")) { e.preventDefault(); openSheet(+e.target.dataset.n, e.target); }
    });
    document.addEventListener("keydown", function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ""));
      if (sheet && !sheet.hidden) {
        if (e.key === "Escape") { e.preventDefault(); closeSheet(); return; }
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") { var p = posOf.get(state.open) + (e.key === "ArrowRight" ? 1 : -1); if (nums[p]) showEpisode(nums[p]); return; }
        if (e.key === "Tab") { // keep focus inside the sheet
          var els = $$("a[href], button:not([disabled])", sheet); if (!els.length) return;
          var first = els[0], last = els[els.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); q.focus(); } else if (e.key === "s" || e.key === "S") { surprise(); }
    });
    // remember how far down the list you were (a reload after coming back from YouTube puts you back there)
    var scrollTimer;
    window.addEventListener("scroll", function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(savePlace, 250); }, { passive: true });
    window.addEventListener("pagehide", savePlace);

    applyView(false);
    render({ animate: true });

    // ask the website for a newer list of changes; when there is one, keep it for next time and show it now
    var liveUrl = CFG.live === undefined ? "data/live.json" : CFG.live;
    if (liveUrl && window.fetch) {
      fetch(liveUrl, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (l) {
        if (!l || typeof l !== "object" || liveVer(l) <= liveVer(liveNow)) return;
        var changed = !liveNow || l.updated !== liveNow.updated;
        liveNow = l; save(LIVE_KEY, l);
        if (!changed) { if (D0.live) D0.live.checked = String(l.checked || ""); return; }
        S.applyLive(D0, l); load();
        q.setAttribute("aria-label", "Search all " + fmt(D0.episodes.length) + " episodes by who is in them or what happens");
        if (state.open && !byN.has(state.open)) hideSheet();
        render({ animate: false });
      }).catch(function () { /* offline, or opened as a file: the copy at hand stays */ });
    }
    // everyone's ratings: the copy on the device shows at once; a newer one (asked for at most every 10 minutes) redraws
    if (R.on) R.load().then(function (changed) {
      if (!changed) return;
      var y = getY(); renderResults(false); setY(y);
      var open = state.open && byN.get(state.open); if (open && !rating) paintRate(open);
    }).catch(function () { /* offline: the stars on the device stay */ });
    openDoors();
    writeNav(false);
    if (restoreY && state.view !== "home") requestAnimationFrame(function () { window.scrollTo(0, restoreY); });
    if (openFromHash) openSheet(openFromHash);
  }

  boot();
})();
