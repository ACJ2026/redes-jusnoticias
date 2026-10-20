#!/usr/bin/env python3
"""Arma la versión pública del tablero de repercusión JusNoticias.
Uso: python3 armar_publico.py <notas2.json> <rep2.json> <redes2.json> <canales.json> <medios.json> <salida.html>
"""
import sys, json, datetime as dt
from pathlib import Path
T = (Path(__file__).resolve().parent.parent / "templates" / "tablero.html").read_text(encoding="utf-8")
f = sys.argv[1:7]
L = lambda p: json.load(open(p, encoding="utf-8"))
ahora = dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).strftime("%d/%m/%Y %H:%M")
d = {"notas": L(f[0]), "repercusion": L(f[1]), "redes": L(f[2]), "canales": L(f[3]), "medios": L(f[4]), "actualizado": ahora}
js = json.dumps(d, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
open(f[5], "w", encoding="utf-8").write(T.replace("/*DATOS*/", js))
print("OK publico", len(d["notas"]), "notas", len(d["repercusion"]), "publicaciones", len(d["redes"]), "posteos")
