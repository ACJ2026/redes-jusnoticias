"""Una publicación histórica que se cae en una corrida vuelve tal como estaba (mecanismo, sin datos reales)."""
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from reincorporar_historial import reincorporar
from historial import publicaciones_faltantes


class ReincorporarTest(unittest.TestCase):
    def test_vuelve_la_fila_perdida_con_su_misma_confianza(self):
        previa = [{"nota_id": 1, "medio": "Radio X", "url": "https://radiox.com/a", "confianza": "Baja", "key": "p9"},
                  {"nota_id": 1, "medio": "Diario Y", "url": "https://diarioy.com/b", "confianza": "Alta", "key": "p3"}]
        nueva = [{"nota_id": 1, "medio": "Diario Y", "url": "https://diarioy.com/b", "confianza": "Alta"}]
        salida, vueltas = reincorporar(previa, nueva, {1})
        self.assertEqual([(r["medio"], r["confianza"]) for r in vueltas], [("Radio X", "Baja")])
        self.assertEqual(publicaciones_faltantes(previa, salida, {1}), set())
        self.assertEqual([r["key"] for r in salida], ["p0", "p1"])

    def test_sin_perdidas_no_cambia_nada(self):
        previa = [{"nota_id": 1, "medio": "Diario Y", "url": "https://diarioy.com/b"}]
        salida, vueltas = reincorporar(previa, [dict(previa[0])], {1})
        self.assertEqual((len(salida), vueltas), (1, []))

    def test_notas_que_ya_no_estan_no_se_reincorporan(self):
        previa = [{"nota_id": 2, "medio": "Radio X", "url": "https://radiox.com/a"}]
        salida, vueltas = reincorporar(previa, [], {1})
        self.assertEqual((salida, vueltas), ([], []))

    def test_el_flujo_reincorpora_antes_del_control_y_avisa_si_falla_dos_veces(self):
        flujo = (ROOT / ".github/workflows/actualizar.yml").read_text(encoding="utf-8")
        self.assertLess(flujo.index("scripts/reincorporar_historial.py"), flujo.index("scripts/verificar_historial.py"))
        self.assertIn("timeout-minutes: 90", flujo)
        self.assertIn("needs: actualizar", flujo)
        self.assertIn('gh issue create --title "$TITULO"', flujo)
        self.assertIn('gh issue close "$abierto"', flujo)


if __name__ == "__main__":
    unittest.main()
