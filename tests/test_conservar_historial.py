import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from historial import conservar_historial, conservar_notas, publicaciones_faltantes, normalizar_url, deduplicar_publicaciones, marcar_secundarias, clave_publicacion, aplicar_revision_manual
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

    def test_normaliza_variantes_de_la_misma_url(self):
        base = normalizar_url("https://medio.com.ar/nota-uno")
        for variante in ("http://www.medio.com.ar/nota-uno/", "https://MEDIO.com.ar/nota-uno?utm_source=fb&fbclid=x",
                         "https://medio.com.ar/nota-uno#comentarios", "https://medio.com.ar/nota-uno/amp/", "https://medio.com.ar/amp/nota-uno"):
            self.assertEqual(normalizar_url(variante), base, variante)
        # Parámetros que identifican el artículo se conservan.
        self.assertNotEqual(normalizar_url("https://m.com/nota?id=1"), normalizar_url("https://m.com/nota?id=2"))
        self.assertEqual(normalizar_url("https://news.google.com/rss/articles/ABC?oc=5"), "https://news.google.com/rss/articles/ABC")

    def test_dos_articulos_del_mismo_medio_sobre_una_nota_se_conservan(self):
        filas = [{"nota_id": 1, "medio": "A", "url": "https://a.com/x"}, {"nota_id": 1, "medio": "A", "url": "https://a.com/y"},
                 {"nota_id": 1, "medio": "A", "url": "http://www.a.com/x/?utm_medium=social"}]
        salida = deduplicar_publicaciones(filas)
        self.assertEqual([f["url"] for f in salida], ["https://a.com/x", "https://a.com/y"])

    def test_enlace_de_buscador_queda_como_alternativa_del_enlace_directo(self):
        filas = [{"nota_id": 1, "medio": "A", "url": "https://news.google.com/rss/articles/Z", "metodo": "Google Noticias (solo título)"},
                 {"nota_id": 1, "medio": "A", "url": "https://a.com/x", "metodo": "Revisión completa"}]
        salida = deduplicar_publicaciones(filas)
        self.assertEqual(len(salida), 1)
        self.assertEqual(salida[0]["url"], "https://a.com/x")
        self.assertEqual(salida[0]["url_alternativas"], ["https://news.google.com/rss/articles/Z"])
        self.assertIn("Google Noticias", salida[0]["metodo"])

    def test_solo_buscador_queda_una_fila_por_medio(self):
        filas = [{"nota_id": 1, "medio": "A", "url": "https://news.google.com/rss/articles/Z1"},
                 {"nota_id": 1, "medio": "A", "url": "https://news.google.com/rss/articles/Z2"}]
        salida = deduplicar_publicaciones(filas)
        self.assertEqual(len(salida), 1)
        self.assertEqual(salida[0]["url_alternativas"], ["https://news.google.com/rss/articles/Z2"])

    def test_historial_con_otro_enlace_del_mismo_medio_se_conserva(self):
        actual = [{"nota_id": "n1", "medio": "A", "url": "https://a.com/nueva"}]
        anterior = [{"nota_id": "n1", "medio": "A", "url": "https://a.com/vieja", "key": "p1"}]
        salida = conservar_historial(actual, anterior, {"n1"}, {})
        self.assertEqual(sorted(f["url"] for f in salida), ["https://a.com/nueva", "https://a.com/vieja"])

    def test_historial_es_idempotente(self):
        filas = [{"nota_id": "n1", "medio": "A", "url": "https://a.com/x", "metodo": "Revisión completa"},
                 {"nota_id": "n2", "medio": "B", "url": "https://news.google.com/rss/articles/Q", "metodo": "Google Noticias"}]
        salida = conservar_historial(filas, filas, {"n1", "n2"}, {})
        self.assertEqual(len(salida), 2)
        self.assertNotIn("url_alternativas", salida[0])

    def test_verificador_detecta_enlace_directo_perdido(self):
        anteriores = [{"nota_id": 1, "medio": "A", "url": "https://a.com/x"}, {"nota_id": 1, "medio": "A", "url": "https://a.com/y"}]
        nuevas = [{"nota_id": 1, "medio": "A", "url": "https://a.com/x/"}]
        self.assertEqual(publicaciones_faltantes(anteriores, nuevas, {1}), {(1, "A", "https://a.com/y")})

    def test_segundo_articulo_del_mismo_medio_queda_por_revisar(self):
        filas = [{"nota_id": 1, "medio": "A", "url": "https://a.com/x", "confianza": "Alta", "metodo": "Revisión completa"},
                 {"nota_id": 1, "medio": "A", "url": "https://a.com/y", "confianza": "Alta", "metodo": "Revisión completa"}]
        marcar_secundarias(filas)
        self.assertEqual([f["confianza"] for f in filas], ["Alta", "Baja"])
        self.assertIn("por revisar", filas[1]["metodo"])

    def test_se_mantiene_confirmado_el_articulo_ya_confirmado_en_el_historial(self):
        filas = [{"nota_id": 1, "medio": "A", "url": "https://a.com/nuevo", "confianza": "Alta"},
                 {"nota_id": 1, "medio": "A", "url": "https://a.com/historico", "confianza": "Alta"}]
        marcar_secundarias(filas, {clave_publicacion({"nota_id": 1, "medio": "A", "url": "https://a.com/historico/"})})
        self.assertEqual([f["confianza"] for f in filas], ["Baja", "Alta"])

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


