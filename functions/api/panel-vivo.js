import { onRequestGet as consultarRedes } from "./redes.js";
// Cloudflare Pages Function: contadores en vivo de las redes propias para el panel de la portada.
// Las credenciales quedan en el servidor (las usa redes.js). Lo consultado no se escribe en
// data/redes2.json ni en data/canales.json: solo se guarda en una caché compartida de 5 minutos,
// para no gastar la cuota de Meta y YouTube con cada visita.
const CACHE_SEGUNDOS = 300;
const CLAVE = "panel-vivo:v1";
const CLAVE_ULTIMO = "panel-vivo:ultimo-ok";
const DIAS = 7;
// Se consultan 28 días para que el alcance de Instagram cubra la ventana completa de la cuenta;
// las publicaciones y sus interacciones se resumen solo de los últimos 7 días.
const DIAS_CONSULTA = 28;
// X no se consulta: su API pide créditos y la consulta siempre falla.
const REDES = ["Facebook", "Instagram", "YouTube", "TikTok"];

const responder = (cuerpo, origen) => new Response(JSON.stringify({ ...cuerpo, cache: origen }), {
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": `public, max-age=60, s-maxage=${CACHE_SEGUNDOS}`
  }
});

const sumar = (filas, campos) => {
  // Si ninguna fila trae el dato, no es cero: es «sin dato».
  let total = 0, hay = false;
  for (const fila of filas) for (const campo of campos) {
    if (typeof fila[campo] === "number") { total += fila[campo]; hay = true; }
  }
  return hay ? total : null;
};

const interacciones = fila => {
  const valores = [fila.me_gusta, fila.comentarios, fila.compartidos].filter(v => typeof v === "number");
  return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
};

const publicacion = fila => ({
  red: fila.red, cuenta: fila.cuenta, fecha: fila.fecha, texto: fila.resumen || fila.texto || "",
  interacciones: interacciones(fila), vistas: typeof fila.vistas === "number" ? fila.vistas : null
});

export function resumir(datos, desde) {
  const cuentas = [];
  const errores = datos.errores || {};
  const redes = {};
  for (const [red, valor] of Object.entries(datos.redes || {})) {
    redes[red] = { ...valor, filas: (valor.filas || []).filter(f => !desde || !f.fecha || f.fecha >= desde) };
  }
  const fb = redes.Facebook;
  if (fb && Array.isArray(fb.paginas)) {
    for (const pagina of fb.paginas) {
      const filas = (fb.filas || []).filter(f => f.cuenta === pagina.nombre);
      const sinPublicaciones = Boolean(pagina.error || pagina.publicacionesError);
      cuentas.push({
        red: "Facebook", cuenta: pagina.nombre || ("Página " + pagina.id), ok: !pagina.error,
        error: pagina.error || null,
        seguidores: typeof pagina.seguidores === "number" ? pagina.seguidores : null,
        publicaciones: sinPublicaciones ? null : filas.length,
        interacciones: sinPublicaciones ? null : (filas.length ? sumar(filas, ["me_gusta", "comentarios", "compartidos"]) : null),
        vistas: null
      });
    }
  } else {
    cuentas.push({ red: "Facebook", cuenta: "Facebook", ok: false, error: errores.Facebook || "Sin respuesta." });
  }
  const ig = redes.Instagram;
  cuentas.push(ig ? {
    red: "Instagram", cuenta: "@jus_chubut", ok: true, error: null,
    seguidores: ig.seguidores ?? null, publicaciones: (ig.filas || []).length,
    interacciones: (ig.filas || []).length ? sumar(ig.filas, ["me_gusta", "comentarios"]) : null,
    vistas: null,
    // Alcance de la CUENTA en la ventana de Insights (hasta 28 días), no por publicación.
    alcance: ig.insights && typeof ig.insights.reach === "number" ? ig.insights.reach : null,
    alcanceDesde: ig.insightsDesde || null, alcanceHasta: ig.insightsHasta || null
  } : { red: "Instagram", cuenta: "@jus_chubut", ok: false, error: errores.Instagram || "Sin respuesta." });
  const yt = redes.YouTube;
  cuentas.push(yt ? {
    red: "YouTube", cuenta: yt.cuentaNombre || "YouTube", ok: true, error: null,
    seguidores: yt.seguidores ?? null, publicaciones: (yt.filas || []).length,
    interacciones: (yt.filas || []).length ? sumar(yt.filas, ["me_gusta", "comentarios"]) : null,
    vistas: (yt.filas || []).length ? sumar(yt.filas, ["vistas"]) : null
  } : { red: "YouTube", cuenta: "YouTube", ok: false, error: errores.YouTube || "Sin respuesta." });
  const tt = redes.TikTok;
  cuentas.push(tt ? {
    red: "TikTok", cuenta: "@juschubut", ok: true, error: null,
    seguidores: tt.seguidores ?? null, publicaciones: (tt.filas || []).length,
    interacciones: (tt.filas || []).length ? sumar(tt.filas, ["me_gusta", "comentarios", "compartidos"]) : null,
    vistas: (tt.filas || []).length ? sumar(tt.filas, ["vistas"]) : null
  } : { red: "TikTok", cuenta: "@juschubut", ok: false, error: errores.TikTok || "Sin respuesta." });
  cuentas.push({ red: "X", cuenta: "@Jus_Noticias", ok: false, error: "La API de X pide créditos: no se consulta en vivo." });
  const publicaciones = REDES.flatMap(red => (redes[red] && redes[red].filas) || []).map(publicacion)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return { consultado: datos.actualizado || new Date().toISOString(), desde, dias: DIAS, cuentas, publicaciones };
}

