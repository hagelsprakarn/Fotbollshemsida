// Spelarsidan (spelare.html): allt om en spelare. Vilken spelare det är står i adressen,
// t.ex. spelare.html?namn=Pedri&lag=FC%20Barcelona
// Karriär, landslag, längd och meriter kommer från spelarens Wikipedia-sida (via mellanhanden).
// Ålder, land och klubbmärke kommer från football-data (samma data som Sök-sidan).

// Hjälpfunktion: skapar ett element med en klass och en text
function skapa(tagg, klass, text) {
  const element = document.createElement(tagg);
  if (klass) element.className = klass;
  if (text !== undefined) element.textContent = text;
  return element;
}

function forenkla(text) {
  return (text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function alder(fodd) {
  if (!fodd) return "";
  const dag = new Date(fodd);
  const nu = new Date();
  let ar = nu.getFullYear() - dag.getFullYear();
  if (nu.getMonth() < dag.getMonth() || (nu.getMonth() === dag.getMonth() && nu.getDate() < dag.getDate())) ar--;
  return ar;
}

// Wikipedia skriver positionen på engelska, t.ex. "Defensive midfielder".
// De längsta uttrycken står först, så att "Attacking midfielder" inte bara blir "...mittfältare".
const POSITIONER = [
  [/second striker/i, "Släpande anfallare"],
  [/centre[- ]forward|center[- ]forward/i, "Centerforward"],
  [/defensive midfielder/i, "Defensiv mittfältare"],
  [/central midfielder/i, "Central mittfältare"],
  [/attacking midfielder/i, "Offensiv mittfältare"],
  [/right[- ]winger/i, "Högerytter"],
  [/left[- ]winger/i, "Vänsterytter"],
  [/centre[- ]back|center[- ]back|central defender/i, "Mittback"],
  [/right[- ]back/i, "Högerback"],
  [/left[- ]back/i, "Vänsterback"],
  [/wing[- ]back/i, "Wingback"],
  [/full[- ]back/i, "Ytterback"],
  [/goalkeeper/i, "Målvakt"],
  [/midfielder/i, "Mittfältare"],
  [/defender/i, "Försvarare"],
  [/winger/i, "Ytter"],
  [/striker|forward/i, "Anfallare"]
];

function positionSvenska(text) {
  return (text || "").split(/,| and | or |\//).map(function (del) {
    const traff = POSITIONER.find(function (par) { return par[0].test(del); });
    return traff ? traff[1] : del.trim();
  }).filter(function (del, i, alla) { return del && alla.indexOf(del) === i; }).join(", ");
}

// Turneringarnas namn på svenska
const TURNERINGAR = [
  [/FIFA World Cup/i, "VM"],
  [/UEFA European Under-21 Championship/i, "U21-EM"],
  [/UEFA European Under-19 Championship/i, "U19-EM"],
  [/UEFA European Under-17 Championship/i, "U17-EM"],
  [/UEFA European Championship/i, "EM"],
  [/Olympic Games/i, "OS"],
  [/UEFA Nations League/i, "Nations League"],
  [/Copa América/i, "Copa América"],
  [/Africa Cup of Nations/i, "Afrikanska mästerskapen"]
];

function turneringSvenska(text) {
  const traff = TURNERINGAR.find(function (par) { return par[0].test(text); });
  return traff ? traff[1] : text;
}

// Fotbollsdata från Sök-sidans data: samma lag (namnet i adressen) och samma spelare
function hittaFdSpelare(sokdata, namn, lagnamn) {
  if (!sokdata || !sokdata.lag) return null;
  const lag = sokdata.lag.find(function (l) {
    return forenkla(l.namn) === forenkla(lagnamn) || forenkla(l.kort) === forenkla(lagnamn);
  });
  if (!lag) return null;
  const namnet = forenkla(namn);
  const spelare = lag.spelare.find(function (s) { return forenkla(s.namn) === namnet; }) ||
    lag.spelare.find(function (s) {
      const ord = forenkla(s.namn).split(" ");
      return ord[ord.length - 1] === namnet.split(" ").pop();
    });
  return spelare ? { spelare: spelare, lag: lag } : { spelare: null, lag: lag };
}

function byggAnsikte(namn, lagnamn, reserv) {
  const bild = document.createElement("img");
  bild.className = "sp-ansikte";
  bild.alt = "";
  bild.onerror = function () {
    // Saknas bilden från mellanhanden provar vi Wikipedias bild, annars initialerna
    if (reserv && bild.src !== reserv) {
      bild.src = reserv;
      return;
    }
    const initialer = namn.split(" ").map(function (ord) { return ord[0]; }).join("").slice(0, 2);
    bild.replaceWith(skapa("div", "sp-ansikte sok-initialer", initialer));
  };
  bild.src = API_BAS_URL + "/spelarbild?v=2&namn=" + encodeURIComponent(namn) + "&lag=" + encodeURIComponent(lagnamn);
  return bild;
}

// En tabell med År | Klubb | Matcher | Mål. Lån visas lite svagare.
function byggTabell(rader, kolumn) {
  const tabell = skapa("table", "liga-tabell sp-tabell");
  const huvud = document.createElement("tr");
  ["År", kolumn, "Matcher", "Mål"].forEach(function (text, i) {
    huvud.appendChild(skapa("th", i === 1 ? "lag" : "", text));
  });
  tabell.appendChild(huvud);
  rader.forEach(function (rad) {
    const tr = skapa("tr", /lån/.test(rad.klubb) ? "sp-lan" : "");
    tr.appendChild(skapa("td", "", rad.ar));
    tr.appendChild(skapa("td", "lag", rad.klubb));
    tr.appendChild(skapa("td", "", rad.matcher));
    tr.appendChild(skapa("td", "", rad.mal));
    tabell.appendChild(tr);
  });
  return tabell;
}

function visaSpelare(wiki, fd, namn, lagnamn) {
  const kort = document.getElementById("spelare");
  kort.replaceChildren();

  const tillbaka = skapa("a", "liga-tillbaka", "‹ Tillbaka");
  tillbaka.href = "sok.html";
  tillbaka.addEventListener("click", function (e) {
    // Kom man hit från en annan sida på JodaFoot går vi tillbaka dit
    if (document.referrer.indexOf(window.location.host) >= 0) {
      e.preventDefault();
      history.back();
    }
  });
  kort.appendChild(tillbaka);

  const fdSpelare = fd && fd.spelare;
  const fdLag = fd && fd.lag;
  const visatNamn = (wiki && wiki.namn) || (fdSpelare && fdSpelare.namn) || namn;
  document.title = "JodaFoot – " + visatNamn;

  // Överst: bild, namn och klubb
  const huvud = skapa("div", "sp-huvud");
  huvud.appendChild(byggAnsikte(namn, lagnamn, wiki && wiki.bild));
  huvud.appendChild(skapa("h1", "sp-namn", visatNamn));
  if (wiki && wiki.fulltNamn && wiki.fulltNamn !== visatNamn) {
    huvud.appendChild(skapa("div", "sp-fulltnamn", wiki.fulltNamn));
  }
  const klubb = skapa("div", "sok-lagrad sp-klubb");
  if (fdLag && fdLag.logga) {
    const logga = document.createElement("img");
    logga.className = "sok-litenlogga";
    logga.src = fdLag.logga;
    logga.alt = "";
    klubb.appendChild(logga);
  }
  const klubbnamn = (fdLag && fdLag.kort) || (wiki && wiki.klubb) || lagnamn;
  klubb.appendChild(skapa("span", "", klubbnamn + (wiki && wiki.nummer ? "  ·  #" + wiki.nummer : "")));
  if (fdLag) {
    // Klick på klubben visar lagets trupp på Sök-sidan
    klubb.classList.add("sp-klickbar");
    klubb.addEventListener("click", function () { window.location.href = "sok.html?lag=" + fdLag.id; });
  }
  huvud.appendChild(klubb);
  kort.appendChild(huvud);

  // Fakta i ett rutnät
  const fodd = (wiki && wiki.fodd) || (fdSpelare && fdSpelare.fodd) || "";
  const fakta = [
    ["Position", positionSvenska((wiki && wiki.position) || (fdSpelare && fdSpelare.position) || "")],
    ["Ålder", fodd ? alder(fodd) + " år" : ""],
    ["Född", fodd ? new Date(fodd).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }) : ""],
    ["Födelseort", wiki ? wiki.fodelseort : ""],
    ["Längd", wiki ? wiki.langd : ""],
    ["Land", fdSpelare ? fdSpelare.land : ""],
    ["Tröjnummer", wiki ? wiki.nummer : ""]
  ].filter(function (par) { return par[1]; });
  const rutnat = skapa("div", "sp-fakta");
  fakta.forEach(function (par) {
    const ruta = skapa("div", "sp-faktaruta");
    ruta.appendChild(skapa("div", "sp-etikett", par[0]));
    ruta.appendChild(skapa("div", "sp-varde", par[1]));
    rutnat.appendChild(ruta);
  });
  kort.appendChild(rutnat);

  if (!wiki) {
    kort.appendChild(skapa("p", "mr-meddelande", "Hittade ingen mer information om spelaren."));
    return;
  }

  if (wiki.karriar.length > 0) {
    kort.appendChild(skapa("h2", "mr-dag", "Klubbkarriär"));
    kort.appendChild(byggTabell(wiki.karriar, "Klubb"));
  }
  if (wiki.landslag.length > 0) {
    kort.appendChild(skapa("h2", "mr-dag", "Landslag"));
    kort.appendChild(byggTabell(wiki.landslag, "Lag"));
  }
  if (wiki.ungdom.length > 0) {
    kort.appendChild(skapa("h2", "mr-dag", "Ungdomsklubbar"));
    const lista = skapa("div", "sp-ungdom");
    wiki.ungdom.forEach(function (rad) {
      const del = skapa("div", "sp-ungdomsrad");
      del.appendChild(skapa("span", "sp-etikett", rad.ar));
      del.appendChild(skapa("span", "", rad.klubb));
      lista.appendChild(del);
    });
    kort.appendChild(lista);
  }
  if (wiki.meriter.length > 0) {
    kort.appendChild(skapa("h2", "mr-dag", "Meriter"));
    const lista = skapa("div", "sp-meriter");
    wiki.meriter.forEach(function (merit) {
      const rad = skapa("div", "sp-merit");
      rad.appendChild(skapa("span", "sp-medalj plats-" + merit.plats, ["Guld", "Silver", "Brons"][merit.plats - 1]));
      rad.appendChild(skapa("span", "", turneringSvenska(merit.turnering) + " " + merit.tillfalle));
      lista.appendChild(rad);
    });
    kort.appendChild(lista);
  }
  if (wiki.uppdaterad) {
    kort.appendChild(skapa("p", "sp-kalla", "Klubbstatistiken är uppdaterad " + wiki.uppdaterad + " (ligamatcher)."));
  }
}

async function startaSpelare() {
  const parametrar = new URLSearchParams(window.location.search);
  const namn = parametrar.get("namn") || "";
  const lagnamn = parametrar.get("lag") || "";
  const kort = document.getElementById("spelare");

  if (!namn) {
    kort.appendChild(skapa("p", "mr-meddelande", "Ingen spelare vald."));
    return;
  }
  kort.appendChild(skapa("p", "mr-meddelande", "Hämtar " + namn + "..."));

  const [wiki, sokdata] = await Promise.all([
    hamtaFranApi("/spelare?namn=" + encodeURIComponent(namn) + "&lag=" + encodeURIComponent(lagnamn)),
    hamtaFranApi("/sokdata")
  ]);
  visaSpelare(wiki, hittaFdSpelare(sokdata, namn, lagnamn), namn, lagnamn);
}

startaSpelare();
