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

// Los mensajes de error se devuelven para diagnóstico. Antes se quitan tokens,
// parámetros access_token y encabezados Bearer por si un proveedor los repite.
function limpiarMensaje(error, max = 300) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (message || "Error de consulta no identificado.")
    .replace(/access_token=[^&\s"']+/gi, "access_token=[omitido]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [omitido]")
    .replace(/\bEA[A-Za-z0-9]{20,}\b/g, "[token omitido]")
    .slice(0, max);
}

async function get(url, token) {
  const safeUrl = new URL(url);
  // Meta token siempre viaja por Authorization, no por la URL.
  safeUrl.searchParams.delete("access_token");
  const headers = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(safeUrl.toString(), { headers });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("HTTP " + response.status);
  }
  if (!response.ok || (payload && payload.error)) {
    throw new Error((payload && payload.error && payload.error.message) || ("HTTP " + response.status));
  }
  return payload;
}

const corto = value => (value || "").replace(/\s+/g, " ").trim().slice(0, 26);
const sumarDias = (fecha, dias) => {
  const date = new Date(fecha + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
};

// Métricas de página consultadas con period=days_28.
const FB_METRICAS = ["page_media_view", "page_post_engagements", "page_views_total"];

// Con period=days_28 cada valor que devuelve Meta ya es el acumulado móvil de los
// 28 días que terminan en end_time. Sumar varios valores contaría días repetidos:
// se toma el valor numérico más reciente.
function ultimoValorDias28(item) {
  const values = item && Array.isArray(item.values) ? item.values : [];
  const validos = values
    .filter(entry => entry && typeof entry.value === "number")
    .sort((a, b) => String(a.end_time || "").localeCompare(String(b.end_time || "")));
  if (!validos.length) return null;
  const ultimo = validos[validos.length - 1];
  return { valor: ultimo.value, hasta: ultimo.end_time ? String(ultimo.end_time).slice(0, 10) : null };
}

async function facebookPagina(id, pageToken, desde) {
  const page = await get(`${GRAPH}/${id}?fields=name,followers_count,fan_count`, pageToken);
  // Las publicaciones se consultan aparte: si Meta las rechaza (por ejemplo, porque /posts
  // requiere pages_read_user_content), se informa el error y se siguen consultando Insights.
  let filas = [];
  let limiteAlcanzado = false;
  let publicacionesError = null;
  try {
  let url = `${GRAPH}/${id}/posts?fields=created_time,message,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)&since=${encodeURIComponent(desde)}&limit=100`;
  for (let i = 0; url && i < 10; i++) {
    const result = await get(url, pageToken);
    (result.data || []).forEach(post => filas.push({
      red: "Facebook", cuenta: page.name || id, fecha: (post.created_time || "").slice(0, 10),
      texto: corto(post.message), nota_id: null,
      me_gusta: post.reactions ? post.reactions.summary.total_count : null,
      comentarios: post.comments ? post.comments.summary.total_count : null,
      compartidos: post.shares ? post.shares.count : 0, vistas: null, propia: "Sí", key: "fb-" + post.id
    }));
    const next = result.paging && result.paging.next;
    if (i === 9 && next) limiteAlcanzado = true;
    url = next;
  }
  } catch (error) {
    filas = [];
    limiteAlcanzado = false;
    publicacionesError = limpiarMensaje(error);
  }

  // Cada métrica se consulta de forma aislada para que una métrica retirada o sin permiso
  // no impida mostrar las demás. Los errores se informan; nunca se sustituyen por cero.
  const insights = {};
  const insightsErrores = {};
  const fechas = [];
  await Promise.all(FB_METRICAS.map(async metric => {
    try {
      const payload = await get(`${GRAPH}/${id}/insights?metric=${metric}&period=days_28`, pageToken);
      const item = (payload.data || []).find(entry => entry.name === metric);
      if (!item) throw new Error("Meta no devolvió esta métrica.");
      const ultimo = ultimoValorDias28(item);
      if (!ultimo) throw new Error("Meta devolvió la métrica sin valores numéricos.");
      insights[metric] = ultimo.valor;
      if (ultimo.hasta) fechas.push(ultimo.hasta);
    } catch (error) {
      insights[metric] = null;
      insightsErrores[metric] = limpiarMensaje(error);
    }
  }));

  return {
    filas,
    limiteAlcanzado,
    pagina: {
      id,
      nombre: page.name || id,
      seguidores: page.followers_count ?? page.fan_count ?? null,
      publicaciones: publicacionesError ? null : filas.length,
      publicacionesError,
      insights,
      insightsPeriodo: "days_28",
      insightsHasta: fechas.length ? fechas.sort()[fechas.length - 1] : null,
      insightsErrores
    }
  };
}

async function facebook(desde, env) {
  const userToken = env.META_TOKEN;
  const pageIds = [...new Set([env.FB_PAGE_ID, env.FB_PAGE_ID_2].filter(Boolean).map(String))];
  if (!pageIds.length) throw new Error("Falta configurar FB_PAGE_ID con el identificador de la página JusNoticias.");
  if (!userToken && !env.FB_PAGE_TOKEN && !env.FB_PAGE_TOKEN_2) throw new Error("Falta configurar META_TOKEN o un token de acceso de página.");

  const paginas = [];
  const filas = [];
  let limiteAlcanzado = false;

  // Cada página se procesa por separado: si una falla, se conservan los datos de la otra.
  for (let index = 0; index < pageIds.length; index++) {
    const id = pageIds[index];
    try {
      let pageToken = index === 0 ? env.FB_PAGE_TOKEN : env.FB_PAGE_TOKEN_2;
      // META_TOKEN debe ser un token de usuario: con él se obtiene el token de cada página.
      // Insights nunca se consulta con el token de usuario.
      if (!pageToken && userToken) {
        try {
          const tokenPayload = await get(`${GRAPH}/${id}?fields=access_token`, userToken);
          pageToken = tokenPayload.access_token;
        } catch (error) {
          throw new Error(`No se pudo obtener el token de la página ${id}: ${limpiarMensaje(error)}. Revisá que META_TOKEN sea un token de usuario con pages_show_list y acceso a la página.`);
        }
      }
      if (!pageToken) throw new Error(`Falta token de acceso para la página ${id}. Configurá META_TOKEN como token de usuario o el secreto de token de página correspondiente.`);
      const resultado = await facebookPagina(id, pageToken, desde);
      filas.push(...resultado.filas);
      if (resultado.limiteAlcanzado) limiteAlcanzado = true;
      paginas.push(resultado.pagina);
    } catch (error) {
      paginas.push({ id, nombre: null, error: limpiarMensaje(error) });
    }
  }

  if (paginas.every(page => page.error)) {
    throw new Error("Ninguna página de Facebook respondió. " + paginas.map(page => `${page.id}: ${page.error}`).join(" | "));
  }

  // El total de seguidores solo se informa si todas las páginas lo devolvieron.
  const completas = paginas.every(page => !page.error && typeof page.seguidores === "number");
  return {
    filas,
    seguidores: completas ? paginas.reduce((sum, page) => sum + page.seguidores, 0) : null,
    paginas,
    parcial: paginas.some(page => page.error),
    // false si alguna página no devolvió publicaciones: el tablero no debe mostrarlo como cero.
    publicacionesCompletas: paginas.every(page => !page.error && !page.publicacionesError),
    limiteAlcanzado
  };
}

// Graph API v26.0 limita los Insights de cuenta de Instagram con since/until a un rango
// máximo de 30 días. Se usa la misma ventana de 28 días validada en Graph API Explorer.
const IG_DIAS_INSIGHTS = 28;
const IG_METRICAS = ["reach", "views", "accounts_engaged", "total_interactions"];

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

  // Formato validado con Graph API v26.0: period=day y metric_type=total_value para el rango.
  const hasta = new Date().toISOString().slice(0, 10);
  const minimo = sumarDias(hasta, -IG_DIAS_INSIGHTS);
  const insightsDesde = desde > minimo ? desde : minimo;
  const insights = {};
  const insightsErrores = {};
  await Promise.all(IG_METRICAS.map(async metric => {
    try {
      const query = new URLSearchParams({
        metric,
        period: "day",
        metric_type: "total_value",
        since: insightsDesde,
        until: hasta
      });
      const payload = await get(`${GRAPH}/${id}/insights?${query.toString()}`, token);
      const item = (payload.data || []).find(entry => entry.name === metric);
      if (!item) throw new Error("Meta no devolvió esta métrica.");
      const value = item.total_value && item.total_value.value;
      if (typeof value !== "number") throw new Error("Meta devolvió la métrica sin valor total numérico.");
      insights[metric] = value;
    } catch (error) {
      // Una métrica no disponible no debe impedir las otras ni convertirse en cero.
      insights[metric] = null;
      insightsErrores[metric] = limpiarMensaje(error);
    }
  }));
  return {
    filas,
    seguidores: account.followers_count ?? null,
    limiteAlcanzado,
    insights,
    insightsErrores,
    insightsDesde,
    insightsHasta: hasta,
    insightsRecortado: insightsDesde !== desde
  };
}

