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
// LAGUPPSTÄLLNINGAR (från ESPN)
// football-data.org har inga uppställningar i gratisnivån, så vi hämtar dem
// från ESPN:s öppna API. Det behöver ingen nyckel.
// ============================================

const ESPN_BAS_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// Turneringskoder hos football-data och motsvarande liga hos ESPN
const ESPN_LIGOR = { PL: "eng.1", PD: "esp.1", BL1: "ger.1", SA: "ita.1", FL1: "fra.1", CL: "uefa.champions" };

// Ta bort mellanslag och citattecken om de råkat följa med när en nyckel klistrades in
function rensaNyckel(nyckel) {
  return nyckel.trim().replace(/^["']|["';]+$/g, "");
}

async function hamtaEspn(vag) {
  const svar = await fetch(ESPN_BAS_URL + vag, { headers: { "User-Agent": "Mozilla/5.0 Fotbollshemsida" } });
  if (!svar.ok) throw new Error("ESPN svarade med " + svar.status);
  return svar.json();
}

// Lagnamn skrivs olika i de två API:erna ("FC Bayern München" / "Bayern Munich"),
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

function liknarLag(espnNamn, fdLag) {
  return liknar(espnNamn, fdLag.shortName) || liknar(espnNamn, fdLag.name);
}

// Hur långt fram på planen en position står (0 = målvakt, 5 = anfall).
// ESPN skriver t.ex. "CD-L" (vänster mittback) eller "AM" (offensiv mittfältare).
const DJUP = {
  G: 0, CD: 1, CB: 1, LB: 1, RB: 1, SW: 1.5, DM: 2, LWB: 2.5, RWB: 2.5,
  CM: 3, LM: 3, RM: 3, M: 3, AM: 4, LW: 4.5, RW: 4.5, CF: 5, LF: 5, RF: 5, F: 5.1, ST: 5.1
};

function djup(position) {
  const bas = position.replace(/-[LR]$/, "");
  return bas in DJUP ? DJUP[bas] : 3;
}

// Hur långt åt vänster (0) eller höger (2) en position står, sett från laget
function sida(position) {
  if (position.endsWith("-L")) return 0.5;
  if (position.endsWith("-R")) return 1.5;
  if (position.startsWith("L")) return 0;
  if (position.startsWith("R")) return 2;
  return 1;
}

// Gör om ESPN:s trupp till rader på planen. Startelvan sorteras bakifrån och
// delas upp enligt formationen: "4-2-3-1" ger raderna 1 (målvakt), 4, 2, 3 och 1.
function forenkla(lag) {
  const spelare = (lag.roster || []).map(function (p) {
    return {
      namn: p.athlete.displayName,
      efternamn: p.athlete.lastName || p.athlete.displayName,
      nummer: p.jersey,
      position: (p.position && p.position.abbreviation) || "",
      startar: p.starter
    };
  });
  const startelva = spelare.filter(function (s) { return s.startar; })
    .sort(function (a, b) { return djup(a.position) - djup(b.position); });
  if (startelva.length !== 11) return null;

  let storlekar = [1].concat((lag.formation || "").split("-").map(Number));
  const summa = storlekar.reduce(function (a, b) { return a + b; }, 0);
  if (summa !== 11) {
    // Ingen formation: en rad per "djup" i stället
    storlekar = [];
    startelva.forEach(function (s, i) {
      if (i === 0 || djup(s.position) !== djup(startelva[i - 1].position)) storlekar.push(0);
      storlekar[storlekar.length - 1]++;
    });
  }

  const rader = [];
  let start = 0;
  storlekar.forEach(function (antal) {
    rader.push(startelva.slice(start, start + antal)
      .sort(function (a, b) { return sida(a.position) - sida(b.position); }));
    start += antal;
  });

  return {
    formation: lag.formation || "",
    rader: rader,
    avbytare: spelare.filter(function (s) { return !s.startar; })
  };
}

// Lagets startelva från dess senaste match före "fore" (används som förväntad startelva)
async function forraStartelvan(sammanfattning, lagId, fore) {
  const lag = (sammanfattning.lastFiveGames || []).find(function (l) { return l.team.id === lagId; });
  if (!lag) return null;
  const tidigare = (lag.events || [])
    .filter(function (e) { return e.gameDate < fore; })
    .sort(function (a, b) { return b.gameDate.localeCompare(a.gameDate); });
  if (tidigare.length === 0) return null;

  // "all" fungerar för matcher i alla ligor, t.ex. en ligamatch före en CL-match
  const forra = await hamtaEspn("/all/summary?event=" + tidigare[0].id);
  const trupp = (forra.rosters || []).find(function (r) { return r.team.id === lagId; });
  return trupp ? forenkla(trupp) : null;
}

// Svarar med { typ: "riktig" | "forvantad" | "saknas", lag: [hemma, borta] }
async function hamtaUppstallning(matchId, env) {
  // 1. Hämta matchen från football-data för att veta lag, datum och turnering
  const fdSvar = await fetch(API_BAS_URL + "/matches/" + matchId, {
    headers: { "X-Auth-Token": rensaNyckel(env.API_NYCKEL || "") }
  });
  if (!fdSvar.ok) throw new Error("football-data svarade med " + fdSvar.status);
  const match = await fdSvar.json();

  const liga = ESPN_LIGOR[match.competition.code];
  if (!liga) return { typ: "saknas", orsak: "Turneringen finns inte hos ESPN" };

  // 2. Leta upp samma match hos ESPN (samma dag, samma lag)
  const dag = match.utcDate.slice(0, 10).replace(/-/g, "");
  const tavlan = await hamtaEspn("/" + liga + "/scoreboard?dates=" + dag);
  let bast = null;
  let bastPoang = 0;
  (tavlan.events || []).forEach(function (e) {
    const lagen = e.competitions[0].competitors;
    const hemma = lagen.find(function (l) { return l.homeAway === "home"; });
    const borta = lagen.find(function (l) { return l.homeAway === "away"; });
    const poang = (liknarLag(hemma.team.displayName, match.homeTeam) ? 1 : 0) +
      (liknarLag(borta.team.displayName, match.awayTeam) ? 1 : 0);
    if (poang > bastPoang) {
      bast = { id: e.id, hemmaId: hemma.team.id, bortaId: borta.team.id };
      bastPoang = poang;
    }
  });
  if (!bast) return { typ: "saknas", orsak: "Hittade inte matchen hos ESPN" };

  // 3. Är startelvorna släppta? (brukar ske ungefär en timme före avspark)
  const sammanfattning = await hamtaEspn("/" + liga + "/summary?event=" + bast.id);
  const trupper = sammanfattning.rosters || [];
  const hemmaTrupp = trupper.find(function (r) { return r.homeAway === "home"; });
  const bortaTrupp = trupper.find(function (r) { return r.homeAway === "away"; });
  const riktig = [hemmaTrupp ? forenkla(hemmaTrupp) : null, bortaTrupp ? forenkla(bortaTrupp) : null];
  if (riktig[0] && riktig[1]) {
    return { typ: "riktig", lag: riktig, klar: match.status === "FINISHED" };
  }

  // 4. Annars: varje lags startelva från deras förra match
  const lag = await Promise.all([
    forraStartelvan(sammanfattning, bast.hemmaId, match.utcDate),
    forraStartelvan(sammanfattning, bast.bortaId, match.utcDate)
  ]);
  if (!lag[0] && !lag[1]) return { typ: "saknas", orsak: "Inga tidigare startelvor hittades" };
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
    // Färdiga matcher sparas ett dygn, annars 10 minuter.
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
