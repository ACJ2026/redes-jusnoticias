import sys
import unittest
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import verificar_publicaciones as vp
from historial import publicaciones_faltantes


class VerificarPublicacionesTests(unittest.TestCase):
    def test_redireccion_conserva_url_anterior_para_el_historial(self):
        # Caso real (24/10): EQS Notas redirigió y el control de historial frenaba el guardado.
        vieja = "https://www.eqsnotas.com/judiciales/una-frenada-brusca_a6abbbcab06f9f6e175f3bf48"
        nueva = "https://eqsnotas.com/judiciales/una-frenada-brusca-otra-ruta_a6abbbcab06f9f6e175f3bf48"
        anterior = {"nota_id": 14593, "medio": "EQS Notas", "url": vieja}
        fila = dict(anterior)
        vp.reemplazar_url(fila, nueva)
        self.assertEqual(fila["url"], nueva)
        self.assertEqual(fila["url_alternativas"], [vieja])
        self.assertEqual(publicaciones_faltantes([anterior], [fila], {14593}), set())
        # Sin la URL anterior, el control la daría por perdida.
        self.assertTrue(publicaciones_faltantes([anterior], [{**anterior, "url": nueva}], {14593}))

    def test_misma_url_o_buscador_no_agrega_alternativas(self):
        fila = {"url": "https://www.medio.com/nota/1/"}
        vp.reemplazar_url(fila, "https://medio.com/nota/1")
        self.assertNotIn("url_alternativas", fila)
        fila = {"url": "https://news.google.com/rss/articles/ABC?oc=5"}
        vp.reemplazar_url(fila, "https://medio.com/nota/2")
        self.assertNotIn("url_alternativas", fila)

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

    def test_motivos_de_acceso_se_explican_en_lenguaje_simple(self):
        bloqueado = urllib.error.HTTPError("https://medio.example/nota", 403, "Forbidden", {}, None)
        retirado = urllib.error.HTTPError("https://medio.example/nota", 404, "Not Found", {}, None)
        self.assertIn("bloqueó el acceso automático", vp.motivo_error_acceso(bloqueado))
        self.assertIn("publicación fue retirada", vp.motivo_error_acceso(retirado))
        self.assertIn("No se pudo conectar", vp.motivo_error_acceso(urllib.error.URLError("network down")))

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
