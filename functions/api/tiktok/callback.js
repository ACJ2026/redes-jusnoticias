const REDIRECT_PATH = "/api/tiktok/callback";
const STATE_PATTERN = /^[0-9a-f]{64}$/;
const TOKEN_KEY = "oauth-tokens:primary";

const reply = (message, status = 400, type = "text/plain; charset=utf-8") => new Response(message, {
  status,
  headers: {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
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

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeState(db, state, now) {
  const stateHash = await hash(state);
  return db.prepare(`
    UPDATE tiktok_oauth_states
    SET used_at = ?
    WHERE state_hash = ? AND used_at IS NULL AND expires_at > ?
    RETURNING redirect_uri
  `)
    .bind(now, stateHash, now)
    .first();
}

function validTokenResponse(data) {
  return data
    && typeof data.access_token === "string"
    && data.access_token.length > 0
    && typeof data.refresh_token === "string"
    && data.refresh_token.length > 0
    && typeof data.open_id === "string"
    && data.open_id.length > 0
    && Number.isFinite(Number(data.expires_in))
    && Number(data.expires_in) > 0
    && Number.isFinite(Number(data.refresh_expires_in))
    && Number(data.refresh_expires_in) > 0;
}

export async function onRequestGet({ request, env }) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET || !env.TIKTOK_KV || !env.TIKTOK_AUTH_DB
    || !validRedirectUri(env.TIKTOK_REDIRECT_URI)) {
    return reply("La integración de TikTok no está configurada de forma segura en este entorno.", 503);
  }

  const callbackUrl = new URL(request.url);
  if (`${callbackUrl.origin}${callbackUrl.pathname}` !== env.TIKTOK_REDIRECT_URI) {
    return reply("La URL de retorno no coincide con la configuración.", 400);
  }

  const state = callbackUrl.searchParams.get("state") || "";
  if (!STATE_PATTERN.test(state)) {
    return reply("La respuesta de TikTok no es válida. Iniciá la conexión otra vez.");
  }

  let stateData;
  try {
    stateData = await consumeState(env.TIKTOK_AUTH_DB, state, Date.now());
  } catch {
    return reply("No se pudo validar la conexión de forma segura.", 503);
  }
  if (!stateData || stateData.redirect_uri !== env.TIKTOK_REDIRECT_URI) {
    return reply("El estado OAuth venció, ya fue utilizado o no es válido. Iniciá la conexión otra vez.");
  }

  const oauthError = callbackUrl.searchParams.get("error");
  const code = callbackUrl.searchParams.get("code");
  if (oauthError) {
    return reply("TikTok no autorizó la conexión. Volvé al tablero e intentá nuevamente.");
  }
  if (!code || code.length > 2048) {
    return reply("TikTok no devolvió el código OAuth requerido.");
  }

  let tokenResponse;
  let tokenData;
  try {
    tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache"
      },
      body: new URLSearchParams({
        client_key: env.TIKTOK_CLIENT_KEY,
        client_secret: env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: env.TIKTOK_REDIRECT_URI
      })
    });
    tokenData = await tokenResponse.json();
  } catch {
    return reply("No se pudo completar la conexión con TikTok. Iniciá el proceso otra vez.", 502);
  }
  if (!tokenResponse.ok || !validTokenResponse(tokenData)) {
    return reply("TikTok no pudo completar la conexión. Revisá la configuración y los permisos.", 502);
  }

  const now = Date.now();
  const record = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    open_id: tokenData.open_id,
    scope: typeof tokenData.scope === "string" ? tokenData.scope : "",
    access_expires_at: now + Number(tokenData.expires_in) * 1000,
    refresh_expires_at: now + Number(tokenData.refresh_expires_in) * 1000,
    updated_at: new Date(now).toISOString()
  };
  try {
    await env.TIKTOK_KV.put(TOKEN_KEY, JSON.stringify(record));
  } catch {
    return reply("No se pudieron guardar las credenciales de forma segura. Iniciá la conexión otra vez.", 503);
  }

  return reply("<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>TikTok conectado</title><body style=\"font:16px system-ui;max-width:640px;margin:4rem auto;padding:1rem\"><h1>Conexión con TikTok completada</h1><p>La autorización se guardó de forma segura en el servidor. Ya podés volver a Juschubut Noticias y consultar el estado de la integración.</p><p><a href=\"/\">Volver al tablero</a></p></body></html>", 200, "text/html; charset=utf-8");
}
