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

// Visar tabellen för en liga
async function visaTabell(huvudkort, liga) {
  const rubrik = huvudkort.querySelector(".kort-rubrik");
  rubrik.textContent = liga.namn;

  const tillbaka = skapa("a", "liga-tillbaka", "← Alla ligor");
  tillbaka.href = "ligor.html";
  huvudkort.insertBefore(tillbaka, rubrik);

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

  const tabell = skapa("table", "liga-tabell");
  const huvud = document.createElement("tr");
  ["#", "Lag", "S", "V", "O", "F", "+/-", "P"].forEach(function (text, i) {
    huvud.appendChild(skapa("th", i === 1 ? "lag" : "", text));
  });
  tabell.appendChild(huvud);

  tabellData.table.forEach(function (rad) {
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
    tabell.appendChild(tr);
  });

  huvudkort.appendChild(tabell);
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
  ruta.appendChild(skapa("div", "re-dag", nar));

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

  // Står det t.ex. ?liga=PL i adressen visar vi den ligans tabell, annars alla ligor
  const kod = new URLSearchParams(window.location.search).get("liga");
  const liga = LIGOR.find(function (l) { return l.kod === kod; });

  if (liga) {
    visaTabell(huvudkort, liga);
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
