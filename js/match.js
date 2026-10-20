// Visar en match på match.html: lag, resultat och laguppställningar.
// Vilken match det är står i adressen, t.ex. match.html?id=560606

// Hjälpfunktion: skapar ett element med en klass och en text
function skapa(tagg, klass, text) {
  const element = document.createElement(tagg);
  if (klass) element.className = klass;
  if (text !== undefined) element.textContent = text;
  return element;
}

function skapaLogga(lag) {
  const logga = document.createElement("img");
  logga.src = lag.crest;
  logga.alt = "";
  return logga;
}

// Text under resultatet, t.ex. "Slut" eller "Avspark tis 20 okt 21:00"
function statusText(match) {
  if (match.status === "FINISHED") return "Slut";
  if (match.status === "IN_PLAY") return "Pågår";
  if (match.status === "PAUSED") return "Halvtid";
  if (match.status === "POSTPONED") return "Uppskjuten";
  if (match.status === "CANCELLED") return "Inställd";
  return "Avspark " + new Date(match.utcDate).toLocaleString("sv-SE", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });
}

function harStartat(match) {
  return ["IN_PLAY", "PAUSED", "FINISHED"].includes(match.status);
}

// Överst: turnering, lagen och resultatet (eller avsparkstiden)
function byggHuvud(match) {
  const huvud = skapa("div", "ma-huvud");

  const tillbaka = skapa("a", "liga-tillbaka", "‹ Matcher");
  tillbaka.href = "matcher.html";
  huvud.appendChild(tillbaka);

  huvud.appendChild(skapa("div", "ma-turnering", match.competition.name));

  const rad = skapa("div", "ma-lagrad");
  [match.homeTeam, null, match.awayTeam].forEach(function (lag) {
    if (lag === null) {
      const mitten = skapa("div", "ma-mitten");
      const resultat = harStartat(match)
        ? match.score.fullTime.home + " – " + match.score.fullTime.away
        : new Date(match.utcDate).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
      mitten.appendChild(skapa("div", "ma-resultat", resultat));
      mitten.appendChild(skapa("div", "ma-status", statusText(match)));
      rad.appendChild(mitten);
      return;
    }
    const ruta = skapa("div", "ma-lag");
    if (lag.crest) ruta.appendChild(skapaLogga(lag));
    ruta.appendChild(skapa("div", "ma-lagnamn", lag.shortName || lag.name));
    rad.appendChild(ruta);
  });
  huvud.appendChild(rad);

  // Halvtid och domare, om vi vet dem
  const fakta = [];
  if (harStartat(match) && match.score.halfTime.home !== null) {
    fakta.push("Halvtid " + match.score.halfTime.home + " – " + match.score.halfTime.away);
  }
  const domare = (match.referees || []).find(function (d) { return d.type === "REFEREE"; });
  if (domare) fakta.push("Domare: " + domare.name);
  if (fakta.length > 0) huvud.appendChild(skapa("div", "ma-fakta", fakta.join(" · ")));

  return huvud;
}

// Spelarens ansikte i en cirkel. Hittas ingen bild visas tröjnumret i stället.
function byggAnsikte(spelare, lagnamn) {
  const bild = document.createElement("img");
  bild.className = "ma-ansikte";
  bild.alt = "";
  bild.onerror = function () {
    bild.replaceWith(skapa("div", "ma-nummer", spelare.nummer));
  };
  bild.src = API_BAS_URL + "/spelarbild?namn=" + encodeURIComponent(spelare.namn) +
    "&lag=" + encodeURIComponent(lagnamn);
  return bild;
}

// En planhalva. Hemmalaget har målvakten längst ner, bortalaget längst upp.
// "lag.rader" kommer färdiga från mellanhanden: målvakten först, sedan bakifrån
// och framåt, och varje rad från lagets vänsterkant till högerkant.
function byggPlanhalva(lag, arHemma, lagnamn) {
  const halva = skapa("div", "ma-halva" + (arHemma ? " hemma" : " borta"));
  if (!lag) {
    halva.appendChild(skapa("div", "ma-saknas", "Ingen uppställning hittades"));
    return halva;
  }
  lag.rader.forEach(function (rad) {
    const radElement = skapa("div", "ma-rad");
    // Bortalaget står vänt mot hemmalaget, så deras vänsterkant är vår högerkant
    (arHemma ? rad : rad.slice().reverse()).forEach(function (spelare) {
      const ruta = skapa("div", "ma-spelare");
      ruta.title = spelare.namn;
      ruta.appendChild(byggAnsikte(spelare, lagnamn));
      ruta.appendChild(skapa("div", "ma-namn", spelare.efternamn));
      radElement.appendChild(ruta);
    });
    halva.appendChild(radElement);
  });
  return halva;
}

