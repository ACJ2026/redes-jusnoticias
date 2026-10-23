"""Funciones puras para conservar y validar el historial de publicaciones."""
from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


# ---------- Identidad de cada publicación ----------
# Una publicación es un enlace concreto de un medio. La nota de JusNoticias puede tener
# varias publicaciones en un mismo medio; el medio se sigue contando una vez en el alcance.
PARAMETROS_SEGUIMIENTO = re.compile(r"^(utm_.*|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|ref|ref_src|amp|output|s)$", re.I)
HOSTS_BUSCADOR = ("news.google.com", "bing.com", "www.bing.com")


def normalizar_url(url):
    """Forma canónica de una URL para no contar dos veces el mismo artículo.

    Unifica http/https, «www.», mayúsculas del dominio, barra final, fragmentos,
    parámetros de seguimiento y variantes AMP. Las URL de Google Noticias se
    conservan por su identificador (sin parámetros).
    """
    u = (url or "").strip()
    if not u:
        return ""
    partes = urlsplit(u)
    if not partes.scheme or not partes.netloc:
        return u
    host = partes.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    if host == "news.google.com":
        return "https://news.google.com" + partes.path
    ruta = re.sub(r"/amp/?$", "", partes.path)
    ruta = re.sub(r"^/amp(?=/)", "", ruta)
    ruta = ruta.rstrip("/") or "/"
    consulta = [(k, v) for k, v in parse_qsl(partes.query, keep_blank_values=True) if not PARAMETROS_SEGUIMIENTO.match(k)]
    return urlunsplit(("https", host, ruta, urlencode(sorted(consulta)), ""))


def es_enlace_directo(url):
    """True si la URL es del medio (no vacía ni de un buscador)."""
    u = normalizar_url(url)
    if not u.startswith("http"):
        return False
    host = urlsplit(u).netloc
    return not any(host == h or host.endswith("." + h) for h in HOSTS_BUSCADOR)


def clave_publicacion(fila):
    """(nota_id, medio, URL canónica); sin enlace directo, la URL queda vacía."""
    url = fila.get("url", "")
    return (fila.get("nota_id"), fila.get("medio"), normalizar_url(url) if es_enlace_directo(url) else "")


def _fusionar(destino, origen, origen_manda=False):
    """Completa campos vacíos y combina métodos; guarda URLs alternativas sin borrar nada."""
    for campo, valor in origen.items():
        if campo in ("key", "metodo", "url", "url_alternativas"):
            continue
        if valor in (None, ""):
            continue
        if destino.get(campo) in (None, "") or origen_manda:
            destino[campo] = valor
    metodos = []
    for metodo in (destino.get("metodo", ""), origen.get("metodo", "")):
        for parte in (metodo or "").split(" + "):
            parte = parte.strip()
            if parte and parte not in metodos:
                metodos.append(parte)
    if metodos:
        destino["metodo"] = " + ".join(metodos)
    if not destino.get("url") and origen.get("url"):
        destino["url"] = origen["url"]
    alternativas = list(destino.get("url_alternativas") or [])
    for url in [origen.get("url")] + list(origen.get("url_alternativas") or []):
        if url and normalizar_url(url) != normalizar_url(destino.get("url")) and url not in alternativas:
            alternativas.append(url)
    if alternativas:
        destino["url_alternativas"] = alternativas


def deduplicar_publicaciones(filas, actuales=None):
    """Una fila por publicación, sin perder evidencia.

    - Mismo enlace directo (canónico) en la misma nota y medio: una sola fila.
    - Enlaces de buscador o vacíos: si la nota y el medio ya tienen un enlace directo,
      se suman como URL alternativa de esa fila; si no, queda una sola fila por par.
    `actuales` (ids de objetos) marca las filas de la corrida actual, que tienen
    prioridad sobre el historial cuando ambos traen un dato.
    """
    actuales = actuales or set()
    con_directo = {}
    for fila in filas:
        if es_enlace_directo(fila.get("url", "")):
            par = (fila.get("nota_id"), fila.get("medio"))
            con_directo.setdefault(par, fila)
    salida, por_clave = [], {}
    pendientes = []
    for fila in filas:
        par = (fila.get("nota_id"), fila.get("medio"))
        if es_enlace_directo(fila.get("url", "")):
            clave = clave_publicacion(fila)
            if clave in por_clave:
                _fusionar(por_clave[clave], fila, id(fila) in actuales and id(por_clave[clave]) not in actuales)
                continue
            por_clave[clave] = fila
            salida.append(fila)
        elif par in con_directo:
            pendientes.append((par, fila))
        else:
            clave = par + ("",)
            if clave in por_clave:
                _fusionar(por_clave[clave], fila, id(fila) in actuales and id(por_clave[clave]) not in actuales)
                continue
            por_clave[clave] = fila
            salida.append(fila)
    for par, fila in pendientes:
        destino = next(f for f in salida if (f.get("nota_id"), f.get("medio")) == par and es_enlace_directo(f.get("url", "")))
        _fusionar(destino, fila, id(fila) in actuales and id(destino) not in actuales)
    return salida


MARCA_SECUNDARIA = "otro artículo del mismo medio (por revisar)"


