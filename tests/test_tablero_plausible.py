"""Resumen con el esquema de Plausible: solo orden y presentación (mecanismo, sin cantidades reales)."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLANTILLA = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
VISTA = (ROOT / "publico/tablero-plausible.js").read_text(encoding="utf-8")
ESTILO = (ROOT / "publico/tablero-plausible.css").read_text(encoding="utf-8")


class PlausibleTest(unittest.TestCase):
    def test_cinco_secciones_y_enlaces_viejos(self):
        nav = PLANTILLA[PLANTILLA.index('<nav class="tabs"'):PLANTILLA.index('</nav>')]
        self.assertEqual(re.findall(r'data-page="([a-z]+)"', nav), ["resumen", "medios", "notas", "redes", "google"])
        self.assertIn("const ALIAS_SECCION = { visitas: 'google', guia: 'resumen' };", PLANTILLA)
        self.assertNotIn('id="ir-completo"', PLANTILLA)

    def test_periodos_en_chips_y_desplegables_actuales(self):
        for k in ("mes", "pasado", "tres", "todo", "personalizado"):
            self.assertIn(f'data-periodo="{k}"', PLANTILLA)
        self.assertIn('<select id="fdesde">', PLANTILLA)
        self.assertIn("T.setRango(d, h);", VISTA)

    def test_cifras_sin_filtro_salen_de_calc(self):
        self.assertIn("act.publicaciones = c.publicacionesDetectadas; act.medios = c.mediosDetectados;", VISTA)
        self.assertIn("if (typeof window.__tableroRender === 'function') window.__tableroRender();", PLANTILLA)

    def test_faltante_nunca_es_cero_y_variacion_solo_con_dos_datos(self):
        self.assertIn("const fmt = n => typeof n === 'number' ? n.toLocaleString('es-AR') : '—';", VISTA)
        self.assertIn("if (typeof a !== 'number' || typeof b !== 'number' || b === 0) return null;", VISTA)
        self.assertIn("return previo[0] < primerDato ? null : previo;", VISTA)

    def test_por_verificar_es_aviso_y_no_fila(self):
        self.assertIn("de medios con la ciudad sin confirmar", VISTA)
        self.assertIn("const conSede = act.filas.filter(r => !POR_VERIFICAR(r.localidad));", VISTA)

    def test_filtro_por_clic_con_chip_para_quitar(self):
        self.assertIn("f.addEventListener('click', () => alClic(x));", VISTA)
        self.assertIn("filtro = null; render();", VISTA)

    def test_guia_y_como_leer_en_el_boton_de_ayuda(self):
        self.assertIn('id="pl-cajon"', PLANTILLA)
        self.assertIn("window.__tableroAbrirGuia = abrirGuia;", VISTA)

    def test_panel_en_vivo_arriba_de_los_numeros(self):
        self.assertLess(PLANTILLA.index('id="pl-vivo-host"'), PLANTILLA.index('id="pl-resumen"'))
        self.assertIn("host.append(panel)", VISTA)

    def test_estilo_del_tablero_y_menos_movimiento(self):
        self.assertIn("color-mix(in srgb,var(--accent) 15%,transparent)", ESTILO)
        self.assertIn("@media (prefers-reduced-motion:reduce)", ESTILO)
        self.assertNotRegex(ESTILO, r"background:\s*#(000|111)\b")


if __name__ == "__main__":
    unittest.main()


class EntrarAlTableroTest(unittest.TestCase):
    def test_entrar_arranca_arriba_con_foco_y_atras_vuelve_a_la_portada(self):
        self.assertIn('<h1 id="tablero-titulo" tabindex="-1">', PLANTILLA)
        self.assertIn("history.replaceState({ portada: true, scrollY: window.scrollY, ancla, boton: boton.id }", PLANTILLA)
        # Al volver, el botón queda en el mismo lugar de la pantalla aunque algo de arriba cambie de alto.
        self.assertIn("history.scrollRestoration = 'manual'", PLANTILLA)
        self.assertIn(".getBoundingClientRect().top + window.scrollY - st0.ancla", PLANTILLA)
        self.assertIn("history.pushState({ tablero: true }", PLANTILLA)
        self.assertIn("$('tablero-titulo').focus({ preventScroll: true });", PLANTILLA)
        self.assertIn("window.addEventListener('popstate'", PLANTILLA)
        # Cambiar de pestaña también lleva arriba de todo.
        self.assertIn("show(b.dataset.page); window.scrollTo({ top: 0, behavior: 'instant' });", PLANTILLA)
        # El pushState va antes de show(): si no, show() pisaría la posición guardada de la portada.
        bloque = PLANTILLA[PLANTILLA.index("const entrarAlTablero = boton =>"):]
        self.assertLess(bloque.index("history.pushState"), bloque.index("show('resumen')"))


class ArreglosRevisionTest(unittest.TestCase):
    def test_enlace_directo_a_una_seccion_arranca_arriba(self):
        bloque = PLANTILLA[PLANTILLA.index("if (h && $(hDestino)"):]
        self.assertLess(bloque.index("show(h);"), bloque.index("irArriba();"))

    def test_un_solo_boton_de_infografia_visible(self):
        self.assertIn('<div class="tools" hidden><button class="btn accion" id="info-abrir"', PLANTILLA)

    def test_toque_antes_de_cargar_no_se_pierde(self):
        self.assertIn("window.__tableroHashPedido = pedido", PLANTILLA)
        self.assertIn("pedido === 'filtro' || pedido === 'infografia'", VISTA)

    def test_oracion_de_arriba_sigue_al_filtro(self):
        self.assertIn("const pintarTake = act =>", VISTA)
        self.assertIn("pintarTake(act);", VISTA)
        self.assertIn("pintarTake(null);", VISTA)

    def test_visitas_sin_dato_no_remite_a_la_tarjeta(self):
        bloque = VISTA[VISTA.index("if (metrica === 'visitas') {"):VISTA.index("const dias = diasDelPeriodo();")]
        self.assertIn("typeof visitas.actual === 'number' ?", bloque)

    def test_comparacion_a_la_vista(self):
        self.assertIn("pl-comparacion", VISTA)
        self.assertIn("la misma cantidad de días", VISTA)

    def test_celular_deja_fijas_las_pestanas(self):
        self.assertIn("--pl-barra-oculta", ESTILO)
        self.assertIn("setProperty('--pl-barra-oculta'", VISTA)
        self.assertIn("grid-template-columns:repeat(5,minmax(0,1fr))", ESTILO)

    def test_notas_tiene_pestana_propia_y_tocar_una_nota_abre_su_detalle(self):
        self.assertIn('<button role="tab" id="tab-notas" data-page="notas"', PLANTILLA)
        self.assertIn("drawGuia, detalle,", PLANTILLA)
        self.assertIn("if (x.tipo === 'nota') return abrirNota(x.valor);", VISTA)

    def test_tocar_un_dato_muestra_sus_publicaciones_con_enlaces(self):
        self.assertIn("drawGuia, detalle, abrirEnMedios,", PLANTILLA)
        self.assertIn("if (x.tipo === 'medio') return verReferencias(", VISTA)
        self.assertIn("if (x.tipo === 'ciudad') return verReferencias(", VISTA)
        self.assertIn("if (x.tipo === 'region') return verReferencias(", VISTA)
        self.assertIn("elegirEn('notas', { ftipo: x.valor })", VISTA)
        # Filtrar todo el Resumen queda en el botón «Filtro».
        self.assertIn("abrirModal('Filtrar el tablero', todas, Math.max(0, ...todas.map(x => typeof x.n === 'number' ? x.n : 0)), ponerFiltro);", VISTA)
        self.assertIn("T.show('notas');", VISTA)


class VersionDeArchivosTest(unittest.TestCase):
    def test_el_html_publico_pide_los_archivos_con_su_version(self):
        # Si cambia el código, cambia la versión y el navegador no usa una copia vieja.
        publico = (ROOT / "publico/index.html").read_text(encoding="utf-8")
        self.assertNotIn("__VERSION__", publico)
        self.assertRegex(publico, r"tablero-plausible\.js\?v=[0-9a-f]{10}")
        self.assertRegex(publico, r'panel-vivo\.css\?v=[0-9a-f]{10}')


class ArreglosMenoresTest(unittest.TestCase):
    def test_boton_de_ingreso_tambien_arriba(self):
        self.assertIn('id="entrar-tablero-arriba"', PLANTILLA)
        self.assertIn("['entrar-tablero', 'entrar-tablero-arriba'].forEach(id => $(id).addEventListener('click', e => entrarAlTablero(e.currentTarget)));", PLANTILLA)

    def test_cifra_que_falta_es_un_guion_en_las_tablas_de_redes(self):
        self.assertIn("const sinDatoGuion = v =>", PLANTILLA)
        self.assertIn("[r => sinDatoGuion(r.vi), 'num']", PLANTILLA)

    def test_x_tiene_el_mismo_mensaje_simple_en_todas_las_versiones(self):
        self.assertIn("la API de X pide créditos pagos. Se usan los registros guardados.", PLANTILLA)

    def test_la_lista_de_la_portada_no_repite_el_titulo(self):
        cliente = (ROOT / "publico/panel-vivo.js").read_text(encoding="utf-8")
        self.assertIn("if (!misma) a.append(el('span', 'pv-tit', n.titulo));", cliente)
