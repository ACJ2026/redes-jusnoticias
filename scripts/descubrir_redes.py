#!/usr/bin/env python3
"""Busca en la portada de cada medio del inventario los enlaces a sus redes sociales.

No modifica ningún dato: imprime un informe JSON con las cuentas candidatas por red
(Facebook, Instagram, X, YouTube y TikTok) para revisarlas antes de sumarlas a
data/cuentas_monitoreo.json. Por defecto revisa los medios sin redes identificadas.
Uso: python3 scripts/descubrir_redes.py [--todos]
"""
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "Mozilla/5.0 (compatible; JusNoticiasTablero/1.0; +https://jusnoticias.pages.dev)"}

# Cuentas, no publicaciones ni botones de «compartir».
PATRONES = {
    "Facebook": re.compile(r"https?://(?:www\.|m\.|es-la\.)?facebook\.com/(?!sharer|share|dialog|plugins|tr\b|groups/|watch|events/|profile\.php\?id=0)([A-Za-z0-9.\-]{3,80})/?(?=[\"'?#\s<])", re.I),
    "Instagram": re.compile(r"https?://(?:www\.)?instagram\.com/(?!p/|reel/|reels/|explore/|accounts/|stories/)([A-Za-z0-9._]{2,30})/?(?=[\"'?#\s<])", re.I),
    "X": re.compile(r"https?://(?:www\.)?(?:twitter|x)\.com/(?!intent|share|home|search|hashtag|i/)([A-Za-z0-9_]{2,15})/?(?=[\"'?#\s<])", re.I),
    "YouTube": re.compile(r"https?://(?:www\.)?youtube\.com/((?:channel/|c/|user/|@)[A-Za-z0-9_.\-]{2,60})/?(?=[\"'?#\s<])", re.I),
    "TikTok": re.compile(r"https?://(?:www\.)?tiktok\.com/@([A-Za-z0-9._]{2,30})/?(?=[\"'?#\s<])", re.I),
}
# Cuentas genéricas de plantillas o de terceros que no son del medio.
DESCARTAR = re.compile(r"^(wordpress|wix|elementor|themeforest|envato|google|youtube|facebook|instagram|twitter|tiktok|jusnoticias|juschubut|pjchubut|home|search|login)$", re.I)


def formato(red, valor):
    if red in ("Instagram", "X", "TikTok"):
        return "@" + valor
    if red == "YouTube":
        return "/" + valor
    return "/" + valor


def redes_de(medio):
    url = medio.get("url") or ("https://" + medio["dominio"] if medio.get("dominio") else "")
    if not url:
        return medio["nombre"], None, "sin dirección del sitio"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=15) as resp:
            html = resp.read(1_500_000).decode(resp.headers.get_content_charset() or "utf-8", "replace")
    except Exception as exc:  # el informe registra el error y sigue con el resto
        return medio["nombre"], None, type(exc).__name__ + ": " + str(exc)[:120]
    encontradas = {}
    for red, patron in PATRONES.items():
        valores = []
        for v in patron.findall(html):
            v = v.rstrip("/.")
            if DESCARTAR.match(v.split("/")[-1].lstrip("@")):
                continue
            cuenta = formato(red, v)
            if cuenta.lower() not in [x.lower() for x in valores]:
                valores.append(cuenta)
        if valores:
            # Más de 3 cuentas suele indicar enlaces a notas o a terceros: se marca para revisar.
            encontradas[red] = valores[:3] + (["(hay más; revisar)"] if len(valores) > 3 else [])
    return medio["nombre"], {"url": url, "redes": encontradas}, None


def main(argv):
    inventario = json.loads((ROOT / "data" / "medios_inventario.json").read_text(encoding="utf-8"))["medios"]
    medios = inventario if "--todos" in argv else [m for m in inventario if not (m.get("redes") or {})]
    with ThreadPoolExecutor(max_workers=8) as ex:
        resultados = list(ex.map(redes_de, medios))
    informe = {"revisados": len(medios), "con_redes": {}, "sin_redes_en_portada": [], "errores": {}}
    for nombre, datos, error in resultados:
        if error:
            informe["errores"][nombre] = error
        elif datos["redes"]:
            informe["con_redes"][nombre] = datos
        else:
            informe["sin_redes_en_portada"].append(nombre)
    print("INFORME_REDES_INICIO")
    print(json.dumps(informe, ensure_ascii=False, indent=1))
    print("INFORME_REDES_FIN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
