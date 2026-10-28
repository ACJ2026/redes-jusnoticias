// Posts de X (@Jus_Noticias) cargados a mano desde el tablero. La API de X cobra por consulta,
// así que lo publicado en X se registra con este formulario. Usa la misma base (REVISIONES_DB)
// y la misma clave (REVISIONES_CLAVE) que la revisión manual de publicaciones.
// Lectura libre; para guardar hace falta la clave. Una cifra vacía queda «sin dato», nunca 0.
const MAX_BODY = 8192;
const CUENTA = "jus_noticias";
const CREAR = `CREATE TABLE IF NOT EXISTS x_publicaciones_manual (
  id TEXT PRIMARY KEY, url TEXT NOT NULL, fecha TEXT NOT NULL, texto TEXT,
  me_gusta INTEGER, comentarios INTEGER, compartidos INTEGER, vistas INTEGER,
  cargado_por TEXT, actualizado TEXT NOT NULL
)`;

const respuesta = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin"
  }
});

function claveCorrecta(value, expected) {
  if (!value || !expected) return false;
  const a = new TextEncoder().encode(value);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

// Enlace de un post de la cuenta: https://x.com/Jus_Noticias/status/123… (también twitter.com).
export function leerEnlace(valor) {
  let url;
  try { url = new URL(String(valor || "").trim()); } catch { throw new Error("El enlace no es válido."); }
  const host = url.hostname.toLowerCase().replace(/^(www\.|mobile\.)/, "");
  if (!["x.com", "twitter.com"].includes(host)) throw new Error("El enlace tiene que ser de x.com.");
  const m = url.pathname.match(/^\/([^/]+)\/status\/(\d{5,25})/);
  if (!m) throw new Error("El enlace tiene que ser de un post (…/status/número).");
  if (m[1].toLowerCase() !== CUENTA) throw new Error("El post tiene que ser de la cuenta @Jus_Noticias.");
  return { id: m[2], url: `https://x.com/Jus_Noticias/status/${m[2]}` };
}

export function leerCifra(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const n = Number(String(valor).replace(/\./g, "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new Error("Las cifras tienen que ser números (o quedar vacías).");
  return Math.round(n);
}

export function fila(r) {
  return {
    red: "X", cuenta: "@Jus_Noticias", fecha: r.fecha, texto: r.texto || "", nota_id: null,
    me_gusta: r.me_gusta, comentarios: r.comentarios, compartidos: r.compartidos, vistas: r.vistas,
    propia: "Sí", key: "x-" + r.id, url: r.url, carga: "manual"
  };
}

export async function onRequestGet({ env }) {
  if (!env.REVISIONES_DB) return respuesta({ error: "La carga manual de X no está configurada todavía." }, 503);
  try {
    await env.REVISIONES_DB.prepare(CREAR).run();
    const { results = [] } = await env.REVISIONES_DB.prepare(
      "SELECT id, url, fecha, texto, me_gusta, comentarios, compartidos, vistas FROM x_publicaciones_manual ORDER BY fecha DESC"
    ).all();
    return respuesta({ filas: results.map(fila) });
  } catch {
    return respuesta({ error: "No se pudo leer la carga manual de X." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.REVISIONES_DB || !env.REVISIONES_CLAVE) return respuesta({ error: "La carga manual de X no está configurada en el servidor." }, 503);
  if (!sameOrigin(request)) return respuesta({ error: "Solicitud de otro origen rechazada." }, 403);
  const auth = request.headers.get("Authorization") || "";
  if (!claveCorrecta(auth.startsWith("Bearer ") ? auth.slice(7) : "", env.REVISIONES_CLAVE)) return respuesta({ error: "Clave incorrecta." }, 401);
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY) return respuesta({ error: "La solicitud es demasiado grande." }, 413);
  let body;
  try { body = await request.json(); } catch { return respuesta({ error: "La solicitud no contiene datos válidos." }, 400); }
  let datos;
  try {
    const { id, url } = leerEnlace(body.url);
    const fecha = String(body.fecha || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Falta la fecha del post.");
    if (String(body.texto || "").trim().length < 8) throw new Error("Falta el comienzo del texto del post (sirve para no cargarlo dos veces).");
    datos = {
      id, url, fecha, texto: String(body.texto || "").trim().slice(0, 280),
      me_gusta: leerCifra(body.me_gusta), comentarios: leerCifra(body.comentarios),
      compartidos: leerCifra(body.compartidos), vistas: leerCifra(body.vistas)
    };
  } catch (error) { return respuesta({ error: error.message }, 400); }
  const cargadoPor = String(body.cargado_por || "Usuario del tablero").trim().slice(0, 120);
  try {
    await env.REVISIONES_DB.prepare(CREAR).run();
    await env.REVISIONES_DB.prepare(`
      INSERT INTO x_publicaciones_manual (id, url, fecha, texto, me_gusta, comentarios, compartidos, vistas, cargado_por, actualizado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET url = excluded.url, fecha = excluded.fecha, texto = excluded.texto,
        me_gusta = excluded.me_gusta, comentarios = excluded.comentarios, compartidos = excluded.compartidos,
        vistas = excluded.vistas, cargado_por = excluded.cargado_por, actualizado = excluded.actualizado
    `).bind(datos.id, datos.url, datos.fecha, datos.texto, datos.me_gusta, datos.comentarios, datos.compartidos, datos.vistas, cargadoPor, new Date().toISOString()).run();
    return respuesta({ ok: true, fila: fila(datos) });
  } catch {
    return respuesta({ error: "No se pudo guardar el post. No se modificó el tablero." }, 503);
  }
}
