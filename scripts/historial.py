"""Funciones puras para conservar y validar el historial de publicaciones."""
from __future__ import annotations


def conservar_historial(rows, anteriores, ids_vigentes, cobertura):
    """Fusiona filas nuevas con el historial para notas que siguen vigentes.

    La identidad es (nota_id, medio). No muta la lista de filas de entrada.
    """
    resultado = [dict(r) for r in rows]
    por_par = {}
    for fila in resultado:
        par = (fila.get("nota_id"), fila.get("medio"))
        por_par.setdefault(par, fila)

    for anterior in anteriores:
        nota_id = anterior.get("nota_id")
        medio = anterior.get("medio")
        if nota_id not in ids_vigentes:
            continue
        par = (nota_id, medio)
        if par in por_par:
            actual = por_par[par]
            for campo, valor in anterior.items():
                if campo in ("key", "metodo"):
                    continue
                if actual.get(campo) in (None, "") and valor not in (None, ""):
                    actual[campo] = valor
            metodos = []
            for metodo in (anterior.get("metodo", ""), actual.get("metodo", "")):
                for parte in metodo.split(" + "):
                    parte = parte.strip()
                    if parte and parte not in metodos:
                        metodos.append(parte)
            if metodos:
                actual["metodo"] = " + ".join(metodos)
        else:
            fila = {k: v for k, v in anterior.items() if k != "key"}
            resultado.append(fila)
            por_par[par] = fila
            if medio:
                cobertura.setdefault(
                    medio, "Se conservan publicaciones de revisiones anteriores"
                )
    return resultado


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
    """Devuelve parejas históricas que faltan para notas vigentes."""
    claves_anteriores = {
        (r.get("nota_id"), r.get("medio"))
        for r in anteriores
        if r.get("nota_id") in ids_vigentes
    }
    claves_nuevas = {(r.get("nota_id"), r.get("medio")) for r in nuevas}
    return claves_anteriores - claves_nuevas
