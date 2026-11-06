"""Justicia.ar: lectura de novedades por número y que ya no esté excluido (mecanismo, sin red)."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FUENTE = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")


def cargar(pagina):
    ns = {}
    codigo = FUENTE[FUENTE.index("def strip(h)"):FUENTE.index("STOP = set")]
    codigo += FUENTE[FUENTE.index("MESES_ES ="):FUENTE.index("try:\n    numeros = ")].replace("get(f'", "GET(f'")
    exec("import re, html, unicodedata\n" + codigo, ns)
    ns["GET"] = lambda *a, **k: pagina
    return ns["novedad_justicia_ar"]


class JusticiaArTest(unittest.TestCase):
    def test_lee_titulo_fecha_y_arma_el_enlace(self):
        pagina = ('<h1 class="fw-700 detalleTituloNovedad">Banfi encabezó una capacitación</h1>'
                  '<div class="col-6 texto-gris-oscuro fw-600">5 de noviembre de 2026</div>')
        self.assertEqual(cargar(pagina)(6342), {"t": "Banfi encabezó una capacitación", "d": "2026-11-05",
                                                "u": "https://www.justicia.ar/novedades/6342/2026/11/banfi-encabezo-una-capacitacion"})

    def test_numero_inexistente_o_sin_fecha_se_saltea(self):
        self.assertIsNone(cargar(None)(6339))
        self.assertIsNone(cargar('<h1 class="detalleTituloNovedad">Algo</h1>')(6339))

    def test_ya_no_esta_en_la_lista_de_excluidos(self):
        linea = next(l for l in FUENTE.splitlines() if l.startswith("NO = re.compile("))
        self.assertNotIn("justicia", linea)
        self.assertIn("addrow('Justicia.ar'", FUENTE)


if __name__ == "__main__":
    unittest.main()
