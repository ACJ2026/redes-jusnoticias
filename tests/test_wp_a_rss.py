"""WordPress que no responde: se lee por RSS y se usa el texto que trae el RSS (mecanismo, sin red)."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FUENTE = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")


def items_de_feed():
    ns = {}
    codigo = FUENTE[FUENTE.index("def strip(h)"):FUENTE.index("STOP = set")]
    codigo += FUENTE[FUENTE.index("def fecha_iso"):FUENTE.index("def items_de_sitemap")]
    exec("import re, html, unicodedata, datetime as dt\n" + codigo, ns)
    return ns["items_de_feed"]


class WpARssTest(unittest.TestCase):
    def test_el_rss_guarda_el_texto_completo_si_viene(self):
        xml = ("<rss><channel><item><title>Banfi encabezó</title><link>https://m.com/a</link>"
               "<pubDate>Thu, 05 Nov 2026 10:00:00 +0000</pubDate><content:encoded><![CDATA[<p>La ministra del STJ</p>]]></content:encoded></item>"
               "<item><title>Otra</title><link>https://m.com/b</link><pubDate>Thu, 05 Nov 2026 11:00:00 +0000</pubDate></item></channel></rss>")
        a, b = items_de_feed()(xml)
        self.assertEqual(a["c"], "La ministra del STJ")
        self.assertNotIn("c", b)

    def test_wordpress_que_falla_pasa_a_lectura_por_rss(self):
        self.assertIn("if dom_fallido: WP_A_RSS[name] = dom_fallido", FUENTE)
        self.assertLess(FUENTE.index("WP_A_RSS = {}"), FUENTE.index("for _n, _d in WP_A_RSS.items(): NO_WP.setdefault(_n, _d)"))
        self.assertIn("textos.update(del_feed)", FUENTE)
        self.assertIn("f'{base}/feed/?paged={pg}'", FUENTE)


    def test_wordpress_que_falla_seguido_va_directo_al_rss(self):
        ns = {"_estado_previo": {}}
        exec(FUENTE[FUENTE.index("def usar_rss("):FUENTE.index("for _it in [it for it in fuentes_wp")], ns)
        usar = ns["usar_rss"]
        self.assertTrue(usar("M", {"M": {"fallos_seguidos": 116}}))
        self.assertTrue(usar("M", {"M": {"usar_rss": True, "fallos_seguidos": 0}}))
        self.assertFalse(usar("M", {"M": {"fallos_seguidos": 1}}))
        self.assertFalse(usar("M", {}))
        self.assertIn("estado_medios[_n]['usar_rss'] = True", FUENTE)

    def test_la_corrida_baja_la_rama_al_arrancar(self):
        flujo = (ROOT / ".github/workflows/actualizar.yml").read_text(encoding="utf-8")
        self.assertIn("ref: ${{ github.ref }}", flujo)
        self.assertIn("cancel-in-progress: false", flujo)


if __name__ == "__main__":
    unittest.main()
