const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_FORM_BYTES = 4096;
const REDIRECT_PATH = "/api/tiktok/callback";

const reply = (message, status = 400, type = "text/plain; charset=utf-8", headers = {}) => new Response(message, {
  status,
  headers: {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...headers
  }
});

function validRedirectUri(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.href === value
      && url.protocol === "https:"
      && url.pathname === REDIRECT_PATH
      && !url.search
      && !url.hash
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function isConfigured(env) {
  return Boolean(
    env.TIKTOK_CLIENT_KEY
    && env.TIKTOK_CLIENT_SECRET
    && env.TIKTOK_CONNECT_KEY
    && env.TIKTOK_KV
    && env.TIKTOK_AUTH_DB
    && validRedirectUri(env.TIKTOK_REDIRECT_URI)
  );
}

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function hashIp(ip, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

async function recordFailedAttempt(db, ipHash, now) {
  const windowStart = Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  const expiredBefore = windowStart - RATE_WINDOW_MS;
  await db.prepare("DELETE FROM tiktok_auth_rate_limits WHERE window_started_at <= ?")
    .bind(expiredBefore)
    .run();
  const row = await db.prepare(`
    INSERT INTO tiktok_auth_rate_limits (ip_hash, window_started_at, attempts)
    VALUES (?, ?, 1)
    ON CONFLICT(ip_hash) DO UPDATE SET
      attempts = CASE
        WHEN tiktok_auth_rate_limits.window_started_at <= ? THEN 1
        ELSE tiktok_auth_rate_limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN tiktok_auth_rate_limits.window_started_at <= ? THEN excluded.window_started_at
        ELSE tiktok_auth_rate_limits.window_started_at
      END
    RETURNING attempts, window_started_at
  `)
    .bind(ipHash, windowStart, expiredBefore, expiredBefore)
    .first();
  if (!row || !Number.isInteger(row.attempts) || !Number.isFinite(row.window_started_at)) {
    throw new Error("Rate limit storage unavailable.");
  }
  return row;
}

export async function onRequestGet({ env }) {
  if (!isConfigured(env)) {
    return reply("TikTok no está configurado de forma segura en este entorno.", 503);
  }
  return reply(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Conectar TikTok</title><body style="font:16px system-ui;max-width:560px;margin:4rem auto;padding:1rem"><h1>Conectar la cuenta institucional de TikTok</h1><p>Ingresá la clave administrativa de conexión configurada en Cloudflare. Esta clave no es la Client Secret de TikTok.</p><form method="post" action="/api/tiktok/auth"><label for="connect_key">Clave de conexión</label><p><input id="connect_key" name="connect_key" type="password" autocomplete="current-password" required style="width:100%;padding:.7rem"></p><button type="submit" style="padding:.7rem 1rem">Continuar a TikTok</button></form></body></html>`, 200, "text/html; charset=utf-8");
}

export async function onRequestPost({ request, env }) {
  if (!isConfigured(env)) {
    return reply("TikTok no está configurado de forma segura en este entorno.", 503);
  }
  const contentType = request.headers.get("Content-Type") || "";
  const contentLengthHeader = request.headers.get("Content-Length");
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(contentType)
    || contentLength !== null && (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_FORM_BYTES)) {
    return reply("La solicitud no es válida.", 400);
  }

  let submitted;
  let reader;
  try {
    reader = request.body?.getReader();
    if (!reader) return reply("La solicitud no es válida.", 400);
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_FORM_BYTES) {
        await reader.cancel();
        return reply("La solicitud no es válida.", 413);
      }
      chunks.push(value);
    }
    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const form = new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(body));
    submitted = form.get("connect_key");
  } catch {
    return reply("La solicitud no es válida.", 400);
  }
  if (typeof submitted !== "string") {
    return reply("La solicitud no es válida.", 400);
  }

  if (!constantTimeEqual(submitted, env.TIKTOK_CONNECT_KEY)) {
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip || ip.length > 128) {
      return reply("No se pudo validar la solicitud de forma segura.", 503);
    }
    let attempt;
    try {
      attempt = await recordFailedAttempt(env.TIKTOK_AUTH_DB, await hashIp(ip, env.TIKTOK_CONNECT_KEY), Date.now());
    } catch {
      return reply("No se pudo validar la solicitud de forma segura.", 503);
    }
    if (attempt.attempts > RATE_LIMIT) {
      const retryAfter = Math.max(1, Math.ceil((attempt.window_started_at + RATE_WINDOW_MS - Date.now()) / 1000));
      return reply("Demasiados intentos. Intentá más tarde.", 429, "text/plain; charset=utf-8", {
        "Retry-After": String(retryAfter)
      });
    }
    return reply("Clave de conexión incorrecta.", 403);
  }

  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(stateBytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  const stateHash = await hash(state);
  try {
    await env.TIKTOK_AUTH_DB.prepare(
      "DELETE FROM tiktok_oauth_states WHERE expires_at <= ? OR (used_at IS NOT NULL AND used_at <= ?)"
    ).bind(now, now - 24 * 60 * 60 * 1000).run();
    const saved = await env.TIKTOK_AUTH_DB.prepare(
      "INSERT INTO tiktok_oauth_states (state_hash, redirect_uri, expires_at, used_at) VALUES (?, ?, ?, NULL)"
    ).bind(stateHash, env.TIKTOK_REDIRECT_URI, now + STATE_TTL_MS).run();
    if (saved.success === false) throw new Error("OAuth state storage unavailable.");
  } catch {
    return reply("No se pudo iniciar la conexión de forma segura.", 503);
  }

  const authorize = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authorize.searchParams.set("client_key", env.TIKTOK_CLIENT_KEY);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "user.info.basic,user.info.stats,video.list");
  authorize.searchParams.set("redirect_uri", env.TIKTOK_REDIRECT_URI);
  authorize.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      "Location": authorize.toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer"
    }
  });
}
