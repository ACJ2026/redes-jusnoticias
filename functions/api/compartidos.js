// Cloudflare Pages Function: busca publicaciones de OTRAS cuentas que compartan notas de Juschubut Noticias.
// Instagram: lee las publicaciones recientes de las cuentas de la lista (business_discovery de Meta).
// YouTube: busca por título los videos de otros canales publicados después de cada nota.
// Facebook: búsqueda gratuita de publicaciones públicas indexadas por Bing RSS (no cubre todo Facebook). TikTok sigue asistido.
import cuentasMonitoreo from "../../data/cuentas_monitoreo.json";
import notasOficiales from "../../data/notas2.json";
import repercusion from "../../data/rep2.json";

const GRAPH = "https://graph.facebook.com/v26.0";
const YT = "https://www.googleapis.com/youtube/v3";
const NOTA_URL = id => "https://jusnoticias.juschubut.gov.ar/?p=" + id;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": status >= 400 ? "no-store" : "s-maxage=1800" }
});

function limpiarMensaje(error, max = 200) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (message || "Error de consulta no identificado.")
    .replace(/access_token=[^&\s"']+/gi, "access_token=[omitido]")
    .replace(/key=[^&\s"']+/gi, "key=[omitido]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [omitido]")
    .replace(/\bEA[A-Za-z0-9]{20,}\b/g, "[token omitido]")
    .slice(0, max);
}

async function get(url, token) {
  const headers = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(url, { headers });
  let payload;
  try { payload = await response.json(); } catch { throw new Error("HTTP " + response.status); }
  if (!response.ok || (payload && payload.error)) {
    throw new Error((payload && payload.error && payload.error.message) || ("HTTP " + response.status));
  }
  return payload;
}

const sumarDias = (fecha, dias) => {
  const d = new Date(fecha + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

// Misma idea que el relevamiento de medios: raíces de palabras significativas del título.
const STOP = new Set("para sobre desde entre donde porque cuando hasta durante contra juzgado juzgados justicia judicial poder chubut provincia fallo causa ordena ordenan penal trelew rawson madryn comodoro esquel puerto rivadavia tribunal superior ciudad nuevo nueva jusnoticias".split(" "));
const raices = texto => new Set(String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length >= 5 && !STOP.has(w)).map(w => w.slice(0, 6)));
const normalizarTexto = texto => String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Asigna un texto a la nota oficial más parecida publicada entre 1 día antes y 8 días después.
// Exige al menos 3 raíces compartidas con el título, o un enlace explícito a jusnoticias.
function notaRelacionada(texto, fecha, notas) {
  const enlace = /jusnoticias\.juschubut\.gov\.ar\/\?p=(\d+)|jusnoticias\.juschubut\.gov\.ar/i.exec(texto || "");
  // Un enlace con ID es evidencia directa: no exigir coincidencias de palabras del título.
  if (enlace && enlace[1]) {
    const exacta = notas.find(n => String(n.id) === enlace[1]);
    if (exacta) return { nota: exacta, comunes: raices(exacta.titulo).size, motivo: "enlace directo a la nota", fuerte: true };
  }
  const propias = raices(texto);
  const textoNormalizado = normalizarTexto(texto);
  let mejor = null;
  for (const n of notas) {
    if (!(sumarDias(n.fecha, -1) <= fecha && fecha <= sumarDias(n.fecha, 8))) continue;
    const tituloNormalizado = normalizarTexto(n.titulo);
    // Si el título completo aparece en el título o descripción del video/post, es una señal fuerte.
    if (tituloNormalizado.length >= 18 && textoNormalizado.includes(tituloNormalizado)) {
      return { nota: n, comunes: raices(n.titulo).size, motivo: "título de la nota identificado", fuerte: true };
    }
    const raicesTitulo = raices(n.titulo);
    const comunes = [...raicesTitulo].filter(r => propias.has(r)).length;
    if (!mejor || comunes > mejor.comunes) mejor = { nota: n, comunes, totalRaices: raicesTitulo.size };
  }
  // Tres palabras sueltas («redes», «sociales», «condenan») aparecen en cualquier noticia policial:
  // además del mínimo, se pide al menos el 60 % de las palabras distintivas del título.
  // Estas coincidencias quedan «A verificar»; solo el enlace directo o el título completo son fuertes.
  const minimo = mejor ? Math.max(Math.min(3, Math.max(2, mejor.totalRaices)), Math.ceil(mejor.totalRaices * 0.6)) : 3;
  if (mejor && mejor.comunes >= minimo) return { ...mejor, motivo: mejor.comunes + " de " + mejor.totalRaices + " palabras del título en común" };
  if (enlace && mejor && mejor.comunes >= 1) return { ...mejor, motivo: "enlaza a jusnoticias" };
  return null;
}

// Publicación de una cuenta que etiquetó a nuestra cuenta pero cuyo texto no permite saber qué nota difunde.
const filaSinNota = (red, cuenta, cuentaUrl, publicacionUrl, fecha, texto, motivo) => ({
  red, cuenta, cuenta_url: cuentaUrl, publicacion_url: publicacionUrl, fecha,
  texto: String(texto || "").replace(/\s+/g, " ").trim().slice(0, 140),
  nota_id: null, nota_titulo: "", nota_url: null, coincidencia: motivo, verificacion: "a_verificar"
});

const fila = (red, cuenta, cuentaUrl, publicacionUrl, fecha, texto, rel) => ({
  red, cuenta, cuenta_url: cuentaUrl, publicacion_url: publicacionUrl, fecha,
  texto: String(texto || "").replace(/\s+/g, " ").trim().slice(0, 140),
  nota_id: rel.nota.id, nota_titulo: rel.nota.titulo, nota_url: NOTA_URL(rel.nota.id), coincidencia: rel.motivo,
  verificacion: rel.fuerte ? "fuerte" : "a_verificar"
});

// Cada cuenta puede limitar sus páginas (campo «paginas»): los medios nacionales publican tanto
// que con una página alcanza y así no se agota el límite de consultas de Meta.
const paginasPorUsuario = new Map();
cuentasMonitoreo.cuentas
  .filter(c => c.red === "Instagram" && /^@[\w.]+$/.test(c.cuenta || "") && !/^Dudosa/.test(c.estado || ""))
  // Por defecto 1 página (30 publicaciones): con 64 cuentas, 3 páginas superaban el límite horario de Meta
  // (26/10/2026: la segunda búsqueda seguida dio error en las 64 cuentas). Una cuenta puede pedir más con «paginas».
  .forEach(c => paginasPorUsuario.set(c.cuenta.slice(1).toLowerCase(), Math.max(1, Math.min(Number(c.paginas) || 1, 3))));
const USUARIOS_IG = [...paginasPorUsuario.keys()];
// Medio → cuenta de Instagram, para la búsqueda dirigida.
const claveMedio = texto => normalizarTexto(texto).replace(/ /g, "");
const igPorMedio = new Map();
cuentasMonitoreo.cuentas
  .filter(c => c.red === "Instagram" && c.medio && /^@[\w.]+$/.test(c.cuenta || "") && paginasPorUsuario.has(c.cuenta.slice(1).toLowerCase()))
  .forEach(c => igPorMedio.set(claveMedio(c.medio), c.cuenta.slice(1).toLowerCase()));
const DIAS_DIRIGIDA = 10, MAX_DIRIGIDA = 12;
// Cuenta (Instagram @usuario o canal de YouTube tal como figura en la lista) → medio, y medios
// que publicaron cada nota en su web. Sirve para marcar los parecidos que vienen de un medio que
// ya publicó esa misma nota: el tablero los muestra «para confirmar» (no se cuentan solos).
const medioDeCuenta = new Map();
cuentasMonitoreo.cuentas
  .filter(c => c.medio && c.cuenta && !/^Dudosa/.test(c.estado || "") && (c.red === "Instagram" || c.red === "YouTube"))
  .forEach(c => medioDeCuenta.set(c.red + "|" + (c.red === "Instagram" ? c.cuenta.replace(/^@/, "").toLowerCase() : c.cuenta.trim()), claveMedio(c.medio)));
export function mediosQuePublicaron(rep = repercusion) {
  const m = new Map();
  rep.filter(r => r && r.url && r.confianza !== "Baja").forEach(r => {
    const id = Number(r.nota_id);
    if (!m.has(id)) m.set(id, new Set());
    m.get(id).add(claveMedio(r.medio));
  });
  return m;
}
export function marcarMedioQuePublico(f, porNota = mediosQuePublicaron(), cuentas = medioDeCuenta) {
  if (!f || f.verificacion === "fuerte" || !f.nota_id) return f;
  const clave = f.red === "Instagram" ? "Instagram|" + String(f.cuenta || "").replace(/^@/, "").toLowerCase() : f.red + "|" + String(f.cuenta_ref || "");
  const medio = cuentas.get(clave);
  if (medio && porNota.has(Number(f.nota_id)) && porNota.get(Number(f.nota_id)).has(medio)) f.medio_publico_nota = true;
  return f;
}
// Búsqueda dirigida: las cuentas de Instagram de los medios que ya publicaron en su web alguna nota
// de los últimos días, empezando por la publicación más reciente. Son pocas consultas (no agota el
// límite de Meta) y son las cuentas donde es más probable que aparezca la nota.
export function cuentasDirigidas(hoy, notas = notasOficiales, rep = repercusion, mapa = igPorMedio) {
  const desde = sumarDias(hoy, -DIAS_DIRIGIDA);
  const fechaNota = new Map(notas.map(n => [Number(n.id), n.fecha]));
  const orden = rep
    .filter(r => r && r.url && r.confianza !== "Baja" && (fechaNota.get(Number(r.nota_id)) || "") >= desde)
    .sort((a, b) => String(fechaNota.get(Number(b.nota_id))).localeCompare(String(fechaNota.get(Number(a.nota_id)))));
  const cuentas = [];
  for (const r of orden) {
    const u = mapa.get(claveMedio(r.medio));
    if (u && !cuentas.includes(u)) cuentas.push(u);
    if (cuentas.length >= MAX_DIRIGIDA) break;
  }
  return cuentas;
}
const CANALES_YT = [...new Set(cuentasMonitoreo.cuentas
  .filter(c => c.red === "YouTube" && c.cuenta && !/^Dudosa/.test(c.estado || ""))
  .map(c => c.cuenta.trim()))];
// Cloudflare limita las consultas externas por pedido (50 en el plan gratuito): las listas largas
// se reparten en tandas que el tablero pide por separado. 12 cuentas × 3 páginas = 36 consultas como máximo;
// 12 canales de YouTube × (1 canal + 3 páginas) = 48 (con 20 canales se pasaba: «Too many subrequests», 30/10/2026).
const TAM_LOTE_IG = 12, TAM_LOTE_YT = 12;
const lote = (lista, tam, n) => n == null ? lista : lista.slice(n * tam, (n + 1) * tam);

// Las cuentas de la búsqueda dirigida no se repiten en la búsqueda general (ahorra consultas a Meta).
const usuariosGenerales = () => {
  const dirigidas = new Set(cuentasDirigidas(new Date().toISOString().slice(0, 10)));
  return USUARIOS_IG.filter(u => !dirigidas.has(u));
};

async function instagramDirigida(env, notas, desde) {
  return instagram(env, notas, desde, null, cuentasDirigidas(new Date().toISOString().slice(0, 10)));
}

async function instagram(env, notas, desde, n, lista) {
  if (!env.META_TOKEN || !env.IG_USER_ID) throw new Error("Faltan META_TOKEN o IG_USER_ID.");
  const usuarios = lista || lote(usuariosGenerales(), TAM_LOTE_IG, n);
  const filas = [], errores = {};
  const campos = "media.limit(30){caption,permalink,timestamp}";
  const MAX_PAGINAS_POR_CUENTA = 3; // Hasta 90 publicaciones por cuenta; limita tiempo y consultas.
  let publicacionesRevisadas = 0;
  // De a 5 en paralelo para no exceder los límites de Meta.
  for (let i = 0; i < usuarios.length; i += 5) {
    await Promise.all(usuarios.slice(i, i + 5).map(async usuario => {
      try {
        const url = `${GRAPH}/${env.IG_USER_ID}?fields=${encodeURIComponent(`business_discovery.username(${usuario}){${campos}}`)}`;
        let data = await get(url, env.META_TOKEN);
        let paginas = 0;
        while (data && paginas < MAX_PAGINAS_POR_CUENTA) {
          const bloque = data.business_discovery && data.business_discovery.media;
          const media = (bloque && bloque.data) || [];
          publicacionesRevisadas += media.length;
          media.forEach(m => {
            const fecha = String(m.timestamp || "").slice(0, 10);
            if (!fecha || fecha < desde) return;
            const rel = notaRelacionada(m.caption, fecha, notas);
            if (rel) filas.push(fila("Instagram", "@" + usuario, "https://www.instagram.com/" + usuario + "/", m.permalink, fecha, m.caption, rel));
          });
          paginas += 1;
          // Seguir solo si Meta ofrece una página siguiente; nunca recorrer el historial sin límite.
          const siguiente = bloque && bloque.paging && bloque.paging.next;
          if (!siguiente || paginas >= MAX_PAGINAS_POR_CUENTA || paginas >= paginasPorUsuario.get(usuario)) break;
          data = await get(siguiente, env.META_TOKEN);
        }
      } catch (error) {
        errores["@" + usuario] = limpiarMensaje(error);
      }
    }));
  }
  return { filas, revisadas: usuarios.length, publicaciones_revisadas: publicacionesRevisadas, max_paginas_por_cuenta: MAX_PAGINAS_POR_CUENTA, errores };
}

async function youtube(env, notas, desde) {
  if (!env.YT_KEY) throw new Error("Falta YT_KEY.");
  if (!env.YT_CANAL_ID) throw new Error("Falta YT_CANAL_ID para excluir los videos del canal institucional.");
  // Cada búsqueda consume cuota de YouTube: se limita a las 10 notas más recientes del período.
  const recientes = notas.filter(n => n.fecha >= desde).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
  const filas = [], errores = {};
  await Promise.all(recientes.map(async n => {
    try {
      const params = new URLSearchParams({ part: "snippet", type: "video", maxResults: "10", regionCode: "AR", relevanceLanguage: "es",
        q: n.titulo, publishedAfter: sumarDias(n.fecha, -1) + "T00:00:00Z", key: env.YT_KEY });
      const data = await get(`${YT}/search?${params}`);
      (data.items || []).forEach(item => {
        const s = item.snippet || {};
        if (env.YT_CANAL_ID && s.channelId === env.YT_CANAL_ID) return; // canal propio
        const fecha = String(s.publishedAt || "").slice(0, 10);
        if (!fecha || fecha < desde || fecha > sumarDias(n.fecha, 8)) return;
        const rel = notaRelacionada((s.title || "") + " " + (s.description || ""), fecha, [n]);
        if (rel) filas.push(fila("YouTube", s.channelTitle || s.channelId, "https://www.youtube.com/channel/" + s.channelId,
          "https://www.youtube.com/watch?v=" + item.id.videoId, fecha, s.title, rel));
      });
    } catch (error) {
      errores[n.titulo.slice(0, 60)] = limpiarMensaje(error);
    }
  }));
  return { filas, revisadas: recientes.length, errores };
}

// Publicaciones donde otras cuentas etiquetan a nuestra cuenta de Instagram (no hace falta que estén en la lista).
async function instagramEtiquetas(env, notas, desde) {
  if (!env.META_TOKEN || !env.IG_USER_ID) throw new Error("Faltan META_TOKEN o IG_USER_ID.");
  const data = await get(`${GRAPH}/${env.IG_USER_ID}/tags?fields=caption,permalink,timestamp,username&limit=50`, env.META_TOKEN);
  const filas = [];
  (data.data || []).forEach(m => {
    const fecha = String(m.timestamp || "").slice(0, 10);
    if (!fecha || fecha < desde || !m.permalink) return;
    const cuenta = m.username ? "@" + m.username : "Cuenta no informada";
    const cuentaUrl = m.username ? "https://www.instagram.com/" + m.username + "/" : null;
    const rel = notaRelacionada(m.caption, fecha, notas);
    filas.push(rel ? { ...fila("Instagram", cuenta, cuentaUrl, m.permalink, fecha, m.caption, rel), coincidencia: rel.motivo + "; etiquetó a nuestra cuenta" }
      : filaSinNota("Instagram", cuenta, cuentaUrl, m.permalink, fecha, m.caption, "etiquetó a nuestra cuenta; falta identificar la nota"));
  });
  return { filas, revisadas: (data.data || []).length, errores: {}, descripcion: "publicaciones que etiquetan a nuestra cuenta" };
}

// Hashtags locales: Instagram solo devuelve publicaciones de las últimas 24 horas y no informa la cuenta autora.
// Meta permite consultar hasta 30 hashtags distintos por semana; se usan pocos y siempre los mismos.
const HASHTAGS = ["justiciachubut", "poderjudicialchubut", "puertomadryn", "trelew", "comodororivadavia"];
async function instagramHashtags(env, notas, desde) {
  if (!env.META_TOKEN || !env.IG_USER_ID) throw new Error("Faltan META_TOKEN o IG_USER_ID.");
  const filas = [], errores = {};
  let revisadas = 0;
  await Promise.all(HASHTAGS.map(async tag => {
    try {
      const busqueda = await get(`${GRAPH}/ig_hashtag_search?user_id=${env.IG_USER_ID}&q=${encodeURIComponent(tag)}`, env.META_TOKEN);
      const id = busqueda.data && busqueda.data[0] && busqueda.data[0].id;
      if (!id) throw new Error("Instagram no devolvió el hashtag.");
      const data = await get(`${GRAPH}/${id}/recent_media?user_id=${env.IG_USER_ID}&fields=caption,permalink,timestamp&limit=50`, env.META_TOKEN);
      (data.data || []).forEach(m => {
        revisadas += 1;
        const fecha = String(m.timestamp || "").slice(0, 10);
        if (!fecha || fecha < desde || !m.permalink) return;
        const rel = notaRelacionada(m.caption, fecha, notas);
        if (rel) filas.push({ ...fila("Instagram", "Cuenta no informada (#" + tag + ")", null, m.permalink, fecha, m.caption, rel), coincidencia: rel.motivo + "; hashtag #" + tag });
      });
    } catch (error) {
      errores["#" + tag] = limpiarMensaje(error);
    }
  }));
  // Si todos los hashtags fallan, casi siempre es el permiso de Meta: se informa como error de la fuente.
  if (Object.keys(errores).length === HASHTAGS.length) throw new Error("Meta rechazó la búsqueda por hashtags: " + Object.values(errores)[0]);
  return { filas, revisadas, errores, descripcion: "publicaciones recientes en " + HASHTAGS.length + " hashtags" };
}

// Canales de YouTube de los medios de la lista: se leen sus últimos videos (cada consulta gasta 1 unidad de cuota).
async function youtubeCanales(env, notas, desde, n) {
  if (!env.YT_KEY) throw new Error("Falta YT_KEY.");
  const canales = lote(CANALES_YT, TAM_LOTE_YT, n);
  const filas = [], errores = {};
  let revisados = 0, publicacionesRevisadas = 0, canalesConLimite = 0;
  const MAX_PAGINAS_POR_CANAL = 3; // Hasta 75 videos por canal; se detiene antes si ya salió de la ventana.
  const canalDe = async ref => {
    const limpio = ref.replace(/^\//, "").replace(/^https?:\/\/(?:www\.)?youtube\.com\//i, "");
    const id = /^(?:channel\/)?(UC[\w-]{20,})$/.exec(limpio);
    let params;
    if (id) params = { id: id[1] };
    else if (/^user\//.test(limpio)) params = { forUsername: limpio.slice(5) };
    else {
      const handle = limpio.replace(/^(@|c\/|channel\/)/, "");
      if (!handle || handle.includes("/")) throw new Error("Formato de canal no compatible; se necesita @usuario, /user/nombre o /channel/UC…");
      params = { forHandle: "@" + handle };
    }
    const data = await get(`${YT}/channels?${new URLSearchParams({ part: "snippet,contentDetails", key: env.YT_KEY, ...params })}`);
    const item = data.items && data.items[0];
    if (!item) throw new Error("YouTube no encontró el canal con el identificador informado.");
    return item;
  };
  for (let i = 0; i < canales.length; i += 8) {
    await Promise.all(canales.slice(i, i + 8).map(async ref => {
      try {
        const canal = await canalDe(ref);
        if (env.YT_CANAL_ID && canal.id === env.YT_CANAL_ID) return; // canal propio
        const lista = canal.contentDetails && canal.contentDetails.relatedPlaylists && canal.contentDetails.relatedPlaylists.uploads;
        if (!lista) throw new Error("El canal no informa su lista de videos.");
        let pageToken = "";
        let pagina = 0;
        do {
          const query = { part: "snippet", playlistId: lista, maxResults: "25", key: env.YT_KEY };
          if (pageToken) query.pageToken = pageToken;
          const data = await get(`${YT}/playlistItems?${new URLSearchParams(query)}`);
          const items = data.items || [];
          publicacionesRevisadas += items.length;
          items.forEach(item => {
            const sn = item.snippet || {};
            const fecha = String(sn.publishedAt || "").slice(0, 10);
            const videoId = sn.resourceId && sn.resourceId.videoId;
            if (!fecha || fecha < desde || !videoId) return;
            const rel = notaRelacionada((sn.title || "") + " " + (sn.description || ""), fecha, notas);
            if (rel) filas.push({ ...fila("YouTube", canal.snippet.title || ref, "https://www.youtube.com/channel/" + canal.id,
              "https://www.youtube.com/watch?v=" + videoId, fecha, sn.title, rel), cuenta_ref: ref });
          });
          const fechas = items.map(item => String((item.snippet || {}).publishedAt || "").slice(0, 10)).filter(Boolean);
          const fechaMasAntigua = fechas.length ? fechas.sort()[0] : "";
          pagina += 1;
          pageToken = data.nextPageToken || "";
          if (!items.length || (fechaMasAntigua && fechaMasAntigua < desde)) break;
          if (pagina >= MAX_PAGINAS_POR_CANAL) {
            if (pageToken) canalesConLimite += 1;
            break;
          }
        } while (pageToken);
        revisados += 1;
      } catch (error) {
        errores[ref] = limpiarMensaje(error);
      }
    }));
  }
  return {
    filas, revisadas: revisados, publicaciones_revisadas: publicacionesRevisadas,
    canales_con_limite: canalesConLimite, max_paginas_por_canal: MAX_PAGINAS_POR_CANAL,
    errores, descripcion: "canales de medios revisados"
  };
}


function decodeXml(value) {
  return String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ").trim();
}
function xmlTag(item, tag) {
  const match = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i").exec(item);
  return match ? decodeXml(match[1]) : "";
}
function urlPostFacebook(value) {
  try {
    const u = new URL(value);
    if (!/(^|\.)facebook\.com$/i.test(u.hostname)) return false;
    return /\/(?:posts|permalink\.php|share\/(?:p|r)|reel|reels|videos|watch|photo|photos|story\.php|groups\/[^/]+\/posts)\b/i.test(u.pathname);
  } catch { return false; }
}

// Busca en el índice público gratuito de Bing los posteos de Facebook que coinciden
// con los títulos de las notas recientes. No requiere token ni servicio pago y no
// equivale a leer todo Facebook: solo encuentra contenido público que el buscador indexó.
async function facebookPublico(env, notas, desde, n) {
  const recientes = notas.filter(nota => nota.fecha >= desde)
    .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
  const seleccionadas = lote(recientes, 5, n);
  const filas = [], errores = {};
  let resultadosRevisados = 0, enlacesPosteo = 0;
  for (let i = 0; i < seleccionadas.length; i += 5) {
    await Promise.all(seleccionadas.slice(i, i + 5).map(async nota => {
      try {
        const consulta = 'site:facebook.com "' + String(nota.titulo || "").replace(/["<>]/g, " ").trim() + '"';
        const url = "https://www.bing.com/search?" + new URLSearchParams({ format: "rss", q: consulta, setlang: "es-AR" });
        const response = await fetch(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "JusNoticiasRadar/1.0 (busqueda de publicaciones publicas)" } });
        if (!response.ok) throw new Error("Bing RSS respondió HTTP " + response.status);
        const xml = await response.text();
        if (!/<(?:rss|feed)\b/i.test(xml) || /captcha|unusual traffic|verify you are human/i.test(xml.slice(0, 3000))) {
          throw new Error("El buscador no devolvió un RSS utilizable.");
        }
        const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
        resultadosRevisados += items.length;
        items.forEach(item => {
          const link = xmlTag(item, "link");
          const titulo = xmlTag(item, "title");
          const descripcion = xmlTag(item, "description");
          const fechaRaw = xmlTag(item, "pubDate");
          // Una fecha mal formada en un resultado no debe tirar abajo la búsqueda de toda la nota.
          const fechaD = fechaRaw ? new Date(fechaRaw) : null;
          const fecha = fechaD && !Number.isNaN(fechaD.getTime()) ? fechaD.toISOString().slice(0, 10) : "";
          if (!fecha || fecha < desde || fecha < sumarDias(nota.fecha, -1) || fecha > sumarDias(nota.fecha, 8) || !urlPostFacebook(link)) return;
          const rel = notaRelacionada(titulo + " " + descripcion + " " + link, fecha, [nota]);
          if (!rel) return;
          enlacesPosteo += 1;
          const partes = new URL(link).pathname.split("/").filter(Boolean);
          const usuario = partes[0] && !/^(posts|share|reel|reels|videos|watch|permalink\.php|photo|photos|story\.php|groups)$/i.test(partes[0]) ? partes[0] : "Página pública de Facebook";
          const cuentaUrl = usuario === "Página pública de Facebook" ? "https://www.facebook.com/" : "https://www.facebook.com/" + usuario + "/";
          filas.push(fila("Facebook", usuario, cuentaUrl, link, fecha, titulo + (descripcion ? " — " + descripcion : ""), rel));
        });
      } catch (error) {
        errores[String(nota.titulo || "nota").slice(0, 60)] = limpiarMensaje(error);
      }
    }));
  }
  return {
    filas, revisadas: seleccionadas.length, publicaciones_revisadas: resultadosRevisados,
    publicaciones_facebook_encontradas: enlacesPosteo, errores,
    descripcion: "búsqueda gratuita en Bing de publicaciones públicas de Facebook indexadas; no cubre publicaciones privadas ni todo Facebook"
  };
}

const FUENTES = [
  // Primero la dirigida: si Meta corta por límite, lo más probable ya se consultó.
  { id: "ig-dirigida", nombre: "Instagram (medios que ya publicaron la nota)", fn: instagramDirigida, lotes: 1 },
  { id: "instagram", nombre: "Instagram", fn: instagram, lotes: Math.max(1, Math.ceil(USUARIOS_IG.length / TAM_LOTE_IG)) },
  { id: "ig-etiquetas", nombre: "Instagram (etiquetas)", fn: instagramEtiquetas, lotes: 1 },
  // Meta exige aprobar «Instagram Public Content Access» para buscar hashtags (respuesta del 26/10/2026).
  // Queda apagada hasta tener esa aprobación: se activa con la variable IG_HASHTAGS=1 en Cloudflare.
  { id: "ig-hashtags", nombre: "Instagram (hashtags)", fn: instagramHashtags, lotes: 1, requiere: "IG_HASHTAGS" },
  { id: "facebook-publico", nombre: "Facebook (búsqueda pública)", fn: facebookPublico, lotes: 2 },
  { id: "youtube", nombre: "YouTube", fn: youtube, lotes: 1 },
  { id: "yt-canales", nombre: "YouTube (canales de medios)", fn: youtubeCanales, lotes: Math.max(1, Math.ceil(CANALES_YT.length / TAM_LOTE_YT)) }
];
const NO_DISPONIBLES = {
  X: "La API de X para leer publicaciones de terceros es paga.",
  TikTok: "La API conectada permite consultar la cuenta autorizada, no buscar publicaciones de terceros de forma general; la búsqueda pública ampliada requiere acceso de investigación aprobado."
};

const activas = env => FUENTES.filter(f => !f.requiere || env[f.requiere] === "1");
const noDisponibles = env => env.IG_HASHTAGS === "1" ? NO_DISPONIBLES : {
  ...NO_DISPONIBLES,
  "Instagram (hashtags)": "Meta exige aprobar el permiso «Instagram Public Content Access» (revisión de la app) para buscar por hashtags."
};

// Uso: ?plan=1 devuelve las fuentes y sus tandas; ?fuente=ID&lote=N consulta una sola tanda.
// Sin parámetros consulta todo junto (puede superar el límite de Cloudflare con listas largas).
export async function onRequestGet({ env, request }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = sumarDias(hoy, -30);
  const params = request ? new URL(request.url).searchParams : new URLSearchParams();
  if (params.get("plan")) {
    return json({ desde, fuentes: activas(env).map(({ id, nombre, lotes }) => ({ id, nombre, lotes })), no_disponibles: noDisponibles(env) });
  }
  // Se conservan todas las notas para resolver enlaces directos aunque la nota sea antigua.
  // La comparación por texto sigue acotada por fecha dentro de notaRelacionada().
  const notas = notasOficiales;
  const pedida = params.get("fuente");
  const n = params.has("lote") ? Math.max(0, parseInt(params.get("lote"), 10) || 0) : null;
  const elegidas = pedida ? activas(env).filter(f => f.id === pedida) : activas(env);
  if (pedida && !elegidas.length) return json({ error: "Fuente desconocida." }, 400);
  const resultado = { actualizado: new Date().toISOString(), desde, filas: [], fuentes: {} };
  await Promise.all(elegidas.map(async ({ nombre, fn }) => {
    try {
      const r = await fn(env, notas, desde, n);
      resultado.filas.push(...r.filas);
      resultado.fuentes[nombre] = { estado: "ok", revisadas: r.revisadas, errores: r.errores, descripcion: r.descripcion };
      if (r.publicaciones_revisadas != null) resultado.fuentes[nombre].publicaciones_revisadas = r.publicaciones_revisadas;
    } catch (error) {
      resultado.fuentes[nombre] = { estado: "error", error: limpiarMensaje(error) };
    }
  }));
  const porNota = mediosQuePublicaron();
  resultado.filas.forEach(f => marcarMedioQuePublico(f, porNota));
  const vistos = new Set();
  resultado.filas = resultado.filas.filter(f => !vistos.has(f.publicacion_url) && vistos.add(f.publicacion_url))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  resultado.no_disponibles = noDisponibles(env);
  return json(resultado);
}
