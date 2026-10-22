const CHANNEL_URL = "https://whatsapp.com/channel/0029VaGP0tX0lwgpiNAnBb1p";
const CHANNEL_ID = "0029VaGP0tX0lwgpiNAnBb1p";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function onRequestGet() {
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(CHANNEL_URL, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; JuschubutNoticiasDiagnostics/1.0)",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return json({
        source: "WhatsApp public channel page",
        url: CHANNEL_URL,
        checkedAt,
        available: false,
        httpStatus: response.status,
        contentType,
        reason: "La respuesta no es HTML; no se intenta extraer métricas.",
      });
    }

    // Inspect only the public page response; never return or log its HTML.
    const html = (await response.text()).slice(0, 2_000_000);
    const hasChannelId = html.includes(CHANNEL_ID);
    const hasChannelName = /JUSCHUBUT\s+Noticias/i.test(html);

    // A candidate must be adjacent to an explicit follower label and numeric.
    // It remains unverified until independently validated; never use it as a KPI.
    const followerPatterns = [
      /([\d][\d.,\s]*)\s*(?:followers|seguidores)\b/i,
      /\b(?:followers|seguidores)\b[^\d]{0,40}([\d][\d.,\s]*)/i,
    ];
    let followerText = null;
    for (const pattern of followerPatterns) {
      const match = html.match(pattern);
      if (match) {
        const candidate = match[1].trim().replace(/\s+/g, " ");
        if (/^\d[\d., ]*$/.test(candidate)) {
          followerText = candidate;
          break;
        }
      }
    }

    return json({
      source: "WhatsApp public channel page",
      url: CHANNEL_URL,
      checkedAt,
      available: response.ok && hasChannelId,
      httpStatus: response.status,
      contentType,
      redirected: response.url !== CHANNEL_URL,
      channelIdentifierFound: hasChannelId,
      channelNameFound: hasChannelName,
      followerCountCandidate: followerText,
      followerCountVerified: false,
      note: followerText
        ? "Candidato numérico junto a una etiqueta de seguidores; aún no está verificado y no debe usarse como métrica del tablero."
        : "No se detectó un contador numérico de seguidores reconocible en el HTML recibido. No equivale a cero.",
    });
  } catch (error) {
    return json({
      source: "WhatsApp public channel page",
      url: CHANNEL_URL,
      checkedAt,
      available: false,
      reason: error instanceof Error ? error.message : "No se pudo consultar la página pública.",
      note: "Diagnóstico experimental: no modifica las métricas del tablero.",
    }, 502);
  }
}
