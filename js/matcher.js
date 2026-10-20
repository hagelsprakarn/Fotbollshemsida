// Visar dagens matcher i alla ligor på matcher.html.

// Hjälpfunktion: skapar ett element med en klass och en text
function skapa(tagg, klass, text) {
  const element = document.createElement(tagg);
  if (klass) element.className = klass;
  if (text !== undefined) element.textContent = text;
  return element;
}

// Lagets namn: hela namnet, plus förkortningen (t.ex. TOT) som visas när raden är smal
function lagnamn(lag) {
  const namn = skapa("span");
  namn.appendChild(skapa("span", "fullt-namn", lag.shortName || lag.name));
  namn.appendChild(skapa("span", "forkortning", lag.tla || lag.shortName || lag.name));
  return namn;
}

// Bygger en rad för en match
function byggMatchrad(match) {
  const rad = skapa("div", "mr-rad");

  // Hemmalag
  const hemma = skapa("div", "mr-lag");
  if (match.homeTeam.crest) {
    const logga = document.createElement("img");
    logga.src = match.homeTeam.crest;
    logga.alt = "";
    hemma.appendChild(logga);
  }
  hemma.appendChild(lagnamn(match.homeTeam));

  // Mitten: resultat om matchen har börjat, annars avsparkstid
  const harResultat = ["IN_PLAY", "PAUSED", "FINISHED"].includes(match.status);
  let mittenText;
  if (harResultat) {
    mittenText = match.score.fullTime.home + " – " + match.score.fullTime.away;
  } else {
    mittenText = new Date(match.utcDate).toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  const mitten = skapa("div", "mr-mitten", mittenText);

  // Bortalag
  const borta = skapa("div", "mr-lag borta");
  borta.appendChild(lagnamn(match.awayTeam));
  if (match.awayTeam.crest) {
    const logga = document.createElement("img");
    logga.src = match.awayTeam.crest;
    logga.alt = "";
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

  // Utan datum ger /matches dagens matcher i alla ligor vår nyckel har tillgång till
  const data = await hamtaFranApi("/matches");

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

const MATCHER_PER_SIDA = 6;

visaMatcher();

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
    rad.appendChild(logga);
  }
  rad.appendChild(skapa("span", "re-namn", lag.tla || lag.shortName || lag.name));
  rad.appendChild(skapa("span", "re-mal", mal));
  return rad;
}

// En ruta för en färdig match, med "Idag" eller "Igår" överst
function byggResultat(match) {
  const ruta = skapa("div", "re-match");
  const spelad = new Date(match.utcDate).toLocaleDateString("sv-SE");
  ruta.appendChild(skapa("div", "re-dag", spelad === datum(0) ? "Idag" : "Igår"));
  ruta.appendChild(byggResultatLag(match.homeTeam, match.score.fullTime.home, match.score.winner === "AWAY_TEAM"));
  ruta.appendChild(byggResultatLag(match.awayTeam, match.score.fullTime.away, match.score.winner === "HOME_TEAM"));
  return ruta;
}

async function visaResultat() {
  const sidokort = document.getElementById("sidokort");
  if (!sidokort) return;

  const data = await hamtaFranApi("/matches?status=FINISHED&dateFrom=" + datum(-1) + "&dateTo=" + datum(1));

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

  turneringar.forEach(function (lista, namn) {
    sidokort.appendChild(skapa("h3", "re-turnering", namn));
    lista.forEach(function (match) {
      sidokort.appendChild(byggResultat(match));
    });
  });
}

visaResultat();
// Hämta nya resultat varje minut (lite mer än API-cachens 60 sekunder)
setInterval(visaResultat, 65000);