class RevisionManualTests(unittest.TestCase):
    def fila(self, **k):
        base = {"nota_id": 1, "medio": "ADN Sur", "origen": "Redacción propia", "cita_fuente_oficial": "No",
                "cita_otro_medio": "", "confianza": "Baja", "metodo": "Revisión de texto (coinciden los datos)",
                "url": "https://www.adnsur.com.ar/policiales/nota-1"}
        base.update(k)
        return base

    def test_confirmar_sube_la_confianza_aunque_cambie_la_forma_del_enlace(self):
        filas = [self.fila()]
        rev = [{"nota_id": 1, "url": "http://adnsur.com.ar/policiales/nota-1/?utm_source=x", "decision": "confirmar", "origen": "Reescritura parcial"}]
        aplicar_revision_manual(filas, rev)
        self.assertEqual(filas[0]["confianza"], "Alta")
        self.assertEqual(filas[0]["origen"], "Reescritura parcial")
        self.assertIn("confirmado en revisión manual", filas[0]["metodo"])

    def test_descartar_no_borra_la_fila(self):
        filas = [self.fila(confianza="Media")]
        aplicar_revision_manual(filas, [{"nota_id": 1, "url": filas[0]["url"], "decision": "descartar"}])
        self.assertEqual(len(filas), 1)
        self.assertEqual(filas[0]["confianza"], "Baja")

    def test_confirmar_un_enlace_nuevo_crea_la_fila(self):
        filas = []
        aplicar_revision_manual(filas, [{"nota_id": 1, "medio": "FM Tropical", "url": "https://fmtropical.com/x", "decision": "confirmar", "origen": "Redacción propia"}])
        self.assertEqual(len(filas), 1)
        self.assertEqual(filas[0]["confianza"], "Alta")
        self.assertEqual(filas[0]["metodo"], "Revisión manual")

    def test_otra_nota_o_sin_medio_no_hace_nada(self):
        filas = [self.fila()]
        aplicar_revision_manual(filas, [{"nota_id": 2, "url": filas[0]["url"], "decision": "confirmar"},
                                        {"nota_id": 1, "url": "https://otro.com/y", "decision": "confirmar"}])
        self.assertEqual(len(filas), 1)
        self.assertEqual(filas[0]["confianza"], "Baja")

    def test_aplicar_dos_veces_da_lo_mismo(self):
        filas = [self.fila()]
        rev = [{"nota_id": 1, "url": filas[0]["url"], "decision": "confirmar", "origen": "Redacción propia"}]
        aplicar_revision_manual(filas, rev)
        primera = dict(filas[0])
        aplicar_revision_manual(filas, rev)
        self.assertEqual(filas[0], primera)

    def test_queda_registrado_quien_decidio_y_por_que(self):
        filas = [self.fila()]
        aplicar_revision_manual(filas, [{"nota_id": 1, "url": filas[0]["url"], "decision": "confirmar", "origen": "Reescritura parcial",
                                         "revisado_por": "Ignacio", "fecha": "2026-10-23", "motivo": "cita los mismos datos del fallo"}])
        self.assertEqual(filas[0]["revision_manual"], {"decision": "confirmar", "por": "Ignacio", "fecha": "2026-10-23", "motivo": "cita los mismos datos del fallo"})
