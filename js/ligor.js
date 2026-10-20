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

    [rad.playedGames, rad.won, rad.draw, rad.lost, rad.goalDifference].forEach(function (varde) {
      tr.appendChild(skapa("td", "", varde));
    });
    tr.appendChild(skapa("td", "poang", rad.points));
    tabell.appendChild(tr);
  });

  huvudkort.appendChild(tabell);
}

function visaLigor() {
  const huvudkort = document.getElementById("liga-kort");
  if (!huvudkort) return;

  // Står det t.ex. ?liga=PL i adressen visar vi den ligans tabell, annars alla ligor
  const kod = new URLSearchParams(window.location.search).get("liga");
  const liga = LIGOR.find(function (l) { return l.kod === kod; });

  if (liga) {
    visaTabell(huvudkort, liga);
  } else {
    visaLigalista(huvudkort);
  }
}

visaLigor();
