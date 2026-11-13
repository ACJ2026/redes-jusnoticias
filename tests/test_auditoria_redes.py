"""Auditoría de Redes (13/11/2026): mecanismos de los cambios aprobados por Ignacio."""
import datetime as dt
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import actualizar_redes as ar  # noqa: E402

PLANTILLA = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
COMPARTIDOS = (ROOT / "functions/api/compartidos.js").read_text(encoding="utf-8")


class AuditoriaRedesTest(unittest.TestCase):
    def test_seguidores_y_estado_salen_de_la_consulta_en_vivo(self):
        canales = [
            {"red": "Facebook", "cuenta": "JusNoticias (prensastjchubut)", "seguidores": 1, "estado": "Activa"},
            {"red": "Facebook", "cuenta": "JusNoticias STJ", "seguidores": 2, "estado": "Inactiva: último posteo 22/04/2026"},
            {"red": "X", "cuenta": "@Jus_Noticias", "seguidores": 3, "estado": "Sin datos"},
        ]
        vivas = [
            {"red": "Facebook", "cuenta": "JusNoticias", "ok": True, "seguidores": 10, "ultimaPublicacion": "2026-11-12"},
            {"red": "Facebook", "cuenta": "JusNoticias STJ", "ok": True, "seguidores": 20, "ultimaPublicacion": "2026-10-20"},
            {"red": "X", "cuenta": "@Jus_Noticias", "ok": False, "seguidores": None},
        ]
        ar.actualizar_canales(canales, vivas, dt.date(2026, 11, 13))
        self.assertEqual(canales[0]["seguidores"], 10)
        self.assertEqual(canales[1]["seguidores"], 20)
        self.assertEqual(canales[1]["estado"], "Activa: última publicación 20/10/2026")
        # Una cuenta que no respondió queda como estaba.
        self.assertEqual((canales[2]["seguidores"], canales[2]["estado"]), (3, "Sin datos"))

    def test_mucho_tiempo_sin_publicar_es_inactiva(self):
        canales = [{"red": "Facebook", "cuenta": "JusNoticias STJ", "seguidores": 2, "estado": "Activa"}]
        ar.actualizar_canales(canales, [{"red": "Facebook", "cuenta": "JusNoticias STJ", "ok": True, "seguidores": 2, "ultimaPublicacion": "2026-04-22"}], dt.date(2026, 11, 13))
        self.assertEqual(canales[0]["estado"], "Inactiva: último posteo 22/04/2026")

    def test_un_estado_revisado_a_mano_no_se_pisa(self):
        canales = [{"red": "Facebook", "cuenta": "JusNoticias STJ", "seguidores": 2, "estado": "Casi inactiva", "estado_manual": True}]
        ar.actualizar_canales(canales, [{"red": "Facebook", "cuenta": "JusNoticias STJ", "ok": True, "seguidores": 30, "ultimaPublicacion": "2026-11-12"}], dt.date(2026, 11, 13))
        self.assertEqual(canales[0]["estado"], "Casi inactiva")
        self.assertEqual(canales[0]["seguidores"], 30)

    def test_busqueda_en_otras_cuentas_solo_instagram_dirigido(self):
        self.assertIn('const EN_USO = new Set(["ig-dirigida"]);', COMPARTIDOS)
        self.assertIn("FUENTES.filter(f => EN_USO.has(f.id)", COMPARTIDOS)

    def test_historial_de_redes_parejo_desde_septiembre(self):
        self.assertIn("const REDES_DESDE = '2026-09';", PLANTILLA)
        self.assertIn("meses.filter(en).filter(m => m >= REDES_DESDE)", PLANTILLA)
        self.assertIn("const REDES = ['X', 'Instagram', 'Facebook', 'YouTube', 'TikTok'];", PLANTILLA)

    def test_sin_tabla_duplicada_ni_prueba_de_gemini(self):
        self.assertNotIn('id="redes-vivo"', PLANTILLA)
        self.assertFalse((ROOT / "functions/api/comentarios-prueba.js").exists())


if __name__ == "__main__":
    unittest.main()
