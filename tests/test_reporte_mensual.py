"""Reporte mensual: usa los cálculos del tablero y no inventa datos (mecanismo)."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTE = (ROOT / "publico/reporte.js").read_text(encoding="utf-8")
PLANTILLA = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")


class ReporteMensualTest(unittest.TestCase):
    def test_el_tablero_tiene_el_boton_y_carga_el_reporte(self):
        self.assertIn('id="pl-reporte-btn"', PLANTILLA)
        self.assertIn("scriptReporte.src = 'reporte.js?v=__VERSION__'", PLANTILLA)
        armar = (ROOT / "scripts/armar_publico.py").read_text(encoding="utf-8")
        self.assertIn('"reporte.js"', armar)

    def test_usa_calc_del_tablero_y_restaura_el_periodo(self):
        self.assertIn("const { D, st, meses, calc, mesLargo, cap, nf, TIPOS } = T;", REPORTE)
        self.assertIn("try { return calc(); } finally { [st.desde, st.hasta] = antes; }", REPORTE)

    def test_un_dato_que_falta_no_es_cero(self):
        self.assertIn("isFinite(n) ? nf.format(n) : '—'", REPORTE)
        self.assertIn("Sin datos todavía: la fecha de publicación de cada medio se registra desde el 13/11/2026.", REPORTE)

    def test_escapa_textos_de_los_datos(self):
        self.assertIn("const esc = s =>", REPORTE)
        self.assertIn("${esc(n.titulo)}", REPORTE)
        self.assertIn("${esc(x.medio)}", REPORTE)


if __name__ == "__main__":
    unittest.main()
