// Cloudflare Pages Function: PRUEBA de clasificación de comentarios con Gemini Decision 1.
// Lee los comentarios de las últimas publicaciones de Facebook de JusNoticias y le hace
// tres preguntas cerradas a cada uno. No guarda nada ni toca data/*.json: solo muestra.
// Uso: /api/comentarios-prueba  (agregar ?formato=json para JSON). Abierta a pedido de Ignacio
// (12/11/2026, es una prueba); el resultado se guarda 10 minutos en la caché para no repetir consultas.

const GRAPH = "https://graph.facebook.com/v26.0";
const DECISIONS = "https://generativelanguage.googleapis.com/v1beta/decisions";
const DIAS = 30;
const MAX_PUBLICACIONES = 100;
const MAX_COMENTARIOS_POR_PUBLICACION = 25;
const MAX_COMENTARIOS = 150;
const EN_PARALELO = 5;
const UMBRAL_DUDA = 0.6;

export const PREGUNTAS = {
  tono: {
    type: "choice",
    instructions: "¿Qué tono tiene el comentario hacia la noticia o hacia la Justicia?",
    criteria: {
      positivo: "Aprueba, agradece, felicita o apoya.",
      neutro: "Informa, pregunta o comenta sin tomar postura.",
      negativo: "Critica, se queja, se enoja o descalifica."
    }
  },
  tema: {
    type: "choice",
    instructions: "¿De qué habla principalmente el comentario?",
    criteria: {
      decision_judicial: "La resolución, condena, absolución o pena del caso.",
      demoras: "La lentitud o los tiempos de la Justicia.",
      independencia: "La independencia o imparcialidad de jueces y fiscales: favores, compromisos políticos o personales, presiones del poder.",
      atencion: "La atención o el trato de la Justicia a las personas.",
      la_nota: "La nota o la publicación en sí (cómo está escrita, la foto, un error).",
      otro: "Cualquier otra cosa: saludos, etiquetas a otras personas, temas ajenos."
    }
  },
  revisar: {
    type: "noul",
    instructions: "¿Alguien del equipo debería leer este comentario? Sí si contiene insultos o amenazas, datos personales, acusaciones o insinuaciones contra personas mencionadas con nombre o apellido, o una consulta o pedido de ayuda que merece respuesta."
  }
};

const ETIQUETAS = {
  positivo: "🟢 Positivo", neutro: "⚪ Neutro", negativo: "🔴 Negativo",
  decision_judicial: "Decisión judicial", demoras: "Demoras", independencia: "Independencia de jueces y fiscales", atencion: "Atención",
  la_nota: "La nota", otro: "Otro"
};

