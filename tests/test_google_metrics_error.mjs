// Un error de Google se informa como JSON (502), sin romper la función (antes: Cloudflare 1101).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const fuente = await readFile(new URL("functions/api/google-metrics.js", ROOT), "utf8");
const tmp = new URL("tests/_google_tmp.mjs", ROOT);
await writeFile(tmp, fuente);
const mod = await import(tmp.href);
await unlink(tmp);

test("si Google falla, responde 502 con el motivo y el rango", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "invalid_grant", error_description: "Clave vencida" }), { status: 400 });
  const original_importKey = crypto.subtle.importKey;
  const original_sign = crypto.subtle.sign;
  crypto.subtle.importKey = async () => ({});
  crypto.subtle.sign = async () => new ArrayBuffer(8);
  try {
    const env = { GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "x@y", private_key: "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----" }), GA4_PROPERTY_ID: "1", GSC_SITE_URL: "https://x/" };
    const r = await mod.onRequest({ request: new Request("https://x/api/google-metrics?desde=2026-11-01&hasta=2026-11-13"), env });
    assert.equal(r.status, 502);
    const d = await r.json();
    assert.equal(d.estado, "error_google");
    assert.match(d.error, /Clave vencida/);
    assert.deepEqual(d.rango, { start: "2026-11-01", end: "2026-11-13" });
  } finally {
    globalThis.fetch = original;
    crypto.subtle.importKey = original_importKey;
    crypto.subtle.sign = original_sign;
  }
});
