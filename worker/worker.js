// Mellanhand mellan hemsidan och football-data.org.
// Körs på Cloudflare Workers. API-nyckeln sparas som hemlighet (API_NYCKEL)
// hos Cloudflare, så den syns aldrig på hemsidan eller på GitHub.

const API_BAS_URL = "https://api.football-data.org/v4";

// Vilka sidor som får använda mellanhanden
const TILLATNA_ADRESSER = [
  "https://hagelsprakarn.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

// Nyhetsflöden (RSS) som visas på Nyheter-sidan
const NYHETSFLODEN = [
  { kalla: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/rss.xml" },
  { kalla: "Sky Sports", url: "https://www.skysports.com/rss/12040" },
  { kalla: "The Guardian", url: "https://www.theguardian.com/football/rss" },
  { kalla: "Aftonbladet", url: "https://rss.aftonbladet.se/rss2/small/pages/sections/sportbladet/fotboll/" },
  { kalla: "Expressen", url: "https://feeds.expressen.se/fotboll/" }
];

// Gör om t.ex. &amp; och &#39; till vanliga tecken
function avkoda(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, function (_, nr) { return String.fromCharCode(nr); })
    .replace(/&amp;/g, "&");
}

// Hämtar innehållet i en tagg, t.ex. <title>...</title>
function tagg(xml, namn) {
  const traff = xml.match(new RegExp("<" + namn + "[^>]*>([\\s\\S]*?)</" + namn + ">"));
  return traff ? avkoda(traff[1]).trim() : "";
}

// Letar upp en bild i inlägget (flödena lägger bilden på olika ställen)
function hittaBild(xml, beskrivning) {
  const traff =
    xml.match(/<media:(?:thumbnail|content)[^>]*url="([^"]+)"/) ||
    xml.match(/<enclosure[^>]*url="([^"]+)"/) ||
    beskrivning.match(/<img[^>]*src=['"]([^'"]+)['"]/);
  return traff ? avkoda(traff[1]) : "";
}

// Datum som "Tue, 20 Oct 2026 10:25:00 BST" förstår inte JavaScript direkt
function tolkaDatum(text) {
  const tid = Date.parse(text.replace(/ BST$/, " +0100").replace(/ CEST$/, " +0200"));
  return isNaN(tid) ? 0 : tid;
}

async function hamtaFlode(flode) {
  try {
    const svar = await fetch(flode.url, { headers: { "User-Agent": "Mozilla/5.0 Fotbollshemsida" } });
    if (!svar.ok) return [];
    const xml = await svar.text();
    const inlagg = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];

    return inlagg.map(function (item) {
      const beskrivning = tagg(item, "description");
      return {
        kalla: flode.kalla,
        rubrik: tagg(item, "title"),
        lank: tagg(item, "link"),
        bild: hittaBild(item, beskrivning),
        // Ta bort HTML och korta ner texten
        text: beskrivning.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
        tid: tolkaDatum(tagg(item, "pubDate"))
      };
    }).filter(function (n) { return n.rubrik && n.lank; })
      .sort(function (a, b) { return b.tid - a.tid; })
      .slice(0, 8);   // högst 8 per källa, så ingen källa tar över listan
  } catch (fel) {
    return [];   // om en källa krånglar visar vi bara de andra
  }
}

async function hamtaNyheter() {
  const listor = await Promise.all(NYHETSFLODEN.map(hamtaFlode));
  return listor.flat()
    .sort(function (a, b) { return b.tid - a.tid; })   // senaste först
    .slice(0, 40);
}

function corsHeaders(origin) {
  const tillaten = TILLATNA_ADRESSER.includes(origin) ? origin : TILLATNA_ADRESSER[0];
  return {
    "Access-Control-Allow-Origin": tillaten,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    // Webbläsaren frågar ibland först om anropet är tillåtet
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: headers });
    }

    if (request.method !== "GET") {
      return new Response("Bara GET är tillåtet", { status: 405, headers: headers });
    }

    const url = new URL(request.url);

    // /nyheter ger de senaste fotbollsnyheterna från alla flöden, sparade i 5 minuter
    if (url.pathname === "/nyheter") {
      const cacheNyckel = new Request("https://cache.lokal/nyheter");
      let svar = await caches.default.match(cacheNyckel);
      if (!svar) {
        svar = new Response(JSON.stringify(await hamtaNyheter()), {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" }
        });
        ctx.waitUntil(caches.default.put(cacheNyckel, svar.clone()));
      }
      svar = new Response(svar.body, svar);
      for (const [namn, varde] of Object.entries(headers)) {
        svar.headers.set(namn, varde);
      }
      return svar;
    }

    // Allt annat skickas vidare till football-data, t.ex. /competitions/PL/matches?dateFrom=...
    const malAdress = API_BAS_URL + url.pathname + url.search;

    // Spara svar i en minut så vi inte når API:ets gräns (10 anrop/minut)
    const cache = caches.default;
    const cacheNyckel = new Request(malAdress);
    let svar = await cache.match(cacheNyckel);

    if (!env.API_NYCKEL) {
      return new Response("API_NYCKEL saknas i Cloudflare", { status: 500, headers: headers });
    }

    // Ta bort mellanslag och citattecken om de råkat följa med när nyckeln klistrades in
    const nyckel = env.API_NYCKEL.trim().replace(/^["']|["';]+$/g, "");

    if (!svar) {
      svar = await fetch(malAdress, {
        headers: { "X-Auth-Token": nyckel }
      });
      svar = new Response(svar.body, svar);
      svar.headers.set("Cache-Control", "public, max-age=60");
      if (svar.ok) {
        ctx.waitUntil(cache.put(cacheNyckel, svar.clone()));
      }
    }

    svar = new Response(svar.body, svar);
    for (const [namn, varde] of Object.entries(headers)) {
      svar.headers.set(namn, varde);
    }
    return svar;
  }
};
