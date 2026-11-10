"""Un medio que ya publicó una nota nuestra entra solo a la lectura directa (mecanismo, sin datos reales)."""
import re
import unittest
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
FUENTE = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")


def funcion():
    ns = {"urlparse": urlparse, "re": re}
    exec(FUENTE[FUENTE.index("WP_NO_DESCUBRIR = "):FUENTE.index("def detectar_wp")], ns)
    exec(FUENTE[FUENTE.index("def sumar_medios_del_historial"):FUENTE.index("WP = {")], ns)
    return ns["sumar_medios_del_historial"]


class MediosDelHistorialTest(unittest.TestCase):
    def test_suma_solo_medios_nuevos_con_enlace_directo_contado(self):
        registro = [{"nombre": "Ya Registrado", "dominio": "yaregistrado.com"}]
        historial = [
            {"medio": "Vivo X", "url": "https://www.vivox.com/nota-1", "confianza": "Media"},       # entra
            {"medio": "Vivo X", "url": "https://vivox.com/nota-2", "confianza": "Alta"},            # mismo dominio: una vez
            {"medio": "Descartado", "url": "https://descartado.com/a", "confianza": "Baja"},       # descartada
            {"medio": "Por Google", "url": "https://news.google.com/rss/articles/X", "confianza": "Media"},
            {"medio": "Conocido", "url": "https://conocido.com/a", "confianza": "Alta"},           # ya se lee directo
            {"medio": "Ya Registrado", "url": "https://yaregistrado.com/a", "confianza": "Alta"},
            {"medio": "Extranjero", "url": "https://medio.com.do/a", "confianza": "Media"},
            {"medio": "Gobierno", "url": "https://chubut.gob.ar/a", "confianza": "Media"},
        ]
        sumados = funcion()(registro, historial, ["www.conocido.com"], "2026-11-10")
        self.assertEqual(sumados, 1)
        self.assertEqual(registro[-1]["dominio"], "vivox.com")
        self.assertEqual(registro[-1]["estado"], "visto_en_historial")

    def test_se_llama_antes_de_detectar_wordpress(self):
        self.assertLess(FUENTE.index("print('Medios del historial sumados a lectura directa:'"), FUENTE.index("pendientes_wp = ["))


if __name__ == "__main__":
    unittest.main()
