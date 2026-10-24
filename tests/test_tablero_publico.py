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
        # Los cambios de datos regeneran el HTML, pero no lanzan otro relevamiento.
        for path in (
            "data/notas2.json",
            "data/rep2.json",
            "data/redes2.json",
            "data/canales.json",
            "data/medios.json",
            "data/medios_inventario.json",
            "data/cuentas_monitoreo.json",
            "data/actualizado.txt",
        ):
            self.assertIn(f"'{path}'", workflow)

    def test_relevamiento_no_se_dispara_por_sus_propios_datos_generados(self):
        workflow = (ROOT / ".github/workflows/actualizar.yml").read_text(encoding="utf-8")
        rutas = workflow.split("    paths:", 1)[1].split("  schedule:", 1)[0]
        self.assertIn("'scripts/actualizar.py'", rutas)
        self.assertIn("'data/fuentes_descubiertas.json'", rutas)
        for path in (
            "'scripts/armar_publico.py'",
            "'templates/tablero.html'",
            "'data/notas2.json'",
            "'data/rep2.json'",
            "'data/medios.json'",
            "'data/medios_inventario.json'",
            "'data/actualizado.txt'",
        ):
            self.assertNotIn(path, rutas)

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
        data["cuentas"] = read_json("data/cuentas_monitoreo.json")["cuentas"]
        data["localidades"] = {n: m["localidad"] for m in read_json("data/medios_inventario.json")["medios"]
                               if m.get("localidad") and m["localidad"] != "Por verificar" for n in [m["nombre"]] + m.get("alias", [])}
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

    def test_referencias_de_google_news_no_cuentan_como_publicaciones_confirmadas(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("const esReferenciaGoogle = r => /news\\.google\\.com/i.test(String(r.url || ''));", template)
        self.assertIn("&& !esReferenciaGoogle(r) &&", template)
        self.assertIn("Abrir referencia en Google Noticias", template)

    def test_tablero_aclara_que_google_news_no_es_un_enlace_directo(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("Las referencias de Google Noticias son pistas de búsqueda, no enlaces directos al medio", template)

    def test_enlaces_directos_verificados_quedan_asociados_a_sus_registros(self):
        # Se busca por nota y medio: la clave «pN» se renumera en cada relevamiento.
        registros = read_json("data/rep2.json")
        esperados = {
            (14471, "El Chubut"): "https://www.elchubut.com.ar/trelew/2026-9-11-10-37-0-convocan-en-trelew-a-familias-monoparentales-para-adoptar-a-una-adolescente",
            (14545, "El Chubut"): "https://www.elchubut.com.ar/policiales/2026-9-21-20-32-0-comodoro-condena-contra-peugeot-y-concesionaria-por-vuelco-de-auto-provocado-por-falla-de-fabrica",
            (14520, "Diario Jornada"): "https://diariojornada.com.ar/423711/policiales/declaran_culpable_a_agustin_vera_por_el_crimen_de_matias_nieves",
            (14717, "Diario Jornada"): "https://diariojornada.com.ar/424771/policiales/la_justicia_garantizo_la_cobertura_integral_para_un_nino_con_autismo",
        }
        for (nota, medio), url in esperados.items():
            with self.subTest(nota=nota, medio=medio):
                urls = [r.get("url") for r in registros if r.get("nota_id") == nota and r.get("medio") == medio]
                self.assertIn(url, urls)
                self.assertTrue(url.startswith("https://"))

    def test_enlace_directo_el_patagonico_peugeot(self):
        registros = read_json("data/rep2.json")
        fila = next(r for r in registros if r.get("url") == "https://www.elpatagonico.com/comodoro-condena-contra-peugeot-y-una-concesionaria-n6324799")
        self.assertEqual((fila["nota_id"], fila["medio"]), (14545, "El Patagónico"))
        self.assertEqual(fila["cita_fuente_oficial"], "Sí")

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
        self.assertNotIn('id="redes-historial-actualizado"', template)
        self.assertNotIn("Última actualización de los datos históricos:", template)
        self.assertIn("no se suman plataformas sin datos", template)
        self.assertIn("Última actualización del relevamiento:", template)
        self.assertIn("las métricas de redes y Google se consultan por separado", template)
        self.assertIn('<footer class="wrap" aria-label="Actualización y fuentes">', template)
        self.assertNotIn('id="actualizado-badge"', template)
        self.assertNotIn('id="portada-actualizado"', template)
        self.assertIn('id="resumen-explorar"', template)
        self.assertIn("<summary>Explorar temas y rankings</summary>", template)
        self.assertIn("<summary>Metodología, límites y detalles técnicos</summary>", template)
        self.assertIn("<summary>Inventario de medios y enlaces de referencia</summary>", template)
        self.assertIn('id="b-tipo"', template)
        self.assertIn('id="b-top5m"', template)
        self.assertIn('id="t-medios"', template)
        self.assertIn(">Guía y metodología</button>", template)
        self.assertNotIn("redesVivoConsultado", template)
        self.assertIn("addEventListener('click', consultarRedesVivo)", template)
        self.assertNotIn("if (page === 'redes' && !redesVivoConsultado)", template)
        self.assertIn("TikTok", template)
        self.assertIn("WhatsApp", template)

    def test_resumen_muestra_metricas_sociales_con_su_cobertura(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        for k in ("posteos", "vistas", "seguidores"):
            self.assertIn(f'data-k="{k}"', template)
            self.assertIn(f'data-n="{k}"', template)
        self.assertNotIn('class="big">Pendiente</div>', template)
        # Cada total aclara de qué redes sale y cuáles no tienen dato.
        self.assertIn("Solo informan vistas: ", template)
        self.assertIn("Sin dato todavía: ", template)
        self.assertIn("!/no computar|referencia institucional/i.test(c.estado)", template)

    def test_redes_pendientes_no_se_presentan_como_cero_actividad(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        canales = read_json("data/canales.json")
        self.assertIn("<option>TikTok</option>", template)
        self.assertIn("<option>WhatsApp</option>", template)
        self.assertIn("TikTok está conectado con la cuenta institucional @juschubut", template)
        self.assertIn("WhatsApp sigue pendiente de integración", template)
        self.assertTrue(any(c["red"] == "TikTok" for c in canales))
        self.assertTrue(any(c["red"] == "WhatsApp" for c in canales))
        self.assertTrue(any(isinstance(c["seguidores"], int) and c["estado"].startswith("Activa") for c in canales if c["red"] == "TikTok"))

    def test_panel_en_vivo_suma_metricas_por_publicacion_sin_insights_de_cuenta(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("' de la ventana)'", template)
        self.assertIn("['vistas', 'Vistas'], ['me_gusta', 'Me gusta']", template)

    def test_pagina_se_adapta_al_ancho_del_celular(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        # Sin esta etiqueta el celular dibuja la página a ancho de escritorio y se ve diminuta.
        self.assertTrue(template.startswith('<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1'))

    def test_rankings_del_resumen_abren_sus_enlaces(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("[...$('b-top5m').querySelectorAll('.bar-row')].forEach", template)
        self.assertIn("[...$('b-top5n').querySelectorAll('.bar-row')].forEach", template)
        self.assertIn("show('medios');", template)

    def test_resumen_muestra_distribucion_territorial_por_sede_del_medio(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn('id="c-territorio"', template)
        self.assertIn('id="b-territorio-region"', template)
        self.assertIn("No indica dónde viven los lectores", template)
        # Usa solo publicaciones confirmadas (repOk excluye confianza baja) y enlaces únicos.
        self.assertIn("const rs = [...new Map(repOk.filter(r => en(r.mes)).map(r => [r.url, r])).values()];", template)
        self.assertIn("    drawTerritorio();", template)
        # Los controles retirados en el PR #32 no vuelven.
        self.assertNotIn("f-territorio-tipo", template)

    def test_tablas_de_paginas_enlazan_cada_pagina(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("{ value: r => r.titulo || r.ruta, link: r => r.ruta }", template)
        self.assertIn("{ value: r => r.pagina, link: r => r.pagina }", template)
        self.assertIn("new URL(String(v), 'https://jusnoticias.juschubut.gov.ar')", template)

    def test_ciudades_de_la_tarjeta_territorial_abren_los_medios(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("[...$('b-territorio').querySelectorAll('.bar-row')].forEach", template)
        self.assertIn("rs.filter(r => x.medios.has(r.medio))", template)

    def test_seccion_compartidos_enlaza_cuenta_publicacion_y_nota(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        funcion = (ROOT / "functions/api/compartidos.js").read_text(encoding="utf-8")
        self.assertIn('id="t-compartidos"', template)
        self.assertIn("celdaEnlace(f.cuenta, f.cuenta_url)", template)
        self.assertIn("const idNotaPorTitulo = new Map(notas.map(n => [String(n.titulo || '').trim().toLocaleLowerCase(), Number(n.id)]));", template)
        self.assertIn("const resolverNotaId = f => Number(f.nota_id) || idNotaPorTitulo.get(String(f.nota_titulo || f.nota_compartida || '').trim().toLocaleLowerCase()) || null;", template)
        self.assertIn("Nota original pendiente de identificar", template)
        self.assertIn("notaId ? notaUrl(notaId) : null", template)
        self.assertIn('id="compartidos-busqueda-manual"', template)
        self.assertIn("dibujarBusquedasManuales(data.desde)", template)
        self.assertIn("facebook.com/search/posts/?q=", template)
        self.assertIn("tiktok.com/search?q=", template)
        self.assertIn("Falta YT_CANAL_ID para excluir los videos del canal institucional.", funcion)
        self.assertIn("título de la nota identificado", funcion)
        self.assertIn("business_discovery", funcion)
        self.assertIn('import cuentasMonitoreo from "../../data/cuentas_monitoreo.json";', funcion)
        self.assertIn("const enlacePosteo = r =>", template)
        self.assertIn("Ver publicación directa", template)
        self.assertIn("Buscar publicación (pendiente de verificar)", template)
        self.assertIn("const redesIncluidas = new Set(['Facebook', 'Instagram', 'YouTube', 'TikTok']);", template)
        self.assertIn("celdaPublicacionCompartida(f)", template)
        self.assertIn('<th>Nota en sitio del medio</th>', template)
        self.assertIn("const enlaceNotaSitioMedio = f =>", template)
        self.assertIn("Ver nota en sitio del medio", template)
        self.assertIn("Buscar nota del medio (pendiente de verificar)", template)
        self.assertIn("if (f.url_sitio && /^https?:\\/\\//i.test(f.url_sitio))", template)
        self.assertIn("!/news\\.google\\.com/i.test(p.url)", template)
        self.assertIn("Solo la URL directa identifica la publicación concreta.", template)
        self.assertIn("Abre una búsqueda; todavía no es el enlace directo al post.", template)
        self.assertNotIn("D.repercusion.filter(p => Number(p.nota_id) === Number(r.nota_id)", template)
        self.assertNotIn("Ver nota original en JusNoticias ↗", template)
        self.assertNotIn("Consultar fuente de esta cifra", template)
        self.assertIn("Buscar ahora</button>", template)
        self.assertIn("addEventListener('click', buscarCompartidos)", template)
        self.assertIn("Facebook y TikTok se ofrece una búsqueda asistida marcada como pendiente de verificar.", template)

    def test_generador_de_infografias_usa_los_datos_del_tablero(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn('id="info-abrir"', template)
        self.assertIn('id="info-lienzo"', template)
        self.assertIn("const INFO_FORMATOS = { ig: [1080, 1350], story: [1080, 1920], x: [1600, 900] };", template)
        # Mismos cálculos que el resumen: calc() y datosTerritorio().
        self.assertIn("const c = calc(), t = datosTerritorio();", template)
        # Pregunta antes de generar: tema, período o nota, datos, formato y título.
        for paso in ("1. ¿Sobre qué querés la infografía?", "2. ¿De qué período?", "2. ¿Qué nota?", "3. ¿Qué datos incluir?", "4. ¿En qué formato?", "5. Título (opcional)"):
            self.assertIn(paso, template)
        self.assertIn('id="info-generar"', template)
        self.assertIn("no demuestra por sí sola que se haya usado nuestra información", template)

    def test_botones_de_accion_se_destacan(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn(".btn.accion{background:var(--accent)", template)
        for boton in ("info-abrir", "info-generar", "info-descargar", "redes-vivo-consultar", "compartidos-buscar", "g-actualizar"):
            self.assertIn(f'class="btn accion" id="{boton}"', template)

    def test_inventario_unico_de_medios(self):
        inventario = read_json("data/medios_inventario.json")["medios"]
        medios = {m["medio"] for m in read_json("data/medios.json")}
        nombres = {m["nombre"] for m in inventario} | {a for m in inventario for a in m.get("alias", [])}
        # Todo medio del resumen está en el inventario (como nombre principal o alias).
        self.assertTrue(medios <= nombres, medios - nombres)
        for m in inventario:
            for campo in ("nombre", "dominio", "tipo", "localidad", "metodo", "estado", "publicaciones", "notas", "redes"):
                self.assertIn(campo, m)
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("const localidadDe = medio => (D.localidades || {})[medio] || localidadMedio[medio];", template)
        self.assertNotIn("localidadMedio[r.medio]", template)

    def test_panel_en_vivo_separa_las_paginas_de_facebook(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("const filaPaginaFacebook = (p, result) =>", template)
        self.assertIn("'Facebook · ' + nombre", template)
        self.assertIn("result.paginas.map(p => filaPaginaFacebook(p, result))", template)

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
        # El número principal suma medios verificados y a verificar, cada medio una sola vez.
        self.assertIn("const mediosTodos = [...new Set(rs.map(r => canonMedio(r.medio)))];", template)
        self.assertIn("n_medios: mediosTodos.length, n_verificados: mediosUnicos.length", template)
        self.assertIn("posibles: mediosTodos.length - mediosUnicos.length", template)
        self.assertIn("salió en otros medios", template)
        self.assertIn("Abrir referencia en Google Noticias", template)

    def test_estados_del_tablero_son_claros_y_cuentan_pendientes(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn('data-k="publicacionesDetectadas"', template)
        self.assertIn('data-k="mediosDetectados"', template)
        self.assertIn("publicacionesVerificadas", template)
        self.assertIn("publicacionesPorVerificar", template)
        self.assertIn('id="ayuda-dialog"', template)
        self.assertIn("p.textContent = confirmada ? 'Verificada' : 'A verificar'", template)
        self.assertIn("p.textContent = confirmada ? 'Verificada' : 'A verificar'", template)
        self.assertNotIn("p.textContent = confirmada ? 'Encontrada' : 'A revisar'", template)

    def test_ayuda_breve_en_cada_seccion_del_tablero(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        # Cada sección tiene su botón destacado con su propia explicación; no hay botón genérico arriba.
        self.assertNotIn('id="ayuda-abrir"', template)
        for seccion in ("resumen", "medios", "notas", "redes", "google"):
            with self.subTest(seccion=seccion):
                inicio = template.index(f'<section class="page" id="{seccion}"')
                boton = template.index(f'class="btn accion ayuda-sec" type="button" data-ayuda="{seccion}"', inicio)
                siguiente = template.find('<section class="page" id="', inicio + 1)
                self.assertTrue(siguiente == -1 or boton < siguiente)
                self.assertIn(f'<template id="ayuda-{seccion}" data-titulo=', template)
        self.assertIn("$('ayuda-cuerpo').replaceChildren(t.content.cloneNode(true));", template)
        inicio = template.index('<section class="page" id="guia"')
        self.assertLess(template.index('<details class="ayuda-seccion">', inicio), template.index('</section>', inicio))
        self.assertIn("Verificada", template)
        self.assertIn("A verificar", template)
        self.assertIn("@media(max-width:600px)", template)

    def test_tabla_notas_tiene_ayuda_en_boton_y_diseno_movil(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn('id="notas-ayuda-abrir"', template)
        self.assertIn("#t-notas tbody tr{display:grid", template)
        self.assertIn("td.setAttribute('data-label', labels[i])", template)
        self.assertNotIn("Las referencias de Google Noticias son pistas de búsqueda, no enlaces directos al medio;", template)

    def test_portada_visual_precede_al_tablero_oculto(self):
        public = (ROOT / "publico/index.html").read_text(encoding="utf-8")
        # El título de la pestaña debe reflejar el nombre público vigente.
        self.assertIn('<title>Juschubut Noticias | Tablero de repercusión y comunicación judicial</title>', public)
        self.assertIn('id="portada"', public)
        self.assertIn('id="entrar-tablero"', public)
        self.assertIn('id="dashboard-app" hidden', public)
        # La plantilla mantiene un único sello al pie, compartido por portada y tablero.
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("Última actualización del relevamiento:", template)
        self.assertIn('id="pie"', template)
        self.assertNotIn('id="actualizado-badge"', template)
        self.assertNotIn('id="portada-actualizado"', template)
        self.assertNotIn('id="redes-historial-actualizado"', template)
        self.assertNotIn("Tablero generado:", template)
        self.assertLess(public.index('id="portada"'), public.index('id="dashboard-app" hidden'))

    def test_youtube_cuenta_el_unico_canal_institucional(self):
        # El canal Poder Judicial del Chubut es el único canal de YouTube: sus videos son propios.
        redes = read_json("data/redes2.json")
        youtube = [r for r in redes if r.get("red") == "YouTube"]
        self.assertTrue(youtube)
        self.assertTrue(all(r.get("propia") == "Sí" and r.get("cuenta") == "Poder Judicial del Chubut" for r in youtube))
        canales = read_json("data/canales.json")
        yt = [c for c in canales if c.get("red") == "YouTube"]
        self.assertEqual(len(yt), 1)
        self.assertIsInstance(yt[0]["seguidores"], int)
        self.assertTrue(yt[0]["estado"].startswith("Activa"))

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


    def test_todas_las_tablas_tienen_adaptacion_movil_y_etiquetas(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("#dashboard-app .tbox table:not(#t-notas)", template)
        self.assertIn("const etiquetarCeldas =", template)
        self.assertIn("new MutationObserver", template)
        self.assertIn("data-label", template)
        # La tabla de notas ya tiene su diseño de fichas específico.
        self.assertIn("#t-notas tbody tr{display:grid", template)

    def test_textos_simples_y_pie_no_se_superpone(self):
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn('data-k="n_medios">Medios</button>', template)
        self.assertNotIn("Medios distintos", template)
        self.assertIn("footer.wrap{display:block;position:relative;clear:both;flex:none;", template)
        self.assertIn(".foot{position:relative;isolation:isolate;box-sizing:border-box;width:100%;", template)
        self.assertIn("overflow-wrap:anywhere", template)

    def test_tablero_interno_no_cuenta_registros_sin_enlace(self):
        internal = (ROOT / "tablero_interno/index.html").read_text(encoding="utf-8")
        self.assertIn("const esConfirmada = r =>", internal)
        self.assertIn("repercusion.filter(esConfirmada)", internal)
        self.assertIn("const ok = rs.filter(esConfirmada)", internal)


    def test_revision_manual_segura_y_bitacora_persistente(self):
        api = (ROOT / "functions/api/revisiones.js").read_text(encoding="utf-8")
        migration = (ROOT / "migrations/0002_revisiones_publicaciones.sql").read_text(encoding="utf-8")
        template = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
        self.assertIn("REVISIONES_DB", api)
        self.assertIn("REVISIONES_CLAVE", api)
        self.assertIn("sameOrigin(request)", api)
        self.assertIn("bitacora_revisiones_publicacion", api)
        self.assertIn("source_url TEXT NOT NULL", migration)
        self.assertIn("CREATE TABLE IF NOT EXISTS bitacora_revisiones_publicacion", migration)
        self.assertIn("Confirmar publicación", template)
        self.assertIn("Descartar coincidencia", template)
        self.assertIn("pendientes de decisión", template)
        self.assertIn("!/^A verificar:/i.test(r.metodo || '')", template)
        self.assertIn("r.confianza !== 'Baja'", template)

if __name__ == "__main__":
    unittest.main()
