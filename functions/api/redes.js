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
  // Compatibilidad: FB_PAGE_IDS acepta una lista separada por comas.
  // También se admiten FB_PAGE_ID y FB_PAGE_ID_2 como variables separadas.
  const configuredIds = env.FB_PAGE_IDS || [env.FB_PAGE_ID, env.FB_PAGE_ID_2].filter(Boolean).join(",");
  const ids = [...new Set(String(configuredIds).split(",").map(value => value.trim()).filter(Boolean))];
  const metaToken = env.META_TOKEN;
  if (!ids.length) {
    throw new Error("Falta configurar FB_PAGE_ID y FB_PAGE_ID_2, o FB_PAGE_IDS con los IDs de ambas páginas institucionales separados por coma.");
  }
  if (!metaToken) throw new Error("Falta configurar META_TOKEN.");

  const filas = [];
  const erroresPaginas = [];
  const cuentas = [];
  const seguidoresPorPagina = [];
  let limiteAlcanzado = false;

  for (const id of ids) {
    try {
      const tokenPayload = await get(`${GRAPH}/${encodeURIComponent(id)}?fields=access_token`, metaToken);
      const pageToken = tokenPayload.access_token;
      if (!pageToken) throw new Error("Meta no devolvió un token de página.");
      const page = await get(`${GRAPH}/${encodeURIComponent(id)}?fields=name,followers_count,fan_count`, pageToken);
      const pageName = page.name || ("Página Facebook " + id);
      cuentas.push({ id, nombre: pageName });
      const followers = page.followers_count ?? page.fan_count;
      if (Number.isFinite(Number(followers)) && followers !== null && followers !== undefined) {
        seguidoresPorPagina.push(Number(followers));
      }

      let url = `${GRAPH}/${encodeURIComponent(id)}/posts?fields=created_time,message,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)&since=${encodeURIComponent(desde)}&limit=100`;
      for (let i = 0; url && i < 10; i++) {
        const result = await get(url, pageToken);
        (result.data || []).forEach(post => filas.push({
          red: "Facebook", cuenta: pageName, fecha: (post.created_time || "").slice(0, 10),
          texto: corto(post.message), nota_id: null,
          me_gusta: post.reactions ? post.reactions.summary.total_count : null,
          comentarios: post.comments ? post.comments.summary.total_count : null,
          compartidos: post.shares ? post.shares.count : 0, vistas: null, propia: "Sí",
          key: "fb-" + id + "-" + post.id
        }));
        const next = result.paging && result.paging.next;
        if (i === 9 && next) limiteAlcanzado = true;
        url = next;
      }
    } catch (error) {
      erroresPaginas.push({
        id,
        error: error instanceof Error ? error.message : "Error de consulta no identificado."
      });
    }
  }

  if (!cuentas.length) {
    const detalle = erroresPaginas.map(item => item.id + ": " + item.error).join("; ");
    throw new Error("No se pudo consultar ninguna página de Facebook. " + detalle);
  }

  return {
    filas,
    seguidores: seguidoresPorPagina.length ? seguidoresPorPagina.reduce((total, value) => total + value, 0) : null,
    paginas: cuentas,
    erroresPaginas,
    limiteAlcanzado
  };
}

async function instagram(desde, env) {
  const token = env.META_TOKEN;
  const id = env.IG_USER_ID;
  if (!id) throw new Error("Falta configurar IG_USER_ID para la cuenta oficial @jus_chubut.");
  if (!token) throw new Error("Falta configurar META_TOKEN.");
  const account = await get(`${GRAPH}/${id}?fields=username,followers_count,media_count`, token);
  const filas = [];
  let limiteAlcanzado = false;
  let alcanceDiario = null;
  let errorEstadisticas = null;

  // La API entrega días con end_time al comienzo del día siguiente.
  // Tomamos solo el último período cuyo end_time ya ocurrió para evitar el día parcial.
  try {
    const insights = await get(`${GRAPH}/${id}/insights?metric=reach&period=day`, token);
    const now = Date.now();
    const points = (insights.data || []).flatMap(metric => metric.values || [])
      .filter(point => point.end_time && Date.parse(point.end_time) <= now && Number.isFinite(Number(point.value)))
      .sort((a, b) => Date.parse(b.end_time) - Date.parse(a.end_time));
    if (points.length) {
      const point = points[0];
      const end = new Date(point.end_time);
      end.setUTCDate(end.getUTCDate() - 1);
      alcanceDiario = { fecha: end.toISOString().slice(0, 10), valor: Number(point.value) };
    }
  } catch (error) {
    // El alcance es complementario: si Insights falla, no perdemos las publicaciones.
    errorEstadisticas = error instanceof Error ? error.message : "No se pudieron consultar las estadísticas de Instagram.";
  }

  let url = `${GRAPH}/${id}/media?fields=id,timestamp,caption,media_type,permalink,like_count,comments_count&limit=100`;
  for (let i = 0; url && i < 10; i++) {
    const result = await get(url, token);
    const posts = result.data || [];
    const within = posts.filter(post => (post.timestamp || "").slice(0, 10) >= desde);
    within.forEach(post => filas.push({
      red: "Instagram", cuenta: account.username || "@jus_chubut", fecha: (post.timestamp || "").slice(0, 10),
      texto: String(post.caption || "").replace(/\s+/g, " ").trim().slice(0, 300), nota_id: null, me_gusta: post.like_count ?? null,
      comentarios: post.comments_count ?? null, compartidos: null, vistas: null, propia: "Sí",
      enlace: post.permalink || null, tipoContenido: post.media_type || null, key: "ig-" + post.id
    }));
    if (within.length < posts.length) break;
    const next = result.paging && result.paging.next;
    if (i === 9 && next) { limiteAlcanzado = true; break; }
    url = next;
  }
  return {
    filas,
    seguidores: account.followers_count ?? null,
    publicacionesTotales: account.media_count ?? null,
    alcanceDiario,
    errorEstadisticas,
    limiteAlcanzado
  };
}

