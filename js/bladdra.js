// Bläddra mellan sidor med pilar och en glid-/toningseffekt.
// Används av Matcher, Nyheter och Ligor. "lista" är kortet sidorna visas i,
// "sidor" är en lista med div-element (en per sida).
// installningar (alla är frivilliga):
//   pilarNere: true   pilarna står bredvid sidnumret längst ner (för smala rutor)
//   tangenter: false  piltangenterna bläddrar inte (bara en lista per sida bör använda dem)
//   start: 2          vilken sida som visas först (räknat från 0)
//   vidByte: function (nr) { ... }  anropas när man har bläddrat, med den nya sidans nummer

function visaSidor(lista, sidor, installningar) {
  installningar = installningar || {};
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
  if (installningar.pilarNere) {
    // ‹ 1 / 3 › på en rad under sidorna
    const sidfot = skapa("div", "mr-sidfot");
    vanster.classList.add("nere");
    hoger.classList.add("nere");
    sidfot.appendChild(vanster);
    sidfot.appendChild(raknare);
    sidfot.appendChild(hoger);
    lista.appendChild(sidfot);
  } else {
    lista.appendChild(vanster);
    lista.appendChild(hoger);
    lista.appendChild(raknare);
  }

  let nuvarande = Math.min(Math.max(installningar.start || 0, 0), sidor.length - 1);
  ruta.appendChild(sidor[nuvarande]);

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
    if (installningar.vidByte) installningar.vidByte(nuvarande);
  }

  vanster.addEventListener("click", function () { byt(-1); });
  hoger.addEventListener("click", function () { byt(1); });

  // Piltangenterna på tangentbordet fungerar också (om inte listan har stängt av dem).
  // Är listan inte längre på sidan (t.ex. när man har bytt flik) gör tangenterna ingenting.
  if (installningar.tangenter !== false) {
    document.addEventListener("keydown", function (e) {
      if (!document.body.contains(lista) || lista.closest("[hidden]")) return;
      if (e.key === "ArrowRight") byt(1);
      if (e.key === "ArrowLeft") byt(-1);
    });
  }

  uppdatera();
}
