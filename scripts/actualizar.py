# Ajuste de publicación JusNoticias: ejecutar relevamiento real al activar esta rama.
#!/usr/bin/env python3
"""Actualiza los datos del tablero de repercusión de JusNoticias.
Uso: python3 actualizar.py <carpeta_salida> [rep_anterior.json]
Genera notas2.json, rep2.json y medios.json en la carpeta de salida.
"""
import json, re, sys, os, gzip, html, unicodedata, time, math, datetime as dt
import urllib.request, urllib.parse
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from fuentes import exigir_lista_json
from relevancia_publicaciones import evidencia_misma_nota

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
PREV = sys.argv[2] if len(sys.argv) > 2 else None
DESDE = '2026-02-01'
UA = {'User-Agent': 'Mozilla/5.0 (JusNoticias monitoreo)'}

def get(url, binary=False, timeout=30, tries=2):
    for _ in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                b = r.read()
                if binary: return b
                cs = r.headers.get_content_charset() or 'utf-8'
                return b.decode(cs, 'replace')
        except Exception:
            time.sleep(1)
    return None

def getj(url):
    t = get(url)
    try: return json.loads(t) if t else None
    except Exception: return None

def strip(h): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h or ''))).strip()
def norm(s): return re.sub(r'[^a-z0-9 ]', ' ', unicodedata.normalize('NFD', (s or '').lower()).encode('ascii', 'ignore').decode())
STOP = set('para sobre desde entre donde porque cuando hasta durante contra juzgado juzgados justicia judicial poder chubut provincia fallo causa pesos ordena ordenan ordeno penal trelew rawson madryn comodoro esquel puerto rivadavia millones prision tribunal superior ciudad nuevo nueva jusnoticias contenido'.split())
def toks(s): return {w for w in norm(s).split() if len(w) >= 5 and w not in STOP}
def shing(s, k=6):
    w = norm(s).split(); return {' '.join(w[i:i+k]) for i in range(len(w)-k+1)}
def addd(d, n): return (dt.date.fromisoformat(d) + dt.timedelta(days=n)).isoformat()

# ---------- 1. Notas de JusNoticias ----------
jn_raw = []
p = 1
while True:
    j = getj(f'https://jusnoticias.juschubut.gov.ar/wp-json/wp/v2/posts?after={DESDE}T00:00:00&per_page=100&page={p}&_fields=id,date,title,content')
    # No confundir un error de red/JSON con el final normal de la paginación.
    # getj devuelve None si la descarga falla o la respuesta no es JSON válido;
    # una lista vacía sí es una respuesta válida que marca el final.
    j = exigir_lista_json(j, f"Página {p} de notas de JusNoticias")
    if not j: break
    jn_raw += j
    if len(j) < 100: break
    p += 1
FALLO = re.compile(r'fallo|conden|juicio|jurad|culpable|absol|absuel|prisi|homicid|abuso|sentencia|orden[oóa]|indemniz|veredicto|jury|destitu|preventiva|c[aá]mara|confirm|anul|revoc|tutela|patern|estaf|imputad|femicid|seros|banco|crimen|enjuiciamiento|servidumbre|multa|identidad|caballo|crianza|maternidad|pluriparental|apellido|sextorsi|despegar|choc|fertilid|hormonal|elevan|amenaza|robo', re.I)
SERV = re.compile(r'adopci|convocatoria|resoluci|acuerdo plenario|curso|feria|subasta|listado|novedades legislativas|informe anual de gesti[oó]n:|generador de citas|taller|principios y est|conferencia|conversatorio|jornada |jornadas preparatorias|introducci[oó]n al registro|llamado a concurso|segundo encuentro del m|inteligencia artificial generativa|razonamiento y redacci|primeros auxilios|acced[eé] al informe', re.I)
JN, notas = [], []
for x in jn_raw:
    t = strip(x['title']['rendered'])
    if len(t) < 4: continue
    body = strip(x['content']['rendered'])
    d = x['date'][:10]
    tipo = 'Agenda y servicios' if (SERV.search(t) and not re.search(r'conden|culpable|fallo', t, re.I)) else ('Fallo o caso' if FALLO.search(t) else 'Institucional')
    notas.append({'id': x['id'], 'fecha': d, 'titulo': t, 'tipo': tipo, 'mes': d[:7]})
    JN.append({'id': x['id'], 'date': d, 'titulo': t, 'body': body, 'tk': toks(t + ' ' + body[:1500]), 'sh': shing(body), 'tb': toks(t + ' ' + body)})
print('notas', len(notas))

def match(items, win=8, thr=0.57, before=-1, nodate_thr=0.7, need_chubut=False):
    res = []
    for it in items:
        tt = toks(it['t'])
        if len(tt) < 3: continue
        best = None
        for j in JN:
            if it.get('d'):
                if it['d'] < addd(j['date'], before) or it['d'] > addd(j['date'], win): continue
            inter = len(tt & j['tk']); sc = inter / len(tt)
            need = thr if it.get('d') else nodate_thr
            if inter >= 3 and sc >= need and (not best or sc > best[0]): best = (sc, j)
        if best: res.append(dict(it, nid=best[1]['id'], sc=best[0]))
    return res

MED = [('ADN Sur', r'adn ?sur'), ('El Chubut', r'diario el chubut'), ('Jornada', r'diario jornada'), ('Crónica', r'diario cr[oó]nica'), ('El Patagónico', r'el patag[oó]nico'), ('Red43', r'red ?43'), ('Canal 12', r'canal 12'), ('LU17', r'lu ?17'), ('Radio 3', r'radio 3'), ('Infobae', r'infobae'), ('Cadena 3', r'cadena 3'), ('Agencias', r'noticias argentinas|\btelam\b')]
JNBY = {j['id']: j for j in JN}
def classify(text, nid):
    off = bool(re.search(r'jusnoticias|agencia de comunicaci[oó]n judicial|juschubut', text, re.I))
    otros = ', '.join(n for n, r in MED if re.search(r, text, re.I))
    s = shing(text); sim = round(len(s & JNBY[nid]['sh']) / len(s) * 100) if s else 0
    orig = 'Copia textual (≥50%)' if sim >= 50 else 'Reescritura parcial' if sim >= 20 else 'Redacción propia'
    return orig, off, otros

# Segunda oportunidad: títulos reescritos o muy cortos quedan bajo el umbral de match()
# aunque el artículo sea sobre la nota. Esos casos "cerca" se confirman leyendo el texto.
def cerca(items, ya, win=8, before=-1, minimo=2, umbral=0.34, tope=40):
    vistos = {m['u'] for m in ya}
    res = []
    for it in items:
        if it['u'] in vistos or not it.get('d'): continue
        tt = toks(it['t'])
        if len(tt) < 2: continue
        best = None
        for j in JN:
            if it['d'] < addd(j['date'], before) or it['d'] > addd(j['date'], win): continue
            inter = len(tt & j['tk']); sc = inter / len(tt)
            if inter >= minimo and sc >= umbral and (not best or sc > best[0]): best = (sc, j)
        if best: res.append(dict(it, nid=best[1]['id'], sc=best[0]))
    res.sort(key=lambda m: -m['sc'])
    return res[:tope]

