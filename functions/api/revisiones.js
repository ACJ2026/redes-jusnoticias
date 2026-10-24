const ORIGENES = new Set(["Copia textual (≥50%)", "Reescritura parcial", "Redacción propia", "Sin dato"]);
const MAX_BODY = 8192;

const respuesta = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin"
  }
});

function normalizarUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("URL inválida");
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.*|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|ref|ref_src|amp|output|s)$/i.test(key)) url.searchParams.delete(key);
  }
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  url.searchParams.sort();
  const host = url.hostname;
  if (host === "news.google.com" || host === "bing.com" || host.endsWith(".bing.com")) {
    throw new Error("Se necesita el enlace directo del medio, no el del buscador");
  }
  return url.toString();
}

async function urlKey(notaId, url) {
  const bytes = new TextEncoder().encode(String(notaId) + "\n" + normalizarUrl(url));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}

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

export async function onRequestGet({ env }) {
  if (!env.REVISIONES_DB) return respuesta({ error: "La revisión de publicaciones no está configurada todavía." }, 503);
  try {
    const { results = [] } = await env.REVISIONES_DB.prepare(
      "SELECT nota_id, url, decision, medio, origen, fecha, motivo, revisado_por FROM revisiones_publicacion ORDER BY fecha DESC"
    ).all();
    return respuesta({ revisiones: results });
  } catch {
    return respuesta({ error: "No se pudo consultar el historial de revisiones. Revisá la base y su migración." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.REVISIONES_DB || !env.REVISIONES_CLAVE) {
    return respuesta({ error: "La revisión manual no está configurada en el servidor." }, 503);
  }
  if (!sameOrigin(request)) return respuesta({ error: "Solicitud de otro origen rechazada." }, 403);
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!claveCorrecta(token, env.REVISIONES_CLAVE)) return respuesta({ error: "Clave de revisión incorrecta." }, 401);

  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY) return respuesta({ error: "La solicitud es demasiado grande." }, 413);
  let body;
  try { body = await request.json(); } catch { return respuesta({ error: "La solicitud no contiene datos válidos." }, 400); }
  if (JSON.stringify(body).length > MAX_BODY) return respuesta({ error: "La solicitud es demasiado grande." }, 413);

  const notaId = Number(body.nota_id);
  const decision = body.decision;
  const medio = String(body.medio || "").trim().slice(0, 180);
  const origen = ORIGENES.has(body.origen) ? body.origen : "Sin dato";
  const url = String(body.url || "").trim();
  const motivo = String(body.motivo || "").trim().slice(0, 500);
  const revisadoPor = String(body.revisado_por || "Usuario del tablero").trim().slice(0, 120);
  if (!Number.isSafeInteger(notaId) || notaId <= 0) return respuesta({ error: "La nota no es válida." }, 400);
  if (!["confirmar", "descartar"].includes(decision)) return respuesta({ error: "La decisión no es válida." }, 400);
  if (!url || url.length > 2048) return respuesta({ error: "Falta un enlace válido." }, 400);
  if (decision === "confirmar" && !medio) return respuesta({ error: "Falta identificar el medio." }, 400);

  let urlCanonica, key;
  try {
    urlCanonica = normalizarUrl(url);
    key = await urlKey(notaId, urlCanonica);
  } catch (error) { return respuesta({ error: error.message || "El enlace no es válido." }, 400); }

  const fecha = new Date().toISOString();
  try {
    await env.REVISIONES_DB.batch([
      env.REVISIONES_DB.prepare(`
        INSERT INTO revisiones_publicacion (url_key, nota_id, url, decision, medio, origen, fecha, motivo, revisado_por)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url_key) DO UPDATE SET
          url = excluded.url, decision = excluded.decision, medio = excluded.medio,
          origen = excluded.origen, fecha = excluded.fecha, motivo = excluded.motivo,
          revisado_por = excluded.revisado_por
      `).bind(key, notaId, urlCanonica, decision, medio, origen, fecha, motivo, revisadoPor),
      env.REVISIONES_DB.prepare(`
        INSERT INTO bitacora_revisiones_publicacion
          (url_key, nota_id, url, decision, medio, origen, fecha, motivo, revisado_por)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(key, notaId, urlCanonica, decision, medio, origen, fecha, motivo, revisadoPor)
    ]);
    return respuesta({ ok: true, decision, nota_id: notaId, url: urlCanonica, fecha });
  } catch {
    return respuesta({ error: "No se pudo guardar la decisión. No se modificó el tablero." }, 503);
  }
}
