# Instrucciones para agentes (Codex, GPT y Claude)

Este repositorio es el tablero de repercusión de Juschubut Noticias. Antes de cualquier cambio, leé `docs/REGLAS_IA.md`, `REGLAS.md` y la última entrada de `BITACORA.md`.

Reglas obligatorias (detalle y errores ya cometidos en `docs/REGLAS_IA.md`):

1. Nada directo en `main`: siempre rama + PR; fusionar solo con `validar`, `pruebas-historial` y Cloudflare Pages en verde.
2. Confirmar o descartar publicaciones de una nota puntual se hace en `data/revision_manual.json` o con los botones del tablero, nunca con listas por nota en el código.
3. Las pruebas verifican mecanismos, no cantidades de los datos reales (`data/*.json`).
4. No cambiar la concurrencia de `.github/workflows/actualizar.yml` (`cancel-in-progress: false`) ni lanzar corridas en cadena.
5. Consultar con Ignacio antes de cambiar qué se cuenta o cómo se detecta una publicación.
6. Leer el motivo real de un error antes de corregir; no declarar nada resuelto sin una corrida exitosa y la fecha nueva en `data/actualizado.txt`.
7. Revisar PR abiertos y últimos cambios de `main` antes de empezar; anotar todo en `BITACORA.md`.
8. No borrar filas históricas ni inventar resultados. Escribir en español, en lenguaje simple.

Comprobaciones antes de abrir un PR:
- `python3 -m unittest discover -s tests -v`
- Si cambia `templates/tablero.html`: `python3 scripts/armar_publico.py data/notas2.json data/rep2.json data/redes2.json data/canales.json data/medios.json publico/tablero_publico.html && cp publico/tablero_publico.html publico/index.html`
