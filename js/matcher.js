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

// Visar en sida i taget med pilar för att bläddra till nästa/förra sidan
function visaSidor(lista, sidor) {
  const ruta = skapa("div", "mr-sidruta");
  lista.appendChild(ruta);

  const vanster = skapa("button", "mr-pil vanster", "‹");
  const hoger = skapa("button", "mr-pil hoger", "›");
  vanster.setAttribute("aria-label", "Förra matcherna");
  hoger.setAttribute("aria-label", "Nästa matcher");
  const raknare = skapa("div", "mr-raknare");
  lista.appendChild(vanster);
  lista.appendChild(hoger);
  lista.appendChild(raknare);

  let nuvarande = 0;
  ruta.appendChild(sidor[0]);

  function uppdatera() {
    vanster.hidden = nuvarande === 0;
    hoger.hidden = nuvarande === sidor.length - 1;
    raknare.textContent = sidor.length > 1 ? (nuvarande + 1) + " / " + sidor.length : "";
  }

  // riktning 1 = nästa (glider in från höger), -1 = förra (glider in från vänster)
  function byt(riktning) {
    const ny = nuvarande + riktning;
    if (ny < 0 || ny >= sidor.length) return;

    const gammal = sidor[nuvarande];
    const nySida = sidor[ny];
    nuvarande = ny;

    // Klickar man snabbt: ta bort sidor som fortfarande håller på att glida ut
    Array.from(ruta.children).forEach(function (sida) {
      if (sida !== gammal) sida.remove();
    });

    gammal.className = "mr-sida ut" + (riktning > 0 ? "-vanster" : "-hoger");
    nySida.className = "mr-sida in" + (riktning > 0 ? "-hoger" : "-vanster");
    ruta.appendChild(nySida);

    // Ta bort den gamla sidan när animationen är klar
    setTimeout(function () {
      if (gammal !== sidor[nuvarande]) gammal.remove();
      if (nySida === sidor[nuvarande]) nySida.className = "mr-sida";
    }, 350);

    uppdatera();
  }

  vanster.addEventListener("click", function () { byt(-1); });
  hoger.addEventListener("click", function () { byt(1); });

  // Piltangenterna på tangentbordet fungerar också
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") byt(1);
    if (e.key === "ArrowLeft") byt(-1);
  });

  uppdatera();
}

visaMatcher();
