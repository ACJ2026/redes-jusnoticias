// Métricas de audiencia y búsqueda de JusNoticias.
// Secretos solo en Vercel Environment Variables; nunca enviar claves al navegador.
const crypto = require('crypto');

const b64url = (value) => Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jsonResponse = (res, status, body) => {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
  res.status(status).json(body);
};

function dates(req) {
  const iso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
  const end = iso(req.query.hasta) ? req.query.hasta : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const startDefault = new Date(Date.parse(end + 'T00:00:00Z') - 27 * 86400000).toISOString().slice(0, 10);
  const start = iso(req.query.desde) ? req.query.desde : startDefault;
  const span = (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000;
  if (start > end || span > 89) throw new Error('Rango inválido: use desde/hasta y un máximo de 90 días.');
  return { start, end };
}

async function googleAccessToken(service) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: service.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = head + '.' + claim;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const jwt = unsigned + '.' + signer.sign(service.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('Google OAuth no autorizó la cuenta de servicio: ' + (data.error_description || data.error || response.status));
  return data.access_token;
}

async function googlePost(url, token, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data.error && data.error.message ? data.error.message : 'HTTP ' + response.status;
    throw new Error(message);
  }
  return data;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return jsonResponse(res, 405, { error: 'Método no permitido.' });
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GA4_PROPERTY_ID || !process.env.GSC_SITE_URL) {
    return jsonResponse(res, 503, {
      estado: 'pendiente_configuracion',
      error: 'Faltan variables de entorno: GOOGLE_SERVICE_ACCOUNT_JSON, GA4_PROPERTY_ID y/o GSC_SITE_URL.',
      configuracion: 'Consultar docs/GOOGLE_METRICS.md'
    });
  }
  let range, service;
  try {
    range = dates(req);
    service = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    if (!service.client_email || !service.private_key) throw new Error('El JSON de cuenta de servicio no contiene client_email/private_key.');
  } catch (e) {
    return jsonResponse(res, 400, { estado: 'error_configuracion', error: e.message });
  }
  try {
    const token = await googleAccessToken(service);
    const base = 'https://analyticsdata.googleapis.com/v1beta/properties/' + encodeURIComponent(process.env.GA4_PROPERTY_ID) + ':runReport';
    const runGA = (dimensions, metrics, limit = 10000) => googlePost(base, token, {
      dateRanges: [{ startDate: range.start, endDate: range.end }],
      ...(dimensions.length ? { dimensions: dimensions.map(name => ({ name })) } : {}),
      metrics: metrics.map(name => ({ name })),
      limit
    });
    const [summary, channels, devices, pages, gscSummary, gsc, gscPages] = await Promise.all([
      runGA([], ['totalUsers', 'sessions', 'screenPageViews', 'engagedSessions', 'averageSessionDuration'], 1),
      runGA(['sessionDefaultChannelGroup'], ['totalUsers', 'sessions', 'screenPageViews'], 50),
      runGA(['deviceCategory'], ['totalUsers', 'sessions', 'screenPageViews'], 20),
      runGA(['pageTitle', 'pagePath'], ['totalUsers', 'sessions', 'screenPageViews', 'engagedSessions', 'averageSessionDuration'], 100),
      googlePost('https://searchconsole.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(process.env.GSC_SITE_URL) + '/searchAnalytics/query', token, {
        startDate: range.start, endDate: range.end, rowLimit: 1, dataState: 'final'
      }),
      googlePost('https://searchconsole.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(process.env.GSC_SITE_URL) + '/searchAnalytics/query', token, {
        startDate: range.start, endDate: range.end, dimensions: ['query'], rowLimit: 25, dataState: 'final'
      }),
      googlePost('https://searchconsole.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(process.env.GSC_SITE_URL) + '/searchAnalytics/query', token, {
        startDate: range.start, endDate: range.end, dimensions: ['page'], rowLimit: 25, dataState: 'final'
      })
    ]);
    const metricObj = (row, names) => Object.fromEntries(names.map((name, i) => [name, Number(row && row.metricValues && row.metricValues[i] ? row.metricValues[i].value : 0)]));
    const grouped = (report, labelKey) => (report.rows || []).map(r => ({
      nombre: r.dimensionValues[0].value,
      ...metricObj(r, ['totalUsers', 'sessions', 'screenPageViews'])
    })).sort((a, b) => b.sessions - a.sessions);
    const pageRows = (pages.rows || []).map(r => ({
      titulo: r.dimensionValues[0].value,
      ruta: r.dimensionValues[1].value,
      ...metricObj(r, ['totalUsers', 'sessions', 'screenPageViews', 'engagedSessions', 'averageSessionDuration'])
    })).sort((a, b) => b.screenPageViews - a.screenPageViews).slice(0, 25);
    return jsonResponse(res, 200, {
      estado: 'ok',
      actualizado: new Date().toISOString(),
      rango: range,
      analytics: {
        ...metricObj((summary.rows || [])[0], ['totalUsers', 'sessions', 'screenPageViews', 'engagedSessions', 'averageSessionDuration']),
        canales: grouped(channels, 'sessionDefaultChannelGroup'),
        dispositivos: grouped(devices, 'deviceCategory'),
        paginas: pageRows
      },
      searchConsole: {
        resumen: (gscSummary.rows || [])[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        consultas: (gsc.rows || []).map(r => ({ consulta: r.keys[0], clics: r.clicks, impresiones: r.impressions, ctr: r.ctr, posicion: r.position })),
        paginas: (gscPages.rows || []).map(r => ({ pagina: r.keys[0], clics: r.clicks, impresiones: r.impressions, ctr: r.ctr, posicion: r.position }))
      }
    });
  } catch (e) {
    return jsonResponse(res, 502, { estado: 'error_google', error: e.message, rango: range });
  }
};
