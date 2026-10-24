# Bitácora técnica — Tablero de repercusión JusNoticias

> Documento de continuidad para personas y asistentes de IA. Leer antes de cambiar código o datos. Registrar aquí cada intervención relevante y actualizar el estado al terminar.

## Objetivo y reglas de trabajo

- Mantener el tablero existente de repercusión de JusNoticias y ampliarlo sin perder el historial de notas, medios y redes.
- Registrar los cambios en esta bitácora y en commits descriptivos.
- No sobrescribir ni reconstruir los archivos históricos de datos para añadir nuevas fuentes.
- No declarar una integración operativa hasta verificarla en producción con credenciales válidas.
- No guardar secretos, tokens ni claves privadas en el repositorio.
- Trabajar en ramas de cambios; no editar `main` directamente.
- Distinguir entre código implementado, pruebas locales, ejecución de GitHub Actions y despliegue de Vercel. Una etapa no prueba automáticamente las otras.

## Arquitectura observada al iniciar esta intervención

- Tablero público estático: `publico/tablero_publico.html`; Vercel publica la carpeta `publico/` y usa `publico/index.html`.
- La plantilla HTML vive en `templates/tablero.html` como texto plano versionado; `scripts/armar_publico.py` la lee con `pathlib` y los datos se insertan en el marcador `/*DATOS*/`.
- Recolección histórica de noticias y repercusión: `scripts/actualizar.py`, con datos en `data/notas2.json`, `data/rep2.json`, `data/medios.json`, `data/redes2.json` y `data/canales.json`.
- API existente de redes sociales: `api/redes.js`; usa variables de entorno de Vercel para credenciales de Meta y, opcionalmente, YouTube.
- Automatización de actualización: `.github/workflows/actualizar.yml`.
- No se encontró al inicio una API de Google Analytics 4 ni de Search Console conectada al tablero.

## Datos de Site Kit proporcionados por el usuario

Período del informe: 22/09/2026–19/10/2026.

- Usuarios/tráfico general informado por Site Kit: aproximadamente 6,5 mil; variación -11,7 % contra los 28 días anteriores.
- Canales: búsqueda orgánica 45,2 %, directo 41,6 %, social orgánico 10,2 %, referencia 1,5 %, otros 1,5 %.
- Search Console: 114 mil impresiones (-12,7 %), 2,7 mil clics (-16 %) y 3 mil visitantes únicos desde búsquedas (-9,4 %).
- Móvil representa 59,7 % de los dispositivos.
- Página principal: 962 páginas vistas; noticia sobre indemnización a una pasajera en Comodoro Rivadavia: 1.351 páginas vistas.
- LCP de laboratorio en móvil: 12,0 s (deficiente); datos de usuarios reales muestran LCP 2,2 s (bueno).
- Estas cifras son una captura aportada por el usuario, no una conexión automática ni una validación independiente de las APIs.

## Incidencias previas conocidas

- En la ejecución de GitHub Actions identificada como run `39428259025`, el paso de generación pública falló por doble llamada a `.decode("utf-8")` en la línea de plantilla de `scripts/armar_publico.py`. El error fue `AttributeError: 'str' object has no attribute 'decode'`. La corrección prevista es dejar un solo `.decode("utf-8")`.
- En ese run, la comprobación de conservación de historial informó OK antes de fallar la generación pública. También se registró un error aislado de JSON en la fuente Atento Chubut; el log indicó que el proceso continuó conservando el historial.
- Los avisos de Node.js 20 y Ubuntu runner eran avisos de mantenimiento, no la causa de ese fallo.

## Registro de intervenciones

### 2026-10-20 — Inicio de integración de métricas Google

- Motivo: incorporar al tablero existente métricas de GA4 y Search Console, evitando la copia manual de los informes de Site Kit.
- Rama de trabajo: `feature/google-metrics-and-project-log`, creada desde `main`.
- Inspección: se verificaron `vercel.json`, `api/redes.js`, `.github/workflows/actualizar.yml` y `scripts/armar_publico.py`.
- Hallazgo: el sitio es estático salvo las funciones bajo `api/`; por ello, la integración debe consultar las APIs desde una función de servidor y no exponer credenciales en el navegador.
- Cambios y pruebas de esta rama se anotarán debajo a medida que se completen.

## Estado actual y próximos pasos

- [x] Corregir el doble `.decode("utf-8")` en el generador público.
- [x] Añadir una API de servidor que consulte GA4 y Search Console con credenciales de entorno.
- [x] Añadir una sección Google al tablero que muestre el estado de configuración, tráfico, búsquedas y páginas principales.
- [x] Documentar variables de entorno y permisos mínimos necesarios.
- [ ] Ejecutar comprobaciones estáticas y pruebas del generador.
- [ ] Desplegar y validar con credenciales reales; mientras no se configuren las variables en Vercel, la conexión se considera pendiente.
- [ ] Registrar los resultados de CI y URL de despliegue cuando existan.

## Protocolo para la siguiente IA o desarrollador

1. Leer este archivo completo y revisar los últimos commits de la rama activa.
2. Comprobar `git status`/estado de la rama antes de modificar archivos.
3. Revisar los datos históricos existentes antes de ejecutar procesos que los escriban.
4. No cambiar los datos de noticias/redes para resolver una falla de interfaz o API.
5. Actualizar esta bitácora con fecha, archivos, motivo, pruebas, resultados y pendientes en el mismo cambio que modifica el proyecto.


### 2026-10-20 — Implementación inicial en rama de trabajo

