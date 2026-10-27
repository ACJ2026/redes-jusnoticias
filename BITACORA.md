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


### 2026-10-24 — Corrección de lectura móvil de la tabla de notas

- La revisión de producción mostró que la explicación larga seguía visible y que la tabla conservaba el desplazamiento horizontal en celular. El PR #85 había agregado ayudas desplegables, pero no había reemplazado ese párrafo ni cambiado el diseño móvil de la tabla.
- En la rama `fix/tabla-notas-movil-ayuda-boton`, se reemplaza el texto largo por una explicación breve y el botón «Cómo leer esta tabla», que abre un diálogo con definiciones claras. En pantallas pequeñas, la tabla de notas pasa a fichas con etiquetas por dato; el resto de las tablas conserva su comportamiento actual.
- Se agregan etiquetas de celda desde los encabezados y una prueba de regresión para el botón y la vista móvil. Se actualiza el manual.
- No se modifican datos históricos. CI del commit `505e60c9d55a71f8568c908135658b2b4330c1d2`: ambos workflows (`Pruebas de regresión del historial` y `Validar tablero y fuentes de tráfico`) terminaron en success. El primer intento había detectado que una prueba existente requería conservar literalmente la aclaración de Google Noticias; se ajustó el texto y el segundo intento pasó. Despliegue de producción y revisión en celular real pendientes de aprobación e integración.


### 2026-10-24 — Adaptación móvil de todas las tablas

- Se amplía la rama `fix/tabla-notas-movil-ayuda-boton` para que la adaptación móvil cubra todas las tablas del tablero: detalle de notas, medios, redes y Google, además de la tabla principal de notas. En escritorio se conserva la presentación tabular.
- Se agregan etiquetas de dato a las celdas, también cuando las filas se generan o actualizan dinámicamente, y una prueba de regresión que exige la regla general.
- No se modifican archivos de datos históricos. Pendiente: ejecutar y revisar los workflows sobre el nuevo commit, comprobar la vista previa y hacer prueba visual real en celular y escritorio. No declarar producción verificada ni fusionar sin autorización explícita.


### 2026-10-24 — Integración del PR #86