async function x(desde, env) {
  const token = env.X_BEARER_TOKEN;
  const username = String(env.X_USER_HANDLE || "Jus_Noticias").replace(/^@/, "");
  if (!token) throw new Error("Falta configurar X_BEARER_TOKEN con acceso autorizado a la API de X.");
  const api = "https://api.x.com/2";
  const getX = async url => {
    try {
      return await get(url, token);
    } catch (error) {
      if (error instanceof Error && error.message === "HTTP 402") {
        throw new Error("La API de X requiere créditos o acceso habilitado.");
      }
      if (error instanceof Error && error.message === "HTTP 403") {
        throw new Error("La aplicación de X no tiene acceso habilitado a este endpoint.");
      }
      throw error;
    }
  };
  const userPayload = await getX(`${api}/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics`);
  const user = userPayload.data;
  if (!user || !user.id) throw new Error("No se encontró la cuenta de X indicada por X_USER_HANDLE.");
  const filas = [];
  let url = `${api}/users/${encodeURIComponent(user.id)}/tweets?tweet.fields=created_at,public_metrics&max_results=100&start_time=${encodeURIComponent(desde + "T00:00:00Z")}`;
  let limiteAlcanzado = false;
  for (let i = 0; url && i < 10; i++) {
    const result = await getX(url);
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

  const tareas = { Facebook: facebook, Instagram: instagram, YouTube: youtube, X: x };
  // ?redes=Facebook,Instagram limita la consulta a esas fuentes (por ejemplo, para probar
  // solo Meta sin consultar X ni YouTube). Sin el parámetro se consultan todas.
  let nombres = Object.keys(tareas);
  const pedidas = url.searchParams.get("redes");
  if (pedidas !== null) {
    const lista = pedidas.split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
    const elegidas = nombres.filter(name => lista.includes(name.toLowerCase()));
    const desconocidas = lista.filter(value => !nombres.some(name => name.toLowerCase() === value));
    if (!elegidas.length || desconocidas.length) {
      return json({ error: "'redes' admite solo: " + nombres.join(", ") + "." }, 400);
    }
    nombres = elegidas;
  }

  const out = { actualizado: new Date().toISOString(), desde, consultadas: nombres, redes: {}, errores: {} };
  await Promise.all(nombres.map(async network => {
    try {
      out.redes[network] = await tareas[network](desde, env);
    } catch (error) {
      // Límite mayor para que un error combinado conserve el detalle de cada página.
      out.errores[network] = limpiarMensaje(error, 1500);
    }
  }));
  const parcial = out.redes.Facebook && out.redes.Facebook.parcial;
  return json(out, 200, Object.keys(out.errores).length > 0 || Boolean(parcial));
}
