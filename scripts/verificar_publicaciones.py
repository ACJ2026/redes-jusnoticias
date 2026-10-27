#!/usr/bin/env python3
"""Revisa candidatas del recolector contra el artículo original de JusNoticias.

Solo modifica filas procedentes de buscadores que todavía no tengan una decisión
fuerte. Una URL de Google/Bing nunca sirve como publicación original.
"""
import html
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (compatible; JusNoticiasVerificador/1.0)"}
from historial import es_enlace_directo, normalizar_url
from relevancia_publicaciones import evidencia_misma_nota

BUSCADORES = ("news.google.com", "bing.com", "www.bing.com")
STOP = set("""para sobre desde entre donde porque cuando hasta durante contra juzgado juzgados justicia judicial poder chubut provincia fallo causa pesos ordena ordenan ordeno penal trelew rawson madryn comodoro esquel puerto rivadavia millones prision tribunal superior ciudad nuevo nueva jusnoticias contenido gobierno provincia""".split())
MARCAS_CANDIDATA = ("solo título", "solo titulo", "google noticias", "bing noticias", "coincidencia temática", "coincidencia tematica", "fuente no identificada", "a verificar:")


def normalizar(texto):
    texto = unicodedata.normalize("NFD", html.unescape(texto or "").lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", texto).strip()


def tokens(texto):
    return {w for w in normalizar(texto).split() if len(w) >= 5 and w not in STOP}


def host(url):
    try:
        return (urllib.parse.urlsplit(url).hostname or "").lower()
    except ValueError:
        return ""


def url_directa(url):
    h = host(url)
    return bool(h and not any(h == x or h.endswith("." + x) for x in BUSCADORES))


class TextoHTML(HTMLParser):
    IGNORAR = {"script", "style", "nav", "header", "footer", "noscript", "svg"}
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.omitir = 0
        self.partes = []
    def handle_starttag(self, tag, attrs):
        if tag.lower() in self.IGNORAR:
            self.omitir += 1
    def handle_endtag(self, tag):
        if tag.lower() in self.IGNORAR and self.omitir:
            self.omitir -= 1
    def handle_data(self, data):
        if not self.omitir:
            self.partes.append(data)



def reemplazar_url(fila, nueva):
    """Cambia la URL de la fila sin perder la anterior.

    Si el medio redirige a otra dirección, la URL original queda en «url_alternativas»:
    así el control de historial sigue reconociendo la misma publicación.
    """
    anterior = (fila.get("url") or "").strip()
    if anterior and es_enlace_directo(anterior) and normalizar_url(anterior) != normalizar_url(nueva):
        alternativas = list(fila.get("url_alternativas") or [])
        if anterior not in alternativas:
            alternativas.append(anterior)
        fila["url_alternativas"] = alternativas
    fila["url"] = nueva

def descargar(url, timeout=18):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        final = resp.geturl()
        tipo = resp.headers.get("Content-Type", "")
        if "html" not in tipo.lower() and tipo:
            return final, ""
        raw = resp.read(2_000_000)
        charset = resp.headers.get_content_charset() or "utf-8"
        source = raw.decode(charset, "replace")
    parser = TextoHTML()
    parser.feed(source)
    return final, " ".join(parser.partes)


def nota_oficial(nota_id, cache):
    if nota_id not in cache:
        url = f"https://jusnoticias.juschubut.gov.ar/wp-json/wp/v2/posts/{int(nota_id)}"
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=15) as resp:
                obj = json.loads(resp.read().decode("utf-8", "replace"))
            title = re.sub(r"<[^>]+>", " ", obj.get("title", {}).get("rendered", ""))
            body = re.sub(r"<[^>]+>", " ", obj.get("content", {}).get("rendered", ""))
            cache[nota_id] = (html.unescape(title), html.unescape(body))
        except Exception:
            cache[nota_id] = ("", "")
    return cache[nota_id]


def evaluar(titulo_oficial, cuerpo_oficial, titulo_medio, cuerpo_medio):
    ot, mt = tokens(titulo_oficial), tokens(titulo_medio)
    ob, mb = tokens(cuerpo_oficial), tokens(cuerpo_medio)
    titulo_comun = len(ot & mt)
    # El cuerpo oficial aporta contexto; el porcentaje se calcula sobre sus términos
    # distintivos, no sobre todo el texto del medio.
    cuerpo_comun = len(ob & mb)
    ratio_oficial = cuerpo_comun / max(1, len(ob))
    ratio_medio = cuerpo_comun / max(1, len(mb))
    return titulo_comun, ratio_oficial, ratio_medio, len(ob & mb)



