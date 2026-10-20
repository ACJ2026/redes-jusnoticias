#!/usr/bin/env python3
"""Falla si una actualización elimina una publicación de una nota vigente."""
import json
import sys
from historial import publicaciones_faltantes


def main(argv):
    if len(argv) != 4:
        print("Uso: verificar_historial.py REP_ANTERIOR REP_NUEVO NOTAS_NUEVAS", file=sys.stderr)
        return 2
    with open(argv[1], encoding="utf8") as f:
        anteriores = json.load(f)
    with open(argv[2], encoding="utf8") as f:
        nuevas = json.load(f)
    with open(argv[3], encoding="utf8") as f:
        notas = json.load(f)
    ids_vigentes = {n["id"] for n in notas}
    faltantes = publicaciones_faltantes(anteriores, nuevas, ids_vigentes)
    if faltantes:
        print(f"ERROR: faltan {len(faltantes)} publicaciones históricas de notas vigentes.")
        for nota_id, medio in sorted(faltantes, key=lambda x: (str(x[0]), str(x[1]))):
            print(f"  nota_id={nota_id} | medio={medio}")
        return 1
    print("Control de historial OK: no desaparecen publicaciones de notas vigentes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