async function leerCache(env) {
  try {
    if (env.PANEL_KV) {
      const guardado = await env.PANEL_KV.get(CLAVE, "json");
      if (guardado) return { datos: guardado, origen: "kv" };
    }
  } catch { /* la caché nunca debe romper el panel */ }
  try {
    const r = await caches.default.match(new Request("https://panel-vivo.cache/" + CLAVE));
    if (r) return { datos: await r.json(), origen: "cache" };
  } catch { /* Cache API no disponible */ }
  return null;
}

async function guardarCache(env, datos, waitUntil) {
  const tareas = [];
  if (env.PANEL_KV) {
    tareas.push(env.PANEL_KV.put(CLAVE, JSON.stringify(datos), { expirationTtl: CACHE_SEGUNDOS }).catch(() => {}));
    // Último dato bueno de cada cuenta, sin vencimiento: se muestra si una red deja de responder.
    tareas.push((async () => {
      const previo = (await env.PANEL_KV.get(CLAVE_ULTIMO, "json")) || {};
      for (const c of datos.cuentas) if (c.ok) previo[c.red + "|" + c.cuenta] = datos.consultado;
      await env.PANEL_KV.put(CLAVE_ULTIMO, JSON.stringify(previo));
    })().catch(() => {}));
  }
  tareas.push(caches.default.put(new Request("https://panel-vivo.cache/" + CLAVE), new Response(JSON.stringify(datos), {
    headers: { "Content-Type": "application/json", "Cache-Control": `s-maxage=${CACHE_SEGUNDOS}` }
  })).catch(() => {}));
  const todo = Promise.all(tareas);
  if (waitUntil) waitUntil(todo); else await todo;
}

async function ultimosOk(env) {
  try { return env.PANEL_KV ? ((await env.PANEL_KV.get(CLAVE_ULTIMO, "json")) || {}) : {}; } catch { return {}; }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const enCache = await leerCache(env);
  if (enCache) return responder({ ...enCache.datos, ultimoOk: await ultimosOk(env) }, enCache.origen);
  const hoy = new Date();
  const dia = n => new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - n)).toISOString().slice(0, 10);
  const desde = dia(DIAS - 1);
  const desdeConsulta = dia(DIAS_CONSULTA - 1);
  let datos;
  try {
    const consulta = new Request(new URL(`/api/redes?desde=${desdeConsulta}&redes=${REDES.join(",")}`, request.url).toString());
    const respuesta = await consultarRedes({ request: consulta, env });
    datos = resumir(await respuesta.json(), desde);
  } catch (error) {
    // Ni siquiera se pudo consultar: todas las cuentas quedan «sin dato en vivo».
    datos = resumir({ redes: {}, errores: Object.fromEntries(REDES.map(r => [r, "No se pudo consultar."])) }, desde);
  }
  await guardarCache(env, datos, context.waitUntil ? p => context.waitUntil(p) : null);
  return responder({ ...datos, ultimoOk: await ultimosOk(env) }, "consulta");
}
