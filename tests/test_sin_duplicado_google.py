"""Un mismo medio no cuenta dos veces la misma nota (decisión de Ignacio, 30/10/2026). Mecanismo, sin datos reales."""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLANTILLA = (ROOT / "templates/tablero.html").read_text(encoding="utf-8")


def correr(filas):
    # Se ejecuta el mismo código de la plantilla con lo mínimo que necesita alrededor.
    ini = PLANTILLA.index("  const normalizarUrlRevision = value => {")
    fin = PLANTILLA.index("  // El historial se carga en segundo plano")
    normalizar = PLANTILLA[ini:fin]
    ini = PLANTILLA.index("  const claveNombre = t =>")
    fin = PLANTILLA.index("  quitarDuplicados(D.repercusion);")
    bloque = PLANTILLA[ini:fin]
    codigo = (
        "const canonMedio = m => String(m || '');\n"
        "const esReferenciaGoogle = r => /news\\.google\\.com/i.test(String(r.url || ''));\n"
        "const confirmadaManual = r => (r.revision_manual || {}).decision === 'confirmar';\n"
        + normalizar + bloque +
        f"const lista = {json.dumps(filas)};\nquitarDuplicados(lista);\nconsole.log(JSON.stringify(lista.map(r => r.url)));"
    )
    salida = subprocess.run(["node", "-e", codigo], capture_output=True, text=True, check=True)
    return json.loads(salida.stdout)


def fila(medio, url, nota=1, **k):
    return {"nota_id": nota, "medio": medio, "url": url, "confianza": "Alta", **k}


class SinDuplicadoTest(unittest.TestCase):
    def test_google_y_sitio_del_mismo_medio_queda_el_sitio(self):
        r = correr([fila("Diario Uno", "https://news.google.com/rss/articles/abc"), fila("Diario Uno", "https://www.diariouno.com/nota-1")])
        self.assertEqual(r, ["https://www.diariouno.com/nota-1"])

    def test_solo_google_se_deja(self):
        r = correr([fila("Diario Uno", "https://news.google.com/rss/articles/abc")])
        self.assertEqual(r, ["https://news.google.com/rss/articles/abc"])

    def test_google_con_el_dominio_como_nombre(self):
        r = correr([fila("diariouno.com", "https://news.google.com/rss/articles/abc"), fila("Diario Uno", "https://diariouno.com/nota-1")])
        self.assertEqual(r, ["https://diariouno.com/nota-1"])

    def test_misma_direccion_con_y_sin_www_cuenta_una_vez(self):
        r = correr([fila("Diario Uno", "https://www.diariouno.com/nota-1"), fila("Diario Uno", "https://diariouno.com/nota-1/")])
        self.assertEqual(len(r), 1)

    def test_otro_medio_u_otra_nota_no_se_tocan(self):
        filas = [fila("Diario Uno", "https://news.google.com/rss/articles/abc"), fila("Radio Dos", "https://radiodos.com/x"),
                 fila("Diario Uno", "https://diariouno.com/otra", nota=2)]
        self.assertEqual(len(correr(filas)), 3)

    def test_dos_notas_distintas_del_mismo_medio_se_conservan(self):
        r = correr([fila("Diario Uno", "https://diariouno.com/a"), fila("Diario Uno", "https://diariouno.com/b")])
        self.assertEqual(len(r), 2)

    def test_confirmar_aplica_a_la_fila_del_mismo_medio_y_no_suma_otra(self):
        self.assertIn("mismaDelMedio = Boolean(fila);", PLANTILLA)
        self.assertIn("if (!mismaDelMedio) fila.url = rev.url;", PLANTILLA)
        self.assertIn("quitarDuplicados(D.repercusion); updateLanding(calc()); draw();", PLANTILLA)


if __name__ == "__main__":
    unittest.main()
