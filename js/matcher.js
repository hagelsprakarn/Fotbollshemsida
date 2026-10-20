// Visar kommande matcher på matcher.html.

// Vilken liga vi hämtar. PL = Premier League.
// Andra koder hittar ni i API:ets dokumentation (t.ex. PD, BL1, SA).
const TAVLING = "PL";

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

  // Datum: från idag till och med 7 dagar framåt
  const idag = new Date();
  const omSjuDagar = new Date();
  omSjuDagar.setDate(idag.getDate() + 7);
  const fran = idag.toISOString().slice(0, 10);   // t.ex. 2026-10-19
  const till = omSjuDagar.toISOString().slice(0, 10);

  const data = await hamtaFranApi(
    "/competitions/" + TAVLING + "/matches?dateFrom=" + fran + "&dateTo=" + till
  );

  if (!data) {
    meddelande.textContent = "Kunde inte hämta matcher. Vänta en minut och ladda om sidan.";
    return;
  }

  if (data.matches.length === 0) {
    meddelande.textContent = "Inga matcher de närmaste dagarna.";
    return;
  }

  meddelande.remove();

  // Gå igenom matcherna och lägg en datumrubrik varje gång dagen byter
  let senasteDag = "";
  data.matches.forEach(function (match) {
    const datum = new Date(match.utcDate);
    const dagNyckel = datum.toLocaleDateString("sv-SE");   // t.ex. 2026-10-24

    if (dagNyckel !== senasteDag) {
      const rubrik = datum.toLocaleDateString("sv-SE", {
        weekday: "long",
        day: "numeric",
        month: "long"
      });
      lista.appendChild(skapa("h2", "mr-dag", rubrik));
      senasteDag = dagNyckel;
    }

    lista.appendChild(byggMatchrad(match));
  });
}

visaMatcher();