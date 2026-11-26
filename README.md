# JodaFoot

JodaFoot är en fotbollshemsida för Europas största ligor: Premier League, La Liga, Bundesliga, Serie A, Ligue 1 och Champions League. Den är byggd som ett gymnasiearbete.

**Hemsidan:** https://hagelsprakarn.github.io/Fotbollshemsida/

## Vad man kan göra

| Flik | Innehåll |
|---|---|
| **Följer** | Följ dina favoritlag. Visar form (senaste fem matcherna), tabellplacering, senaste resultat och kommande matcher. Lagen du följer sparas i webbläsaren (localStorage). |
| **Ligor** | Tabell och skytteliga för varje liga, och senaste omgången i högra rutan. |
| **Matcher** | Dagens matcher och resultaten från igår och idag. Uppdateras varje minut. |
| **Nyheter** | De senaste fotbollsnyheterna och de senaste övergångarna i topp 5-ligorna. |
| **Sök** | Sök bland alla lag och cirka 3 000 spelare. Visar lagets trupp med tränare. |

Dessutom finns:

- **Matchsidan** (klicka på en match): resultat, målskyttar med minut, laguppställningar på en fotbollsplan (eller förväntade startelvor före matchen), avbytare och skadelista (Premier League).
- **Spelarsidan** (klicka på en spelare): position, ålder, längd, klubbkarriär, landslag, ungdomsklubbar och meriter.
- **Klubbmärken** leder till lagets trupp på alla sidor.
- Sidan fungerar på dator, surfplatta och mobil.

## Så är sidan byggd

Sidan är vanlig **HTML, CSS och JavaScript** utan ramverk. Den består av två delar:

1. **Hemsidan** (alla `.html`-filer, `css/` och `js/`) ligger på **GitHub Pages**. Den publiceras automatiskt varje gång vi pushar till `main`.
2. **Mellanhanden** (`worker/worker.js`) är en **Cloudflare Worker**. Hemsidan hämtar all fotbollsdata via den i stället för direkt från källorna. Mellanhanden:
   - lägger till API-nyckeln, så att den aldrig syns på hemsidan,
   - sparar svar en stund (cachning), så att vi inte går över källornas gränser för antal anrop,
   - hämtar och sammanställer data från flera källor (se nedan).

   Cloudflare bygger om mellanhanden automatiskt när vi pushar till GitHub (inställningarna finns i `wrangler.toml`).

### Filer

```
index.html          Startsidan (skickar vidare till Följer)
foljer.html         Följer
ligor.html          Ligor: tabell, skytteliga, senaste omgången
matcher.html        Matcher
match.html          En match
nyheter.html        Nyheter och övergångar
sok.html            Sök och lagens trupper
spelare.html        En spelare
css/style.css       All design (mobilanpassningen ligger sist i filen)
js/api.js           Hämtar data från mellanhanden och sparar svaret en minut
js/script.js        Körs på alla sidor (t.ex. klubbmärken som leder till truppen)
js/bladdra.js       Bläddra mellan sidor med pilar (Matcher och Nyheter)
js/<sida>.js        Koden för respektive sida
worker/worker.js    Mellanhanden på Cloudflare
wrangler.toml       Inställningar för mellanhanden
sitemap.xml         Lista över sidorna för Google
manifest.json       Appens namn, ikon och färger (PWA)
sw.js               Service worker: gör sidan installerbar och sparar den för användning utan nät
ikoner/             App-ikoner och favicon
```

### Som app på mobilen (PWA)

JodaFoot kan installeras som en app. Öppna hemsidan i mobilens webbläsare och välj **Lägg till på hemskärmen** (Safari: dela-knappen → *Lägg till på hemskärmen*; Chrome: menyn ⋮ → *Installera app*). Appen får en egen ikon och öppnas i helskärm.

`sw.js` hämtar alltid hemsidans filer från nätet först, så appen visar direkt den senaste versionen efter en uppdatering. Utan nät visas de senast sparade sidorna. Fotbollsdatan hämtas alltid från mellanhanden. Ändras listan över filer i `sw.js` kan man byta namnet på `CACHE` (t.ex. `jodafoot-v2`) så att gamla sparade filer rensas.

### Datakällor

| Källa | Används till |
|---|---|
| [football-data.org](https://www.football-data.org/) | Matcher, resultat, tabeller, skytteligor, lag och trupper |
| [ESPN](https://www.espn.com/soccer/) (öppet API) | Laguppställningar, målskyttar och klubbmärken |
| [Wikipedia](https://en.wikipedia.org/) | Spelarnas karriär, landslag och meriter, övergångar och reservbilder |
| [TheSportsDB](https://www.thesportsdb.com/) | Spelarbilder |
| [Premier League Fantasy](https://fantasy.premierleague.com/) | Skadelistan (bara Premier League) |
| BBC, Sky Sports, The Guardian, Aftonbladet, Expressen | Nyheter (RSS-flöden) |

Texter och bilder från Wikipedia och Wikimedia är licensierade under [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/).

## Köra sidan på egen dator

1. Ladda ner projektet: `git clone https://github.com/hagelsprakarn/Fotbollshemsida.git`
2. Öppna mappen i VS Code och starta tillägget **Live Server** ("Go Live").
3. Sidan öppnas på `http://localhost:5500` eller `http://127.0.0.1:5500`.

Sidan måste köras på **port 5500**. Mellanhanden tar bara emot anrop från de adresserna och från hemsidan på GitHub Pages (listan `TILLATNA_ADRESSER` i `worker/worker.js`). Öppnar man HTML-filerna direkt (`file://`) laddas ingen data.

Hemsidan på datorn använder samma mellanhand som den riktiga sidan, så man behöver ingen egen API-nyckel för att köra den.

## API-nyckeln

football-data.org kräver en API-nyckel. Den finns **bara i Cloudflare**, aldrig i koden eller på GitHub:

- Den är sparad som en hemlighet (secret) med namnet **`API_NYCKEL`** på Cloudflares webbsida: Workers & Pages → `fotboll-api` → Settings → Variables and Secrets.
- Mellanhanden läser den som `env.API_NYCKEL` och skickar med den till football-data.org.
- `keep_vars = true` i `wrangler.toml` gör att hemligheten finns kvar när mellanhanden byggs om.

**Lägg aldrig in API-nyckeln i någon fil i projektet.** Allt som pushas till GitHub är offentligt.

Övriga källor (ESPN, Wikipedia, TheSportsDB, Fantasy-API:et och RSS-flödena) behöver ingen nyckel.

## Publicera ändringar

Pusha till `main`. Därefter:

- **GitHub Pages** publicerar hemsidan inom ett par minuter.
- **Cloudflare** bygger om mellanhanden automatiskt.

Om publiceringen fastnar: välj **None** och sedan **main** igen under Settings → Pages på GitHub. Om Cloudflare inte bygger om mellanhanden hjälper det oftast att pusha en gång till (till exempel en tom commit).

## Om projektet

Gymnasiearbete. Koden är skriven med hjälp av AI-assistenten Claude (Anthropic): vi har beskrivit vad sidan ska göra, testat resultatet och bestämt vad som ska ändras.
