// Visar topp 5-ligorna och Champions League på ligor.html.
// Klickar man på en liga visas dess tabell (adressen blir t.ex. ligor.html?liga=PL).

// Koderna är football-data.org:s namn på ligorna
const LIGOR = [
  { kod: "PL", namn: "Premier League", land: "England" },
  { kod: "PD", namn: "La Liga", land: "Spanien" },
  { kod: "BL1", namn: "Bundesliga", land: "Tyskland" },
  { kod: "SA", namn: "Serie A", land: "Italien" },
  { kod: "FL1", namn: "Ligue 1", land: "Frankrike" },
  { kod: "CL", namn: "Champions League", land: "Europa" }
];

// Hjälpfunktion: skapar ett element med en klass och en text
function skapa(tagg, klass, text) {
  const element = document.createElement(tagg);
  if (klass) element.className = klass;
  if (text !== undefined) element.textContent = text;
  return element;
}

function skapaLogga(adress) {
  const logga = document.createElement("img");
  logga.src = adress;
  logga.alt = "";
  return logga;
}

// Visar alla ligor som klickbara kort
function visaLigalista(huvudkort) {
  const lista = skapa("div", "liga-lista");

  LIGOR.forEach(function (liga) {
    const kort = skapa("div", "liga-kort");
    kort.setAttribute("role", "button");
    kort.tabIndex = 0;   // så att man kan välja kortet med tangentbordet också

    const loggruta = skapa("div", "liga-logga");
    loggruta.appendChild(skapaLogga("https://crests.football-data.org/" + liga.kod + ".png"));
    kort.appendChild(loggruta);

    const text = skapa("div");
    text.appendChild(skapa("div", "liga-namn", liga.namn));
    text.appendChild(skapa("div", "liga-land", liga.land));
    kort.appendChild(text);

    // Ett klick (eller Enter) skickar en direkt vidare till ligans tabell
    function oppna() {
      window.location.href = "ligor.html?liga=" + liga.kod;
    }
    kort.addEventListener("click", oppna);
    kort.addEventListener("keydown", function (e) {
      if (e.key === "Enter") oppna();
    });

    lista.appendChild(kort);
  });

  huvudkort.appendChild(lista);
}

// En vald liga: rubrik, flikarna "Tabell" och "Skytteliga" och det som fliken visar.
// Vald flik står i adressen, t.ex. ligor.html?liga=PL&vy=skytteliga
const LIGAFLIKAR = [
  { vy: "tabell", namn: "Tabell", visa: visaTabell },
  { vy: "skytteliga", namn: "Skytteliga", visa: visaSkytteliga }
];

function visaLiga(huvudkort, liga, vy) {
  const rubrik = huvudkort.querySelector(".kort-rubrik");
  rubrik.textContent = liga.namn;

  const tillbaka = skapa("a", "liga-tillbaka", "← Alla ligor");
  tillbaka.href = "ligor.html";
  huvudkort.insertBefore(tillbaka, rubrik);

  const flikar = skapa("div", "fo-flikar");
  const innehall = skapa("div", "liga-innehall");
  huvudkort.appendChild(flikar);
  huvudkort.appendChild(innehall);

  function oppna(flik) {
    flikar.querySelectorAll(".fo-flik").forEach(function (f) {
      f.classList.toggle("vald", f.textContent === flik.namn);
    });
    history.replaceState(null, "", "ligor.html?liga=" + liga.kod + (flik.vy === "tabell" ? "" : "&vy=" + flik.vy));
    // En ny yta för varje flik, där man bläddrar mellan sidorna med pilar
    const yta = skapa("div", "bladdra-kort liga-yta");
    innehall.replaceChildren(yta);
    flik.visa(yta, liga);
  }

  LIGAFLIKAR.forEach(function (flik) {
    const knapp = skapa("div", "fo-flik", flik.namn);
    knapp.setAttribute("role", "button");
    knapp.tabIndex = 0;
    knapp.addEventListener("click", function () { oppna(flik); });
    knapp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") oppna(flik);
    });
    flikar.appendChild(knapp);
  });

  oppna(LIGAFLIKAR.find(function (f) { return f.vy === vy; }) || LIGAFLIKAR[0]);
}

