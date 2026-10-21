# Manual sencillo del tablero de repercusión de JusNoticias

**Para qué sirve:** reunir en un solo lugar señales verificables sobre la difusión de las notas de JusNoticias: publicaciones propias, publicaciones relacionadas en otros medios, actividad de redes y visitas/búsquedas de Google.

**Importante:** el tablero mide lo que logra detectar con sus fuentes y métodos. No equivale a toda la repercusión real, ni demuestra por sí solo que otro medio haya copiado una nota o usado a JusNoticias como fuente. Para contar una publicación como confirmada, el registro debe tener confianza media/alta y un enlace válido; los registros sin enlace se muestran como posibles y no suman a los totales confirmados.

## 1. Cómo leer el tablero

- **Resumen:** panorama general del período elegido, incluidos los gráficos mensuales y la infografía de alcance territorial.
- **Medios:** dónde se encontraron publicaciones relacionadas y qué se pudo comprobar en cada caso.
- **Notas:** detalle de las notas de JusNoticias que forman la base de la revisión.
- **Redes:** publicaciones de las cuentas incluidas y datos públicos disponibles de interacción.
- **Google:** datos del sitio web y de las búsquedas en Google. Son dos fuentes distintas, explicadas abajo.
- **Cómo leerlo:** explicación breve dentro del propio tablero.

Elegí las fechas para analizar un período. Los indicadores y gráficos históricos muestran solo ese rango. La infografía territorial cuenta publicaciones detectadas por localidad de sede del medio y permite filtrar por tipo; no mide dónde viven los lectores. Los medios sin localidad verificada se agrupan aparte. Los seguidores son una cifra de referencia actual y no cambian al cambiar el período.

## 2. De dónde salen los datos y cada cuánto se actualizan

### Relevamiento de notas y medios
El proceso automático está programado para ejecutarse **cada dos horas, en el minuto 59 (hora argentina)**, mediante GitHub Actions. La programación no garantiza que cada ejecución termine sin errores: para confirmar la actualización efectiva hay que revisar que GitHub Actions finalice correctamente y que los archivos se publiquen. La fecha destacada dentro del tablero corresponde a la última nota incluida en el período seleccionado. En el pie se separan dos fechas: **Datos relevados** (última ejecución de relevamiento confirmada) y **Tablero generado** (momento en que se construyó la página). Regenerar el diseño no debe cambiar la fecha del relevamiento.

El programa lee las notas de JusNoticias y consulta medios de una lista configurada. Busca títulos parecidos y, además, realiza búsquedas en Google Noticias por título y fragmentos textuales. Los resultados dependen de qué páginas estén accesibles y hayan sido detectadas por Google; no son un archivo completo de todo lo publicado en Internet. El filtro del tablero usa el mes de publicación de la nota de JusNoticias relacionada; no siempre se dispone de la fecha exacta en que el otro medio publicó su artículo.

### Google Noticias: qué hace y qué no hace
Google Noticias es un servicio de Google que selecciona y organiza noticias disponibles en la web. No muestra necesariamente todos los artículos ni los incorpora de inmediato. Que un medio o una nota no aparezca en una búsqueda **no prueba que no exista**. Que aparezca una nota sobre el mismo tema tampoco prueba que haya tomado información de JusNoticias.

En este tablero, Google Noticias se usa como una vía adicional para descubrir posibles publicaciones, incluso fuera de la lista fija de medios. El programa no tiene acceso a una base privada y completa de Google Noticias: observa los resultados que logra encontrar.

### Redes sociales
El tablero reúne publicaciones y cifras de las cuentas que están configuradas actualmente en los datos del proyecto. Las cifras públicas disponibles dependen de cada plataforma. Algunas redes no publican de forma abierta las vistas, el alcance o todas las estadísticas. Por eso, un campo vacío o “—” puede significar que la plataforma no entrega ese dato; no significa cero.

La lista de cuentas debe revisarse antes de sumar nuevas páginas de Facebook: solo se deberían incluir las páginas institucionales correctas y evitar duplicar una misma cuenta o mezclar páginas que no corresponden.

### Google Analytics 4 (GA4)
GA4 mide actividad dentro del sitio web de JusNoticias mediante su sistema de analítica. En este tablero se consulta el servicio de Google a través de una función del propio sitio. La consulta se realiza cuando se abre/actualiza la pestaña Google, usando las fechas elegidas. La clave de acceso permanece en el servidor y no se muestra en el navegador.

- **Usuarios:** usuarios que registraron actividad en el sitio durante el período. No equivale necesariamente a personas identificadas por nombre.
- **Sesiones:** visitas o períodos de actividad. Una persona puede generar varias sesiones.
- **Páginas vistas:** cantidad de veces que se cargaron páginas. Una misma página puede contarse varias veces.
- **Canales de tráfico:** agrupación del origen de las visitas, por ejemplo búsqueda orgánica, acceso directo o redes sociales. Es la clasificación que informa GA4.
- **Dispositivos:** categorías de dispositivo desde las que se navegó.
- **Páginas principales:** páginas con más vistas/sesiones/usuarios en el período.

