// Cloudflare Pages Function: conserva el contrato de /api/google-metrics de Vercel.
// Configurar GOOGLE_SERVICE_ACCOUNT_JSON, GA4_PROPERTY_ID y GSC_SITE_URL como secrets/variables.
// No colocar credenciales en el HTML ni en el repositorio.

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": status >= 400 ? "no-store" : "public, max-age=0, s-maxage=900, stale-while-revalidate=300"
  }
});

const base64url = (value) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const decodeBase64 = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

function dateRange(url) {
  const isDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const parsed = new Date(value + "T00:00:00Z");
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  const endParam = url.searchParams.get("hasta");
  const startParam = url.searchParams.get("desde");
  if (endParam && !isDate(endParam)) throw new Error("La fecha 'hasta' debe ser una fecha válida con formato AAAA-MM-DD.");
  if (startParam && !isDate(startParam)) throw new Error("La fecha 'desde' debe ser una fecha válida con formato AAAA-MM-DD.");
  const end = endParam || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const startDefault = new Date(Date.parse(end + "T00:00:00Z") - 27 * 86400000).toISOString().slice(0, 10);
  const start = startParam || startDefault;
  const span = (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000;
  if (!Number.isFinite(span) || start > end || span > 89) {
    throw new Error("Rango inválido: use desde/hasta y un máximo de 90 días.");
  }
  return { start, end };
}

async function googleAccessToken(service) {
  const now = Math.floor(Date.now() / 1000);
  const head = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: service.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = head + "." + claim;
  const pem = service.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodeBase64(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + base64url(new Uint8Array(signature));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error("Google OAuth no autorizó la cuenta de servicio: " + (data.error_description || data.error || response.status));
  }
  return data.access_token;
}

async function googlePost(url, token, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data.error && data.error.message ? data.error.message : "HTTP " + response.status;
    throw new Error(message);
  }
  return data;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método no permitido." }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8", "Allow": "GET", "Cache-Control": "no-store" }
    });
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.GA4_PROPERTY_ID || !env.GSC_SITE_URL) {
    return json({
      estado: "pendiente_configuracion",
      error: "Faltan variables de entorno: GOOGLE_SERVICE_ACCOUNT_JSON, GA4_PROPERTY_ID y/o GSC_SITE_URL.",
      configuracion: "Consultar docs/GOOGLE_METRICS.md"
    }, 503);
  }

  let range;
  let service;
  try {
    range = dateRange(new URL(request.url));
    service = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
    if (!service.client_email || !service.private_key) {
      throw new Error("El JSON de cuenta de servicio no contiene client_email/private_key.");
    }
  } catch (error) {
    return json({ estado: "error_configuracion", error: error.message }, 400);
  }

  try {
    const token = await googleAccessToken(service);
    const base = "https://analyticsdata.googleapis.com/v1beta/properties/" + encodeURIComponent(env.GA4_PROPERTY_ID) + ":runReport";
    const runGA = (dimensions, metrics, limit = 10000, orderBys = []) => googlePost(base, token, {
      dateRanges: [{ startDate: range.start, endDate: range.end }],
      ...(dimensions.length ? { dimensions: dimensions.map(name => ({ name })) } : {}),
      metrics: metrics.map(name => ({ name })),
      ...(orderBys.length ? { orderBys } : {}),
      limit
    });

    const gscBase = "https://searchconsole.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(env.GSC_SITE_URL) + "/searchAnalytics/query";
    const [summary, channels, devices, pages, sources, gscSummary, gsc, gscPages] = await Promise.all([
      runGA([], ["totalUsers", "sessions", "screenPageViews", "engagedSessions", "averageSessionDuration"], 1),
      runGA(["sessionDefaultChannelGroup"], ["totalUsers", "sessions", "screenPageViews"], 50),
      runGA(["deviceCategory"], ["totalUsers", "sessions", "screenPageViews"], 20),
      runGA(["pageTitle", "pagePath"], ["totalUsers", "sessions", "screenPageViews", "engagedSessions", "averageSessionDuration"], 100),
      runGA(["sessionSource", "sessionMedium"], ["sessions", "screenPageViews", "totalUsers"], 100, [{ metric: { metricName: "sessions" }, desc: true }]),
      googlePost(gscBase, token, { startDate: range.start, endDate: range.end, rowLimit: 1, dataState: "final" }),
      googlePost(gscBase, token, { startDate: range.start, endDate: range.end, dimensions: ["query"], rowLimit: 25, dataState: "final" }),
      googlePost(gscBase, token, { startDate: range.start, endDate: range.end, dimensions: ["page"], rowLimit: 25, dataState: "final" })
    ]);

    const metricObj = (row, names) => Object.fromEntries(names.map((name, i) => [
      name,
      Number(row && row.metricValues && row.metricValues[i] ? row.metricValues[i].value : 0)
    ]));
    const grouped = (report) => (report.rows || []).map(row => ({
      nombre: row.dimensionValues[0].value,
      ...metricObj(row, ["totalUsers", "sessions", "screenPageViews"])
    })).sort((a, b) => b.sessions - a.sessions);
    const pageRows = (pages.rows || []).map(row => ({
      titulo: row.dimensionValues[0].value,
      ruta: row.dimensionValues[1].value,
      ...metricObj(row, ["totalUsers", "sessions", "screenPageViews", "engagedSessions", "averageSessionDuration"])
    })).sort((a, b) => b.screenPageViews - a.screenPageViews).slice(0, 25);

    const classifySource = (source, medium) => {
      const s = String(source || "").toLowerCase().replace(/^www\./, "");
      const m = String(medium || "").toLowerCase();
      const hostIs = (domain) => s === domain || s.endsWith("." + domain);
      const hostMatches = (domains) => domains.some(hostIs);
      if (["(not set)", "(unknown)", ""].includes(s) || ["(not set)", "(unknown)", ""].includes(m)) return "Sin identificar";
      if (s === "(direct)" || m === "(none)" || m === "direct") return "Acceso directo";
      if (hostMatches(["chatgpt.com", "chat.openai.com", "openai.com", "copilot.microsoft.com", "gemini.google.com", "perplexity.ai", "claude.ai", "poe.com", "you.com", "phind.com", "mistral.ai"])) return "Asistente de IA";
      if (hostMatches(["facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "twitter.com", "x.com", "t.co", "youtube.com", "youtu.be", "pinterest.com", "reddit.com", "threads.net", "whatsapp.com", "telegram.org", "bsky.app"])) return "Red social";
      const searchAliases = ["google", "bing", "yahoo", "duckduckgo", "ecosia", "baidu", "yandex", "brave", "qwant"];
      const isSearchDomain = searchAliases.includes(s) ||
        /^google\.[a-z.]+$/.test(s) ||
        hostMatches(["google.com", "bing.com", "search.yahoo.com", "yahoo.com", "duckduckgo.com", "ecosia.org", "baidu.com", "yandex.com", "yandex.ru", "search.brave.com", "qwant.com"]);
      if (isSearchDomain && (m === "organic" || m === "organic_search" || m === "" || m === "(not set)")) return "Buscador";
      if (m === "organic" || m === "organic_search") return "Búsqueda orgánica (buscador por verificar)";
      if (m === "referral" || s.includes(".")) return "Otro sitio web";
      return "Otra fuente";
    };
    const sourceRows = (sources.rows || []).map(row => {
      const fuente = row.dimensionValues[0]?.value || "(not set)";
      const medio = row.dimensionValues[1]?.value || "(not set)";
      return {
        fuente,
        tipo: classifySource(fuente, medio),
        medio,
        ...metricObj(row, ["sessions", "screenPageViews", "totalUsers"])
      };
    }).sort((a, b) => b.sessions - a.sessions).slice(0, 100);

    return json({
      estado: "ok",
      actualizado: new Date().toISOString(),
      rango: range,
      analytics: {
        ...metricObj((summary.rows || [])[0], ["totalUsers", "sessions", "screenPageViews", "engagedSessions", "averageSessionDuration"]),
        canales: grouped(channels),
        dispositivos: grouped(devices),
        paginas: pageRows,
        fuentes: sourceRows
      },
      searchConsole: {
        resumen: (gscSummary.rows || [])[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        consultas: (gsc.rows || []).map(row => ({
          consulta: row.keys[0], clics: row.clicks, impresiones: row.impressions, ctr: row.ctr, posicion: row.position
        })),
        paginas: (gscPages.rows || []).map(row => ({
          pagina: row.keys[0], clics: row.clicks, impresiones: row.impressions, ctr: row.ctr, posicion: row.position
        }))
      }
    });
  } catch (error) {
    return json({ estado: "error_google", error: error.message, rango }, 502);
  }
}
