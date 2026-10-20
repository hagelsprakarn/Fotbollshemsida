// Mellanhand mellan hemsidan och football-data.org.
// Körs på Cloudflare Workers. API-nyckeln sparas som hemlighet (API_NYCKEL)
// hos Cloudflare, så den syns aldrig på hemsidan eller på GitHub.

const API_BAS_URL = "https://api.football-data.org/v4";

// Vilka sidor som får använda mellanhanden
const TILLATNA_ADRESSER = [
  "https://hagelsprakarn.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

function corsHeaders(origin) {
  const tillaten = TILLATNA_ADRESSER.includes(origin) ? origin : TILLATNA_ADRESSER[0];
  return {
    "Access-Control-Allow-Origin": tillaten,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    // Webbläsaren frågar ibland först om anropet är tillåtet
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: headers });
    }

    if (request.method !== "GET") {
      return new Response("Bara GET är tillåtet", { status: 405, headers: headers });
    }

    // Allt efter domänen skickas vidare, t.ex. /competitions/PL/matches?dateFrom=...
    const url = new URL(request.url);
    const malAdress = API_BAS_URL + url.pathname + url.search;

    // Spara svar i en minut så vi inte når API:ets gräns (10 anrop/minut)
    const cache = caches.default;
    const cacheNyckel = new Request(malAdress);
    let svar = await cache.match(cacheNyckel);

    if (!env.API_NYCKEL) {
      return new Response("API_NYCKEL saknas i Cloudflare", { status: 500, headers: headers });
    }

    // Ta bort mellanslag och citattecken om de råkat följa med när nyckeln klistrades in
    const nyckel = env.API_NYCKEL.trim().replace(/^["']|["';]+$/g, "");

    if (!svar) {
      svar = await fetch(malAdress, {
        headers: { "X-Auth-Token": nyckel }
      });
      svar = new Response(svar.body, svar);
      svar.headers.set("Cache-Control", "public, max-age=60");
      if (svar.ok) {
        ctx.waitUntil(cache.put(cacheNyckel, svar.clone()));
      }
    }

    svar = new Response(svar.body, svar);
    for (const [namn, varde] of Object.entries(headers)) {
      svar.headers.set(namn, varde);
    }
    return svar;
  }
};
