// Posteos de otras cuentas (medios u otras) con nuestras notas, cargados a mano desde el tablero.
// Sirve para cualquier red: Facebook y TikTok no permiten leer cuentas ajenas por API, así que
// esos posteos se registran con este formulario. Usa la misma base (REVISIONES_DB) y la misma
// clave (REVISIONES_CLAVE) que la revisión manual de publicaciones. Lectura libre; guardar pide clave.
const MAX_BODY = 8192;
const CREAR = `CREATE TABLE IF NOT EXISTS posteos_manuales (
  url TEXT PRIMARY KEY, red TEXT NOT NULL, cuenta TEXT, fecha TEXT, nota_id INTEGER NOT NULL,
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

const REDES = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.watch$|(^|\.)fb\.com$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "YouTube"],
  [/(^|\.)x\.com$|(^|\.)twitter\.com$/, "X"],
  [/(^|\.)threads\.(net|com)$/, "Threads"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)whatsapp\.com$/, "WhatsApp"]
];

// Enlace del posteo: la red se reconoce por la dirección; la cuenta, cuando la dirección la trae.
export function leerPosteo(valor) {
  let url;
  try { url = new URL(String(valor || "").trim()); } catch { throw new Error("El enlace no es válido."); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("El enlace no es válido.");
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.|web\.)/, "");
  if (/jusnoticias\.juschubut\.gov\.ar$/.test(host)) throw new Error("Ese es el enlace de nuestra nota: pegá el del posteo en la red de la otra cuenta.");
  const red = (REDES.find(([re]) => re.test(host)) || [null, "Otra red"])[1];
  url.hash = "";
  for (const k of [...url.searchParams.keys()]) if (/^(utm_.*|fbclid|igsh|igshid|si|ref|ref_src|__cft__.*|__tn__|mibextid|_r|is_from_webapp|sender_device)$/i.test(k)) url.searchParams.delete(k);
  const partes = url.pathname.split("/").filter(Boolean);
  let cuenta = "";
  if (red === "TikTok" && partes[0] && partes[0].startsWith("@")) cuenta = partes[0];
  else if (red === "X" && partes[0] && partes[1] === "status") cuenta = "@" + partes[0];
  else if (red === "Facebook" && partes[0] && !["share", "watch", "story.php", "permalink.php", "reel", "photo", "photo.php", "groups"].includes(partes[0])) cuenta = partes[0];
  else if (red === "Instagram" && partes[0] && !["p", "reel", "reels", "tv", "stories"].includes(partes[0])) cuenta = "@" + partes[0];
  return { url: url.toString(), red, cuenta };
}

export function fila(r) {
  return {
    red: r.red, cuenta: r.cuenta || "", cuenta_url: null, publicacion_url: r.url, fecha: r.fecha || "",
    nota_id: Number(r.nota_id), verificacion: "fuerte", coincidencia: "cargado a mano", carga: "manual"
  };
}

export async function onRequestGet({ env }) {
  if (!env.REVISIONES_DB) return respuesta({ error: "La carga manual de posteos no está configurada todavía." }, 503);
  try {
    await env.REVISIONES_DB.prepare(CREAR).run();
    const { results = [] } = await env.REVISIONES_DB.prepare(
      "SELECT url, red, cuenta, fecha, nota_id FROM posteos_manuales ORDER BY actualizado DESC"
    ).all();
    return respuesta({ filas: results.map(fila) });
  } catch {
    return respuesta({ error: "No se pudo leer la carga manual de posteos." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.REVISIONES_DB || !env.REVISIONES_CLAVE) return respuesta({ error: "La carga manual de posteos no está configurada en el servidor." }, 503);
  if (!sameOrigin(request)) return respuesta({ error: "Solicitud de otro origen rechazada." }, 403);
  const auth = request.headers.get("Authorization") || "";
  if (!claveCorrecta(auth.startsWith("Bearer ") ? auth.slice(7) : "", env.REVISIONES_CLAVE)) return respuesta({ error: "Clave incorrecta." }, 401);
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY) return respuesta({ error: "La solicitud es demasiado grande." }, 413);
  let body;
  try { body = await request.json(); } catch { return respuesta({ error: "La solicitud no contiene datos válidos." }, 400); }
  let datos;
  try {
    const p = leerPosteo(body.url);
    const notaId = Number(body.nota_id);
    if (!Number.isSafeInteger(notaId) || notaId <= 0) throw new Error("Elegí la nota que publicó esa cuenta.");
    const fecha = String(body.fecha || "").trim();
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("La fecha no es válida.");
    const cuenta = String(body.cuenta || "").trim().slice(0, 120) || p.cuenta;
    datos = { url: p.url, red: p.red, cuenta, fecha, nota_id: notaId };
  } catch (error) { return respuesta({ error: error.message }, 400); }
  const cargadoPor = String(body.cargado_por || "Usuario del tablero").trim().slice(0, 120);
  try {
    await env.REVISIONES_DB.prepare(CREAR).run();
    await env.REVISIONES_DB.prepare(`
      INSERT INTO posteos_manuales (url, red, cuenta, fecha, nota_id, cargado_por, actualizado)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET red = excluded.red, cuenta = excluded.cuenta, fecha = excluded.fecha,
        nota_id = excluded.nota_id, cargado_por = excluded.cargado_por, actualizado = excluded.actualizado
    `).bind(datos.url, datos.red, datos.cuenta, datos.fecha, datos.nota_id, cargadoPor, new Date().toISOString()).run();
    return respuesta({ ok: true, fila: fila(datos) });
  } catch {
    return respuesta({ error: "No se pudo guardar el posteo. No se modificó el tablero." }, 503);
  }
}
