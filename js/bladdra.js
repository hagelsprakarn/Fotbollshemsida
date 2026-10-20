// Bläddra mellan sidor med pilar och en glid-/toningseffekt.
// Används av Matcher- och Nyheter-sidan. "lista" är kortet sidorna visas i,
// "sidor" är en lista med div-element (en per sida).

function visaSidor(lista, sidor) {
  // Egen liten hjälpfunktion, så att filen fungerar oberoende av sidans skript
  function skapa(tagg, klass, text) {
    const element = document.createElement(tagg);
    element.className = klass;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  const ruta = skapa("div", "mr-sidruta");
  lista.appendChild(ruta);

  const vanster = skapa("button", "mr-pil vanster", "‹");
  const hoger = skapa("button", "mr-pil hoger", "›");
  vanster.setAttribute("aria-label", "Förra sidan");
  hoger.setAttribute("aria-label", "Nästa sida");
  const raknare = skapa("div", "mr-raknare");
  lista.appendChild(vanster);
  lista.appendChild(hoger);
  lista.appendChild(raknare);

  let nuvarande = 0;
  ruta.appendChild(sidor[0]);

  function uppdatera() {
    vanster.hidden = nuvarande === 0;
    hoger.hidden = nuvarande === sidor.length - 1;
    raknare.textContent = sidor.length > 1 ? (nuvarande + 1) + " / " + sidor.length : "";
  }

  // riktning 1 = nästa (glider in från höger), -1 = förra (glider in från vänster)
  function byt(riktning) {
    const ny = nuvarande + riktning;
    if (ny < 0 || ny >= sidor.length) return;

    const gammal = sidor[nuvarande];
    const nySida = sidor[ny];
    nuvarande = ny;

    // Klickar man snabbt: ta bort sidor som fortfarande håller på att glida ut
    Array.from(ruta.children).forEach(function (sida) {
      if (sida !== gammal) sida.remove();
    });

    gammal.className = "mr-sida ut" + (riktning > 0 ? "-vanster" : "-hoger");
    nySida.className = "mr-sida in" + (riktning > 0 ? "-hoger" : "-vanster");
    ruta.appendChild(nySida);

    // Ta bort den gamla sidan när animationen är klar
    setTimeout(function () {
      if (gammal !== sidor[nuvarande]) gammal.remove();
      if (nySida === sidor[nuvarande]) nySida.className = "mr-sida";
    }, 350);

    uppdatera();
  }

  vanster.addEventListener("click", function () { byt(-1); });
  hoger.addEventListener("click", function () { byt(1); });

  // Piltangenterna på tangentbordet fungerar också
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") byt(1);
    if (e.key === "ArrowLeft") byt(-1);
  });

  uppdatera();
}
