// Den här filen körs på alla sidor.

// 1. Markera vilken sida vi är på i menyn
// Vi tar reda på filnamnet i adressen (t.ex. "matcher.html")
// och ger den matchande länken klassen "aktiv".
const nuvarandeSida = window.location.pathname.split("/").pop() || "index.html";
const menylankar = document.querySelectorAll(".nav a");

menylankar.forEach(function (lank) {
  if (lank.getAttribute("href") === nuvarandeSida) {
    lank.classList.add("aktiv");
  }
});

// 2. Sätt rätt årtal i footern automatiskt
const arElement = document.getElementById("ar");
if (arElement) {
  arElement.textContent = new Date().getFullYear();
}

// 3. Klubbmärken som leder till lagets trupp (truppen visas på Sök-sidan).
// "lag" har antingen ett id från football-data ({ id: 81 }) eller bara ett namn
// ({ namn: "Liverpool" }), då letar Sök-sidan upp laget med namnet.
// Märket kan ligga inuti en länk (t.ex. en matchrad), därför stoppar vi den länken.
function gorTillTruppLank(element, lag) {
  if (!element || !lag || (!lag.id && !lag.namn)) return;
  element.classList.add("trupp-lank");
  element.title = "Visa truppen";
  element.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = lag.id ? "sok.html?lag=" + lag.id : "sok.html?lagnamn=" + encodeURIComponent(lag.namn);
  });
}