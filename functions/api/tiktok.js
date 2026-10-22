// Consulta la Display API de TikTok. Los tokens se almacenan exclusivamente en TIKTOK_KV.
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function loadTokens(env) {
  if (!env.TIKTOK_KV) throw new Error("Falta configurar el almacenamiento seguro TIKTOK_KV en Cloudflare Pages.");
  const raw = await env.TIKTOK_KV.get("oauth-tokens:primary");
  if (!raw) throw new Error("TikTok todavía no está autorizado. Iniciá la conexión desde /api/tiktok/auth.");
  let tokens;
  try { tokens = JSON.parse(raw); } catch { throw new Error("El registro de autorización de TikTok no es válido."); }
  if (Date.now() >= Number(tokens.refresh_expires_at || 0)) {
    throw new Error("La autorización de TikTok venció. Volvé a conectar la cuenta desde /api/tiktok/auth.");
  }
  if (Date.now() >= Number(tokens.access_expires_at || 0) - 300000) {
    const body = new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token
    });
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body
    });
    const fresh = await response.json();
    if (!response.ok || !fresh.access_token || !fresh.refresh_token) {
      throw new Error("No se pudo renovar el acceso de TikTok. Volvé a autorizar la cuenta.");
    }
    tokens = {
      ...tokens,
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token,
      open_id: fresh.open_id || tokens.open_id,
      scope: fresh.scope || tokens.scope,
      access_expires_at: Date.now() + Number(fresh.expires_in || 86400) * 1000,
      refresh_expires_at: Date.now() + Number(fresh.refresh_expires_in || 31536000) * 1000,
      updated_at: new Date().toISOString()
    };
    await env.TIKTOK_KV.put("oauth-tokens:primary", JSON.stringify(tokens));
  }
  return tokens;
}

export async function getTikTokData(env) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
    throw new Error("Falta configurar TIKTOK_CLIENT_KEY o TIKTOK_CLIENT_SECRET.");
  }
  const tokens = await loadTokens(env);
  const headers = { Authorization: "Bearer " + tokens.access_token };
  const profileUrl = new URL("https://open.tiktokapis.com/v2/user/info/");
  profileUrl.searchParams.set("fields", "open_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count");
  const profileResponse = await fetch(profileUrl, { headers });
  const profilePayload = await profileResponse.json();
  if (!profileResponse.ok || profilePayload.error?.code && profilePayload.error.code !== "ok") {
    throw new Error("TikTok no pudo devolver los datos del perfil. Verificá los permisos aprobados.");
  }
  const profile = profilePayload.data?.user;
  if (!profile) throw new Error("TikTok no devolvió información del perfil autorizado.");

  const videoUrl = new URL("https://open.tiktokapis.com/v2/video/list/");
  videoUrl.searchParams.set("fields", "id,title,video_description,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count");
  const rawVideos = [];
  let cursor = null;
  let hasMore = true;
  for (let page = 0; page < 5 && hasMore; page++) {
    const body = { max_count: 20 };
    if (cursor !== null) body.cursor = cursor;
    const videoResponse = await fetch(videoUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const videoPayload = await videoResponse.json();
    if (!videoResponse.ok || videoPayload.error?.code && videoPayload.error.code !== "ok") {
      throw new Error("TikTok no pudo devolver los videos. Verificá que video.list esté autorizado.");
    }
    rawVideos.push(...(videoPayload.data?.videos || []));
    cursor = videoPayload.data?.cursor ?? null;
    hasMore = Boolean(videoPayload.data?.has_more);
  }
  const videos = rawVideos.map(video => ({
    id: video.id,
    title: video.title || video.video_description || "",
    fecha: video.create_time ? new Date(video.create_time * 1000).toISOString().slice(0, 10) : null,
    url: video.share_url || null,
    portada: video.cover_image_url || null,
    vistas: Number.isFinite(video.view_count) ? video.view_count : null,
    me_gusta: Number.isFinite(video.like_count) ? video.like_count : null,
    comentarios: Number.isFinite(video.comment_count) ? video.comment_count : null,
    compartidos: Number.isFinite(video.share_count) ? video.share_count : null
  }));
  return {
    estado: "disponible",
    perfil: {
      open_id: profile.open_id,
      nombre: profile.display_name || null,
      usuario: profile.username || null,
      avatar: profile.avatar_url || null,
      seguidores: Number.isFinite(profile.follower_count) ? profile.follower_count : null,
      seguidos: Number.isFinite(profile.following_count) ? profile.following_count : null,
      me_gusta_total: Number.isFinite(profile.likes_count) ? profile.likes_count : null,
      videos_total: Number.isFinite(profile.video_count) ? profile.video_count : null
    },
    videos,
    actualizado: new Date().toISOString(),
    scopes: tokens.scope.split(",").filter(Boolean)
  };
}

export async function onRequestGet({ env }) {
  try {
    return json(await getTikTokData(env));
  } catch (error) {
    return json({
      estado: "no_disponible",
      error: error instanceof Error ? error.message : "No se pudo consultar TikTok.",
      perfil: null,
      videos: []
    }, 200);
  }
}
