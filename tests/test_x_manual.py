"""Carga manual de posts de X: valida enlace y cifras; una cifra vacía es «sin dato» (mecanismo)."""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FUNCION = ROOT / "functions/api/x-manual.js"
PLANTILLA = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")


def js(expr):
    codigo = "const m = await import(process.argv[1]); try { console.log(JSON.stringify(" + expr + ")); } catch (e) { console.log(JSON.stringify({error: e.message})); }"
    salida = subprocess.run(["node", "--input-type=module", "-e", codigo, FUNCION.as_uri()], capture_output=True, text=True, check=True)
    return json.loads(salida.stdout)


class XManualTest(unittest.TestCase):
    def test_acepta_solo_posts_de_la_cuenta(self):
        self.assertEqual(js("m.leerEnlace('https://twitter.com/Jus_Noticias/status/1980000000000000001?s=20')"),
                         {"id": "1980000000000000001", "url": "https://x.com/Jus_Noticias/status/1980000000000000001"})
        self.assertIn("error", js("m.leerEnlace('https://x.com/otra_cuenta/status/1980000000000000001')"))
        self.assertIn("error", js("m.leerEnlace('https://example.com/Jus_Noticias/status/1980000000000000001')"))

    def test_cifra_vacia_es_sin_dato_y_no_cero(self):
        self.assertIsNone(js("m.leerCifra('')"))
        self.assertEqual(js("m.leerCifra('1.234')"), 1234)
        self.assertIn("error", js("m.leerCifra('-3')"))

    def test_guardar_pide_clave_y_mismo_origen(self):
        fuente = FUNCION.read_text(encoding="utf-8")
        self.assertIn("claveCorrecta(auth.startsWith(\"Bearer \")", fuente)
        self.assertIn("if (!sameOrigin(request))", fuente)

    def test_el_tablero_tiene_el_formulario_y_suma_los_posts(self):
        self.assertIn('<form id="x-form" class="x-form">', PLANTILLA)
        self.assertIn("Promise.all([cargarRevisiones(), cargarXManual(), cargarPosteosManuales()])", PLANTILLA)
        # Una cifra vacía no pisa una guardada.
        self.assertIn("if (typeof f[k] === 'number') D.redes[i][k] = f[k];", PLANTILLA)


if __name__ == "__main__":
    unittest.main()
