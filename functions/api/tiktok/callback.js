// Callback OAuth de TikTok. Los tokens quedan solo en KV del servidor; nunca se devuelven al navegador.
const reply = (message, status = 400) => new Response(message, {
  status,
  headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
});

export async function onRequestGet({ request, env }) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET || !env.TIKTOK_KV) {
    return reply("La integración de TikTok todavía no está configurada en el servidor.", 503);
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (oauthError) return reply("TikTok no autorizó la conexión. Volvé al tablero e intentá nuevamente.");
  if (!code || !state) return reply("TikTok no devolvió el código y el estado OAuth requeridos.");
  const stateKey = "oauth-state:" + state;
  const stateRaw = await env.TIKTOK_KV.get(stateKey);
  if (!stateRaw) return reply("El estado OAuth venció o no es válido. Iniciá la conexión otra vez.");
  await env.TIKTOK_KV.delete(stateKey);
  let stateData;
  try { stateData = JSON.parse(stateRaw); } catch { return reply("No se pudo validar la solicitud OAuth."); }
  const expectedRedirect = env.TIKTOK_REDIRECT_URI || new URL("/api/tiktok/callback", url.origin).href;
  if (stateData.redirectUri !== expectedRedirect) return reply("La URL de retorno configurada no coincide.");
  const body = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    client_secret: env.TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: expectedRedirect
  });
  const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token || !tokenData.refresh_token || !tokenData.open_id) {
    return reply("TikTok no pudo completar el intercambio OAuth. Revisá la Client Key, la URL de retorno y los permisos.", 502);
  }
  const record = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    open_id: tokenData.open_id,
    scope: tokenData.scope || "",
    access_expires_at: Date.now() + Number(tokenData.expires_in || 86400) * 1000,
    refresh_expires_at: Date.now() + Number(tokenData.refresh_expires_in || 31536000) * 1000,
    updated_at: new Date().toISOString()
  };
  await env.TIKTOK_KV.put("oauth-tokens:primary", JSON.stringify(record));
  return new Response("<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>TikTok conectado</title><body style=\"font:16px system-ui;max-width:640px;margin:4rem auto;padding:1rem\"><h1>Conexión con TikTok completada</h1><p>La autorización se guardó de forma segura en el servidor. Ya podés volver a Juschubut Noticias y consultar el estado de la integración.</p><p><a href=\"/\">Volver al tablero</a></p></body></html>", {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
  });
}
