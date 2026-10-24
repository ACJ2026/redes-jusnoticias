# Reglas para trabajar en este tablero

Este repo es **el único lugar** del código y los datos del Tablero de repercusión JusNoticias.
Lo usan varias conversaciones de Claude (la de Chrome y la de Claude Code). Antes de tocar algo, leé esto y después [CONTINUIDAD_IA.md](CONTINUIDAD_IA.md), que contiene el estado detallado, las verificaciones y los próximos pasos para dar continuidad entre IAs.

## Qué hay acá

| Carpeta / archivo | Qué es |
|---|---|
| `scripts/actualizar.py` | Revisa la lista de medios y busca en Google Noticias. Genera `notas2.json`, `rep2.json`, `medios.json`. |
| `scripts/armar_publico.py` | Arma la versión pública (`publico/tablero_publico.html`) con los datos. |
| `data/` | Los datos que muestran los tableros. |
| `tablero_interno/index.html` | Copia de la página del tablero interno de Claude (se edita en el tablero con ArtifactData y se copia acá). |
| `.github/workflows/actualizar.yml` | GitHub programa el relevamiento cada dos horas, en el minuto 59 de hora argentina (cron UTC en horas pares). La programación no garantiza que cada corrida termine correctamente. |

Tableros que leen estos datos:
- Interno (Claude): https://claude.ai/artifact/Xdyyf8Y5c1jXh5qLWkR2JW
- Público (Claude): https://claude.ai/artifact/M9EJxQHCUWKkcg2Y2ZC784

## Reglas

1. **Nunca borrar filas de `data/rep2.json` que encontró otro método.** Las filas con `metodo` "Buscador web" o "Google Noticias…" se conservan siempre, aunque una corrida nueva no las vuelva a encontrar.
2. **Cambios de código: en una rama aparte y con PR.** Nada de cambiar `scripts/` directo en `main`. Ignacio aprueba con "sí".
3. **Datos: se puede escribir en `main`**, pero siempre partiendo de la última versión (leé el archivo justo antes y usá su SHA). Si cambió, volvé a leer y combiná; no pises.
4. **Formato de una fila de `rep2.json`:** `{nota_id, medio, origen, cita_fuente_oficial, cita_otro_medio, confianza, metodo, url, key}`. `key` = "p0", "p1"… correlativo.
5. **Mismo nombre de medio siempre** (el que ya figura en `medios.json`), para no duplicar.
6. **No inventar resultados.** Si no se pudo verificar, no se carga.
7. **Fechas y horas en hora argentina** en todo lo que se le muestra a Ignacio.
8. Anotá abajo, en el registro, cada cambio importante.

## Registro de cambios

- 20/10/2026 — Tableros interno y público: se aclara que encontrar un medio que publicó sobre el mismo tema no demuestra que haya tomado la información de JusNoticias. Se cambian etiquetas por palabras simples y se agrega en el detalle “Qué se pudo comprobar”: mención de la fuente oficial, mención de otro medio, coincidencia solo por título o fuente no identificada. Archivos: `tablero_interno/index.html`, `publico/tablero_publico.html`, plantilla `scripts/armar_publico.py`. Commits: `9b63440e254ab8160f6da9f074c4786a29078e9f`, `ce96c770c65d07528142724ebd89c63ca2ce39d9`, `164fe7938a8d21967c74cc13447726f2db03e12e`. No se modificaron los JSON de datos. Pendiente revisar visualmente ambos tableros y verificar la ejecución de CI/integración; PR #4 sigue sin fusionar.

- 20/10/2026 — Se agrega `scripts/fuentes.py` con `exigir_lista_json`, usado por `scripts/actualizar.py` en la paginación principal, los índices WordPress y la descarga por lotes de contenido. Se agregan tres pruebas: lista vacía válida, respuesta ausente y JSON con tipo inesperado. Commits de implementación `53cd6fe304dff55dde1aa7462a3ebeae835f450c` y `70396a66f0381277a925f0c023c575a3c72d197a`; pruebas `2849546ce88ef18701b82e1d610a66d56b390c53`. CI del helper pasó; CI del SHA actual en curso/cola e integración pendiente. Sin cambios intencionales en `data/`.

- 20/10/2026 — `scripts/actualizar.py`: al recuperar el contenido de publicaciones WordPress por lotes, ahora cancela si la descarga falla o la respuesta no es una lista JSON válida. Antes, `j or []` podía ocultar el fallo y seguir como si la revisión de textos hubiera terminado. Commit `02397de193aa9f0290c8e9501a96a7827f065591`. Pruebas de regresión disparadas por este commit; integración aislada pendiente de confirmación. Sin cambios intencionales en `data/`.

