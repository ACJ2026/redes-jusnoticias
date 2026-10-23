#!/usr/bin/env python3
"""Arma data/medios_inventario.json: un registro por medio con todo lo que sabemos de él.

Junta, sin modificar ninguna fuente: medios.json (cobertura), rep2.json (publicaciones y
dominio real), fuentes_descubiertas.json (detección automática), la lista de sitios WordPress
de actualizar.py, las cuentas de cuentas_monitoreo.json y las sedes del tablero.

Los campos que se cargan a mano (MANUALES) nunca se pisan: si el inventario ya existe,
se conservan. Así se puede corregir la localidad o el tipo de un medio editando el JSON.
Uso: python3 scripts/armar_inventario.py
"""
import ast
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from historial import es_enlace_directo  # noqa: E402

SALIDA = ROOT / "data" / "medios_inventario.json"
MANUALES = ("localidad", "tipo", "estado_manual", "observaciones")
REDES = ("Facebook", "Instagram", "X", "YouTube", "TikTok")


def leer(nombre, defecto):
    try:
        return json.loads((ROOT / "data" / nombre).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return defecto


def dominio(url):
    host = (urlsplit(url or "").netloc or "").lower()
    return host[4:] if host.startswith("www.") else host


def wordpress_fijos():
    """Lee el diccionario WP de actualizar.py sin ejecutar el script."""
    fuente = (ROOT / "scripts" / "actualizar.py").read_text(encoding="utf-8")
    for nodo in ast.parse(fuente).body:
        if isinstance(nodo, ast.Assign) and any(getattr(t, "id", "") == "WP" for t in nodo.targets):
            return {k: v.replace("www.", "") for k, v in ast.literal_eval(nodo.value).items()}
    return {}


def sedes_del_tablero():
    """Sedes cargadas en la plantilla (localidadMedio); la última definición manda."""
    plantilla = (ROOT / "templates" / "tablero.html").read_text(encoding="utf-8")
    bloque = plantilla[plantilla.index("const localidadMedio = {"):]
    bloque = bloque[:bloque.index("};")]
    return dict(re.findall(r"'([^']+)':'([^']+)'", bloque))


def tipo_estimado(nombre):
    # Mismo criterio que tipoMedio() en el tablero.
    if re.search(r"\bweb\b|\.com$", nombre, re.I):
        return "Portal digital"
    if re.search(r"radio|\bfm\b|\blu17\b", nombre, re.I):
        return "Radio"
    if re.search(r"canal|\btv\b", nombre, re.I):
        return "TV"
    if re.fullmatch(r"crónica", nombre, re.I) or re.search(r"diario|revista|\bla opinión\b", nombre, re.I):
        return "Prensa gráfica"
    return "Portal digital"


def estado_desde_cobertura(cobertura):
    c = (cobertura or "").lower()
    if "temporalmente no disponible" in c:
        return "Temporalmente no disponible"
    if "sin datos" in c or "no devolvió" in c:
        return "Sin datos en la última consulta"
    if c.startswith("revisión completa") or "verificada manualmente" in c:
        return "Activo: lectura directa"
    if "google noticias" in c or "buscador" in c:
        return "Activo: solo por buscadores"
    if "se conservan" in c:
        return "Solo historial (no se consulta directamente)"
    return "Sin clasificar"


def metodo_desde(nombre, cobertura, wp, descubierto):
    c = (cobertura or "").lower()
    if nombre in wp:
        return "WordPress (lectura directa)"
    if descubierto and descubierto.get("wp"):
        return "WordPress descubierto (lectura directa)"
    if "sitemap" in c or nombre in ("ADN Sur", "EQS Notas", "LU17", "La Opinión Austral", "La Tecla Patagonia"):
        return "Sitemap / índice propio"
    if "google noticias" in c or "buscador" in c or descubierto:
        return "Google Noticias y Bing Noticias"
    return "Sin método automático"


def main():
    medios = leer("medios.json", [])
    rep = leer("rep2.json", [])
    descubiertos = {r.get("nombre"): r for r in leer("fuentes_descubiertas.json", []) if r.get("nombre")}
    cuentas = leer("cuentas_monitoreo.json", {}).get("cuentas", [])
    previo = {m["nombre"]: m for m in (leer("medios_inventario.json", {}).get("medios", []))}
    wp = wordpress_fijos()
    sedes = sedes_del_tablero()

    # Dominio real de cada medio según sus enlaces directos.
    hosts = defaultdict(Counter)
    publicaciones, notas, ejemplo, fechas = Counter(), defaultdict(set), {}, defaultdict(list)
    for r in rep:
        m = r.get("medio")
        if not m:
            continue
        publicaciones[m] += 1
        notas[m].add(r.get("nota_id"))
        if es_enlace_directo(r.get("url", "")):
            hosts[m][dominio(r["url"])] += 1
            ejemplo.setdefault(m, r["url"])

    nombres = list(dict.fromkeys([m["medio"] for m in medios] + list(publicaciones) + list(wp) + list(descubiertos)))
    cobertura = {m["medio"]: m.get("cobertura", "") for m in medios}

    registros = []
    for nombre in nombres:
        desc = descubiertos.get(nombre)
        dom = (hosts[nombre].most_common(1)[0][0] if hosts[nombre] else "") or wp.get(nombre, "") or (desc or {}).get("dominio", "")
        reg = {
            "nombre": nombre,
            "alias": [],
            "dominio": dom,
            "url": ("https://" + dom) if dom else "",
            "tipo": tipo_estimado(nombre),
            "localidad": sedes.get(nombre, "Por verificar"),
            "metodo": metodo_desde(nombre, cobertura.get(nombre), wp, desc),
            "estado": estado_desde_cobertura(cobertura.get(nombre)),
            "cobertura": cobertura.get(nombre, ""),
            "publicaciones": publicaciones.get(nombre, 0),
            "notas": len(notas.get(nombre, ())),
            "ejemplo": ejemplo.get(nombre, ""),
            "primera_deteccion": (desc or {}).get("primera_deteccion", ""),
            "ultima_deteccion": (desc or {}).get("ultima_deteccion", ""),
            "redes": {},
        }
        for c in cuentas:
            if c.get("medio") == nombre and c.get("red") in REDES:
                reg["redes"].setdefault(c["red"], []).append(c.get("cuenta") or ("Dudosa: " + c.get("estado", "")))
        anterior = previo.get(nombre, {})
        for campo in MANUALES:
            if anterior.get(campo) not in (None, "") and anterior.get("_manual", {}).get(campo):
                reg[campo] = anterior[campo]
        if anterior.get("_manual"):
            reg["_manual"] = anterior["_manual"]
        registros.append(reg)

    # El mismo dominio con varios nombres es un mismo medio: el de más publicaciones queda
    # como nombre principal y los demás como alias (no se borra ningún registro de rep2).
    por_dominio = defaultdict(list)
    for reg in registros:
        if reg["dominio"]:
            por_dominio[reg["dominio"]].append(reg)
    fusionados = set()
    for regs in por_dominio.values():
        if len(regs) < 2:
            continue
        regs.sort(key=lambda r: (-r["publicaciones"], r["nombre"]))
        principal = regs[0]
        for otro in regs[1:]:
            principal["alias"].append(otro["nombre"])
            principal["publicaciones"] += otro["publicaciones"]
            principal["notas"] += otro["notas"]
            for red, lista in otro["redes"].items():
                principal["redes"].setdefault(red, []).extend(x for x in lista if x not in principal["redes"].get(red, []))
            if principal["localidad"] == "Por verificar" and otro["localidad"] != "Por verificar":
                principal["localidad"] = otro["localidad"]
            fusionados.add(id(otro))
    registros = [r for r in registros if id(r) not in fusionados]
    registros.sort(key=lambda r: (-r["publicaciones"], r["nombre"].lower()))

    salida = {
        "descripcion": "Inventario único de medios. Se regenera con scripts/armar_inventario.py; "
                       "para corregir a mano localidad, tipo, estado u observaciones, editá el campo y "
                       "marcalo en \"_manual\" (por ejemplo \"_manual\": {\"localidad\": true}) para que no se pise.",
        "medios": registros,
    }
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("OK inventario", len(registros), "medios")


if __name__ == "__main__":
    main()
