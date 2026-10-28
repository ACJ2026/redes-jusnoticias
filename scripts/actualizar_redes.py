#!/usr/bin/env python3
"""Suma a data/redes2.json las publicaciones propias que devuelve la API de redes del sitio.

Uso: python3 scripts/actualizar_redes.py [data/redes2.json]

- Consulta /api/redes del sitio publicado (últimos 30 días; Facebook, Instagram, YouTube y TikTok).
- Agrega las publicaciones nuevas y actualiza las cifras (me gusta, comentarios, compartidos,
  vistas) de las que ya estaban. Nunca borra filas ni pisa una cifra con «sin dato».
- Si la consulta falla, no cambia nada.
"""
import datetime as dt
import json
import os
import re
import sys
import unicodedata
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
            filas.append(fila)
            por_clave[fila["key"]] = fila
            usadas.add(id(fila))
            agregadas += 1
            continue
        usadas.add(id(previa))
        cambio = False
        for campo in CIFRAS:
            valor = n.get(campo)
            if isinstance(valor, (int, float)) and valor != previa.get(campo):
                previa[campo] = valor
                cambio = True
        actualizadas += cambio
    return filas, agregadas, actualizadas


def consultar():
    desde = (dt.date.today() - dt.timedelta(days=DIAS - 1)).isoformat()
    url = f"{SITIO}/api/redes?desde={desde}&redes={REDES}"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "jusnoticias-relevamiento"})
    with urllib.request.urlopen(req, timeout=120) as r:
        datos = json.load(r)
    for red, error in (datos.get("errores") or {}).items():
        print(f"AVISO: {red} no respondió: {str(error)[:200]}")
    return [f for v in (datos.get("redes") or {}).values() for f in (v.get("filas") or [])]


def main():
    ruta = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "redes2.json"
    guardadas = json.loads(ruta.read_text(encoding="utf-8"))
    try:
        nuevas = consultar()
    except Exception as error:  # la consulta de redes nunca frena el relevamiento
        print(f"AVISO: no se pudo consultar la API de redes ({error}); data/redes2.json queda igual.")
        return 0
    filas, agregadas, actualizadas = combinar(guardadas, nuevas)
    if len(filas) < len(guardadas):
        raise SystemExit("Se perderían filas de redes; no se guarda.")
    ruta.write_text(json.dumps(filas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Redes: {len(nuevas)} publicaciones consultadas, {agregadas} nuevas, {actualizadas} con cifras actualizadas, {len(filas)} filas en total.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