async function x(desde, env) {
  const token = env.X_BEARER_TOKEN;
  const username = String(env.X_USER_HANDLE || "Jus_Noticias").replace(/^@/, "");
  if (!token) throw new Error("Falta configurar X_BEARER_TOKEN con acceso autorizado a la API de X.");
  const api = "https://api.x.com/2";
  const userPayload = await get(`${api}/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics`, token);
  const user = userPayload.data;
  if (!user || !user.id) throw new Error("No se encontró la cuenta de X indicada por X_USER_HANDLE.");
  const filas = [];
  let url = `${api}/users/${encodeURIComponent(user.id)}/tweets?tweet.fields=created_at,public_metrics&max_results=100&start_time=${encodeURIComponent(desde + "T00:00:00Z")}`;
  let limiteAlcanzado = false;
  for (let i = 0; url && i < 10; i++) {
    const result = await get(url, token);
    (result.data || []).forEach(post => {
      if (!post.created_at || post.created_at.slice(0, 10) < desde) return;
      const stats = post.public_metrics || {};
      filas.push({
        red: "X", cuenta: "@" + (user.username || username), fecha: post.created_at.slice(0, 10),
        texto: corto(post.text), nota_id: null, me_gusta: stats.like_count ?? null,
        comentarios: stats.reply_count ?? null,
        compartidos: (Number(stats.retweet_count) || 0) + (Number(stats.quote_count) || 0),
        vistas: stats.impression_count ?? null, propia: "Sí", key: "x-" + post.id
      });
    });
    const next = result.meta && result.meta.next_token;
    if (!next) break;
    if (i === 9) { limiteAlcanzado = true; break; }
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("pagination_token", next);
    url = nextUrl.toString();
  }
  return { filas, seguidores: user.public_metrics && user.public_metrics.followers_count !== undefined ? user.public_metrics.followers_count : null, limiteAlcanzado };
}

async function youtube(desde, env) {
  const key = env.YT_KEY;
  const channelId = env.YT_CANAL_ID;
  const handle = String(env.YT_CANAL_HANDLE || "jusnoticiasprensa2865").replace(/^@/, "");
  const api = "https://www.googleapis.com/youtube/v3";
  if (!key) throw new Error("Falta configurar YT_KEY.");
  // Preferir el ID estable si está configurado; si no, resolver el canal por su @handle oficial.
  const lookup = channelId
    ? "id=" + encodeURIComponent(channelId)
    : "forHandle=" + encodeURIComponent(handle);
  const channels = (await get(`${api}/channels?part=statistics,contentDetails&` + lookup + "&key=" + encodeURIComponent(key))).items || [];
  if (!channels.length) throw new Error("No se encontró el canal de YouTube configurado. Verificar YT_CANAL_ID o YT_CANAL_HANDLE.");
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
        red: "YouTube", cuenta: channel.snippet && channel.snippet.title || "JusNoticias Prensa",
        fecha: (video.snippet.publishedAt || "").slice(0, 10),
        texto: corto(video.snippet.title), nota_id: null, me_gusta: number("likeCount"),
        comentarios: number("commentCount"), compartidos: null, vistas: number("viewCount"),
        propia: "Sí", enlace: "https://www.youtube.com/watch?v=" + encodeURIComponent(video.id),
        key: "yt-" + video.id
      });
    });
  }
  return {
    filas,
    cuenta: channel.snippet && channel.snippet.title || "JusNoticias Prensa",
    seguidores: channel.statistics && channel.statistics.subscriberCount !== undefined
      ? Number(channel.statistics.subscriberCount) : null,
    publicacionesTotales: channel.statistics && channel.statistics.videoCount !== undefined
      ? Number(channel.statistics.videoCount) : null,
    limiteAlcanzado
  };
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
  const tareas = { Facebook: facebook, Instagram: instagram, YouTube: youtube, X: x };
  await Promise.all(Object.entries(tareas).map(async ([network, fn]) => {
    try {
      out.redes[network] = await fn(desde, env);
    } catch (error) {
      out.errores[network] = error instanceof Error ? error.message : "Error de consulta no identificado.";
    }
  }));
  return json(out, 200, Object.keys(out.errores).length > 0);
}
