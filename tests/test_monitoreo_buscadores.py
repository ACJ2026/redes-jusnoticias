import ast
import datetime as dt
import html
import re
import unittest
import urllib.parse
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
FUENTE = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")


def cargar_funcion(nombre):
    # actualizar.py corre al importarse; se aísla solo la función a probar.
    nodo = next(n for n in ast.parse(FUENTE).body if isinstance(n, ast.FunctionDef) and n.name == nombre)
    espacio = {"re": re, "html": html, "urllib": urllib, "urlparse": urlparse, "dt": dt}
    exec(compile(ast.Module(body=[nodo], type_ignores=[]), "actualizar.py", "exec"), espacio)
    return espacio[nombre]


RSS_BING = """<rss><channel>
<item><title>Condenan a una comerciante por difamar a una vecina</title>
<link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;url=https%3a%2f%2fwww.ejemplo.com.ar%2fnota-1&amp;c=1</link>
<pubDate>Tue, 20 Oct 2026 14:00:00 GMT</pubDate><News:Source>Diario Ejemplo</News:Source></item>
<item><title>Sin fecha</title><link>https://otro.com/x</link></item>
</channel></rss>"""


class MonitoreoBuscadoresTest(unittest.TestCase):
    def test_bing_extrae_enlace_real_fecha_y_medio(self):
        items = cargar_funcion("bing_items")(RSS_BING)
        self.assertEqual(len(items), 1)
        it = items[0]
        self.assertEqual(it["u"], "https://www.ejemplo.com.ar/nota-1")
        self.assertEqual(it["dominio"], "ejemplo.com.ar")
        self.assertEqual(it["d"], "2026-10-20")
        self.assertEqual(it["src"], "Diario Ejemplo")
        self.assertEqual(it["buscador"], "Bing Noticias")

    def test_bing_tolera_respuesta_vacia(self):
        self.assertEqual(cargar_funcion("bing_items")(""), [])
        self.assertEqual(cargar_funcion("bing_items")(None), [])

    def test_descubiertos_rotan_y_pasan_a_lectura_directa(self):
        self.assertIn("DOMINIOS_ROTACION = (_rot[_inicio:] + _rot[:_inicio])[:_tramo]", FUENTE)
        self.assertIn("fuentes_wp = [(n, d) for n, d in WP.items()] + [(n, d, 80) for n, d in WP_DESCUBIERTOS.items()]", FUENTE)
        # El registro se carga antes de la sección WordPress que lo usa.
        self.assertLess(FUENTE.index("REGISTRO = cargar_registro()"), FUENTE.index("WP_DESCUBIERTOS = {"))

    def test_dominios_de_otros_paises_no_se_siguen(self):
        patron = re.compile(re.search(r"EXTRANJERO = re\.compile\(r'(.+?)', re\.I\)", FUENTE).group(1), re.I)
        for dominio in ("elatlantico.do", "diariosur.es", "caracol.com.co", "elperuano.pe"):
            self.assertTrue(patron.search(dominio), dominio)
        for dominio in ("rionegro.com.ar", "eldiarioweb.com", "mdzol.com", "noticiasdebariloche.com.ar"):
            self.assertFalse(patron.search(dominio), dominio)

    def test_mismo_medio_con_otro_nombre_se_unifica_por_dominio(self):
        self.assertIn("medio = MEDIO_POR_DOMINIO.get(it.get('dominio', '')) or conocidos.get(", FUENTE)


if __name__ == "__main__":
    unittest.main()
