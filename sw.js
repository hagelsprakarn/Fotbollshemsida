// Service worker: gör att JodaFoot kan installeras som app på mobilen och fungerar
// (med senast sparade innehåll) även utan internet.
//
// Hemsidans egna filer hämtas alltid från nätet först, så att man direkt får den
// senaste versionen efter en uppdatering. Bara om nätet saknas används den sparade
// kopian. Fotbollsdatan från mellanhanden rör vi inte, den hämtas som vanligt.

const CACHE = "jodafoot-v1";

// Sidorna och filerna som sparas direkt när appen installeras
const FILER = [
  "./",
  "foljer.html",
  "ligor.html",
  "matcher.html",
  "match.html",
  "nyheter.html",
  "sok.html",
  "spelare.html",
  "css/style.css",
  "js/api.js",
  "js/bladdra.js",
  "js/script.js",
  "js/foljer.js",
  "js/ligor.js",
  "js/matcher.js",
  "js/match.js",
  "js/nyheter.js",
  "js/sok.js",
  "js/spelare.js",
  "manifest.json",
  "ikoner/ikon-192.png",
  "ikoner/ikon-512.png"
];

self.addEventListener("install", function (e) {
  // En fil i taget: saknas någon fil ska resten ändå sparas (addAll skulle ge upp helt)
  e.waitUntil(caches.open(CACHE).then(function (cache) {
    return Promise.all(FILER.map(function (fil) {
      return cache.add(fil).catch(function () {});
    }));
  }));
  self.skipWaiting();   // ta över direkt, vänta inte tills alla flikar är stängda
});

// Ta bort sparade kopior från äldre versioner (om CACHE har bytt namn)
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (namn) {
    return Promise.all(namn.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  const fraga = e.request;
  // Bara hemsidans egna filer, inte fotbollsdata, bilder från andra sidor eller typsnitt
  if (fraga.method !== "GET" || new URL(fraga.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(fraga).then(function (svar) {
      // Spara en kopia av det senaste svaret, så att det finns om nätet försvinner
      if (svar.ok) {
        const kopia = svar.clone();
        caches.open(CACHE).then(function (cache) { cache.put(fraga, kopia); });
      }
      return svar;
    }).catch(function () {
      // Inget nät: använd den sparade kopian. "ignoreSearch" gör att t.ex.
      // match.html?id=123 kan använda den sparade match.html.
      return caches.match(fraga, { ignoreSearch: true }).then(function (sparad) {
        return sparad || new Response("JodaFoot behöver internet för att visa det här.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      });
    })
  );
});
