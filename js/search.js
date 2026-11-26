/* JethaVerse (formerly Jethiya, Gokuldham Guide) — search and filtering.
 * Pure functions, no DOM: runs in the browser (window.GGSearch) and in Node tests (require).
 *
 * Search model
 * - A query is split into words. Character names (English, Hindi, nicknames, small typos)
 *   become character requirements. Episode numbers jump straight to that episode.
 * - Every other word is a topic. It is expanded with synonyms (ganpati -> ganesh) and matched
 *   against title, key moments, arc, summary and synopsis by exact word, prefix or one-letter typo.
 * - "all" mode: episodes matching every character and every topic.
 *   "partial" mode: nothing matched everything, so show the closest episodes and say which
 *   words found nothing at all ("London").
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GGSearch = factory();
})(this, function () {
  "use strict";

  var STOP = new Set(("in the a an of on at to for with and or ka ki ke ko me mein se hai wala wali wale aur " +
    "episode episodes ep show where when which who is are was gets get his her their about find all " +
    "tmkoc ooltah ulta chashmah chashma does do did one that this " +
    "bhabhi ben ji saheb sahab bhai master kaka mr mrs dr").split(" "));

  // Topic synonyms. Keys and values are normalised words; multi-word values are phrases.
  var SYN = {
    ganesh: ["ganpati", "ganapati", "ganesha", "vinayak", "ganeshotsav", "bappa"],
    navratri: ["garba", "dandiya", "navratra", "navaratri"],
    garba: ["navratri", "dandiya"], dandiya: ["navratri", "garba"],
    rakhi: ["raksha", "bandhan"], raksha: ["rakhi"],
    diwali: ["deepavali", "divali", "crackers", "firecracker", "lights"],
    police: ["cop", "inspector", "arrest", "arrested", "jail", "thana", "station"],
    arrest: ["police", "jail", "arrested"], jail: ["police", "arrest"],
    kidnap: ["kidnapped", "kidnapping", "abduct", "abducted", "kidnapper", "missing"],
    kidney: ["donor", "sheikh", "transplant"], sheikh: ["shaikh", "kidney"],
    strike: ["hartal", "protest", "movement", "rebel", "union"],
    tv: ["television", "remote", "channel"], television: ["tv"],
    fast: ["vrat", "upvas", "teej", "fasting"], teej: ["fast", "vrat", "hartalika"], vrat: ["fast", "teej"],
    tantrik: ["baba", "charm", "tabeez", "tabiz", "magic", "sadhu", "amulet"], baba: ["tantrik"],
    school: ["teacher", "principal", "class", "tuition"],
    mobile: ["phone", "cellphone", "cell"], phone: ["mobile", "cellphone"],
    rain: ["barish", "baarish", "monsoon", "flood", "rains", "waterlogging"],
    bomb: ["explosive", "bombs"],
    poem: ["poetry", "kavi", "sammelan", "poet", "kavita"], kavi: ["poem", "poetry", "sammelan", "poet"],
    cricket: ["bat", "batting", "bowling"],
    matki: ["dahi", "handi", "janmashtami", "govinda"],
    janmashtami: ["krishna", "matki", "handi", "gokulashtami"],
    card: ["cards", "gamble", "gambling", "patti"], gamble: ["card", "gambling"],
    fight: ["quarrel", "argument", "jhagda", "fights", "angry", "row"],
    money: ["paisa", "cash", "rupee", "rupees", "loan", "lakh"],
    shop: ["electronics", "dukaan", "store"],
    wedding: ["marriage", "shaadi", "vivah"], marriage: ["wedding", "shaadi"],
    food: ["khana", "fafda", "jalebi", "dinner", "lunch", "breakfast"],
    labour: ["labor", "worker"], labor: ["labour"],
    wife: ["wives", "patni"], wives: ["wife", "patni"],
    husband: ["pati"], child: ["children", "kids", "kid"], children: ["child", "kids", "kid"],
    kid: ["children", "child"], goon: ["goons", "gunda", "thug", "thugs"], gunda: ["goon"],
    dance: ["dancing", "garba", "dandiya", "nach"], song: ["sing", "singing", "music"],
    hospital: ["doctor", "operation", "surgery"], doctor: ["hospital"],
    london: ["england", "uk", "abroad", "foreign", "videsh"], abroad: ["foreign", "videsh", "london"]
  };

  var FIELDS = [ // name, weight
    ["title", 5], ["events", 4], ["arc", 4], ["summary", 3], ["synopsis", 3]
  ];

  // Built from code points so this file stays plain ASCII (safe under any page encoding).
  var LATIN_ACCENTS = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");
  var NUKTA = new RegExp(String.fromCharCode(0x93c), "g"); // Devanagari nukta: treat ड़ like ड

  function norm(s) {
    return String(s || "").normalize("NFD")
      .replace(LATIN_ACCENTS, "")
      .replace(NUKTA, "")
      .toLowerCase();
  }

  function stem(w) {
    if (/^[a-z]+$/.test(w) && w.length > 4 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function words(s) {
    return norm(s).split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean);
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var rowMin = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function typoBudget(t) { return t.length >= 8 ? 2 : t.length >= 5 ? 1 : 0; }

  // How well query word t matches document word w (0 = no match).
  function wordMatch(t, w, exactOnly) {
    if (w === t) return 1;
    if (exactOnly) return 0;
    if (t.length >= 3 && w.indexOf(t) === 0) return 0.8;
    var k = typoBudget(t);
    if (k && /^[a-z]+$/.test(t) && lev(t, w, k) <= k) return 0.6;
    return 0;
  }

  function createIndex(data) {
    // Episodes 51+ come from SonyLIV text only: no summary, key moments, arcs or "maybe" cast. Fill the gaps once.
    data.episodes.forEach(function (ep) {
      ep.events = ep.events || []; ep.summary = ep.summary || ""; ep.arcs = ep.arcs || [];
      ep.maybe = ep.maybe || []; ep.cast = ep.cast || [];
    });
    var arcsById = {};
    data.arcs.forEach(function (a) { arcsById[a.id] = a; });
    var family = {};
    data.families.forEach(function (f) { f.members.forEach(function (m) { family[m] = f.house; }); });

    // alias phrase (as word array joined by space) -> character name
    var aliases = [];
    Object.keys(data.characters).forEach(function (name) {
      var list = [name].concat(data.characters[name].aliases || []);
      list.forEach(function (a) {
        var ws = words(a);
        if (ws.length) aliases.push({ words: ws, key: ws.join(" "), name: name });
      });
    });
    aliases.sort(function (a, b) { return b.words.length - a.words.length; });

    var docs = data.episodes.map(function (ep) {
      // arc names only: arc descriptions mention sub-events and would match every episode of the arc
      var arcText = ep.arcs.map(function (id) { return arcsById[id] ? arcsById[id].name : ""; }).join(" ");
      var f = {
        title: ep.title, events: ep.events.join(" "), arc: arcText,
        summary: ep.summary, synopsis: ep.synopsis
      };
      var fieldWords = {};
      FIELDS.forEach(function (fw) {
        var set = new Set();
        words(f[fw[0]]).forEach(function (w) { set.add(w); set.add(stem(w)); });
        fieldWords[fw[0]] = Array.from(set);
      });
      return { ep: ep, fieldWords: fieldWords };
    });

    return {
      data: data, docs: docs, aliases: aliases, arcsById: arcsById, family: family,
      maxEpisode: data.episodes.reduce(function (m, e) { return Math.max(m, e.n); }, 0)
    };
  }

  // Split a query into characters, episode numbers and topic groups.
  function parseQuery(index, q) {
    var ws = words(q);
    var chars = [], numbers = [], topics = [], used = new Array(ws.length).fill(false);

    // 1) multi-word and single-word character aliases (exact)
    index.aliases.forEach(function (al) {
      for (var i = 0; i + al.words.length <= ws.length; i++) {
        var ok = true;
        for (var j = 0; j < al.words.length; j++) if (used[i + j] || ws[i + j] !== al.words[j]) { ok = false; break; }
        if (ok) {
          for (j = 0; j < al.words.length; j++) used[i + j] = true;
          if (chars.indexOf(al.name) < 0) chars.push(al.name);
        }
      }
    });

    ws.forEach(function (w, i) {
      if (used[i]) return;
      if (/^\d{1,4}$/.test(w)) { numbers.push(+w); return; }
      if (STOP.has(w)) return;
      // 2) character nickname with a small typo (jethlal, babitha)
      var k = typoBudget(w);
      if (k && /^[a-z]+$/.test(w)) {
        var best = null;
        index.aliases.forEach(function (al) {
          if (al.words.length !== 1) return;
          var d = lev(w, al.words[0], k);
          if (d <= k && (!best || d < best.d)) best = { d: d, name: al.name };
        });
        if (best) { if (chars.indexOf(best.name) < 0) chars.push(best.name); return; }
      }
      var t = stem(w);
      var group = [t].concat(SYN[t] || SYN[w] || []);
      topics.push({ word: w, terms: group.map(function (g) { return words(g).map(stem); }) });
    });
    return { characters: chars, numbers: numbers, topics: topics };
  }

  function hasCharacter(ep, name, includeMaybe) {
    return ep.cast.indexOf(name) >= 0 || (includeMaybe && ep.maybe.indexOf(name) >= 0);
  }

  function passesFilters(ep, opts) {
    opts = opts || {};
    var chars = opts.characters || [];
    for (var i = 0; i < chars.length; i++) if (!hasCharacter(ep, chars[i], opts.includeMaybe)) return false;
    if (opts.arc && ep.arcs.indexOf(opts.arc) < 0) return false;
    if (opts.watched && opts.watched !== "all" && opts.watchedSet) {
      var w = opts.watchedSet.has(ep.n);
      if (opts.watched === "watched" && !w) return false;
      if (opts.watched === "unwatched" && w) return false;
    }
    return true;
  }

  // Score one topic group against a doc: best field weight x match quality, plus the doc words it hit.
  function scoreTopic(doc, topic) {
    var best = 0, total = 0, hits = [];
    FIELDS.forEach(function (fw) {
      var fieldWords = doc.fieldWords[fw[0]], fieldBest = 0;
      topic.terms.forEach(function (phrase, ti) {
        var exactOnly = ti > 0; // synonyms must match exactly; typos/prefixes only for the user's own word
        // phrase = array of words; every word must match somewhere in this field
        var q = 1, phraseHits = [];
        for (var p = 0; p < phrase.length; p++) {
          var m = 0, hit = null;
          for (var i = 0; i < fieldWords.length; i++) {
            var s = wordMatch(phrase[p], fieldWords[i], exactOnly);
            if (s > m) { m = s; hit = fieldWords[i]; if (s === 1) break; }
          }
          if (!m) { q = 0; break; }
          q = Math.min(q, m); phraseHits.push(hit);
        }
        if (q) {
          // the user's own word beats a synonym slightly
          var score = fw[1] * q * (ti === 0 ? 1 : 0.9);
          if (score > fieldBest) fieldBest = score;
          phraseHits.forEach(function (h) { if (hits.indexOf(h) < 0) hits.push(h); });
        }
      });
      if (fieldBest > best) best = fieldBest;
      total += fieldBest;
    });
    // best field counts fully; every other field that also mentions it adds a little
    return { score: best ? best + 0.3 * (total - best) : 0, hits: hits };
  }

  /**
   * search(index, query, opts) -> {
   *   mode: "browse" | "all" | "partial" | "none",
   *   items: [{ ep, score, matched: n topics matched, hits: [doc words to highlight] }],
   *   parsed: { characters, numbers, topics },
   *   missing: [topic words no episode in scope mentions],
   *   missingCharacters: [characters with no episode in scope]
   * }
   * opts: { characters: [], includeMaybe, arc, watched: "all"|"watched"|"unwatched", watchedSet: Set }
   */
  function search(index, query, opts) {
    opts = opts || {};
    var scope = index.docs.filter(function (d) { return passesFilters(d.ep, opts); });
    var parsed = parseQuery(index, query || "");
    var hasQuery = parsed.characters.length || parsed.numbers.length || parsed.topics.length;
    if (!hasQuery) {
      return {
        mode: scope.length ? "browse" : "none", parsed: parsed, missing: [], missingCharacters: [],
        items: scope.map(function (d) { return { ep: d.ep, score: 0, matched: 0, hits: [] }; })
      };
    }

    var rows = scope.map(function (d) {
      var row = { ep: d.ep, score: 0, matched: 0, charOk: 0, hits: [], topicHit: [], lacks: [] };
      parsed.characters.forEach(function (c) {
        if (hasCharacter(d.ep, c, opts.includeMaybe)) { row.charOk++; row.score += 2; } else row.lacks.push(c);
      });
      parsed.topics.forEach(function (t, i) {
        var r = scoreTopic(d, t);
        row.topicHit[i] = r.score > 0;
        if (r.score > 0) { row.matched++; row.score += r.score; row.hits = row.hits.concat(r.hits); }
      });
      if (parsed.numbers.indexOf(d.ep.n) >= 0) row.score += 100;
      return row;
    });

    var missing = parsed.topics.filter(function (t, i) {
      return !rows.some(function (r) { return r.topicHit[i]; });
    }).map(function (t) { return t.word; });
    var missingCharacters = parsed.characters.filter(function (c) {
      return !scope.some(function (d) { return hasCharacter(d.ep, c, opts.includeMaybe); });
    });

    var nChars = parsed.characters.length, nTopics = parsed.topics.length;
    var exact = rows.filter(function (r) {
      return (parsed.numbers.indexOf(r.ep.n) >= 0) ||
        ((nChars || nTopics) && r.charOk === nChars && r.matched === nTopics);
    });
    var byScore = function (a, b) {
      return (b.score - a.score) || (a.ep.n - b.ep.n);
    };
    if (exact.length) {
      exact.sort(byScore);
      return { mode: "all", parsed: parsed, missing: missing, missingCharacters: missingCharacters, asked: nChars + nTopics, best: nChars + nTopics, items: exact.map(clean) };
    }
    // Nothing has everything. The closest episodes are the ones that match the MOST of what was asked (3 of 4 picked
    // characters, say), and only those: an episode with just one of four names is not a close match.
    var best = 0;
    rows.forEach(function (r) { if (r.charOk + r.matched > best) best = r.charOk + r.matched; });
    var partial = best ? rows.filter(function (r) { return r.charOk + r.matched === best; }) : [];
    partial.sort(byScore);
    return {
      mode: partial.length ? "partial" : "none", parsed: parsed, missing: missing,
      missingCharacters: missingCharacters, asked: nChars + nTopics, best: best, items: partial.map(clean)
    };

    function clean(r) { return { ep: r.ep, score: r.score, matched: r.matched + r.charOk, hits: r.hits, lacks: r.lacks }; }
  }

  // How many episodes would remain if `name` were added to the current character filter.
  function countWith(index, opts, name) {
    var chars = (opts.characters || []).concat(opts.characters && opts.characters.indexOf(name) >= 0 ? [] : [name]);
    var o = Object.assign({}, opts, { characters: chars });
    return index.docs.filter(function (d) { return passesFilters(d.ep, o); }).length;
  }

  // Random pick that prefers episodes not yet watched. rng() -> [0,1)
  function pickSurprise(episodes, watchedSet, rng, avoid) {
    rng = rng || Math.random;
    if (!episodes.length) return null;
    var pool = episodes.filter(function (e) { return !(watchedSet && watchedSet.has(e.n)); });
    if (!pool.length) pool = episodes.slice();
    if (pool.length > 1 && avoid != null) pool = pool.filter(function (e) { return e.n !== avoid; });
    return pool[Math.floor(rng() * pool.length)];
  }

  // Regex that highlights words starting with any hit (hits are normalised/stemmed doc words).
  function highlightRegex(hits) {
    var uniq = Array.from(new Set(hits.filter(function (h) { return h && h.length > 1; })));
    if (!uniq.length) return null;
    uniq.sort(function (a, b) { return b.length - a.length; });
    var alt = uniq.map(function (h) { return h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
    return new RegExp("(?<![\\p{L}\\p{M}\\p{N}])(?:" + alt + ")[\\p{L}\\p{M}]*", "giu");
  }

  /* ---------- live changes (data/live.json) laid over the built-in list ----------
   * tools/sync_new.py and tools/check_links.py keep a small file of changes: links that are gone from YouTube ("dead"),
   * links that were added ("links", by episode number) and episodes newer than the built-in list ("episodes").
   * applyLive() lays that file over the data in place. It can be called again with a newer file: it always starts from
   * the built-in state. Order of an episode's links afterwards: full-length ones (built-in first, then added), then
   * short uploads, then highlights; the first one is the main link. Returns how many episodes it changed. */
  function isShort(w) { return /short upload/.test(w.note || "") || (w.minutes > 0 && w.minutes < 15); }
  function applyLive(data, live) {
    var eps = data.episodes.filter(function (e) { return !e._live; });
    eps.forEach(function (e) {
      if (!e._base) return;
      for (var k in e._base) { if (e._base[k] === undefined) delete e[k]; else e[k] = e._base[k]; }
      delete e._base;
    });
    data.episodes = eps; data.live = null;
    if (!live || typeof live !== "object") return 0;
    var dead = Object.create(null); (Array.isArray(live.dead) ? live.dead : []).forEach(function (id) { dead[id] = 1; });
    var links = live.links || {}, extra = live.episodes || {}, byN = Object.create(null), touched = 0;
    eps.forEach(function (e) { byN[e.n] = e; });
    Object.keys(extra).forEach(function (k) {
      var n = +k, x = extra[k];
      if (!(n > 0) || n !== Math.floor(n) || byN[n] || !x || !x.title) return;  // only numbers the built-in list lacks
      var e = {
        n: n, title: String(x.title), synopsis: String(x.synopsis || ""), castBy: "t", aired: String(x.aired || ""),
        cast: (x.cast || []).filter(function (c) { return !!data.characters[c]; }),
        videoId: null, channel: "SonyLIV", minutes: 0, watch: [], _live: 1
      };
      eps.push(e); byN[n] = e; touched++;
    });
    eps.forEach(function (e) {
      var add = (Array.isArray(links[e.n]) ? links[e.n] : []).filter(function (x) { return x && /^[\w-]{11}$/.test(x.id) && !dead[x.id]; });
      var gone = e.watch.some(function (w) { return dead[w.id]; });
      if (!add.length && !gone) return;
      if (!e._live) { e._base = { watch: e.watch, videoId: e.videoId, channel: e.channel, minutes: e.minutes, note: e.note, check: e.check }; touched++; }
      var main0 = e.watch[0] ? e.watch[0].id : null, have = Object.create(null);
      var list = e.watch.filter(function (w) { return !dead[w.id]; });
      list.forEach(function (w) { have[w.id] = 1; });
      add.forEach(function (x) {
        if (have[x.id]) return;
        have[x.id] = 1;
        var hl = x.kind === "highlights";
        list.push({
          label: String(x.label || "YouTube"), note: hl ? "highlights" : String(x.note || ""), url: "https://www.youtube.com/watch?v=" + x.id,
          id: x.id, quality: String(x.quality || ""), minutes: +x.minutes || 0, hl: hl ? 1 : 0, check: x.check ? 1 : 0
        });
      });
      list = list.map(function (w, i) { return [w.hl ? 2 : isShort(w) ? 1 : 0, i, w]; })
        .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).map(function (t) { return t[2]; });
      e.watch = list;
      var m = list[0];
      delete e.hl;
      if (!m) { e.videoId = null; e.channel = "SonyLIV"; delete e.check; return; }
      e.videoId = m.id; e.channel = m.label;
      if (m.minutes) e.minutes = m.minutes;
      if (m.hl) e.hl = 1;
      if (m.id !== main0) {  // the "may not match" and "only a short video" notes were about the old main link
        if (m.check) e.check = 1; else delete e.check;
        if (!isShort(m) && /^The only video found/.test(e.note || "")) delete e.note;
      }
    });
    eps.sort(function (a, b) { return a.n - b.n; });
    data.live = { updated: String(live.updated || ""), checked: String(live.checked || "") };
    return touched;
  }

  return {
    applyLive: applyLive,
    norm: norm, words: words, stem: stem, lev: lev, createIndex: createIndex, parseQuery: parseQuery,
    passesFilters: passesFilters, search: search, countWith: countWith, pickSurprise: pickSurprise,
    highlightRegex: highlightRegex, hasCharacter: hasCharacter, SYN: SYN
  };
});
