"""Mismo caso contado con palabras propias del medio (decisión de Ignacio, 27/10/2026).

Prueban el mecanismo con textos inventados, no cantidades de los datos reales.
"""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from relevancia_publicaciones import evidencia_misma_nota, es_misma_publicacion

TITULO = "Esquel: fallo sancionó a Plan Óvalo y Ford por ocultar información ante la suba desmedida de cuotas"
FRASES = [
    "La Cámara de Apelaciones confirmó la responsabilidad solidaria de la administradora y la fábrica",
    "las pericias contables establecieron que el valor del vehículo aumentó novecientos cincuenta por ciento",
    "la suscriptora inició la demanda en diciembre de dos mil diecinueve por las cuotas impagables",
    "el tribunal entendió que ambas empresas integran un mismo grupo económico y ocultaron información",
    "la multa por daño punitivo se elevó de dos a cuatro millones de pesos con intereses",
    "la administradora deberá restituir los gastos de administración cobrados durante el plan",
    "los camaristas señalaron desinterés frente a la suscriptora mientras las cuotas casi se triplicaban",
    "el precio del automotor lo fija unilateralmente la terminal y las cuotas dependen de ese valor",
]
CUERPO = ". ".join(FRASES) + "."


def reescribir(frases):
    # Las mismas palabras en otro orden: no repite ninguna frase de seis palabras.
    return ". ".join(" ".join(reversed(f.split())) for f in reversed(frases)) + "."


class MismoCasoTest(unittest.TestCase):
    def test_version_propia_del_mismo_caso_cuenta(self):
        ev = evidencia_misma_nota(TITULO, CUERPO, "Compró un auto por plan de ahorro y ganó el juicio a Ford y Plan Óvalo", reescribir(FRASES))
        self.assertFalse(ev["misma_nota"])
        self.assertTrue(ev["mismo_caso"])
        self.assertTrue(es_misma_publicacion(ev))

    def test_otra_nota_con_vocabulario_judicial_no_cuenta(self):
        otra = ("El Superior Tribunal de Justicia realizó una jornada de capacitación para magistrados y funcionarios "
                "sobre el nuevo régimen de responsabilidad penal juvenil. Participaron jueces de toda la provincia, "
                "que debatieron los desafíos de la implementación del sistema y la actividad de las autoridades.")
        ev = evidencia_misma_nota(TITULO, CUERPO, "Capacitación sobre el régimen penal juvenil", otra)
        self.assertFalse(ev["mismo_caso"])
        self.assertFalse(es_misma_publicacion(ev))

    def test_mismo_tema_sin_terminos_del_titulo_no_cuenta(self):
        ev = evidencia_misma_nota(TITULO, CUERPO, "Consejos para elegir un auto usado", reescribir(FRASES))
        self.assertFalse(ev["mismo_caso"])

    def test_texto_corto_no_alcanza(self):
        ev = evidencia_misma_nota(TITULO, CUERPO, "Plan Óvalo y Ford, sancionados", reescribir(FRASES[:2]))
        self.assertFalse(ev["mismo_caso"])

    def test_verificador_y_recolector_usan_el_mismo_criterio(self):
        verificador = (ROOT / "scripts/verificar_publicaciones.py").read_text(encoding="utf-8")
        recolector = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")
        self.assertIn("es_misma_publicacion", verificador)
        self.assertGreaterEqual(recolector.count("es_misma_publicacion("), 3)

    def test_redaccion_propia_ya_no_queda_con_confianza_baja(self):
        recolector = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")
        self.assertIn("else 'Media')", recolector)


class BuscadorTest(unittest.TestCase):
    def test_enlaces_directos_antes_que_google_noticias_y_segunda_oportunidad(self):
        recolector = (ROOT / "scripts/actualizar.py").read_text(encoding="utf-8")
        self.assertIn("items.sort(key=lambda it: es_google_noticias(it.get('u')))", recolector)
        self.assertIn("segunda_oportunidad.setdefault(it['u'], (it, n))", recolector)
        self.assertIn("mejor_nota_por_texto(it, t)", recolector)
        # La segunda oportunidad no lleva marcas de candidata: el verificador no la reabre.
        self.assertIn('hallado por buscador)"', recolector)


if __name__ == "__main__":
    unittest.main()
