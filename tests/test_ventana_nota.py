"""Una publicación anterior a la nota no es su repercusión (decisión de Ignacio, 30/10/2026).

Caso real: la nota 14943 (veredicto del juicio por el crimen de Nieves, 30/10) quedó con
cuatro publicaciones del 29/10 sobre el inicio del juicio, asociadas por compartir el tema.
"""
import ast
import datetime as dt
import re
import unicodedata
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FUENTE = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")


def cargar(*nombres, extra=None):
    """actualizar.py corre al importarse; se aíslan solo las funciones a probar."""
    arbol = ast.parse(FUENTE).body
    nodos = [n for n in arbol if isinstance(n, ast.FunctionDef) and n.name in nombres]
    nodos += [n for n in arbol if isinstance(n, ast.Assign) and any(getattr(t, "id", "") == "STOP" for t in n.targets)]
    espacio = {"re": re, "dt": dt, "unicodedata": unicodedata}
    espacio.update(extra or {})
    exec(compile(ast.Module(body=nodos, type_ignores=[]), "actualizar.py", "exec"), espacio)
    return espacio


NOTA = {
    "id": 1,
    "date": "2026-10-30",
    "titulo": "Crimen de Nieves: Pavei culpable de homicidio en emoción violenta",
}


class VentanaDesdeLaNotaTest(unittest.TestCase):
    def setUp(self):
        e = cargar("norm", "toks", "addd", "match", "cerca")
        nota = dict(NOTA, tk=e["toks"](NOTA["titulo"] + " juicio jurados comodoro fiscalia defensa"))
        e["JN"] = [nota]
        self.e = e
        self.titulo = "Crimen de Nieves: Pavei culpable de homicidio en emoción violenta, dijo el jurado"

    def test_match_no_acepta_publicaciones_del_dia_anterior(self):
        antes = [{"t": self.titulo, "d": "2026-10-29", "u": "https://medio.ar/antes"}]
        self.assertEqual(self.e["match"](antes), [])

    def test_match_acepta_el_mismo_dia_y_los_siguientes(self):
        items = [{"t": self.titulo, "d": "2026-10-30", "u": "https://medio.ar/hoy"},
                 {"t": self.titulo, "d": "2026-11-03", "u": "https://medio.ar/despues"}]
        self.assertEqual({m["u"] for m in self.e["match"](items)}, {"https://medio.ar/hoy", "https://medio.ar/despues"})

    def test_cerca_no_acepta_publicaciones_del_dia_anterior(self):
        antes = [{"t": "Pavei Nieves jurado", "d": "2026-10-29", "u": "https://medio.ar/antes"}]
        self.assertEqual(self.e["cerca"](antes, []), [])

    def test_lu17_conserva_su_ventana_propia(self):
        # La fecha de LU17 es estimada por número de nota: mantiene su margen hacia atrás.
        self.assertIn("match(items, win=12, before=-4, thr=0.67)", FUENTE)

    def test_ninguna_ventana_de_notas_empieza_un_dia_antes(self):
        for patron in (r"addd\(j\['date'\], -1\)", r"addd\(jd, -1\)", r"addd\(j\['fecha'\], -1\)", r"addd\(n\['fecha'\], -1\)"):
            self.assertIsNone(re.search(patron, FUENTE), patron)


class CoincidenciaTematicaTest(unittest.TestCase):
    def test_titulo_parecido_sin_evidencia_pasa_al_verificador(self):
        # En lectura directa de WordPress, un título parecido con redacción propia y sin
        # mención de JusNoticias se marca para que el verificador lo abra y decida.
        self.assertIn("metodo='Revisión completa · coincidencia temática (a verificar)'", FUENTE)
        verificador = (ROOT / "scripts/verificar_publicaciones.py").read_text(encoding="utf-8")
        self.assertIn('"coincidencia temática"', verificador)


if __name__ == "__main__":
    unittest.main()
