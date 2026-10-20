# Continuidad del proyecto para otra IA

Última actualización: 20/10/2026 (hora argentina).
Repositorio: https://github.com/ignacervo-cell/jusnoticias-tablero
Rama de trabajo: `fix/conservar-historial-publicaciones`
PR: https://github.com/ignacervo-cell/jusnoticias-tablero/pull/4
Estado del PR: abierto, en borrador, sin integrar. **No fusionar ni modificar `main` sin autorización explícita de Ignacio.**

## Leer antes de actuar

1. Leer `REGLAS.md`; sus reglas sobre datos e historial siguen vigentes.
2. Leer este archivo para conocer el estado, las verificaciones y el próximo trabajo.
3. Comprobar el estado actual del PR, la rama y las ejecuciones de Actions. Este registro es una bitácora, no reemplaza la verificación en GitHub.
4. No sobrescribir archivos de datos ni asumir que una integración terminó solo porque una ejecución anterior tuvo éxito.

## Objetivo principal

Evitar que las actualizaciones automáticas borren publicaciones/repercusiones históricas válidas del tablero cuando una búsqueda o medio no devuelve esas filas en una corrida posterior. Preservar el historial sin inventar resultados y sin tocar los datos originales durante pruebas.

## Cambios implementados en la rama

- **Nuevo (20/10/2026):** se actualizan las etiquetas de los tableros interno y público para que sean fáciles de entender y se diferencia una publicación relacionada con el tema de una publicación que menciona a JusNoticias. En el detalle se muestra qué se pudo comprobar: mención de la fuente oficial, mención de otro medio, coincidencia solo por título o fuente no identificada. Se actualizan también la plantilla pública y su HTML generado. Commits: `9b63440e254ab8160f6da9f074c4786a29078e9f`, `ce96c770c65d07528142724ebd89c63ca2ce39d9`, `164fe7938a8d21967c74cc13447726f2db03e12e`. No se modificaron datos JSON. Pendiente comprobar presentación y pruebas automáticas.

- **Nuevo (20/10/2026):** se centraliza la validación de respuestas JSON de fuentes en `scripts/fuentes.py` (`exigir_lista_json`) y se usa en las tres etapas de paginación/descarga WordPress. Se agregan tres pruebas para lista vacía válida, respuesta ausente y tipo JSON inesperado. Commits: `53cd6fe304dff55dde1aa7462a3ebeae835f450c`, `70396a66f0381277a925f0c023c575a3c72d197a`, pruebas `2849546ce88ef18701b82e1d610a66d56b390c53`. La CI del helper pasó; el SHA con las nuevas pruebas todavía debe terminar sus ejecuciones.

- **Nuevo (20/10/2026):** al recuperar el contenido completo de publicaciones WordPress por lotes, `scripts/actualizar.py` cancela la corrida si falla la descarga o el JSON no es una lista. Se elimina el fallback `j or []`, que ocultaba fallos de red/JSON y podía etiquetar una revisión como completa sin haber recuperado los textos. Commit `02397de193aa9f0290c8e9501a96a7827f065591`. La prueba de regresión se disparó para el nuevo SHA; integración aislada pendiente.

- **Nuevo (20/10/2026):** `scripts/actualizar.py` también valida la paginación de los índices WordPress de medios. Procesa las respuestas en orden y cancela si falla una página antes de confirmar el final válido; ignora errores en páginas posteriores al final válido del mismo lote. Commit: `fb06cb52569717327ad5795ed439a7cc2336c949`. Aún debe verificarse por CI e integración; no se ha afirmado que el caso de fallo esté probado de extremo a extremo.
- **Nuevo (20/10/2026):** `scripts/actualizar.py` ahora distingue una lista vacía válida del error de descarga/JSON en la paginación principal de JusNoticias. Ante `None`, lanza `RuntimeError` y cancela la corrida para evitar tratar una descarga fallida como fin normal de páginas. Commit: `16706c14323a46f307eb616e140d5e5aacf7c772`. Aún debe verificarse por CI e integración; no se ha afirmado que el caso de fallo esté probado de extremo a extremo.

- `scripts/historial.py`: funciones para conservar publicaciones previas vinculadas a notas vigentes y detectar pares históricos ausentes.
- `scripts/verificar_historial.py`: verificación por identidad `(nota_id, medio)`; devuelve error si falta una publicación anterior correspondiente a una nota que sigue vigente.
- `tests/test_conservar_historial.py`: seis pruebas unitarias/regresión.
- `scripts/actualizar.py`: utiliza la función de conservación de historial al combinar la salida nueva con el archivo anterior.
- `.github/workflows/test-historial.yml`: ejecuta las pruebas de regresión en push y pull request.
- `.github/workflows/prueba-integracion-aislada.yml`: ejecuta el actualizador real en una carpeta temporal, comprueba el historial, simula la pérdida de una fila y verifica que los archivos originales de `data/` no se modifiquen. Tiene permisos de solo lectura.
- `.github/workflows/actualizar.yml`: antes de guardar, verifica que no falten publicaciones históricas de notas vigentes; rechaza una caída de publicaciones superior al 20 % y una caída de notas superior al 5 %.
- `REGLAS.md`: incluye registro de cambios, reglas para no perder filas y trabajo con ramas/PR.

## Estado confirmado al 20/10/2026

