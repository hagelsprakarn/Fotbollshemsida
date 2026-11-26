// Visar dagens matcher i de fem största ligorna (och Champions League) på matcher.html.

// Vilka turneringar som visas: Premier League, La Liga, Bundesliga, Serie A,
// Ligue 1 och Champions League. Ta bort "CL" om bara ligorna ska visas.
const TURNERINGAR = "PL,PD,BL1,SA,FL1,CL";

// Hjälpfunktion: skapar ett element med en klass och en text
function skapa(tagg, klass, text) {
  const element = document.createElement(tagg);
  if (klass) element.className = klass;
  if (text !== undefined) element.textContent = text;
  return element;
}

// Lagets förkortning (t.ex. TOT), så att namnet alltid får plats på en rad.
// Hela namnet visas när man håller musen över.
function lagnamn(lag) {
  const namn = skapa("span", "", lag.tla || lag.shortName || lag.name);
  namn.title = lag.name;
  return namn;
}

// Varje matchs rad och mittendel, så att de kan uppdateras utan att listan byggs om.
// (Raderna på de sidor man inte bläddrat till ligger inte på skärmen, därför sparas de här.)
const matchrader = new Map();

// Mitten av raden: ställning eller avsparkstid, och under den matchens status:
// röd LIVE när den pågår, HALVTID i paus, "Slut" när den är färdig
function fyllMitten(mitten, rad, match) {
  mitten.replaceChildren();
  const pagar = match.status === "IN_PLAY" || match.status === "PAUSED";
  const harResultat = pagar || match.status === "FINISHED";

  mitten.appendChild(skapa("div", "", harResultat
    ? match.score.fullTime.home + " – " + match.score.fullTime.away
    : new Date(match.utcDate).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })));

  if (match.status === "IN_PLAY") {
    const live = skapa("div", "mr-status mr-live");
    live.appendChild(skapa("span", "mr-livepunkt"));
    live.appendChild(document.createTextNode("LIVE"));
    mitten.appendChild(live);
  } else if (match.status === "PAUSED") {
    mitten.appendChild(skapa("div", "mr-status mr-halvtid", "HALVTID"));
  } else if (match.status === "FINISHED") {
    mitten.appendChild(skapa("div", "mr-status", "Slut"));
  } else if (match.status === "POSTPONED") {
    mitten.appendChild(skapa("div", "mr-status", "Uppskjuten"));
  }

  rad.classList.toggle("live", pagar);
}

// Bygger en rad för en match. Raden är en länk till matchens egen sida.
function byggMatchrad(match) {
  const rad = skapa("a", "mr-rad");
  rad.href = "match.html?id=" + match.id;

  // Hemmalag
  const hemma = skapa("div", "mr-lag");
  if (match.homeTeam.crest) {
    const logga = document.createElement("img");
    logga.src = match.homeTeam.crest;
    logga.alt = "";
    gorTillTruppLank(logga, match.homeTeam);   // märket visar lagets trupp, resten av raden matchen
    hemma.appendChild(logga);
  }
  hemma.appendChild(lagnamn(match.homeTeam));

  // Mitten: ställning eller avsparkstid, och matchens status
  const mitten = skapa("div", "mr-mitten");
  fyllMitten(mitten, rad, match);
  matchrader.set(match.id, { rad: rad, mitten: mitten });

  // Bortalag
  const borta = skapa("div", "mr-lag borta");
  borta.appendChild(lagnamn(match.awayTeam));
  if (match.awayTeam.crest) {
    const logga = document.createElement("img");
    logga.src = match.awayTeam.crest;
    logga.alt = "";
    gorTillTruppLank(logga, match.awayTeam);
    borta.appendChild(logga);
  }

  rad.appendChild(hemma);
  rad.appendChild(mitten);
  rad.appendChild(borta);
  return rad;
}

async function visaMatcher() {
  const lista = document.getElementById("match-lista");
  if (!lista) return;

  const meddelande = skapa("p", "mr-meddelande", "Hämtar matcher...");
  lista.appendChild(meddelande);

  // Utan datum ger /matches dagens matcher i de turneringar vi ber om
  const data = await hamtaFranApi("/matches?competitions=" + TURNERINGAR);

  if (!data) {
    meddelande.textContent = "Kunde inte hämta matcher. Vänta en minut och ladda om sidan.";
    return;
  }

  if (data.matches.length === 0) {
    meddelande.textContent = "Inga matcher idag.";
    return;
  }

  meddelande.remove();

  // Sortera så att matcher i samma turnering hamnar tillsammans, i tidsordning
  data.matches.sort(function (a, b) {
    return a.competition.name.localeCompare(b.competition.name) ||
      a.utcDate.localeCompare(b.utcDate);
  });

  // Dela upp matcherna i sidor med MATCHER_PER_SIDA på varje.
  // Varje sida får en rubrik varje gång turneringen byter (och alltid överst).
  const sidor = [];
  data.matches.forEach(function (match, i) {
    if (i % MATCHER_PER_SIDA === 0) {
      sidor.push(skapa("div", "mr-sida"));
    }
    const sida = sidor[sidor.length - 1];
    const forra = data.matches[i - 1];
    if (i % MATCHER_PER_SIDA === 0 || forra.competition.name !== match.competition.name) {
      sida.appendChild(skapa("h2", "mr-dag", match.competition.name));
    }
    sida.appendChild(byggMatchrad(match));
  });

  visaSidor(lista, sidor);
}