// Delar upp tabellraderna i sidor som man bläddrar mellan med pilarna. Varje sida får en
// egen tabell med rubrikraden överst och så många rader som får plats i rutan (det beror
// på skärmens storlek). Raderna läggs en i taget i en osynlig provsida, och när det blir
// fullt börjar en ny sida, på samma sätt som på Nyheter-sidan.
function sidorMedTabell(yta, rubrikrad, rader, klass) {
  const provruta = skapa("div", "mr-sidruta");
  const provraknare = skapa("div", "mr-raknare", "1 / 1");   // tar samma plats som den riktiga räknaren
  provruta.style.visibility = "hidden";
  yta.appendChild(provruta);
  yta.appendChild(provraknare);

  const sidor = [];
  let sida;
  let tabell;
  function nySida() {
    sida = skapa("div", "mr-sida");
    tabell = skapa("table", klass);
    tabell.appendChild(rubrikrad.cloneNode(true));
    sida.appendChild(tabell);
    provruta.replaceChildren(sida);
    sidor.push(sida);
  }

  nySida();
  rader.forEach(function (tr) {
    tabell.appendChild(tr);
    // Får raden inte plats flyttas den till en ny sida (men varje sida har minst en rad)
    const forHog = tr.getBoundingClientRect().bottom > sida.getBoundingClientRect().bottom;
    if (forHog && tabell.rows.length > 2) {
      nySida();
      tabell.appendChild(tr);
    }
  });

  provruta.remove();
  provraknare.remove();
  return sidor;
}

// Visar tabellen för en liga
async function visaTabell(huvudkort, liga) {
  const meddelande = skapa("p", "mr-meddelande", "Hämtar tabell...");
  huvudkort.appendChild(meddelande);

  const data = await hamtaFranApi("/competitions/" + liga.kod + "/standings");

  if (!data || !data.standings || data.standings.length === 0) {
    meddelande.textContent = "Kunde inte hämta tabellen. Vänta en minut och ladda om sidan.";
    return;
  }

  meddelande.remove();

  // Den totala tabellen (det finns även hemma- och bortatabeller som vi hoppar över)
  const tabellData = data.standings.find(function (s) { return s.type === "TOTAL"; }) || data.standings[0];

  const huvud = document.createElement("tr");
  ["#", "Lag", "S", "V", "O", "F", "+/-", "P"].forEach(function (text, i) {
    huvud.appendChild(skapa("th", i === 1 ? "lag" : "", text));
  });

  const rader = tabellData.table.map(function (rad) {
    const tr = document.createElement("tr");
    tr.appendChild(skapa("td", "", rad.position));

    const lag = skapa("td", "lag");
    if (rad.team.crest) lag.appendChild(skapaLogga(rad.team.crest));
    lag.appendChild(skapa("span", "", rad.team.shortName || rad.team.name));
    tr.appendChild(lag);
    gorTillTruppLank(tr, rad.team);   // klick var som helst på raden visar lagets trupp

    [rad.playedGames, rad.won, rad.draw, rad.lost, rad.goalDifference].forEach(function (varde) {
      tr.appendChild(skapa("td", "", varde));
    });
    tr.appendChild(skapa("td", "poang", rad.points));
    return tr;
  });

  await document.fonts.ready;   // typsnittet måste vara laddat innan raderna mäts
  visaSidor(huvudkort, sidorMedTabell(huvudkort, huvud, rader, "liga-tabell"));
}

// ============================================
// SKYTTELIGA
// ============================================

// Spelarens ansikte, samma bilder som på resten av sidan. Saknas bild visas initialerna.
function byggSkyttAnsikte(spelare, lag) {
  const bild = document.createElement("img");
  bild.className = "sk-ansikte";
  bild.alt = "";
  bild.onerror = function () {
    const initialer = spelare.name.split(" ").map(function (ord) { return ord[0]; }).join("").slice(0, 2);
    bild.replaceWith(skapa("div", "sk-ansikte sok-initialer", initialer));
  };
  bild.src = API_BAS_URL + "/spelarbild?v=2&namn=" + encodeURIComponent(spelare.name) +
    "&lag=" + encodeURIComponent(lag.name);
  return bild;
}

