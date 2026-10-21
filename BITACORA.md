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
