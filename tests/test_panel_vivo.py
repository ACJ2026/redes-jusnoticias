"""Panel en vivo de la portada: mecanismo, sin cantidades de los datos reales."""
import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FUNCION = (ROOT / "functions/api/panel-vivo.js").read_text(encoding="utf-8")
CLIENTE = (ROOT / "publico/panel-vivo.js").read_text(encoding="utf-8")
ESTILO = (ROOT / "publico/panel-vivo.css").read_text(encoding="utf-8")
PLANTILLA = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")


def resumir(datos):
    codigo = (
        "const m = await import(process.argv[1]);"
        "const d = JSON.parse(process.argv[2]);"
        "console.log(JSON.stringify(m.resumir(d, '2026-10-22')));"
    )
    salida = subprocess.run(
        ["node", "--input-type=module", "-e", codigo, (ROOT / "functions/api/panel-vivo.js").as_uri(), json.dumps(datos)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(salida.stdout)


class PanelVivoServidorTest(unittest.TestCase):
    def test_red_que_falla_no_se_convierte_en_cero(self):
        r = resumir({"redes": {}, "errores": {"Facebook": "token vencido", "Instagram": "token vencido"}})
        ig = next(c for c in r["cuentas"] if c["red"] == "Instagram")
        self.assertFalse(ig["ok"])
        self.assertNotIn("interacciones", ig)
        x = next(c for c in r["cuentas"] if c["red"] == "X")
        self.assertFalse(x["ok"])

    def test_publicaciones_sin_metricas_dan_sin_dato(self):
        datos = {"actualizado": "2026-10-28T12:00:00Z", "redes": {
            "Facebook": {"paginas": [{"id": "1", "nombre": "JusNoticias", "seguidores": 10, "publicacionesError": "sin permiso"}], "filas": []},
            "Instagram": {"seguidores": 5, "filas": [{"red": "Instagram", "fecha": "2026-10-27", "me_gusta": None, "comentarios": None}], "insights": {"reach": None}},
        }, "errores": {}}
        r = resumir(datos)
        fb = next(c for c in r["cuentas"] if c["red"] == "Facebook")
        self.assertIsNone(fb["publicaciones"])
        self.assertIsNone(fb["interacciones"])
        ig = next(c for c in r["cuentas"] if c["red"] == "Instagram")
        self.assertIsNone(ig["interacciones"])
        self.assertIsNone(ig["alcance"])
        self.assertIsNone(r["publicaciones"][0]["interacciones"])

    def test_alcance_de_instagram_es_de_la_cuenta(self):
        datos = {"redes": {"Instagram": {"seguidores": 5, "filas": [], "insights": {"reach": 1234}, "insightsDesde": "2026-09-30", "insightsHasta": "2026-10-28"}}, "errores": {}}
        ig = next(c for c in resumir(datos)["cuentas"] if c["red"] == "Instagram")
        self.assertEqual(ig["alcance"], 1234)
        self.assertEqual(ig["alcanceDesde"], "2026-09-30")

    def test_interacciones_solo_de_los_ultimos_7_dias(self):
        datos = {"redes": {"YouTube": {"seguidores": 1, "filas": [
            {"red": "YouTube", "fecha": "2026-10-01", "vistas": 50},
            {"red": "YouTube", "fecha": "2026-10-25", "vistas": 7}]}}, "errores": {}}
        yt = next(c for c in resumir(datos)["cuentas"] if c["red"] == "YouTube")
        self.assertEqual(yt["publicaciones"], 1)
        self.assertEqual(yt["vistas"], 7)

    def test_cache_compartida_y_sin_escribir_datos(self):
        self.assertIn("CACHE_SEGUNDOS = 300", FUNCION)
        self.assertIn("env.PANEL_KV", FUNCION)
        self.assertIn("caches.default", FUNCION)
        self.assertNotIn("redes2.json\"", FUNCION.replace("data/redes2.json ni", ""))
        self.assertNotRegex(FUNCION, r"writeFile|fs\.")
        # X no se consulta: su API pide créditos.
        self.assertIn('const REDES = ["Facebook", "Instagram", "YouTube", "TikTok"]', FUNCION)


class PanelVivoClienteTest(unittest.TestCase):
    def test_portada_carga_el_panel_sin_un_segundo_script_en_el_html(self):
        self.assertIn('id="panel-vivo"', PLANTILLA)
        self.assertIn('href="panel-vivo.css"', PLANTILLA)
        self.assertIn("window.__panelVivo = { D, esConfirmada, canonMedio, localidadDe, regionMedio }", PLANTILLA)
        self.assertIn("scriptPanel.src = 'panel-vivo.js'", PLANTILLA)
        publico = (ROOT / "publico/index.html").read_text(encoding="utf-8")
        scripts = re.findall(r'<script(?![^>]*application/json)[^>]*>([\s\S]*?)</script>', publico)
        self.assertEqual(len(scripts), 1)

    def test_falla_de_red_muestra_sin_dato_y_ultimo_dato(self):
        self.assertIn("'sin dato en vivo · último dato: '", CLIENTE)
        self.assertIn("const fmt = n => typeof n === 'number' ? n.toLocaleString('es-AR') : '—';", CLIENTE)

    def test_interaccion_es_solo_ayuda_visual_y_no_usa_la_confianza(self):
        self.assertIn("'Interacción ' + n", CLIENTE)
        self.assertNotIn("confianza", CLIENTE.replace("r.confianza !== 'Baja'", ""))

    def test_respeta_menos_movimiento(self):
        self.assertIn("prefers-reduced-motion: reduce", CLIENTE)
        self.assertIn("@media (prefers-reduced-motion:reduce)", ESTILO)

    def test_no_fija_un_fondo_negro(self):
        self.assertNotRegex(ESTILO, r"background:\s*#(000|111|0b0b0b)\b")


if __name__ == "__main__":
    unittest.main()