- 20/10/2026 — `scripts/actualizar.py`: la paginación de los índices WordPress de medios ahora procesa las respuestas en orden y cancela la corrida si una página falla antes de encontrar el final válido; ignora respuestas posteriores al fin ya confirmado del lote. Commit `fb06cb52569717327ad5795ed439a7cc2336c949`. Pendiente CI/integración; sin cambios intencionales en `data/`.

- 20/10/2026 — `scripts/actualizar.py`: la descarga paginada principal de JusNoticias ahora cancela la corrida si falla la consulta o el JSON es inválido, en vez de confundir el error con el fin de la paginación. Commit `16706c14323a46f307eb616e140d5e5aacf7c772`. Pendiente confirmar CI e integración aislada; sin cambios intencionales en `data/`.

- 20/10/2026 — Se crea `CONTINUIDAD_IA.md` para que otra IA pueda retomar el trabajo: objetivo, archivos modificados, SHA/PR, pruebas con enlaces, incertidumbres y pasos siguientes. Rama `fix/conservar-historial-publicaciones`; commit inicial de la bitácora `124a7d5b7eafc793e3cac6d26cbef6a52c17e749`. Se deja explícito que la integración actual aún debe confirmarse y que `main` no se debe fusionar sin autorización.

- 20/10/2026 — Rama `fix/conservar-historial-publicaciones`: conservación y verificación extraídas a funciones testeables; se agregan pruebas unitarias y el workflow usa el verificador probado antes de guardar. Pruebas sintéticas; pendiente de ejecución CI y revisión. Sin cambios en datos.
- 19/10/2026 — Se crea el repo (temporal en ignacervo-cell; se muda a ACJ2026). Se suben el programa con Google Noticias, el armador público y los datos del tablero al 19/10 17:15. Se agrega a `actualizar.py` la regla 1 (no perder filas de buscador).
- 19/10/2026 — Se copia la página del tablero interno a `tablero_interno/index.html`. La tarea de Claude "Sincronizar tablero JusNoticias" (8:25, 10:25 … 20:25) copia los datos del repo a los dos tableros y suma la búsqueda web; la vieja "Actualizar tablero JusNoticias" quedó apagada.
- 20/10/2026 — Para Vercel: `vercel.json` hace que se publique solo la carpeta `publico/` (nunca `data/` ni `scripts/`), y GitHub copia el tablero público a `publico/index.html` en cada actualización.


- 21/10/2026 — PR #5 `feature/indicadores-faciles-de-entender`: portada visual JusNoticias trasladada a la plantilla generadora; la fecha del último relevamiento solo cambia cuando corre el relevamiento real; el tablero distingue esa fecha de la generación del HTML. Las repercusiones sin URL válida pasan a “posibles” y se excluyen de los totales confirmados; se corrigió un enlace de Radio 3 asociado a la nota 14509 y se retiró un enlace ajeno de la fila 14674 sin borrar el registro. Se preparó `functions/api/redes.js` para Cloudflare Pages, con IDs obligatorios y errores explícitos, sin conectarla aún a la interfaz ni afirmar que las métricas sean en vivo. Validación: 20 pruebas automatizadas OK, chequeo de sintaxis JS y despliegue Cloudflare Pages exitoso; PR #5 sigue abierto y no se fusionó ni se tocó `main`. Vista previa: https://feature-indicadores-faciles.redes-jusnoticias.pages.dev/
- 22/10/2026 — `actualizar.py` conserva las notas que la API de JusNoticias dejó de devolver (por ejemplo, las 31 convocatorias de adopciones despublicadas) y, con ellas, sus publicaciones. Sin esto, la corrida armaba 250 notas contra 281 y el control del 5% frenaba el guardado desde el 22/10 12:22.
- 22/10/2026 — `https://jusnoticias.pages.dev/` es la única dirección del tablero para todo (público, API y URI de retorno de TikTok). `redes-jusnoticias.pages.dev` queda descartada.

- 24/10/2026 — PR #85 fusionado en `main`: ayudas breves por sección y lenguaje más simple para los estados del tablero. Archivos: `templates/tablero.html`, `tests/test_tablero_publico.py`, `docs/MANUAL_TABLERO.md`. Merge commit `7a39687128e55e8c2521a42ebc4ae351060a8849`; PR: https://github.com/ACJ2026/redes-jusnoticias/pull/85. Checks de CI del PR aprobados; vista previa de Cloudflare informada como exitosa. Producción tras el merge y revisión visual en móvil siguen pendientes de confirmar. Sin cambios en los datos históricos. Registro detallado en [BITACORA.md](BITACORA.md).

- 24/10/2026 — Corrección pendiente de revisión en rama `fix/tabla-notas-movil-ayuda-boton`: sustituye la explicación larga de la tabla por el botón «Cómo leer esta tabla» y presenta las notas como fichas en celular. Se agregan prueba de regresión y actualización del manual. Datos históricos intactos; CI y producción pendientes. Detalle en [BITACORA.md](BITACORA.md).
