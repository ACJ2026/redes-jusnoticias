#!/usr/bin/env python3
"""Suma a data/redes2.json las publicaciones propias que devuelve la API de redes del sitio.

Uso: python3 scripts/actualizar_redes.py [data/redes2.json]

- Consulta /api/redes del sitio publicado (últimos 30 días; Facebook, Instagram, YouTube y TikTok).
- Agrega las publicaciones nuevas y actualiza las cifras (me gusta, comentarios, compartidos,
  vistas) de las que ya estaban. Nunca borra filas ni pisa una cifra con «sin dato».
- Si la consulta falla, no cambia nada.
"""
import datetime as dt
import hashlib
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITIO = os.environ.get("JUSNOTICIAS_SITIO", "https://jusnoticias.pages.dev")
REDES = "Facebook,Instagram,YouTube,TikTok"
DIAS = 30
CIFRAS = ("me_gusta", "comentarios", "compartidos", "vistas")


def normalizar(texto):
    t = unicodedata.normalize("NFD", str(texto or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def limpiar(texto):
    t = normalizar(texto)
    t = re.sub(r"^(reel|video|short)\b\s*", "", t)
    return "" if t in ("sin texto", "reel sin texto") else t


def parecidas(a, b):
    """Mismo comienzo de texto (la API recorta a ~26 caracteres; lo guardado puede ser más largo)."""
    ta, tb = limpiar(a.get("resumen") or a.get("texto")), limpiar(b.get("resumen") or b.get("texto"))
    if not ta or not tb:
        return not ta and not tb
    n = min(len(ta), len(tb), 40)
    return n >= 12 and ta[:n] == tb[:n]


def cerca(f1, f2):
    try:
        return abs((dt.date.fromisoformat(str(f1)[:10]) - dt.date.fromisoformat(str(f2)[:10])).days) <= 1
    except ValueError:
        return False


def buscar_previa(n, filas, usadas):
    # Las filas viejas no tienen el identificador de la red: misma red, fecha con un día de margen
    # (huso horario) y mismo comienzo de texto.
    for f in filas:
        if id(f) in usadas or f.get("propia") != "Sí" or f.get("red") != n.get("red"):
            continue
        if cerca(f.get("fecha"), n.get("fecha")) and parecidas(f, n):
            return f
    return None


def combinar(guardadas, nuevas):
    """Devuelve (filas, agregadas, actualizadas). No borra nada."""
    filas = [dict(f) for f in guardadas]
    por_clave = {f.get("key"): f for f in filas if f.get("key")}
    usadas = set()
    agregadas = actualizadas = 0
    for n in nuevas:
        if n.get("propia") != "Sí" or not n.get("red") or not n.get("fecha"):
            continue
        previa = por_clave.get(n.get("key")) or buscar_previa(n, filas, usadas)
        if previa is None:
            fila = {k: n.get(k) for k in ("red", "cuenta", "fecha", "texto", "nota_id", *CIFRAS, "propia", "key")}
            fila["fecha"] = str(fila["fecha"])[:10]
            if n.get("url"):
                fila["url"] = n["url"]
            if n.get("carga"):
                fila["carga"] = n["carga"]
            filas.append(fila)
            por_clave[fila["key"]] = fila
            usadas.add(id(fila))
            agregadas += 1
            continue
        usadas.add(id(previa))
        cambio = False
        # El enlace a la publicación se agrega si faltaba; nunca se cambia uno ya guardado.
        if not previa.get("url") and str(n.get("url") or "").startswith("http"):
            previa["url"] = n["url"]
            cambio = True
        for campo in CIFRAS:
            valor = n.get(campo)
            if isinstance(valor, (int, float)) and valor != previa.get(campo):
                previa[campo] = valor
                cambio = True
        actualizadas += cambio
    return filas, agregadas, actualizadas


def terceros_comprobados(filas_api):
    """Posteos de otras cuentas que la búsqueda marcó «fuerte» (enlazan la nota o repiten su título completo)."""
    out = []
    for f in filas_api:
        url = f.get("publicacion_url") or ""
        if f.get("verificacion") != "fuerte" or not str(url).startswith("http") or not f.get("nota_id"):
            continue
        out.append({
            "red": f.get("red"), "cuenta": f.get("cuenta"), "fecha": str(f.get("fecha") or "")[:10],
            "texto": str(f.get("texto") or "")[:140], "nota_id": int(f["nota_id"]),
            "me_gusta": None, "comentarios": None, "compartidos": None, "vistas": None,
            "propia": "No", "key": "cp-" + hashlib.sha1(url.encode("utf-8")).hexdigest()[:16], "url": url,
            "cuenta_url": f.get("cuenta_url"),
            "carga": "carga manual en el tablero" if f.get("carga") == "manual" else "búsqueda en redes de otras cuentas (" + str(f.get("coincidencia") or "coincidencia fuerte") + ")",
        })
    return out


def sumar_terceros(filas, nuevas):
    """Agrega posteos de otras cuentas que no estén ya guardados (por enlace o clave). No borra ni cambia nada."""
    urls = {f.get("url") for f in filas if f.get("url")}
    claves = {f.get("key") for f in filas if f.get("key")}
    agregadas = 0
    for n in nuevas:
        if n["url"] in urls or n["key"] in claves:
            continue
        filas.append(n)
        urls.add(n["url"]); claves.add(n["key"])
        agregadas += 1
    return agregadas


def consultar_compartidos():
    """Recorre la búsqueda en las redes de otras cuentas (/api/compartidos), tanda por tanda."""
    def pedir(ruta):
        req = urllib.request.Request(f"{SITIO}{ruta}", headers={"Accept": "application/json", "User-Agent": "jusnoticias-relevamiento"})
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.load(r)
    filas = []
    # Posteos cargados a mano en el tablero (cualquier red; Facebook y TikTok no se pueden leer por API).
    try:
        manuales = pedir("/api/posteo-manual").get("filas") or []
        print(f"Posteos de otras cuentas cargados a mano: {len(manuales)}.")
        filas += manuales
    except Exception as error:
        print(f"AVISO: no se pudo leer la carga manual de posteos ({error}).")
    plan = pedir("/api/compartidos?plan=1")
    for fuente in plan.get("fuentes") or []:
        for lote in range(int(fuente.get("lotes") or 1)):
            try:
                filas += pedir(f"/api/compartidos?fuente={urllib.parse.quote(str(fuente['id']))}&lote={lote}").get("filas") or []
            except Exception as error:
                print(f"AVISO: {fuente.get('nombre')} (tanda {lote}) no respondió ({error}).")
    return filas


def consultar():
    desde = (dt.date.today() - dt.timedelta(days=DIAS - 1)).isoformat()
    url = f"{SITIO}/api/redes?desde={desde}&redes={REDES}"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "jusnoticias-relevamiento"})
    with urllib.request.urlopen(req, timeout=120) as r:
        datos = json.load(r)
    for red, error in (datos.get("errores") or {}).items():
        print(f"AVISO: {red} no respondió: {str(error)[:200]}")
    filas = [f for v in (datos.get("redes") or {}).values() for f in (v.get("filas") or [])]
    # X no se consulta por API (cobra por consulta): se suman los posts cargados a mano en el tablero.
    try:
        req = urllib.request.Request(f"{SITIO}/api/x-manual", headers={"Accept": "application/json", "User-Agent": "jusnoticias-relevamiento"})
        with urllib.request.urlopen(req, timeout=60) as r:
            manuales = json.load(r).get("filas") or []
        print(f"X (carga manual): {len(manuales)} posts.")
        filas += manuales
    except Exception as error:
        print(f"AVISO: no se pudo leer la carga manual de X ({error}).")
    return filas


def main():
    ruta = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "redes2.json"
    guardadas = json.loads(ruta.read_text(encoding="utf-8"))
    try:
        nuevas = consultar()
    except Exception as error:  # la consulta de redes nunca frena el relevamiento
        print(f"AVISO: no se pudo consultar la API de redes ({error}); data/redes2.json queda igual.")
        return 0
    filas, agregadas, actualizadas = combinar(guardadas, nuevas)
    # Posteos de otras cuentas con nuestras notas (solo los comprobados), para que no se pierdan.
    try:
        terceros = sumar_terceros(filas, terceros_comprobados(consultar_compartidos()))
        print(f"Redes de otras cuentas: {terceros} posteos comprobados nuevos.")
    except Exception as error:
        print(f"AVISO: no se pudo consultar la búsqueda en redes de otras cuentas ({error}).")
    if len(filas) < len(guardadas):
        raise SystemExit("Se perderían filas de redes; no se guarda.")
    ruta.write_text(json.dumps(filas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Redes: {len(nuevas)} publicaciones consultadas, {agregadas} nuevas, {actualizadas} con cifras actualizadas, {len(filas)} filas en total.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
