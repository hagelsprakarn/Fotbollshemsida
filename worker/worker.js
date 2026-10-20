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
  { kalla: "Sky Sports", url: "https://www.skysports.com/rss/11095" },
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

// ============================================
// LAGUPPSTÄLLNINGAR (från API-Football)
// football-data.org har inga uppställningar i gratisnivån, så vi hämtar dem
// från API-Football. Nyckeln sparas som hemlighet (API_FOOTBALL_NYCKEL) hos Cloudflare.
// ============================================

const AF_BAS_URL = "https://v3.football.api-sports.io";

// Turneringskoder hos football-data och motsvarande liga-id hos API-Football
const AF_LIGOR = { PL: 39, PD: 140, BL1: 78, SA: 135, FL1: 61, CL: 2 };

// Ta bort mellanslag och citattecken om de råkat följa med när en nyckel klistrades in
function rensaNyckel(nyckel) {
  return nyckel.trim().replace(/^["']|["';]+$/g, "");
}

async function hamtaAf(vag, nyckel) {
  const svar = await fetch(AF_BAS_URL + vag, { headers: { "x-apisports-key": nyckel } });
  const data = await svar.json();
  // API-Football svarar med status 200 även vid fel, felen ligger i "errors"
  const fel = data.errors && Object.keys(data.errors).length > 0;
  if (fel) throw new Error("API-Football: " + JSON.stringify(data.errors));
  return data.response;
}

// Lagnamn skrivs olika i de två API:erna ("FC Bayern München" / "Bayern München"),
// så vi tar bort accenter, "FC" och liknande innan vi jämför
function normalisera(namn) {
  return (namn || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(fc|cf|afc|ac|as|ssc|sc|sv|vfb|vfl|tsg|rc|rcd|ud|cd|fk|club|de|calcio)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function liknar(a, b) {
  const na = normalisera(a);
  const nb = normalisera(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  // Annars räcker det att ett längre ord finns i båda namnen, t.ex. "Dortmund"
  const ordB = nb.split(" ");
  return na.split(" ").some(function (ord) { return ord.length >= 4 && ordB.includes(ord); });
}

function liknarLag(afNamn, fdLag) {
  return liknar(afNamn, fdLag.shortName) || liknar(afNamn, fdLag.name);
}

// Gör om API-Footballs uppställning till ett enklare format för hemsidan
function forenkla(uppstallning) {
  function spelare(rad) {
    return {
      namn: rad.player.name,
      nummer: rad.player.number,
      position: rad.player.pos,   // G, D, M eller F
      ruta: rad.player.grid       // t.ex. "2:3" = rad 2, plats 3 (räknat från målvakten)
    };
  }
  return {
    lag: uppstallning.team.name,
    formation: uppstallning.formation,
    startelva: uppstallning.startXI.map(spelare),
    avbytare: uppstallning.substitutes.map(spelare)
  };
}

// Svarar med { typ: "riktig" | "forvantad" | "saknas", lag: [hemma, borta] }
async function hamtaUppstallning(matchId, env) {
  if (!env.API_FOOTBALL_NYCKEL) {
    return { typ: "saknas", orsak: "API_FOOTBALL_NYCKEL saknas i Cloudflare" };
  }
  const afNyckel = rensaNyckel(env.API_FOOTBALL_NYCKEL);

  // 1. Hämta matchen från football-data för att veta lag, datum och turnering
  const fdSvar = await fetch(API_BAS_URL + "/matches/" + matchId, {
    headers: { "X-Auth-Token": rensaNyckel(env.API_NYCKEL || "") }
  });
  if (!fdSvar.ok) throw new Error("football-data svarade med " + fdSvar.status);
  const match = await fdSvar.json();

  const liga = AF_LIGOR[match.competition.code];
  if (!liga) return { typ: "saknas", orsak: "Turneringen finns inte hos API-Football" };
  const sasong = Number(match.season.startDate.slice(0, 4));
  const dag = match.utcDate.slice(0, 10);

  // 2. Leta upp samma match hos API-Football (samma dag, samma lag)
  const matcher = await hamtaAf("/fixtures?league=" + liga + "&season=" + sasong + "&date=" + dag, afNyckel);
  let bast = null;
  let bastPoang = 0;
  matcher.forEach(function (m) {
    const poang = (liknarLag(m.teams.home.name, match.homeTeam) ? 1 : 0) +
      (liknarLag(m.teams.away.name, match.awayTeam) ? 1 : 0);
    if (poang > bastPoang) {
      bast = m;
      bastPoang = poang;
    }
  });
  if (!bast) return { typ: "saknas", orsak: "Hittade inte matchen hos API-Football" };

  // 3. Är startelvorna släppta? (brukar ske ungefär en timme före avspark)
  const riktig = await hamtaAf("/fixtures/lineups?fixture=" + bast.fixture.id, afNyckel);
  if (riktig.length === 2) {
    return { typ: "riktig", lag: riktig.map(forenkla), klar: match.status === "FINISHED" };
  }

  // 4. Annars: varje lags startelva från deras förra match
  const lag = [];
  for (const ettLag of [bast.teams.home, bast.teams.away]) {
    const forra = await hamtaAf("/fixtures?team=" + ettLag.id + "&last=1", afNyckel);
    if (forra.length === 0) {
      lag.push(null);
      continue;
    }
    const uppstallning = await hamtaAf("/fixtures/lineups?fixture=" + forra[0].fixture.id + "&team=" + ettLag.id, afNyckel);
    lag.push(uppstallning.length > 0 ? forenkla(uppstallning[0]) : null);
  }
  return { typ: "forvantad", lag: lag };
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

    // /uppstallning?id=123 ger laguppställningarna för en match.
    // Färdiga matcher sparas ett dygn, annars 10 minuter (API-Football tillåter bara 100 anrop/dag).
    if (url.pathname === "/uppstallning") {
      const matchId = url.searchParams.get("id") || "";
      if (!/^\d+$/.test(matchId)) {
        return new Response("Saknar match-id", { status: 400, headers: headers });
      }

      const cacheNyckel = new Request("https://cache.lokal/uppstallning/" + matchId);
      let svar = await caches.default.match(cacheNyckel);
      if (!svar) {
        let data;
        try {
          data = await hamtaUppstallning(matchId, env);
        } catch (fel) {
          data = { typ: "saknas", orsak: fel.message };
        }
        const sekunder = data.typ === "riktig" && data.klar ? 86400 : 600;
        svar = new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=" + sekunder }
        });
        // Fel och saknade nycklar sparas inte, så att det fungerar direkt när de är fixade
        if (data.typ !== "saknas") {
          ctx.waitUntil(caches.default.put(cacheNyckel, svar.clone()));
        }
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

    const nyckel = rensaNyckel(env.API_NYCKEL);

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