def motivo_error_acceso(exc):
    """Convierte fallas técnicas de acceso en una explicación entendible."""
    if isinstance(exc, urllib.error.HTTPError):
        if exc.code in (401, 403):
            return "El medio bloqueó el acceso automático. Abrí el enlace para comprobar la publicación."
        if exc.code == 404:
            return "El enlace no existe o la publicación fue retirada."
        if exc.code >= 500:
            return "El sitio del medio no respondió correctamente. Podés volver a abrir el enlace."
        return f"El sitio respondió con un error HTTP {exc.code}; no se pudo comprobar automáticamente."
    if isinstance(exc, (TimeoutError,)) or isinstance(getattr(exc, "reason", None), TimeoutError):
        return "El sitio tardó demasiado en responder. Abrí el enlace para comprobar la publicación."
    if isinstance(exc, urllib.error.URLError):
        return "No se pudo conectar con el sitio del medio. El enlace queda disponible para revisarlo."
    return "No se pudo leer la publicación automáticamente. Abrí el enlace para comprobarla."


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Uso: verificar_publicaciones.py notas2.json rep2.json")
    notas = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    filas = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    titulos = {int(n["id"]): n.get("titulo", "") for n in notas}
    cache = {}
    revisadas = confirmadas = descartadas = pendientes = 0
    medios_no_verificados_14664 = {
        "CHACODIAPORDIA.COM", "Diario La Portada", "Metadata Noticias",
        "Del Mar Digital", "Canal Doce Misiones", "La Nota San Juan",
        "InfoBariloche", "El Mediador - Santa Cruz", "El 10 TV",
        "El Tribuno", "Diario Huarpe",
    }
    medios_no_verificados_14664_norm = {m.strip().casefold() for m in medios_no_verificados_14664}
    for fila in filas:
        revision = fila.get("revision_manual") or {}
        medio_norm = str(fila.get("medio") or "").strip().casefold()
        if (str(fila.get("nota_id")) == "14664"
                and medio_norm in medios_no_verificados_14664_norm
                and revision.get("decision") != "confirmar"):
            fila["confianza"] = "Baja"
            fila["metodo"] = (
                "Excluida del conteo: cobertura distinta del mismo congreso; "
                "no acredita reproducción de la nota de Chubut"
            )
            fila["motivo"] = (
                "La coincidencia temática o la referencia de búsqueda no acredita "
                "que el medio haya publicado esta nota"
            )
            continue
        metodo = (fila.get("metodo") or "").lower()
        url = (fila.get("url") or "").strip()
        if not any(m in metodo for m in MARCAS_CANDIDATA):
            continue
        texto_previo = ""
        if not url_directa(url):
            # Abrir la ficha del buscador permite seguir su redirección hasta el medio.
            try:
                url_final, texto_previo = descargar(url)
                if url_directa(url_final):
                    url = url_final
                    reemplazar_url(fila, url_final)
                else:
                    raise ValueError("el buscador no entregó una URL del medio")
            except Exception:
                fila["metodo"] = "A verificar: el buscador no entregó un enlace original; se reintentará"
                fila["motivo"] = "No se pudo llegar a una publicación directa del medio"
                pendientes += 1
                continue
        nid = int(fila.get("nota_id", 0))
        titulo_oficial, cuerpo_oficial = nota_oficial(nid, cache)
        if not titulo_oficial or not cuerpo_oficial:
            fila["metodo"] = "A verificar: no se pudo recuperar la nota oficial; se reintentará"
            fila["motivo"] = "No se pudo comparar con el contenido original"
            pendientes += 1
            continue
        try:
            final_url, texto = descargar(url)
            if not texto and texto_previo:
                texto = texto_previo
            if not url_directa(final_url):
                raise ValueError("la redirección terminó en un buscador")
        except Exception as exc:
            fila["metodo"] = "A verificar: no se pudo leer la publicación original; se reintentará"
            fila["motivo"] = motivo_error_acceso(exc)
            pendientes += 1
            continue
        revisadas += 1
        # Intenta tomar el título de la página antes de comparar el cuerpo completo.
        titulo_medio = ""
        try:
            req = urllib.request.Request(final_url, headers=UA)
            with urllib.request.urlopen(req, timeout=12) as resp:
                source = resp.read(500_000).decode(resp.headers.get_content_charset() or "utf-8", "replace")
            for pattern in (r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', r'<title[^>]*>(.*?)</title>'):
                found = re.search(pattern, source, re.I | re.S)
                if found:
                    titulo_medio = html.unescape(re.sub(r"<[^>]+>", " ", found.group(1))).strip()
                    break
        except Exception:
            pass
        if not titulo_medio:
            titulo_medio = texto[:250]
        title_common, body_official_ratio, body_media_ratio, common_count = evaluar(
            titulo_oficial, cuerpo_oficial, titulo_medio, texto
        )
        evidencia = evidencia_misma_nota(titulo_oficial, cuerpo_oficial, titulo_medio, texto)
        reemplazar_url(fila, final_url)
        fila["evidencia_verificacion"] = {
            "titulo_medio": titulo_medio[:300],
            "terminos_titulo_en_comun": title_common,
            "terminos_nota_oficial_en_comun": common_count,
            "coincidencia_cuerpo_oficial": round(body_official_ratio, 4),
            "coincidencia_cuerpo_medio": round(body_media_ratio, 4),
            "coincidencia_frases": evidencia["coincidencia_frases"],
            "misma_nota": evidencia["misma_nota"],
        }
        if evidencia["misma_nota"]:
            fila["confianza"] = "Alta"
            fila["metodo"] = "Verificada automáticamente: título y contenido comparados con la nota oficial"
            fila["motivo"] = (
                f"Coincidencia específica confirmada: {evidencia['terminos_titulo']} términos distintivos "
                f"del título, {evidencia['terminos_cuerpo']} del cuerpo; "
                f"frases compartidas {round(evidencia['coincidencia_frases'] * 100)}%"
            )
            confirmadas += 1
        else:
            # No mantener en el conteo una coincidencia de tema que no pruebe la misma publicación.
            fila["confianza"] = "Baja"
            fila["metodo"] = "Excluida del conteo: no hay evidencia suficiente de que sea la misma nota"
            fila["motivo"] = (
                f"No se confirmó la misma publicación: {evidencia['terminos_titulo']} términos "
                f"distintivos del título, {evidencia['terminos_cuerpo']} del cuerpo; "
                f"frases compartidas {round(evidencia['coincidencia_frases'] * 100)}%. "
                "Se conserva el registro histórico, pero no cuenta como repercusión confirmada ni pendiente."
            )
            descartadas += 1
        time.sleep(0.05)
    Path(sys.argv[2]).write_text(json.dumps(filas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Verificación de candidatas: leídas {revisadas}, verificadas {confirmadas}, descartadas {descartadas}, pendientes {pendientes}")


if __name__ == "__main__":
    main()
