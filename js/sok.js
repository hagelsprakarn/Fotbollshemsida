// Sök-sidan (sok.html): sök bland alla lag och spelare i topp 5-ligorna och
// Champions League. Klickar man på ett lag visas truppen, och klickar man på
// en spelare öppnas spelarsidan (spelare.html).
// Valt lag och spelare står i adressen, t.ex. sok.html?lag=5&spelare=8004

// Hjälpfunktion: skapar ett element med en klass och en text
function skapa(tagg, klass, text) {
  const element = document.createElement(tagg);
  if (klass) element.className = klass;
  if (text !== undefined) element.textContent = text;
  return element;
}

// Alla lag (med trupp) från mellanhanden. Hämtas en gång när sidan laddas.
let allaLag = [];

// Sant om man kom till ett lags trupp från en annan sida (t.ex. genom att klicka på ett klubbmärke)
let tillbakaTillForraSidan = false;

// Hittar ett lag med namnet, t.ex. "Liverpool" -> "Liverpool FC". Det kortare namnet
// måste vara början på det längre, så att "Manchester United" inte blir Manchester City.
function hittaLagMedNamn(namn) {
  if (!namn) return null;
  function ord(text) {
    return forenkla(text).replace(/[^a-z0-9 ]/g, " ").replace(/\b(fc|afc|cf)\b/g, " ").trim().split(/\s+/);
  }
  const sokOrd = ord(namn);
  return allaLag.find(function (l) {
    return [l.namn, l.kort].some(function (lagnamn) {
      const lagOrd = ord(lagnamn);
      const kort = sokOrd.length <= lagOrd.length ? sokOrd : lagOrd;
      const lang = kort === sokOrd ? lagOrd : sokOrd;
      return kort[0] !== "" && kort.every(function (o, i) { return o === lang[i]; });
    });
  }) || null;
}