def marcar_secundarias(filas, confirmadas_previas=()):
    """Un medio cuenta una publicación confirmada por nota; los demás artículos quedan por revisar.

    La prueba con datos reales mostró que, cuando un medio tiene varios artículos asociados a
    una misma nota, muchos son coincidencias más débiles (otra etapa del caso u otro tema).
    Se conservan todos como evidencia, pero solo uno queda confirmado: el que ya estaba
    confirmado en el historial o, si no hay, el primero encontrado. Los demás pasan a
    confianza «Baja» con una marca, salvo que ya hubieran sido confirmados antes.
    `confirmadas_previas`: claves de publicación confirmadas en el historial.
    """
    confirmadas_previas = set(confirmadas_previas)
    por_par = {}
    for fila in filas:
        if es_enlace_directo(fila.get("url", "")) and fila.get("confianza") != "Baja":
            por_par.setdefault((fila.get("nota_id"), fila.get("medio")), []).append(fila)
    for grupo in por_par.values():
        if len(grupo) < 2:
            continue
        principal = next((f for f in grupo if clave_publicacion(f) in confirmadas_previas), grupo[0])
        for fila in grupo:
            if fila is principal or clave_publicacion(fila) in confirmadas_previas:
                continue
            fila["confianza"] = "Baja"
            if MARCA_SECUNDARIA not in (fila.get("metodo") or ""):
                fila["metodo"] = ((fila.get("metodo") or "") + " · " + MARCA_SECUNDARIA).strip(" ·")
    return filas


# ---------- Revisión manual ----------
# data/revision_manual.json: lo que el equipo confirma o descarta a mano desde «por revisar».
# Nunca borra filas: «descartar» solo baja la confianza para que no cuente.
ORIGENES_VALIDOS = ("Copia textual (≥50%)", "Reescritura parcial", "Redacción propia", "Sin dato")


def aplicar_revision_manual(filas, revisiones):
    """Aplica las decisiones manuales por URL; si una confirmación no tiene fila, la crea."""
    indice = {}
    for f in filas:
        for u in [f.get("url", "")] + list(f.get("url_alternativas") or []):
            if u:
                indice.setdefault((f.get("nota_id"), normalizar_url(u)), f)
    for rev in revisiones or []:
        nota, url = rev.get("nota_id"), rev.get("url", "")
        if not nota or not url:
            continue
        decision = rev.get("decision")
        fila = indice.get((nota, normalizar_url(url)))
        registro = {"decision": decision, "por": rev.get("revisado_por", ""), "fecha": rev.get("fecha", ""), "motivo": rev.get("motivo", "")}
        if decision == "confirmar":
            origen = rev.get("origen") if rev.get("origen") in ORIGENES_VALIDOS else "Sin dato"
            if fila is None:
                if not rev.get("medio"):
                    continue
                fila = {"nota_id": nota, "medio": rev["medio"], "origen": origen, "cita_fuente_oficial": rev.get("cita_fuente_oficial", ""),
                        "cita_otro_medio": "", "confianza": "Alta", "metodo": "Revisión manual", "url": url, "revision_manual": registro}
                filas.append(fila)
                indice[(nota, normalizar_url(url))] = fila
                continue
            fila["confianza"] = "Alta"
            fila["origen"] = origen
            fila["revision_manual"] = registro
            if rev.get("cita_fuente_oficial"):
                fila["cita_fuente_oficial"] = rev["cita_fuente_oficial"]
            if "revisión manual" not in (fila.get("metodo") or ""):
                fila["metodo"] = ((fila.get("metodo") or "") + " + confirmado en revisión manual").lstrip(" +")
        elif decision == "descartar" and fila is not None:
            fila["confianza"] = "Baja"
            fila["revision_manual"] = registro
            if "revisión manual" not in (fila.get("metodo") or ""):
                fila["metodo"] = ((fila.get("metodo") or "") + " + descartado en revisión manual").lstrip(" +")
    return filas


def conservar_historial(rows, anteriores, ids_vigentes, cobertura):
    """Fusiona filas nuevas con el historial para notas que siguen vigentes.

    La identidad es la publicación (nota, medio y URL canónica): un enlace histórico
    distinto del actual se conserva como otra publicación. No muta las entradas.
    """
    resultado = [dict(r) for r in rows]
    actuales = {id(f) for f in resultado}
    previas = [{k: v for k, v in a.items() if k != "key"} for a in anteriores if a.get("nota_id") in ids_vigentes]
    salida = deduplicar_publicaciones(resultado + previas, actuales)
    for fila in previas:
        if any(f is fila for f in salida) and fila.get("medio"):
            cobertura.setdefault(fila["medio"], "Se conservan publicaciones de revisiones anteriores")
    return salida


def conservar_notas(notas, anteriores):
    """Agrega las notas del historial que la fuente ya no devuelve.

    El sitio puede despublicar notas viejas (por ejemplo, convocatorias vencidas);
    el tablero mide lo que se publicó, así que se conservan. No muta las entradas.
    """
    resultado = [dict(n) for n in notas]
    vigentes = {n.get("id") for n in resultado}
    for anterior in anteriores:
        if anterior.get("id") not in vigentes:
            resultado.append(dict(anterior))
            vigentes.add(anterior.get("id"))
    return resultado


def publicaciones_faltantes(anteriores, nuevas, ids_vigentes):
    """Devuelve publicaciones históricas que faltan para notas vigentes.

    Controla el par (nota, medio) y, además, cada enlace directo histórico
    (por su URL canónica, también entre las URL alternativas).
    """
    def claves(filas):
        out = set()
        for r in filas:
            par = (r.get("nota_id"), r.get("medio"))
            out.add(par)
            for url in [r.get("url")] + list(r.get("url_alternativas") or []):
                if es_enlace_directo(url or ""):
                    out.add(par + (normalizar_url(url),))
        return out
    anteriores_vigentes = [r for r in anteriores if r.get("nota_id") in ids_vigentes]
    return claves(anteriores_vigentes) - claves(nuevas)
