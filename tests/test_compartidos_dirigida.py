"""Búsqueda dirigida de Instagram: revisa primero las cuentas de los medios que ya publicaron la nota (mecanismo)."""
import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FUNCION = ROOT / "functions/api/compartidos.js"


def js(expr):
    # Los JSON de data/ se importan con «type: json», como los arma Cloudflare.
    fuente = re.sub(r'from "\.\./\.\./data/(\w+\.json)";',
                    lambda m: 'from "' + (ROOT / "data" / m.group(1)).as_uri() + '" with { type: "json" };',
                    FUNCION.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as d:
        archivo = Path(d) / "compartidos.mjs"
        archivo.write_text(fuente, encoding="utf-8")
        codigo = "const m = await import(process.argv[1]); console.log(JSON.stringify(" + expr + "));"
        salida = subprocess.run(["node", "--input-type=module", "-e", codigo, archivo.as_uri()], capture_output=True, text=True, check=True)
    return json.loads(salida.stdout)


NOTAS = [{"id": 1, "fecha": "2026-10-28"}, {"id": 2, "fecha": "2026-10-25"}, {"id": 3, "fecha": "2026-09-01"}]
REP = [
    {"nota_id": 2, "medio": "Diario Uno", "url": "https://a", "confianza": "Alta"},
    {"nota_id": 1, "medio": "Radio Dos", "url": "https://b", "confianza": "Alta"},
    {"nota_id": 1, "medio": "Diario Uno", "url": "https://c", "confianza": "Alta"},
    {"nota_id": 1, "medio": "Sin Cuenta", "url": "https://d", "confianza": "Alta"},
    {"nota_id": 1, "medio": "Baja Confianza", "url": "https://e", "confianza": "Baja"},
    {"nota_id": 3, "medio": "Vieja", "url": "https://f", "confianza": "Alta"},
]
MAPA = "new Map([['diariouno','diariouno_ig'],['radiodos','radiodos_ig'],['bajaconfianza','baja_ig'],['vieja','vieja_ig']])"


class BusquedaDirigidaTest(unittest.TestCase):
    def test_cuentas_de_medios_que_publicaron_notas_recientes_sin_repetir(self):
        r = js(f"m.cuentasDirigidas('2026-10-30', {json.dumps(NOTAS)}, {json.dumps(REP)}, {MAPA})")
        # Primero la nota más reciente; sin repetir; sin baja confianza ni notas viejas.
        self.assertEqual(r, ["radiodos_ig", "diariouno_ig"])

    def test_la_dirigida_va_primero_y_la_general_no_repite_cuentas(self):
        fuente = FUNCION.read_text(encoding="utf-8")
        self.assertLess(fuente.index('id: "ig-dirigida"'), fuente.index('id: "instagram"'))
        self.assertIn("return USUARIOS_IG.filter(u => !dirigidas.has(u));", fuente)


if __name__ == "__main__":
    unittest.main()
