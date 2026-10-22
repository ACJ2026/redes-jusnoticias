import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const ROOT = new URL("../", import.meta.url);
const PREVIEW = "https://feature-tiktok-display-oauth.jusnoticias.pages.dev";
const REDIRECT_URI = `${PREVIEW}/api/tiktok/callback`;
const TOKEN_KEY = "oauth-tokens:primary";

async function importHandler(path) {
  const source = await readFile(new URL(path, ROOT), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const auth = await importHandler("functions/api/tiktok/auth.js");
const callback = await importHandler("functions/api/tiktok/callback.js");
const tiktok = await importHandler("functions/api/tiktok.js");

class MemoryKV {
  values = new Map();

  async get(key) {
    return this.values.get(key) ?? null;
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    this.values.delete(key);
  }
}

class MemoryD1 {
  attempts = new Map();
  states = new Map();
  refreshLock = null;

  prepare(query) {
    let params = [];
    return {
      bind: (...values) => {
        params = values;
        return {
          first: async () => this.first(query, params),
          run: async () => this.run(query, params)
        };
      }
    };
  }

  async first(query, params) {
    if (query.includes("INSERT INTO tiktok_auth_rate_limits")) {
      const [ipHash, windowStart, expiredBefore] = params;
      const current = this.attempts.get(ipHash);
      const attempt = !current || current.window_started_at <= expiredBefore
        ? { attempts: 1, window_started_at: windowStart }
        : { attempts: current.attempts + 1, window_started_at: current.window_started_at };
      this.attempts.set(ipHash, attempt);
      return { ...attempt };
    }
    if (query.includes("UPDATE tiktok_oauth_states")) {
      const [now, stateHash] = params;
      const state = this.states.get(stateHash);
      if (!state || state.used_at !== null || state.expires_at <= now) return null;
      state.used_at = now;
      return { redirect_uri: state.redirect_uri };
    }
    if (query.includes("INSERT INTO tiktok_token_refresh_lock")) {
      const [lockToken, lockedUntil, now] = params;
      if (this.refreshLock && this.refreshLock.locked_until > now) return null;
      this.refreshLock = { lock_token: lockToken, locked_until: lockedUntil };
      return { id: 1 };
    }
    throw new Error(`Unexpected D1 query: ${query}`);
  }

  async run(query, params) {
    if (query.includes("DELETE FROM tiktok_auth_rate_limits")) {
      for (const [key, value] of this.attempts) {
        if (value.window_started_at <= params[0]) this.attempts.delete(key);
      }
      return { success: true };
    }
    if (query.includes("DELETE FROM tiktok_oauth_states")) {
      const [expiredAt, usedAt] = params;
      for (const [key, value] of this.states) {
        if (value.expires_at <= expiredAt || value.used_at !== null && value.used_at <= usedAt) {
          this.states.delete(key);
        }
      }
      return { success: true };
    }
    if (query.includes("INSERT INTO tiktok_oauth_states")) {
      const [stateHash, redirectUri, expiresAt] = params;
      if (this.states.has(stateHash)) throw new Error("Duplicate OAuth state.");
      this.states.set(stateHash, { redirect_uri: redirectUri, expires_at: expiresAt, used_at: null });
      return { success: true };
    }
    if (query.includes("DELETE FROM tiktok_token_refresh_lock")) {
      if (this.refreshLock?.lock_token === params[0]) this.refreshLock = null;
      return { success: true };
    }
    throw new Error(`Unexpected D1 query: ${query}`);
  }
}

function makeEnv() {
  return {
    TIKTOK_CLIENT_KEY: "test-client-key",
    TIKTOK_CLIENT_SECRET: "test-client-secret",
    TIKTOK_CONNECT_KEY: "test-connect-key",
    TIKTOK_REDIRECT_URI: REDIRECT_URI,
    TIKTOK_KV: new MemoryKV(),
    TIKTOK_AUTH_DB: new MemoryD1()
  };
}

function authRequest(key, ip = "192.0.2.10") {
  return new Request(`${PREVIEW}/api/tiktok/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "CF-Connecting-IP": ip
    },
    body: new URLSearchParams({ connect_key: key })
  });
}

function callbackRequest(query) {
  return new Request(`${REDIRECT_URI}?${query}`);
}

async function hashState(state) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function saveState(db, state, { expired = false } = {}) {
  db.states.set(await hashState(state), {
    redirect_uri: REDIRECT_URI,
    expires_at: expired ? Date.now() - 1 : Date.now() + 600_000,
    used_at: null
  });
}

async function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

function providerResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

test("rechaza la clave incorrecta y aplica límite por IP tras cinco intentos", async () => {
  const env = makeEnv();
  let response;
  for (let attempt = 0; attempt < 5; attempt++) {
    response = await auth.onRequestPost({ request: authRequest("clave-incorrecta"), env });
    assert.equal(response.status, 403);
  }
  response = await auth.onRequestPost({ request: authRequest("clave-incorrecta"), env });
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("Retry-After")) > 0);
  assert.doesNotMatch(await response.text(), /test-connect-key|clave-incorrecta/);
});

test("inicia OAuth con state aleatorio de 256 bits, vencimiento y URI exacta", async () => {
  const env = makeEnv();
  const before = Date.now();
  const response = await auth.onRequestPost({ request: authRequest(env.TIKTOK_CONNECT_KEY), env });
  assert.equal(response.status, 302);
  const authorize = new URL(response.headers.get("Location"));
  const state = authorize.searchParams.get("state");
  assert.match(state, /^[0-9a-f]{64}$/);
  assert.equal(authorize.searchParams.get("redirect_uri"), REDIRECT_URI);
  assert.deepEqual(authorize.searchParams.get("scope").split(","), [
    "user.info.basic",
    "user.info.stats",
    "video.list"
  ]);
  const record = env.TIKTOK_AUTH_DB.states.get(await hashState(state));
  assert.equal(record.redirect_uri, REDIRECT_URI);
  assert.ok(record.expires_at >= before + 600_000);
  assert.ok(record.expires_at <= Date.now() + 600_000);
  assert.doesNotMatch(response.headers.get("Location"), /test-client-secret|test-connect-key/);
});

test("falla cerrado cuando falta la base para límite y state", async () => {
  const env = makeEnv();
  delete env.TIKTOK_AUTH_DB;
  const response = await auth.onRequestPost({ request: authRequest(env.TIKTOK_CONNECT_KEY), env });
  assert.equal(response.status, 503);
});

test("rechaza callback sin parámetros, state inválido y state vencido", async () => {
  const env = makeEnv();
  let response = await callback.onRequestGet({
    request: new Request(REDIRECT_URI),
    env
  });
  assert.equal(response.status, 400);

  response = await callback.onRequestGet({ request: callbackRequest("state=not-a-state"), env });
  assert.equal(response.status, 400);

  const expiredState = "a".repeat(64);
  await saveState(env.TIKTOK_AUTH_DB, expiredState, { expired: true });
  response = await callback.onRequestGet({ request: callbackRequest(`state=${expiredState}&code=unused`), env });
  assert.equal(response.status, 400);
});

test("state se consume una sola vez incluso con callbacks simultáneos", async () => {
  const env = makeEnv();
  const state = "b".repeat(64);
  await saveState(env.TIKTOK_AUTH_DB, state);
  let exchanges = 0;
  await withFetch(async () => {
    exchanges++;
    return providerResponse({
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      open_id: "test-open-id",
      scope: "user.info.basic,video.list",
      expires_in: 86_400,
      refresh_expires_in: 31_536_000
    });
  }, async () => {
    const responses = await Promise.all([
      callback.onRequestGet({ request: callbackRequest(`state=${state}&code=first`), env }),
      callback.onRequestGet({ request: callbackRequest(`state=${state}&code=second`), env })
    ]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 400]);
  });
  assert.equal(exchanges, 1);
  const stored = await env.TIKTOK_KV.get(TOKEN_KEY);
  assert.match(stored, /test-access-token/);
});

test("oculta el detalle de rechazo OAuth del proveedor", async () => {
  const env = makeEnv();
  const state = "c".repeat(64);
  await saveState(env.TIKTOK_AUTH_DB, state);
  const response = await callback.onRequestGet({
    request: callbackRequest(`state=${state}&error=access_denied&error_description=private-provider-detail`),
    env
  });
  assert.equal(response.status, 400);
  assert.doesNotMatch(await response.text(), /private-provider-detail|access_denied/);
});

test("valida el origen del callback y no intercambia un state de otra URL", async () => {
  const env = makeEnv();
  const state = "d".repeat(64);
  await saveState(env.TIKTOK_AUTH_DB, state);
  const response = await callback.onRequestGet({
    request: new Request(`https://attacker.example/api/tiktok/callback?state=${state}&code=test`),
    env
  });
  assert.equal(response.status, 400);
  assert.equal(env.TIKTOK_AUTH_DB.states.get(await hashState(state)).used_at, null);
});

