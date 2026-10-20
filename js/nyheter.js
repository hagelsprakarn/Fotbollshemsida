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
  nyheter.forEach(function (nyhet) {
    lista.appendChild(byggNyhet(nyhet));
  });
}

visaNyheter();