function byggUppstallning(data, match) {
  const sektion = skapa("div", "ma-uppstallning");

  if (!data || data.typ === "saknas") {
    sektion.appendChild(skapa("p", "mr-meddelande", "Laguppställningen finns inte för den här matchen än."));
    if (data && data.orsak) console.warn("Uppställning saknas:", data.orsak);
    return sektion;
  }

  const forvantad = data.typ === "forvantad";
  sektion.appendChild(skapa("h2", "mr-dag", forvantad ? "Förväntade startelvor" : "Startelvor"));
  if (forvantad) {
    sektion.appendChild(skapa("p", "ma-forklaring", "Startelvorna är inte släppta än. Här visas lagens startelvor från deras förra match."));
  }

  // Lagnamn och formation ovanför och under planen
  function etikett(lag, fdLag) {
    return (fdLag.shortName || fdLag.name) + (lag && lag.formation ? "  " + lag.formation : "");
  }

  sektion.appendChild(skapa("div", "ma-formation", etikett(data.lag[1], match.awayTeam)));
  const plan = skapa("div", "ma-plan");
  plan.appendChild(byggPlanhalva(data.lag[1], false, match.awayTeam.shortName || match.awayTeam.name));
  plan.appendChild(byggPlanhalva(data.lag[0], true, match.homeTeam.shortName || match.homeTeam.name));
  sektion.appendChild(plan);
  sektion.appendChild(skapa("div", "ma-formation", etikett(data.lag[0], match.homeTeam)));

  return sektion;
}

// Högra rutan: avbytarna för båda lagen
function visaAvbytare(data, match) {
  const sidokort = document.getElementById("sidokort");
  sidokort.replaceChildren(skapa("h2", "fo-sidorubrik", "Avbytare"));

  if (!data || data.typ !== "riktig") {
    sidokort.appendChild(skapa("p", "re-meddelande", "Avbytarna visas när laguppställningen är släppt."));
    return;
  }

  [[data.lag[0], match.homeTeam], [data.lag[1], match.awayTeam]].forEach(function (par) {
    sidokort.appendChild(skapa("h3", "re-turnering", par[1].shortName || par[1].name));
    par[0].avbytare.forEach(function (spelare) {
      const rad = skapa("div", "ma-avbytare");
      rad.appendChild(skapa("span", "ma-avbytare-nr", spelare.nummer));
      rad.appendChild(skapa("span", "", spelare.namn));
      sidokort.appendChild(rad);
    });
  });
}

async function visaMatch() {
  const kort = document.getElementById("match");
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    kort.replaceChildren(skapa("p", "mr-meddelande", "Ingen match vald."));
    return;
  }

  if (kort.children.length === 0) {
    kort.appendChild(skapa("p", "mr-meddelande", "Hämtar matchen..."));
  }

  const [match, uppstallning] = await Promise.all([
    hamtaFranApi("/matches/" + id),
    hamtaFranApi("/uppstallning?id=" + id)
  ]);

  if (!match) {
    // Misslyckas en uppdatering behåller vi det som redan visas
    if (!kort.querySelector(".ma-huvud")) {
      kort.replaceChildren(skapa("p", "mr-meddelande", "Kunde inte hämta matchen. Vänta en minut och ladda om sidan."));
    }
    return;
  }

  document.title = "JodaFoot – " + (match.homeTeam.shortName || match.homeTeam.name) +
    " – " + (match.awayTeam.shortName || match.awayTeam.name);
  kort.replaceChildren(byggHuvud(match), byggUppstallning(uppstallning, match));
  visaAvbytare(uppstallning, match);

  // Uppdatera varje minut tills matchen är slut
  if (match.status !== "FINISHED" && !uppdaterar) {
    uppdaterar = setInterval(visaMatch, 65000);
  }
  if (match.status === "FINISHED" && uppdaterar) {
    clearInterval(uppdaterar);
  }
}

let uppdaterar = null;

visaMatch();
