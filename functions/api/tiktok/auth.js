// Inicio de OAuth protegido por una clave de conexión administrativa.
const reply = (message, status = 400, type = "text/plain; charset=utf-8") => new Response(message, {
  status,
  headers: { "Content-Type": type, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
});

export async function onRequestGet({ env }) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET || !env.TIKTOK_KV || !env.TIKTOK_CONNECT_KEY) {
    return reply("TikTok requiere configurar TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_CONNECT_KEY y el binding TIKTOK_KV.", 503);
  }
  return reply(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Conectar TikTok</title><body style="font:16px system-ui;max-width:560px;margin:4rem auto;padding:1rem"><h1>Conectar la cuenta institucional de TikTok</h1><p>Ingresá la clave administrativa de conexión configurada en Cloudflare. Esta clave no es la Client Secret de TikTok.</p><form method="post" action="/api/tiktok/auth"><label for="connect_key">Clave de conexión</label><p><input id="connect_key" name="connect_key" type="password" autocomplete="current-password" required style="width:100%;padding:.7rem"></p><button type="submit" style="padding:.7rem 1rem">Continuar a TikTok</button></form></body></html>`, 200, "text/html; charset=utf-8");
}

export async function onRequestPost({ request, env }) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET || !env.TIKTOK_KV || !env.TIKTOK_CONNECT_KEY) {
    return reply("TikTok no está configurado en el servidor.", 503);
  }
  const form = await request.formData();
  const submitted = String(form.get("connect_key") || "");
  if (submitted.length !== env.TIKTOK_CONNECT_KEY.length) return reply("Clave de conexión incorrecta.", 403);
  const a = new TextEncoder().encode(submitted);
  const b = new TextEncoder().encode(env.TIKTOK_CONNECT_KEY);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return reply("Clave de conexión incorrecta.", 403);

  const url = new URL(request.url);
  const redirectUri = env.TIKTOK_REDIRECT_URI || new URL("/api/tiktok/callback", url.origin).href;
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(stateBytes, byte => byte.toString(16).padStart(2, "0")).join("");
  await env.TIKTOK_KV.put("oauth-state:" + state, JSON.stringify({ redirectUri, createdAt: Date.now() }), { expirationTtl: 600 });
  const authorize = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authorize.searchParams.set("client_key", env.TIKTOK_CLIENT_KEY);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "user.info.basic,user.info.stats,video.list");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  return Response.redirect(authorize.toString(), 302);
}