Archivos creados/modificados:
- `api/google-metrics.js` (commits `f1dc7e51ba21303191d3298df73a683304d8bcc5`, `da60627cb043e75cc53321d61beb48889f24124a`, `0361234ade0399526dc62983b0dc957b8e6b1988`): endpoint GET de servidor con JWT firmado para cuenta de servicio, consultas de GA4 y Search Console, rango máximo de 90 días, informes separados para evitar sumar usuarios duplicados a través de dimensiones y totales completos de Search Console. Respuestas de configuración pendiente y error son explícitas.
- `scripts/armar_publico.py` (commits `7a3635d338f5ce476b16e0fa48dae1f539372fb0`, `6eba9f232039b129a3b59b86d186ca25cba73a3d`): eliminada la segunda llamada a `.decode("utf-8")`; se añadió pestaña Google en la plantilla embebida, con filtros de fechas, KPIs, páginas principales, canales, dispositivos, consultas y páginas de Search Console.
- `docs/GOOGLE_METRICS.md` (commit `fe1efa48d70aeac9082db4742c56de275e586ddd`): pasos de configuración, permisos de solo lectura y variables de entorno.
- `BITACORA.md` (commit inicial `a6fc8cf23c5f5a3b389fa59e56c5f8856c436bc9`): este registro y protocolo de continuidad.

Validaciones estáticas hechas durante edición:
- Se comprobó que la plantilla incluye la pestaña `Google`, la llamada a `/api/google-metrics` y el despachador `google: drawGoogle`.
- Se comprobó que el generador ya no contiene el doble `.decode("utf-8")`.
- Se corrigió la tarjeta de clics/impresiones para que use los totales de Search Console, no la suma parcial de las 25 consultas principales.
- Estas comprobaciones son inspecciones estáticas; todavía NO equivalen a una ejecución de Python/Node, una ejecución de GitHub Actions ni una validación con las APIs reales.

Configuración externa pendiente:
- Variables de Vercel: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID`, `GSC_SITE_URL`.
- Dar acceso de lectura al correo de la cuenta de servicio en GA4 y Search Console.
- Hasta configurar esas variables y permisos, la pestaña debe mostrar “Pendiente de configuración”; no afirmar que los datos reales ya están conectados.

Próxima acción:
- Abrir PR desde `feature/google-metrics-and-project-log` hacia `main` para revisar los cambios sin escribir directamente sobre `main`.
- Antes de publicar, ejecutar pruebas del generador y comprobar los endpoints en el despliegue de Vercel.


### 2026-10-20 — Pull request y estado de validación

- PR abierto: https://github.com/ACJ2026/redes-jusnoticias/pull/2
- Rama: `feature/google-metrics-and-project-log`; base `main`.
- HEAD inspeccionado antes de esta actualización de bitácora: `2d525ea4fc4861203f3a70a16059b2bb3592772b`.
- Comparación con `main`: 8 commits por delante, 0 por detrás; 4 archivos cambiados (BITACORA.md, api/google-metrics.js, docs/GOOGLE_METRICS.md, scripts/armar_publico.py).
- GitHub Actions: ejecución `39433106427`, job `pruebas-historial`, resultado `success`. Esto valida las pruebas de regresión del historial, no la API nueva ni el generador completo.
- Checks de Vercel para el commit inspeccionado informaron `failure` en ambos proyectos (`redes-jusnoticias` y `redes-jusnoticias-67i7`). No se pudo obtener el detalle del log desde la herramienta disponible; causa no determinada. No marcar despliegue como exitoso.
- El PR sigue abierto y sin merge. No modificar `main` ni afirmar que el cambio está publicado hasta resolver los checks y contar con aprobación explícita para integrar.
- El endpoint y la pestaña están preparados para informar “Pendiente de configuración” si faltan las variables; los datos reales de Google aún requieren configuración externa.


### 2026-10-20 — Refactor de plantilla (respuesta a revisión de DeepSeek)

- Extraído el HTML completo (incluida la pestaña Google añadida en esta rama) desde el Base64 de `scripts/armar_publico.py` a `templates/tablero.html`.
- El generador ahora carga la plantilla con `Path(__file__).resolve().parent.parent / "templates" / "tablero.html"` y `read_text(encoding="utf-8")`; se elimina la dependencia de Base64 para el HTML.
- Se conserva el marcador único `/*DATOS*/` para inyectar el JSON serializado de datos.
- Validación de transformación: plantilla decodificada desde el blob anterior (47129 caracteres), marcador encontrado una vez; el cambio se hizo solo en `feature/google-metrics-and-project-log`, no en `main`.
- Pendiente obligatorio: ejecutar pruebas reales del generador y comprobar el resultado de GitHub Actions/Vercel. No afirmar que la actualización de medios ni la integración Google estén operativas hasta que pasen.


### 2026-10-20 — Verificación posterior al merge y preparación de PR del refactor

- Se verificó que la PR #2 está cerrada con merge y que el commit de producción registrado es `304e7e09c6ced968fc1867a50eb5b152cef70714`. Los checks de Vercel consultados para ese commit figuran `success`; esto acredita el estado de esos checks, no una prueba funcional de todo el tablero.
- Se confirmó por comparación de refs que `main` no contiene todavía la extracción a `templates/tablero.html`; la rama de trabajo está 3 commits por delante y 1 por detrás de `main`. El cambio del refactor sigue separado de producción.
- Validaciones estáticas ejecutadas sobre los archivos versionados en la rama: JSON válido en `data/notas2.json` (279 registros), `data/rep2.json` (1192), `data/redes2.json` (285), `data/canales.json` (6) y `data/medios.json` (64); plantilla de 47.129 caracteres; marcador `/*DATOS*/` presente exactamente una vez; generador referencia la plantilla externa; serialización mantiene el escape de `</`; pestaña Google y endpoint presentes.
- Se revisó `.github/workflows/actualizar.yml`: antes de copiar el resultado nuevo a `data/rep2.json`, ejecuta `scripts/verificar_historial.py` contra el historial anterior y los nuevos datos. No se ha ejecutado todavía el generador Python real en un entorno local ni una prueba real contra Google/Vercel; no marcar esos puntos como completos.
- Los despliegues Preview identificados como `Blocked` no se pudieron inspeccionar desde las herramientas disponibles: las páginas privadas de Vercel no son accesibles desde esta sesión. La causa queda **sin determinar**. No se cambiaron permisos, protección ni membresías.
- Próximo paso de revisión: abrir una PR nueva para el refactor, dado que la PR #2 ya se fusionó antes de estos commits. La integración a `main` queda pendiente de aprobación explícita y de revisar los checks/resultados.


### 2026-10-20 — Investigación de la falla de generación en GitHub Actions

- Se consultó la lista de ejecuciones de GitHub Actions y el log del job `actualizar`.
- El run `39430700181` (evento `schedule`, commit `1a3c22ba`, iniciado a las 13:28:34 UTC) terminó en `failure`: el paso `Revisar medios y Google Noticias` terminó correctamente y falló `Armar versión pública` con `AttributeError: 'str' object has no attribute 'decode'`. El paso `Guardar` no se ejecutó. URL: https://github.com/ACJ2026/redes-jusnoticias/actions/runs/39430700181
- También falló el run `39428259025` (push, commit `1a3c22ba`) con el mismo error, antes de la integración de la corrección de la PR #2.
- Verificación del archivo actual en `main`: `scripts/armar_publico.py` contiene una sola llamada a `.decode("utf-8")`; no corresponde abrir otra PR para repetir ese arreglo.
- El commit de producción `304e7e09c6ced968fc1867a50eb5b152cef70714` tiene los dos checks de Vercel en `success`, pero esos checks no prueban la ejecución del workflow de actualización.
- La última ejecución de actualización disponible en el historial consultado es anterior al merge de la corrección. No se encontró aún una ejecución posterior que demuestre que el generador termina correctamente con el código corregido. Por tanto, la corrección está presente en `main`, pero su verificación de extremo a extremo sigue pendiente.
- El run `39435202604` de `Pruebas de regresión del historial` en la rama de la PR #3 terminó en `success`; valida esa suite, no el generador completo.
- Diagnóstico de previews Vercel `Blocked`: sigue sin confirmarse la causa, porque no se dispone del detalle privado del deployment. No se modificaron permisos ni protecciones.
- Próxima verificación: comprobar el resultado del próximo run de `actualizar` posterior al merge; si no se inicia automáticamente, ejecutarlo manualmente desde GitHub Actions con modo `completo` y revisar los logs antes de considerar validada la generación. No sobrescribir datos históricos ni afirmar éxito sin un run verde.


## 21/10/2026 — Relevancia de repercusiones y sección territorial

- Se retiró temporalmente de la versión pública la tarjeta «Distribución por localidad» y su lógica asociada. No se publicarán cifras territoriales hasta contar con localidades verificadas y registros enlazados con publicaciones originales comprobables.
- Se endureció la asignación automática de resultados de Google Noticias: además de las validaciones existentes, exige al menos dos coincidencias de título que no sean términos temáticos amplios. Compartir únicamente expresiones genéricas como «mujeres rurales» ya no basta para asociar una noticia a una nota de JusNoticias.
- No se modificaron ni eliminaron filas del historial de repercusiones. Los cambios de código están en la rama `fix/relevancia-territorio`; quedan sujetos a revisión y despliegue.
- Se validó la sintaxis JavaScript de las tres plantillas/salidas HTML modificadas y se confirmó que ya no quedan referencias a la tarjeta territorial retirada.


## 21/10/2026 — Corrección de coincidencias históricas sobre mujeres rurales

- Se revisó la nota 14851, «El Poder Judicial presenta su campaña audiovisual sobre mujeres rurales».
- Se marcaron como **Baja / relación no verificada** 17 registros procedentes de Google Noticias que coincidían por temática, incluidos Caracol Radio y Radio Sintonía. Se conservaron los enlaces y las filas para auditoría; al tener confianza baja, quedan excluidos de las cifras de publicaciones confirmadas.
- Se incorporó una regla permanente en `scripts/actualizar.py` para que esas asociaciones históricas no vuelvan a contarse como confirmadas tras consolidar el historial.
- Se sincronizaron `data/rep2.json`, `publico/index.html` y `publico/tablero_publico.html`, y se agregó una prueba de regresión.
- Validación realizada: 17/17 registros identificados en el HTML público y el JSON fuente figuran con confianza Baja; ambos HTML están sincronizados y el JavaScript público pasa validación de sintaxis. La URL pública no pudo verificarse desde esta sesión; queda pendiente confirmar que Cloudflare haya desplegado la actualización.


## 21/10/2026 — Incidente repetido: portada pública con indicadores «—»

**Síntoma**
- En `https://jusnoticias.pages.dev/`, la portada volvió a mostrar guiones en el período y los tres indicadores, y el acceso al tablero no respondía.