function limpiar(error) {
  const msg = error instanceof Error ? error.message : String(error || "");
  return (msg || "Error no identificado.")
    .replace(/access_token=[^&\s"']+/gi, "access_token=[omitido]")
    .replace(/\bEA[A-Za-z0-9]{20,}\b/g, "[token omitido]")
    .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, "[clave omitida]")
    .slice(0, 300);
}

async function meta(url, token) {
  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  let p;
  try { p = await r.json(); } catch { throw new Error("HTTP " + r.status); }
  if (!r.ok || p.error) throw new Error((p.error && p.error.message) || "HTTP " + r.status);
  return p;
}

async function tokenPagina(env, id) {
  if (env.FB_PAGE_TOKEN) return env.FB_PAGE_TOKEN;
  if (!env.META_TOKEN) throw new Error("Falta FB_PAGE_TOKEN o META_TOKEN.");
  const p = await meta(`${GRAPH}/${id}?fields=access_token`, env.META_TOKEN);
  if (!p.access_token) throw new Error("Meta no devolvió un token de página.");
  return p.access_token;
}

// Junta los comentarios de las últimas publicaciones. Sin nombres de quien comenta.
export async function leerComentarios(env) {
  const id = env.FB_PAGE_ID;
  if (!id) throw new Error("Falta FB_PAGE_ID.");
  const token = await tokenPagina(env, id);
  const desde = new Date(Date.now() - DIAS * 86400000).toISOString().slice(0, 10);
  const lista = [];
  let url = `${GRAPH}/${id}/posts?fields=message,permalink_url,created_time,comments.summary(total_count).limit(0)&since=${desde}&limit=50`;
  for (let i = 0; url && i < 5 && lista.length < MAX_PUBLICACIONES; i++) {
    const p = await meta(url, token);
    lista.push(...(p.data || []));
    url = p.paging && p.paging.next;
  }
  const salida = [];
  for (const post of lista.slice(0, MAX_PUBLICACIONES)) {
    // Solo se piden los comentarios de las publicaciones que tienen alguno.
    if (post.comments && post.comments.summary && post.comments.summary.total_count === 0) {
      salida.push({ publicacion: "", url: post.permalink_url || null, fecha: (post.created_time || "").slice(0, 10), comentarios: [], error: null });
      continue;
    }
    let comentarios = [];
    let error = null;
    try {
      const c = await meta(`${GRAPH}/${post.id}/comments?fields=message,created_time&filter=stream&limit=${MAX_COMENTARIOS_POR_PUBLICACION}`, token);
      comentarios = (c.data || []).map(x => ({ texto: (x.message || "").trim(), fecha: x.created_time || null })).filter(x => x.texto);
    } catch (e) {
      error = limpiar(e);
    }
    salida.push({
      publicacion: (post.message || "").replace(/\s+/g, " ").trim().slice(0, 200),
      url: post.permalink_url || null,
      fecha: (post.created_time || "").slice(0, 10),
      comentarios,
      error
    });
  }
  return salida;
}

export async function clasificar(texto, publicacion, apiKey) {
  const r = await fetch(DECISIONS, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-decision-1",
      input: `Publicación de JusNoticias (Poder Judicial del Chubut): ${publicacion}\n\nComentario de un lector: ${texto}`,
      questions: PREGUNTAS
    })
  });
  let p;
  try { p = await r.json(); } catch { throw new Error("Gemini HTTP " + r.status); }
  if (!r.ok || p.error) throw new Error("Gemini: " + ((p.error && p.error.message) || "HTTP " + r.status));
  const a = p.answers || {};
  return {
    tono: a.tono ? { valor: a.tono.choice, seguridad: a.tono.confidence } : null,
    tema: a.tema ? { valor: a.tema.choice, seguridad: a.tema.confidence } : null,
    revisar: a.revisar ? { prob: a.revisar.noul, seguridad: a.revisar.confidence } : null
  };
}

