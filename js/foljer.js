// Följer-sidan: välj lag att följa och se deras form, resultat och kommande matcher.
// Lagen man följer sparas i webbläsaren (localStorage), så de finns kvar nästa gång.
// Adressen styr vad som visas i mitten:
//   foljer.html            -> första laget man följer (eller "följ ett lag")
//   foljer.html?lag=73     -> laget med id 73 (Tottenham)
//   foljer.html?valj=PL    -> lagen i Premier League att välja bland

const LIGOR = [
  { kod: "PL", namn: "Premier League" },
  { kod: "PD", namn: "La Liga" },
  { kod: "BL1", namn: "Bundesliga" },
  { kod: "SA", namn: "Serie A" },
  { kod: "FL1", namn: "Ligue 1" }
];

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

function skapaLogga(adress) {
  const logga = document.createElement("img");
  logga.src = adress;
  logga.alt = "";
  return logga;
}

// Gör ett element klickbart så att det skickar en vidare till en adress
function klickbar(element, adress) {
  element.setAttribute("role", "button");
  element.tabIndex = 0;
  element.addEventListener("click", function () { window.location.href = adress; });
  element.addEventListener("keydown", function (e) {
    if (e.key === "Enter") window.location.href = adress;
  });
}

// ---------- Sparade lag ----------

function hamtaFoljdaLag() {
  try {
    return JSON.parse(localStorage.getItem("foljdaLag")) || [];
  } catch (fel) {
    return [];
  }
}

function sparaFoljdaLag(lag) {
  try {
    localStorage.setItem("foljdaLag", JSON.stringify(lag));
  } catch (fel) {
    // om webbläsaren inte tillåter sparande följer man bara laget just nu
  }
}

function foljLag(lag) {
  const lista = hamtaFoljdaLag().filter(function (l) { return l.id !== lag.id; });
  lista.push(lag);
  sparaFoljdaLag(lista);
}

function slutaFolja(id) {
  sparaFoljdaLag(hamtaFoljdaLag().filter(function (l) { return l.id !== id; }));
}

// ---------- Högerrutan: Mina lag ----------

function visaMinaLag(valtId) {
  const sidokort = document.getElementById("sidokort");
  sidokort.appendChild(skapa("h2", "fo-sidorubrik", "Mina lag"));

  hamtaFoljdaLag().forEach(function (lag) {
    const rad = skapa("div", "fo-minlag" + (lag.id === valtId ? " vald" : ""));
    rad.appendChild(skapaLogga(lag.logga));
    rad.appendChild(skapa("span", "", lag.namn));
    klickbar(rad, "foljer.html?lag=" + lag.id);
    sidokort.appendChild(rad);
  });

  const knapp = skapa("div", "fo-knapp", "+ Följ lag");
  klickbar(knapp, "foljer.html?valj=PL");
  sidokort.appendChild(knapp);
}

// ---------- Mitten: välj lag att följa ----------

async function visaLagval(huvudkort, ligakod) {
  huvudkort.querySelector(".kort-rubrik").textContent = "Följ ett lag";

  // Knappar för att byta liga
  const flikar = skapa("div", "fo-flikar");
  LIGOR.forEach(function (liga) {
    const flik = skapa("div", "fo-flik" + (liga.kod === ligakod ? " vald" : ""), liga.namn);
    klickbar(flik, "foljer.html?valj=" + liga.kod);
    flikar.appendChild(flik);
  });
  huvudkort.appendChild(flikar);

  const meddelande = skapa("p", "mr-meddelande", "Hämtar lag...");
  huvudkort.appendChild(meddelande);

  const data = await hamtaFranApi("/competitions/" + ligakod + "/teams");
  if (!data || !data.teams) {
    meddelande.textContent = "Kunde inte hämta lagen. Vänta en minut och ladda om sidan.";
    return;
  }
  meddelande.remove();

  const foljdaId = hamtaFoljdaLag().map(function (l) { return l.id; });
  const rutnat = skapa("div", "fo-lagval");

  data.teams.forEach(function (lag) { lag.shortName = lag.shortName || lag.name; });

  data.teams
    .sort(function (a, b) { return a.shortName.localeCompare(b.shortName); })
    .forEach(function (lag) {
      const kort = skapa("div", "fo-lagkort" + (foljdaId.includes(lag.id) ? " foljs" : ""));
      kort.appendChild(skapaLogga(lag.crest));
      kort.appendChild(skapa("span", "", lag.shortName));
      kort.setAttribute("role", "button");
      kort.tabIndex = 0;

      function valj() {
        foljLag({ id: lag.id, namn: lag.shortName, logga: lag.crest });
        window.location.href = "foljer.html?lag=" + lag.id;
      }
      kort.addEventListener("click", valj);
      kort.addEventListener("keydown", function (e) { if (e.key === "Enter") valj(); });

      rutnat.appendChild(kort);
    });

  huvudkort.appendChild(rutnat);
}

