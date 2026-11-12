import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);
const source = await readFile(new URL("functions/api/comentarios-prueba.js", ROOT), "utf8");
const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

const ENV = { FB_PAGE_ID: "111", FB_PAGE_TOKEN: "EAApagetokenparaprueba1234567890", GEMINI_API_KEY: "AIzaClaveDePrueba1234567890abcdef", REVISIONES_CLAVE: "secreta" };
const ok = body => new Response(JSON.stringify(body), { status: 200 });

async function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  try { return await run(); } finally { globalThis.fetch = original; }
}

function fakeFetch(llamadasGemini) {
  return async (url, opts = {}) => {
    const u = String(url);
    if (u.includes("/111/posts")) return ok({ data: [{ id: "111_1", message: "Condenan a un hombre", permalink_url: "https://fb.com/1", created_time: "2026-11-11T10:00:00+0000" }] });
    if (u.includes("/111_1/comments")) return ok({ data: [{ message: "Vergüenza", created_time: "x" }, { message: "   ", created_time: "y" }] });
    if (u.includes("generativelanguage.googleapis.com/v1beta/decisions")) {
      llamadasGemini.push({ headers: opts.headers, body: JSON.parse(opts.body) });
      return ok({ answers: { tono: { choice: "negativo", confidence: 0.9 }, tema: { choice: "decision_judicial", confidence: 0.4 }, revisar: { noul: 0.2, confidence: 0.8 } }, usage: { total_output_tokens: 0 } });
    }
    throw new Error("URL inesperada " + u);
  };
}

test("sin clave correcta no llama a ningún servicio", async () => {
  await withFetch(async () => { throw new Error("no debería llamar"); }, async () => {
    const r = await mod.onRequestGet({ request: new Request("https://x/api/comentarios-prueba?clave=mal"), env: ENV });
    assert.equal(r.status, 401);
  });
});

test("clasifica cada comentario con texto y usa la clave en el encabezado", async () => {
  const llamadas = [];
  await withFetch(fakeFetch(llamadas), async () => {
    const r = await mod.onRequestGet({ request: new Request("https://x/api/comentarios-prueba?clave=secreta&formato=json"), env: ENV });
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