export async function armarResultado(env) {
  if (!env.GEMINI_API_KEY) throw new Error("Falta configurar GEMINI_API_KEY.");
  const publicaciones = await leerComentarios(env);
  let usados = 0;
  for (const pub of publicaciones) {
    pub.comentarios = pub.comentarios.slice(0, Math.max(0, MAX_COMENTARIOS - usados));
    usados += pub.comentarios.length;
  }
  const tareas = publicaciones.flatMap(pub => pub.comentarios.map(c => ({ c, pub })));
  for (let i = 0; i < tareas.length; i += EN_PARALELO) {
    await Promise.all(tareas.slice(i, i + EN_PARALELO).map(async ({ c, pub }) => {
      try { c.decision = await clasificar(c.texto, pub.publicacion, env.GEMINI_API_KEY); }
      catch (e) { c.error = limpiar(e); }
    }));
  }
  return { generado: new Date().toISOString(), dias: DIAS, publicaciones };
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const pct = n => (typeof n === "number" ? Math.round(n * 100) + "%" : "—");

function celda(d) {
  if (!d) return "—";
  const duda = typeof d.seguridad === "number" && d.seguridad < UMBRAL_DUDA ? " ❓" : "";
  return `${esc(ETIQUETAS[d.valor] || d.valor)} <small>(${pct(d.seguridad)})</small>${duda}`;
}

export function html(res) {
  const todos = res.publicaciones.flatMap(p => p.comentarios.filter(c => c.decision));
  const cuenta = k => todos.filter(c => c.decision.tono && c.decision.tono.valor === k).length;
  const total = todos.length || 1;
  const aRevisar = todos.filter(c => c.decision.revisar && c.decision.revisar.prob >= 0.5).length;
  const conComentarios = res.publicaciones.filter(p => p.comentarios.length || p.error);
  const bloques = conComentarios.map(p => {
    const filas = p.comentarios.map(c => c.error
      ? `<tr><td>${esc(c.texto)}</td><td colspan="3">Error: ${esc(c.error)}</td></tr>`
      : `<tr${c.decision.revisar && c.decision.revisar.prob >= 0.5 ? ' class="ojo"' : ""}><td>${esc(c.texto)}</td><td>${celda(c.decision.tono)}</td><td>${celda(c.decision.tema)}</td><td>${c.decision.revisar && c.decision.revisar.prob >= 0.5 ? "⚠️ Sí" : "No"} <small>(${pct(c.decision.revisar && c.decision.revisar.prob)})</small></td></tr>`).join("");
    const cuerpo = p.error ? `<p>No se pudieron leer los comentarios: ${esc(p.error)}</p>`
      : p.comentarios.length ? `<table><tr><th>Comentario</th><th>Tono</th><th>Tema</th><th>¿Mirarlo?</th></tr>${filas}</table>`
      : `<p class="gris">Sin comentarios.</p>`;
    return `<section><h3>${esc(p.fecha)} — ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.publicacion || "(sin texto)")}</a>` : esc(p.publicacion)}</h3>${cuerpo}</section>`;
  }).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Prueba: comentarios con Gemini Decision 1</title>
<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:1rem auto;padding:0 1rem;color:#222}table{width:100%;border-collapse:collapse;margin:.5rem 0 1.5rem}th,td{border-bottom:1px solid #ddd;padding:.4rem;text-align:left;vertical-align:top;font-size:.92rem}small,.gris{color:#777}.ojo{background:#fff4e0}.resumen{display:flex;gap:1rem;flex-wrap:wrap;font-size:1.05rem}.resumen div{background:#f4f4f4;padding:.6rem .9rem;border-radius:8px}h3{font-size:1rem;margin-top:1.5rem}</style></head><body>
<h2>Prueba: comentarios de Facebook clasificados con Gemini Decision 1</h2>
<p class="gris">Solo de prueba: no guarda nada ni cambia el tablero. ❓ = el modelo está poco seguro (menos de ${Math.round(UMBRAL_DUDA * 100)}%).</p>
<p>Últimos ${res.dias || 30} días: <b>${res.publicaciones.length}</b> publicaciones, <b>${conComentarios.length}</b> con comentarios. Solo se muestran las que tienen.</p>
<div class="resumen"><div>Comentarios: <b>${todos.length}</b></div><div>🟢 ${pct(cuenta("positivo") / total)}</div><div>⚪ ${pct(cuenta("neutro") / total)}</div><div>🔴 ${pct(cuenta("negativo") / total)}</div><div>⚠️ Para mirar: <b>${aRevisar}</b></div></div>
${bloques}</body></html>`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const comoJson = url.searchParams.get("formato") === "json";
  const headers = (t, cache = "s-maxage=600") => ({ "Content-Type": t + "; charset=utf-8", "Cache-Control": cache, "X-Robots-Tag": "noindex" });
  try {
    const res = await armarResultado(env);
    return comoJson
      ? new Response(JSON.stringify(res, null, 2), { headers: headers("application/json") })
      : new Response(html(res), { headers: headers("text/html") });
  } catch (e) {
    return new Response("No se pudo armar la prueba: " + limpiar(e), { status: 502, headers: headers("text/plain", "no-store") });
  }
}
