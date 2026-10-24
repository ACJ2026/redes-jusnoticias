import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import verificar_publicaciones as vp


class VerificarPublicacionesTests(unittest.TestCase):
    def test_busqueda_no_cuenta_como_enlace_original(self):
        self.assertFalse(vp.url_directa("https://news.google.com/rss/articles/ABC?oc=5"))
        self.assertFalse(vp.url_directa("https://www.bing.com/news/search?q=nota"))
        self.assertTrue(vp.url_directa("https://www.elchubut.com.ar/nota/123"))

    def test_titulo_parecido_sin_contenido_no_alcanza(self):
        titulo = "Comodoro será sede del Congreso Patagónico de Derecho Civil y Comercial"
        cuerpo = "La organización del congreso reunirá profesionales para analizar derecho civil y comercial en la región."
        resultado = vp.evaluar(
            titulo, cuerpo,
            "El Colegio de Abogados organiza el Congreso Patagónico",
            "El Colegio de Abogados informa una jornada sobre actividades institucionales y servicios para matriculados."
        )
        title_common, body_ratio, _, body_common = resultado
        self.assertLess(body_common, 5)
        self.assertLess(body_ratio, 0.08)

    def test_contenido_compartido_da_evidencia_mas_fuerte_que_titulo(self):
        titulo = "JusNoticias presenta el programa de formación judicial patagónica"
        cuerpo = ("El programa de formación judicial patagónica incluye talleres sobre acceso a justicia, "
                  "capacitación de magistrados, evaluación de pruebas y herramientas para resolver conflictos.")
        resultado = vp.evaluar(
            titulo, cuerpo,
            "Presentan el programa de formación judicial patagónica",
            "El programa de formación judicial patagónica incluye talleres sobre acceso a justicia, "
            "capacitación de magistrados, evaluación de pruebas y herramientas para resolver conflictos."
        )
        title_common, body_ratio, _, body_common = resultado
        self.assertGreaterEqual(title_common, 2)
        self.assertGreaterEqual(body_common, 5)
        self.assertGreaterEqual(body_ratio, 0.08)


if __name__ == "__main__":
    unittest.main()
