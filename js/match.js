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

// Målen under resultatet: hemmalagets till vänster, bortalagets till höger,
// t.ex. "⚽ James Maddison 14'". Klick på målskytten öppnar spelarsidan.
function byggMal(mal, match) {
  const ruta = skapa("div", "ma-mal");
  ["hemma", "borta"].forEach(function (sida) {
    const kolumn = skapa("div", "ma-malkolumn " + sida);
    mal.filter(function (m) { return m.lag === sida; }).forEach(function (m) {
      const rad = skapa("div", "ma-malrad");
      rad.appendChild(skapa("span", "ma-boll", "⚽"));
      // Vid självmål tillhör målskytten det andra laget
      const spelarensLag = (sida === "hemma") !== m.sjalvmal ? match.homeTeam : match.awayTeam;
      const namn = skapa("a", "ma-malskytt", m.spelare);
      namn.href = spelarLank(m.spelare, spelarensLag.name || spelarensLag.shortName);
      rad.appendChild(namn);
      rad.appendChild(skapa("span", "ma-minut", m.minut + (m.straff ? " (str)" : "") + (m.sjalvmal ? " (självmål)" : "")));
      if (m.assist) rad.title = "Assist: " + m.assist;
      kolumn.appendChild(rad);
    });
    ruta.appendChild(kolumn);
  });
  return ruta;
}

// Överst: turnering, lagen och resultatet (eller avsparkstiden)
function byggHuvud(match, mal) {
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
    gorTillTruppLank(ruta, lag);   // klick på laget (märke eller namn) visar truppen
    ruta.appendChild(skapa("div", "ma-lagnamn", lag.shortName || lag.name));
    rad.appendChild(ruta);
  });
  huvud.appendChild(rad);

  if (harStartat(match) && mal && mal.mal && mal.mal.length > 0) {
    huvud.appendChild(byggMal(mal.mal, match));
  }

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
  // "v=2" ger nya adresser, så att webbläsaren inte använder gamla sparade (ibland felaktiga) bilder
  bild.src = API_BAS_URL + "/spelarbild?v=2&namn=" + encodeURIComponent(spelare.namn) +
    "&lag=" + encodeURIComponent(lagnamn);
  return bild;
}

// Adressen till en spelares egen sida
function spelarLank(namn, lagnamn) {
  return "spelare.html?namn=" + encodeURIComponent(namn) + "&lag=" + encodeURIComponent(lagnamn);
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
      // Varje spelare på planen är en länk till spelarsidan
      const ruta = skapa("a", "ma-spelare");
      ruta.href = spelarLank(spelare.namn, lagnamn);
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
  plan.appendChild(byggPlanhalva(data.lag[1], false, match.awayTeam.name || match.awayTeam.shortName));
  plan.appendChild(byggPlanhalva(data.lag[0], true, match.homeTeam.name || match.homeTeam.shortName));
  sektion.appendChild(plan);
  sektion.appendChild(skapa("div", "ma-formation", etikett(data.lag[0], match.homeTeam)));

  return sektion;
}

// ============================================
// SKADELISTA
// Kommer från Premier Leagues Fantasy-API, så den finns bara för Premier League-lag.
// ============================================

// Lagnamn utan accenter, "FC" och skiljetecken, uppdelat i ord
function namnord(namn) {
  return (namn || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(/\b(fc|afc)\b/g, " ").trim().split(/\s+/);
}

// Samma lag om förkortningen är lika, eller om det kortare namnet är början på det längre
// ("Tottenham" och "Tottenham Hotspur")
function sammaLag(skadelag, lag) {
  if (skadelag.kort === lag.tla) return true;
  const a = namnord(skadelag.namn);
  return [lag.shortName, lag.name].some(function (namn) {
    const b = namnord(namn);
    const kort = a.length <= b.length ? a : b;
    const lang = kort === a ? b : a;
    return kort.every(function (ord, i) { return ord === lang[i]; });
  });
}

// Fantasy-API:et skriver på engelska, de vanligaste orden översätts
const SKADEORD = [
  [/Unknown return date/i, "okänt när han är tillbaka"],
  [/Expected back/i, "väntas tillbaka"],
  [/(\d+)% chance of playing/i, "$1% chans att spela"],
  [/Suspended until/i, "Avstängd till"],
  [/Knee injury/i, "Knäskada"],
  [/Ankle injury/i, "Fotledsskada"],
  [/Hamstring injury/i, "Skada i baksida lår"],
  [/Groin injury/i, "Ljumskskada"],
  [/Calf injury/i, "Vadskada"],
  [/Thigh injury/i, "Lårskada"],
  [/Back injury/i, "Ryggskada"],
  [/Foot injury/i, "Fotskada"],
  [/Shoulder injury/i, "Axelskada"],
  [/Muscle injury/i, "Muskelskada"],
  [/Illness/i, "Sjuk"]
];

function oversatt(text) {
  return SKADEORD.reduce(function (t, par) { return t.replace(par[0], par[1]); }, text || "");
}

function statusEtikett(spelare) {
  if (spelare.status === "s") return "Avstängd";
  if (spelare.status === "d") return "Tveksam" + (spelare.chans !== null ? " " + spelare.chans + "%" : "");
  return "Skadad";
}

function byggSkadekolumn(lag, skador) {
  const kolumn = skapa("div", "ma-skadekolumn");
  kolumn.appendChild(skapa("h3", "re-turnering", lag.shortName || lag.name));

  const skadelag = skador ? skador.find(function (s) { return sammaLag(s, lag); }) : null;
  if (!skadelag) {
    kolumn.appendChild(skapa("p", "ma-skadeinfo", "Skadelista finns bara för Premier League-lag."));
    return kolumn;
  }
  if (skadelag.spelare.length === 0) {
    kolumn.appendChild(skapa("p", "ma-skadeinfo", "Inga skadade eller avstängda spelare."));
    return kolumn;
  }
  skadelag.spelare.forEach(function (spelare) {
    const rad = skapa("div", "ma-skada");
    const topp = skapa("div", "ma-skadetopp");
    topp.appendChild(skapa("span", "ma-skadenamn", spelare.kortnamn || spelare.namn));
    topp.appendChild(skapa("span", "ma-skadestatus status-" + spelare.status, statusEtikett(spelare)));
    rad.appendChild(topp);
    if (spelare.nyhet) rad.appendChild(skapa("div", "ma-skadeinfo", oversatt(spelare.nyhet)));
    rad.title = spelare.namn;
    kolumn.appendChild(rad);
  });
  return kolumn;
}

// Skadelistan visas bara inför och under matchen, för den visar dagens skador
function byggSkadelista(skador, match) {
  const sektion = skapa("div", "ma-skadelista");
  if (match.status === "FINISHED") return sektion;
  sektion.appendChild(skapa("h2", "mr-dag", "Skadelista"));
  const kolumner = skapa("div", "ma-skadekolumner");
  kolumner.appendChild(byggSkadekolumn(match.homeTeam, skador));
  kolumner.appendChild(byggSkadekolumn(match.awayTeam, skador));
  sektion.appendChild(kolumner);
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
      const rad = skapa("a", "ma-avbytare");
      rad.href = spelarLank(spelare.namn, par[1].name || par[1].shortName);
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

  const [match, uppstallning, skador, mal] = await Promise.all([
    hamtaFranApi("/matches/" + id),
    hamtaFranApi("/uppstallning?id=" + id),
    hamtaFranApi("/skador"),
    hamtaFranApi("/mal?id=" + id)
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
  kort.replaceChildren(byggHuvud(match, mal), byggUppstallning(uppstallning, match), byggSkadelista(skador, match));
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
