/* JethaVerse: the Watched and Saved lists, as plain functions (no page needed; tested in Node, tests/lists.test.js).
 *
 *   encode({ watched, saved, last })   ->  "JV1|w=1-120,130|s=5,9|l=130"   (the backup code; runs of episodes are written as ranges)
 *   decode(text)                       ->  { watched: [..], saved: [..], last: n | null }, or null when it is not a backup code
 *   nextUnwatched(last, has, nums)     ->  the first episode after `last` that `has(n)` says is not watched yet, or null
 *
 * decode() accepts the code with other words around it (a pasted WhatsApp message), and is strict about the code itself:
 * numbers 1 to 99999 only, ranges the right way round, and no more than 100,000 numbers in all. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GGLists = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAX = 99999, LIMIT = 100000;

  function clean(list) {  // sorted, each once, only whole numbers 1..MAX
    var seen = {}, out = [];
    Array.from(list || []).forEach(function (n) {
      n = Number(n);
      if (Number.isInteger(n) && n >= 1 && n <= MAX && !seen[n]) { seen[n] = 1; out.push(n); }
    });
    return out.sort(function (a, b) { return a - b; });
  }

  function toRanges(list) {  // [1,2,3,5] -> "1-3,5"
    var a = clean(list), out = [], i = 0;
    while (i < a.length) {
      var j = i;
      while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
      out.push(j > i + 1 ? a[i] + "-" + a[j] : a.slice(i, j + 1).join(","));
      i = j + 1;
    }
    return out.join(",");
  }

  function fromRanges(text) {  // "1-3,5" -> [1,2,3,5]; null when it is not that
    if (text === "") return [];
    if (!/^[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*$/.test(text)) return null;
    var out = [], parts = text.split(",");
    for (var i = 0; i < parts.length; i++) {
      var ab = parts[i].split("-"), a = +ab[0], b = ab.length > 1 ? +ab[1] : a;
      if (!(a >= 1 && b >= a && b <= MAX) || out.length + (b - a + 1) > LIMIT) return null;
      for (var n = a; n <= b; n++) out.push(n);
    }
    return out;
  }

  function encode(o) {
    o = o || {};
    var last = Number(o.last);
    return "JV1|w=" + toRanges(o.watched) + "|s=" + toRanges(o.saved) + "|l=" + (Number.isInteger(last) && last >= 1 && last <= MAX ? last : "");
  }

  function decode(text) {
    var m = /JV1\|w=([0-9,\-]*)\|s=([0-9,\-]*)\|l=([0-9]*)/.exec(String(text == null ? "" : text));
    if (!m) return null;
    var w = fromRanges(m[1]), s = fromRanges(m[2]);
    if (w === null || s === null) return null;
    var l = m[3] === "" ? null : Number(m[3]);
    if (l !== null && !(l >= 1 && l <= MAX)) l = null;
    return { watched: w, saved: s, last: l };
  }

  function nextUnwatched(last, has, nums) {
    last = Number(last);
    if (!(last >= 1) || !nums || !nums.length) return null;
    var lo = 0, hi = nums.length;  // first position whose episode number is above `last`
    while (lo < hi) { var mid = (lo + hi) >> 1; if (nums[mid] > last) hi = mid; else lo = mid + 1; }
    for (var i = lo; i < nums.length; i++) if (!has(nums[i])) return nums[i];
    return null;
  }

  return { encode: encode, decode: decode, nextUnwatched: nextUnwatched, toRanges: toRanges, fromRanges: fromRanges };
});
