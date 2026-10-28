#!/usr/bin/env python3
"""Arma la versión pública del tablero de repercusión JusNoticias.
Uso: python3 armar_publico.py <notas2.json> <rep2.json> <redes2.json> <canales.json> <medios.json> <salida.html>
"""
import sys, json, datetime as dt
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T = (ROOT / "templates" / "tablero.html").read_text(encoding="utf-8")
try:
    datos_actualizados = (ROOT / "data" / "actualizado.txt").read_text(encoding="utf-8").strip() or None
except OSError:
    datos_actualizados = None
f = sys.argv[1:7]
L = lambda p: json.load(open(p, encoding="utf-8"))
ahora = dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).strftime("%d/%m/%Y %H:%M")
d = {"notas": L(f[0]), "repercusion": L(f[1]), "redes": L(f[2]), "canales": L(f[3]), "medios": L(f[4]), "actualizado": ahora, "datos_actualizados": datos_actualizados}
# Cuentas de terceros que compartieron notas (opcional: el tablero funciona sin el archivo).
try:
    d["cuentas"] = L(ROOT / "data" / "cuentas_monitoreo.json").get("cuentas", [])
except OSError:
    d["cuentas"] = []
# Sede de cada medio (y de sus alias) según el inventario único; solo las confirmadas.
try:
    d["localidades"] = {}
    for m in L(ROOT / "data" / "medios_inventario.json").get("medios", []):
        if m.get("localidad") and m["localidad"] != "Por verificar":
            for nombre in [m["nombre"]] + list(m.get("alias") or []):
                d["localidades"][nombre] = m["localidad"]
except OSError:
    d["localidades"] = {}
# Otros nombres con que aparece un medio (p. ej. «examedia.com.ar» es Examedia), según el inventario.
try:
    d["alias_medios"] = {}
    for m in L(ROOT / "data" / "medios_inventario.json").get("medios", []):
        for alias in m.get("alias") or []:
            if alias and alias != m["nombre"]:
                d["alias_medios"][alias] = m["nombre"]
except OSError:
    d["alias_medios"] = {}
js = json.dumps(d, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
# Versión de los archivos de código: cambia cuando cambian, así el navegador no usa una copia vieja.
import hashlib
huella = hashlib.sha1()
for nombre in ("panel-vivo.js", "panel-vivo.css", "tablero-plausible.js", "tablero-plausible.css"):
    try:
        huella.update((ROOT / "publico" / nombre).read_bytes())
    except OSError:
        pass
version = huella.hexdigest()[:10]
open(f[5], "w", encoding="utf-8").write(T.replace("__VERSION__", version).replace("/*DATOS*/", js))
print("OK publico", len(d["notas"]), "notas", len(d["repercusion"]), "publicaciones", len(d["redes"]), "posteos")
