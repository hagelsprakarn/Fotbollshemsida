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

// "max" är hur många inlägg vi tar från källan
async function hamtaFlode(flode, max) {
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
      .slice(0, max);
  } catch (fel) {
    return [];   // om en källa krånglar visar vi bara de andra
  }
}

async function hamtaNyheter() {
  // Högst 8 per källa, så ingen källa tar över listan
  const listor = await Promise.all(NYHETSFLODEN.map(function (flode) { return hamtaFlode(flode, 8); }));
  return listor.flat()
    .sort(function (a, b) { return b.tid - a.tid; })   // senaste först
    .slice(0, 40);
}

// ============================================
// ÖVERGÅNGAR (högra rutan på Nyheter-sidan)
// Det finns ingen gratis API med färska övergångar, men Wikipedia har listor
// över alla övergångar i varje liga ("List of English football transfers summer 2026").
// Vi läser de listorna och plockar ut spelare, gammal klubb och ny klubb.
// ============================================

// För varje liga: vad den heter i Wikipedias sidnamn och hos ESPN (för klubbmärkena)
const OVERGANGSLIGOR = {
  PL: { wiki: "English", espn: "eng.1" },
  PD: { wiki: "Spanish", espn: "esp.1" },
  BL1: { wiki: "German", espn: "ger.1" },
  SA: { wiki: "Italian", espn: "ita.1" },
  FL1: { wiki: "French", espn: "fra.1" }
};

// Wikipedia vill att man talar om vem som frågar
const WIKI_HUVUD = { "User-Agent": "JodaFoot/1.0 (https://hagelsprakarn.github.io/Fotbollshemsida/)" };

// Sidorna för det senaste sommarfönstret och för vinterfönstret, t.ex.
// "...summer 2026" och "...winter 2026–27"
function wikiSidor(land) {
  const nu = new Date();
  const ar = nu.getUTCFullYear();
  const manad = nu.getUTCMonth() + 1;
  const sommar = manad >= 6 ? ar : ar - 1;
  const vinterStart = manad >= 7 ? ar : ar - 1;
  const vinter = vinterStart + "–" + String((vinterStart + 1) % 100).padStart(2, "0");
  return [
    "List of " + land + " football transfers summer " + sommar,
    "List of " + land + " football transfers winter " + vinter
  ];
}

// Hämtar första avsnittet av en Wikipedia-sida som råtext (wikitext).
// Första avsnittet är högstaligan. Finns inte sidan än blir det en tom text.
async function hamtaWiki(titel) {
  const adress = "https://en.wikipedia.org/w/index.php?action=raw&section=1&title=" + encodeURIComponent(titel.replace(/ /g, "_"));
  const svar = await fetch(adress, { headers: WIKI_HUVUD });
  return svar.ok ? svar.text() : "";
}