// ---------- Mitten: ett lags form, resultat och matcher ----------

// "V", "O" eller "F" sett från lagets håll
function resultatFor(match, lagId) {
  if (match.score.winner === "DRAW") return "O";
  const hemmalag = match.homeTeam.id === lagId;
  if ((match.score.winner === "HOME_TEAM") === hemmalag) return "V";
  return "F";
}

function formatDatum(utcDate, medTid) {
  const datum = new Date(utcDate);
  let text = datum.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
  if (medTid) {
    text += " " + datum.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }
  return text;
}

// En matchrad: datum överst, sedan hemmalag – resultat/tid – bortalag
function byggLagmatch(match, lagId, spelad) {
  const rad = skapa("div", "mr-rad fo-match");

  // Klubbmärkena visar lagets trupp
  const hemma = skapa("div", "mr-lag");
  const hemmaLogga = skapaLogga(match.homeTeam.crest);
  gorTillTruppLank(hemmaLogga, match.homeTeam);
  hemma.appendChild(hemmaLogga);
  hemma.appendChild(lagnamn(match.homeTeam));

  let mitten;
  if (spelad) {
    mitten = skapa("div", "mr-mitten fo-res-" + resultatFor(match, lagId),
      match.score.fullTime.home + " – " + match.score.fullTime.away);
  } else {
    mitten = skapa("div", "mr-mitten",
      new Date(match.utcDate).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }));
  }

  const borta = skapa("div", "mr-lag borta");
  borta.appendChild(lagnamn(match.awayTeam));
  const bortaLogga = skapaLogga(match.awayTeam.crest);
  gorTillTruppLank(bortaLogga, match.awayTeam);
  borta.appendChild(bortaLogga);

  const datum = skapa("div", "fo-datum", formatDatum(match.utcDate, false) + " · " + match.competition.name);

  rad.appendChild(datum);
  rad.appendChild(hemma);
  rad.appendChild(mitten);
  rad.appendChild(borta);
  return rad;
}

