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
    nombres = {"strip", "norm", "toks", "shing", "addd", "cerca", "confirmar_por_texto", "classify",
               "motivo_texto", "puntaje_datos", "revisar_texto", "pendientes_texto", "agregar_por_datos"}
    nodos = [n for n in arbol if isinstance(n, ast.FunctionDef) and n.name in nombres]
    nodos += [n for n in arbol if isinstance(n, ast.Assign) and any(getattr(t, "id", "") in ("STOP", "MED") for t in n.targets)]
    import unicodedata
    espacio = {"re": re, "html": html, "dt": dt, "unicodedata": unicodedata}
    exec(compile(ast.Module(body=nodos, type_ignores=[]), "actualizar.py", "exec"), espacio)
    j = {"id": 1, "date": fecha, "tk": espacio["toks"](nota_titulo + " " + nota_texto[:1500]), "sh": espacio["shing"](nota_texto),
         "tb": espacio["toks"](nota_titulo + " " + nota_texto)}
    otra = {"id": 2, "date": fecha, "tk": set(), "sh": set(), "tb": espacio["toks"]("Juzgado de Esquel condena por estafa a un comerciante del centro")}
    import math
    df = {}
    for nota in (j, otra):
        for w in nota["tb"]: df[w] = df.get(w, 0) + 1
    espacio["IDF"] = {w: math.log(2 / n) + 0.1 for w, n in df.items()}
    espacio["REVISADOS"] = {}
    espacio["DIAG_TEXTO"] = []
    espacio["UMBRAL_DATOS"] = 0.25
    espacio["LIMITE_TEXTO"] = "2026-10-10"
    espacio["DATOS_PEND"] = []
    espacio["CANDIDATOS_DATOS"] = {}
    espacio["MAX_POR_NOTA"] = 4
    espacio["FILAS"] = []
    espacio["addrow"] = lambda medio, m, metodo, *resto: espacio["FILAS"].append((medio, m["nid"], metodo, m["u"]))
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


class LecturaTextoCompletoTest(unittest.TestCase):
    def test_reescritura_con_datos_propios_queda_por_revisar_con_motivo(self):
        e = cargar_segunda_oportunidad(NOTA, TITULO)
        item = {"t": "Madryn: no podrán educarla en casa", "d": "2026-10-19", "u": "https://www.adnsur.com.ar/x"}
        texto = ("La Cámara de Apelaciones de Puerto Madryn ratificó que una niña de cinco años debe asistir a una escuela "
                 "reconocida por el Estado. Sus padres pretendían reemplazar la escolarización presencial por plataformas privadas "
                 "no supervisadas. El tribunal recordó que la educación es un servicio público esencial.")
        out = e["revisar_texto"]([item], {item["u"]: texto}, "ADN Sur")
        candidatos = [m for _, m, _ in e["DATOS_PEND"]] + [m for m, _ in out]
        self.assertEqual(len(candidatos), 1)
        self.assertIn("datos coincidentes", candidatos[0]["motivo"])
        self.assertIn(item["u"], e["REVISADOS"])
        e["agregar_por_datos"]()
        self.assertEqual(len(e["FILAS"]) + len(out), 1)

    def test_otro_tema_no_se_asocia_pero_queda_como_leido(self):
        e = cargar_segunda_oportunidad(NOTA, TITULO)
        item = {"t": "Corte de luz en el barrio Centro", "d": "2026-10-19", "u": "https://www.adnsur.com.ar/luz"}
        texto = "La cooperativa informó un corte programado de energía eléctrica en varias calles del barrio por tareas de mantenimiento."
        self.assertEqual(e["revisar_texto"]([item], {item["u"]: texto}), [])
        self.assertEqual(e["DATOS_PEND"], [])
        self.assertIn(item["u"], e["REVISADOS"])

    def test_lo_ya_leido_o_viejo_no_se_vuelve_a_leer(self):
        e = cargar_segunda_oportunidad(NOTA, TITULO)
        e["REVISADOS"]["https://a.com/1"] = "2026-10-20"
        items = [{"t": "x", "d": "2026-10-20", "u": "https://a.com/1"}, {"t": "y", "d": "2026-09-01", "u": "https://a.com/2"},
                 {"t": "z", "d": "2026-10-21", "u": "https://a.com/3"}]
        self.assertEqual([i["u"] for i in e["pendientes_texto"](items, [])], ["https://a.com/3"])

    def test_nota_que_coincide_con_demasiados_articulos_se_omite(self):
        e = cargar_segunda_oportunidad(NOTA, TITULO)
        for i in range(6):
            e["DATOS_PEND"].append(("Medio", {"nid": 1, "u": f"https://m.com/{i}", "metodo": "Revisión de texto (coinciden los datos)"}, ("Redacción propia", False, "")))
        e["DATOS_PEND"].append(("Medio", {"nid": 2, "u": "https://m.com/otra", "metodo": "Revisión de texto (coinciden los datos)"}, ("Redacción propia", False, "")))
        e["agregar_por_datos"]()
        self.assertEqual([f[1] for f in e["FILAS"]], [2])
        self.assertEqual(len(e["CANDIDATOS_DATOS"]), 7)
