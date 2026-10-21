// Mini servicio del tablero JusNoticias: devuelve los números de Facebook, Instagram y YouTube.
// Las credenciales se configuran solo en el entorno del servidor:
//   META_TOKEN   = token de Meta con permisos mínimos necesarios
//   YT_KEY       = clave de la API de YouTube (opcional)
//   YT_CANAL_ID  = ID confirmado del canal JusNoticias Prensa (no usar el canal general por defecto)
const G = 'https://graph.facebook.com/v26.0';
const FB_PAGE = process.env.FB_PAGE_ID || '116101835114568';   // página JusNoticias
const IG_USER = process.env.IG_USER_ID || '17841410514175238'; // Instagram jus_chubut
const YT_CANAL = process.env.YT_CANAL_ID;

async function get(url, token) {
  // Nunca enviar tokens de Meta en la URL: proxies y logs suelen registrar la query string.
  const safeUrl = new URL(url);
  safeUrl.searchParams.delete('access_token');
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  const r = await fetch(safeUrl.toString(), { headers });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
  return j;
}
const corto = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 26);

async function facebook(desde) {
  const id = FB_PAGE;
  // La "nueva experiencia de páginas" exige un token de la página: se obtiene en el momento.
  const metaToken = process.env.META_TOKEN;
  if (!metaToken) throw new Error('Falta configurar META_TOKEN.');
  const t = (await get(`${G}/${id}?fields=access_token`, metaToken)).access_token;
  if (!t) throw new Error('Meta no devolvió un token de página.');
  const page = await get(`${G}/${id}?fields=name,followers_count,fan_count`, t);
  const filas = [];
  let url = `${G}/${id}/posts?fields=created_time,message,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)&since=${desde}&limit=100`;
  for (let i = 0; url && i < 10; i++) {
    const j = await get(url, t);
    j.data.forEach((p) => filas.push({
      red: 'Facebook', cuenta: 'JusNoticias (prensastjchubut)', fecha: p.created_time.slice(0, 10), texto: corto(p.message),
      nota_id: null, me_gusta: p.reactions ? p.reactions.summary.total_count : null,
      comentarios: p.comments ? p.comments.summary.total_count : null, compartidos: p.shares ? p.shares.count : 0,
      vistas: null, propia: 'Sí', key: 'fb-' + p.id,
    }));
    url = j.paging && j.paging.next;
  }
  return { filas, seguidores: page.followers_count ?? page.fan_count ?? null };
}

async function instagram(desde) {
  const t = process.env.META_TOKEN, id = IG_USER;
  if (!t) throw new Error('Falta configurar META_TOKEN.');
  const cuenta = await get(`${G}/${id}?fields=username,followers_count`, t);
  const filas = [];
  let url = `${G}/${id}/media?fields=timestamp,caption,like_count,comments_count&limit=100`;
  for (let i = 0; url && i < 10; i++) {
    const j = await get(url, t);
    const dentro = j.data.filter((m) => m.timestamp.slice(0, 10) >= desde);
    dentro.forEach((m) => filas.push({
      red: 'Instagram', cuenta: cuenta.username, fecha: m.timestamp.slice(0, 10), texto: corto(m.caption),
      nota_id: null, me_gusta: m.like_count ?? null, comentarios: m.comments_count ?? null, compartidos: null,
      vistas: null, propia: 'Sí', key: 'ig-' + m.id,
    }));
    if (dentro.length < j.data.length) break;
    url = j.paging && j.paging.next;
  }
  return { filas, seguidores: cuenta.followers_count ?? null };
}

async function youtube(desde) {
  const k = process.env.YT_KEY, Y = 'https://www.googleapis.com/youtube/v3';
  if (!k) throw new Error('Falta configurar YT_KEY.');
  if (!YT_CANAL) throw new Error('Falta configurar YT_CANAL_ID con el ID verificado de JusNoticias Prensa.');
  const canales = (await get(`${Y}/channels?part=statistics,contentDetails&id=${YT_CANAL}&key=${k}`)).items || [];
  if (!canales.length) throw new Error('No se encontró el canal indicado por YT_CANAL_ID. Verificar el ID de JusNoticias Prensa.');
  const ch = canales[0];
  const up = ch.contentDetails.relatedPlaylists.uploads, ids = [];
  let tok = '';
  for (let i = 0; i < 10; i++) {
    const j = await get(`${Y}/playlistItems?part=contentDetails&playlistId=${up}&maxResults=50&key=${k}${tok ? '&pageToken=' + tok : ''}`);
    const cs = j.items.map((x) => x.contentDetails);
    cs.filter((c) => (c.videoPublishedAt || '').slice(0, 10) >= desde).forEach((c) => ids.push(c.videoId));
    if (!j.nextPageToken || cs.every((c) => (c.videoPublishedAt || '').slice(0, 10) < desde)) break;
    tok = j.nextPageToken;
  }
  const filas = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await get(`${Y}/videos?part=snippet,statistics&id=${ids.slice(i, i + 50).join(',')}&key=${k}`);
    j.items.forEach((v) => {
      const s = v.statistics, n = (x) => (s[x] !== undefined ? Number(s[x]) : null);
      filas.push({ red: 'YouTube', cuenta: 'JusNoticias Prensa', fecha: v.snippet.publishedAt.slice(0, 10), texto: corto(v.snippet.title),
        nota_id: null, me_gusta: n('likeCount'), comentarios: n('commentCount'), compartidos: null, vistas: n('viewCount'), propia: 'Sí', key: 'yt-' + v.id });
    });
  }
  return { filas, seguidores: Number(ch.statistics.subscriberCount) || null };
}

module.exports = async (req, res) => {
  const paramDesde = req.query.desde;
  const esFechaValida = (v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
    const d = new Date(v + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  };
  if (paramDesde && !esFechaValida(paramDesde)) return res.status(400).json({ error: "'desde' debe ser una fecha válida con formato AAAA-MM-DD." });
  const desde = paramDesde || new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
  const dias = (Date.now() - new Date(desde + 'T00:00:00Z').getTime()) / 86400000;
  if (dias < 0 || dias > 90) return res.status(400).json({ error: "'desde' debe estar entre hoy y los últimos 90 días." });
  const out = { actualizado: new Date().toISOString(), desde, redes: {}, errores: {} };
  // Ejecutar siempre las tres plataformas: una credencial ausente debe figurar
  // como error explícito y nunca desaparecer como si la integración no existiera.
  const tareas = { Facebook: facebook, Instagram: instagram, YouTube: youtube };
  await Promise.all(Object.entries(tareas).map(async ([red, fn]) => {
    try { out.redes[red] = await fn(desde); } catch (e) { out.errores[red] = e.message; }
  }));
  res.setHeader('Cache-Control', Object.keys(out.errores).length ? 'no-store' : 's-maxage=600');
  res.status(200).json(out);
};
