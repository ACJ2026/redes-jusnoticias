"""Solo lectura: busca en el sitio de cada medio dónde dice que tiene sede (dirección, pie, contacto)."""
import json, re, html, urllib.request, concurrent.futures as cf
UA = {'User-Agent': 'Mozilla/5.0 (JusNoticias inventario de medios)'}
def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=20) as r:
            return r.geturl(), r.read(600000).decode(r.headers.get_content_charset() or 'utf-8', 'replace')
    except Exception as e:
        return u, ''
def txt(h): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', h))))
CLAVE = re.compile(r'(direcci[oó]n|domicilio|redacci[oó]n:|calle |av\. |avenida |c\.p\.|cp \d|\(0\d{2,4}\)|\b0\d{2,4}[- ]\d{3}|sede|ubicad[oa]s? en|propietari|editor responsable|registro de la propiedad|quienes somos|quiénes somos)', re.I)
def uno(m):
    dom = m['dominio']; out = []
    for ruta in ['', '/contacto', '/contacto/', '/quienes-somos/', '/nosotros/', '/institucional/', '/staff/']:
        u, h = get(f'https://{dom}{ruta}')
        if not h: continue
        loc = sorted(set(re.findall(r'"addressLocality"\s*:\s*"([^"]{2,60})"', h)) | set(re.findall(r'"addressRegion"\s*:\s*"([^"]{2,60})"', h)))
        t = txt(h)
        trozos = []
        for mm in CLAVE.finditer(t):
            s = t[max(0, mm.start() - 90): mm.end() + 160].strip()
            if not any(s[:60] in x for x in trozos): trozos.append(s)
            if len(trozos) >= 4: break
        pie = t[-400:]
        if loc or trozos: out.append({'url': u, 'localidad_jsonld': loc, 'trozos': trozos, 'pie': pie})
    return m['nombre'], dom, out
lista = json.load(open('ciudades_lista.json'))
with cf.ThreadPoolExecutor(8) as ex:
    for nombre, dom, out in ex.map(uno, lista):
        print('=' * 20, nombre, '|', dom)
        if not out: print('  (sin datos legibles)')
        for o in out[:4]:
            print('  URL:', o['url'], '| JSON-LD:', o['localidad_jsonld'])
            for s in o['trozos']: print('   -', s[:260])
            print('   PIE:', o['pie'][-260:])
