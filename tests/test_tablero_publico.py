import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


class TableroPublicoTests(unittest.TestCase):
    def test_plantilla_y_archivos_publicos_estan_sincronizados(self):
        data = {
            "notas": read_json("data/notas2.json"),
            "repercusion": read_json("data/rep2.json"),
            "redes": read_json("data/redes2.json"),
            "canales": read_json("data/canales.json"),
            "medios": read_json("data/medios.json"),
        }
        public = (ROOT / "publico/index.html").read_text(encoding="utf-8")
        embedded = re.search(
            r'<script type="application/json" id="datos">([\s\S]*?)</script>',
            public,
        )
        self.assertIsNotNone(embedded)
        payload = embedded.group(1)
        data["actualizado"] = json.loads(payload)["actualizado"]
        self.assertEqual(json.loads(payload), data)
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertEqual(template.count("/*DATOS*/"), 1)
        self.assertEqual(template.replace("/*DATOS*/", payload), public)
        self.assertEqual(
            public,
            (ROOT / "publico/tablero_publico.html").read_text(encoding="utf-8"),
        )

    def test_portada_visual_precede_al_tablero_oculto(self):
        public = (ROOT / "publico/index.html").read_text(encoding="utf-8")
        self.assertIn('<title>JusNoticias | Tablero de repercusión y comunicación judicial</title>', public)
        self.assertIn('id="portada"', public)
        self.assertIn('id="entrar-tablero"', public)
        self.assertIn('id="dashboard-app" hidden', public)
        self.assertLess(public.index('id="portada"'), public.index('id="dashboard-app" hidden'))

    def test_canal_general_no_se_cuenta_como_cuenta_propia_de_jusnoticias(self):
        redes = read_json("data/redes2.json")
        own = [
            r for r in redes
            if r.get("red") == "YouTube"
            and "Poder Judicial del Chubut" in r.get("cuenta", "")
            and r.get("propia") == "Sí"
        ]
        self.assertEqual(own, [])
        canales = read_json("data/canales.json")
        self.assertTrue(any(
            c.get("red") == "YouTube"
            and c.get("cuenta") == "JusNoticias Prensa"
            and c.get("seguidores") is None
            for c in canales
        ))

    def test_catalogo_territorial_incluye_medios_verificados(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("'Del Mar Digital':'Comodoro Rivadavia'", template)
        self.assertIn("'ADN Sur':'Comodoro Rivadavia'", template)
        self.assertIn("'EQS Notas':'Esquel'", template)
        self.assertIn("'Digital Chubut':'Puerto Madryn'", template)

    def test_no_hay_credenciales_en_el_html_publico(self):
        public = (ROOT / "publico/index.html").read_text(encoding="utf-8")
        self.assertNotRegex(public, r"-----BEGIN PRIVATE KEY-----\s+[A-Za-z0-9+/=]{40,}")
        self.assertNotIn("META_TOKEN=", public)
        self.assertNotIn("GOOGLE_SERVICE_ACCOUNT_JSON=", public)


if __name__ == "__main__":
    unittest.main()
