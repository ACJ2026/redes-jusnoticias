"""Fecha en que publicó el medio: se guarda solo hacia adelante y nunca inventada (mecanismo, sin red)."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FUENTE = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")


def fecha_del_medio():
    ns = {"re": re}
    exec(FUENTE[FUENTE.index("FECHA_MEDIO_DESDE = "):FUENTE.index("def addrow(")], ns)
    return ns["fecha_del_medio"], ns["FECHA_MEDIO_DESDE"]


class FechaDelMedioTest(unittest.TestCase):
    def test_guarda_la_fecha_que_informa_la_fuente(self):
        f, desde = fecha_del_medio()
        self.assertEqual(f("Comodoro 24", {"d": "2026-11-20T10:00:00"}, "2026-11-19"), "2026-11-20")

    def test_solo_hacia_adelante(self):
        f, desde = fecha_del_medio()
        self.assertEqual(f("Comodoro 24", {"d": "2026-11-05"}, "2026-11-04"), "")
        self.assertEqual(desde, "2026-11-13")

    def test_sin_fecha_valida_o_estimada_no_se_inventa(self):
        f, _ = fecha_del_medio()
        self.assertEqual(f("Comodoro 24", {}, "2026-11-20"), "")
        self.assertEqual(f("Comodoro 24", {"d": "ayer"}, "2026-11-20"), "")
        self.assertEqual(f("Comodoro 24", {"d": "2026-11-18"}, "2026-11-20"), "")
        self.assertEqual(f("LU17", {"d": "2026-11-21"}, "2026-11-20"), "")

    def test_la_fila_lleva_el_campo(self):
        self.assertIn("if fm: fila['fecha_medio'] = fm", FUENTE)


if __name__ == "__main__":
    unittest.main()
