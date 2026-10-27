"""Mismo caso contado con palabras propias del medio (decisión de Ignacio, 27/10/2026).

Prueban el mecanismo con textos inventados, no cantidades de los datos reales.
"""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from relevancia_publicaciones import evidencia_misma_nota, es_misma_publicacion

TITULO = "Esquel: fallo sancionó a Plan Óvalo y Ford por ocultar información ante la suba desmedida de cuotas"
FRASES = [
    "La Cámara de Apelaciones confirmó la responsabilidad solidaria de la administradora y la fábrica",
    "las pericias contables establecieron que el valor del vehículo aumentó novecientos cincuenta por ciento",
    "la suscriptora inició la demanda en diciembre de dos mil diecinueve por las cuotas impagables",
    "el tribunal entendió que ambas empresas integran un mismo grupo económico y ocultaron información",
    "la multa por daño punitivo se elevó de dos a cuatro millones de pesos con intereses",
    "la administradora deberá restituir los gastos de administración cobrados durante el plan",
    "los camaristas señalaron desinterés frente a la suscriptora mientras las cuotas casi se triplicaban",
    "el precio del automotor lo fija unilateralmente la terminal y las cuotas dependen de ese valor",
]
CUERPO = ". ".join(FRASES) + "."


def reescribir(frases):
    # Las mismas palabras en otro orden: no repite ninguna frase de seis palabras.
    return ". ".join(" ".join(reversed(f.split())) for f in reversed(frases)) + "."


class MismoCasoTest(unittest.TestCase):
    def test_version_propia_del_mismo_caso_cuenta(self):
        ev = evidencia_misma_nota(TITULO, CUERPO, "Compró un auto por plan de ahorro y ganó el juicio a Ford y Plan Óvalo", reescribir(FRASES))
        self.assertFalse(ev["misma_nota"])
        self.assertTrue(ev["mismo_caso"])
        self.assertTrue(es_misma_publicacion(ev))

    def test_otra_nota_con_vocabulario_judicial_no_cuenta(self):
        otra = ("El Superior Tribunal de Justicia realizó una jornada de capacitación para magistrados y funcionarios "
                "sobre el nuevo régimen de responsabilidad penal juvenil. Participaron jueces de toda la provincia, "
                "que debatieron los desafíos de la implementación del sistema y la actividad de las autoridades.")
        ev = evidencia_misma_nota(TITULO, CUERPO, "Capacitación sobre el régimen penal juvenil", otra)
        self.assertFalse(ev["mismo_caso"])
        self.assertFalse(es_misma_publicacion(ev))

    def test_mismo_tema_sin_terminos_del_titulo_no_cuenta(self):
        ev = evidencia_misma_nota(TITULO, CUERPO, "Consejos para elegir un auto usado", reescribir(FRASES))
        self.assertFalse(ev["mismo_caso"])

    def test_texto_corto_no_alcanza(self):
        ev = evidencia_misma_nota(TITULO, CUERPO, "Plan Óvalo y Ford, sancionados", reescribir(FRASES[:2]))
        self.assertFalse(ev["mismo_caso"])

    def test_verificador_y_recolector_usan_el_mismo_criterio(self):
        verificador = (ROOT / "scripts/verificar_publicaciones.py").read_text(encoding="utf-8")
        recolector = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")
        self.assertIn("es_misma_publicacion", verificador)
        self.assertGreaterEqual(recolector.count("es_misma_publicacion("), 3)

    def test_redaccion_propia_ya_no_queda_con_confianza_baja(self):
        recolector = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")
        self.assertIn("else 'Media')", recolector)


class BuscadorTest(unittest.TestCase):
    def test_enlaces_directos_antes_que_google_noticias_y_segunda_oportunidad(self):
        recolector = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")
        self.assertIn("items.sort(key=lambda it: es_google_noticias(it.get('u')))", recolector)
        self.assertIn("segunda_oportunidad.setdefault(it['u'], (it, n))", recolector)
        self.assertIn("mejor_nota_por_texto(it, t)", recolector)
        # La segunda oportunidad no lleva marcas de candidata: el verificador no la reabre.
        self.assertIn('hallado por buscador)"', recolector)


if __name__ == "__main__":
    unittest.main()


class LecturaDirectaSinWordPressTest(unittest.TestCase):
    """Lectura de la lista de noticias (RSS o mapa del sitio) de medios sin WordPress."""

    @classmethod
    def setUpClass(cls):
        import ast, datetime as dt, html, re
        fuente = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")
        arbol = ast.parse(fuente)
        nombres = {"strip", "fecha_iso", "titulo_de_url", "items_de_feed", "items_de_sitemap"}
        nodos = [n for n in arbol.body if isinstance(n, ast.FunctionDef) and n.name in nombres]
        cls.e = {"re": re, "html": html, "dt": dt}
        exec(compile(ast.Module(body=nodos, type_ignores=[]), "actualizar.py", "exec"), cls.e)

    def test_rss_con_titulo_enlace_y_fecha(self):
        xml = ("<rss><channel><item><title><![CDATA[Sancionan a Ford y Plan Óvalo]]></title>"
               "<link>https://medio.com.ar/nota-1</link><pubDate>Tue, 27 Oct 2026 11:00:00 -0300</pubDate></item></channel></rss>")
        self.assertEqual(self.e["items_de_feed"](xml), [{"t": "Sancionan a Ford y Plan Óvalo", "u": "https://medio.com.ar/nota-1", "d": "2026-10-27"}])

    def test_rss_quita_el_nombre_del_medio_al_final_del_titulo(self):
        xml = ("<rss><item><title>Un plan de ahorro aumentó 952% y la Justicia sancionó a Ford - Últimas Noticias: El Chubut</title>"
               "<link>https://agregador.com.ar/post/1</link><pubDate>Tue, 27 Oct 2026 11:00:00 -0300</pubDate></item></rss>")
        self.assertEqual(self.e["items_de_feed"](xml)[0]["t"], "Un plan de ahorro aumentó 952% y la Justicia sancionó a Ford")

    def test_atom(self):
        xml = '<feed><entry><title>Otra nota</title><link href="https://m.com/x"/><published>2026-10-26T10:00:00Z</published></entry></feed>'
        self.assertEqual(self.e["items_de_feed"](xml)[0]["d"], "2026-10-26")

    def test_mapa_del_sitio_usa_titulo_de_noticias_o_el_enlace(self):
        xml = ("<urlset><url><loc>https://m.com/una-nena-faltaba-al-jardin</loc><lastmod>2026-10-24T09:00:00Z</lastmod></url>"
               "<url><loc>https://m.com/n2</loc><news:news><news:publication_date>2026-10-25</news:publication_date>"
               "<news:title>Fallo contra Ford</news:title></news:news></url></urlset>")
        items = self.e["items_de_sitemap"](xml)
        self.assertEqual(items[0]["t"], "una nena faltaba al jardin")
        self.assertEqual(items[1], {"t": "Fallo contra Ford", "u": "https://m.com/n2", "d": "2026-10-25"})

    def test_medios_que_copian_a_otro_tambien_se_leen(self):
        recolector = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")
        self.assertIn("'Examedia': 'examedia.com.ar'", recolector)
        self.assertIn("'El Monterizo': 'elmonterizo.com'", recolector)
        # En los medios sin WordPress, lo que coincide por título también se confirma leyendo el texto.
        self.assertIn("extra = confirmar_por_texto(ms + cerca_ms, textos)", recolector)
