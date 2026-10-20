// Hämtar data från football-data.org via vår mellanhand på Cloudflare.
// Mellanhanden lägger till API-nyckeln, så den behöver inte finnas här.
// Byt ut adressen nedan mot adressen till er egen Worker.
const API_BAS_URL = "https://fotboll-api.DITT-NAMN.workers.dev";

// "slutpunkt" är delen efter /v4, t.ex. "/competitions/PL/matches".
async function hamtaFranApi(slutpunkt) {
  const cacheNyckel = "api:" + slutpunkt;

  // 1. Finns ett nyligen sparat svar? Använd det i stället för att fråga igen.
  try {
    const sparad = sessionStorage.getItem(cacheNyckel);
    if (sparad) {
      const objekt = JSON.parse(sparad);
      if (Date.now() - objekt.tid < 60000) {   // 60 000 ms = 1 minut
        return objekt.data;
      }
    }
  } catch (fel) {
    // om det inte går att läsa sparad data fortsätter vi bara
  }

  // 2. Fråga API:et
  try {
    const svar = await fetch(API_BAS_URL + slutpunkt);

    if (!svar.ok) {
      throw new Error("API svarade med felkod " + svar.status);
    }

    const data = await svar.json();

    // 3. Spara svaret en stund
    try {
      sessionStorage.setItem(cacheNyckel, JSON.stringify({ tid: Date.now(), data: data }));
    } catch (fel) {
      // spelar ingen roll om det inte går att spara
    }

    return data;
  } catch (fel) {
    console.error("Kunde inte hämta data:", fel);
    return null;   // så att sidan inte kraschar
  }
}