**Causa raíz**
- La plantilla vigente `templates/tablero.html` esperaba un objeto JSON con las claves `notas`, `repercusion`, `redes`, `canales`, `medios`, `actualizado` y `datos_actualizados`.
- Los archivos publicados `publico/index.html` y `publico/tablero_publico.html` seguían conteniendo un array antiguo de repercusiones, no el objeto esperado. Al ejecutar `D.notas.map(...)`/operaciones equivalentes sobre esa estructura, el JavaScript fallaba durante la inicialización antes de actualizar la portada y registrar el botón de entrada.
- El workflow de actualización solo se disparaba por cambios en `scripts/actualizar.py` o `data/fuentes_descubiertas.json`; no se ejecutaba al cambiar `templates/tablero.html` o `scripts/armar_publico.py`. La prueba de sincronización ya existente detectaba la diferencia, pero no se ejecutaba porque faltaba un disparador para esos cambios.

**Solución aplicada**
- Regenerados `publico/index.html` y `publico/tablero_publico.html` desde la plantilla actual y los cinco JSON fuente, manteniendo intactos los datos históricos.
- Se añadió `.github/workflows/reconstruir-publico.yml`, dedicado a regenerar, validar y guardar el HTML cuando cambian la plantilla o el generador; no ejecuta el relevamiento ni modifica los históricos.
- Se agregó una prueba que exige la existencia del workflow y verifica que invoque el generador y la suite de regresión.

**Prevención**
- Mantener la prueba `test_plantilla_y_archivos_publicos_estan_sincronizados`: valida que el JSON embebido coincida con los datos fuente y que los dos HTML sean idénticos.
- El workflow de reconstrucción queda disparado por cambios en `templates/tablero.html`, `scripts/armar_publico.py` y la propia prueba de sincronización.
- No considerar resuelto en producción hasta comprobar el deploy de Cloudflare Pages y abrir la portada con los indicadores cargados.