async function visaLag(huvudkort, lag) {
  const rubrik = huvudkort.querySelector(".kort-rubrik");
  rubrik.textContent = "";
  rubrik.classList.add("fo-lagrubrik");
  const rubrikLogga = skapaLogga(lag.logga);
  gorTillTruppLank(rubrikLogga, { id: lag.id });
  rubrik.appendChild(rubrikLogga);
  rubrik.appendChild(skapa("span", "", lag.namn));

  const sluta = skapa("div", "fo-sluta", "Sluta följa");
  sluta.setAttribute("role", "button");
  sluta.tabIndex = 0;
  sluta.addEventListener("click", function () {
    slutaFolja(lag.id);
    window.location.href = "foljer.html";
  });
  huvudkort.appendChild(sluta);

  const meddelande = skapa("p", "mr-meddelande", "Hämtar matcher...");
  huvudkort.appendChild(meddelande);

  // Hämta alla lagets matcher tre månader bakåt och framåt i ett enda anrop
  const fran = new Date();
  fran.setDate(fran.getDate() - 90);
  const till = new Date();
  till.setDate(till.getDate() + 90);
  const data = await hamtaFranApi("/teams/" + lag.id + "/matches?dateFrom=" +
    fran.toISOString().slice(0, 10) + "&dateTo=" + till.toISOString().slice(0, 10));

  if (!data || !data.matches) {
    meddelande.textContent = "Kunde inte hämta matcher. Vänta en minut och ladda om sidan.";
    return;
  }
  meddelande.remove();

  const spelade = data.matches
    .filter(function (m) { return m.status === "FINISHED"; })
    .reverse();   // senaste först
  const kommande = data.matches
    .filter(function (m) { return ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED"].includes(m.status); });

  // Form: de fem senaste matcherna som V/O/F, äldst till vänster
  const form = skapa("div", "fo-form");
  form.appendChild(skapa("span", "fo-etikett", "Form"));
  spelade.slice(0, 5).reverse().forEach(function (match) {
    const bokstav = resultatFor(match, lag.id);
    form.appendChild(skapa("span", "fo-formbricka fo-res-" + bokstav, bokstav));
  });
  if (spelade.length === 0) form.appendChild(skapa("span", "fo-etikett", "Inga spelade matcher än"));
  huvudkort.appendChild(form);

  // Tabellplacering i ligan laget spelar i
  const ligamatch = data.matches.find(function (m) { return m.competition.type === "LEAGUE"; });
  if (ligamatch) {
    const placering = skapa("p", "fo-placering", "");
    huvudkort.appendChild(placering);
    hamtaFranApi("/competitions/" + ligamatch.competition.code + "/standings").then(function (tabell) {
      if (!tabell || !tabell.standings) return;
      const total = tabell.standings.find(function (s) { return s.type === "TOTAL"; });
      const rad = total && total.table.find(function (r) { return r.team.id === lag.id; });
      if (rad) {
        // 1:a, 2:a, 3:e ... 11:e, 12:e ... 21:a, 22:a
        const sista = rad.position % 10;
        const andelse = (sista === 1 || sista === 2) && rad.position !== 11 && rad.position !== 12 ? ":a" : ":e";
        placering.textContent = rad.position + andelse + " i " + ligamatch.competition.name +
          " · " + rad.points + " poäng på " + rad.playedGames + " matcher";
      }
    });
  }

  huvudkort.appendChild(skapa("h2", "mr-dag", "Senaste resultat"));
  if (spelade.length === 0) huvudkort.appendChild(skapa("p", "mr-meddelande", "Inga spelade matcher än."));
  spelade.slice(0, 5).forEach(function (match) {
    huvudkort.appendChild(byggLagmatch(match, lag.id, true));
  });

  huvudkort.appendChild(skapa("h2", "mr-dag", "Kommande matcher"));
  if (kommande.length === 0) huvudkort.appendChild(skapa("p", "mr-meddelande", "Inga kommande matcher inlagda."));
  kommande.slice(0, 5).forEach(function (match) {
    const rad = byggLagmatch(match, lag.id, false);
    rad.querySelector(".fo-datum").textContent =
      formatDatum(match.utcDate, true) + " · " + match.competition.name;
    huvudkort.appendChild(rad);
  });
}

// ---------- Start ----------

function visaFoljer() {
  const huvudkort = document.getElementById("folj-kort");
  if (!huvudkort) return;

  const parametrar = new URLSearchParams(window.location.search);
  const foljda = hamtaFoljdaLag();
  const valjLiga = LIGOR.find(function (l) { return l.kod === parametrar.get("valj"); });
  const lagId = Number(parametrar.get("lag"));
  const lag = foljda.find(function (l) { return l.id === lagId; }) || foljda[0];

  if (valjLiga || !lag) {
    // Valt att följa nytt lag, eller följer inga lag än
    visaMinaLag(null);
    visaLagval(huvudkort, valjLiga ? valjLiga.kod : "PL");
  } else {
    visaMinaLag(lag.id);
    visaLag(huvudkort, lag);
  }
}

visaFoljer();