test("guarda tokens solo en KV y nunca los devuelve por HTTP", async () => {
  const env = makeEnv();
  const state = "e".repeat(64);
  await saveState(env.TIKTOK_AUTH_DB, state);
  const accessToken = "test-access-token-not-for-response";
  const refreshToken = "test-refresh-token-not-for-response";
  await withFetch(async () => providerResponse({
    access_token: accessToken,
    refresh_token: refreshToken,
    open_id: "test-open-id",
    scope: "user.info.basic,video.list",
    expires_in: 86_400,
    refresh_expires_in: 31_536_000
  }), async () => {
    const response = await callback.onRequestGet({
      request: callbackRequest(`state=${state}&code=authorization-code`),
      env
    });
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /Conexión con TikTok completada/);
    assert.doesNotMatch(body, new RegExp(`${accessToken}|${refreshToken}|authorization-code`));
  });
  const stored = JSON.parse(await env.TIKTOK_KV.get(TOKEN_KEY));
  assert.equal(stored.access_token, accessToken);
  assert.equal(stored.refresh_token, refreshToken);
});

test("rechaza una respuesta OAuth sin tokens obligatorios", async () => {
  const env = makeEnv();
  const state = "f".repeat(64);
  await saveState(env.TIKTOK_AUTH_DB, state);
  await withFetch(async () => providerResponse({
    error: "invalid_grant",
    error_description: "private-provider-detail",
    log_id: "private-log-id"
  }, 400), async () => {
    const response = await callback.onRequestGet({
      request: callbackRequest(`state=${state}&code=authorization-code`),
      env
    });
    const body = await response.text();
    assert.equal(response.status, 502);
    assert.doesNotMatch(body, /invalid_grant|private-provider-detail|private-log-id|authorization-code/);
    assert.equal(await env.TIKTOK_KV.get(TOKEN_KEY), null);
  });
});

