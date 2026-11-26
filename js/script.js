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

// 3. Flikar: en rad knappar (samma stil som Tabell/Skytteliga på Ligor) där en flik i taget
// visas, så att långa sidor inte behöver skrollas.
// flikar = [{ namn: "Översikt", innehall: <element> }, ...]. Flikar utan innehåll hoppas över.
// installningar.vald = namnet på fliken som visas först.
// installningar.adress = true sparar vald flik i adressen (t.ex. &flik=karriar), så att den
// finns kvar när sidan uppdateras eller laddas om.
function byggFlikar(flikar, installningar) {
  installningar = installningar || {};
  flikar = flikar.filter(function (f) { return f.innehall; });

  function kod(namn) {
    return namn.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  const ruta = document.createElement("div");
  ruta.className = "flikruta";
  const rad = document.createElement("div");
  rad.className = "fo-flikar";
  ruta.appendChild(rad);

  function visa(vald) {
    flikar.forEach(function (f) {
      f.knapp.classList.toggle("vald", f === vald);
      f.innehall.hidden = f !== vald;
    });
    if (installningar.adress) {
      const parametrar = new URLSearchParams(window.location.search);
      parametrar.set("flik", kod(vald.namn));
      history.replaceState(null, "", window.location.pathname.split("/").pop() + "?" + parametrar.toString());
    }
  }

  flikar.forEach(function (f) {
    f.knapp = document.createElement("div");
    f.knapp.className = "fo-flik";
    f.knapp.textContent = f.namn;
    f.knapp.setAttribute("role", "button");
    f.knapp.tabIndex = 0;
    f.knapp.addEventListener("click", function () { visa(f); });
    f.knapp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") visa(f);
    });
    rad.appendChild(f.knapp);
    f.innehall.classList.add("flikinnehall");
    ruta.appendChild(f.innehall);
  });

  const sparad = installningar.adress ? new URLSearchParams(window.location.search).get("flik") : null;
  const forsta = flikar.find(function (f) { return kod(f.namn) === sparad; }) ||
    flikar.find(function (f) { return f.namn === installningar.vald; }) || flikar[0];
  if (forsta) visa(forsta);
  // Finns bara en flik behövs ingen flikrad
  if (flikar.length < 2) rad.hidden = true;
  return ruta;
}

// 4. Klubbmärken som leder till lagets trupp (truppen visas på Sök-sidan).
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