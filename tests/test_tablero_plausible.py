"""Resumen con el esquema de Plausible: solo orden y presentación (mecanismo, sin cantidades reales)."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLANTILLA = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")
VISTA = (ROOT / "publico/tablero-plausible.js").read_text(encoding="utf-8")
ESTILO = (ROOT / "publico/tablero-plausible.css").read_text(encoding="utf-8")


class PlausibleTest(unittest.TestCase):
    def test_cuatro_secciones_y_enlaces_viejos(self):
        nav = PLANTILLA[PLANTILLA.index('<nav class="tabs"'):PLANTILLA.index('</nav>')]
        self.assertEqual(re.findall(r'data-page="([a-z]+)"', nav), ["resumen", "medios", "redes", "google"])
        self.assertIn("const ALIAS_SECCION = { notas: 'medios', visitas: 'google', guia: 'resumen' };", PLANTILLA)
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
        self.assertIn("con sede del medio por verificar", VISTA)
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
        self.assertIn("history.replaceState({ portada: true, scrollY: window.scrollY }", PLANTILLA)
        self.assertIn("history.pushState({ tablero: true }", PLANTILLA)
        self.assertIn("$('tablero-titulo').focus({ preventScroll: true });", PLANTILLA)
        self.assertIn("window.addEventListener('popstate'", PLANTILLA)
        # Cambiar de pestaña también lleva arriba de todo.
        self.assertIn("show(b.dataset.page); window.scrollTo({ top: 0, behavior: 'instant' });", PLANTILLA)
        # El pushState va antes de show(): si no, show() pisaría la posición guardada de la portada.
        bloque = PLANTILLA[PLANTILLA.index("$('entrar-tablero').addEventListener"):]
        self.assertLess(bloque.index("history.pushState"), bloque.index("show('resumen')"))