def confirmar_por_texto(cands, textos):
    """Solo acepta evidencia fuerte: el texto copia o reescribe la nota, o nombra a JusNoticias.
    Un tema parecido con redacción propia no alcanza (daba coincidencias falsas en la prueba)."""
    out = []
    for m in cands:
        t = textos.get(m['u'])
        if not t: continue
        j = JNBY[m['nid']]
        evidencia = evidencia_misma_nota(j['titulo'], j['body'], m.get('t', ''), t)
        if not evidencia['misma_nota']:
            continue
        c = classify(t, m['nid'])
        out.append((dict(
            m,
            metodo='Revisión completa (confirmado por texto)',
            motivo=motivo_texto(t, j) + (
                f"; validación misma nota: {evidencia['terminos_titulo']} términos del título, "
                f"{evidencia['terminos_cuerpo']} del cuerpo, frases {round(evidencia['coincidencia_frases'] * 100)}%"
            )
        ), c))
    return out

def texto_pagina(u):
    h = get(u, timeout=15) or ''
    h = re.sub(r'(?is)<(script|style|nav|header|footer)[^>]*>.*?</\1>', ' ', h)
    return strip(h)

# Lectura del texto de todo lo publicado en los últimos días (no solo títulos parecidos).
# Cada artículo se lee una sola vez: la lista de enlaces revisados se guarda entre corridas.
DIAS_TEXTO = 10
LIMITE_TEXTO = addd(dt.date.today().isoformat(), -DIAS_TEXTO)
UMBRAL_DATOS = 0.25
REVISADOS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'textos_revisados.json')
_corte = addd(dt.date.today().isoformat(), -(DIAS_TEXTO + 5))
try:
    with open(REVISADOS_PATH, encoding='utf8') as _f:
        _guardado = json.load(_f)
except Exception:
    _guardado = {}
if 'revisados' not in _guardado: _guardado = {'revisados': _guardado, 'candidatos': {}}
REVISADOS = {u: d for u, d in _guardado.get('revisados', {}).items() if d >= _corte}
# Candidatos por datos de corridas anteriores: sirven para detectar notas «genéricas».
CANDIDATOS_DATOS = {u: c for u, c in _guardado.get('candidatos', {}).items() if c.get('fecha', '') >= _corte}
DATOS_PEND = []
MAX_POR_NOTA = 4
_df = {}
for _j in JN:
    for _w in _j['tb']: _df[_w] = _df.get(_w, 0) + 1
IDF = {w: math.log(len(JN) / n) for w, n in _df.items()}
DIAG_TEXTO = []

def pendientes_texto(items, ya):
    """Artículos recientes que no coincidieron por título y todavía no se leyeron."""
    vistos = {m['u'] for m in ya}
    return [it for it in items if it.get('d', '') >= LIMITE_TEXTO and it['u'] not in vistos and it['u'] not in REVISADOS]

def puntaje_datos(tokens, j):
    total = sum(IDF.get(w, 0) for w in j['tb'])
    return sum(IDF.get(w, 0) for w in tokens & j['tb']) / total if total else 0

def motivo_texto(t, j, sim=None, sc=None):
    """Por qué se asoció el artículo a la nota: frases en común y datos poco comunes compartidos."""
    tk = toks(t)
    sim = len(shing(t) & j['sh']) / len(shing(t)) if sim is None and shing(t) else (sim or 0)
    sc = puntaje_datos(tk, j) if sc is None else sc
    raras = sorted(tk & j['tb'], key=lambda w: -IDF.get(w, 0))[:6]
    return f"frases en común {round(sim * 100)}%; datos coincidentes {round(sc * 100)}% ({', '.join(raras)})"

def revisar_texto(items, textos, medio=''):
    """Solo asocia artículos con evidencia de la misma nota, no por tema compartido."""
    out = []
    for it in items:
        t = textos.get(it['u'])
        if not t: continue
        REVISADOS[it['u']] = dt.date.today().isoformat()
        mejor = None
        for j in JN:
            if it['d'] < addd(j['date'], -1) or it['d'] > addd(j['date'], 8): continue
            evidencia = evidencia_misma_nota(j['titulo'], j['body'], it.get('t', ''), t)
            if not evidencia['misma_nota']: continue
            sh = shing(t)
            sim = len(sh & j['sh']) / len(sh) if sh else 0
            sc = puntaje_datos(toks(t), j)
            clave = (evidencia['coincidencia_frases'], evidencia['coincidencia_cuerpo_medio'], sim, sc)
            if not mejor or clave > mejor[0]: mejor = (clave, sim, sc, j, evidencia)
        if not mejor: continue
        _, sim, sc, j, evidencia = mejor
        DIAG_TEXTO.append((round(sc, 3), round(sim, 3), j['id'], it['u']))
        motivo = motivo_texto(t, j, sim, sc) + (
            f"; validación misma nota: {evidencia['terminos_titulo']} términos del título, "
            f"{evidencia['terminos_cuerpo']} del cuerpo, frases {round(evidencia['coincidencia_frases'] * 100)}%"
        )
        if sim >= 0.2:
            out.append((dict(it, nid=j['id'], metodo='Revisión completa (confirmado por texto)', motivo=motivo), classify(t, j['id'])))
        elif sc >= UMBRAL_DATOS:
            DATOS_PEND.append((medio, dict(it, nid=j['id'], metodo='Revisión de texto (coinciden los datos)', motivo=motivo), classify(t, j['id'])))
    return out

def agregar_por_datos():
    """Suma los candidatos por datos, salvo los de notas que coinciden con demasiados artículos:
    una nota de tema general (p. ej., Octubre Rosa) comparte palabras con cualquier nota del tema."""
    for medio, m, c in DATOS_PEND:
        CANDIDATOS_DATOS[m['u']] = {'nota': m['nid'], 'fecha': dt.date.today().isoformat()}
    por_nota = {}
    for c in CANDIDATOS_DATOS.values(): por_nota[c['nota']] = por_nota.get(c['nota'], 0) + 1
    sumados = 0
    for medio, m, c in DATOS_PEND:
        if por_nota.get(m['nid'], 0) > MAX_POR_NOTA: continue
        addrow(medio, m, m['metodo'], c[0], c[1], c[2]); sumados += 1
    genericas = sorted(n for n, k in por_nota.items() if k > MAX_POR_NOTA)
    print('Por datos: candidatos', len(DATOS_PEND), '| sumados', sumados, '| notas genéricas omitidas', genericas)

DATE_RE = [r'article:published_time" content="([^"]+)', r'"datePublished": ?"([^"]+)', r'datetime="([^"]+)']
def page_date(u):
    t = get(u, timeout=15) or ''
    for r in DATE_RE:
        m = re.search(r, t)
        if m: return m.group(1)[:10]
    return ''
