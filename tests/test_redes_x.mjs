import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

async function importHandler(path) {
  const source = await readFile(new URL(path, ROOT), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const redes = await importHandler("functions/api/redes.js");

async function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("describe HTTP 402 de X sin exponer la respuesta del proveedor", async () => {
  const requests = [];
  const response = await withFetch(async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({
      title: "Insufficient credits",
      detail: "Provider-specific details",
      type: "https://api.x.com/2/problems/credits"
    }), { status: 402 });
  }, () => redes.onRequestGet({
    request: new Request("https://example.test/api/redes"),
    env: { X_BEARER_TOKEN: "test-token" }
  }));

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.errores.X, "La API de X requiere créditos o acceso habilitado.");
  assert.equal(body.redes.X, undefined);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /^https:\/\/api\.x\.com\/2\/users\/by\/username\/Jus_Noticias\?/);
  assert.doesNotMatch(JSON.stringify(body), /test-token|Provider-specific details|credits/);
});

test("consulta el perfil y la primera página de publicaciones cuando X responde", async () => {
  const requests = [];
  const payloads = [
    { data: { id: "123", username: "Jus_Noticias", public_metrics: { followers_count: 2421 } } },
    { data: [], meta: {} }
  ];
  const response = await withFetch(async url => {
    requests.push(String(url));
    return new Response(JSON.stringify(payloads.shift()), { status: 200 });
  }, () => redes.onRequestGet({
    request: new Request("https://example.test/api/redes"),
    env: { X_BEARER_TOKEN: "test-token" }
  }));

  const body = await response.json();
  assert.equal(requests.length, 2);
  assert.match(requests[0], /^https:\/\/api\.x\.com\/2\/users\/by\/username\/Jus_Noticias\?/);
  assert.match(requests[1], /^https:\/\/api\.x\.com\/2\/users\/123\/tweets\?/);
  assert.match(requests[1], /max_results=100/);
  assert.equal(body.redes.X.seguidores, 2421);
  assert.deepEqual(body.redes.X.filas, []);
  assert.equal(body.errores.X, undefined);
});