Los datos de Analytics no siempre están completos en el mismo instante: Google indica que el procesamiento puede tardar, en algunos casos, entre 24 y 48 horas. Por eso, los últimos días pueden variar.

### Google Search Console (GSC)
Search Console mide cómo aparece el sitio en los resultados de búsqueda de Google y qué pasa cuando las personas hacen clic en esos resultados. No mide todas las visitas del sitio: mide el rendimiento en la Búsqueda de Google.

- **Clics desde Google:** clics en un resultado de búsqueda que llevan al sitio.
- **Impresiones en búsquedas:** veces que un resultado del sitio se mostró en la pantalla de resultados. No significa que alguien haya hecho clic ni que haya leído la nota.
- **CTR:** porcentaje de impresiones que terminaron en un clic. Por ejemplo, 5 clics sobre 100 impresiones equivalen a 5 %.
- **Posición media:** posición promedio aproximada del resultado en las búsquedas incluidas. Un número más bajo suele indicar que apareció más arriba, pero el promedio cambia según consulta, ubicación, dispositivo y período.
- **Consultas:** palabras o frases que las personas buscaron y para las que Google mostró páginas del sitio.
- **Páginas en resultados:** páginas de JusNoticias que aparecieron en búsquedas.

No sumes clics e impresiones con usuarios, sesiones o páginas vistas: son medidas diferentes. Tampoco deben sumarse las cifras de GA4 y Search Console como si fueran el mismo tipo de actividad.

## 3. Qué significa cada indicador de repercusión

- **Notas de JusNoticias:** notas publicadas en el sitio y consideradas en el período.
- **Notas relacionadas encontradas en otros medios:** publicaciones que el sistema vinculó con una nota de JusNoticias. La relación temática no demuestra por sí sola copia o atribución.
- **Copia textual / reescritura / redacción propia:** clasificación automática según la similitud del texto disponible. Debe leerse como una estimación; puede equivocarse, especialmente si el sitio no permite leer el artículo completo.
- **Menciona a JusNoticias como fuente:** señal visible de atribución, cuando el texto revisado nombra expresamente la fuente.
- **Publicación propia en redes:** posteo encontrado en una cuenta configurada como propia.
- **Me gusta, comentarios y compartidos:** interacciones que la plataforma expone para esa publicación.
- **Vistas:** reproducciones o vistas que la plataforma entrega. No todas las redes ofrecen esta cifra.
- **Seguidores:** tamaño de la audiencia declarada por cada cuenta en el momento de la captura; no indica cuántas personas vieron una publicación.

## 4. Límites que hay que tener presentes

1. El tablero no cubre automáticamente todo lo que se emite por radio o televisión, grupos privados, contenido no indexado, publicaciones borradas ni sitios inaccesibles.
2. Google Noticias y los buscadores no garantizan resultados completos ni inmediatos.
3. Una coincidencia de tema o título no prueba copia ni que el medio haya usado a JusNoticias como fuente.
4. Las cifras públicas de redes son limitadas. Para alcance, impresiones y estadísticas internas de Facebook/Instagram suele hacer falta acceso autorizado a las páginas y a sus estadísticas.
5. Los datos de Google pueden cambiar después de la primera consulta por el procesamiento propio de Google.
6. Un dato ausente no debe interpretarse como cero. Si una fuente falla, el tablero debe mostrar el error o el dato como no disponible, no inventar un resultado.
7. El total es un **mínimo detectado**, no una medida absoluta de toda la repercusión.

## 5. Qué se puede hacer si un dato parece incorrecto

1. Revisar las fechas elegidas y el texto “actualizado”.
2. Abrir el detalle de la nota o publicación y comprobar el enlace a la fuente.
3. Distinguir si la fila es una coincidencia confirmada o una posibilidad pendiente de revisar.
4. En Google, pulsar **Consultar** para volver a pedir el período seleccionado.
5. Si faltan datos, comprobar la configuración y permisos de la fuente; no compartir contraseñas, claves privadas ni tokens por chat o dentro del repositorio.

## 6. Configuración de Google en Cloudflare Pages

Si la pestaña Google muestra **“Pendiente de configuración”**, revisar en el proyecto de Cloudflare Pages las variables de entorno del entorno **Production**: `GA4_PROPERTY_ID`, `GSC_SITE_URL` y el secreto `GOOGLE_SERVICE_ACCOUNT_JSON`. Después de configurarlas, volver a desplegar y consultar un período. No copiar la clave privada al HTML, al repositorio ni al chat.

## 7. Integración de estadísticas privadas de Facebook

Los enlaces públicos permiten identificar páginas, pero no habilitan por sí solos a consultar estadísticas privadas. Para añadir datos como alcance e impresiones, una persona con permisos suficientes debe autorizar la integración oficial de Meta y seleccionar las páginas correctas. Antes de incorporarlas al tablero hay que confirmar la titularidad, el acceso y que no se esté contando dos veces la misma página.