JDATE = {n['id']: n['fecha'] for n in notas}
def verify(cands, win=8):
    out = []
    with ThreadPoolExecutor(8) as ex:
        for m, d in zip(cands, ex.map(lambda c: page_date(c['u']), cands)):
            jd = JDATE[m['nid']]
            if d and addd(jd, -1) <= d <= addd(jd, win): out.append(m)
    return out
rows = []
def addrow(medio, m, metodo, origen='Sin dato', off=False, otros=''):
    conf = 'Media' if origen == 'Sin dato' else ('Alta' if (origen != 'Redacción propia' or off) else 'Baja')
    fila = {'nota_id': m['nid'], 'medio': medio, 'origen': origen, 'cita_fuente_oficial': ('Sí' if off else 'No') if origen != 'Sin dato' else '', 'cita_otro_medio': otros, 'confianza': conf, 'metodo': metodo, 'url': m.get('u', '')}
    if m.get('motivo'): fila['motivo'] = m['motivo']
    rows.append(fila)
cobertura = {}
# Un índice que no respondió no es lo mismo que una revisión sin resultados.
SIN_RESPUESTA = 'Sin datos: el índice del sitio no respondió; se conserva el historial previo'
def estado_indice(hubo_datos, ok): return ok if hubo_datos else SIN_RESPUESTA

# ---------- 2. Medios WordPress ----------
# Registro de medios descubiertos por los buscadores (se carga acá porque los que usan
# WordPress pasan a lectura directa en esta misma sección).
REG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'fuentes_descubiertas.json')
def cargar_registro():
    try:
        with open(REG_PATH, encoding='utf8') as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except FileNotFoundError:
        return []
    except Exception as e:
        print(f'AVISO: registro de medios no legible ({type(e).__name__}); se inicia vacío')
        return []
REGISTRO = cargar_registro()
WP = {'Chubut Hoy': 'www.chubuthoy.com', 'Radio de Camioneros': 'radiodecamioneros.com.ar', 'FM Tropical': 'fmtropicalradio.com', 'Diario La Portada': 'diariolaportada.com.ar', 'FM del Lago Esquel': 'fmdellagoesquel.com.ar', 'Mil Patagonias': 'www.milpatagonias.com', 'FM Bahía Engaño': 'fmbahiaengano.com', 'Digital Chubut': 'digitalchubut.com', 'Noticias PMY': 'noticiaspmy.com', 'Argentar Noticias': 'argentarnoticias.com.ar', 'Radio Chubut': 'radiochubut.com', 'La Posta Comodorense': 'lapostacomodorense.com.ar', 'El Comodorense': 'www.elcomodorense.net', 'Comodoro 24': 'comodoro24.com.ar', 'Del Mar Digital': 'delmardigital.net', 'El Diario Web': 'www.eldiarioweb.com', 'Metadata Noticias': 'www.metadatanoticias.com.ar', 'Canal 12': 'canal12web.com', 'Cholila Online': 'cholilaonline.ar', 'Radio 3 Cadena Patagonia': 'radio3cadenapatagonia.com.ar', 'Atento Chubut': 'atentochubut.com', 'Vibra News': 'vibranews.com.ar'}
def wp_site(item):
    name, dom = item[0], item[1]
    max_pg = item[2] if len(item) > 2 else 400
    items = []
    def page(pg):
        return getj(f'https://{dom}/wp-json/wp/v2/posts?after={addd(DESDE,-1)}T00:00:00&per_page=100&page={pg}&_fields=id,date,link,title')
    pg = 1
    while pg < max_pg:
        batch = list(range(pg, pg + 8)); pg += 8
        with ThreadPoolExecutor(8) as ex: res = list(ex.map(page, batch))
        stop = False
        for page_num, j in zip(batch, res):
            # Las páginas se consultan en paralelo, pero se interpretan en orden.
            # Al llegar a una página válida vacía/corta, ignoramos respuestas de
            # páginas posteriores del mismo lote. Antes de ese punto, un error
            # no se puede confundir con el fin normal de la paginación.
            j = exigir_lista_json(j, f"{name}: página {page_num} del índice WordPress")
            if not j:
                stop = True
                break
            for x in j:
                items.append({'t': strip(x['title']['rendered']), 'd': x['date'][:10], 'u': x['link'], 'pid': x['id']})
            if len(j) < 100:
                stop = True
                break
        if stop: break
    ms = match(items)
    cerca_ms = cerca(items, ms)
    recientes = pendientes_texto(items, ms + cerca_ms)
    ids = list({m['pid'] for m in ms + cerca_ms + recientes})
    texts = {}
    for i in range(0, len(ids), 50):
        j = getj(f'https://{dom}/wp-json/wp/v2/posts?include={",".join(map(str, ids[i:i+50]))}&per_page=50&_fields=id,content')
        # No convertir un fallo de descarga/JSON en un lote vacío.
        j = exigir_lista_json(j, f"{name}: lote {i // 50 + 1} de contenido WordPress")
        for x in j: texts[x['id']] = strip(x['content']['rendered'])
    out = []
    for m in ms:
        t = texts.get(m['pid'])
        out.append((m, classify(t, m['nid']) if t else None))
    out += confirmar_por_texto(cerca_ms, {m['u']: texts.get(m['pid']) for m in cerca_ms})
    out += revisar_texto(recientes, {m['u']: texts.get(m['pid']) for m in recientes}, name)
    return name, len(items), out
# Aislar fallos temporales por fuente: un sitio caído no debe cancelar
# toda la actualización ni provocar la pérdida de registros históricos.
# Medios descubiertos con WordPress: se leen directo, sin depender de Google Noticias.
# La detección se repite cada 30 días por dominio y como máximo 10 por ejecución.
WP_NO_DESCUBRIR = re.compile(r'jusnoticias|juschubut|gob\.ar|gov\.ar|youtube|facebook|instagram|google', re.I)
# Dominios con código de otro país (.do, .pe, .es...) vienen de coincidencias temáticas lejanas.
EXTRANJERO = re.compile(r'\.(?!ar$)[a-z]{2}$', re.I)
def detectar_wp(registro):
    j = getj(f"https://{registro['dominio']}/wp-json/wp/v2/posts?per_page=1&_fields=id")
    return registro, isinstance(j, list)
hoy_reg = dt.date.today().isoformat()
dominios_wp = {d.replace('www.', '') for d in WP.values()}
pendientes_wp = [r for r in REGISTRO if r.get('dominio') and not WP_NO_DESCUBRIR.search(r['dominio']) and not EXTRANJERO.search(r['dominio'])
                 and r['dominio'].replace('www.', '') not in dominios_wp
                 and (not r.get('wp_revisado') or r['wp_revisado'] < addd(hoy_reg, -30))][:10]
with ThreadPoolExecutor(5) as ex:
    for registro, es_wp in ex.map(detectar_wp, pendientes_wp):
        registro['wp'] = es_wp; registro['wp_revisado'] = hoy_reg