**Verificación de esta intervención**
- Revisión estática: 280 notas, 1.222 repercusiones, 285 registros de redes, 8 canales y 88 medios serializados en la estructura esperada.
- El HTML generado conserva un único marcador de plantilla antes de la sustitución y deja de incrustar el array antiguo.
- **Estado final: resuelto.** El usuario confirmó el 21/10/2026 que la portada volvió a funcionar tras la regeneración de los HTML públicos. Se da por validada la corrección funcional en producción.
- La comprobación automática de GitHub Actions no quedó accesible desde esta sesión; la confirmación funcional del usuario se registra como verificación final.


### 2026-10-21 — Fuentes reales de tráfico y explicación de métricas de búsqueda

- Rama de trabajo: `feature/fuentes-reales-y-ayuda-buscadores`, creada desde `main`; no se modificó `main` ni se declaró un despliegue.
- Se amplió `functions/api/google-metrics.js` para consultar en GA4 las dimensiones reales `sessionSource` y `sessionMedium`, además de sesiones, vistas y usuarios. El endpoint devuelve las fuentes efectivamente registradas, ordenadas por visitas, y una clasificación orientativa en buscador, red social, asistente de IA, otro sitio, acceso directo, origen sin identificar u otra fuente.
- La tabla conserva y muestra la fuente y el medio originales que entrega GA4. Si el tráfico no puede atribuirse, no se asigna a una plataforma por suposición. La API puede tener demora; no equivale a medición en tiempo real segundo a segundo.
- Se incorporó en la plantilla una tabla “Fuentes concretas de las visitas” y traducciones al español para canales y dispositivos. Las tablas de Search Console explican el porcentaje de clics (ejemplo: 50 clics de 1.000 apariciones = 5 %) y que la posición promedio es el lugar medio del resultado, donde 1 es el primer puesto.
- Pendiente: ejecutar pruebas estáticas y de regresión; comprobar el endpoint con credenciales reales; confirmar el resultado en el entorno de Cloudflare Pages. No se considera validada la conexión hasta completar esas pruebas.


### 2026-10-21 — Prueba de acceso a la API REST pública de WordPress

- Se comprobó manualmente que la API REST pública de `https://jusnoticias.juschubut.gov.ar` responde sin iniciar sesión ni modificar WordPress.
- El endpoint de publicaciones con `per_page=100` y campos `id,date,modified,link,title,categories,featured_media` devolvió numerosas entradas en la página 1. La consulta con `page=2` también devolvió registros, incluidos ejemplos publicados entre mayo y agosto de 2026; queda confirmada la paginación básica.
- Campos observados: ID de WordPress, fecha de publicación, fecha de modificación, enlace, título, categorías e ID de imagen destacada. El ID de WordPress es la clave estable recomendada para deduplicar y actualizar notas.
- Observaciones para el integrador: existen entradas con título vacío o compuesto solo por espacios, algunas de categoría `415`; no deben incorporarse como noticias normales sin validación, pero tampoco provocar el borrado de historial. También hay notas con `modified` posterior a `date`; una modificación no debe tratarse como publicación nueva.
- Alcance de la verificación: se confirmó acceso público y consulta de páginas sucesivas. No se comprobó todavía el total de páginas mediante encabezados, ni se ejecutó una integración de extremo a extremo con el recolector, el historial y el HTML público.
- Próximos pasos: revisar cómo el recolector obtiene hoy las notas; integrar WordPress si corresponde como fuente de notas usando paginación completa e ID estable; conservar el historial de repercusiones ante errores o ausencias temporales; agregar pruebas y validar GitHub Actions y Cloudflare Pages antes de declarar la integración operativa.
- Dependencias externas: para esta prueba de lectura pública no se necesita usuario, contraseña, token ni plugin de WordPress. Las métricas de Google Analytics 4/Search Console son una integración distinta y siguen dependiendo de la configuración/credenciales correspondientes en Cloudflare Pages.
- No se modificó WordPress ni se cambiaron datos históricos. Esta anotación se prepara en una rama separada; no implica despliegue ni integración a `main`.


### 2026-10-21 — Cierre de verificación de WordPress y estado de automatizaciones

