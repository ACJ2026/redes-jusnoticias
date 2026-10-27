#!/usr/bin/env python3
"""Diagnóstico de solo lectura: qué traen Google Noticias y Bing para una nota y por qué
el filtro del relevamiento acepta o rechaza cada resultado. No escribe datos.
Uso: python3 scripts/diagnostico_buscador.py <nota_id> [url_medio ...]
"""
import html, json, re, sys, unicodedata, urllib.parse, urllib.request
sys.path.insert(0, 'scripts')
from relevancia_publicaciones import evidencia_misma_nota

UA = {'User-Agent': 'Mozilla/5.0 (JusNoticias monitoreo)'}
SRC = open('scripts/actualizar.py', encoding='utf8').read()
exec(re.search(r'^STOP = .*$', SRC, re.M).group(0))
GEN = {'mujer', 'rural', 'rurale', 'campan', 'homena', 'celebr', 'conmem', 'mundia', 'intern', 'nacion', 'provin'}

def get(url, timeout=25):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
            return r.status, r.geturl(), r.read().decode(r.headers.get_content_charset() or 'utf-8', 'replace')
    except Exception as e:
        return getattr(e, 'code', 0) or str(e)[:60], url, ''
def strip(h): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h or ''))).strip()
def norm(s): return re.sub(r'[^a-z0-9 ]', ' ', unicodedata.normalize('NFD', (s or '').lower()).encode('ascii', 'ignore').decode())
STEM = lambda s: {w[:6] for w in norm(s).split() if len(w) >= 5 and w not in STOP}
def texto(h): return strip(re.sub(r'(?is)<(script|style|nav|header|footer)[^>]*>.*?</\1>', ' ', h))

nid = int(sys.argv[1])
_, _, j = get(f'https://jusnoticias.juschubut.gov.ar/wp-json/wp/v2/posts?include={nid}&_fields=id,title,content')
nota = json.loads(j)[0]
tit, body = strip(nota['title']['rendered']), strip(nota['content']['rendered'])
JS, TS = STEM(tit + ' ' + body[:3000]), STEM(tit)
clave = [w for w in norm(tit).split() if len(w) >= 5 and w not in STOP][:6]
oraciones = [o.strip() for o in re.split(r'(?<=[.;:])\s+', body) if len(o.split()) >= 12][:3]
frases = ['"' + ' '.join(o.split()[2:11]) + '"' for o in oraciones[:2]]
consultas = [tit[:120], ' '.join(clave)] + frases
print('NOTA', nid, tit)
vistos = {}
for q in consultas:
    st, _, r = get('https://news.google.com/rss/search?q=' + urllib.parse.quote(q) + '&hl=es-419&gl=AR&ceid=AR:es-419')
    items = re.findall(r'<item>(.*?)</item>', r, re.S)
    print(f'\nGOOGLE [{st}] {len(items)} resultados para: {q}')
    for it in items:
        ti = html.unescape(re.search(r'<title>(.*?)</title>', it, re.S).group(1)); src = re.search(r'<source[^>]*>(.*?)</source>', it, re.S)
        lk = re.search(r'<link>(.*?)</link>', it, re.S); pd = re.search(r'<pubDate>(.*?)</pubDate>', it)
        t = ti.rsplit(' - ', 1)[0]; s = STEM(t); sc = len(s & JS) / len(s) if s else 0
        ok = len(s) >= 3 and sc >= (0.25 if q.startswith('"') else 0.45) and len(s & JS) >= 2 and len(s & TS) >= 2 and len((s & TS) - GEN) >= 2
        print(f"  {'PASA' if ok else 'RECHAZA'} | {src.group(1) if src else '?'} | {pd.group(1)[5:16] if pd else ''} | {t[:110]} | titulo={sorted(s & TS)} sc={sc:.2f}")
        if lk: vistos.setdefault(html.unescape(lk.group(1)), (src.group(1) if src else '?'))
for q in [tit[:120]] + frases[:1]:
    st, _, r = get('https://www.bing.com/news/search?q=' + urllib.parse.quote(q) + '&format=rss&setlang=es&cc=AR')
    items = re.findall(r'<item>(.*?)</item>', r, re.S)
    print(f'\nBING [{st}] {len(items)} resultados para: {q}')
    for it in items:
        ti = html.unescape(re.search(r'<title>(.*?)</title>', it, re.S).group(1)); lk = html.unescape(re.search(r'<link>(.*?)</link>', it, re.S).group(1))
        real = urllib.parse.parse_qs(urllib.parse.urlparse(lk).query).get('url', [lk])[0]
        print(f'  {ti[:110]} | {real[:120]}')
print('\nENLACES DE GOOGLE NOTICIAS: ¿se puede llegar al enlace real siguiendo la redirección?')
for u, s in list(vistos.items())[:8]:
    st, final, _ = get(u)
    print(f'  {s} [{st}] -> {final[:120]}')
print('\nPÁGINAS DE MEDIOS: ¿se pueden leer y coincide el texto con la nota?')
for u in sys.argv[2:]:
    st, final, h = get(u)
    t = texto(h); m = re.search(r'<title>(.*?)</title>', h, re.S | re.I)
    ev = evidencia_misma_nota(tit, body, strip(m.group(1)) if m else '', t) if t else {}
    print(f'  [{st}] {len(t)} letras | misma_nota={ev.get("misma_nota")} frases={ev.get("coincidencia_frases")} cuerpo_medio={ev.get("coincidencia_cuerpo_medio")} | {u[:90]}')

# Control contra otras notas: para cada página, qué tan parecida es a las demás notas de
# JusNoticias de esos días (si una nota ajena puntúa igual, el umbral no separa).
print('\nCONTROL: parecido de cada página con las notas de JusNoticias de ±8 días')
_, _, lista = get('https://jusnoticias.juschubut.gov.ar/wp-json/wp/v2/posts?after=2026-10-19T00:00:00&per_page=100&_fields=id,title,content')
otras = [(n['id'], strip(n['title']['rendered']), strip(n['content']['rendered'])) for n in json.loads(lista)]
for u in sys.argv[2:]:
    st, final, h = get(u)
    t = texto(h); m = re.search(r'<title>(.*?)</title>', h, re.S | re.I); tm = strip(m.group(1)) if m else ''
    if not t: continue
    pts = []
    for i, ti, bo in otras:
        ev = evidencia_misma_nota(ti, bo, tm, t)
        pts.append((ev['coincidencia_cuerpo_medio'], ev['terminos_cuerpo'], ev['coincidencia_cuerpo_oficial'], ev['terminos_titulo'], i))
    pts.sort(reverse=True)
    print(f'  {u[8:60]}')
    for p in pts[:3]:
        print(f"     nota {p[4]}: cuerpo_medio={p[0]} terminos={p[1]} cuerpo_oficial={p[2]} titulo={p[3]}")
