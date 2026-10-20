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