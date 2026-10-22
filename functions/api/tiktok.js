const TOKEN_KEY = "oauth-tokens:primary";
const REFRESH_SKEW_MS = 5 * 60 * 1000;
const REFRESH_LOCK_MS = 30 * 1000;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

function validStoredTokens(tokens) {
  return tokens
    && typeof tokens.access_token === "string"
    && tokens.access_token.length > 0
    && typeof tokens.refresh_token === "string"
    && tokens.refresh_token.length > 0
    && typeof tokens.open_id === "string"
    && tokens.open_id.length > 0
    && Number.isFinite(Number(tokens.access_expires_at))
    && Number(tokens.access_expires_at) > 0
    && Number.isFinite(Number(tokens.refresh_expires_at))
    && Number(tokens.refresh_expires_at) > 0;
}

async function readTokens(env) {
  const raw = await env.TIKTOK_KV.get(TOKEN_KEY);
  if (!raw) throw new Error("Tokens are not available.");
  let tokens;
  try {
    tokens = JSON.parse(raw);
  } catch {
    throw new Error("Stored authorization is invalid.");
  }
  if (!validStoredTokens(tokens)) throw new Error("Stored authorization is invalid.");
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    open_id: tokens.open_id,
    scope: typeof tokens.scope === "string" ? tokens.scope : "",
    access_expires_at: Number(tokens.access_expires_at),
    refresh_expires_at: Number(tokens.refresh_expires_at),
    updated_at: typeof tokens.updated_at === "string" ? tokens.updated_at : ""
  };
}

async function getRefreshLock(db, lockToken, now) {
  return db.prepare(`
    INSERT INTO tiktok_token_refresh_lock (id, lock_token, locked_until)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      lock_token = excluded.lock_token,
      locked_until = excluded.locked_until
    WHERE tiktok_token_refresh_lock.locked_until <= ?
    RETURNING id
  `)
    .bind(lockToken, now + REFRESH_LOCK_MS, now)
    .first();
}

async function releaseRefreshLock(db, lockToken) {
  await db.prepare("DELETE FROM tiktok_token_refresh_lock WHERE id = 1 AND lock_token = ?")
    .bind(lockToken)
    .run();
}

async function waitForRefresh(env, previousUpdatedAt) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const tokens = await readTokens(env);
    if (tokens.updated_at !== previousUpdatedAt && tokens.access_expires_at > Date.now()) return tokens;
  }
  throw new Error("Token refresh is already in progress.");
}

async function refreshTokens(env, tokens) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET || !env.TIKTOK_AUTH_DB) {
    throw new Error("Refresh configuration is incomplete.");
  }
  const lockToken = crypto.randomUUID();
  const now = Date.now();
  const lock = await getRefreshLock(env.TIKTOK_AUTH_DB, lockToken, now);
  if (!lock) return waitForRefresh(env, tokens.updated_at);

  try {
    const latest = await readTokens(env);
    if (latest.updated_at !== tokens.updated_at && latest.access_expires_at > Date.now()) return latest;
    if (latest.refresh_expires_at <= Date.now()) throw new Error("Refresh authorization expired.");

    let response;
    let fresh;
    try {
      response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cache-Control": "no-cache"
        },
        body: new URLSearchParams({
          client_key: env.TIKTOK_CLIENT_KEY,
          client_secret: env.TIKTOK_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: latest.refresh_token
        })
      });
      fresh = await response.json();
    } catch {
      throw new Error("Token refresh failed.");
    }
    if (fresh?.error === "invalid_grant") {
      await env.TIKTOK_KV.delete(TOKEN_KEY);
      throw new Error("Reauthorization is required.");
    }
    if (!response.ok
      || !fresh
      || typeof fresh.access_token !== "string"
      || !fresh.access_token
      || typeof fresh.refresh_token !== "string"
      || !fresh.refresh_token
      || !Number.isFinite(Number(fresh.expires_in))
      || Number(fresh.expires_in) <= 0
      || !Number.isFinite(Number(fresh.refresh_expires_in))
      || Number(fresh.refresh_expires_in) <= 0) {
      throw new Error("Token refresh failed.");
    }

    const updatedAt = Date.now();
    const updated = {
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token,
      open_id: typeof fresh.open_id === "string" && fresh.open_id ? fresh.open_id : latest.open_id,
      scope: typeof fresh.scope === "string" ? fresh.scope : latest.scope,
      access_expires_at: updatedAt + Number(fresh.expires_in) * 1000,
      refresh_expires_at: updatedAt + Number(fresh.refresh_expires_in) * 1000,
      updated_at: new Date(updatedAt).toISOString()
    };
    await env.TIKTOK_KV.put(TOKEN_KEY, JSON.stringify(updated));
    return updated;
  } finally {
    await releaseRefreshLock(env.TIKTOK_AUTH_DB, lockToken);
  }
}

