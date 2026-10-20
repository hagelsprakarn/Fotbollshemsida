// Visar dagens matcher i alla ligor på matcher.html.

// Hjälpfunktion: skapar ett element med en klass och en text
function skapa(tagg, klass, text) {
  const element = document.createElement(tagg);
  if (klass) element.className = klass;
  if (text !== undefined) element.textContent = text;
  return element;
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
  hemma.appendChild(skapa("span", "", match.homeTeam.shortName || match.homeTeam.name));

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
  borta.appendChild(skapa("span", "", match.awayTeam.shortName || match.awayTeam.name));
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

  // Gå igenom matcherna och lägg en rubrik varje gång turneringen byter
  let senasteTavling = "";
  data.matches.forEach(function (match) {
    if (match.competition.name !== senasteTavling) {
      lista.appendChild(skapa("h2", "mr-dag", match.competition.name));
      senasteTavling = match.competition.name;
    }

    lista.appendChild(byggMatchrad(match));
  });
}

visaMatcher();