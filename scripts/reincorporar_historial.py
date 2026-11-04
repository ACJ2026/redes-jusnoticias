#!/usr/bin/env python3
"""Vuelve a poner en la salida nueva las publicaciones históricas que se cayeron.

Uso: reincorporar_historial.py REP_ANTERIOR REP_NUEVO NOTAS_NUEVAS

Si una corrida pierde una publicación de una nota vigente (por un filtro, un enlace que cambió
o lo que sea), antes el control de historial frenaba toda la actualización y el tablero quedaba
viejo (2 y 3/11/2026). Ahora la fila se reincorpora tal como estaba guardada, con su misma
confianza: no se borra historial y no cambia lo que se cuenta. Después corre igual el control
de historial (verificar_historial.py) como última barrera.
"""
import json
import sys

from historial import publicaciones_faltantes


def reincorporar(anteriores, nuevas, ids_vigentes):
    """Devuelve (filas, reincorporadas). No modifica las listas recibidas."""
    salida = [dict(r) for r in nuevas]
    faltan = publicaciones_faltantes(anteriores, salida, ids_vigentes)
    reincorporadas = []
    for previa in anteriores:
        if not faltan or previa.get("nota_id") not in ids_vigentes:
            continue
        # Una fila histórica aporta su par (nota, medio) y sus enlaces; si alguna de esas claves falta, vuelve.
        if publicaciones_faltantes([previa], salida, ids_vigentes):
            fila = {k: v for k, v in previa.items() if k != "key"}
            salida.append(fila)
            reincorporadas.append(fila)
            faltan = publicaciones_faltantes(anteriores, salida, ids_vigentes)
    for i, fila in enumerate(salida):
        fila["key"] = f"p{i}"
    return salida, reincorporadas


def main(argv):
    if len(argv) != 4:
        print("Uso: reincorporar_historial.py REP_ANTERIOR REP_NUEVO NOTAS_NUEVAS", file=sys.stderr)
        return 2
    anteriores = json.load(open(argv[1], encoding="utf8"))
    nuevas = json.load(open(argv[2], encoding="utf8"))
    ids = {n["id"] for n in json.load(open(argv[3], encoding="utf8"))}
    salida, reincorporadas = reincorporar(anteriores, nuevas, ids)
    if not reincorporadas:
        print("Historial completo: no hubo que reincorporar publicaciones.")
        return 0
    json.dump(salida, open(argv[2], "w", encoding="utf8"), ensure_ascii=False)
    print(f"AVISO: se reincorporaron {len(reincorporadas)} publicaciones históricas que esta corrida había perdido:")
    for r in reincorporadas:
        print(f"  nota_id={r.get('nota_id')} | medio={r.get('medio')} | url={r.get('url')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