- Último código: `70396a66f0381277a925f0c023c575a3c72d197a`; pruebas nuevas: `2849546ce88ef18701b82e1d610a66d56b390c53`; registro de reglas actualizado en `6975ea2a815bf5b07cc9a53a9073fddf8711a169`. El SHA final de la rama cambia con cada actualización de documentación; consultar PR/Actions directamente.

- Último cambio de código: `02397de193aa9f0290c8e9501a96a7827f065591`; actualizaciones de bitácora posteriores en `REGLAS.md` y este archivo. Consultar la rama y Actions antes de considerar aprobadas las pruebas de este SHA.

- `main` permanece en el SHA `77be8c476bb3630f0e8c4f033ab1fde266cd83c5` según la última consulta del PR.
- Rama `fix/conservar-historial-publicaciones`: consultar el SHA actual directamente en el PR; hubo nuevos commits posteriores a la primera versión de esta bitácora. Últimos cambios de código: `16706c14323a46f307eb616e140d5e5aacf7c772` (fallo en paginación principal) y `fb06cb52569717327ad5795ed439a7cc2336c949` (paginación de índices de medios).
- PR #4 abierto, en borrador, no fusionado; 14 commits, 8 archivos modificados según la última consulta.
- Pruebas de regresión para el SHA actual: **éxito** en GitHub Actions, tanto push como pull request.
  - Push: https://github.com/ignacervo-cell/jusnoticias-tablero/actions/runs/39358829447
  - Pull request: https://github.com/ignacervo-cell/jusnoticias-tablero/actions/runs/39358832668
- Integración aislada: hay ejecuciones nuevas pendientes tras los cambios de código; al último chequeo, la ejecución `39359357906` para el commit de código `fb06cb5` estaba pendiente y la ejecución anterior `39357645320` seguía marcada en curso con el SHA antiguo `a119a836ff372ef27abf0628ec4ea5733724ff57`. Consultar ambas antes de afirmar un resultado: https://github.com/ignacervo-cell/jusnoticias-tablero/actions/runs/39359357906 y https://github.com/ignacervo-cell/jusnoticias-tablero/actions/runs/39357645320.
- Una ejecución de integración anterior sí terminó con éxito en el SHA anterior `13f4aedba6d2124788964aaedc62b772262c38ed`: procesó 279 notas, 1.193 publicaciones y 64 medios; validó la conservación del historial y que los datos originales quedaran intactos. Registro: https://github.com/ignacervo-cell/jusnoticias-tablero/actions/runs/39357573012. **No confundir ese resultado con la integración del SHA actual.**
- No se han fusionado estos cambios en `main`; el objetivo es proteger el historial. La integración real se hace en una salida temporal y no debe sobrescribir `data/`.

## Limitaciones y riesgos pendientes

- Los umbrales de 20 % de publicaciones y 5 % de notas son barreras complementarias, no una garantía absoluta. Una pérdida menor podría pasar.
- La verificación de publicaciones solo puede proteger bien las notas identificadas como vigentes. Si la fuente principal de notas devuelve una lista parcial y omite una nota, sus publicaciones históricas podrían quedar fuera del control por identidad.
- Aún hay fuentes secundarias que usan `get(...) or ''` o `get(...) or b''` para sitemaps y Google Noticias. Auditar cuáles son índices obligatorios y cuáles pueden faltar legítimamente; no convertir un error de red en cobertura completa. La descarga de contenido WordPress por lote ya cancela ante `None`/JSON inválido.
- El workflow de integración en curso no incluye la última modificación del umbral de notas; ejecutar una nueva integración contra el SHA actual cuando corresponda.

## Próximos pasos, en orden

1. Consultar de nuevo la ejecución de integración #2 y registrar el resultado real de cada paso. Si sigue colgada o falla, inspeccionar el job/log antes de reintentar.
2. Lanzar/confirmar integración aislada para el SHA actual `4ee3a4d8818f946bd5460d8d4408d6276cee7d4a`; confirmar explícitamente: actualización real en carpeta temporal, pérdida simulada bloqueada y `data/` intacta.
3. Auditar `scripts/actualizar.py` para diferenciar fuente vacía válida de fuente inaccesible o incompleta. Diseñar y probar un fallo seguro antes de guardar datos.
4. Extender la integración aislada para simular una fuente fallida y comprobar que el actualizador cancela sin tocar `data/`; después auditar sitemaps y Google Noticias que aún usan `get(...) or ''`.
5. Actualizar este registro y el apartado “Registro de cambios” de `REGLAS.md` tras cada cambio importante, indicando fecha, SHA/commit, archivos tocados, pruebas ejecutadas y resultado.
6. Solo después de verificar todo, presentar a Ignacio el estado y pedir autorización antes de integrar el PR en `main`.

## Formato obligatorio para nuevas entradas de bitácora

- Fecha y hora de Argentina.
- Qué se cambió y por qué.
- Rama y SHA/commit.
- Pruebas ejecutadas con enlaces y resultado exacto.
- Si se tocaron datos o si se comprobó que quedaron intactos.
- Próximo paso y cualquier incertidumbre pendiente.

**Regla de honestidad:** distinguir siempre entre “implementado”, “prueba unitaria aprobada”, “integración aprobada” y “fusionado en main”. No son lo mismo.
