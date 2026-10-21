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
// De senaste nyheterna om övergångar. Rutan hämtar nya varannan minut,
// så att nya övergångar dyker upp utan att man laddar om sidan.
// ============================================

function byggOvergang(nyhet) {
  const rad = skapa("a", "ov-nyhet");
  rad.href = nyhet.lank;
  rad.target = "_blank";
  rad.rel = "noopener";
  rad.appendChild(skapa("div", "ov-kalla", nyhet.kalla + " · " + hurLangeSedan(nyhet.tid)));
  rad.appendChild(skapa("div", "ov-rubrik", nyhet.rubrik));
  return rad;
}

async function visaOvergangar() {
  const sidokort = document.getElementById("sidokort");
  if (!sidokort) return;

  const overgangar = await hamtaFranApi("/overgangar");

  // Misslyckas en uppdatering behåller vi det som redan visas
  if (!overgangar && sidokort.children.length > 0) return;

  sidokort.replaceChildren(skapa("h2", "fo-sidorubrik", "Övergångar"));

  if (!overgangar) {
    sidokort.appendChild(skapa("p", "re-meddelande", "Kunde inte hämta övergångar."));
    return;
  }
  if (overgangar.length === 0) {
    sidokort.appendChild(skapa("p", "re-meddelande", "Inga övergångsnyheter just nu."));
    return;
  }

  overgangar.forEach(function (nyhet) {
    sidokort.appendChild(byggOvergang(nyhet));
  });
}

visaOvergangar();
setInterval(visaOvergangar, 120000);
