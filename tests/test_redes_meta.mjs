import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

async function importHandler(path) {
  const source = await readFile(new URL(path, ROOT), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const redes = await importHandler("functions/api/redes.js");

const PAGE_1 = "111";
const PAGE_2 = "222";
const IG = "333";
const USER_TOKEN = "EAAusertokenparaprueba1234567890";

async function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

const ok = body => new Response(JSON.stringify(body), { status: 200 });
const metaError = (message, code = 100) => new Response(JSON.stringify({ error: { message, type: "OAuthException", code } }), { status: 400 });

// Simula Graph API: cada página devuelve su token, datos básicos, sin publicaciones e Insights.
function meta({ insights = {}, failToken = [], igInsights = {} } = {}) {
  const requests = [];
  const handler = async (input, options = {}) => {
    const url = new URL(String(input));
    const auth = (options.headers && options.headers.Authorization) || "";
    requests.push({ url: url.toString(), auth });
    const [, , pageId, edge] = url.pathname.split("/");
    if (url.hostname !== "graph.facebook.com") throw new Error("Llamada inesperada a " + url.hostname);
    if (pageId === IG) {
      if (!edge) return ok({ username: "jus_chubut", followers_count: 2610 });
      if (edge === "media") return ok({ data: [] });
      if (edge === "insights") {
        const metric = url.searchParams.get("metric");
        const value = igInsights[metric];
        if (value instanceof Error) return metaError(value.message);
        if (value === undefined) return ok({ data: [] });
        return ok({ data: [{ name: metric, total_value: { value } }] });
      }
    }
    if (!edge && url.searchParams.get("fields") === "access_token") {
      if (failToken.includes(pageId)) return metaError("(#100) Missing Permission");
      return ok({ id: pageId, access_token: "EAApagetoken" + pageId + "abcdefghijklmnopqrstuv" });
    }
    if (!edge) return ok({ id: pageId, name: "Página " + pageId, followers_count: pageId === PAGE_1 ? 1000 : 500 });
    if (edge === "posts") return ok({ data: [{ id: pageId + "_1", created_time: new Date().toISOString(), message: "Publicación" }] });
    if (edge === "insights") {
      const metric = url.searchParams.get("metric");
      const spec = (insights[pageId] || {})[metric];
      if (spec instanceof Error) return metaError(spec.message, 190);
      if (spec === undefined) return ok({ data: [] });
      return ok({ data: [{ name: metric, period: "days_28", values: spec }] });
    }
    throw new Error("Ruta no simulada: " + url.pathname);
  };
  return { requests, handler };
}

const env = {
  META_TOKEN: USER_TOKEN,
  FB_PAGE_ID: PAGE_1,
  FB_PAGE_ID_2: PAGE_2,
  IG_USER_ID: IG,
  X_BEARER_TOKEN: "x-token",
  YT_KEY: "yt-key",
  YT_CANAL_ID: "canal"
};

const call = (path, mock, customEnv = env) => withFetch(mock.handler, () => redes.onRequestGet({
  request: new Request("https://example.test" + path),
  env: customEnv
}));

test("Facebook days_28 toma el último acumulado móvil y no suma valores", async () => {
  const mock = meta({
    insights: {
      [PAGE_1]: {
        page_media_view: [
          { value: 1200, end_time: "2026-10-21T07:00:00+0000" },
          { value: 1000, end_time: "2026-10-20T07:00:00+0000" }
        ],
        page_post_engagements: [{ value: 0, end_time: "2026-10-21T07:00:00+0000" }],
        page_views_total: [{ value: 30, end_time: "2026-10-21T07:00:00+0000" }]
      },
      [PAGE_2]: {}
    }
  });
  const body = await (await call("/api/redes?redes=Facebook", mock)).json();
  const page = body.redes.Facebook.paginas.find(p => p.id === PAGE_1);
  assert.equal(page.insights.page_media_view, 1200);
  assert.equal(page.insights.page_post_engagements, 0, "un cero real que informa Meta se conserva");
  assert.equal(page.insightsHasta, "2026-10-21");
  assert.equal(page.insightsPeriodo, "days_28");
});

test("Insights de Facebook nunca usa el token de usuario y aísla cada página", async () => {
  const mock = meta({ insights: { [PAGE_1]: {}, [PAGE_2]: {} } });
  await call("/api/redes?redes=Facebook", mock);
  const insightsCalls = mock.requests.filter(r => r.url.includes("/insights"));
  assert.equal(insightsCalls.length, 6);
  for (const request of insightsCalls) {
    assert.notEqual(request.auth, "Bearer " + USER_TOKEN);
    const pageId = new URL(request.url).pathname.split("/")[2];
    assert.ok(request.auth.includes("EAApagetoken" + pageId), "cada página usa su propio token");
  }
});

test("métrica con error o ausente queda en null con su mensaje, sin tokens y sin cero", async () => {
  const mock = meta({
    insights: {
      [PAGE_1]: {
        page_media_view: new Error(`(#190) This method must be called with a Page Access Token access_token=${USER_TOKEN}`),
        page_post_engagements: [{ value: "n/d", end_time: "2026-10-21T07:00:00+0000" }]
      },
      [PAGE_2]: {}
    }
  });
  const response = await call("/api/redes?redes=Facebook", mock);
  const text = await response.text();
  const body = JSON.parse(text);
  const page = body.redes.Facebook.paginas.find(p => p.id === PAGE_1);
  assert.equal(page.insights.page_media_view, null);
  assert.equal(page.insights.page_post_engagements, null);
  assert.equal(page.insights.page_views_total, null);
  assert.match(page.insightsErrores.page_media_view, /^\(#190\) This method must be called with a Page Access Token/);
  assert.match(page.insightsErrores.page_post_engagements, /sin valores numéricos/);
  assert.match(page.insightsErrores.page_views_total, /no devolvió esta métrica/);
  assert.doesNotMatch(text, /EAAusertoken|EAApagetoken/);
  assert.equal(response.headers.get("Cache-Control"), "s-maxage=600");
});

test("si una página falla se conservan los datos de la otra", async () => {
  const mock = meta({
    failToken: [PAGE_2],
    insights: { [PAGE_1]: { page_views_total: [{ value: 30, end_time: "2026-10-21T07:00:00+0000" }] } }
  });
  const response = await call("/api/redes?redes=Facebook", mock);
  const body = await response.json();
  const fb = body.redes.Facebook;
  assert.equal(body.errores.Facebook, undefined);
  assert.equal(fb.parcial, true);
  assert.equal(fb.seguidores, null, "no se informa un total con una página faltante");
  assert.equal(fb.paginas.length, 2);
  assert.equal(fb.paginas[0].nombre, "Página " + PAGE_1);
  assert.equal(fb.paginas[0].insights.page_views_total, 30);
  assert.match(fb.paginas[1].error, /No se pudo obtener el token de la página 222: \(#100\) Missing Permission/);
  assert.ok(fb.filas.length > 0 && fb.filas.every(f => f.cuenta === "Página " + PAGE_1), "no se mezclan filas de páginas");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("si fallan ambas páginas Facebook informa un error con el detalle de cada una", async () => {
  const mock = meta({ failToken: [PAGE_1, PAGE_2] });
  const body = await (await call("/api/redes?redes=Facebook", mock)).json();
  assert.equal(body.redes.Facebook, undefined);
  assert.match(body.errores.Facebook, /Ninguna página de Facebook respondió/);
  assert.match(body.errores.Facebook, /111: .*Missing Permission/);
  assert.match(body.errores.Facebook, /222: .*Missing Permission/);
});

test("con las dos páginas completas suma seguidores", async () => {
  const mock = meta({ insights: { [PAGE_1]: {}, [PAGE_2]: {} } });
  const body = await (await call("/api/redes?redes=Facebook", mock)).json();
  assert.equal(body.redes.Facebook.seguidores, 1500);
  assert.equal(body.redes.Facebook.parcial, false);
});

test("Instagram limita Insights a 28 días aunque el período pedido sea mayor", async () => {
  const mock = meta({ igInsights: { reach: 2344, views: 44072, accounts_engaged: new Error("(#100) metric no disponible") } });
  const body = await (await call("/api/redes?redes=Instagram", mock)).json();
  const ig = body.redes.Instagram;
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = new Date(Date.parse(hoy + "T00:00:00Z") - 28 * 86400000).toISOString().slice(0, 10);
  assert.equal(ig.insightsHasta, hoy);
  assert.equal(ig.insightsDesde, desde);
  assert.equal(ig.insightsRecortado, true);
  const calls = mock.requests.filter(r => r.url.includes(`/${IG}/insights`));
  assert.equal(calls.length, 4);
  for (const request of calls) {
    const params = new URL(request.url).searchParams;
    assert.equal(params.get("since"), desde);
    assert.equal(params.get("until"), hoy);
    assert.equal(params.get("metric_type"), "total_value");
  }
  assert.equal(ig.insights.reach, 2344);
  assert.equal(ig.insights.views, 44072);
  assert.equal(ig.insights.accounts_engaged, null);
  assert.match(ig.insightsErrores.accounts_engaged, /metric no disponible/);
  assert.equal(ig.insights.total_interactions, null);
  assert.match(ig.insightsErrores.total_interactions, /no devolvió esta métrica/);
});

test("Instagram respeta un período pedido menor a 28 días", async () => {
  const mock = meta({ igInsights: { reach: 10 } });
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = new Date(Date.parse(hoy + "T00:00:00Z") - 7 * 86400000).toISOString().slice(0, 10);
  const body = await (await call(`/api/redes?redes=Instagram&desde=${desde}`, mock)).json();
  assert.equal(body.redes.Instagram.insightsDesde, desde);
  assert.equal(body.redes.Instagram.insightsRecortado, false);
});

test("?redes=Facebook,Instagram no consulta X ni YouTube", async () => {
  const mock = meta({ insights: { [PAGE_1]: {}, [PAGE_2]: {} } });
  const body = await (await call("/api/redes?redes=Facebook,Instagram", mock)).json();
  assert.deepEqual(body.consultadas, ["Facebook", "Instagram"]);
  assert.ok(mock.requests.every(r => new URL(r.url).hostname === "graph.facebook.com"));
  assert.equal(body.redes.X, undefined);
  assert.equal(body.errores.X, undefined);
  assert.equal(body.redes.YouTube, undefined);
});

test("?redes con un valor desconocido se rechaza sin llamadas externas", async () => {
  const mock = meta();
  const response = await call("/api/redes?redes=Facebook,TikTok", mock);
  assert.equal(response.status, 400);
  assert.equal(mock.requests.length, 0);
});

test("el tablero muestra Insights de Facebook por página y marca los faltantes como no disponibles", async () => {
  for (const path of ["templates/tablero.html", "publico/tablero_publico.html", "publico/index.html"]) {
    const html = await readFile(new URL(path, ROOT), "utf8");
    assert.match(html, /const resumenInsights = \(red, result, data\) =>/, path);
    assert.match(html, /red === 'Facebook' && Array\.isArray\(result\.paginas\)/, path);
    assert.match(html, /'no disponible'/, path);
    assert.match(html, /page_media_view: 'Visualizaciones de contenido'/, path);
    assert.match(html, /insights: resumenInsights\(red, result, data\)/, path);
    assert.match(html, /result\.parcial/, path);
  }
});
