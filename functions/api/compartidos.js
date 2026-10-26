// Cloudflare Pages Function: busca publicaciones de OTRAS cuentas que compartan notas de Juschubut Noticias.
// Instagram: lee las publicaciones recientes de las cuentas de la lista (business_discovery de Meta).
// YouTube: busca por título los videos de otros canales publicados después de cada nota.
// Facebook y TikTok quedan como búsquedas asistidas mientras no haya permisos oficiales para consultar publicaciones de terceros.
import cuentasMonitoreo from "../../data/cuentas_monitoreo.json";
import notasOficiales from "../../data/notas2.json";

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
    if (exacta) return { nota: exacta, comunes: raices(exacta.titulo).size, motivo: "enlace directo a la nota" };
  }
  const propias = raices(texto);
  const textoNormalizado = normalizarTexto(texto);
  let mejor = null;
  for (const n of notas) {
    if (!(sumarDias(n.fecha, -1) <= fecha && fecha <= sumarDias(n.fecha, 8))) continue;
    const tituloNormalizado = normalizarTexto(n.titulo);
    // Si el título completo aparece en el título o descripción del video/post, es una señal fuerte.
    if (tituloNormalizado.length >= 18 && textoNormalizado.includes(tituloNormalizado)) {
      return { nota: n, comunes: raices(n.titulo).size, motivo: "título de la nota identificado" };
    }
    const raicesTitulo = raices(n.titulo);
    const comunes = [...raicesTitulo].filter(r => propias.has(r)).length;
    if (!mejor || comunes > mejor.comunes) mejor = { nota: n, comunes, totalRaices: raicesTitulo.size };
  }
  // Títulos cortos suelen tener menos de tres palabras distintivas; usar un umbral adaptativo
  // evita descartar coincidencias claras solo por tener dos raíces útiles.
  const minimo = mejor ? Math.min(3, Math.max(2, mejor.totalRaices)) : 3;
  if (mejor && mejor.comunes >= minimo) return { ...mejor, motivo: mejor.comunes + " palabras del título en común" };
  if (enlace && mejor && mejor.comunes >= 1) return { ...mejor, motivo: "enlaza a jusnoticias" };
  return null;
}

const fila = (red, cuenta, cuentaUrl, publicacionUrl, fecha, texto, rel) => ({
  red, cuenta, cuenta_url: cuentaUrl, publicacion_url: publicacionUrl, fecha,
  texto: String(texto || "").replace(/\s+/g, " ").trim().slice(0, 140),
  nota_id: rel.nota.id, nota_titulo: rel.nota.titulo, nota_url: NOTA_URL(rel.nota.id), coincidencia: rel.motivo
});

async function instagram(env, notas, desde) {
  if (!env.META_TOKEN || !env.IG_USER_ID) throw new Error("Faltan META_TOKEN o IG_USER_ID.");
  const usuarios = [...new Set(cuentasMonitoreo.cuentas
    .filter(c => c.red === "Instagram" && /^@[\w.]+$/.test(c.cuenta || "") && !/^Dudosa/.test(c.estado || ""))
    .map(c => c.cuenta.slice(1)))];
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
          if (!siguiente || paginas >= MAX_PAGINAS_POR_CUENTA) break;
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

export async function onRequestGet({ env }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = sumarDias(hoy, -30);
  // Se conservan todas las notas para resolver enlaces directos aunque la nota sea antigua.
  // La comparación por texto sigue acotada por fecha dentro de notaRelacionada().
  const notas = notasOficiales;
  const fuentes = { Instagram: instagram, YouTube: youtube };
  const resultado = { actualizado: new Date().toISOString(), desde, filas: [], fuentes: {} };
  await Promise.all(Object.entries(fuentes).map(async ([red, fn]) => {
    try {
      const r = await fn(env, notas, desde);
      resultado.filas.push(...r.filas);
      resultado.fuentes[red] = { estado: "ok", revisadas: r.revisadas, errores: r.errores };
    } catch (error) {
      resultado.fuentes[red] = { estado: "error", error: limpiarMensaje(error) };
    }
  }));
  const vistos = new Set();
  resultado.filas = resultado.filas.filter(f => !vistos.has(f.publicacion_url) && vistos.add(f.publicacion_url))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  resultado.no_disponibles = {
    Facebook: "No está habilitado el permiso de Meta necesario para buscar publicaciones públicas de otras páginas.",
    TikTok: "La API conectada permite consultar la cuenta autorizada, no buscar publicaciones de terceros de forma general; la búsqueda pública ampliada requiere acceso de investigación aprobado."
  };
  return json(resultado);
}