async function loadTokens(env) {
  if (!env.TIKTOK_KV) throw new Error("Token storage is unavailable.");
  const tokens = await readTokens(env);
  const now = Date.now();
  if (tokens.access_expires_at > now + REFRESH_SKEW_MS
    || tokens.access_expires_at > now && tokens.refresh_expires_at <= now + REFRESH_SKEW_MS) {
    return tokens;
  }
  if (tokens.refresh_expires_at <= now) {
    await env.TIKTOK_KV.delete(TOKEN_KEY);
    throw new Error("Reauthorization is required.");
  }
  return refreshTokens(env, tokens);
}

async function fetchJson(url, options) {
  let response;
  let payload;
  try {
    response = await fetch(url, options);
    payload = await response.json();
  } catch {
    throw new Error("TikTok API request failed.");
  }
  if (!response.ok || payload?.error?.code && payload.error.code !== "ok") {
    throw new Error("TikTok API request failed.");
  }
  return payload;
}

function optionalCount(value) {
  return Number.isFinite(value) ? value : null;
}

function videoDate(value) {
  if (!Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export async function getTikTokData(env) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
    throw new Error("TikTok credentials are unavailable.");
  }
  const tokens = await loadTokens(env);
  const headers = { Authorization: "Bearer " + tokens.access_token };
  const profileUrl = new URL("https://open.tiktokapis.com/v2/user/info/");
  profileUrl.searchParams.set("fields", "open_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count");
  const profilePayload = await fetchJson(profileUrl, { headers });
  const profile = profilePayload.data?.user;
  if (!profile || typeof profile !== "object") throw new Error("TikTok profile is unavailable.");

  const videoUrl = new URL("https://open.tiktokapis.com/v2/video/list/");
  videoUrl.searchParams.set("fields", "id,title,video_description,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count");
  const rawVideos = [];
  let cursor = null;
  let hasMore = true;
  for (let page = 0; page < 5 && hasMore; page++) {
    const body = { max_count: 20 };
    if (cursor !== null) body.cursor = cursor;
    const videoPayload = await fetchJson(videoUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = videoPayload.data;
    if (!data || typeof data !== "object") throw new Error("TikTok videos are unavailable.");
    if (data.videos !== undefined && !Array.isArray(data.videos)) throw new Error("TikTok videos are invalid.");
    rawVideos.push(...(data.videos || []));
    cursor = data.cursor ?? null;
    hasMore = Boolean(data.has_more);
  }
  const videos = rawVideos.map(video => ({
    id: video?.id || null,
    title: video?.title || video?.video_description || "",
    fecha: videoDate(video?.create_time),
    url: video?.share_url || null,
    portada: video?.cover_image_url || null,
    vistas: optionalCount(video?.view_count),
    me_gusta: optionalCount(video?.like_count),
    comentarios: optionalCount(video?.comment_count),
    compartidos: optionalCount(video?.share_count)
  }));
  return {
    estado: "disponible",
    perfil: {
      open_id: profile.open_id || null,
      nombre: profile.display_name || null,
      usuario: null,
      avatar: profile.avatar_url || null,
      seguidores: optionalCount(profile.follower_count),
      seguidos: optionalCount(profile.following_count),
      me_gusta_total: optionalCount(profile.likes_count),
      videos_total: optionalCount(profile.video_count)
    },
    videos,
    actualizado: new Date().toISOString(),
    scopes: tokens.scope.split(",").filter(Boolean)
  };
}

export async function onRequestGet({ env }) {
  try {
    return json(await getTikTokData(env));
  } catch {
    return json({
      estado: "no_disponible",
      error: "TikTok no está disponible temporalmente. Si el problema persiste, volvé a conectar la cuenta.",
      perfil: null,
      videos: []
    }, 200);
  }
}
