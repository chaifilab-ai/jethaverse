/* JethaVerse service worker. This is the template; tools/build_site.py fills in VERSION and SHELL and writes the result
 * to the website as sw.js.
 *
 * What it does: keeps the whole website (page, scripts, the episode list, the pictures) in the phone after the first
 * visit, so the guide opens with no signal and can be installed as an app. Videos still need the internet.
 *
 *   own files               from the phone's copy first. VERSION changes whenever any of them changes, which makes the
 *                           browser fetch the new copy in the background; the visit after that shows it.
 *   data/live.json          (new episodes, replaced links) from the network first, the last copy when offline
 *   Google Fonts            the phone's copy first, refreshed in the background
 *   everything else         untouched (YouTube pictures, the one-file copy's address for live.json)
 */
var VERSION = "__VERSION__";
var SHELL = __SHELL__;
var CACHE = "jv-" + VERSION, FONTS = "jv-fonts", LIVE = "jv-live";

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("jv-") === 0 && k !== CACHE && k !== FONTS && k !== LIVE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function ownFile(req) {
  return caches.open(CACHE).then(function (c) { return c.match(req, { ignoreSearch: true }); }).then(function (hit) {
    if (hit) return hit;
    return fetch(req).catch(function () {
      return req.mode === "navigate" ? caches.open(CACHE).then(function (c) { return c.match("./"); }) : Response.error();
    });
  });
}

function liveFile(req) {
  return fetch(req).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(LIVE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.open(LIVE).then(function (c) { return c.match(req, { ignoreSearch: true }); }).then(function (hit) { return hit || Response.error(); });
  });
}

function font(req) {
  return caches.open(FONTS).then(function (c) {
    return c.match(req).then(function (hit) {
      var fresh = fetch(req).then(function (res) {
        if (res.ok || res.type === "opaque") c.put(req, res.clone());
        return res;
      }).catch(function () { return hit || Response.error(); });
      return hit || fresh;
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (/\/data\/live\.json$/.test(url.pathname)) e.respondWith(liveFile(req));
    else e.respondWith(ownFile(req));
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(font(req));
  }
});