// Visar ligans skytteliga: mål, assist, straffmål och spelade matcher.
// Klick på en spelare öppnar spelarsidan, klick på klubbmärket lagets trupp.
async function visaSkytteliga(huvudkort, liga) {
  const meddelande = skapa("p", "mr-meddelande", "Hämtar skytteliga...");
  huvudkort.appendChild(meddelande);

  const data = await hamtaFranApi("/competitions/" + liga.kod + "/scorers?limit=25");

  if (!data || !data.scorers) {
    meddelande.textContent = "Kunde inte hämta skytteligan. Vänta en minut och ladda om sidan.";
    return;
  }
  if (data.scorers.length === 0) {
    meddelande.textContent = "Inga mål gjorda än den här säsongen.";
    return;
  }

  meddelande.remove();

  const huvud = document.createElement("tr");
  [["#", ""], ["Spelare", "lag"], ["M", "Spelade matcher"], ["Mål", "Mål"], ["A", "Assist"], ["Str", "Straffmål"]]
    .forEach(function (par) {
      const th = skapa("th", par[1] === "lag" ? "lag" : "", par[0]);
      if (par[1] && par[1] !== "lag") th.title = par[1];
      huvud.appendChild(th);
    });

  // Har två spelare lika många mål delar de placering
  let placering = 0;
  const rader = data.scorers.map(function (rad, i) {
    if (i === 0 || rad.goals !== data.scorers[i - 1].goals) placering = i + 1;

    const tr = skapa("tr", "sk-rad");
    tr.appendChild(skapa("td", "", placering));

    const spelare = skapa("td", "lag sk-spelare");
    spelare.appendChild(byggSkyttAnsikte(rad.player, rad.team));
    const text = skapa("div", "sk-text");
    text.appendChild(skapa("div", "sk-namn", rad.player.name));
    const klubb = skapa("div", "sok-lagrad sk-klubb");
    if (rad.team.crest) {
      const logga = skapaLogga(rad.team.crest);
      logga.className = "sok-litenlogga";
      gorTillTruppLank(logga, rad.team);
      klubb.appendChild(logga);
    }
    klubb.appendChild(skapa("span", "", rad.team.shortName || rad.team.name));
    text.appendChild(klubb);
    spelare.appendChild(text);
    tr.appendChild(spelare);

    [rad.playedMatches, rad.goals, rad.assists, rad.penalties].forEach(function (varde, j) {
      tr.appendChild(skapa("td", j === 1 ? "poang" : "", varde === null || varde === undefined ? 0 : varde));
    });

    // Raden leder till spelarsidan
    tr.addEventListener("click", function () {
      window.location.href = "spelare.html?namn=" + encodeURIComponent(rad.player.name) +
        "&lag=" + encodeURIComponent(rad.team.name);
    });
    return tr;
  });

  await document.fonts.ready;   // typsnittet måste vara laddat innan raderna mäts
  visaSidor(huvudkort, sidorMedTabell(huvudkort, huvud, rader, "liga-tabell sk-tabell"));
}

// ============================================
// SENASTE OMGÅNGEN (högra rutan när en liga är vald)
// ============================================

// Champions League har ingen omgång i slutspelet, då visar vi vilken runda det är
const RUNDOR = {
  PLAYOFFS: "Playoff",
  LAST_16: "Åttondelsfinal",
  QUARTER_FINALS: "Kvartsfinal",
  SEMI_FINALS: "Semifinal",
  FINAL: "Final"
};

function omgangsNamn(match) {
  if (match.matchday && !RUNDOR[match.stage]) return "Omgång " + match.matchday;
  return RUNDOR[match.stage] || "Senaste omgången";
}

