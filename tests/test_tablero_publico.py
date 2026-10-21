import json
import re
import subprocess
import sys
import tempfile
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
        data["datos_actualizados"] = (ROOT / "data/actualizado.txt").read_text(encoding="utf-8").strip() or None
        self.assertEqual(json.loads(payload), data)
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertEqual(template.count("/*DATOS*/"), 1)
        self.assertIn('id="portada"', template)
        # El flujo de actualización puede estar regenerando el HTML en paralelo
        # justo después de cambiar la plantilla. La prueba del generador verifica
        # la salida recién generada; aquí comprobamos que los dos archivos públicos
        # versionados no discrepen entre sí.
        self.assertEqual(
            public,
            (ROOT / "publico/tablero_publico.html").read_text(encoding="utf-8"),
        )

    def test_generador_publico_ejecuta_y_usa_la_plantilla_legible(self):
        nombres = ["notas", "repercusion", "redes", "canales", "medios"]
        muestras = {
            "notas": [{"id": 1, "titulo": "Prueba"}],
            "repercusion": [{"nota_id": 1, "medio": "Medio de prueba"}],
            "redes": [],
            "canales": [],
            "medios": [],
        }
        with tempfile.TemporaryDirectory() as tmp:
            paths = []
            for nombre in nombres:
                path = Path(tmp) / f"{nombre}.json"
                path.write_text(json.dumps(muestras[nombre]), encoding="utf-8")
                paths.append(str(path))
            salida = Path(tmp) / "tablero.html"
            run = subprocess.run(
                [sys.executable, str(ROOT / "scripts/armar_publico.py"), *paths, str(salida)],
                capture_output=True,
                text=True,
                check=True,
            )
            html = salida.read_text(encoding="utf-8")
        self.assertIn("OK publico 1 notas 1 publicaciones 0 posteos", run.stdout)
        self.assertIn('id="portada"', html)
        embedded = re.search(
            r'<script type="application/json" id="datos">([\s\S]*?)</script>',
            html,
        )
        self.assertIsNotNone(embedded)
        payload = json.loads(embedded.group(1))
        for nombre in nombres:
            self.assertEqual(payload[nombre], muestras[nombre])
        self.assertRegex(payload["actualizado"], r"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$")
        self.assertEqual(payload["datos_actualizados"], (ROOT / "data/actualizado.txt").read_text(encoding="utf-8").strip() or None)
        self.assertRegex(payload["datos_actualizados"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

    def test_portada_visual_precede_al_tablero_oculto(self):
        public = (ROOT / "publico/index.html").read_text(encoding="utf-8")
        self.assertIn('<title>JusNoticias | Tablero de repercusión y comunicación judicial</title>', public)
        self.assertIn('id="portada"', public)
        self.assertIn('id="entrar-tablero"', public)
        self.assertIn('id="dashboard-app" hidden', public)
        self.assertIn("Datos relevados:", public)
        self.assertIn("Tablero generado:", public)
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
        self.assertIn("'Argentar Noticias':'Comodoro Rivadavia'", template)
        self.assertIn("'Diario Judicial':'Ciudad Autónoma de Buenos Aires'", template)
        self.assertIn("'El 10 TV':'Salta'", template)
        self.assertIn("'El Valle Online':'Valle Inferior del Río Chubut'", template)
        self.assertIn("'El Mediador - Santa Cruz':'Santa Cruz (localidad por verificar)'", template)
        self.assertIn("'Flipr.news':'Cobertura nacional'", template)
        self.assertIn("'Chubut Hoy':'Chubut (localidad por verificar)'", template)
        self.assertIn("'Radio de Camioneros':'Cobertura provincial (Comodoro Rivadavia, Trelew y Puerto Madryn)'", template)
        self.assertIn("'ABC Diario':'Cobertura provincial (Comodoro Rivadavia, Trelew y Rawson)'", template)
        self.assertIn("'La Tecla Patagonia':'Cobertura patagónica (localidad por verificar)'", template)
        self.assertIn("'El Extremo Sur':'Comodoro Rivadavia'", template)
        self.assertIn("'NoticiasdelBolson':'El Bolsón'", template)
        self.assertIn("'A24.com':'Cobertura nacional'", template)
        self.assertIn("'Revista Quórum':'Cobertura nacional'", template)
        self.assertIn("'El Periscopio':'Cobertura provincial (Misiones)'", template)
        self.assertIn("localidad.startsWith('Entre Ríos')) return 'Resto del país'", template)
        self.assertIn("Chubut Hoy|ABC Diario|La Tecla Patagonia|El Extremo Sur|NoticiasdelBolson", template)

    def test_api_social_no_expone_token_en_url(self):
        api = (ROOT / "api/redes.js").read_text(encoding="utf-8")
        self.assertIn("Authorization: 'Bearer ' + token", api)
        self.assertNotIn("access_token=${t}", api)
        self.assertNotIn("access_token=${process.env.META_TOKEN}", api)
        self.assertIn("process.env.YT_CANAL_ID", api)
        self.assertIn("const tareas = { Facebook: facebook, Instagram: instagram, YouTube: youtube }", api)
        self.assertIn("Falta configurar YT_KEY", api)
        self.assertIn("Falta configurar YT_CANAL_ID", api)
        self.assertIn("No se encontró el canal indicado por YT_CANAL_ID", api)

    def test_no_hay_credenciales_en_el_html_publico(self):
        public = (ROOT / "publico/index.html").read_text(encoding="utf-8")
        self.assertNotRegex(public, r"-----BEGIN PRIVATE KEY-----\s+[A-Za-z0-9+/=]{40,}")
        self.assertNotIn("META_TOKEN=", public)
        self.assertNotIn("GOOGLE_SERVICE_ACCOUNT_JSON=", public)


    def test_fecha_de_relevamiento_solo_cambia_en_ejecuciones_de_relevamiento(self):
        workflow = (ROOT / ".github/workflows/actualizar.yml").read_text(encoding="utf-8")
        self.assertIn("name: Registrar fecha del relevamiento", workflow)
        self.assertIn("if: github.event_name == 'schedule'", workflow)
        guardar = workflow.split("      - name: Guardar", 1)[1]
        self.assertNotIn('date -u +"%Y-%m-%dT%H:%M:%SZ" > data/actualizado.txt', guardar)


if __name__ == "__main__":
    unittest.main()