WP_DESCUBIERTOS = {r['nombre']: r['dominio'] for r in REGISTRO
                   if r.get('wp') and r.get('nombre') and r['nombre'] not in WP and not EXTRANJERO.search(r['dominio'])
                   and r['dominio'].replace('www.', '') not in dominios_wp}
print('WordPress descubiertos en lectura directa:', len(WP_DESCUBIERTOS))
# Los descubiertos pueden ser sitios grandes: se limita la paginación a 10 lotes (8.000 notas).
fuentes_wp = [(n, d) for n, d in WP.items()] + [(n, d, 80) for n, d in WP_DESCUBIERTOS.items()]
with ThreadPoolExecutor(4) as ex:
    futures = {ex.submit(wp_site, item): item[0] for item in fuentes_wp}
    for fut in as_completed(futures):
        name = futures[fut]
        try:
            name, n, out = fut.result()
            if name in WP_DESCUBIERTOS:
                cobertura[name] = 'Revisión completa (fuente descubierta, lectura directa)' if n else 'Fuente descubierta: el sitio no devolvió notas'
            else:
                cobertura[name] = 'Revisión completa (texto comparado)' if n else 'Sin datos: el sitio no devolvió notas'
            for m, c in out:
                if c: addrow(name, m, m.get('metodo', 'Revisión completa'), c[0], c[1], c[2])
                else: addrow(name, m, 'Revisión completa')
            print(name, n, len(out))
        except Exception as e:
            cobertura[name] = 'Fuente temporalmente no disponible; se conserva el historial previo'
            prev_rows = []
            if PREV and os.path.exists(PREV):
                try:
                    with open(PREV, encoding='utf8') as pf:
                        prev_rows = [r for r in json.load(pf) if r.get('medio') == name]
                except Exception:
                    prev_rows = []
            rows.extend({k: v for k, v in r.items() if k != 'key'} for r in prev_rows)
            print(f'{name}: ERROR aislado ({type(e).__name__}); se conservan {len(prev_rows)} registros previos')

# ---------- 3. Sitemaps mensuales (ADN Sur, EQS Notas) ----------
def months():
    d = dt.date.fromisoformat(DESDE); today = dt.date.today(); out = []
    while d <= today:
        out.append(f'{d.year}-{d.month:02d}'); d = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    return out
for name, host in [('ADN Sur', 'https://www.adnsur.com.ar'), ('EQS Notas', 'https://www.eqsnotas.com')]:
    items = []
    for m in months():
        t = get(f'{host}/sitemap-{m}.xml') or ''
        for u, lm in re.findall(r'<loc>([^<]+)</loc>\s*<lastmod>([^<]+)', t):
            items.append({'t': re.sub(r'[-_]+', ' ', re.sub(r'_[a-z0-9]+$', '', u.rstrip('/').split('/')[-1])), 'd': lm[:10], 'u': u})
    ms = match(items, thr=0.6)
    for m in ms: addrow(name, m, 'Revisión completa (solo títulos)')
    cerca_ms = cerca(items, ms)
    with ThreadPoolExecutor(8) as ex:
        textos = dict(zip([m['u'] for m in cerca_ms], ex.map(texto_pagina, [m['u'] for m in cerca_ms])))
    extra = confirmar_por_texto(cerca_ms, textos)
    recientes = sorted(pendientes_texto(items, ms + cerca_ms), key=lambda it: it['d'], reverse=True)[:200]
    with ThreadPoolExecutor(8) as ex:
        textos = dict(zip([m['u'] for m in recientes], ex.map(texto_pagina, [m['u'] for m in recientes])))
    extra += revisar_texto(recientes, textos, name)
    for m, c in extra: addrow(name, m, m['metodo'], c[0], c[1], c[2])
    cobertura[name] = estado_indice(items, 'Revisión completa (títulos; texto en casos dudosos)'); print(name, len(items), 'por texto:', len(extra))

agregar_por_datos()

# ---------- 4. La Opinión Austral (sitemap txt, sin fechas) ----------
idx = get('https://laopinionaustral.com.ar/sitemaps/sitemaps-index.xml') or ''
txts = re.findall(r'<loc>([^<]+\.txt)</loc>', idx)
lines = []
for u in txts:
    t = get(u) or ''; lines += [l for l in t.split('\n') if l.strip()]
recent = [l for l in lines if l.startswith('http') and re.search(r'-(\d{6})\.html$', l) and int(re.search(r'-(\d{6})\.html$', l).group(1)) >= 628000]
items = [{'t': l.rstrip('/').split('/')[-1].replace('.html', '').replace('-', ' '), 'u': l} for l in recent if re.search(r'chubut|trelew|rawson|madryn|comodoro|esquel|gaiman|sarmiento|puelo|trevelin', l)]
for m in verify(match(items, nodate_thr=0.6)): addrow('La Opinión Austral', m, 'Revisión completa (solo títulos)')
cobertura['La Opinión Austral'] = estado_indice(lines, 'Revisión completa (solo títulos)')

# ---------- 5. LU17 (índice por número, fecha estimada) ----------
lu = {}
def lu_page(p):
    return get(f'https://lu17.com/sitemap_index.xml?page={p}') or ''
with ThreadPoolExecutor(8) as ex:
    for t in ex.map(lu_page, range(34, 70)):
        for i, s in re.findall(r'<loc>https://lu17\.com/contenido/(\d+)/([^<]+)</loc>', t): lu[int(i)] = s.replace('-', ' ')
for u in ['https://lu17.com/sitemap.xml', 'https://lu17.com/news_sitemap.xml']:
    for i, s in re.findall(r'<loc>https://lu17\.com/contenido/(\d+)/([^<]+)</loc>', get(u) or ''): lu[int(i)] = s.replace('-', ' ')
base = dt.date(2026, 4, 6)
items = [{'t': s, 'd': (base + dt.timedelta(days=(i - 123222) / 156.4)).isoformat(), 'u': f'https://lu17.com/contenido/{i}/'} for i, s in lu.items() if i >= 111000]
for m in match(items, win=12, before=-4, thr=0.67): addrow('LU17', m, 'Revisión completa (solo títulos)')
cobertura['LU17'] = estado_indice(lu, 'Revisión completa (solo títulos, fecha estimada)')

# ---------- 6. La Tecla Patagonia ----------
y = get('https://www.lateclapatagonia.com.ar/sitemap-2026.xml') or ''
sms = re.findall(r'<loc>([^<]+)</loc>', y) + re.findall(r'<loc>([^<]+)</loc>', get('https://www.lateclapatagonia.com.ar/sitemap_actual.xml') or '')
items = []
for u in sms:
    for loc in re.findall(r'<loc>([^<]+)</loc>', get(u) or ''):
        if 'sitemap' in loc: continue
        items.append({'t': re.sub(r'^\d+-', '', loc.rstrip('/').split('/')[-1]).replace('-', ' '), 'u': loc})
