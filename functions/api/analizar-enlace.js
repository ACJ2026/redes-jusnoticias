import notasOficiales from "../../data/notas2.json";

const MAX_HTML = 1_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
const STOP = new Set("para sobre desde entre donde porque cuando hasta durante contra juzgado juzgados justicia judicial poder chubut provincia fallo causa ordena ordenan penal trelew rawson madryn comodoro esquel puerto rivadavia tribunal superior ciudad nuevo nueva jusnoticias".split(" "));

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  }
});

function validarUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Pegá un enlace válido."); }
  if (url.protocol !== "https:") throw new Error("Por seguridad, el enlace debe usar HTTPS.");
  if (url.username || url.password || !url.hostname || url.port && url.port !== "443") {
    throw new Error("El enlace contiene datos de conexión no admitidos.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || /^[0-9.]+$/.test(host) || host.includes(":")) {
    throw new Error("Ese dominio no se puede consultar.");
  }
  return url;
}

function limpiarHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ").trim();
}

function extraerMeta(html, pattern) {
  const match = pattern.exec(html);
  return match ? limpiarHtml(match[1]) : "";
}

function leerMetadata(html) {
  const meta = (key) => {
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    for (const tag of tags) {
      const name = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
      if (name && content !== undefined && name.toLowerCase() === key.toLowerCase()) return limpiarHtml(content);
    }
    return "";
  };
  const title = meta("og:title") || meta("twitter:title") || extraerMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = meta("og:description") || meta("description") || meta("twitter:description");
  const published = meta("article:published_time") || meta("datePublished") || meta("pubdate");
  const canonical = extraerMeta(html, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
    extraerMeta(html, /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  const text = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ");
  return { title: title.slice(0, 500), description: description.slice(0, 1800), published, canonical, text: limpiarHtml(text).slice(0, 12000) };
}

const normalizar = value => String(value || "").toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/https?:\/\/\S+/g, " ")
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const raices = value => new Set(normalizar(value).split(" ").filter(w => w.length >= 5 && !STOP.has(w)).map(w => w.slice(0, 6)));

function comparar(metadata, url, notas) {
  const todo = normalizar([metadata.title, metadata.description, metadata.text].join(" "));
  const urlOficial = new URL(url);
  const idDirecto = urlOficial.hostname === "jusnoticias.juschubut.gov.ar" ? urlOficial.searchParams.get("p") : null;
  const candidatos = [];
  for (const nota of notas) {
    if (idDirecto && String(nota.id) === String(idDirecto)) {
      candidatos.push({ nota_id: nota.id, titulo: nota.titulo, fecha: nota.fecha, puntaje: 100, evidencia: "El enlace es una nota oficial de JusNoticias, no una repercusión externa." });
      continue;
    }
    const titulo = normalizar(nota.titulo);
    if (titulo.length >= 18 && todo.includes(titulo)) {
      candidatos.push({ nota_id: nota.id, titulo: nota.titulo, fecha: nota.fecha, puntaje: 100, evidencia: "El título completo aparece en los metadatos o el texto accesible." });
      continue;
    }
    const raicesTitulo = raices(nota.titulo);
    const coincidencias = [...raicesTitulo].filter(r => todo.includes(r)).length;
    const minimo = Math.min(3, Math.max(2, raicesTitulo.size));
    if (coincidencias >= minimo) candidatos.push({
      nota_id: nota.id, titulo: nota.titulo, fecha: nota.fecha, puntaje: Math.round(100 * coincidencias / Math.max(1, raicesTitulo.size)),
      evidencia: coincidencias + " coincidencias de palabras significativas; requiere revisión humana."
    });
  }
  return candidatos.sort((a, b) => b.puntaje - a.puntaje).slice(0, 5);
}

function plataforma(host) {
  if (/(^|\.)instagram\.com$/.test(host)) return "Instagram";
  if (/(^|\.)facebook\.com$/.test(host) || /(^|\.)fb\.watch$/.test(host)) return "Facebook";
  if (/(^|\.)tiktok\.com$/.test(host)) return "TikTok";
  if (/(^|\.)youtube\.com$/.test(host) || host === "youtu.be") return "YouTube";
  if (host === "x.com" || host === "twitter.com") return "X";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "LinkedIn";
  return "Web / medio digital";
}

export async function onRequestPost({ request }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "La solicitud no contiene un enlace válido." }, 400); }
  const entrada = String(body?.url || "").trim();
  if (!entrada || entrada.length > 2048) return json({ error: "Pegá un enlace HTTPS de hasta 2048 caracteres." }, 400);

  let actual;
  try { actual = validarUrl(entrada); } catch (error) { return json({ error: error.message }, 400); }
  let response = null;
  try {
    for (let salto = 0; salto <= MAX_REDIRECTS; salto++) {
      response = await fetch(actual.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "Accept": "text/html,application/xhtml+xml", "User-Agent": "JusNoticias-Repercusiones/1.0" }
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (salto === MAX_REDIRECTS) return json({ error: "El enlace redirige demasiadas veces; no se pudo verificar." }, 422);
        const location = response.headers.get("Location");
        if (!location) return json({ error: "La página redirigió sin indicar el destino." }, 422);
        try { actual = validarUrl(new URL(location, actual).toString()); }
        catch (error) { return json({ error: "La redirección lleva a un destino no permitido: " + error.message }, 422); }
        continue;
      }
      break;
    }
  } catch {
    return json({ error: "No se pudo acceder al contenido público de ese enlace. Puede requerir inicio de sesión, bloquear consultas automáticas o no estar disponible." }, 422);
  }

  if (!response || !response.ok) return json({ error: "La página respondió con un error HTTP " + (response?.status || "desconocido") + "." }, 422);
  const type = response.headers.get("Content-Type") || "";
  if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
    return json({ error: "La dirección no devolvió una página HTML pública que se pueda analizar." }, 422);
  }
  const reader = response.body?.getReader();
  if (!reader) return json({ error: "La página no entregó contenido legible." }, 422);
  let html = "", bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_HTML) { await reader.cancel(); break; }
      html += new TextDecoder().decode(value, { stream: true });
    }
  } catch {
    return json({ error: "No se pudo leer el contenido completo de la página." }, 422);
  }
  const metadata = leerMetadata(html);
  if (!metadata.title && !metadata.description && !metadata.text) {
    return json({ error: "La página abrió, pero no expuso texto o metadatos suficientes para analizarla." }, 422);
  }
  const urlFinal = actual.toString();
  const candidatos = comparar(metadata, urlFinal, notasOficiales);
  return json({
    estado: candidatos.length ? "A revisar" : "No se encontró una coincidencia suficiente",
    plataforma: plataforma(actual.hostname),
    url: urlFinal,
    url_canonica: metadata.canonical ? (() => { try { return new URL(metadata.canonical, urlFinal).toString(); } catch { return null; } })() : null,
    titulo_publicacion: metadata.title || null,
    descripcion: metadata.description || null,
    fecha_publicacion: metadata.published || null,
    texto_analizado: metadata.text.slice(0, 1800),
    coincidencias: candidatos,
    aviso: "El análisis usa solo texto y metadatos públicos accesibles. No puede confirmar contenido visual o audio que la página no exponga; revisá el enlace original antes de marcar una repercusión como verificada."
  });
}
