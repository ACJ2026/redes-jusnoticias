// Inicia OAuth de TikTok. Requiere un binding KV llamado TIKTOK_KV.
const reply = (message, status = 500) => new Response(message, {
  status,
  headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
});

export async function onRequestGet({ request, env }) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
    return reply("TikTok no está configurado: faltan TIKTOK_CLIENT_KEY o TIKTOK_CLIENT_SECRET.", 503);
  }
  if (!env.TIKTOK_KV) {
    return reply("Falta configurar el almacenamiento seguro TIKTOK_KV en Cloudflare Pages.", 503);
  }
  const url = new URL(request.url);
  const redirectUri = env.TIKTOK_REDIRECT_URI || new URL("/api/tiktok/callback", url.origin).href;
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(stateBytes, b => b.toString(16).padStart(2, "0")).join("");
  await env.TIKTOK_KV.put("oauth-state:" + state, JSON.stringify({ redirectUri, createdAt: Date.now() }), { expirationTtl: 600 });
  const authorize = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authorize.searchParams.set("client_key", env.TIKTOK_CLIENT_KEY);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "user.info.basic,user.info.stats,video.list");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  return Response.redirect(authorize.toString(), 302);
}
