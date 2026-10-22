// Cloudflare Pages Function: métricas sociales propias de JusNoticias.
// Configurar todas las credenciales como variables del entorno Pages; nunca en el HTML.
const GRAPH = "https://graph.facebook.com/v26.0";
const json = (body, status = 200, errors = false) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": errors || status >= 400 ? "no-store" : "s-maxage=600"
  }
});

async function get(url, token) {
  const safeUrl = new URL(url);
  // Meta token siempre viaja por Authorization, no por la URL.
  safeUrl.searchParams.delete("access_token");
  const headers = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(safeUrl.toString(), { headers });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error((payload.error && payload.error.message) || ("HTTP " + response.status));
  }
  return payload;
}

const corto = value => (value || "").replace(/\s+/g, " ").trim().slice(0, 26);

async function facebook(desde, env) {
  const id = env.FB_PAGE_ID;
  const metaToken = env.META_TOKEN;
  if (!id) throw new Error("Falta configurar FB_PAGE_ID con el identificador verificado de la página JusNoticias.");
  if (!metaToken) throw new Error("Falta configurar META_TOKEN.");
  const tokenPayload = await get(`${GRAPH}/${id}?fields=access_token`, metaToken);
  const pageToken = tokenPayload.access_token;
  if (!pageToken) throw new Error("Meta no devolvió un token de página.");
  const page = await get(`${GRAPH}/${id}?fields=name,followers_count,fan_count`, pageToken);
  const filas = [];
  let limiteAlcanzado = false;
  let url = `${GRAPH}/${id}/posts?fields=created_time,message,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)&since=${encodeURIComponent(desde)}&limit=100`;
  for (let i = 0; url && i < 10; i++) {
    const result = await get(url, pageToken);
    (result.data || []).forEach(post => filas.push({
      red: "Facebook", cuenta: page.name || "JusNoticias", fecha: (post.created_time || "").slice(0, 10),
      texto: corto(post.message), nota_id: null,
      me_gusta: post.reactions ? post.reactions.summary.total_count : null,
      comentarios: post.comments ? post.comments.summary.total_count : null,
      compartidos: post.shares ? post.shares.count : 0, vistas: null, propia: "Sí", key: "fb-" + post.id
    }));
    const next = result.paging && result.paging.next;
    if (i === 9 && next) limiteAlcanzado = true;
    url = next;
  }
  return { filas, seguidores: page.followers_count ?? page.fan_count ?? null, limiteAlcanzado };
}

async function instagram(desde, env) {
  const token = env.META_TOKEN;
  const id = env.IG_USER_ID;
  if (!id) throw new Error("Falta configurar IG_USER_ID para la cuenta oficial @jus_chubut.");
  if (!token) throw new Error("Falta configurar META_TOKEN.");
  const account = await get(`${GRAPH}/${id}?fields=username,followers_count`, token);
  const filas = [];
  let limiteAlcanzado = false;
  let url = `${GRAPH}/${id}/media?fields=timestamp,caption,like_count,comments_count&limit=100`;
  for (let i = 0; url && i < 10; i++) {
    const result = await get(url, token);
    const posts = result.data || [];
    const within = posts.filter(post => (post.timestamp || "").slice(0, 10) >= desde);
    within.forEach(post => filas.push({
      red: "Instagram", cuenta: account.username || "@jus_chubut", fecha: (post.timestamp || "").slice(0, 10),
      texto: corto(post.caption), nota_id: null, me_gusta: post.like_count ?? null,
      comentarios: post.comments_count ?? null, compartidos: null, vistas: null, propia: "Sí", key: "ig-" + post.id
    }));
    if (within.length < posts.length) break;
    const next = result.paging && result.paging.next;
    if (i === 9 && next) { limiteAlcanzado = true; break; }
    url = next;
  }
  return { filas, seguidores: account.followers_count ?? null, limiteAlcanzado };
}

async function youtube(desde, env) {
  const key = env.YT_KEY;
  const channelId = env.YT_CANAL_ID;
  const api = "https://www.googleapis.com/youtube/v3";
  if (!key) throw new Error("Falta configurar YT_KEY.");
  if (!channelId) throw new Error("Falta configurar YT_CANAL_ID con el ID verificado de JusNoticias Prensa.");
  const channels = (await get(`${api}/channels?part=statistics,contentDetails&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(key)}`)).items || [];
  if (!channels.length) throw new Error("No se encontró el canal indicado por YT_CANAL_ID. Verificar el ID de JusNoticias Prensa.");
  const channel = channels[0];
  const uploads = channel.contentDetails.relatedPlaylists.uploads;
  const ids = [];
  let pageToken = "";
  let limiteAlcanzado = false;
  for (let i = 0; i < 10; i++) {
    const url = `${api}/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=50&key=${encodeURIComponent(key)}${pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""}`;
    const result = await get(url);
    const items = (result.items || []).map(item => item.contentDetails);
    items.filter(item => (item.videoPublishedAt || "").slice(0, 10) >= desde).forEach(item => ids.push(item.videoId));
    if (!result.nextPageToken || items.every(item => (item.videoPublishedAt || "").slice(0, 10) < desde)) break;
    if (i === 9) { limiteAlcanzado = true; break; }
    pageToken = result.nextPageToken;
  }
  const filas = [];
  for (let i = 0; i < ids.length; i += 50) {
    const url = `${api}/videos?part=snippet,statistics&id=${ids.slice(i, i + 50).map(encodeURIComponent).join(",")}&key=${encodeURIComponent(key)}`;
    const result = await get(url);
    (result.items || []).forEach(video => {
      const stats = video.statistics || {};
      const number = field => stats[field] !== undefined ? Number(stats[field]) : null;
      filas.push({
        red: "YouTube", cuenta: "JusNoticias Prensa", fecha: (video.snippet.publishedAt || "").slice(0, 10),
        texto: corto(video.snippet.title), nota_id: null, me_gusta: number("likeCount"),
        comentarios: number("commentCount"), compartidos: null, vistas: number("viewCount"),
        propia: "Sí", key: "yt-" + video.id
      });
    });
  }
  return { filas, seguidores: Number(channel.statistics && channel.statistics.subscriberCount) || null, limiteAlcanzado };
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const supplied = url.searchParams.get("desde");
  if (supplied && !validDate(supplied)) {
    return json({ error: "'desde' debe ser una fecha válida con formato AAAA-MM-DD." }, 400);
  }
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const defaultStart = new Date(todayUtc);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 89);
  const desde = supplied || defaultStart.toISOString().slice(0, 10);
  const delta = (todayUtc - Date.parse(desde + "T00:00:00Z")) / 86400000;
  if (delta < 0 || delta > 89) {
    return json({ error: "'desde' debe estar dentro de los últimos 90 días." }, 400);
  }

  const out = { actualizado: new Date().toISOString(), desde, redes: {}, errores: {} };
  const tareas = { Facebook: facebook, Instagram: instagram, YouTube: youtube };
  await Promise.all(Object.entries(tareas).map(async ([network, fn]) => {
    try {
      out.redes[network] = await fn(desde, env);
    } catch (error) {
      out.errores[network] = error instanceof Error ? error.message : "Error de consulta no identificado.";
    }
  }));
  return json(out, 200, Object.keys(out.errores).length > 0);
}