// En rad i rutan: logga, förkortning och mål (tomt om matchen inte har börjat)
function byggOmgangsLag(lag, mal, forlorade) {
  const rad = skapa("div", "re-lag" + (forlorade ? " forlorade" : ""));
  if (lag.crest) {
    const logga = skapaLogga(lag.crest);
    gorTillTruppLank(logga, lag);
    rad.appendChild(logga);
  }
  rad.appendChild(skapa("span", "re-namn", lag.tla || lag.shortName || lag.name));
  rad.appendChild(skapa("span", "re-mal", mal === null ? "" : mal));
  return rad;
}

// En ruta för en match. Överst står när den spelas, eller "Slut"/"Pågår".
function byggOmgangsMatch(match) {
  const ruta = skapa("a", "re-match");
  ruta.href = "match.html?id=" + match.id;

  let nar;
  if (match.status === "FINISHED") nar = "Slut";
  else if (match.status === "IN_PLAY" || match.status === "PAUSED") nar = "Pågår";
  else nar = new Date(match.utcDate).toLocaleString("sv-SE", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });
  const pagar = match.status === "IN_PLAY" || match.status === "PAUSED";
  ruta.appendChild(skapa("div", "re-dag" + (pagar ? " live" : ""), nar));

  const malHemma = match.score.fullTime.home;
  const malBorta = match.score.fullTime.away;
  ruta.appendChild(byggOmgangsLag(match.homeTeam, malHemma, match.score.winner === "AWAY_TEAM"));
  ruta.appendChild(byggOmgangsLag(match.awayTeam, malBorta, match.score.winner === "HOME_TEAM"));
  return ruta;
}

async function visaSenasteOmgangen(liga) {
  const sidokort = document.getElementById("sidokort");
  if (!sidokort) return;

  // Alla säsongens matcher i ligan (sparas en minut av api.js och mellanhanden)
  const data = await hamtaFranApi("/competitions/" + liga.kod + "/matches");

  // Misslyckas en uppdatering behåller vi det som redan visas
  if (!data && sidokort.children.length > 0) return;

  sidokort.replaceChildren(skapa("h2", "fo-sidorubrik", "Senaste omgången"));

  if (!data) {
    sidokort.appendChild(skapa("p", "re-meddelande", "Kunde inte hämta omgången."));
    return;
  }

  // Den senast spelade matchen bestämmer vilken omgång som är "senaste"
  const spelade = data.matches.filter(function (m) { return m.status === "FINISHED"; });
  if (spelade.length === 0) {
    sidokort.appendChild(skapa("p", "re-meddelande", "Inga matcher spelade än den här säsongen."));
    return;
  }
  const senaste = spelade.reduce(function (a, b) { return a.utcDate > b.utcDate ? a : b; });

  // Hela omgången, även matcher som inte är spelade än, i tidsordning
  const omgangen = data.matches.filter(function (m) {
    return m.stage === senaste.stage && m.matchday === senaste.matchday;
  }).sort(function (a, b) { return a.utcDate.localeCompare(b.utcDate); });

  sidokort.appendChild(skapa("h3", "re-turnering", omgangsNamn(senaste)));
  omgangen.forEach(function (match) {
    sidokort.appendChild(byggOmgangsMatch(match));
  });
}

function visaLigor() {
  const huvudkort = document.getElementById("liga-kort");
  if (!huvudkort) return;

  // Står det t.ex. ?liga=PL i adressen visar vi den ligan, annars alla ligor.
  // ?vy=skytteliga öppnar skytteligan direkt.
  const parametrar = new URLSearchParams(window.location.search);
  const kod = parametrar.get("liga");
  const liga = LIGOR.find(function (l) { return l.kod === kod; });

  if (liga) {
    visaLiga(huvudkort, liga, parametrar.get("vy"));
    visaSenasteOmgangen(liga);
    // Hämta nya resultat varje minut (lite mer än API-cachens 60 sekunder)
    setInterval(function () { visaSenasteOmgangen(liga); }, 65000);
  } else {
    visaLigalista(huvudkort);
    // Högra rutan används bara när en liga är vald, så den tas bort i listan
    document.getElementById("sidokort").remove();
  }
}

visaLigor();
