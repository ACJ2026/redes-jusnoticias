"""Actualización automática de redes: suma y actualiza, nunca borra (mecanismo, sin datos reales)."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("actualizar_redes", ROOT / "scripts/actualizar_redes.py")
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)


def fila(**k):
    base = {"red": "Facebook", "cuenta": "JusNoticias", "fecha": "2026-10-20", "texto": "Texto de prueba", "nota_id": None,
            "me_gusta": None, "comentarios": None, "compartidos": None, "vistas": None, "propia": "Sí", "key": "fb-1"}
    base.update(k)
    return base


class ActualizarRedesTest(unittest.TestCase):
    def test_agrega_las_nuevas_y_no_borra_las_viejas(self):
        viejas = [fila(key="s1", fecha="2026-09-01", texto="Otra"), fila(red="X", key="s2", propia="No")]
        filas, agregadas, _ = modulo.combinar(viejas, [fila(key="fb-9", texto="Nueva")])
        self.assertEqual(agregadas, 1)
        self.assertEqual(len(filas), 3)
        self.assertEqual({f["key"] for f in filas}, {"s1", "s2", "fb-9"})

    def test_reconoce_una_fila_vieja_por_red_fecha_y_texto(self):
        viejas = [fila(key="s7", cuenta="JusNoticias (prensastjchubut)", texto="Chubut: nuevo régimen penal juvenil, los cambios", me_gusta=3)]
        filas, agregadas, actualizadas = modulo.combinar(viejas, [fila(key="fb-55", texto="Chubut: nuevo regimen penal juvenil, los cambios que trae", me_gusta=8)])
        self.assertEqual((agregadas, actualizadas), (0, 1))
        self.assertEqual(filas[0]["me_gusta"], 8)
        self.assertEqual(filas[0]["cuenta"], "JusNoticias (prensastjchubut)")

    def test_texto_recortado_por_la_api_y_un_dia_de_diferencia(self):
        viejas = [fila(key="s3", red="Instagram", fecha="2026-10-15", texto="Juzgados de Paz de la meseta y la costa")]
        nuevas = [fila(key="ig-1", red="Instagram", fecha="2026-10-14", texto="⚖️ Juzgados de Paz de la m", resumen="⚖️ Juzgados de Paz de la meseta y la costa se reunieron", me_gusta=4)]
        filas, agregadas, actualizadas = modulo.combinar(viejas, nuevas)
        self.assertEqual((len(filas), agregadas, actualizadas), (1, 0, 1))

    def test_reel_sin_texto_coincide_con_el_guardado(self):
        viejas = [fila(key="s4", red="Instagram", texto="Reel: (reel sin texto)")]
        filas, agregadas, _ = modulo.combinar(viejas, [fila(key="ig-2", red="Instagram", texto="")])
        self.assertEqual((len(filas), agregadas), (1, 0))

    def test_dos_publicaciones_distintas_del_mismo_dia_no_se_mezclan(self):
        viejas = [fila(key="s5", texto="Esquel: ordenan a un banco pagar indemnización")]
        filas, agregadas, _ = modulo.combinar(viejas, [fila(key="fb-3", texto="Integrantes de los Juzgado")])
        self.assertEqual((len(filas), agregadas), (2, 1))

    def test_sin_dato_no_pisa_una_cifra(self):
        filas, _, actualizadas = modulo.combinar([fila(me_gusta=5)], [fila(me_gusta=None)])
        self.assertEqual(filas[0]["me_gusta"], 5)
        self.assertEqual(actualizadas, 0)

    def test_ignora_publicaciones_que_no_son_propias(self):
        filas, agregadas, _ = modulo.combinar([], [fila(propia="No")])
        self.assertEqual((len(filas), agregadas), (0, 0))

    def test_el_relevamiento_lo_corre_sin_frenarse_si_falla(self):
        flujo = (ROOT / ".github/workflows/actualizar.yml").read_text(encoding="utf-8")
        self.assertIn("python3 scripts/actualizar_redes.py", flujo)
        self.assertIn("cancel-in-progress: false", flujo)

    def test_ningun_run_de_una_linea_tiene_dos_puntos_sueltos(self):
        # Un «: » dentro de un «run:» de una sola línea rompe todo el workflow (pasó el 28/10).
        import re
        for ruta in (ROOT / ".github/workflows").glob("*.yml"):
            for n, linea in enumerate(ruta.read_text(encoding="utf-8").splitlines(), 1):
                m = re.match(r"\s*(?:- )?run: (?![|>])(.*)$", linea)
                if m and not re.fullmatch(r"(['\"]).*\1", m.group(1).strip()):
                    with self.subTest(f"{ruta.name}:{n}"):
                        self.assertNotIn(": ", m.group(1))

if __name__ == "__main__":
    unittest.main()
