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
    def test_relevamiento_automatico_solo_escribe_desde_main(self):
        workflow = (ROOT / ".github/workflows/actualizar.yml").read_text(encoding="utf-8")
        self.assertRegex(workflow, r"(?ms)^  push:\n    # El relevamiento escribe datos y genera el HTML público; solo debe ejecutarse desde main\.\n    branches:\n      - main\n    paths:")
        self.assertIn('group: actualizar-${{ github.ref }}', workflow)

    def test_workflow_reconstruye_publico_despues_del_rebase_y_no_descarta_conflictos(self):
        workflow = (ROOT / ".github/workflows/actualizar.yml").read_text(encoding="utf-8")
        self.assertNotIn("      - 'templates/**'", workflow)
        self.assertNotIn("      - 'scripts/armar_publico.py'", workflow)
        guardar = workflow.split("      - name: Guardar", 1)[1]
        self.assertNotIn("git pull --rebase -X theirs", guardar)
        self.assertIn("git pull --rebase", guardar)
        self.assertIn("python3 scripts/armar_publico.py", guardar)
        self.assertIn("git commit --amend --no-edit", guardar)
        self.assertLess(guardar.index("git pull --rebase"), guardar.index("python3 scripts/armar_publico.py"))

    def test_workflow_reconstruye_el_publico_cuando_cambia_la_plantilla(self):
        workflow_path = ROOT / ".github/workflows/reconstruir-publico.yml"
        self.assertTrue(workflow_path.exists(), "Debe existir un workflow dedicado a regenerar el HTML público")
        workflow = workflow_path.read_text(encoding="utf-8")
        self.assertIn("'templates/tablero.html'", workflow)
        self.assertIn("'scripts/armar_publico.py'", workflow)
        self.assertIn("python3 scripts/armar_publico.py", workflow)
        self.assertIn("python3 -m unittest discover -s tests -v", workflow)

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

    def test_portada_muestra_periodo_y_orden_correcto_de_indicadores(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn('id="portada-periodo"', template)
        self.assertIn('id="portada-notas-repercusion"', template)
        self.assertLess(template.index('id="portada-notas"'), template.index('id="portada-notas-repercusion"'))
        self.assertLess(template.index('id="portada-notas-repercusion"'), template.index('id="portada-repercusion"'))
        self.assertIn("notasConRepercusion:", template)
        self.assertIn("Indicadores del período:", template)

    def test_metricas_de_busqueda_tienen_nombres_claros_y_fuentes_separadas(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("Clics desde Google", template)
        self.assertIn("Veces que apareció en Google", template)
        self.assertIn("Porcentaje de clics", template)
        self.assertIn("Posición promedio", template)
        self.assertIn("Actividad dentro del sitio · fuente: Google Analytics 4", template)
        self.assertIn("Presencia en buscadores · fuente actual: Google Search Console", template)
        self.assertNotIn("clics desde Google", template)
        self.assertNotIn("impresiones en búsquedas", template)

    def test_fuentes_reales_de_trafico_y_ayuda_de_busqueda(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        function = (ROOT / "functions/api/google-metrics.js").read_text(encoding="utf-8")
        self.assertIn('id="g-tabla-fuentes"', template)
        self.assertIn('fill(\'g-tabla-fuentes\', a.fuentes', template)
        self.assertIn('runGA(["sessionSource", "sessionMedium"]', function)
        self.assertIn("fuentes: sourceRows", function)
        self.assertIn('"Asistente de IA"', function)
        self.assertIn('"Red social"', function)
        self.assertIn('"Buscador"', function)
        self.assertIn("50 clics entre 1.000 apariciones = 5 %", template)
        self.assertIn("donde 1 es el primer resultado", template)

    def test_api_x_muestra_error_si_no_hay_token_y_no_finge_integracion_completa(self):
        function = (ROOT / "functions/api/redes.js").read_text(encoding="utf-8")
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("async function x(desde, env)", function)
        self.assertIn("X_BEARER_TOKEN", function)
        self.assertIn("X: x", function)
        self.assertIn("const connected = ['Facebook', 'Instagram', 'YouTube', 'X', 'TikTok']", template)
        self.assertIn("result.limiteAlcanzado", template)
        self.assertIn("Consultando Facebook, Instagram, YouTube, X y TikTok", template)
        self.assertIn("La API de X requiere créditos o acceso habilitado.", function)
        self.assertIn("No disponible: ' + (error || 'la API no devolvió datos')", template)
        self.assertIn('id="redes-historial-actualizado"', template)
        self.assertIn("Última actualización de los datos históricos:", template)
        self.assertIn("No son métricas en vivo.", template)
        self.assertNotIn("redesVivoConsultado", template)
        self.assertIn("addEventListener('click', consultarRedesVivo)", template)
        self.assertNotIn("if (page === 'redes' && !redesVivoConsultado)", template)
        self.assertIn("TikTok", template)
        self.assertIn("WhatsApp", template)

    def test_resumen_no_consolida_metricas_sociales_incompletas(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertNotIn('data-k="posteos"', template)
        self.assertNotIn('data-k="vistas"', template)
        self.assertNotIn('data-k="seguidores"', template)
        self.assertIn('class="big">Pendiente</div>', template)
        self.assertIn("No se publica un total consolidado hasta integrar y validar las fuentes", template)

    def test_redes_pendientes_no_se_presentan_como_cero_actividad(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        canales = read_json("data/canales.json")
        self.assertIn("<option>TikTok</option>", template)
        self.assertIn("<option>WhatsApp</option>", template)
        self.assertIn("TikTok requiere configurar OAuth y autorizar la cuenta institucional", template)
        self.assertIn("WhatsApp sigue pendiente de integración", template)
        self.assertTrue(any(c["red"] == "TikTok" for c in canales))
        self.assertTrue(any(c["red"] == "WhatsApp" for c in canales))
        self.assertTrue(any("pendiente" in c["estado"].lower() for c in canales if c["red"] == "TikTok"))

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

    def test_medios_por_nota_cuenta_medios_unicos(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("const mediosUnicos = [...new Set(ok.map(r => canonMedio(r.medio)))];", template)
        self.assertIn("n_medios: mediosUnicos.length", template)
        self.assertIn("publicación relacionada con enlace registrado", template)
        self.assertIn("Abrir referencia en Google Noticias", template)

    def test_portada_visual_precede_al_tablero_oculto(self):
        public = (ROOT / "publico/index.html").read_text(encoding="utf-8")
        # El título de la pestaña debe reflejar el nombre público vigente.
        self.assertIn('<title>Juschubut Noticias | Tablero de repercusión y comunicación judicial</title>', public)
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

    def test_coincidencias_genericas_de_mujeres_rurales_no_se_cuentan_como_confirmadas(self):
        rep = read_json("data/rep2.json")
        matches = [
            r for r in rep
            if int(r.get("nota_id", 0)) == 14851
            and (r.get("url") or "").startswith("https://news.google.com/rss/articles/")
        ]
        self.assertGreater(len(matches), 0)
        self.assertTrue(all(r.get("confianza") == "Baja" for r in matches))
        actualizador = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")
        self.assertIn("MEDIOS_TEMA_NO_VERIFICADO", actualizador)
        self.assertIn("Google Noticias (coincidencia temática; relación no verificada)", actualizador)

    def test_api_social_no_expone_token_en_url(self):
        api = (ROOT / "api/redes.js").read_text(encoding="utf-8")
        self.assertIn("Authorization: 'Bearer ' + token", api)
        self.assertNotIn("access_token=${t}", api)
        self.assertNotIn("access_token=${process.env.META_TOKEN}", api)
        self.assertIn("process.env.YT_CANAL_ID", api)
        self.assertIn("const tareas = { Facebook: facebook, Instagram: instagram, YouTube: youtube }", api)
        self.assertIn("Falta configurar YT_KEY", api)
        self.assertIn("Falta configurar FB_PAGE_ID", api)
        self.assertIn("Falta configurar IG_USER_ID", api)
        self.assertNotIn("116101835114568", api)
        self.assertNotIn("17841410514175238", api)
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


    def test_ruta_social_pages_usa_variables_del_entorno_y_no_process_env(self):
        route = (ROOT / "functions/api/redes.js").read_text(encoding="utf-8")
        self.assertIn("export async function onRequestGet", route)
        self.assertIn("env.META_TOKEN", route)
        self.assertIn("env.FB_PAGE_ID", route)
        self.assertIn("env.IG_USER_ID", route)
        self.assertIn("env.YT_KEY", route)
        self.assertIn("env.YT_CANAL_ID", route)
        self.assertNotIn("process.env", route)
        self.assertIn("Falta configurar FB_PAGE_ID", route)
        self.assertIn("Falta configurar IG_USER_ID", route)
        self.assertIn("Cache-Control", route)


    def test_publicacion_sin_enlace_no_se_cuenta_como_confirmada(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        rep = read_json("data/rep2.json")
        sin_enlace = [
            r for r in rep
            if r.get("confianza") != "Baja" and not re.match(r"^https?://", r.get("url") or "")
        ]
        self.assertGreater(len(sin_enlace), 0)
        self.assertIn("const esConfirmada = r =>", template)
        self.assertIn("D.repercusion.filter(esConfirmada)", template)
        self.assertIn("const ok = rs.filter(esConfirmada)", template)


    def test_actualizador_tiene_guardas_contra_enlaces_mal_asociados(self):
        actualizador = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")
        # La coincidencia con el cuerpo no alcanza: el titular debe compartir
        # al menos dos términos significativos con el título oficial.
        self.assertIn("coincidencias_titulo < 2", actualizador)
        # Una URL identificada como asociación falsa no debe volver desde el historial.
        self.assertIn("URLS_DESCARTADAS", actualizador)
        self.assertIn("un-delincuente-que-era-buscado-en-buenos-aires-cayo-en-la-patagonia", actualizador)

    def test_url_radio3_no_se_asocia_a_una_nota_distinta(self):
        rep = read_json("data/rep2.json")
        carta = next(r for r in rep if int(r["nota_id"]) == 14509 and r["medio"] == "Radio 3 Cadena Patagonia")
        unrelated = next(r for r in rep if int(r["nota_id"]) == 14674 and r["medio"] == "Radio 3 Cadena Patagonia")
        self.assertEqual(carta["url"], "https://radio3cadenapatagonia.com.ar/el-juez-richeri-y-la-carta-que-le-escribio-a-una-nina-tras-condenar-a-su-abusador/")
        self.assertEqual(unrelated["url"], "")
        self.assertEqual(unrelated["origen"], "Sin dato")


    def test_tablero_interno_no_cuenta_registros_sin_enlace(self):
        internal = (ROOT / "tablero_interno/index.html").read_text(encoding="utf-8")
        self.assertIn("const esConfirmada = r =>", internal)
        self.assertIn("repercusion.filter(esConfirmada)", internal)
        self.assertIn("const ok = rs.filter(esConfirmada)", internal)


if __name__ == "__main__":
    unittest.main()