// Hämtar dagens matcher igen och uppdaterar ställning och status på raderna
async function uppdateraMatcher() {
  if (matchrader.size === 0) return;
  const data = await hamtaFranApi("/matches?competitions=" + TURNERINGAR);
  if (!data) return;
  data.matches.forEach(function (match) {
    const delar = matchrader.get(match.id);
    if (delar) fyllMitten(delar.mitten, delar.rad, match);
  });
}

const MATCHER_PER_SIDA = 6;

visaMatcher();
// Uppdatera listan varje minut (lite mer än API-cachens 60 sekunder)
setInterval(uppdateraMatcher, 65000);

// ============================================
// SENASTE RESULTATEN (högra rutan)
// Visar alla färdigspelade matcher från igår och idag och uppdateras
// varje minut, så att t.ex. kvällens Champions League-matcher dyker upp
// när de är slut.
// ============================================

// Datum som "2026-10-20", flyttat ett antal dagar från idag
function datum(dagarFranIdag) {
  const dag = new Date();
  dag.setDate(dag.getDate() + dagarFranIdag);
  return dag.toLocaleDateString("sv-SE");
}

// En rad i resultatet: logga, lagets förkortning och antal mål
function byggResultatLag(lag, mal, forlorade) {
  const rad = skapa("div", "re-lag" + (forlorade ? " forlorade" : ""));
  if (lag.crest) {
    const logga = document.createElement("img");
    logga.src = lag.crest;
    logga.alt = "";
    gorTillTruppLank(logga, lag);
    rad.appendChild(logga);
  }
  rad.appendChild(skapa("span", "re-namn", lag.tla || lag.shortName || lag.name));
  rad.appendChild(skapa("span", "re-mal", mal));
  return rad;
}

// En ruta för en färdig match, med "Idag" eller "Igår" överst. Länkar till matchsidan.
function byggResultat(match) {
  const ruta = skapa("a", "re-match");
  ruta.href = "match.html?id=" + match.id;
  const spelad = new Date(match.utcDate).toLocaleDateString("sv-SE");
  ruta.appendChild(skapa("div", "re-dag", spelad === datum(0) ? "Idag" : "Igår"));
  ruta.appendChild(byggResultatLag(match.homeTeam, match.score.fullTime.home, match.score.winner === "AWAY_TEAM"));
  ruta.appendChild(byggResultatLag(match.awayTeam, match.score.fullTime.away, match.score.winner === "HOME_TEAM"));
  return ruta;
}

async function visaResultat() {
  const sidokort = document.getElementById("sidokort");
  if (!sidokort) return;

  const data = await hamtaFranApi("/matches?competitions=" + TURNERINGAR +
    "&status=FINISHED&dateFrom=" + datum(-1) + "&dateTo=" + datum(1));

  // Misslyckas en uppdatering behåller vi de resultat som redan visas
  if (!data && sidokort.children.length > 0) return;

  sidokort.replaceChildren(skapa("h2", "fo-sidorubrik", "Resultat"));

  if (!data) {
    sidokort.appendChild(skapa("p", "re-meddelande", "Kunde inte hämta resultat."));
    return;
  }

  // Bara matcher från igår och idag (svensk tid)
  const matcher = data.matches.filter(function (match) {
    const spelad = new Date(match.utcDate).toLocaleDateString("sv-SE");
    return spelad === datum(0) || spelad === datum(-1);
  });

  if (matcher.length === 0) {
    sidokort.appendChild(skapa("p", "re-meddelande", "Inga färdiga matcher sedan igår."));
    return;
  }

  // Senast spelade först. Turneringen med senaste matchen hamnar överst.
  matcher.sort(function (a, b) {
    return b.utcDate.localeCompare(a.utcDate);
  });
  const turneringar = new Map();
  matcher.forEach(function (match) {
    const namn = match.competition.name;
    if (!turneringar.has(namn)) turneringar.set(namn, []);
    turneringar.get(namn).push(match);
  });

  // Resultaten delas upp i sidor med RESULTAT_PER_SIDA matcher, som man bläddrar mellan
  // med pilarna längst ner. Varje sida får turneringens namn överst och när den byter.
  const sidor = [];
  let antal = 0;
  turneringar.forEach(function (lista, namn) {
    lista.forEach(function (match, i) {
      const nySida = antal % RESULTAT_PER_SIDA === 0;
      if (nySida) sidor.push(skapa("div", "mr-sida"));
      const sida = sidor[sidor.length - 1];
      if (nySida || i === 0) sida.appendChild(skapa("h3", "re-turnering", namn));
      sida.appendChild(byggResultat(match));
      antal++;
    });
  });

  const yta = skapa("div", "bladdra-kort re-yta");
  sidokort.appendChild(yta);
  // Rutan uppdateras varje minut, då ska man stanna kvar på den sida man har bläddrat till.
  // Piltangenterna bläddrar i matchlistan, inte här.
  visaSidor(yta, sidor, {
    pilarNere: true,
    tangenter: false,
    start: resultatSida,
    vidByte: function (nr) { resultatSida = nr; }
  });
}

const RESULTAT_PER_SIDA = 5;
let resultatSida = 0;

visaResultat();
// Hämta nya resultat varje minut (lite mer än API-cachens 60 sekunder)
setInterval(visaResultat, 65000);
