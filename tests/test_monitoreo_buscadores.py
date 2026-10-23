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


def cargar_segunda_oportunidad(nota_texto, nota_titulo, fecha="2026-10-16"):
    # Reúne las funciones auxiliares que usan cerca() y confirmar_por_texto().
    arbol = ast.parse(FUENTE).body
    nombres = {"strip", "norm", "toks", "shing", "addd", "cerca", "confirmar_por_texto", "classify"}
    nodos = [n for n in arbol if isinstance(n, ast.FunctionDef) and n.name in nombres]
    nodos += [n for n in arbol if isinstance(n, ast.Assign) and any(getattr(t, "id", "") in ("STOP", "MED") for t in n.targets)]
    import unicodedata
    espacio = {"re": re, "html": html, "dt": dt, "unicodedata": unicodedata}
    exec(compile(ast.Module(body=nodos, type_ignores=[]), "actualizar.py", "exec"), espacio)
    j = {"id": 1, "date": fecha, "tk": espacio["toks"](nota_titulo + " " + nota_texto[:1500]), "sh": espacio["shing"](nota_texto)}
    espacio["JN"] = [j]
    espacio["JNBY"] = {1: j}
    return espacio


NOTA = ("La Cámara de Apelaciones de Puerto Madryn confirmó la sentencia que ordena a los padres de una niña "
        "de cinco años garantizar su escolarización presencial en una institución educativa reconocida por el Estado. "
        "En tal sentido, no resulta optativo para los padres reemplazar la escuela acreditada por alternativas privadas "
        "no supervisadas. Uno de los puntos más importantes del fallo es que la educación es un servicio público esencial.")
TITULO = "Interés Superior del Niño: fallo ordena la escolarización presencial de una niña de cinco años"


class SegundaOportunidadTest(unittest.TestCase):
    def test_titulo_reescrito_queda_como_candidato_y_se_confirma_por_texto(self):
        e = cargar_segunda_oportunidad(NOTA, TITULO)
        item = {"t": "Quisieron educar a su hija en su casa y la Justicia dijo que debe ir a la escuela presencial",
                "d": "2026-10-19", "u": "https://www.adnsur.com.ar/nota"}
        candidatos = e["cerca"]([item], [])
        self.assertEqual(len(candidatos), 1)
        texto = "Madryn. " + NOTA + " Los padres pueden recurrir."  # copia la nota
        confirmados = e["confirmar_por_texto"](candidatos, {item["u"]: texto})
        self.assertEqual(len(confirmados), 1)
        self.assertEqual(confirmados[0][0]["metodo"], "Revisión completa (confirmado por texto)")

    def test_mismo_tema_sin_frases_en_comun_no_se_acepta(self):
        e = cargar_segunda_oportunidad(NOTA, TITULO)
        item = {"t": "Debate sobre la escolarización presencial y el homeschooling en el país",
                "d": "2026-10-18", "u": "https://otro.com.ar/opinion"}
        candidatos = e["cerca"]([item], [])
        texto = ("Una columna de opinión sobre el proyecto de ley nacional de libertad educativa y el homeschooling "
                 "en Argentina. La Cámara de Apelaciones de Puerto Madryn confirmó la sentencia que ordena a los padres. "
                 "El debate sigue abierto en todo el país con muchas otras voces y argumentos sobre el tema educativo. "
                 + " ".join(f"Párrafo {i} con opiniones distintas de especialistas, docentes y familias sobre la escuela." for i in range(12)))
        self.assertEqual(e["confirmar_por_texto"](candidatos, {item["u"]: texto}), [])

    def test_si_nombra_a_jusnoticias_se_acepta_aunque_redacte_distinto(self):
        e = cargar_segunda_oportunidad(NOTA, TITULO)
        item = {"t": "Escolarización presencial: lo que dijo la Cámara", "d": "2026-10-17", "u": "https://y.com.ar/n"}
        candidatos = e["cerca"]([item], [])
        texto = "Según informó Jusnoticias, la Cámara resolvió el caso de la escolarización de una niña de cinco años."
        self.assertEqual(len(e["confirmar_por_texto"](candidatos, {item["u"]: texto})), 1)

    def test_fuera_de_la_ventana_de_fechas_no_es_candidato(self):
        e = cargar_segunda_oportunidad(NOTA, TITULO)
        item = {"t": "Escolarización presencial de una niña ordenada por la Cámara", "d": "2026-11-20", "u": "https://x.com.ar/n"}
        self.assertEqual(e["cerca"]([item], []), [])

    def test_lo_ya_encontrado_por_titulo_no_se_repite(self):
        e = cargar_segunda_oportunidad(NOTA, TITULO)
        item = {"t": "Escolarización presencial de una niña ordenada por la Cámara", "d": "2026-10-17", "u": "https://x.com.ar/n"}
        self.assertEqual(e["cerca"]([item], [{"u": "https://x.com.ar/n"}]), [])