for m in verify(match(items, nodate_thr=0.6)): addrow('La Tecla Patagonia', m, 'Revisión completa (solo títulos)')
cobertura['La Tecla Patagonia'] = estado_indice(items, 'Revisión completa (solo títulos)')

# ---------- 7. ABC Diario (sitemaps gz, se verifica la fecha) ----------
idx = get('https://www.abcdiario.com.ar/files/sitemap/sitemap.xml') or ''
urls = []
for u in re.findall(r'<loc>([^<]+content[^<]+)</loc>', idx):
    b = get(u, binary=True) or b''
    try: t = gzip.decompress(b).decode('utf-8', 'replace')
    except Exception: t = b.decode('utf-8', 'replace')
    urls += re.findall(r'<loc>([^<]+)</loc>', t)
items = [{'t': re.sub(r'-\d+$', '', u.rstrip('/').split('/')[-1]).replace('-', ' '), 'u': u} for u in urls[-8000:]]
cands = match(items, nodate_thr=0.6)
def abc_date(m):
    t = get(m['u']) or ''
    d = re.search(r'article:published_time" content="([^"]+)', t) or re.search(r'"datePublished":"([^"]+)', t)
    return m, (d.group(1)[:10] if d else '')
with ThreadPoolExecutor(6) as ex:
    for m, d in ex.map(abc_date, cands):
        jd = next(n['fecha'] for n in notas if n['id'] == m['nid'])
        if d and jd <= d <= addd(jd, 9): addrow('ABC Diario', m, 'Revisión completa (solo títulos)')
cobertura['ABC Diario'] = estado_indice(urls, 'Revisión completa (solo títulos)')

# ---------- 8. El Extremo Sur y La Vanguardia (por número de nota) ----------
def enum(name, url_fmt, lo, hi, date_re, title_clean, enc=None):
    def one(i):
        b = get(url_fmt.format(i), binary=True, timeout=8, tries=1)
        if not b: return None
        t = b.decode(enc or 'utf-8', 'replace')
        ti = re.search(r'<title>([^<]{0,200})', t); d = re.search(date_re, t)
        if not ti or not d: return None
        return {'t': title_clean(html.unescape(ti.group(1))), 'd': d.group(1).replace('/', '-')[:10], 'u': url_fmt.format(i)}
    with ThreadPoolExecutor(24) as ex: items = [x for x in ex.map(one, range(lo, hi)) if x]
    for m in match(items, thr=0.67): addrow(name, m, 'Revisión completa (solo títulos)')
    cobertura[name] = estado_indice(items, 'Revisión completa (solo títulos)'); return items
def last_id(url_fmt, start, date_re, enc=None):
    i = start
    while True:
        b = get(url_fmt.format(i + 50), binary=True, timeout=8, tries=1)
        if not b or not re.search(date_re, b.decode(enc or 'utf-8', 'replace')): break
        i += 50
    return i + 60
ees_fmt = 'https://www.elextremosur.com/nota/{}/'
ees_re = r'article:published_time" content="([^"]+)'
enum('El Extremo Sur', ees_fmt, 57020, last_id(ees_fmt, 59900, ees_re, 'iso-8859-1'), ees_re, lambda s: s.split(' - El Extremo')[0], 'iso-8859-1')
lv_fmt = 'https://www.lavanguardianoticias.com.ar/nota-x-{}'
lv_re = r'/(20\d\d/\d\d/\d\d)/'
enum('La Vanguardia Noticias', lv_fmt, 118400, last_id(lv_fmt, 123900, lv_re), lv_re, lambda s: s.strip())

# ---------- 9. Medios con revisión parcial: se conservan las filas anteriores ----------
PARCIAL = {'El Chubut', 'Diario Jornada', 'Crónica', 'El Patagónico', 'Red43'}
if PREV and os.path.exists(PREV):
    for r in json.load(open(PREV, encoding='utf8')):
        if r['medio'] in PARCIAL: rows.append({k: v for k, v in r.items() if k != 'key'})
for m in PARCIAL: cobertura[m] = 'Sin índice propio: se busca por Google Noticias (últimos 45 días)'
cobertura['Tiempo Sur'] = 'Sin índice de notas: revisado por buscador, sin coincidencias'


# ---------- 10. Google Noticias: encuentra medios fuera de la lista y los que no tienen índice ----------