- Se pasó a revisión y se integró el PR [#34](https://github.com/ACJ2026/redes-jusnoticias/pull/34), que registra la prueba manual de la API REST pública de WordPress. El merge fue confirmado por GitHub con commit `c0fdb2ee0ed17f2179135432ea240793f9aa8fe3`. La bitácora ya forma parte de `main`; el cambio fue documental y no modificó el recolector ni los datos históricos.
- Los workflows de validación del PR #34 terminaron en `success`: [validación del tablero](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/39658653007) y [regresión del historial](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/39658652668).
- El workflow [Reconstruir tablero público](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/39655358080) terminó en `success` para el commit `915c9c65a3ceb885ef342d2d931e0df444e7a308). Esto confirma la generación automatizada del HTML y sus comprobaciones de CI; no prueba por sí solo que las funciones de Google y redes devuelvan datos reales en producción.
- La plantilla fuente tiene el título `Juschubut Noticias`. La verificación directa del dominio público y de los endpoints Pages no pudo completarse desde las herramientas disponibles en esta sesión.
- Pendientes externos: comprobar el despliegue real en Cloudflare Pages y revisar la respuesta de `/api/google-metrics` y `/api/redes` en producción. Para Google se requieren las variables `GOOGLE_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID` y `GSC_SITE_URL`, más permisos de lectura de la cuenta de servicio. Para redes, revisar los secretos e IDs correspondientes en el entorno Pages.
- No se alteró WordPress, no se reconstruyeron ni borraron registros históricos y no se declaró validación de extremo a extremo.


### 2026-10-22/23 — Ampliación del tablero y del monitoreo (PR #51 a #64)

Todos integrados a `main` con validaciones en verde (salvo lo indicado sobre #64). Sitio: https://jusnoticias.pages.dev

| PR | Fecha (hora argentina) | Qué se hizo |
|---|---|---|
| [#51](https://github.com/ACJ2026/redes-jusnoticias/pull/51) | 22/10 19:07 | Facebook separado por página; canales actualizados. |
| [#52](https://github.com/ACJ2026/redes-jusnoticias/pull/52) | 22/10 19:18 | YouTube: el canal **Poder Judicial del Chubut** es el único canal propio (se quitó "JusNoticias Prensa"). Textos de "Cómo leerlo" actualizados. |
| [#53](https://github.com/ACJ2026/redes-jusnoticias/pull/53) | 22/10 19:57 | Visitas y buscadores: cada página de las tablas de Analytics/Search Console tiene su enlace. |
| [#54](https://github.com/ACJ2026/redes-jusnoticias/pull/54) | 22/10 20:07 | Tarjeta "Dónde se publicaron nuestras notas" (territorio por sede del medio). |
| [#56](https://github.com/ACJ2026/redes-jusnoticias/pull/56) | 22/10 20:08 | Versión celular a tamaño real (meta viewport) y rankings del resumen con enlaces. |
| [#57](https://github.com/ACJ2026/redes-jusnoticias/pull/57) | 22/10 20:12 | Territorio: cada ciudad abre sus medios, cada uno con su enlace. |
| [#55](https://github.com/ACJ2026/redes-jusnoticias/pull/55) | 22/10 20:15 | `data/cuentas_monitoreo.json`: 89 cuentas oficiales de medios en redes, 21 dudosas y compartidos confirmados a mano desde Chrome (solo lectura, sin publicar nada). |
| [#59](https://github.com/ACJ2026/redes-jusnoticias/pull/59) | 22/10 20:24 | Monitoreo ampliado: Bing Noticias además de Google Noticias, medios WordPress descubiertos automáticamente, rotación de dominios descubiertos, filtro de medios extranjeros (`EXTRANJERO`) y unificación de nombres por dominio (`MEDIO_POR_DOMINIO`). |
| [#58](https://github.com/ACJ2026/redes-jusnoticias/pull/58) | 22/10 20:25 | Sección "Quién compartió nuestras notas en redes" + `functions/api/compartidos.js` (Instagram business_discovery y búsqueda en YouTube). |
| [#60](https://github.com/ACJ2026/redes-jusnoticias/pull/60) | 22/10 23:03 | Generador de infografías: cuestionario previo (período o nota, datos, formato Instagram/historia/X, título), vista previa idéntica a la exportación, descarga PNG y texto alternativo. La descarga no funciona dentro del artifact de Claude: usar jusnoticias.pages.dev. |
| [#61](https://github.com/ACJ2026/redes-jusnoticias/pull/61) | 23/10 07:57 | Botones de acción destacados (consultar, buscar, generar, descargar). |
| [#62](https://github.com/ACJ2026/redes-jusnoticias/pull/62) | 23/10 08:25 | Una sola fecha visible: "Datos actualizados al … (hora argentina)". |
| [#63](https://github.com/ACJ2026/redes-jusnoticias/pull/63) | 23/10 08:53 | (rama `mejora/resumen-fecha-unica`) Fecha unificada al pie del tablero. |
| [#64](https://github.com/ACJ2026/redes-jusnoticias/pull/64) | 23/10 09:13 | Título de la nota destacado antes del enlace externo. Cambió el texto de la fecha a "Última actualización del relevamiento:" sin actualizar dos pruebas: `validar` y `reconstruir` quedaron en rojo en `main` (commit `3d98fe5`). Se corrige en la entrada siguiente. |

**Reglas acordadas con el usuario en estas sesiones**
- Todo medio, cuenta, publicación o nota que se muestre lleva su enlace.
- Desde el 23/10, Claude mergea automáticamente sus propios PR cuando pasan `validar`, `pruebas-historial` y Cloudflare Pages y no hay conflictos, y avisa en una línea. Excepción: cambios en la lógica de datos (por ejemplo el PR #65) se presentan para revisión antes de fusionar.
- Nunca borrar filas del historial; siempre combinar.
- No mostrar ni escribir valores de tokens o claves; el usuario carga las credenciales.
- No hacer compras (créditos de la API de X: decisión del usuario).

**Sincronización programada:** tarea `trig_01LregLCh1KHPhZLRa9MKhBo` (cada 2 h, 08:25–20:25 hora argentina). Corridas del 22/10 20:35 (1.236 filas) y 23/10 08:35 (1.281 filas): sin notas nuevas; se actualizaron el tablero interno (https://claude.ai/artifact/Xdyyf8Y5c1jXh5qLWkR2JW) y el público (https://claude.ai/artifact/M9EJxQHCUWKkcg2Y2ZC784).

**Pendientes de verificación en producción**
- Botón "Buscar ahora en Instagram y YouTube": nunca se probó con credenciales reales de Meta.
- Analytics/Search Console: el usuario cargó las credenciales y se redesplegó; falta confirmar que devuelve datos.


### 2026-10-23 — Pruebas alineadas con el texto de fecha del #64

- Se ajustaron dos aserciones de `tests/test_tablero_publico.py` al texto vigente ("Última actualización del relevamiento:" y "las métricas de redes y Google se consultan por separado"). No cambia la plantilla ni los datos.
- Mismo ajuste incluido en el PR #65 (commit `d4d06d8`); al mergear ambos no hay conflicto.


### 2026-10-23 — Identidad de publicaciones por URL e inventario único de medios (PR #65)

- PR: https://github.com/ACJ2026/redes-jusnoticias/pull/65 — rama `claude/identidad-publicaciones`. Vista previa: https://claude-identidad-publicacion.jusnoticias.pages.dev
- Pedido del usuario (con criterio sugerido por GPT): trabajar en rama nueva, normalizar URLs, no perder historial ni regenerar `rep2`/`medios` de forma destructiva, probar y **presentar el diff para revisión antes de fusionar o desplegar**. No se mergea automáticamente.

**Antes**
- Identidad por par (nota, medio): un segundo artículo del mismo medio sobre la misma nota se descartaba en silencio.
- A veces quedaba el enlace de Google Noticias en vez del enlace al medio.
- El verificador de historial solo controlaba pares.
- `medios.json` → "notas" contaba filas.
- Datos de cada medio repartidos entre `fuentes_descubiertas.json`, `cuentas_monitoreo.json` y la tabla `localidadMedio` de la plantilla.

**Ahora**
- `scripts/historial.py`: `normalizar_url` (http/https, www, barra final, fragmento, utm/fbclid/gclid, AMP), `deduplicar_publicaciones` (una fila por URL directa; enlaces de buscador como `url_alternativas`), `marcar_secundarias` (un artículo confirmado por medio y nota; el resto queda Baja con la marca "otro artículo del mismo medio (por revisar)"). `conservar_historial` y `publicaciones_faltantes` también trabajan por URL.
- `medios.json` → "notas" cuenta notas distintas.
- Nuevo `scripts/armar_inventario.py` → `data/medios_inventario.json`: 94 medios (42 lectura directa, 28 solo buscadores, 22 solo historial, 2 temporalmente no disponibles; 3 grupos de alias unificados; 28 con localidad por verificar; 10 sin dominio). Campos manuales protegidos con `_manual`. Se regenera en `actualizar.yml` después de cada relevamiento.
- El tablero toma la localidad del inventario (`D.localidades`), con `localidadMedio` como respaldo.

**Verificación**
- Pruebas: unittest (62) y node (32) OK; CI del PR en verde (`validar`, `pruebas-historial`, Cloudflare Pages).
- Con los datos actuales, los números visibles del tablero son idénticos entre `main` y la rama (comparación con Playwright, octubre y todo el período).
- Relevamiento real de prueba (workflow temporal, sin guardar datos): filas 1.281 → 1.408; confirmadas 781 → 809. Los 29 pares que pasan a confirmados no son pares nuevos: tenían solo una fila Baja y ahora aparece el artículo correcto en Alta (ej.: Radio 3, código procesal no penal, nota 14725; Mario Vivas honoris causa, nota 14624). 14 artículos quedan "por revisar". Verificador de historial OK.

**Próximas ideas (sin empezar, requieren OK del usuario):** alertas de Google por RSS, prueba de GDELT, canales de YouTube de radios y TV, revisión manual mensual por muestreo, logo en infografías, ficha de nota en A4/PDF.


### 2026-10-23 — Cierre del PR #65 y auditoría de PR abiertos

- El usuario revisó y autorizó el PR #65; se integró a `main` (squash `e9e0ec9`) con `validar`, `pruebas-historial` y Cloudflare Pages en verde y sin conflictos. Desde el próximo relevamiento rigen la identidad por URL, las publicaciones "por revisar" y el inventario `data/medios_inventario.json`.
- Aclaración sobre alias: El Diario Web, Examedia y LM Neuquén son tres medios distintos; cada uno aparecía también con el nombre que asigna Google Noticias (el dominio). Se agrupan porque comparten dominio; las filas de `rep2.json` conservan su nombre original.
- Auditoría (solo lectura) de los PR abiertos de Codex #47, #45, #46, #37, #36, #43 y #44 contra `main`: seis tienen conflictos (solo #36 entra limpio). Recomendación entregada: cerrar con explicación #46 y #43 (rescatando IDs de páginas e información de X/TikTok), extraer de #37 los listados en vivo de Instagram y YouTube (ojo: su handle por defecto es el canal retirado `@jusnoticiasprensa2865`), actualizar #47 sin X (consulta cada 5 min), #36 con datos vigentes y #44 tras confirmar que la página pública del canal muestra seguidores, y esperar #45 hasta comprobar si X Analytics permite exportar CSV sin pagar.
- El usuario decidió que GPT/Codex se encarga de esos siete PR. Regla sugerida para ambos asistentes: leer esta bitácora, revisar `main`, ramas y PR abiertos, no trabajar sobre `main`, comparar con lo integrado y ejecutar `python3 -m unittest discover -s tests` antes de proponer un merge; no mergear con pruebas en rojo.


### 2026-10-23 — Enlaces directos de publicaciones y botón «Buscar ahora» (PR #69)

- Se corrigió el criterio de enlaces: el posteo de una cuenta de redes solo se enlaza como publicación cuando existe una URL directa guardada. La nota oficial de JusNoticias y la página/perfil general del medio son referencias distintas; no se presentan como si fueran el post compartido.
- En las filas históricas sin URL directa, Facebook y TikTok ofrecen una búsqueda asistida, rotulada explícitamente como pendiente de verificar. Esa búsqueda no se confunde con una publicación confirmada ni importa resultados automáticamente. Cuando no hay URL directa ni una búsqueda asistida aplicable, se indica que falta verificar el enlace.
- La tabla «Quién compartió nuestras notas en redes» incluye Facebook, Instagram, YouTube y TikTok (sin X, por decisión del usuario), separa el enlace a la publicación concreta del enlace a la nota de JusNoticias y muestra enlaces directos cuando están guardados.
- Se conserva el botón «Buscar ahora»: llama a `/api/compartidos`, ejecuta las búsquedas automáticas de Instagram y YouTube, informa errores por fuente y prepara búsquedas asistidas para Facebook y TikTok. No se amplían los permisos de API ni se simula una importación automática.
- Auditoría del historial leído en esta rama: `data/redes2.json` contiene 285 registros; 18 son de otras cuentas y ninguno de esos 18 tiene URL directa guardada. Por eso el código no puede reconstruir los enlaces antiguos a publicaciones concretas sin volver a localizarlas y verificarlas. No se inventaron URLs ni se reescribió el historial.
- Pruebas actualizadas para exigir esta separación entre enlace directo y búsqueda asistida. Falta confirmar el resultado de CI y probar «Buscar ahora» en Preview con credenciales reales; esta intervención no despliega a producción.


### 2026-10-23 — Enlaces a las notas publicadas por los medios (continuación del PR #69)

- La tabla de «Quién compartió nuestras notas en redes» ahora separa tres destinos: el post social directo, la nota publicada en el sitio del medio y la nota original de JusNoticias.
- Se añadieron a `data/redes2.json` campos `url_sitio` para ocho registros con enlaces de artículos del mismo medio verificados: Canal 12 Web, Canal 4 Esquel, Del Mar Digital (dos notas), El Comodorense, Diario Jornada, Comodoro 24 y FM Bahía Engaño. Estos enlaces corresponden a artículos en sus sitios web; no se etiquetan como posteos de Facebook.
- Si no hay enlace directo guardado al sitio del medio, la tabla ofrece una búsqueda web marcada como pendiente de verificar. Se excluyen enlaces de Google News RSS como si fueran la nota directa del medio.
- Se corrigió el alcance de la función que resuelve el ID de la nota para que la tabla pueda dibujarse sin una referencia fuera de ámbito.
- El historial todavía no contiene URL directas de los posteos sociales para los 17 registros históricos de Facebook ni para el registro de X (X queda excluido del panel por decisión del usuario). Los posteos directos de Facebook no se han podido confirmar con la búsqueda web; la tabla ofrece búsquedas asistidas en lugar de inventar enlaces. El artículo del sitio web del medio se conserva como una fuente distinta.
- Se actualizan las pruebas para la nueva columna, las URL de sitio y las búsquedas pendientes. Se regeneraron `publico/index.html` y `publico/tablero_publico.html` desde la plantilla y los datos, y se comprobó que ambas copias coinciden. La ejecución de CI anterior había fallado únicamente en la prueba de sincronización antes de regenerar estos archivos; los workflows no devolvieron aún una ejecución asociada al SHA más reciente. Sigue pendiente probar «Buscar ahora» en Preview con credenciales reales. No se desplegó a producción.


### 2026-10-23 — Actualización coordinada de estadísticas y corrección de disparadores (PR #78 y seguimiento)

- Incidencia: las secciones estadísticas podían conservar sus cifras cuando no aparecían nuevas publicaciones; además, el workflow de relevamiento no se disparaba ante todos los cambios relevantes de código/datos.
- PR #78 se integró a `main`: amplió los disparadores del workflow `.github/workflows/actualizar.yml`. Revisión posterior detectó que incluir archivos generados por el propio relevamiento (`data/rep2.json`, `data/notas2.json`, `data/medios.json`, inventario y sello de fecha) como disparadores de ese mismo workflow podía provocar ejecuciones repetidas.
- Seguimiento en la rama `fix/dashboard-refresh-loop-and-log`: el workflow de relevamiento queda limitado a cambios del recolector, el inventariador, el propio workflow y la configuración de fuentes. Conserva el cron de cada dos horas y reconstruye el tablero en la misma ejecución que procesa el monitoreo.
- El workflow independiente `.github/workflows/reconstruir-publico.yml` se amplía para reconstruir el HTML cuando cambian los JSON de entrada, el inventario, las cuentas monitoreadas o `data/actualizado.txt`. Como no escucha cambios en los HTML generados, evita un bucle de reconstrucción.
- Se agregaron pruebas para exigir que los cambios de datos regeneren el tablero y que los datos generados no disparen un nuevo relevamiento.
- No se modificaron cifras históricas ni se fabricaron publicaciones. Si el barrido no encuentra cambios, las cantidades pueden seguir iguales; la fecha solo debe avanzar cuando el relevamiento haya terminado correctamente.
- Estado: PR #78 y el seguimiento PR #81 están integrados en `main`. En PR #81, las pruebas de regresión del historial y el workflow `Validar tablero y fuentes de tráfico` terminaron en `success` (run `39993799502` y `39993799358`). La revisión de código confirmó que los datos generados ya no disparan otro relevamiento y que los cambios de datos activan la reconstrucción pública. Sigue pendiente comprobar una ejecución completa del relevamiento posterior al cambio y confirmar que la web pública refleja el resultado; no se declara validación de extremo a extremo ni despliegue confirmado.

- Estado: PR #78 está integrado. Este seguimiento queda sujeto a CI y revisión antes de integrarse. Aún falta comprobar una ejecución completa posterior al cambio y confirmar que la web pública refleja el resultado; no se declara validación de extremo a extremo ni despliegue confirmado.

### 2026-10-23 (tarde) — Cobertura del recolector: no perder medios que difundieron nuestras notas

**Origen.** El usuario comparó una búsqueda de Google sobre la nota 14873 (homeschooling, Puerto Madryn) con lo que tenía el tablero. Faltaban ADN Sur y Comodoro 24 (que se leen directo), FM de la Cordillera y Madryn Urbana (no registrados), un segundo artículo de Vivo Trelew y publicaciones en redes de otros medios (Jornada en Instagram, FM Tropical en Facebook, El Caletense en Instagram, entrevista de LU20 en YouTube). Causa de fondo: el recolector comparaba **solo títulos** y descartaba sin leer los artículos con título reescrito. No era una caída: era un límite de diseño presente desde el inicio. Lección registrada: probar cada cambio del recolector contra una búsqueda real antes de presentarlo.

**PR [#70](https://github.com/ACJ2026/redes-jusnoticias/pull/70)** (mergeado tras revisión del usuario)
- Segunda oportunidad por texto: los títulos «cerca» del umbral se leen y se aceptan solo con evidencia fuerte (copia, reescritura o mención de JusNoticias). La primera versión (3+ frases en común) sumaba 108 coincidencias dudosas y se endureció.
- Se agregaron FM de la Cordillera y Madryn Urbana a `data/fuentes_descubiertas.json`; son WordPress y pasan a lectura directa.
- Primera aplicación real (corrida manual 13:15): 1.453 publicaciones, 840 confirmadas, 35 encontradas por texto. La corrida posterior al merge chocó con una corrida programada y no guardó (comportamiento seguro, sin pérdida); se relanzó a mano.

**PR [#76](https://github.com/ACJ2026/redes-jusnoticias/pull/76)** (mergeado tras revisión del usuario)
- Lectura del texto de todo lo publicado en los últimos 10 días por los sitios WordPress y por ADN Sur/EQS (hasta 200 por corrida, primero lo más nuevo). Cada artículo se lee una sola vez: `data/textos_revisados.json` (revisados + candidatos por datos).
- Dos criterios: frases iguales (20 %+ → confirmado) y datos poco comunes coincidentes ponderados por rareza (25 %+ → «por revisar», no suma).
- Filtro de notas genéricas: más de 4 candidatos por datos para una nota en la ventana → se omiten (en el diagnóstico, «Octubre Rosa» generaba ~40 falsos).
- Cada candidato guarda `motivo` (frases en común, puntaje y palabras coincidentes).
- Tercera frase de búsqueda en Google Noticias: una cita textual de la nota o su tercera oración.
- Revisión manual: `data/revision_manual.json` confirma o descarta por enlace, nunca borra filas y registra en la fila `revision_manual` (decisión, quién, fecha, motivo).
- Prueba real: 8.599 artículos leídos; confirmadas 812 → 838; apareció el artículo de Comodoro 24 sobre la nota 14873. La primera corrida tarda ~40 min; las siguientes, lo habitual.
- Límite conocido: el artículo de ADN Sur sobre la nota 14873 todavía no se detectó (su título comparte una sola palabra larga con la nota).

**PR [#77](https://github.com/ACJ2026/redes-jusnoticias/pull/77)** (mergeado tras revisión del usuario)
- Las fuentes por índice (ADN Sur, EQS, La Opinión Austral, LU17, La Tecla, ABC Diario, El Extremo Sur, La Vanguardia) ya no se declaran «Revisión completa» si su índice no respondió: figuran como «Sin datos: el índice del sitio no respondió».
- `data/estado_medios.json`: última revisión correcta, último fallo, fallos seguidos y alerta (lectura directa sin revisión correcta en más de 24 h). El tablero lo muestra en Guía → Inventario de medios.

**Decisiones del usuario**
- Seguir el criterio de GPT: ampliar la detección pero contar solo lo verificable; umbral bajo solo para «por revisar»; nada se aprueba automáticamente como reescritura.
- Los resultados de Google Noticias encontrados por frase de la nota **siguen contando** como confianza media por ahora (aunque a veces solo haya enlace de Google).
- Los 7 PR viejos de Codex (#36, #37, #43–#47) los resuelve GPT/Codex directamente; la auditoría y la regla de trabajo quedaron en la entrada anterior.
- «Amolkair» (sugerencia de la IA de Google) no corresponde a ninguna nota: se descartó.

**No se puede automatizar (se informó al usuario):** cobertura del 100 %; placas (imágenes) en redes de otros medios; publicaciones de Facebook de terceros con las credenciales actuales; formulario de carga manual en el sitio estático (requeriría desarrollo aparte).

**Pendientes**
- Verificar las corridas posteriores a #76 y #77 y que `data/textos_revisados.json` y `data/estado_medios.json` se guarden.
- Revisar en unas semanas la calidad de los «por revisar» por datos para decidir si alguno pasa a contar.
- Seguir si ADN Sur 14873 aparece cuando se complete la lectura de su sitemap.
- Pendientes previos sin cambios: botón de Instagram/YouTube con credenciales reales de Meta, datos de Google Analytics/Search Console, 28 localidades por verificar, decisión sobre X (exportar CSV de X Analytics sin pagar).


### 2026-10-23 (cierre) — Primera corrida con lectura de texto completo y arreglo de pruebas (PR #83)

- La corrida posterior a #76 falló en las regresiones y no guardó: dos pruebas agregadas hoy (`test_enlaces_directos_verificados_quedan_asociados_a_sus_registros` y `test_enlace_directo_el_patagonico_peugeot`) buscaban filas por su clave `pN`, que se renumera en cada relevamiento; al sumarse publicaciones, las claves se corrieron. **PR [#83](https://github.com/ACJ2026/redes-jusnoticias/pull/83)**: las pruebas buscan por nota y medio (y por URL en El Patagónico). Regla: **no identificar filas de `rep2.json` por su clave `pN`**.
- También se cerró sin mergear el #80 (reversión de #78) porque #81 de GPT resolvió los disparadores del workflow.
- Corrida manual de las 14:26 (17 min): guardó correctamente. 284 notas, 1.464 publicaciones, 844 confirmadas; 37 confirmadas por texto y 9 «por revisar» por coincidencia de datos (cada una con su `motivo`). `data/textos_revisados.json` con 8.627 artículos leídos; `data/estado_medios.json` creado.
- Primera auditoría de medios: en alerta Atento Chubut, El Diario Web, El Extremo Sur, LU17, Metadata Noticias y Rio Negro (fallaron en esta corrida y no tienen revisión correcta registrada aún; revisar si persiste).
- Nota 14913 (Panigadi, 23/10): Canal 12 (confirmada), El Chubut (media) y Cholila Online (por revisar). Nota 14873: Comodoro 24 entra «por revisar» por datos (39 %).
- Tableros de Claude sincronizados (interno: repercusión v25, medios v24; público v26).


### 2026-10-24 — PR #85: lenguaje simple y ayuda por sección del tablero

- Se fusionó el PR [#85](https://github.com/ACJ2026/redes-jusnoticias/pull/85) en `main` mediante squash. Commit de merge: `7a39687128e55e8c2521a42ebc4ae351060a8849`. HEAD de la rama del PR: `cd4f3b4a85565212f3b0c904c4058fe7bbc2c912`.
- Cambios: `templates/tablero.html` incorpora ayudas breves y opcionales en Resumen, Medios, Notas, Redes, Google y Guía; se aclaran los estados «Verificada» y «A verificar» y se explican límites de interpretación de métricas. Se actualiza `docs/MANUAL_TABLERO.md` y se agrega la prueba `test_ayuda_breve_en_cada_seccion_del_tablero` en `tests/test_tablero_publico.py`.
- CI del PR: aprobados «Pruebas de regresión del historial» y «Validar tablero y fuentes de tráfico». Vista previa de Cloudflare Pages informada como exitosa para el commit del PR: https://2a0f20c7.jusnoticias.pages.dev/.
- Alcance de la verificación: se confirmó que el cambio quedó en `main`; no se modificaron datos históricos. La vista previa fue desplegada, pero no se confirmó desde esta sesión un despliegue de producción posterior al merge ni una prueba visual/interactiva en móvil. No declarar esos puntos como verificados.
- Próximo paso: comprobar el despliegue de producción de Cloudflare Pages y abrir el tablero en móvil para revisar presentación y funcionamiento.
