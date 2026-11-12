import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);
const source = await readFile(new URL("functions/api/comentarios-prueba.js", ROOT), "utf8");
const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

const ENV = { IG_USER_ID: "333", META_TOKEN: "EAAusertokenparaprueba1234567890", FB_PAGE_ID: "111", FB_PAGE_TOKEN: "EAApagetokenparaprueba1234567890", GEMINI_API_KEY: "AIzaClaveDePrueba1234567890abcdef" };
const ok = body => new Response(JSON.stringify(body), { status: 200 });

async function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  try { return await run(); } finally { globalThis.fetch = original; }
}

function fakeFetch(llamadasGemini) {
  return async (url, opts = {}) => {
    const u = String(url);
    if (u.includes("/333/media")) return ok({ data: [] });
    if (u.includes("/111/posts")) return ok({ data: [{ id: "111_1", message: "Condenan a un hombre", permalink_url: "https://fb.com/1", created_time: "2026-11-11T10:00:00+0000" }] });
    if (u.includes("/111_1/comments")) return ok({ data: [{ message: "Vergüenza", created_time: "x" }, { message: "   ", created_time: "y" }] });
    if (u.includes("generativelanguage.googleapis.com/v1beta/decisions")) {
      llamadasGemini.push({ headers: opts.headers, body: JSON.parse(opts.body) });
      return ok({ answers: { tono: { choice: "negativo", confidence: 0.9 }, tema: { choice: "decision_judicial", confidence: 0.4 }, revisar: { noul: 0.2, confidence: 0.8 } }, usage: { total_output_tokens: 0 } });
    }
    throw new Error("URL inesperada " + u);
  };
}

test("se abre sin clave y guarda el resultado en caché un rato", async () => {
  const llamadas = [];
  await withFetch(fakeFetch(llamadas), async () => {
    const r = await mod.onRequestGet({ request: new Request("https://x/api/comentarios-prueba"), env: ENV });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("Cache-Control"), /s-maxage/);
  });
});

test("clasifica cada comentario con texto y usa la clave en el encabezado", async () => {
  const llamadas = [];
  await withFetch(fakeFetch(llamadas), async () => {
    const r = await mod.onRequestGet({ request: new Request("https://x/api/comentarios-prueba?formato=json"), env: ENV });
    assert.equal(r.status, 200);
    const res = await r.json();
    assert.equal(llamadas.length, 1, "los comentarios vacíos no se mandan");
    assert.equal(llamadas[0].headers["x-goog-api-key"], ENV.GEMINI_API_KEY);
    assert.equal(llamadas[0].body.model, "gemini-decision-1");
    assert.deepEqual(Object.keys(llamadas[0].body.questions).sort(), ["revisar", "tema", "tono"]);
    assert.equal(res.publicaciones[0].comentarios[0].decision.tono.valor, "negativo");
  });
});

test("la página marca las respuestas dudosas y escapa el texto", async () => {
  const llamadas = [];
  await withFetch(fakeFetch(llamadas), async () => {
    const res = await mod.armarResultado(ENV);
    res.publicaciones[0].comentarios[0].texto = "<script>x</script>";
    const pagina = mod.html(res);
    assert.ok(pagina.includes("❓"));
    assert.ok(!pagina.includes("<script>x"));
  });
});

test("un error de Gemini no muestra la clave", async () => {
  await withFetch(async url => {
    const u = String(url);
    if (u.includes("/333/media")) return ok({ data: [] });
    if (u.includes("/posts")) return ok({ data: [{ id: "111_1", message: "a" }] });
    if (u.includes("/comments")) return ok({ data: [{ message: "hola" }] });
    return new Response(JSON.stringify({ error: { message: "API key AIzaClaveDePrueba1234567890abcdef no válida" } }), { status: 400 });
  }, async () => {
    const res = await mod.armarResultado(ENV);
    const err = res.publicaciones[0].comentarios[0].error;
    assert.ok(err && !err.includes("AIzaClaveDePrueba"));
  });
});

test("sin GEMINI_API_KEY avisa en vez de inventar", async () => {
  await assert.rejects(() => mod.armarResultado({ ...ENV, GEMINI_API_KEY: "" }), /GEMINI_API_KEY/);
});

test("no pide comentarios de publicaciones que no tienen y oculta las vacías", async () => {
  const pedidos = [];
  await withFetch(async url => {
    const u = String(url);
    pedidos.push(u);
    if (u.includes("/333/media")) return ok({ data: [] });
    if (u.includes("/111/posts")) return ok({ data: [
      { id: "111_1", message: "con", comments: { summary: { total_count: 1 } } },
      { id: "111_2", message: "Publicación sin nada", comments: { summary: { total_count: 0 } } }
    ] });
    if (u.includes("/111_1/comments")) return ok({ data: [{ message: "Hay favores con fiscales" }] });
    return ok({ answers: { tono: { choice: "negativo", confidence: 0.9 }, tema: { choice: "independencia", confidence: 0.9 }, revisar: { noul: 0.7, confidence: 0.8 } } });
  }, async () => {
    const res = await mod.armarResultado(ENV);
    assert.ok(!pedidos.some(u => u.includes("/111_2/comments")));
    const pagina = mod.html(res);
    assert.ok(pagina.includes("Independencia de jueces y fiscales"));
    assert.ok(!pagina.includes("Publicación sin nada"));
  });
});

test("las preguntas incluyen el tema de independencia y las acusaciones con nombre", () => {
  assert.ok(mod.PREGUNTAS.tema.criteria.independencia);
  assert.match(mod.PREGUNTAS.revisar.instructions, /nombre o apellido/);
});

test("lee comentarios de Instagram y, si Meta no da permiso, muestra el error sin frenar Facebook", async () => {
  const hoy = new Date().toISOString();
  const llamadas = [];
  await withFetch(async (url, opts) => {
    const u = String(url);
    if (u.includes("/333/media")) return ok({ data: [
      { id: "ig1", caption: "Nota IG", permalink: "https://ig/1", timestamp: hoy, comments_count: 2 },
      { id: "ig2", caption: "Otra", permalink: "https://ig/2", timestamp: hoy, comments_count: 1 },
      { id: "ig3", caption: "Vacía", timestamp: hoy, comments_count: 0 }
    ] });
    if (u.includes("/ig1/comments")) return ok({ data: [{ text: "Excelente trabajo" }] });
    if (u.includes("/ig2/comments")) return new Response(JSON.stringify({ error: { message: "(#10) Requires instagram_manage_comments permission" } }), { status: 400 });
    if (u.includes("/ig3/comments")) throw new Error("no debería pedir comentarios de una publicación sin comentarios");
    return fakeFetch(llamadas)(url, opts);
  }, async () => {
    const res = await mod.armarResultado(ENV);
    const ig = res.publicaciones.filter(p => p.red === "Instagram");
    assert.equal(ig.length, 3);
    assert.equal(ig[0].comentarios[0].texto, "Excelente trabajo");
    assert.ok(ig[0].comentarios[0].decision);
    assert.match(ig[1].error, /instagram_manage_comments/);
    assert.ok(res.publicaciones.some(p => p.red === "Facebook" && p.comentarios.length));
    assert.ok(mod.html(res).includes("📷 Instagram"));
  });
});