# Los que ya se leen por WordPress no necesitan búsqueda por buscador.
_rot = sorted({r['dominio'] for r in REGISTRO if r.get('dominio') and not r.get('wp') and not EXTRANJERO.search(r['dominio'])})
_tramo = 8
_inicio = (int(time.time() // 7200) * _tramo) % len(_rot) if _rot else 0
DOMINIOS_ROTACION = (_rot[_inicio:] + _rot[:_inicio])[:_tramo]
print('Seguimiento por buscador de descubiertos:', ', '.join(DOMINIOS_ROTACION) or 'ninguno')

def bing_items(xml):
    """Interpreta el RSS de Bing Noticias con el mismo formato que gnews()."""
    out = []
    for it in re.findall(r'<item>(.*?)</item>', xml or '', re.S):
        ti = re.search(r'<title>(.*?)</title>', it, re.S); lk = re.search(r'<link>(.*?)</link>', it, re.S)
        pd = re.search(r'<pubDate>(.*?)</pubDate>', it); src = re.search(r'<News:Source>(.*?)</News:Source>', it, re.S | re.I)
        if not (ti and lk and pd): continue
        enlace = html.unescape(lk.group(1)).strip()
        real = urllib.parse.parse_qs(urlparse(enlace).query).get('url', [enlace])[0]
        try: d = dt.datetime.strptime(pd.group(1).strip()[5:16], '%d %b %Y').date().isoformat()
        except Exception: continue
        host = (urlparse(real).hostname or '').lower()
        if host.startswith('www.'): host = host[4:]
        nombre = html.unescape(src.group(1)).strip() if src else host
        out.append({'fuerte': False, 't': html.unescape(ti.group(1)).strip(), 'd': d, 'u': real, 'src': nombre, 'dominio': host, 'buscador': 'Bing Noticias'})
    return out

def gnews(n):
    clave_t = [w for w in norm(n['titulo']).split() if len(w) >= 5 and w not in STOP][:6]
    body = CUERPO.get(n['id'], '')
    oraciones = [o.strip() for o in re.split(r'(?<=[.;:])\s+', body) if len(o.split()) >= 12][:3]
    frases = ['"' + ' '.join(o.split()[2:11]) + '"' for o in oraciones[:2]]
    # Tercera huella: una cita textual (los medios suelen conservar las citas del fallo) o la tercera oración.
    citas = [c for c in re.findall(r'[“"«]([^”"»]{60,400})[”"»]', body) if len(c.split()) >= 10]
    tercera = citas[0] if citas else (oraciones[2] if len(oraciones) > 2 else '')
    if tercera:
        frases.append('"' + ' '.join(tercera.split()[:10]) + '"')
    t, fuerte = '', ''
    consultas = [n['titulo'][:120], ' '.join(clave_t)] + frases
    # Seguimiento de medios descubiertos, para notas de los últimos 15 días: en cada ejecución
    # se revisa un tramo distinto del registro, así todos se recorren a lo largo del día.
    if n['fecha'] >= addd(dt.date.today().isoformat(), -15):
        dominios = DOMINIOS_ROTACION
        frase = frases[0].strip('"') if frases else ' '.join(clave_t[:4])
        consultas.extend('site:' + dominio + ' "' + frase + '"' for dominio in dominios)
    for q in consultas:
        r = get('https://news.google.com/rss/search?q=' + urllib.parse.quote(q) + '&hl=es-419&gl=AR&ceid=AR:es-419', timeout=20) or ''
        t += r
        if q.startswith('"'): fuerte += r
    out = []
    for it in re.findall(r'<item>(.*?)</item>', t, re.S):
        ti = re.search(r'<title>(.*?)</title>', it, re.S); src = re.search(r'<source([^>]*)>(.*?)</source>', it, re.S)
        pd = re.search(r'<pubDate>(.*?)</pubDate>', it); lk = re.search(r'<link>(.*?)</link>', it, re.S)
        if not (ti and src and pd): continue
        src_url = re.search(r'url="([^"]+)"', src.group(1), re.I)
        try: d = dt.datetime.strptime(pd.group(1)[5:16], '%d %b %Y').date().isoformat()
        except Exception: continue
        tt = html.unescape(ti.group(1)).rsplit(' - ', 1)[0]
        src_name = html.unescape(src.group(2)).strip()
        if norm(tt).replace(' ', '') == norm(src_name).replace(' ', ''): continue
        host = urlparse(html.unescape(src_url.group(1))).hostname if src_url else ''
        host = (host or '').lower()
        if host.startswith('www.'): host = host[4:]
        out.append({'fuerte': it in fuerte, 't': tt, 'd': d, 'u': html.unescape(lk.group(1)) if lk else '', 'src': src_name, 'dominio': host})
    # Segunda fuente: Bing Noticias, para medios que Google no indexa. Título y primera frase.
    for q in [n['titulo'][:120]] + frases[:1]:
        r = get('https://www.bing.com/news/search?q=' + urllib.parse.quote(q) + '&format=rss&setlang=es&cc=AR', timeout=20) or ''
        for item in bing_items(r):
            item['fuerte'] = q.startswith('"')
            out.append(item)
    return n, out
STEM = lambda s: {w[:6] for w in norm(s).split() if len(w) >= 5 and w not in STOP}
JSTEM, CUERPO = {}, {}
for x in jn_raw:
    CUERPO[x['id']] = strip(x['content']['rendered'])
    JSTEM[x['id']] = STEM(strip(x['title']['rendered']) + ' ' + strip(x['content']['rendered'])[:3000])
def gmatch(it, n):
    st = STEM(it['t'])
    if len(st) < 3: return None
    def sc(nid): return len(st & JSTEM.get(nid, set())) / len(st)
    cand = [j for j in notas if addd(j['fecha'], -1) <= it['d'] <= addd(j['fecha'], 8)]
    best = max(cand, key=lambda j: sc(j['id']), default=None)
    minimo = 0.25 if it.get('fuerte') else 0.45
    # Evitar asignar una noticia por coincidencias genéricas del cuerpo (p. ej. "Patagonia").
    # Además del cuerpo, el titular externo debe compartir al menos dos términos
    # significativos con el título oficial de JusNoticias.
    # Los términos temáticos amplios no bastan para atribuir una publicación a una nota.
    # Por ejemplo, compartir solo "mujeres rurales" no acredita relación con la campaña de JusNoticias.
    GENERICOS_TITULO = {'mujer', 'rural', 'rurale', 'campan', 'homena', 'celebr', 'conmem', 'mundia', 'intern', 'nacion', 'provin'}
    coincidencias_titulo = len(st & STEM(n.get('titulo', '')))
    coincidencias_especificas = len((st & STEM(n.get('titulo', ''))) - GENERICOS_TITULO)
    if (not best or best['id'] != n['id'] or sc(n['id']) < minimo
            or len(st & JSTEM[n['id']]) < 2 or coincidencias_titulo < 2
            or coincidencias_especificas < 2):
        return None
    return dict(it, nid=n['id'], sc=sc(n['id']))
GEO = re.compile(r'chubut|patagon|trelew|rawson|madryn|comodoro|esquel|gaiman|sarmiento|trevelin|puelo|lago puelo|dolavon|rada tilly|superior tribunal|stj')
def limpio(s): return re.sub(r'^[^\w¿¡]+', '', s).strip()
ALIAS = {'canal12web': 'Canal 12', 'adnsur': 'ADN Sur', 'eqsnotas': 'EQS Notas', 'abcdiariocomar': 'ABC Diario', 'eldiarioweb': 'El Diario Web',
         'lu20radiochubut': 'Radio Chubut', 'cholilaonline': 'Cholila Online', 'la17': 'LU17', 'lu17': 'LU17', 'noticiaspmy': 'Noticias PMY', 'cronica': 'Crónica', 'jornada': 'Diario Jornada'}
def clave(s): return re.sub(r'^(diario|radio|fm) ', '', norm(s)).replace(' ', '')
conocidos = {clave(m): m for m in list(cobertura) + ['Crónica', 'El Chubut', 'Diario Jornada', 'El Patagónico', 'Red43']}
conocidos.update(ALIAS)
MEDIO_POR_DOMINIO = {d.replace('www.', ''): n for n, d in list(WP.items()) + list(WP_DESCUBIERTOS.items())}
NO = re.compile(r'jusnoticias|juschubut|poder judicial|justicia\.ar|ministerio p[uú]blico|youtube|facebook|instagram', re.I)
ya = {(r['nota_id'], r['medio']) for r in rows}
desde_g = addd(dt.date.today().isoformat(), -45)
con_g = 0
with ThreadPoolExecutor(4) as ex:
    for n, items in ex.map(gnews, [n for n in notas if n['fecha'] >= desde_g]):
        for it in items:
            if NO.search(it['src']) or not (addd(n['fecha'], -1) <= it['d'] <= addd(n['fecha'], 8)): continue
            m = gmatch(it, n)
            if not m: continue
            medio = MEDIO_POR_DOMINIO.get(it.get('dominio', '')) or conocidos.get(clave(it['src']), limpio(it['src']))
            # El título puede omitir la ciudad aunque trate el mismo fallo local.
            # La nota de JusNoticias y la ventana temporal ya se validaron en gmatch().
            # La similitud textual y la ventana temporal se validaron en gmatch(); no exigir geografía.
            if NO.search(medio): continue
            if (n['id'], medio) in ya:
                for r0 in rows:
                    if r0['nota_id'] == n['id'] and r0['medio'] == medio and r0['confianza'] == 'Baja':
                        r0['confianza'] = 'Media'; r0['metodo'] += ' + confirmado por Google Noticias'; con_g += 1
                continue
            ya.add((n['id'], medio)); con_g += 1
            buscador = m.get('buscador', 'Google Noticias')
            addrow(medio, m, buscador + (' (frase de la nota)' if m.get('fuerte') else ' (solo título)'))
            cobertura.setdefault(medio, 'Encontrado por Google Noticias; fuente descubierta automáticamente')
            dominio = it.get('dominio', '')
            if dominio and not NO.search(dominio):
                encontrado = next((r for r in REGISTRO if r.get('dominio') == dominio), None)
                hoy = dt.date.today().isoformat()
                if encontrado:
                    encontrado['nombre'] = medio
                    encontrado['ultima_deteccion'] = hoy
                    encontrado['detecciones'] = int(encontrado.get('detecciones', 0)) + 1
                    if it.get('u'): encontrado['ultima_url'] = it['u']
                else:
                    REGISTRO.append({'nombre': medio, 'dominio': dominio, 'primera_deteccion': hoy, 'ultima_deteccion': hoy, 'detecciones': 1, 'ultima_url': it.get('u', ''), 'estado': 'seguimiento_google_news'})
print('Google Noticias', con_g)

# Guardar el registro para que la siguiente ejecución siga monitorizando los dominios nuevos.
REGISTRO.sort(key=lambda r: (r.get('ultima_deteccion', ''), r.get('dominio', '')))
with open(REG_PATH, 'w', encoding='utf8') as rf:
    json.dump(REGISTRO, rf, ensure_ascii=False, indent=2)
with open(REVISADOS_PATH, 'w', encoding='utf8') as rf:
    json.dump({'revisados': dict(sorted(REVISADOS.items())), 'candidatos': dict(sorted(CANDIDATOS_DATOS.items()))}, rf, ensure_ascii=False, indent=0)
print('Textos leídos en esta corrida:', len(DIAG_TEXTO), '| lista de revisados:', len(REVISADOS))
if os.environ.get('DIAG_TEXTO'):
    with open(os.environ['DIAG_TEXTO'], 'w', encoding='utf8') as rf:
        json.dump(sorted(DIAG_TEXTO, reverse=True), rf, ensure_ascii=False)

# URLs verificadas manualmente para la nota 14884. La decisión humana prevalece sobre
# una clasificación automática previa o posterior. Se conservan las filas históricas.
FUENTES_VERIFICADAS = [
    ('0223', 'https://www.0223.com.ar/nota/2026-10-19-19-12-0-escracho-a-una-mujer-por-chorra-la-acusacion-era-falsa-y-debera-pagarle-2-4-millones'),
    ('Elonce', 'https://www.elonce.com/amp/acuso-de-ladrona-a-una-vecina-y-debera-pagar-2-4-millones.htm'),
    ('La Voz del Interior', 'https://www.lavoz.com.ar/ciudadanos/dijo-chorra-vecina-facebook-justicia-debera-indemnizarla-pagara_0_ei9s7vvfd2.html'),
    ('Clarín', 'https://www.clarin.com/policiales/trato-chorra-vecina-redes-sociales-condenaron-pagarle-indemnizacion_0_MNPIWZlcHv.html'),
    ('Radio Chubut', 'https://radiochubut.com/la-camara-de-apelaciones-de-puerto-madryn-condeno-a-una-comerciante-por-imputarle-un-delito-a-una-vecina-en-facebook/'),
    ('Canal 12', 'https://canal12web.com/una-madrynense-debera-pagar-mas-de-2-millones-por-escrachar-a-una-vecina-de-robarle-dinero-en-facebook/'),
    ('Cholila Online', 'https://cholilaonline.ar/2026/10/precedente-escraches-redes-puerto-madryn-sancion-difamacion-facebook.html'),
    ('ADN Sur', 'https://www.adnsur.com.ar/policiales---judiciales/escracho-a-una-mujer-en-chubut--la-llamo--chorra--y-ahora-debera-pagar--2-4-millones-por-difamarla_a6ad6255759814e2274499dd6'),
]
NOTA_PUERTO_MADRYN = 14884
ids_notas = {n['id'] for n in notas}
for medio, url in FUENTES_VERIFICADAS:
    # La nota puede faltar en el feed de esta corrida y recuperarse del historial
    # unos pasos después. Las verificaciones manuales no dependen del feed actual.
    existente = next((r for r in rows
        if r.get('nota_id') == NOTA_PUERTO_MADRYN
        and r.get('medio') == medio
        and r.get('url') == url), None)
    if existente is None:
        # Una decisión manual no se descarta porque el recolector ya tenga otra
        # URL de ese medio o una fila pendiente para la misma nota.
        existente = {
            'nota_id': NOTA_PUERTO_MADRYN, 'medio': medio,
            'origen': 'Sin dato', 'cita_fuente_oficial': '',
            'cita_otro_medio': '', 'url': url,
        }
        rows.append(existente)
    existente['confianza'] = 'Alta'
    existente['metodo'] = 'Verificación manual de URL aportada'
    existente['motivo'] = 'URL comprobada manualmente; la verificación manual prevalece sobre la clasificación automática'
    cobertura[medio] = 'Cobertura verificada manualmente'


# ---------- Conservación del historial: una revisión nueva no borra hallazgos anteriores ----------
from historial import conservar_historial, conservar_notas, deduplicar_publicaciones, marcar_secundarias, clave_publicacion, aplicar_revision_manual
# Las notas que la API dejó de devolver (p. ej., convocatorias despublicadas) siguen en el
# historial, y con ellas sus publicaciones. El archivo de notas anterior está junto a PREV.
NOTAS_PREV = os.path.join(os.path.dirname(PREV), 'notas2.json') if PREV else None
if NOTAS_PREV and os.path.exists(NOTAS_PREV):
    antes = len(notas)
    notas = conservar_notas(notas, json.load(open(NOTAS_PREV, encoding='utf8')))
    print('notas conservadas del historial', len(notas) - antes)
ids_actuales = {n['id'] for n in notas}
anteriores = []
if PREV and os.path.exists(PREV):
    anteriores = json.load(open(PREV, encoding='utf8'))
    rows = conservar_historial(rows, anteriores, ids_actuales, cobertura)
# ---------- Salida ----------
ids = {n['id'] for n in notas}; rep = []
FP = re.compile(r'pity alvarez|dinosaur|papa leon|maradona|reforma laboral fue promulgada')
# Corrección de una asociación histórica detectada por regresión: este enlace de
# Radio 3 corresponde a una noticia policial, no a la nota institucional 14674.
# La limpieza se aplica después de consolidar el historial para impedir que vuelva
# a introducirse desde una ejecución anterior.
URLS_DESCARTADAS = {
    (14674, 'Radio 3 Cadena Patagonia',
     'https://radio3cadenapatagonia.com.ar/un-delincuente-que-era-buscado-en-buenos-aires-cayo-en-la-patagonia/')
}
# Resultados históricos de Google Noticias para la nota de mujeres rurales.
# La coincidencia por tema no demuestra que la publicación cubra la campaña de JusNoticias.
# Se conservan los enlaces para auditoría, pero quedan fuera de las cifras confirmadas hasta revisarlos.
MEDIOS_TEMA_NO_VERIFICADO = {
    'Diario Judicial', 'Infobae', 'Acento', 'Presidencia de la República Dominicana',
    'Diario Sur', 'Radio Sintonía', 'Portal de Cádiz', 'El Atlantico',
    'Periódico EL JAYA', 'El Peruano', 'Instituto Colombiano Agropecuario - ICA',
    'TVPerú', 'Caracol Radio', 'Federación de Periodistas del Perú',
    'elatlantico.do', 'Cholila Online', 'Portal Medios Públicos'
}
for r in rows:
    if (r.get('nota_id'), r.get('medio'), r.get('url')) in URLS_DESCARTADAS:
        r['url'] = ''
        r['origen'] = 'Sin dato'
        r['cita_fuente_oficial'] = 'No'
        r['cita_otro_medio'] = ''
        r['confianza'] = 'Baja'
        r['metodo'] = 'Revisión completa'
    if (r.get('nota_id') == 14851
            and r.get('medio') in MEDIOS_TEMA_NO_VERIFICADO
            and (r.get('url') or '').startswith('https://news.google.com/rss/articles/')):
        r['confianza'] = 'Baja'
        r['metodo'] = 'Google Noticias (coincidencia temática; relación no verificada)'
    if r['nota_id'] not in ids or FP.search(norm(r.get('url', ''))): continue
    rep.append(r)
# Última protección: algunos filtros de limpieza se aplican después de fusionar el historial.
# Reincorporar publicaciones históricas de notas vigentes que no sean falsos positivos explícitos.
anteriores_finales = [
    a for a in anteriores
    if (a.get('nota_id'), a.get('medio'), a.get('url')) not in URLS_DESCARTADAS
    and not FP.search(norm(a.get('url', '')))
]
rep = conservar_historial(rep, anteriores_finales, ids, cobertura)
# Una fila por publicación (nota, medio y URL canónica): si un medio tiene dos artículos
# asociados a la misma nota se conservan ambos, pero solo uno queda confirmado (ver
# marcar_secundarias); los enlaces de buscador quedan como URL alternativa.
rep = deduplicar_publicaciones(rep)
confirmadas_previas = set()
if PREV and os.path.exists(PREV):
    confirmadas_previas = {clave_publicacion(r) for r in json.load(open(PREV, encoding='utf8')) if r.get('confianza') != 'Baja'}
rep = marcar_secundarias(rep, confirmadas_previas)
# Exclusiones explícitas para impedir que un nuevo rastreo vuelva a contar coberturas
# del mismo congreso como si fueran la nota institucional del Poder Judicial de Chubut.
MEDIOS_NO_VERIFICADOS_14664 = {
    'CHACODIAPORDIA.COM', 'Diario La Portada', 'Metadata Noticias',
    'Del Mar Digital', 'Canal Doce Misiones', 'La Nota San Juan',
    'InfoBariloche', 'El Mediador - Santa Cruz', 'El 10 TV',
    'El Tribuno', 'Diario Huarpe'
}
MEDIOS_NO_VERIFICADOS_14664_NORM = {m.strip().casefold() for m in MEDIOS_NO_VERIFICADOS_14664}
for r in rep:
    medio_norm = str(r.get('medio') or '').strip().casefold()
    if str(r.get('nota_id')) == '14664' and medio_norm in MEDIOS_NO_VERIFICADOS_14664_NORM:
        r['confianza'] = 'Baja'
        r['metodo'] = 'Excluida del conteo: cobertura distinta del mismo congreso; no acredita reproducción de la nota de Chubut'
        r['motivo'] = 'La coincidencia temática o la referencia de búsqueda no acredita que el medio haya publicado esta nota'
# Decisiones del equipo sobre «por revisar»: mandan sobre la detección automática.
REVISION_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'revision_manual.json')
if os.path.exists(REVISION_PATH):
    revisiones = json.load(open(REVISION_PATH, encoding='utf8'))
    rep = aplicar_revision_manual(rep, [r for r in revisiones if r.get('nota_id') in ids])
    print('Revisiones manuales aplicadas:', len(revisiones))

# Última capa de protección: reimponer las URLs manuales después de todos los
# filtros, deduplicación y revisión automática. El feed puede omitir una nota o
# rebajar una fila que ya fue comprobada por una persona.
for medio, url in FUENTES_VERIFICADAS:
    fila = next((r for r in rep
        if str(r.get('nota_id')) == str(NOTA_PUERTO_MADRYN)
        and r.get('medio') == medio and r.get('url') == url), None)
    if fila is None:
        fila = {
            'nota_id': NOTA_PUERTO_MADRYN, 'medio': medio,
            'origen': 'Sin dato', 'cita_fuente_oficial': '',
            'cita_otro_medio': '', 'url': url,
        }
        rep.append(fila)
    fila['confianza'] = 'Alta'
    fila['metodo'] = 'Verificación manual de URL aportada'
    fila['motivo'] = 'URL comprobada manualmente; la verificación manual prevalece sobre la clasificación automática'
    cobertura[medio] = 'Cobertura verificada manualmente'
for i, r in enumerate(rep): r['key'] = f'p{i}'
# «notas» cuenta notas distintas por medio (un medio con dos artículos de una nota suma una).
notas_por_medio = {}
for r in rep: notas_por_medio.setdefault(r['medio'], set()).add(r['nota_id'])
# Auditoría por medio: última revisión correcta y fallos seguidos (data/estado_medios.json).
from historial import actualizar_estado_medios
ESTADO_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'estado_medios.json')
try:
    estado_medios = json.load(open(ESTADO_PATH, encoding='utf8'))
except Exception:
    estado_medios = {}
estado_medios = actualizar_estado_medios(estado_medios, cobertura, dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))
json.dump(estado_medios, open(ESTADO_PATH, 'w', encoding='utf8'), ensure_ascii=False, indent=1, sort_keys=True)
alertas = sorted(m for m, e in estado_medios.items() if e.get('alerta'))
print('Medios de lectura directa sin revisión correcta hace más de 24 h:', ', '.join(alertas) or 'ninguno')
medios = [{'medio': m, 'cobertura': c, 'notas': len(notas_por_medio.get(m, ())),
           'ultima_revision_ok': estado_medios.get(m, {}).get('ultima_revision_ok', ''),
           'fallos_seguidos': estado_medios.get(m, {}).get('fallos_seguidos', 0)} for m, c in cobertura.items()]
json.dump(notas, open(os.path.join(OUT, 'notas2.json'), 'w'), ensure_ascii=False)
json.dump(rep, open(os.path.join(OUT, 'rep2.json'), 'w'), ensure_ascii=False)
json.dump(medios, open(os.path.join(OUT, 'medios.json'), 'w'), ensure_ascii=False)
print('OK notas', len(notas), 'publicaciones', len(rep), 'medios', len(medios))