test("no expone errores de TikTok ni tokens al faltar autorización", async () => {
  const env = makeEnv();
  const response = await tiktok.onRequestGet({ env });
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(body), {
    estado: "no_disponible",
    error: "TikTok no está disponible temporalmente. Si el problema persiste, volvé a conectar la cuenta.",
    perfil: null,
    videos: []
  });
  assert.doesNotMatch(body, /test-client-secret|access_token|refresh_token|TIKTOK_KV/);
});

test("campos opcionales ausentes de Display API se representan sin romper el JSON", async () => {
  const env = makeEnv();
  await env.TIKTOK_KV.put(TOKEN_KEY, JSON.stringify({
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    open_id: "test-open-id",
    scope: "user.info.basic,user.info.stats,video.list",
    access_expires_at: Date.now() + 60 * 60 * 1000,
    refresh_expires_at: Date.now() + 24 * 60 * 60 * 1000,
    updated_at: new Date().toISOString()
  }));
  await withFetch(async input => {
    const url = new URL(input);
    if (url.pathname.endsWith("/user/info/")) {
      assert.equal(url.searchParams.get("fields"), "open_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count");
      return providerResponse({ data: { user: { open_id: "test-open-id" } }, error: { code: "ok" } });
    }
    assert.equal(url.pathname, "/v2/video/list/");
    assert.equal(url.searchParams.get("fields"), "id,title,video_description,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count");
    return providerResponse({
      data: { videos: [{ id: "video-1" }], has_more: false },
      error: { code: "ok" }
    });
  }, async () => {
    const response = await tiktok.onRequestGet({ env });
    const body = await response.text();
    const data = JSON.parse(body);
    assert.equal(data.estado, "disponible");
    assert.equal(data.perfil.seguidores, null);
    assert.equal(data.videos[0].vistas, null);
    assert.equal(data.videos[0].me_gusta, null);
    assert.equal(data.videos[0].fecha, null);
    assert.doesNotMatch(body, /test-access-token|test-refresh-token/);
  });
});