// Gör söktexten jämförbar: små bokstäver och inga accenter ("Müller" hittas med "muller")
function forenkla(text) {
  return (text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// football-data skriver positionerna på engelska, t.ex. "Goalkeeper" eller "Centre-Back"
const POSITIONER = ["Målvakter", "Försvarare", "Mittfältare", "Anfallare"];

function positionsgrupp(position) {
  if (/goalkeeper/i.test(position)) return 0;
  if (/back|defen/i.test(position)) return 1;
  if (/midfield/i.test(position)) return 2;
  return 3;
}

function positionSvenska(position) {
  return ["Målvakt", "Försvarare", "Mittfältare", "Anfallare"][positionsgrupp(position)];
}

function alder(fodd) {
  if (!fodd) return "";
  const dag = new Date(fodd);
  const nu = new Date();
  let ar = nu.getFullYear() - dag.getFullYear();
  if (nu.getMonth() < dag.getMonth() || (nu.getMonth() === dag.getMonth() && nu.getDate() < dag.getDate())) ar--;
  return ar;
}

function skapaLogga(adress, klass) {
  const logga = document.createElement("img");
  logga.className = klass || "";
  logga.src = adress;
  logga.alt = "";
  return logga;
}

// Spelarens ansikte. Hittas ingen bild visas initialerna i stället.
function byggAnsikte(spelare, lag, klass) {
  const bild = document.createElement("img");
  bild.className = klass;
  bild.alt = "";
  bild.onerror = function () {
    const initialer = spelare.namn.split(" ").map(function (ord) { return ord[0]; }).join("").slice(0, 2);
    bild.replaceWith(skapa("div", klass + " sok-initialer", initialer));
  };
  // "v=2" ger nya adresser, så att webbläsaren inte använder gamla sparade (ibland felaktiga) bilder
  bild.src = API_BAS_URL + "/spelarbild?v=2&namn=" + encodeURIComponent(spelare.namn) +
    "&lag=" + encodeURIComponent(lag.namn);   // hela namnet, "Barça" känns inte igen som Barcelona
  return bild;
}

// Sparar valt lag och spelare i adressen, så att det finns kvar om man laddar om
function uppdateraAdress(lag, spelare) {
  const delar = [];
  if (lag) delar.push("lag=" + lag.id);
  if (spelare) delar.push("spelare=" + spelare.id);
  history.replaceState(null, "", "sok.html" + (delar.length ? "?" + delar.join("&") : ""));
}

// ============================================
// SÖKRESULTAT
// ============================================

function byggLagResultat(lag) {
  const rad = skapa("div", "sok-rad");
  rad.appendChild(skapaLogga(lag.logga, "sok-logga"));
  const text = skapa("div", "sok-text");
  text.appendChild(skapa("div", "sok-namn", lag.kort));
  text.appendChild(skapa("div", "sok-info", lag.ligor.join(" · ")));
  rad.appendChild(text);
  rad.addEventListener("click", function () { visaTrupp(lag); });
  return rad;
}

function byggSpelarResultat(spelare, lag) {
  const rad = skapa("div", "sok-rad");
  rad.appendChild(byggAnsikte(spelare, lag, "sok-ansikte"));
  const text = skapa("div", "sok-text");
  text.appendChild(skapa("div", "sok-namn", spelare.namn));
  const info = skapa("div", "sok-info sok-lagrad");
  info.appendChild(skapaLogga(lag.logga, "sok-litenlogga"));
  info.appendChild(skapa("span", "", lag.kort + " · " + positionSvenska(spelare.position)));
  text.appendChild(info);
  rad.appendChild(text);
  rad.addEventListener("click", function () { oppnaSpelare(spelare, lag); });
  return rad;
}

// Öppnar spelarsidan. Först sparas laget och spelaren i adressen, så att man kommer
// tillbaka till lagets trupp med spelaren markerad när man trycker på Tillbaka.
function oppnaSpelare(spelare, lag) {
  uppdateraAdress(lag, spelare);
  window.location.href = "spelare.html?namn=" + encodeURIComponent(spelare.namn) +
    "&lag=" + encodeURIComponent(lag.namn);
}

function visaResultat(sokord) {
  const innehall = document.getElementById("sok-innehall");
  innehall.replaceChildren();
  const ord = forenkla(sokord).trim();
  if (ord.length < 2) {
    innehall.appendChild(skapa("p", "mr-meddelande", "Skriv minst två bokstäver för att söka bland lag och spelare."));
    return;
  }

  const lag = allaLag.filter(function (l) {
    return forenkla(l.namn).includes(ord) || forenkla(l.kort).includes(ord) || forenkla(l.tla) === ord;
  }).slice(0, 8);

  // Alla ord i sökningen ska finnas i namnet, så "kane harry" hittar också Harry Kane
  const sokdelar = ord.split(/\s+/);
  const spelare = [];
  allaLag.forEach(function (l) {
    l.spelare.forEach(function (s) {
      const namn = forenkla(s.namn);
      if (sokdelar.every(function (d) { return namn.includes(d); })) spelare.push({ spelare: s, lag: l });
    });
  });

  if (lag.length === 0 && spelare.length === 0) {
    innehall.appendChild(skapa("p", "mr-meddelande", "Inga lag eller spelare hittades."));
    return;
  }

  if (lag.length > 0) {
    innehall.appendChild(skapa("h2", "mr-dag", "Lag"));
    lag.forEach(function (l) { innehall.appendChild(byggLagResultat(l)); });
  }
  if (spelare.length > 0) {
    innehall.appendChild(skapa("h2", "mr-dag", "Spelare"));
    spelare.slice(0, 20).forEach(function (t) { innehall.appendChild(byggSpelarResultat(t.spelare, t.lag)); });
  }
}

// ============================================
// ETT LAGS TRUPP
// ============================================

function visaTrupp(lag, valdSpelare) {
  const innehall = document.getElementById("sok-innehall");
  innehall.replaceChildren();
  uppdateraAdress(lag, valdSpelare);

  // Kom man hit genom att klicka på ett klubbmärke på en annan sida går "Tillbaka" dit,
  // annars tillbaka till sökresultaten
  const tillbaka = skapa("a", "liga-tillbaka", tillbakaTillForraSidan ? "‹ Tillbaka" : "‹ Tillbaka till sökningen");
  tillbaka.href = "#";
  tillbaka.addEventListener("click", function (e) {
    e.preventDefault();
    if (tillbakaTillForraSidan) {
      history.back();
      return;
    }
    uppdateraAdress(null, null);
    visaResultat(document.getElementById("sok-falt").value);
  });
  innehall.appendChild(tillbaka);

  const huvud = skapa("div", "sok-laghuvud");
  huvud.appendChild(skapaLogga(lag.logga, "sok-storlogga"));
  huvud.appendChild(skapa("h2", "sok-lagnamn", lag.namn));
  huvud.appendChild(skapa("div", "sok-info", lag.ligor.join(" · ")));
  if (lag.tranare) huvud.appendChild(skapa("div", "sok-tranare", "Tränare: " + lag.tranare));
  innehall.appendChild(huvud);

  if (lag.spelare.length === 0) {
    innehall.appendChild(skapa("p", "mr-meddelande", "Truppen finns inte för det här laget."));
  }

  // Spelarna sorterade i målvakter, försvarare, mittfältare och anfallare
  POSITIONER.forEach(function (rubrik, grupp) {
    const ispelare = lag.spelare.filter(function (s) { return positionsgrupp(s.position) === grupp; });
    if (ispelare.length === 0) return;
    innehall.appendChild(skapa("h3", "mr-dag", rubrik));
    ispelare.forEach(function (s) {
      const rad = skapa("div", "sok-rad" + (valdSpelare && s.id === valdSpelare.id ? " vald" : ""));
      rad.appendChild(byggAnsikte(s, lag, "sok-ansikte"));
      const text = skapa("div", "sok-text");
      text.appendChild(skapa("div", "sok-namn", s.namn));
      const info = [];
      if (s.fodd) info.push(alder(s.fodd) + " år");
      if (s.land) info.push(s.land);
      text.appendChild(skapa("div", "sok-info", info.join(" · ")));
      rad.appendChild(text);
      rad.addEventListener("click", function () { oppnaSpelare(s, lag); });
      innehall.appendChild(rad);
    });
  });

  // Kommer man tillbaka från en spelarsida är den spelaren markerad
  const vald = innehall.querySelector(".sok-rad.vald");
  if (vald) vald.scrollIntoView({ block: "center" });
}

// ============================================
// START
// ============================================

async function startaSok() {
  const falt = document.getElementById("sok-falt");
  const innehall = document.getElementById("sok-innehall");
  innehall.appendChild(skapa("p", "mr-meddelande", "Hämtar lag och spelare..."));

  const data = await hamtaFranApi("/sokdata");
  if (!data || !data.lag || data.lag.length === 0) {
    innehall.replaceChildren(skapa("p", "mr-meddelande", "Kunde inte hämta lagen. Vänta en minut och ladda om sidan."));
    return;
  }
  allaLag = data.lag;

  falt.addEventListener("input", function () {
    tillbakaTillForraSidan = false;   // nu söker man själv, då ska Tillbaka gå till sökningen
    uppdateraAdress(null, null);
    visaResultat(falt.value);
  });

  // Står ett lag (och kanske en spelare) i adressen visar vi det direkt.
  // Laget kan anges med id (?lag=81) eller med namn (?lagnamn=Liverpool).
  const parametrar = new URLSearchParams(window.location.search);
  const lag = allaLag.find(function (l) { return String(l.id) === parametrar.get("lag"); }) ||
    hittaLagMedNamn(parametrar.get("lagnamn"));
  const franAnnanSida = document.referrer.indexOf(window.location.host) >= 0 &&
    document.referrer.indexOf("sok.html") < 0;
  if (lag) {
    tillbakaTillForraSidan = franAnnanSida;
    const spelare = lag.spelare.find(function (s) { return String(s.id) === parametrar.get("spelare"); });
    visaTrupp(lag, spelare);
  } else {
    // Hittades inte laget med namnet söker vi på namnet i stället
    falt.value = parametrar.get("lagnamn") || "";
    visaResultat(falt.value);
    falt.focus();
  }
}

startaSok();
