import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from historial import conservar_historial, conservar_notas, publicaciones_faltantes
from fuentes import exigir_lista_json


class HistorialTests(unittest.TestCase):
    def test_respuesta_lista_vacia_es_fin_valido(self):
        self.assertEqual(exigir_lista_json([], "fuente de prueba"), [])

    def test_respuesta_ausente_falla_cerrado(self):
        with self.assertRaisesRegex(RuntimeError, "fuente de prueba"):
            exigir_lista_json(None, "fuente de prueba")

    def test_json_con_tipo_inesperado_falla_cerrado(self):
        with self.assertRaisesRegex(RuntimeError, "JSON inesperado"):
            exigir_lista_json({"error": "timeout"}, "fuente de prueba")

    def test_conserva_notas_que_la_api_ya_no_devuelve(self):
        actuales = [{"id": 2, "titulo": "Nueva"}]
        anteriores = [{"id": 1, "titulo": "Despublicada"}, {"id": 2, "titulo": "Vieja"}]
        salida = conservar_notas(actuales, anteriores)
        self.assertEqual([n["id"] for n in salida], [2, 1])
        self.assertEqual(salida[0]["titulo"], "Nueva")
        self.assertEqual(len(actuales), 1)

    def test_publicaciones_de_nota_conservada_siguen_vigentes(self):
        notas = conservar_notas([], [{"id": "n1"}])
        ids = {n["id"] for n in notas}
        anterior = [{"nota_id": "n1", "medio": "Medio A"}]
        self.assertEqual(len(conservar_historial([], anterior, ids, {})), 1)
        self.assertEqual(publicaciones_faltantes(anterior, [], ids), {("n1", "Medio A")})

    def test_conserva_publicacion_ausente_si_nota_sigue_vigente(self):
        anterior = [{"nota_id": "n1", "medio": "Medio A", "url": "https://a", "key": "p7"}]
        salida = conservar_historial([], anterior, {"n1"}, {})
        self.assertEqual(len(salida), 1)
        self.assertEqual(salida[0]["url"], "https://a")
        self.assertNotIn("key", salida[0])

    def test_no_conserva_publicacion_de_nota_no_vigente(self):
        anterior = [{"nota_id": "vieja", "medio": "Medio A"}]
        self.assertEqual(conservar_historial([], anterior, set(), {}), [])

    def test_completa_campos_vacios_y_combina_metodos_sin_duplicar(self):
        actual = [{"nota_id": "n1", "medio": "Medio A", "url": "", "metodo": "Buscador web"}]
        anterior = [{"nota_id": "n1", "medio": "Medio A", "url": "https://a", "metodo": "Google Noticias + Buscador web"}]
        salida = conservar_historial(actual, anterior, {"n1"}, {})
        self.assertEqual(len(salida), 1)
        self.assertEqual(salida[0]["url"], "https://a")
        self.assertEqual(salida[0]["metodo"], "Google Noticias + Buscador web")

    def test_verificador_detecta_faltantes_de_notas_vigentes(self):
        anteriores = [{"nota_id": "n1", "medio": "A"}, {"nota_id": "n2", "medio": "B"}]
        nuevas = [{"nota_id": "n1", "medio": "A"}]
        self.assertEqual(publicaciones_faltantes(anteriores, nuevas, {"n1", "n2"}), {("n2", "B")})

    def test_verificador_ignora_notas_que_ya_no_estan_vigentes(self):
        anteriores = [{"nota_id": "vieja", "medio": "A"}]
        self.assertEqual(publicaciones_faltantes(anteriores, [], {"nueva"}), set())

    def test_comando_verificador_falla_antes_de_aceptar_resultado_incompleto(self):
        with tempfile.TemporaryDirectory() as d:
            paths = [os.path.join(d, name) for name in ("antes.json", "nuevo.json", "notas.json")]
            fixtures = [
                [{"nota_id": "n1", "medio": "A"}],
                [],
                [{"id": "n1"}],
            ]
            for path, obj in zip(paths, fixtures):
                with open(path, "w", encoding="utf8") as f:
                    json.dump(obj, f)
            result = subprocess.run(
                [sys.executable, os.path.join(os.path.dirname(__file__), "..", "scripts", "verificar_historial.py"), *paths],
                capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("faltan 1 publicaciones", result.stdout)


if __name__ == "__main__":
    unittest.main()