test("falla renovación temporal de forma genérica y conserva tokens para reintento", async () => {
  const env = makeEnv();
  const originalTokens = {
    access_token: "old-access-token",
    refresh_token: "old-refresh-token",
    open_id: "test-open-id",
    scope: "user.info.basic,video.list",
    access_expires_at: Date.now() + 1_000,
    refresh_expires_at: Date.now() + 60 * 60 * 1000,
    updated_at: "before-refresh"
  };
  await env.TIKTOK_KV.put(TOKEN_KEY, JSON.stringify(originalTokens));
  await withFetch(async () => providerResponse({
    error: "temporarily_unavailable",
    error_description: "private-refresh-provider-detail",
    log_id: "private-log-id"
  }, 400), async () => {
    const response = await tiktok.onRequestGet({ env });
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /TikTok no está disponible temporalmente/);
    assert.doesNotMatch(body, /invalid_grant|private-refresh-provider-detail|private-log-id|old-access-token|old-refresh-token/);
  });
  assert.deepEqual(JSON.parse(await env.TIKTOK_KV.get(TOKEN_KEY)), originalTokens);
  assert.equal(env.TIKTOK_AUTH_DB.refreshLock, null);
});

test("elimina una autorización cuando TikTok rechaza definitivamente el refresh token", async () => {
  const env = makeEnv();
  await env.TIKTOK_KV.put(TOKEN_KEY, JSON.stringify({
    access_token: "old-access-token",
    refresh_token: "revoked-refresh-token",
    open_id: "test-open-id",
    scope: "user.info.basic,video.list",
    access_expires_at: Date.now() + 1_000,
    refresh_expires_at: Date.now() + 60 * 60 * 1000,
    updated_at: "before-refresh"
  }));
  await withFetch(async () => providerResponse({ error: "invalid_grant" }, 400), async () => {
    const response = await tiktok.onRequestGet({ env });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /TikTok no está disponible temporalmente/);
  });
  assert.equal(await env.TIKTOK_KV.get(TOKEN_KEY), null);
});

test("renueva y persiste el refresh token rotado sin incluir credenciales en el JSON", async () => {
  const env = makeEnv();
  await env.TIKTOK_KV.put(TOKEN_KEY, JSON.stringify({
    access_token: "old-access-token",
    refresh_token: "old-refresh-token",
    open_id: "test-open-id",
    scope: "user.info.basic,video.list",
    access_expires_at: Date.now() + 1_000,
    refresh_expires_at: Date.now() + 60 * 60 * 1000,
    updated_at: "before-refresh"
  }));
  await withFetch(async input => {
    const url = new URL(input);
    if (url.pathname.endsWith("/oauth/token/")) {
      return providerResponse({
        access_token: "rotated-access-token",
        refresh_token: "rotated-refresh-token",
        expires_in: 86_400,
        refresh_expires_in: 31_536_000
      });
    }
    if (url.pathname.endsWith("/user/info/")) {
      return providerResponse({ data: { user: { open_id: "test-open-id" } }, error: { code: "ok" } });
    }
    return providerResponse({ data: { videos: [], has_more: false }, error: { code: "ok" } });
  }, async () => {
    const response = await tiktok.onRequestGet({ env });
    const body = await response.text();
    assert.equal(JSON.parse(body).estado, "disponible");
    assert.doesNotMatch(body, /rotated-access-token|rotated-refresh-token/);
  });
  const saved = JSON.parse(await env.TIKTOK_KV.get(TOKEN_KEY));
  assert.equal(saved.access_token, "rotated-access-token");
  assert.equal(saved.refresh_token, "rotated-refresh-token");
  assert.equal(env.TIKTOK_AUTH_DB.refreshLock, null);
});
