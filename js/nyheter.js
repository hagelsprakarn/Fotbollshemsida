// Visar de senaste fotbollsnyheterna på nyheter.html.
// Nyheterna hämtas från BBC, Sky Sports m.fl. via vår mellanhand på Cloudflare.

// Hjälpfunktion: skapar ett element med en klass och en text
function skapa(tagg, klass, text) {
  const element = document.createElement(tagg);
  if (klass) element.className = klass;
  if (text !== undefined) element.textContent = text;
  return element;
}

// Gör om en tidpunkt till t.ex. "12 min sedan" eller "3 tim sedan"
function hurLangeSedan(tid) {
  if (!tid) return "";
  const minuter = Math.round((Date.now() - tid) / 60000);
  if (minuter < 1) return "Just nu";
  if (minuter < 60) return minuter + " min sedan";
  const timmar = Math.round(minuter / 60);
  if (timmar < 24) return timmar + " tim sedan";
  return new Date(tid).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

// Bygger ett kort för en nyhet. Hela kortet är en länk till artikeln.
function byggNyhet(nyhet) {
  const kort = skapa("a", "ny-kort");
  kort.href = nyhet.lank;
  kort.target = "_blank";
  kort.rel = "noopener";

  if (nyhet.bild) {
    const bild = document.createElement("img");
    bild.src = nyhet.bild;
    bild.alt = "";
    bild.loading = "lazy";
    bild.onerror = function () { bild.remove(); };   // dölj trasiga bilder
    kort.appendChild(bild);
  }

  const innehall = skapa("div", "ny-innehall");
  innehall.appendChild(skapa("div", "ny-kalla", nyhet.kalla + " · " + hurLangeSedan(nyhet.tid)));
  innehall.appendChild(skapa("h2", "ny-rubrik", nyhet.rubrik));
  if (nyhet.text) {
    innehall.appendChild(skapa("p", "ny-text", nyhet.text));
  }
  kort.appendChild(innehall);

  return kort;
}

async function visaNyheter() {
  const lista = document.getElementById("nyhets-lista");
  if (!lista) return;

  const meddelande = skapa("p", "mr-meddelande", "Hämtar nyheter...");
  lista.appendChild(meddelande);

  const nyheter = await hamtaFranApi("/nyheter");

  if (!nyheter) {
    meddelande.textContent = "Kunde inte hämta nyheter. Vänta en minut och ladda om sidan.";
    return;
  }

  if (nyheter.length === 0) {
    meddelande.textContent = "Inga nyheter just nu.";
    return;
  }

  meddelande.remove();

  // Vänta tills typsnittet har laddats, annars blir mätningen nedan fel
  await document.fonts.ready;

  visaSidor(lista, delaUppISidor(lista, nyheter.map(byggNyhet)));
}

// Delar upp nyhetskorten i sidor så att varje sida får så många nyheter som
// faktiskt får plats (långa rubriker tar mer plats). Vi lägger korten i en
// osynlig provsida, ett i taget, och börjar på en ny sida när det blir fullt.
function delaUppISidor(lista, kort) {
  const provruta = skapa("div", "mr-sidruta");
  const provraknare = skapa("div", "mr-raknare", "1 / 1");   // tar samma plats som den riktiga räknaren
  provruta.style.visibility = "hidden";
  lista.appendChild(provruta);
  lista.appendChild(provraknare);

  const sidor = [];
  let sida = skapa("div", "mr-sida");
  provruta.appendChild(sida);

  kort.forEach(function (ettKort) {
    sida.appendChild(ettKort);
    const forHog = ettKort.getBoundingClientRect().bottom > sida.getBoundingClientRect().bottom;

    // Får kortet inte plats flyttas det till en ny sida (men varje sida har minst en nyhet)
    if (forHog && sida.children.length > 1) {
      sida.remove();
      sidor.push(sida);
      sida = skapa("div", "mr-sida");
      provruta.appendChild(sida);
      sida.appendChild(ettKort);
    }
  });

  sida.remove();
  sidor.push(sida);
  provruta.remove();
  provraknare.remove();
  return sidor;
}

visaNyheter();

// ============================================
// ÖVERGÅNGAR (högra rutan)
// De senaste övergångarna i topp 5-ligorna: spelarens ansikte och namn,
// och en pil till den nya klubben. Datan kommer från Wikipedias
// övergångslistor via mellanhanden. Rutan hämtar nya var femte minut.
// ============================================

const OVERGANGSLIGOR = ["PL", "PD", "BL1", "SA", "FL1"];

// Wikipedia skriver avgiften på engelska
const AVGIFTER = { Undisclosed: "Okänd summa", Free: "Gratis", Loan: "Lån" };

function svenska(text) {
  return AVGIFTER[text] || text;
}

// Spelarens ansikte. Hittas ingen bild visas initialerna i stället.
function byggOvergangsAnsikte(overgang) {
  const bild = document.createElement("img");
  bild.className = "ov-ansikte";
  bild.alt = "";
  bild.onerror = function () {
    const initialer = overgang.spelare.split(" ").map(function (ord) { return ord[0]; }).join("").slice(0, 2);
    bild.replaceWith(skapa("div", "ov-ansikte ov-initialer", initialer));
  };
  // "v=2" ger nya adresser, så att webbläsaren inte använder gamla sparade (ibland felaktiga) bilder
  bild.src = API_BAS_URL + "/spelarbild?v=2&namn=" + encodeURIComponent(overgang.spelare) +
    "&lag=" + encodeURIComponent(overgang.till);
  return bild;
}

function byggOvergang(overgang) {
  const rad = skapa("div", "ov-rad");
  rad.appendChild(byggOvergangsAnsikte(overgang));

  const text = skapa("div", "ov-text");
  text.appendChild(skapa("div", "ov-spelare", overgang.spelare));

  // "→ [märke] Ny klubb"
  const till = skapa("div", "ov-till");
  till.appendChild(skapa("span", "ov-pil", "→"));
  if (overgang.tillLogga) {
    const logga = document.createElement("img");
    logga.src = overgang.tillLogga;
    logga.alt = "";
    till.appendChild(logga);
  }
  till.appendChild(skapa("span", "", overgang.till));
  text.appendChild(till);

  // "från Lazio · Lån · 28 sep."
  const detaljer = [overgang.fran === "Unattached" ? "var klubblös" : "från " + overgang.fran];
  if (overgang.avgift) detaljer.push(svenska(overgang.avgift));
  if (overgang.datum) {
    detaljer.push(new Date(overgang.datum).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }));
  }
  text.appendChild(skapa("div", "ov-detaljer", detaljer.join(" · ")));

  rad.appendChild(text);
  return rad;
}

async function visaOvergangar() {
  const sidokort = document.getElementById("sidokort");
  if (!sidokort) return;

  // En fråga per liga, samtidigt
  const listor = await Promise.all(OVERGANGSLIGOR.map(function (liga) {
    return hamtaFranApi("/overgangar?liga=" + liga);
  }));
  const overgangar = listor.filter(Boolean).flat()
    .sort(function (a, b) { return b.datum - a.datum; })   // senaste först
    .slice(0, 30);

  // Misslyckas en uppdatering behåller vi det som redan visas
  if (overgangar.length === 0 && sidokort.children.length > 0) return;

  sidokort.replaceChildren(skapa("h2", "fo-sidorubrik", "Övergångar"));

  if (overgangar.length === 0) {
    sidokort.appendChild(skapa("p", "re-meddelande", "Kunde inte hämta övergångar."));
    return;
  }

  overgangar.forEach(function (overgang) {
    sidokort.appendChild(byggOvergang(overgang));
  });
}

visaOvergangar();
setInterval(visaOvergangar, 300000);