// Gör om wikitext till vanlig text: tar bort fotnoter, flaggor och länkar
function rensaWiki(text) {
  let rensad = (text || "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[\s\S]*?<\/ref>/g, "");
  // Mallar kan ligga i varandra, t.ex. {{Sort|Alaba, David|{{flagicon|AUT}} [[David Alaba]]}},
  // så vi tar bort de innersta först och upprepar tills inga finns kvar
  let forra;
  do {
    forra = rensad;
    rensad = rensad
      .replace(/\{\{sortname\|([^|{}]*)\|([^|{}]*)[^{}]*\}\}/gi, "$1 $2")
      .replace(/\{\{sort\|[^|{}]*\|([^{}]*)\}\}/gi, "$1")
      .replace(/\{\{(?!sort)[^{}]*\}\}/gi, "");
  } while (rensad !== forra);
  return rensad
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Datum som "1 September 2026", "2026-09-01" eller {{dts|2026|9|1}}
function tolkaWikiDatum(text) {
  const dts = (text || "").match(/\{\{dts\|(?:[^|{}]*=[^|{}]*\|)*(\d{4})\|(\d{1,2})\|(\d{1,2})/i);
  if (dts) return Date.UTC(Number(dts[1]), Number(dts[2]) - 1, Number(dts[3]));
  // Räkna datumet i UTC, annars kan "1 September" bli 31 augusti beroende på tidszon
  const rensad = rensaWiki(text);
  const tid = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(rensad) ? rensad : rensad + " UTC");
  return isNaN(tid) ? 0 : tid;
}

// England och Italien: en stor tabell med Datum | Spelare | Från | Till | Avgift.
// Raderna står i datumordning, så vi läser bakifrån och tar bara de senaste.
// Har en rad inget datum gäller datumet från raden ovanför (rowspan).
function lasTabell(text, max) {
  const rader = text.split(/\n\|-/).slice(1);
  const resultat = [];
  let vantar = [];
  for (let i = rader.length - 1; i >= 0 && (resultat.length < max || vantar.length > 0); i--) {
    // En cell per textrad. Inställningar som rowspan="55" före cellens innehåll tas bort.
    const celler = [];
    rader[i].split("\n").forEach(function (rad) {
      if (!rad.startsWith("|") || rad.startsWith("|}") || rad.startsWith("|-")) return;
      celler.push(rad.slice(1).replace(/^\s*(rowspan|style|align|data-sort-value)[^|[{]*\|/i, ""));
    });
    if (celler.length < 4) continue;
    const harDatum = celler.length >= 5;
    if (!harDatum) celler.unshift("");
    const overgang = {
      spelare: rensaWiki(celler[1]),
      fran: rensaWiki(celler[2]),
      till: rensaWiki(celler[3]),
      avgift: rensaWiki(celler[4]),
      datum: 0
    };
    if (!overgang.spelare || !overgang.till) continue;
    if (harDatum) {
      overgang.datum = tolkaWikiDatum(celler[0]);
      vantar.forEach(function (v) { v.datum = overgang.datum; });
      vantar = [];
    } else {
      vantar.push(overgang);
    }
    resultat.push(overgang);
  }
  return resultat;
}

// Spanien, Tyskland och Frankrike: en lista per klubb med "In" och "Out".
// Varje spelare står som {{fs player|...|name=[[Namn]]|other=from [[Klubb]]}}
// och datumet finns i fotnoten efter.
function lasKlubblistor(text) {
  const resultat = [];
  text.split(/\n===/).slice(1).forEach(function (del) {
    const klubb = rensaWiki(del.slice(0, del.indexOf("===")));
    let lista = -1;   // 0 = In (spelare som kommer), 1 = Out (spelare som går)
    del.split("\n").forEach(function (rad) {
      if (/\{\{fs start/i.test(rad)) {
        lista++;
        return;
      }
      const namn = rad.match(/\{\{fs player[^\n]*?\|\s*name\s*=\s*(\[\[[^\]]*\]\]|[^|}]*)/i);
      if (!namn) return;
      const annat = rensaWiki((rad.match(/\|\s*other\s*=\s*(.*?)\}\}(?:<ref|\s*$)/i) || [])[1]);
      // "from Barcelona", "to Liverpool", "on loan to Espanyol". "loan return" och "Released" hoppar vi över.
      const riktning = annat.match(/^(on loan )?(from|to) ([^,(]+)/i);
      if (!riktning) return;
      const fran = riktning[2].toLowerCase() === "from";
      if ((lista === 0) !== fran) return;
      const datum = rad.match(/\|\s*date\s*=\s*([^|}]+)/i);
      resultat.push({
        spelare: rensaWiki(namn[1]),
        fran: fran ? riktning[3].trim() : klubb,
        till: fran ? klubb : riktning[3].trim(),
        avgift: riktning[1] ? "Loan" : "",
        datum: datum ? tolkaWikiDatum(datum[1]) : 0
      });
    });
  });
  return resultat;
}

// Klubbarna i en liga från ESPN (namn och klubbmärke), sparade ett dygn
async function hamtaEspnLag(slug, ctx) {
  const cacheNyckel = new Request("https://cache.lokal/espnlag/" + slug);
  const sparad = await caches.default.match(cacheNyckel);
  if (sparad) return sparad.json();
  const data = await hamtaEspn("/" + slug + "/teams");
  const lag = data.sports[0].leagues[0].teams.map(function (t) {
    return { namn: t.team.displayName, kort: t.team.shortDisplayName, logga: t.team.logos ? t.team.logos[0].href : "" };
  });
  ctx.waitUntil(caches.default.put(cacheNyckel, new Response(JSON.stringify(lag), {
    headers: { "Cache-Control": "public, max-age=86400" }
  })));
  return lag;
}

// Strängare än liknar(): det kortare namnet måste vara början på det längre,
// t.ex. "Brighton" och "Brighton & Hove Albion". "Wigan Athletic" får inte bli
// Athletic Bilbao och "Manchester United" får inte bli Manchester City.
function sammaKlubb(a, b) {
  const ordA = normalisera(a).split(" ");
  const ordB = normalisera(b).split(" ");
  const kort = ordA.length <= ordB.length ? ordA : ordB;
  const lang = kort === ordA ? ordB : ordA;
  return kort[0] !== "" && kort.every(function (ord, i) { return ord === lang[i]; });
}

async function hamtaOvergangar(kod, ctx) {
  const liga = OVERGANGSLIGOR[kod];
  const sidor = await Promise.all(wikiSidor(liga.wiki).map(hamtaWiki));
  // Klubbmärken från alla fem ligorna, så att t.ex. en övergång från PSG till Liverpool får Liverpools märke
  const koder = Object.keys(OVERGANGSLIGOR);
  const laglistor = await Promise.all(koder.map(function (k) {
    return hamtaEspnLag(OVERGANGSLIGOR[k].espn, ctx).catch(function () { return []; });
  }));
  const allaLag = laglistor.flat();
  const ligansLag = laglistor[koder.indexOf(kod)];

  function hittaLag(namn, lista) {
    return lista.find(function (l) { return sammaKlubb(namn, l.namn) || sammaKlubb(namn, l.kort); });
  }

  let overgangar = [];
  sidor.forEach(function (text) {
    if (!text) return;
    if (/\{\{fs player/i.test(text)) {
      overgangar = overgangar.concat(lasKlubblistor(text));
    } else {
      // Tabellen tar med lägre divisioner också, vi behåller bara de som rör högstaligan
      overgangar = overgangar.concat(lasTabell(text, 120).filter(function (o) {
        return hittaLag(o.fran, ligansLag) || hittaLag(o.till, ligansLag);
      }));
    }
  });

  // En övergång mellan två klubbar i samma liga står både som In och Out
  const sedda = new Set();
  return overgangar
    .filter(function (o) {
      const nyckel = normalisera(o.spelare) + "|" + normalisera(o.till);
      if (sedda.has(nyckel)) return false;
      sedda.add(nyckel);
      return true;
    })
    .sort(function (a, b) { return b.datum - a.datum; })   // senaste först
    .slice(0, 15)
    .map(function (o) {
      const nyKlubb = hittaLag(o.till, allaLag);
      o.tillLogga = nyKlubb ? nyKlubb.logga : "";
      o.liga = kod;
      return o;
    });
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

// ============================================
// SPELARBILDER (från TheSportsDB)
// ESPN har bara bilder på ett fåtal spelare, så vi letar i TheSportsDB i stället.
// ============================================

// TheSportsDB har snygga urklippta bilder, men sökningen ger ofta fel person
// (sök på "Rodri" ger Jay Rodriguez). Därför godtar vi bara en spelare i rätt lag.
async function sokTheSportsDb(namn, lag) {
  // TheSportsDB vill ha namnet utan accenter och med _ mellan orden, t.ex. "Antonin_Kinsky"
  const sok = namn.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, "_");
  const svar = await fetch("https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=" + encodeURIComponent(sok));
  if (!svar.ok) throw new Error("TheSportsDB svarade med " + svar.status);
  const data = await svar.json();
  const spelare = (data.player || []).find(function (p) {
    return p.strSport === "Soccer" && (p.strCutout || p.strThumb) && liknar(p.strTeam, lag);
  });
  // "Cutout" är en urklippt bild utan bakgrund, den passar bäst i cirkeln på planen
  return spelare ? (spelare.strCutout || spelare.strThumb) : null;
}

// Reserv: bilden på spelarens Wikipedia-sida. Vi söker på "namn footballer lag" och
// godtar bara en sida om en fotbollsspelare som har ett av namnen gemensamt med sökningen.
async function sokWikipedia(namn, lag) {
  const adress = "https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=3" +
    "&prop=pageimages|description&piprop=thumbnail&pithumbsize=200&gsrsearch=" +
    encodeURIComponent(namn + " footballer " + lag);
  const svar = await fetch(adress, { headers: WIKI_HUVUD });
  if (!svar.ok) return null;
  const data = await svar.json();
  const sidor = Object.values((data.query && data.query.pages) || {})
    .sort(function (a, b) { return a.index - b.index; });
  const namnOrd = normalisera(namn).split(" ");
  const sida = sidor.find(function (p) {
    return p.thumbnail && /footballer/i.test(p.description || "") &&
      normalisera(p.title).split(" ").some(function (ord) { return ord.length >= 3 && namnOrd.includes(ord); });
  });
  return sida ? sida.thumbnail.source : null;
}

// ============================================
// SPELARSIDAN (spelare.html)
// Allt om en spelare kommer från faktarutan ("infobox") på spelarens Wikipedia-sida:
// karriär, landslag, längd, position och meriter.
// ============================================

// Letar upp spelarens Wikipedia-sida. Samma regler som för bilderna: sidan ska handla
// om en fotbollsspelare och ha ett av namnen gemensamt med sökningen.
// Söker först med lagets namn (så att rätt person hittas bland flera med samma namn),
// och om det inte ger något utan lagnamn.
async function hittaWikiSpelare(namn, lag) {
  const namnOrd = normalisera(namn).split(" ");
  for (const sokord of [namn + " footballer " + lag, namn + " footballer"]) {
    const adress = "https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=4" +
      "&prop=pageimages|description|extracts&piprop=thumbnail&pithumbsize=400&exintro=1&explaintext=1&exsentences=4&exlimit=4" +
      "&gsrsearch=" + encodeURIComponent(sokord);
    const svar = await fetch(adress, { headers: WIKI_HUVUD });
    if (!svar.ok) continue;
    const data = await svar.json();
    const sidor = Object.values((data.query && data.query.pages) || {})
      .sort(function (a, b) { return a.index - b.index; });
    const sida = sidor.find(function (p) {
      return /footballer/i.test(p.description || "") &&
        normalisera(p.title).split(" ").some(function (ord) { return ord.length >= 3 && namnOrd.includes(ord); });
    });
    if (sida) return sida;
  }
  return null;
}

// Läser faktarutan till ett objekt { name: "...", clubs1: "...", ... }.
// Fälten skiljs åt med "|", men "|" finns också inuti länkar [[...|...]] och mallar {{...|...}},
// så vi går igenom texten tecken för tecken och delar bara där vi inte är inuti något.
function lasFaktaruta(text) {
  const rensad = text.replace(/<!--[\s\S]*?-->/g, "");
  const start = rensad.search(/\{\{\s*Infobox football biography/i);
  if (start < 0) return null;

  const delar = [];
  let djup = 0;
  let bit = "";
  for (let i = start + 2; i < rensad.length; i++) {
    const tva = rensad.substr(i, 2);
    if (tva === "{{" || tva === "[[") {
      djup++;
      bit += tva;
      i++;
    } else if (tva === "}}" || tva === "]]") {
      if (djup === 0) break;   // slutet på faktarutan
      djup--;
      bit += tva;
      i++;
    } else if (rensad[i] === "|" && djup === 0) {
      delar.push(bit);
      bit = "";
    } else {
      bit += rensad[i];
    }
  }
  delar.push(bit);

  const falt = {};
  delar.slice(1).forEach(function (del) {
    const lika = del.indexOf("=");
    if (lika > 0) falt[del.slice(0, lika).trim().toLowerCase()] = del.slice(lika + 1).trim();
  });
  return falt;
}

// "{{birth date and age|2002|11|25|df=y}}" eller "{{birth-date and age|15 December 2006}}" -> "2002-11-25"
function fodelsedag(text) {
  const traff = (text || "").match(/\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/);
  if (traff) return traff[1] + "-" + traff[2].padStart(2, "0") + "-" + traff[3].padStart(2, "0");
  const ord = (text || "").match(/\|\s*(\d{1,2} [A-Za-z]+ \d{4}|[A-Za-z]+ \d{1,2},? \d{4})/);
  const tid = ord ? Date.parse(ord[1] + " UTC") : NaN;
  return isNaN(tid) ? "" : new Date(tid).toISOString().slice(0, 10);
}

// Längden kan stå som "1.74 m", {{height|m=1.74}} eller {{convert|1.74|m|...}}
function langd(text) {
  const traff = (text || "").match(/m\s*=\s*([\d.]+)/) || (text || "").match(/([12][.,]\d{2})\s*\|?\s*m\b/);
  return traff ? traff[1].replace(",", ".") + " m" : "";
}

// Numrerade fält, t.ex. years1/clubs1/caps1/goals1, years2/clubs2/... blir en lista
function numreradLista(falt, prefix, namn) {
  const lista = [];
  for (let i = 1; i <= 40; i++) {
    const klubb = falt[prefix + namn[1] + i];
    if (klubb === undefined) continue;
    lista.push({
      ar: rensaWiki(falt[prefix + namn[0] + i]),
      klubb: rensaWiki(klubb).replace(/\(loan\)/i, "(lån)"),
      matcher: namn[2] ? rensaWiki(falt[prefix + namn[2] + i]) : "",
      mal: namn[3] ? rensaWiki(falt[prefix + namn[3] + i]).replace(/[()]/g, "") : ""
    });
  }
  return lista.filter(function (r) { return r.klubb; });
}

// Meriterna står som {{MedalCompetition|[[FIFA World Cup]]}} följt av {{Medal|W|[[2026 ...]]}}.
// W/Gold = vinnare, RU/Silver = tvåa, Bronze/3rd = trea.
function lasMeriter(text) {
  const meriter = [];
  let turnering = "";
  (text || "").split(/(?=\{\{)/).forEach(function (bit) {
    // Turneringen står som {{MedalCompetition|...}} eller {{Medal|Comp|...}}
    const ny = bit.match(/^\{\{\s*(?:MedalCompetition|Medal\s*\|\s*Comp)\s*\|(.*)/i);
    if (ny) {
      turnering = rensaWiki(ny[1].replace(/\}\}[\s\S]*$/, ""));
      return;
    }
    const medalj = bit.match(/^\{\{\s*Medal(Gold|Silver|Bronze|\s*\|\s*(W|RU|Gold|Silver|Bronze|3rd))\s*\|(.*)/i);
    if (!medalj || !turnering) return;
    const typ = (medalj[2] || medalj[1]).toLowerCase();
    const plats = typ === "w" || typ === "gold" ? 1 : typ === "ru" || typ === "silver" ? 2 : 3;
    // "[[FIFA World Cup 2026|2026 Canada–Mexico–US]]|[[...|Team]]}}" -> "2026 Canada–Mexico–US"
    const tillfalle = rensaWiki(medalj[3].replace(/\}\}[\s\S]*$/, "")).split("|")[0].trim();
    meriter.push({ turnering: turnering, plats: plats, tillfalle: tillfalle });
  });
  return meriter;
}

async function hamtaSpelare(namn, lag) {
  const sida = await hittaWikiSpelare(namn, lag);
  if (!sida) return null;
  const svar = await fetch("https://en.wikipedia.org/w/index.php?action=raw&section=0&title=" +
    encodeURIComponent(sida.title.replace(/ /g, "_")), { headers: WIKI_HUVUD });
  const falt = svar.ok ? lasFaktaruta(await svar.text()) : null;
  if (!falt) return null;

  return {
    titel: sida.title,
    lank: "https://en.wikipedia.org/wiki/" + encodeURIComponent(sida.title.replace(/ /g, "_")),
    sammanfattning: sida.extract || "",
    bild: sida.thumbnail ? sida.thumbnail.source : "",
    namn: rensaWiki(falt.name),
    fulltNamn: rensaWiki(falt.full_name),
    fodd: fodelsedag(falt.birth_date),
    fodelseort: rensaWiki(falt.birth_place),
    langd: langd(falt.height),
    position: rensaWiki(falt.position),
    klubb: rensaWiki(falt.currentclub),
    nummer: rensaWiki(falt.clubnumber),
    ungdom: numreradLista(falt, "youth", ["years", "clubs"]),
    karriar: numreradLista(falt, "", ["years", "clubs", "caps", "goals"]),
    landslag: numreradLista(falt, "national", ["years", "team", "caps", "goals"]),
    meriter: lasMeriter(falt.medaltemplates),
    uppdaterad: rensaWiki(falt["club-update"] || falt.pcupdate || "")
  };
}

// Svarar med { bild, lange }. "lange" = får sparas länge. Är TheSportsDB upptaget
// (för många anrop) sparas en Wikipedia-bild bara kort, så att den urklippta kan komma senare.
async function hittaSpelarbild(namn, lag) {
  let upptaget = false;
  try {
    const bild = await sokTheSportsDb(namn, lag);
    if (bild) return { bild: bild, lange: true };
  } catch (fel) {
    upptaget = true;
  }
  const bild = await sokWikipedia(namn, lag).catch(function () { return null; });
  if (bild) return { bild: bild, lange: !upptaget };
  if (upptaget) throw new Error("TheSportsDB är upptaget");
  return { bild: null, lange: true };
}

// ============================================
// SÖK (sok.html)
// Alla lag i topp 5-ligorna och Champions League, med tränare och trupp,
// samlade i ett svar så att hemsidan kan söka bland dem direkt.
// ============================================

const SOKLIGOR = ["PL", "PD", "BL1", "SA", "FL1", "CL"];

async function hamtaSokdata(env) {
  const nyckel = rensaNyckel(env.API_NYCKEL || "");
  const svar = await Promise.all(SOKLIGOR.map(function (kod) {
    return fetch(API_BAS_URL + "/competitions/" + kod + "/teams", { headers: { "X-Auth-Token": nyckel } })
      .then(function (s) { return s.ok ? s.json() : null; })
      .catch(function () { return null; });
  }));

  // Ett lag kan vara med i både sin liga och Champions League, då slås de ihop
  const lagen = new Map();
  let komplett = true;
  svar.forEach(function (data) {
    if (!data) {
      komplett = false;
      return;
    }
    data.teams.forEach(function (t) {
      let lag = lagen.get(t.id);
      if (!lag) {
        lag = {
          id: t.id,
          namn: t.name,
          kort: t.shortName || t.name,
          tla: t.tla,
          logga: t.crest,
          ligor: [],
          tranare: t.coach && t.coach.name ? t.coach.name : "",
          spelare: (t.squad || []).map(function (s) {
            return { id: s.id, namn: s.name, position: s.position || "", fodd: s.dateOfBirth || "", land: s.nationality || "" };
          })
        };
        lagen.set(t.id, lag);
      }
      lag.ligor.push(data.competition.name);
    });
  });
  return { komplett: komplett, lag: Array.from(lagen.values()) };
}

// ============================================
// SKADELISTA (från Premier Leagues Fantasy-API)
// Fantasy-API:et har skador och avstängningar för alla Premier League-spelare.
// Svaret är stort (nästan 2 MB), så vi letar bara upp de spelare som är
// skadade, tveksamma eller avstängda i stället för att läsa in allt.
// ============================================

// Fantasy-API:et använder smeknamn på några lag, här står deras riktiga namn
const FPL_NAMN = {
  "Spurs": "Tottenham Hotspur",
  "Man City": "Manchester City",
  "Man Utd": "Manchester United",
  "Nott'm Forest": "Nottingham Forest",
  "Wolves": "Wolverhampton Wanderers"
};

async function hamtaSkador() {
  const svar = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", {
    headers: { "User-Agent": "Mozilla/5.0 Fotbollshemsida" }
  });
  if (!svar.ok) throw new Error("Fantasy-API:et svarade med " + svar.status);
  const text = await svar.text();

  // Lagen: "teams":[{..."id":1,..."name":"Arsenal",..."short_name":"ARS",...}, ...]
  const lagDel = text.slice(text.indexOf('"teams":['), text.indexOf('"total_players"'));
  const lag = {};
  const lagTraff = /"id":(\d+),[^{}]*?"name":"([^"]+)"[^{}]*?"short_name":"([^"]+)"/g;
  let traff;
  while ((traff = lagTraff.exec(lagDel)) !== null) {
    lag[traff[1]] = { namn: FPL_NAMN[traff[2]] || traff[2], kort: traff[3], spelare: [] };
  }

  // Spelarna: dela upp listan i en bit per spelare och läs bara de som inte är friska.
  // Status: i = skadad, d = tveksam, s = avstängd (u = har lämnat klubben, dem hoppar vi över)
  // Spelarlistan ligger sist i svaret. Varje spelare börjar med "can_transact", så vi
  // delar där (spelarna har egna små listor inuti, så "},{" går inte att dela på).
  const spelarDel = text.slice(text.lastIndexOf('"elements":['));
  const bitar = spelarDel.slice(spelarDel.indexOf("[{") + 2, spelarDel.lastIndexOf("}]")).split(/\},\{"can_transact":/);
  bitar.forEach(function (bit, i) {
    if (!/"status":"[ids]"/.test(bit)) return;
    let spelare;
    try {
      spelare = JSON.parse("{" + (i > 0 ? '"can_transact":' : "") + bit + "}");
    } catch (fel) {
      return;
    }
    if (!lag[spelare.team]) return;
    lag[spelare.team].spelare.push({
      namn: (spelare.first_name + " " + spelare.second_name).trim(),
      kortnamn: spelare.web_name,
      status: spelare.status,
      chans: spelare.chance_of_playing_next_round,
      nyhet: spelare.news,
      datum: spelare.news_added
    });
  });
  return Object.values(lag);
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

    // /skador ger skadade, tveksamma och avstängda spelare i alla Premier League-lag, sparade i 30 minuter
    if (url.pathname === "/skador") {
      const cacheNyckel = new Request("https://cache.lokal/skador");
      let svar = await caches.default.match(cacheNyckel);
      if (!svar) {
        let data;
        try {
          data = await hamtaSkador();
        } catch (fel) {
          return new Response("Kunde inte hämta skador", { status: 502, headers: headers });
        }
        svar = new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=1800" }
        });
        ctx.waitUntil(caches.default.put(cacheNyckel, svar.clone()));
      }
      svar = new Response(svar.body, svar);
      for (const [namn, varde] of Object.entries(headers)) {
        svar.headers.set(namn, varde);
      }
      return svar;
    }

    // /sokdata ger alla lag och spelare för Sök-sidan. Trupper ändras sällan, så svaret
    // sparas i 12 timmar (men bara 2 minuter om någon liga inte gick att hämta).
    if (url.pathname === "/sokdata") {
      const cacheNyckel = new Request("https://cache.lokal/sokdata");
      let svar = await caches.default.match(cacheNyckel);
      if (!svar) {
        const data = await hamtaSokdata(env);
        svar = new Response(JSON.stringify(data), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=" + (data.komplett ? 43200 : 120)
          }
        });
        ctx.waitUntil(caches.default.put(cacheNyckel, svar.clone()));
      }
      svar = new Response(svar.body, svar);
      for (const [namn, varde] of Object.entries(headers)) {
        svar.headers.set(namn, varde);
      }
      return svar;
    }

    // /overgangar?liga=PL ger de senaste övergångarna i en liga, sparade i 15 minuter.
    // En liga per anrop, så att varje anrop bara behöver läsa en Wikipedia-sida.
    if (url.pathname === "/overgangar") {
      const kod = url.searchParams.get("liga") || "";
      if (!OVERGANGSLIGOR[kod]) {
        return new Response("Okänd liga", { status: 400, headers: headers });
      }
      const cacheNyckel = new Request("https://cache.lokal/overgangar/" + kod);
      let svar = await caches.default.match(cacheNyckel);
      if (!svar) {
        let data;
        try {
          data = await hamtaOvergangar(kod, ctx);
        } catch (fel) {
          return new Response("Kunde inte hämta övergångar", { status: 502, headers: headers });
        }
        svar = new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=900" }
        });
        ctx.waitUntil(caches.default.put(cacheNyckel, svar.clone()));
      }
      svar = new Response(svar.body, svar);
      for (const [namn, varde] of Object.entries(headers)) {
        svar.headers.set(namn, varde);
      }
      return svar;
    }

    // /spelarbild?namn=Erling Haaland&lag=Manchester City FC skickar vidare till en bild på spelaren,
    // så att hemsidan kan använda adressen direkt i en <img>. Finns ingen bild svarar vi 404.
    // Bilderna sparas i 30 dagar (TheSportsDB tillåter bara några anrop i minuten).
    if (url.pathname === "/spelarbild") {
      const namn = url.searchParams.get("namn") || "";
      const lag = url.searchParams.get("lag") || "";
      // "v2" i nyckeln: de bilder som sparades innan vi krävde rätt lag ska inte användas
      const cacheNyckel = new Request("https://cache.lokal/spelarbild-v2/" + encodeURIComponent(normalisera(namn) + "|" + normalisera(lag)));
      let svar = await caches.default.match(cacheNyckel);
      if (!svar) {
        let traff = { bild: null, lange: true };
        let misslyckades = false;
        try {
          if (namn) traff = await hittaSpelarbild(namn, lag);
        } catch (fel) {
          misslyckades = true;
        }
        if (traff.bild) {
          svar = new Response(null, {
            status: 302,
            headers: { "Location": traff.bild, "Cache-Control": "public, max-age=" + (traff.lange ? 2592000 : 86400) }
          });
        } else {
          // Gick anropet fel (t.ex. för många i minuten) försöker vi igen nästa gång
          svar = new Response("Ingen bild", { status: 404, headers: { "Cache-Control": misslyckades ? "no-store" : "public, max-age=86400" } });
        }
        if (!misslyckades) {
          ctx.waitUntil(caches.default.put(cacheNyckel, svar.clone()).catch(function () {}));
        }
      }
      return svar;
    }

    // /spelare?namn=Pedri&lag=FC Barcelona ger allt om en spelare från Wikipedia, sparat ett dygn
    if (url.pathname === "/spelare") {
      const namn = url.searchParams.get("namn") || "";
      const lag = url.searchParams.get("lag") || "";
      if (!namn) {
        return new Response("Saknar namn", { status: 400, headers: headers });
      }
      const cacheNyckel = new Request("https://cache.lokal/spelare/" + encodeURIComponent(normalisera(namn) + "|" + normalisera(lag)));
      let svar = await caches.default.match(cacheNyckel);
      if (!svar) {
        let data;
        try {
          data = await hamtaSpelare(namn, lag);
        } catch (fel) {
          return new Response("Kunde inte hämta spelaren", { status: 502, headers: headers });
        }
        svar = new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400" }
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
