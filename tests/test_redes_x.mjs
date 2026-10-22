import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

test("la API social no consulta X ni siquiera si existe un token", async () => {
  const source = await readFile(new URL("functions/api/redes.js", ROOT), "utf8");
  assert.doesNotMatch(source, /api\.x\.com|X_BEARER_TOKEN|\bX:\s*x\b/);

  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(String(url));
    return new Response("{}", { status: 200 });
  };
  try {
    const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
    const response = await module.onRequestGet({
      request: new Request("https://example.test/api/redes"),
      env: {
        X_BEARER_TOKEN: "must-not-be-used",
        FB_PAGE_ID: "",
        META_TOKEN: "",
        IG_USER_ID: "",
        YT_KEY: "",
        YT_CANAL_ID: ""
      }
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(requests.filter(url => url.includes("api.x.com")).length, 0);
    assert.equal(body.redes.X, undefined);
    assert.equal(body.errores.X, undefined);
    assert.equal(body.errores.Facebook !== undefined, true);
    assert.equal(body.errores.Instagram !== undefined, true);
    assert.equal(body.errores.YouTube !== undefined, true);
  } finally {
    globalThis.fetch = original;
  }
});