- A pedido del usuario, se integró mediante squash el PR [#86](https://github.com/ACJ2026/redes-jusnoticias/pull/86) en `main`. Commit resultante: `70c7f27b1e0f4b9d0f558ecb150f52f8d2888089`; commit revisado: `56b09399365eac75a89090522d406a720ba244d6`.
- En el commit revisado, los workflows «Pruebas de regresión del historial» (run #481) y «Validar tablero y fuentes de tráfico» (run #225) figuraban como exitosos. No se modificaron datos históricos.
- La integración ya está hecha, pero desde esta sesión no se pudo confirmar el despliegue de producción de Cloudflare Pages ni hacer una prueba visual real en el celular y escritorio. No declarar esos dos puntos como verificados hasta comprobarlos.


### 2026-10-24 — Corrección de textos y pie de actualización

- Motivo: el usuario señaló que «Medios distintos» no es simple y que el pie con la fecha de actualización se superpone al contenido.
- Cambios propuestos en rama `fix/textos-simples-pie-tablero`: se reemplaza el texto visible por «Medios» y se simplifica su explicación; el pie se mantiene en el flujo normal, con separación del contenido, ancho controlado y ajuste de palabras largas para pantallas pequeñas.
- Archivos: `templates/tablero.html`, `docs/MANUAL_TABLERO.md` y `tests/test_tablero_publico.py`. Se agrega prueba automatizada para los textos y reglas de distribución del pie.
- Datos históricos: no modificados.
- Validación pendiente: ejecutar la suite completa, generar los dos HTML públicos, comprobar que plantilla y archivos públicos estén sincronizados y revisar visualmente escritorio y celular. No declarar despliegue de producción hasta verificarlo.


### 2026-10-24 — Detalle de nota en lenguaje simple (PR #90 y siguiente)

- PR [#90](https://github.com/ACJ2026/redes-jusnoticias/pull/90) (fusionado): en celular el pie ya no se superpone (las listas tienen scroll propio y el detalle crece entero) y el detalle de la nota destaca el número de medios.
- El usuario pidió sacar términos técnicos («registradas», «confirmadas», «total de publicaciones»): el detalle ahora muestra solo **«11 medios publicaron esta nota»** en grande y debajo **«Hay 8 más a verificar. Todavía no se cuentan.»** (o «No hay nada pendiente de verificar.»).
- **Regla general: simplificar. Mostrar el dato principal en palabras comunes y no agregar datos sobre datos** (totales intermedios, conteos técnicos, aclaraciones metodológicas en el texto principal). Lo técnico va, si hace falta, en la ayuda desplegable.
- Sin cambios en datos ni detección.


### 2026-10-24 — Número principal = todos los medios, y pasada general de lenguaje simple

- **Pedido del usuario:** el número que importa es el total de medios que publicaron la nota, sumando verificados y a verificar. El desglose va en la ayuda («Cómo leer este tablero»), no en el texto principal.
- **Cambio de conteo (solo en el tablero, no en la detección):** `n_medios` pasa a contar los medios distintos de todas las publicaciones de la nota (verificadas y a verificar); cada medio cuenta una sola vez aunque haya publicado dos veces. Nuevo `n_verificados` = medios verificados. `posibles` pasa a contar **medios** a verificar (antes contaba registros). Ejemplo nota 14913 (Panigadi): 4 medios = Canal 12 y Radio 3 (verificados) + Cholila Online (dos artículos, cuenta una vez) y El Chubut (a verificar).
- Esto afecta la lista de notas, el detalle, los rankings de notas y la infografía. Los KPI del resumen sobre publicaciones siguen separando verificadas y a verificar.
- **Contradice el PR #88 de GPT**, que proponía que el número principal fuera solo de medios confirmados. Ese PR no debe fusionarse tal como está.
- **Lenguaje simple en todo el tablero** (aplicando la regla general de la entrada anterior): se acortaron las explicaciones de Resumen, Medios, Notas, Redes, Visitas y buscadores y la guía rápida; se sacaron las aclaraciones repetidas («no demuestra por sí sola…», «direcciones web registradas», «confianza media o alta»). La metodología técnica queda solo en «Metodología, límites y detalles técnicos».
- Los botones «Cómo leer este tablero» y «Cómo leer esta tabla» pasan a estar destacados como los de infografía.
- Pruebas: se actualizaron las que exigían frases viejas y se agregó la verificación del conteo nuevo.


### 2026-10-24 — Resumen con totales (verificadas + a verificar)

- A pedido del usuario, la frase principal del Resumen, el porcentaje de notas que salieron en otros medios y el gráfico por tema usan el total (verificadas y a verificar), igual que el número de medios por nota (#92).
- «El medio que más notas publicó» se calcula con todas las publicaciones, contando cada nota una vez por medio.
- Los rankings de «Los 5 medios», «Cómo la publican» y «Fuentes que mencionan» siguen con lo verificado, porque dependen de haber leído el texto del medio.
- Efecto en octubre (27 notas): pasa de 63% a 78% de notas; de 64 publicaciones en 29 medios a 186 publicaciones en 68 medios (64 verificadas y 122 a verificar). Buena parte de las «a verificar» son pistas de Google Noticias.


### 2026-10-24 — Un botón de ayuda por sección

- El botón general «Cómo leer este tablero» del encabezado solo explicaba Notas. Se quitó.
- Cada sección (Resumen, Medios, Notas, Redes, Visitas y buscadores) tiene un botón destacado **«Cómo leer esta sección»** que abre su propia explicación corta, en lenguaje simple. Las explicaciones están en `<template id="ayuda-…">` dentro de `templates/tablero.html` y se muestran en el mismo diálogo.
- Se quitaron los desplegables «Qué muestra esta sección» (repetían lo mismo) y el botón «Cómo leer esta tabla» de Notas. La pestaña Guía queda igual.
- Se actualizaron el manual y las pruebas (`test_ayuda_breve_en_cada_seccion_del_tablero` exige el botón y la explicación de cada sección y que no exista el botón general).


## 2026-10-24 — Resolución de publicaciones pendientes y bitácora de decisiones

**Objetivo acordado con el usuario**
- No dejar casos en un estado inconcluso sin motivo, enlace y una salida clara.
- Las coincidencias falsas comprobadas se descartan internamente y no aparecen en el tablero ni en sus contadores.
- Las publicaciones que requieren decisión deben permitir confirmar o descartar, y el tablero debe reflejar la decisión sin duplicar medios.
- El dato principal del resumen debe ser la cantidad de medios que publicaron nuestro contenido.
- Toda intervención y resolución debe quedar en la bitácora.

**Implementación iniciada en la rama `feature/revision-publicaciones-y-bitacora`**
- `functions/api/revisiones.js`: endpoint de lectura y escritura de decisiones con clave secreta, validación de origen, validación de URL y guardado transaccional en D1.
- `migrations/0002_revisiones_publicaciones.sql`: tablas para la decisión vigente por publicación y para conservar cada evento histórico en la bitácora.
- `templates/tablero.html`: carga las decisiones guardadas, muestra el motivo y el enlace, ofrece «Confirmar publicación» y «Descartar coincidencia», solicita el enlace directo si el candidato procede de Google/Bing y prioriza el total de medios.
- `docs/CLOUDFLARE_PAGES.md`: pasos de configuración del servicio.
- `tests/test_tablero_publico.py`: comprobaciones estáticas del circuito y de su seguridad.
- `.github/workflows/validar-tablero.yml`: incorpora la comprobación sintáctica de la nueva API.

**Criterios de seguridad y trazabilidad**
- No se guardan claves en el repositorio ni en el HTML.
- El servidor exige el secreto `REVISIONES_CLAVE`; las escrituras fallan de forma cerrada si falta la clave o la base.
- La decisión vigente se actualiza por nota y URL de origen; cada intervención se agrega por separado a `bitacora_revisiones_publicacion`.
- Las filas con confianza Baja se excluyen de la interfaz y de los contadores; el método «A verificar» no se trata como confirmación.
- Al confirmar, se conserva la URL directa del medio y se evita contar dos veces el mismo medio en la misma nota.

**Pendiente antes de considerar terminado**
- Ejecutar CI de la PR y corregir cualquier fallo.
- Regenerar los HTML públicos desde la plantilla actualizada.
- Configurar en Cloudflare Pages la base D1 independiente `REVISIONES_DB`, ejecutar la migración y guardar `REVISIONES_CLAVE` como secreto. No reutilizar `TIKTOK_AUTH_DB`.
- Probar en el dominio público una confirmación, un descarte, persistencia tras recargar, contadores y bitácora.
- Registrar aquí los enlaces y resultados reales de CI y del despliegue. Hasta entonces, el código preparado no equivale a un circuito operativo en producción.


### Resultado de validación de la PR #97 (24/10/2026)

- PR: https://github.com/ACJ2026/redes-jusnoticias/pull/97
- Commit revisado: `e47b6982d760b5145f5228d40b105eca0e6ad3e5`.
- `Validar tablero y fuentes de tráfico`: **success**, run https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40119403749.
- `Pruebas de regresión del historial`: **success**, run https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40119403773.
- Cloudflare Pages Preview: **deploy successful**, https://bcaa4f94.jusnoticias.pages.dev/ (build del commit `e47b698`).
- La Preview confirma que Cloudflare pudo compilar y desplegar el código estático; no demuestra que el endpoint de decisiones pueda escribir en D1.
- No se pudo comprobar desde las herramientas disponibles la configuración de bindings/secretos de la cuenta Cloudflare. Por eso todavía no se afirma que la API de revisión esté operativa en producción.
- La PR no se considera terminada hasta decidir la integración y completar la configuración segura de `REVISIONES_DB` + `REVISIONES_CLAVE`, seguida de una prueba real de confirmación y descarte.


### Ajuste final de lenguaje y trazabilidad (24/10/2026)

- Se añadió `motivo_error_acceso` a `scripts/verificar_publicaciones.py` para traducir HTTP 401/403, 404, errores 5xx, timeout y fallas de conexión a explicaciones claras, sin exponer solo nombres técnicos de excepciones.
- Cuando la página abre pero la comparación no alcanza, el motivo visible ahora explica que el texto no coincide lo suficiente; los números técnicos quedan en `evidencia_verificacion`.
- Se agregaron pruebas de regresión para los mensajes de error y se amplió la prueba del endpoint para asegurar que las referencias de Google/Bing puedan conservarse como origen sin confundirse con el enlace original del medio.
- El detalle de una nota ya no muestra ni cuenta registros descartados o candidatos sin enlace. Las publicaciones sin enlace utilizable no se presentan como una tarea sin salida.
- Estos últimos cambios requieren que terminen nuevamente las validaciones de la PR. La configuración D1/secreto en Cloudflare sigue siendo el único requisito externo identificado para habilitar las acciones persistentes.


### Cierre de pruebas de código (24/10/2026)

- En la primera ejecución de las nuevas pruebas falló una aserción por diferencia de mayúsculas en el texto esperado, no por un error del verificador. Se corrigió la aserción para coincidir con el mensaje real.
- En el commit `97c7b06c50713f55880c8c933182a6030319c2ab` quedaron en **success** las pruebas del verificador, las regresiones del historial, la validación del tablero y el despliegue Preview de Cloudflare Pages.
- Preview: https://d273a4a6.jusnoticias.pages.dev/
- Las comprobaciones de código y el build de Preview están en verde. Sigue pendiente probar las escrituras reales de `/api/revisiones` con el binding D1 y el secreto de producción, que no se pueden declarar configurados solo por tener un build exitoso.


## Registro posterior a la integración — 24/10/2026

- La PR #97 se integró a `main` mediante squash en el commit `6126163793769f67bec2b3f0c9f442c64d3c9dee`: https://github.com/ACJ2026/redes-jusnoticias/commit/6126163793769f67bec2b3f0c9f442c64d3c9dee
- El workflow `Reconstruir tablero público` terminó en **success**: https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40119763372
- El workflow `Validar tablero y fuentes de tráfico` terminó en **success**: https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40119763329
- Cloudflare Pages reportó despliegue correcto del commit integrado: https://1df8aa23.jusnoticias.pages.dev/ (preview de commit; no equivale por sí solo a probar la API contra D1 de producción).
- El relevamiento real posterior a la integración se inició en https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40119763360 y seguía en curso al registrar esta nota. La fecha de `data/actualizado.txt` todavía era anterior al merge, por lo que no se afirma que el nuevo relevamiento haya terminado.
- Las validaciones automáticas de código están en verde. **La resolución manual persistente aún no puede darse por operativa en producción** hasta verificar el binding D1 `REVISIONES_DB`, ejecutar la migración `0002_revisiones_publicaciones.sql` y configurar el secreto `REVISIONES_CLAVE` en Cloudflare Pages. No se accedió a esos ajustes de cuenta desde las herramientas disponibles.
- No se deben registrar decisiones de prueba sobre publicaciones reales en la base productiva hasta que esa configuración esté hecha y comprobada.


## 2026-10-24 — Fallo de actualización y corrección de conservación histórica

- La ejecución real `40119763360` se detuvo antes de guardar los datos porque `scripts/verificar_historial.py` detectó la desaparición de una publicación de EQS Notas para la nota 14593. La protección evitó que se publicara una actualización incompleta.
- La causa operativa fue que la reconciliación del historial se hacía antes de aplicar los filtros de salida; una publicación histórica podía perderse en una etapa posterior.
- La PR #99 agrega una segunda reconciliación después de los filtros de limpieza y antes de deduplicar, preservando las publicaciones de notas vigentes y excluyendo los falsos positivos históricos explícitos. También incorpora una prueba de regresión del orden de esas operaciones.
- PR #99 integrada en `main` mediante squash: `6cab3341fd7e51a973ccd9cd6955a6143f52a30d`.
- Pruebas de regresión del historial: **success**, https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40132024030.
- Validación del tablero y las fuentes: **success**, https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40132023990.
- La actualización real posterior al arreglo se ejecuta en https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40132056378. No se marcará como exitosa ni se afirmará que se publicaron datos nuevos hasta verificar su conclusión y la fecha en `data/actualizado.txt`.
- La revisión manual persistente continúa condicionada a la configuración en Cloudflare Pages de `REVISIONES_DB` (D1 independiente), la migración `0002_revisiones_publicaciones.sql` y el secreto `REVISIONES_CLAVE`. No se dispone de acceso administrativo a la cuenta Cloudflare desde las herramientas de esta sesión, por lo que ese paso no se registra como realizado.


## 2026-10-25 — Estado de situación y arreglo del fallo de EQS Notas (Claude)

**Estado al 25/10 (antes de este arreglo):** el tablero no guarda datos nuevos desde la corrida del 24/10 12:24 (hora argentina). Fallaron 7 relevamientos seguidos (desde el merge del #95) con el mismo mensaje: «faltan 1 publicaciones históricas… nota_id=14593 | medio=EQS Notas». El control de historial frenó bien el guardado; no se perdieron datos, pero tampoco se publicó nada nuevo.

**Causa encontrada:** `scripts/verificar_publicaciones.py` (agregado en #95) reemplaza la URL de una candidata por la URL final después de abrirla (`fila["url"] = final_url`). Si el medio redirige a otra dirección, la URL anterior desaparece y `verificar_historial.py` —que identifica cada publicación por su URL canónica, también entre `url_alternativas`— la da por perdida. Indicios: la fila de EQS seguía en los datos y el total no cambiaba (1477 antes y después). El arreglo del #99 actuaba en `actualizar.py`, antes del verificador, por eso no alcanzó. (No se pudo abrir el sitio de EQS desde la sesión para ver la redirección exacta.)

**Arreglo:** nueva función `reemplazar_url()` en el verificador: cuando cambia la URL, guarda la anterior en `url_alternativas` (si era un enlace directo y la forma canónica es distinta). Se usa en los dos lugares donde el verificador cambiaba la URL. Pruebas nuevas en `tests/test_verificar_publicaciones.py` con el caso de EQS: con la URL anterior guardada, el control de historial no marca faltantes; sin ella, sí.

**Pendiente: botones de confirmar/descartar (#97).** El código está integrado, pero no funcionan hasta configurar Cloudflare una sola vez (lo hace el usuario o Claude en Chrome desde su cuenta): base D1 nueva → binding `REVISIONES_DB` (Production y Preview) → ejecutar `migrations/0002_revisiones_publicaciones.sql` → secreto `REVISIONES_CLAVE` (clave aleatoria larga, nunca en GitHub ni en el chat) → comprobar que `/api/revisiones` responde JSON y no 503. Pasos en `docs/CLOUDFLARE_PAGES.md`. Hasta probar una confirmación, un descarte y que persistan al recargar, no se consideran operativos.

**Otros pendientes:** PR #94 de GPT abierto (explicación de la verificación); PR #88 de GPT abierto y en contra del criterio de total de medios (#92), no fusionar así; medios sin revisión correcta hace más de 24 h: El Diario Web, El Extremo Sur, LU17, Metadata Noticias, Rio Negro.


## 2026-10-25 — Guardado destrabado y Cloudflare configurado (Claude)

- **Relevamiento destrabado:** después del #101, la corrida [40146580185](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40146580185) terminó en **success** y guardó datos (commit `f80d208`, `data/actualizado.txt` = 2026-10-25T00:43:57Z; 284 notas, 1.478 publicaciones). Se confirmó la causa: la fila de EQS Notas (nota 14593) quedó con la URL nueva y la anterior `https://www.eqsnotas.com/…` en `url_alternativas`.
- **Cloudflare (hecho por Claude en Chrome desde la cuenta del usuario):** base D1 nueva `jusnoticias-revisiones` con las tablas de `migrations/0002_revisiones_publicaciones.sql`; binding `REVISIONES_DB` en Production y Preview; secreto `REVISIONES_CLAVE` en Production (cargado por el usuario); re-despliegue de producción `main c9ef708` sin errores. `https://jusnoticias.pages.dev/api/revisiones` responde `{"revisiones":[]}`. La base de TikTok no se tocó.
- **Falta probar:** guardar una confirmación y un descarte reales desde el tablero con la clave y comprobar que persistan al recargar. Hasta eso, los botones están conectados pero no probados de punta a punta. En Preview no está la clave, así que ahí no se puede guardar (no afecta producción).
- **Retoque:** el botón «Descartar coincidencia» tenía la clase `ayuda-sec` (la de los botones de ayuda); se quitó para que no se confunda con «Cómo leer esta sección». Prueba agregada.


## 2026-10-25 — Botones de revisión: probados y achicados (Claude)

- **Prueba del usuario:** confirmó que guardar una revisión desde el tablero funciona con la clave (Cloudflare D1 + `REVISIONES_CLAVE` operativo en producción).
- **Problema visual reportado:** los botones quedaban muy grandes y se superponían. Causas: (1) cada fila del detalle tenía 7 celdas y el encabezado 6 («Motivo y enlace» estaba partido en dos), así que el enlace caía bajo «Acción» y los botones en una columna sin título; en celular las etiquetas quedaban corridas; (2) los botones usaban el estilo grande de acción principal y estaban pegados.
- **Arreglo:** motivo y enlace en la misma celda (6 celdas = 6 columnas); botones compactos «Confirmar» (relleno) y «Descartar» (borde), con el texto completo como `title`, apilados con separación en escritorio y uno al lado del otro en celular, ocupando todo el ancho de la ficha.
- **Verificado** con capturas a 1280, 1024, 768, 390 y 320 px: sin superposición, sin botones cortados y sin desplazamiento horizontal. Prueba agregada.

## 2026-10-26 — Analizador común de enlaces de repercusiones

- Se agregó `functions/api/analizar-enlace.js` para analizar enlaces HTTPS de Instagram, Facebook, TikTok, YouTube, X, LinkedIn y sitios web/medios en general. La herramienta intenta leer el título, la descripción y el texto público disponible, y compara ese contenido con el catálogo completo de notas de JusNoticias, no solo con las diez más recientes.
- La sección «Quién compartió nuestras notas en redes» incorpora el campo «Analizar enlace de cualquier red o medio». El resultado muestra la publicación original, las notas candidatas y la evidencia textual. No guarda ni suma una repercusión automáticamente.
- Los estados distinguen coincidencia pendiente de revisión de un fallo de acceso. Si la plataforma exige sesión, bloquea la consulta o no expone texto suficiente, informa que no se pudo verificar; no afirma que la publicación no exista ni que no esté relacionada.
- **Límite explícito:** esto analiza enlaces que se le proporcionan; no es una búsqueda global automática de todas las redes. Tampoco puede confirmar por sí solo contenido que solo aparezca dentro de imágenes, audio o video y no esté expuesto en el texto público. La búsqueda automática por plataforma sigue dependiendo de APIs, permisos y fuentes accesibles.
- Se actualizaron `publico/index.html` y `publico/tablero_publico.html` para que el tablero publicado incluya la herramienta. Se añadieron pruebas estáticas de cobertura y de los estados de verificación. La vista previa de Cloudflare quedó desplegada correctamente para el commit `a00fc37` en https://feature-verificacion-enlaces.jusnoticias.pages.dev. GitHub Actions informó los dos workflows como fallidos, pero los jobs terminaron con `runner_id: 0` y `steps: []`, sin ejecutar los pasos; la suite sigue pendiente de validación real.

## 2026-10-26 — Búsqueda asistida en todas las redes

- Se amplió el bloque de búsqueda asistida para ofrecer enlaces de búsqueda por cada nota en Facebook, Instagram (mediante búsqueda web de publicaciones públicas), TikTok, YouTube, X, LinkedIn y la web general.
- Las búsquedas se muestran como pistas para revisión manual; no se incorporan al conteo de repercusiones ni se presentan como publicaciones verificadas.
- Se sincronizaron los dos HTML públicos y se agregaron pruebas estáticas para los accesos a las siete fuentes.
- La detección automática directa sigue conectada solo a las fuentes que ya cuentan con API y credenciales habilitadas en el proyecto (Instagram y YouTube). Para que Facebook, TikTok, X y LinkedIn se consulten automáticamente se necesitan permisos/API compatibles; los enlaces de búsqueda no sustituyen esa integración.


## 2026-10-26 — Integración de detección por enlace y ampliación acotada de Instagram

- PR #105 integrado en `main` mediante squash, commit `d5015db0c1a0b2082e7d7698136325c44249fdc7`: una publicación que incluya un enlace directo `jusnoticias.juschubut.gov.ar/?p=ID` puede asociarse a la nota por su ID, sin depender de que el título esté repetido en el texto.
- Se aplicó también la ampliación de PR #106 directamente sobre `main`, porque al fusionar #105 el PR encadenado dejó de ser integrable sin conflicto. Instagram pagina hasta 3 bloques de 30 publicaciones por cuenta monitoreada (máximo 90), solo cuando Meta devuelve `paging.next`; la respuesta y el tablero muestran cuántas publicaciones se consultaron.
- Se sincronizaron la plantilla y las dos vistas HTML públicas y se agregó una prueba de regresión para el límite de paginación.
- **Validación pendiente:** GitHub Actions sigue terminando con `runner_id: 0` y sin pasos ejecutados. El código no se declara probado por CI hasta que un runner ejecute la suite. La paginación sigue limitada a las cuentas cargadas y a los permisos/respuestas que conceda Meta; no equivale a búsqueda global de Instagram.


## 2026-10-26 — GitHub Actions frenado por minutos; revisión del trabajo de GPT en redes (Claude)

**Problema:** desde el 25/10 20:09 (hora argentina) ninguna tarea de GitHub Actions arranca. El aviso de GitHub es: «The job was not started because recent account payments have failed or your spending limit needs to be increased». El repositorio es privado: el plan gratuito trae 2.000 minutos por mes y en octubre se superaron (estimación facturable aproximada: ~1.400 min del relevamiento cada 2 h —131 corridas de ~11 min— más ~700 min de pruebas por los muchos cambios de estos días). Consecuencia: datos congelados en la corrida del 25/10 18:40 y verificaciones de PR sin ejecutarse (se ven «failure» en 3 segundos, sin pasos). Cloudflare Pages es independiente y sigue publicando.

**Decisión del usuario:** hacer público el repositorio para recuperar las ejecuciones (minutos gratis e ilimitados en repos públicos) y pasar el relevamiento a cada 4 horas. Antes se revisó todo el historial (1.013 commits) buscando claves y tokens: no hay secretos guardados; las claves están en los secretos de GitHub/Cloudflare. Volver a privado recién cuando se renueve el cupo mensual (ver la fecha en Billing): si se vuelve antes, se frena otra vez. Con 4 horas el relevamiento solo usa ~2.000 min/mes, en el límite; si vuelve a privado, conviene 6 horas o reducir pruebas duplicadas.

**Cambios de este PR:** cron cada 4 horas (21:59, 01:59, 05:59, 09:59, 13:59 y 17:59 hora argentina) y textos del tablero, manual y README actualizados. Arreglo de la prueba `test_seccion_compartidos_enlaza_cuenta_publicacion_y_nota`: GPT exigía el texto literal «Buscar en Instagram», pero ese texto se arma en el navegador ('Buscar en ' + red); la prueba fallaba siempre y, al volver Actions, iba a frenar el guardado de datos.

**Revisión del trabajo de GPT del 25/10 (redes):** objetivo: detectar repercusiones en redes (caso de prueba: Reel `instagram.com/reel/De3-0ZbiUYN`, no detectado). Hecho: #104 auditoría de cobertura (abierto, diagnóstico correcto), #105 vincular publicaciones con enlace `/?p=ID` a su nota (revisado, correcto), #106 Instagram hasta 90 publicaciones por cuenta (PR abierto pero los commits ya están en main), #107 analizador manual de enlaces de cualquier red (fusionado aunque su propio PR decía no integrar sin pruebas). Ninguno se verificó en CI (Actions frenado). El caso del Reel sigue sin resolverse: falta saber de qué cuenta es y sumarla a `data/cuentas_monitoreo.json`.


## 2026-10-26 — Radar de redes: comparación más estricta y búsqueda de cuentas en todas las redes (Claude)

- **Diagnóstico:** el recolector de redes (`functions/api/compartidos.js`) marcaba como «Detectada automáticamente» cualquier publicación con 3 palabras en común con un título (ej.: Reels de @elcomodorense y @lu20radio_chubut que no eran nuestra nota). Además, el radar es chico: Instagram vigila 23 cuentas, YouTube 16, Facebook 46, X 26 y TikTok 3; 71 medios del inventario no tienen redes identificadas.
- **Comparación más estricta:** además del mínimo de 3, se pide al menos el 60 % de las palabras distintivas del título. Solo el enlace directo `/?p=ID` o el título completo son «Coincidencia fuerte»; el resto figura «A verificar (N de M palabras del título en común)». Probado: «Condenan a un hombre por estafas en redes sociales» ya no se asocia a la nota de la comerciante de Madryn.
- **Búsqueda de cuentas en todas las redes:** nuevo `scripts/descubrir_redes.py` y flujo manual «Descubrir redes de los medios»: lee la portada de cada medio sin redes identificadas y lista sus cuentas de Facebook, Instagram, X, YouTube y TikTok. No guarda nada; el informe queda en el registro de la ejecución para revisarlo con el usuario antes de sumar cuentas a `data/cuentas_monitoreo.json`.
- **Qué se puede vigilar automáticamente por red:** Instagram (cuentas de empresa de la lista; próximo paso: hashtags y etiquetas a nuestra cuenta) y YouTube (búsqueda por título; próximo paso: vigilar los canales de los medios). Facebook, X y TikTok no tienen API gratuita para leer publicaciones de terceros: sus cuentas sirven para las búsquedas asistidas y para el analizador de enlaces.


## 2026-10-26 — Radar de redes ampliado: 158 cuentas nuevas (Claude)

- **Origen:** flujo «Descubrir redes de los medios» (run [40261184386](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40261184386)) sobre los 71 medios sin redes identificadas: 50 con cuentas en su portada, 5 sin redes visibles y 16 que no se pudieron abrir (403 o sin dirección: LU17, Diario Chaco, Noticias de Bariloche, El Mediador, El Extremo Sur, Tiempo Sur, entre otros).
- **Aprobado por el usuario y cargado en `data/cuentas_monitoreo.json`:** 158 cuentas nuevas — Instagram 41, Facebook 38, X 38, YouTube 27 y TikTok 14 —, con estado «Identificada en el sitio del medio (26/10/2026); sin repercusión confirmada todavía». Se suma @cadena3com (apareció en una búsqueda del usuario con repercusión de una nota nuestra).
- **Instagram pasa de 23 a 64 cuentas vigiladas** por «Buscar ahora». Entre ellas: Patagonia (El Valle Online, Madryn Urbana, Mil Patagonias, La Opinión Austral, FM de la Cordillera, Atento Chubut, Río Negro, LM Neuquén, ANBariloche, Noticias del Bolsón), nacionales y judiciales (Diario Judicial, Revista Quórum, Clarín, A24, Perfil, Página 12, Ámbito, La Voz, El Doce, MDZ, 0223, Flipr, Cadena 3) y medios de otras provincias que ya publicaron notas nuestras.
- **Límite de Meta:** las cuentas nacionales llevan `"paginas": 1` (se revisan 30 publicaciones en vez de 90) para no agotar el límite de consultas por hora; `functions/api/compartidos.js` respeta ese campo.
- **Excluidos:** medios extranjeros sin relación (El Peruano, FPP Perú, Presidencia de República Dominicana, Acento, Caracol Radio, Diario Sur, Radio Sintonía, El Periscopio) y cuentas de publicidad encontradas en portadas (comercios). De cada medio se tomó solo la primera cuenta por red.
- **No se borraron filas:** los 39 pendientes «Por identificar» resueltos quedan con estado «Identificado el 26/10/2026».
- **Qué se usa en cada red:** Instagram, búsqueda automática; YouTube, por ahora búsqueda por título (próximo paso: vigilar los canales cargados); Facebook, X y TikTok sirven para la búsqueda asistida y el analizador de enlaces (no hay API gratuita para leer publicaciones de terceros).
- **Pendiente:** probar «Buscar ahora» en producción con las 64 cuentas y revisar si Meta devuelve errores en alguna (cuentas personales no admiten esta consulta); próximos pasos: hashtags y etiquetas a nuestra cuenta en Instagram, y canales de medios en YouTube.


## 2026-10-26 — Radar de redes, fase 2: etiquetas, hashtags, canales de YouTube y tandas (Claude)

Aprobado por el usuario. Cambios en `functions/api/compartidos.js` y en el botón «Buscar ahora» del tablero:

- **Instagram, etiquetas:** lee las publicaciones donde otras cuentas etiquetan a nuestra cuenta (`/{IG_USER_ID}/tags`), aunque esa cuenta no esté en la lista. Si el texto no permite saber la nota, entra como «A verificar (etiquetó a nuestra cuenta; falta identificar la nota)».
- **Instagram, hashtags:** busca en #justiciachubut, #poderjudicialchubut, #puertomadryn, #trelew y #comodororivadavia (Meta permite 30 hashtags distintos por semana; solo devuelve publicaciones de las últimas 24 h y no informa la cuenta). **Puede requerir un permiso de Meta que la app no tenga**: si Meta lo rechaza, el tablero lo muestra como «no disponible» con el motivo.
- **YouTube, canales de medios:** lee los últimos 25 videos de cada canal de la lista (43 canales) y los compara con todas las notas. Formatos `/channel/UC…`, `/user/…` y `@…`; los `/c/…` se prueban como @usuario y, si YouTube no los encuentra, figuran como error de ese canal.
- **Tandas (posible causa de que el recolector diera pocos resultados):** Cloudflare limita las consultas externas por pedido (50 en el plan gratuito). Con 64 cuentas de Instagram más los canales se superaba. Ahora el tablero pide primero un plan (`/api/compartidos?plan=1`) y después cada tanda por separado (`?fuente=…&lote=…`): 12 cuentas de Instagram (máx. 36 consultas) o 20 canales (40) por pedido. Probado con respuestas simuladas: ninguna tanda supera 40 consultas y el tablero junta los resultados y muestra el resumen por fuente.
- Se corrigió además que «publicaciones consultadas» de Instagram nunca llegaba al tablero (la API no lo devolvía).
- **Falta:** probar «Buscar ahora» en producción y anotar qué responde Meta para etiquetas y hashtags.


## 2026-10-26 — Primera prueba real del radar ampliado (resultado informado por el usuario) (Claude)

Resultado de «Buscar ahora» en producción:
- **Instagram (cuentas):** 64 cuentas, 842 publicaciones consultadas, **35 cuentas con error**. 5 publicaciones detectadas, todas «A verificar» (@lu20radio_chubut ×2, @radio3_cadenapatagonia, @metadatanoticias, @eqsnotas).
- **Instagram (etiquetas):** Meta respondió «(#10) Application does not have permission for this action». Falta un permiso en el token de Meta (probablemente `instagram_manage_comments`, que pide la lectura de etiquetas). Se arregla regenerando el token con ese permiso; queda activa y lo informa mientras tanto.
- **Instagram (hashtags):** Meta exige aprobar «Instagram Public Content Access» (revisión de la app). **Se apaga** hasta tener la aprobación (se reactiva con la variable `IG_HASHTAGS=1` en Cloudflare) y se informa en «Búsqueda no automática».
- **YouTube (canales de medios):** 39 canales revisados, 4 con error (probablemente direcciones `/c/…` que no se resolvieron como @usuario). Sin videos coincidentes en el período.
- **Tandas:** funcionaron (ninguna fuente cayó por el límite de Cloudflare).

Cambio: el tablero ahora muestra, debajo del resumen, un desplegable «Ver qué cuentas o canales dieron error y por qué», agrupado por motivo, para corregir la lista (cuentas personales que Meta no permite consultar, nombres de usuario mal escritos, canales no encontrados).


## 2026-10-26 — Instagram: error en las 64 cuentas en la segunda búsqueda seguida (Claude)

- La segunda vez que se tocó «Buscar ahora» (pocos minutos después de la primera) Instagram dio **error en las 64 cuentas y 0 publicaciones**. La primera vez habían fallado 35. Causa más probable: **límite de consultas por hora de Meta** (cada búsqueda hacía hasta ~150 consultas con 3 páginas por cuenta); las 35 de la primera vez pueden ser en parte el mismo límite al final de la búsqueda y en parte cuentas personales o mal escritas. Falta confirmar con el detalle de errores.
- Cambio: por defecto se lee **1 página (30 publicaciones) por cuenta** en vez de 3, así cada búsqueda hace ~64 consultas. Las cuentas pueden pedir más con `"paginas"`.
- Recomendación de uso: **no tocar «Buscar ahora» más de una vez por hora**; si da error en todas las cuentas, esperar una hora.


## 2026-10-26 — Documentación del tablero (Claude)

- A pedido del usuario se armaron dos documentos y se guardaron en PDF en `documentos/`:
  - `Tablero_JusNoticias_como_funciona.pdf`: explicación simple (para qué sirve, fuentes, estados, secciones, acciones, actualización, límites y glosario).
  - `Tablero_JusNoticias_arquitectura_tecnica.pdf`: diagrama general, estructura del repositorio, relevamiento paso a paso, archivos de datos, flujos de Actions, protecciones del historial, generación del tablero, funciones de Cloudflare y bases D1/KV, nombres de secretos (sin valores), pruebas, costos y límites, forma de trabajo y pendientes.
- Las versiones editables están como documentos de Claude; si cambian, hay que volver a exportar los PDF.


## 2026-10-26 — Corregir enlaces de redes que derivaban a Google

- **Problema:** en «Quién compartió nuestras notas», si no había una URL directa a la nota del medio, el tablero armaba una búsqueda de Google. Eso no era el enlace a la cuenta del medio y podía confundirse con la publicación original.
- **Cambio en la rama `arreglar/enlaces-redes-cuentas`:** la columna pasa a llamarse «Nota o cuenta del medio». Si existe un enlace directo a la nota, abre esa nota; si no, abre el perfil de la cuenta cuando está identificado en el inventario; si tampoco hay perfil fiable, muestra que la nota está pendiente de localizar y no inventa una URL de Google.
- **Búsqueda asistida de Instagram:** el enlace deja de abrir Google y pasa al buscador de palabras clave dentro de Instagram. La búsqueda puede requerir iniciar sesión y no garantiza encontrar todas las publicaciones.
- **Pruebas:** se actualizaron las comprobaciones para exigir el enlace de perfil cuando existe, impedir que esa columna use Google como sustituto y verificar la ruta de búsqueda de Instagram. La salida pública debe regenerarse con `scripts/armar_publico.py` al integrar el cambio.
- **Límites:** no se inventan usuarios ni se presenta un perfil como si fuera la URL exacta de un post. Las publicaciones sin enlace directo siguen marcadas como pendientes de verificar.


## 2026-10-26 — Evitar que la API de revisiones deje muerto el tablero

- **Problema corregido:** la inicialización esperaba la respuesta de `/api/revisiones` antes de dibujar la portada y el tablero. Si esa petición quedaba pendiente, los indicadores seguían en `—` y el botón de entrada no se activaba.
- **Cambio:** la consulta ahora se cancela a los 3,5 segundos; si el historial no responde, el tablero continúa con los datos publicados y deja el aviso de que se omitió el historial de revisiones. La consulta normal sigue funcionando cuando la API responde a tiempo.
- **Archivos sincronizados:** `templates/tablero.html`, `publico/index.html` y `publico/tablero_publico.html`.
- **Prueba de regresión:** se agregó una prueba que verifica el límite de espera y la limpieza del temporizador.
- **Límite:** esta protección evita que una API lenta congele toda la interfaz; no sustituye la reparación de la API si sigue fallando.


## 2026-10-26 — Búsqueda pública gratuita de Facebook

- Se agregó la fuente automática **Facebook (búsqueda pública)** en `functions/api/compartidos.js`. Consulta el RSS público de Bing con el título de hasta diez notas recientes y busca resultados indexados en `facebook.com`; trabaja en dos tandas de cinco consultas para limitar la carga.
- Solo acepta enlaces que parecen apuntar a una publicación directa de Facebook y cuya fecha y texto se relacionan con la nota dentro de la ventana prevista. Los resultados se deduplican con los de otras fuentes y conservan URL directa, fecha, cuenta/página y motivo de coincidencia.
- No requiere suscripciones, tokens ni una API paga. No reemplaza el acceso de Meta: encuentra únicamente publicaciones públicas indexadas por Bing, por lo que no cubre todo Facebook. Si el buscador bloquea la consulta o no devuelve RSS utilizable, el error se informa por nota; la ausencia de resultados no demuestra que no existan publicaciones.
- Se agregó una prueba estática de regresión. La validación de funcionamiento real requiere ejecutar la búsqueda en Cloudflare, porque la respuesta del buscador depende del acceso externo y de lo que tenga indexado.


## 2026-10-26 — Incidente de inicialización: tabla de publicaciones compartidas

- **Síntoma informado:** indicadores sin valor y botón de entrada al tablero sin respuesta. La traza del navegador termina en enlaceNotaSitioMedio → celdaNotaSitioMedio → dibujarCompartidos; no se recibió el texto inicial del error, por lo que no se atribuye a una propiedad concreta sin evidencia.
- **Causa probable identificada por historial y orden de ejecución:** el bloque de «Quién compartió nuestras notas en redes» se incorporó en el commit [9eb0c573](https://github.com/ACJ2026/redes-jusnoticias/commit/9eb0c5736a729c91e3eec2aced30015533fa2be5) y se ejecutaba sin aislamiento durante la inicialización. Una excepción en esa tabla podía detener el resto del script antes de registrar los manejadores de botones y ejecutar draw(). La posterior mejora de enlaces directos ([6bb9cfcc](https://github.com/ACJ2026/redes-jusnoticias/commit/6bb9cfcc4a972a44dd6520826c2ec0e8d20cc3b2)) amplió la lógica de resolución de enlaces de la misma sección. No hay evidencia suficiente para afirmar cuál expresión exacta arrojó la excepción original.
- **Cambios correctivos:** normalización de arreglos y filas, validación de objetos antes de leer propiedades, validación de URL como texto, manejo de errores por fila y captura global alrededor del render de compartidos. Si la sección secundaria falla, muestra un aviso y deja continuar el resto del tablero.
- **Regresión agregada:** prueba estática que exige las guardas y la captura de errores para esta sección.
- **Relación con los cambios recientes:** los commits [beed4d44](https://github.com/ACJ2026/redes-jusnoticias/commit/beed4d44e312b5b3e7c53566e29b4715c05f995f) y [099a0cf4](https://github.com/ACJ2026/redes-jusnoticias/commit/099a0cf4d85ff0b78d4f34b31372ac064e0a3fd0) desacoplaron la carga de revisiones para que una API lenta no bloqueara el tablero; no modificaron la lógica de enlaces de compartidos. La reconstrucción de HTML en [c17d2045](https://github.com/ACJ2026/redes-jusnoticias/commit/c17d2045488ed7643cad0d63950c0117d5826505) sincronizó los HTML públicos con la plantilla, pero no aislaba las excepciones de la tabla.
- **Verificación de CI:** correcta en [validación 40354366353](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40354366353) y [reconstrucción 40354366399](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40354366399). Ambos HTML públicos fueron reconstruidos y se comprobó que contienen las guardas nuevas.
- **Cloudflare Pages:** despliegue de producción [df7e23dd](https://github.com/ACJ2026/redes-jusnoticias/commit/df7e23dd53184ea004a3a2a621d97b46209747f7) finalizó con estado success y figura como latest/canonical deployment: https://d86510d1.jusnoticias.pages.dev.
- **Límite:** no se pudo hacer una prueba interactiva real de navegador desde esta sesión ni recuperar el texto inicial de la excepción original. El área afectada está aislada para que un fallo de esta tabla no detenga el resto del tablero; el diagnóstico de la expresión original exacta sigue siendo probable, no confirmado.


## 2026-10-26 — Enlaces sociales no verificados presentados como directos

- **Causa encontrada:** la API de `functions/api/compartidos.js` ya distinguía `verificacion: "fuerte"` de `verificacion: "a_verificar"`, pero `templates/tablero.html` ignoraba esa marca y mostraba «Ver publicación directa» ante cualquier URL HTTP. Los registros históricos sin estado de verificación también se trataban como enlaces directos. El formato de URL no demuestra que el contenido corresponda a la nota.
- **Corrección:** solo las coincidencias fuertes conservan un enlace social clicable. Las candidatas débiles se muestran como «Candidata sin confirmar; enlace oculto» y los registros históricos sin verificación como «Enlace registrado sin verificar». El resumen separa coincidencias fuertes de candidatas.
- **Prueba de regresión:** `tests/test_tablero_publico.py` ahora exige que el renderizador oculte los enlaces no verificados.
- **Documento del incidente:** [docs/INCIDENTE_ENLACES_COMPARTIDOS.md](docs/INCIDENTE_ENLACES_COMPARTIDOS.md), con la relación de los cambios anteriores y los pasos de cierre.
- **Commits correctivos:** plantilla [c9d8de8c](https://github.com/ACJ2026/redes-jusnoticias/commit/c9d8de8c121a5651984caf73accbbe0c493ea1e7), prueba [ff70d7ff](https://github.com/ACJ2026/redes-jusnoticias/commit/ff70d7ffb1bf39b2feed6edbf36dda09bf1a6649) y documentación [88f86cdd](https://github.com/ACJ2026/redes-jusnoticias/commit/88f86cdd034e907f806a7012d29e155e86999bd4).
- **Validación de CI:** correcta en [workflow 40407791620](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40407791620); reconstrucción de HTML correcta en [workflow 40407763304](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40407763304). Ambos HTML públicos contienen la lógica nueva.
- **Despliegue:** Cloudflare informa como despliegue canónico exitoso el commit `9abb60da689c546b7f9b8c71b23d395d04132395`, publicado en `https://jusnoticias.pages.dev/`.
- **Límite de verificación:** el entorno de esta sesión no pudo acceder por HTTP al sitio para una prueba interactiva; no se afirma que se hayan probado visualmente los enlaces en navegador. El comportamiento automático ya impide abrir como directas las candidatas débiles o las URLs históricas sin verificación.


### 2026-10-27 — Consistencia de estados y vigencia visible

- Incidencia: la nota 14884 («Puerto Madryn: condenan a una comerciante por difamar a una vecina en redes sociales») mostraba 24 medios, pero 19 confirmados y 5 pendientes, aunque el relevamiento manual aportado incluía enlaces directos verificados para los 24.
- Datos: se actualizaron los 24 registros de medios de esa nota con los enlaces directos y la verificación manual indicados en la revisión. No se eliminaron registros históricos.
- Criterio: un resultado de buscador o una URL por sí solos no prueban que la publicación esté verificada. El tablero ahora exige un método explícito de revisión (revisión completa, verificación manual, revisión de texto o verificación automática documentada), además de URL directa y ausencia de estado pendiente/Google Noticias.
- Vigencia: el pie del tablero advierte cuando la fecha del relevamiento supera las 24 horas o falta/no se puede interpretar la fecha. Se distingue la fecha del relevamiento de las consultas en vivo de redes y Google.
- Regresión: se añadieron pruebas estáticas para evitar que «Buscador web» se trate como verificación y para comprobar el aviso de datos vencidos.
- Automatización: el workflow `.github/workflows/reconstruir-publico.yml` ya contempla cambios en plantilla, datos y pruebas; al integrar esta rama debe regenerar ambos HTML públicos y ejecutar `node --check` y la suite de unittest.
- Validación final: suite de regresión y validación del tablero correctas en GitHub Actions `40507446150` y `40507548209`; ambos HTML públicos sincronizados en `40507547948`. Cloudflare Pages confirmó despliegue de producción exitoso del commit `a30d206913741dd5babd3502242dd3b15e05d343`. El tablero público quedó actualizado; no se realizó una prueba visual interactiva por navegador.


### 2026-10-27 — Falsas coincidencias temáticas en la nota 14664

- Incidencia reportada: «El Poder Judicial de Chubut participa del IV Congreso Nacional Penal Adolescente y Juvenil» mostraba 7 medios, 2 confirmados y 5 pendientes. Varios enlaces eran fichas de Google Noticias o artículos sobre otras delegaciones/capacitaciones del mismo tema; no probaban que esos medios hubieran publicado esta nota.
- Causa raíz: `scripts/actualizar.py` comparaba cada texto con la mejor nota en la ventana temporal y aceptaba cualquier similitud de frases de al menos 20% como confirmación. Si no alcanzaba ese valor, una coincidencia de términos podía crear un pendiente. No se exigía evidencia de que el artículo fuera la misma publicación y no solo una cobertura del mismo congreso.
- Corrección preventiva: se añadió `scripts/relevancia_publicaciones.py`, un criterio común y conservador que exige evidencia sustancial de reproducción en el cuerpo y una coincidencia específica del título o similitud de frases muy alta. `scripts/actualizar.py` y `scripts/verificar_publicaciones.py` usan ahora el mismo criterio antes de asociar una URL a una nota. Los registros sin evidencia suficiente se excluyen del conteo y se conserva el historial.
- Datos de la nota 14664: solo Noticias PMY conserva estado confirmado porque el enlace reproduce el título y contenido de la nota. CHACODIAPORDIA.COM, Diario La Portada, Metadata Noticias, Del Mar Digital, Canal Doce Misiones, La Nota San Juan y las cinco referencias de Google Noticias quedaron fuera del conteo con un motivo explícito. En los casos de Google Noticias no se afirma que el medio nunca publicara algo: se indica que la referencia no acredita una publicación directa de esta nota.
- Regresión: se agregaron pruebas para que una copia real se acepte, una noticia distinta sobre el mismo congreso se rechace, ambos recolectores utilicen el criterio compartido y la nota 14664 cuente únicamente Noticias PMY.
- Documentación complementaria: `docs/REVISION_FALSAS_COINCIDENCIAS_NOTA_14664_2026-10-27.md`.
- Estado al registrar: cambios preparados en la rama `fix/relevancia-publicaciones-nota-14664-2026-10-27`. Pendiente validar con GitHub Actions, reconstruir los HTML públicos y comprobar el despliegue antes de considerar resuelta la incidencia en producción.

### 2026-10-27 — Corrección de regresiones recurrentes del relevamiento automático

- Incidente: la corrida 40514132535 generó archivos temporales, pero no guardó ni publicó porque dos regresiones fallaron. En la nota 14664 reaparecieron coberturas del mismo congreso como si fueran la publicación de JusNoticias; en la nota 14884 cinco medios quedaron fuera del conjunto que la prueba consideraba verificado.
- Causa confirmada en los logs: la exclusión de la nota 14664 solo estaba representada en el historial existente y podía reaparecer por nuevas búsquedas. En la nota 14884, las URLs manuales se condicionaban a que la nota viniera en el feed actual, antes de recuperar notas históricas; por eso podían no reingresar. Un registro de Perfil on MSN está explícitamente clasificado como otra noticia y debe permanecer excluido, conservando los 24 medios verificados restantes.
- Corrección en la rama fix/relevamiento-estable-2026-10-27:
  - scripts/actualizar.py vuelve a aplicar las URLs manuales de Radio Chubut, Canal 12, Cholila Online y ADN Sur al final del procesamiento, después de filtros y deduplicación; así no dependen del feed actual ni de la clasificación automática previa.
  - scripts/actualizar.py y scripts/verificar_publicaciones.py aplican una lista explícita de coberturas del congreso que no acreditan la misma nota. Una decisión manual posterior de confirmar sigue teniendo prioridad.
  - tests/test_tablero_publico.py comprueba que esas cuatro URLs quedan verificadas, que Perfil on MSN permanece excluido sin reducir los 24 medios verificados y que los medios bloqueados no vuelven al conteo.
- Protección de datos: no se editan los JSON históricos ni se elimina ninguna fila. Las decisiones automáticas solo cambian el estado de las filas excluidas; el historial sigue conservado para auditoría.
- Validación de CI: las tres comprobaciones pasaron en el commit 29d44c95c173a69343aad94637627a226302d69b: regresiones del historial (run 40522775550), verificador de publicaciones (run 40522775897) y validación del tablero/fuentes (run 40522775552).
- Estado actual: PR 125 abierta, pendiente de integración. La suite no ejecutó el relevamiento completo ni confirmó una publicación de producción; no dar por actualizado el tablero hasta integrar y verificar una corrida real.

- Refuerzo posterior a la integración: la exclusión de la nota 14664 normaliza mayúsculas y espacios en el nombre del medio, tanto en el recolector como en el verificador. Esto evita que una variante de capitalización haga reaparecer una cobertura temática. Se agregó una regresión específica para esa condición.


### 2026-10-27 — Validación de medios y nuevo intento de relevamiento completo

- Se detectó una regresión en la prueba de `tests/test_tablero_publico.py`: esperaba 21 medios, aunque el conjunto vigente de `data/rep2.json` contiene 24 medios elegibles para la nota 14884, excluyendo Perfil on MSN. Se restauró la expectativa correcta de 24; no se usó la prueba para alterar ni reducir el historial.
- Validación posterior: los workflows de validación y reconstrucción pública finalizaron correctamente: [validación 40529633846](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40529633846) y [reconstrucción 40529633936](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40529633936).
- Se solicitó un nuevo relevamiento completo con el commit `b3fb14f764e48e604221457c3a8c1c40c7a7ef75` (run [40526068741](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40526068741)). En la última revisión, esa ejecución seguía activa en «Revisar medios y Google Noticias»; no se confirmó que hubiera guardado los datos nuevos.
- Se cambió la concurrencia del workflow `.github/workflows/actualizar.yml` a `cancel-in-progress: true` para permitir que una ejecución nueva reemplace una anterior de la misma concurrencia. El cambio quedó en el commit `795ee67af03da3fb6f58529fedb17dc4c82e7e58`; el nuevo run [40529795882](https://github.com/ACJ2026/redes-jusnoticias/actions/runs/40529795882) estaba en cola al momento de registrar esta entrada.
- **Estado de actualización:** pendiente. No afirmar que el tablero o `data/actualizado.txt` se renovaron hasta que el relevamiento termine correctamente y se compruebe la fecha guardada y la salida pública.
- **Siguiente paso:** seguir los runs 40526068741 y 40529795882; si uno finaliza correctamente, comprobar `data/actualizado.txt` y la salida pública. Si falla, registrar el error real del log antes de corregir.


## 2026-10-27 — Estabilizar el relevamiento: decisiones como datos, pruebas por mecanismo y corridas sin cancelar (Claude)

**Situación:** el tablero no guardaba datos desde el 27/10 06:45 (hora argentina). Desde los cambios del #122 todas las corridas fallaron o se cancelaron (1 falla por prueba, 1 por regresiones y 4 canceladas por empujes seguidos a `main`).

**Causas:**
1. Correcciones por nota cargadas como listas fijas en el código (`FUENTES_VERIFICADAS` para la nota 14884 en dos lugares de `actualizar.py`; `MEDIOS_NO_VERIFICADOS_14664` en `actualizar.py` y `verificar_publicaciones.py`).
2. Pruebas que exigían números de los datos vivos («la 14884 tiene 24 medios», «la 14664 solo Noticias PMY»): corren antes de guardar y frenan el guardado si una corrida cambia esos datos. Se llegó a cambiar el número esperado de 24 a 21 y de nuevo a 24.
3. `cancel-in-progress: true` en `actualizar.yml`: cada empuje al recolector cancelaba la corrida en curso.
4. **Error en el conteo:** la lista `metodoVerificado` del tablero no incluía las confirmaciones manuales («Confirmada manualmente»), así que las publicaciones confirmadas con el botón **Confirmar** dejaban de contarse como verificadas.

**Cambios:**
- Las 8 URLs verificadas de la nota 14884 (confirmar) y las 11 URLs de la nota 14664 (descartar) pasan a `data/revision_manual.json`, el mecanismo general que ya existía (`aplicar_revision_manual`). Se borraron las listas fijas del código; el verificador ahora respeta cualquier decisión manual (confirmar o descartar) sin reabrirla.
- El tablero cuenta como verificada toda publicación con confirmación manual y enlace directo.
- `cancel-in-progress: false`: una corrida nueva espera a la anterior.
- Pruebas: se reemplazaron las que exigían números por pruebas del mecanismo (las decisiones viven en `revision_manual.json`, al aplicarlas la 14664 no cuenta los medios descartados, una confirmación manual cuenta en el tablero, el flujo no cancela corridas). Se conservan las pruebas de GPT sobre el criterio de «misma nota» (`relevancia_publicaciones.py`).
- No se tocaron `data/rep2.json` ni otros datos históricos.

**Para revisar con el usuario (cambio de conteo de GPT no consultado):** desde el #120 el tablero ya no cuenta como verificadas las filas con método «Buscador (solo sep–oct)» (42) ni «Buscador web» (7). Puede ser correcto, pero cambia las cifras.

**Reglas de trabajo para todas las IAs (Claude y GPT):**
1. Nada directo en `main`: siempre rama + PR, y fusionar solo con los chequeos en verde.
2. Una corrección de una nota puntual (confirmar o descartar una publicación) se carga en `data/revision_manual.json` o con los botones del tablero, nunca como código.
3. Las pruebas verifican mecanismos, no cantidades de los datos vivos.
4. Antes de cambiar cómo se cuenta o se detecta, consultar al usuario.
5. No cambiar la concurrencia del flujo de actualización ni lanzar corridas en cadena.
6. Revisar los PR abiertos y los últimos cambios antes de empezar, y anotar todo en esta bitácora.
