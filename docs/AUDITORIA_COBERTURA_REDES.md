# Auditoría de cobertura de redes sociales

**Estado:** auditoría estática inicial del código de `main`. No equivale todavía a una prueba con las credenciales reales de producción ni a una medición de cobertura completa.

## Objetivo

Comprobar si JusNoticias detecta y registra:
1. publicaciones de sus propias cuentas;
2. publicaciones de medios y otras cuentas que reproducen, comparten o mencionan notas de JusNoticias;
3. hallazgos que no cumplen los criterios automáticos actuales.

El enlace de Instagram compartido como caso de prueba es `https://www.instagram.com/reel/De3-0ZbiUYN/`. No se pudo confirmar desde esta revisión quién lo publicó ni si pertenece a una cuenta oficial. No se debe dar por resuelto hasta localizar la publicación y comprobar el mecanismo que debería detectarla.

## Hallazgos confirmados en el código

### 1. Búsqueda automática de repercusiones: `functions/api/compartidos.js`

- Solo ejecuta búsquedas automáticas en Instagram y YouTube.
- Facebook y TikTok se presentan como búsquedas asistidas/manuales, no como detección automática general de publicaciones de terceros.
- Instagram consulta las cuentas de `data/cuentas_monitoreo.json` cuyo estado no empieza con `Dudosa`; por cada cuenta solicita `media.limit(30)`. No busca cuentas desconocidas ni todo Instagram.
- Instagram descarta publicaciones anteriores a la ventana de 30 días y relaciona el texto con títulos de notas publicadas entre un día antes y ocho días después. Si el Reel no tiene texto/caption útil, usa otro texto o no alcanza el umbral de palabras coincidentes, puede no aparecer aunque visualmente difunda la nota.
- YouTube combina la búsqueda por título de las 10 notas más recientes con el inventario de canales de medios. La búsqueda por título no pagina resultados; la lectura por canal recorre hasta 3 páginas de 25 videos (75 por canal) y se detiene si los videos ya son anteriores a la ventana. Si aún hay más páginas dentro del período, informa cuántos canales alcanzaron el límite; no equivale a leer todo el historial.
- La respuesta informa errores por fuente/cuenta, pero una consulta exitosa con cero coincidencias no demuestra que se haya revisado toda la red.

### 2. Consulta de publicaciones propias: `functions/api/redes.js`

La consulta en vivo está separada de la búsqueda de repercusiones. Consulta las cuentas autorizadas de Facebook, Instagram, YouTube, X y TikTok, según las credenciales configuradas.

- Facebook: hasta 10 páginas de 100 publicaciones por página.
- Instagram: hasta 10 páginas de 100 elementos por página.
- YouTube: hasta 10 páginas de 50 elementos por página.
- X: hasta 10 páginas de 100 publicaciones; depende de que la API tenga acceso habilitado y créditos cuando corresponda.
- TikTok: hasta 5 páginas de 20 videos de la cuenta autorizada.
- El período solicitado por esta API está limitado a los últimos 90 días. Llegar a un máximo de páginas puede dejar resultados fuera; algunas funciones lo indican con `limiteAlcanzado`.

Estos endpoints consultan publicaciones propias y métricas. **No sustituyen** la búsqueda de publicaciones de terceros.

### 3. Historial existente: `data/redes2.json`

La lectura estática del archivo en `main` encontró 285 registros: 267 marcados como propios y 18 como publicaciones de otras cuentas. Ninguno de los 18 registros externos contiene un campo de URL directa de publicación. Por lo tanto, el historial no permite abrir/verificar desde esos registros la publicación concreta; no corresponde inventar enlaces retroactivamente.

En ese archivo no hay registros etiquetados como TikTok. Esto no prueba que la cuenta no tenga publicaciones: indica que el historial estático no las contiene.

### 4. Cuentas y fuentes

La búsqueda de Instagram depende de que las cuentas estén previamente cargadas en `data/cuentas_monitoreo.json`. Si una cuenta no está listada, no se consulta. La cobertura de YouTube depende de la consulta por títulos y no de un inventario exhaustivo de todos los canales.

## Matriz de cobertura observada

| Red | Publicaciones propias en consulta en vivo | Repercusiones de terceros automáticas | Limitación confirmada |
|---|---|---|---|
| Instagram | Sí, cuenta autorizada | Sí, solo cuentas monitoreadas y hasta 30 elementos por cuenta | Ventana de 30 días y coincidencia textual |
| Facebook | Sí, páginas autorizadas y permisos disponibles | No; búsqueda asistida | No hay búsqueda automática general de posts de terceros |
| YouTube | Sí, canal autorizado | Sí, búsqueda por título de hasta 10 notas recientes y canales de medios inventariados | Búsqueda por título: hasta 10 resultados sin paginación; por canal: hasta 75 videos y aviso si alcanza el límite |
| X | Sí, timeline de cuenta autorizada | No | No está incluido en `/api/compartidos`; el acceso propio depende de la API |
| TikTok | Sí, cuenta autorizada | No; búsqueda asistida | Display API de la cuenta no busca publicaciones generales de terceros |
| WhatsApp | No hay consulta automática de publicaciones validada en estas funciones | No | Sin integración de búsqueda de repercusiones validada |

## Qué falta comprobar en ejecución

La revisión estática no permite confirmar los permisos vigentes ni la respuesta real de las APIs de producción. Para cerrar la auditoría hace falta:

1. Consultar `/api/compartidos` y guardar el resultado real por fuente: estado, cantidad revisada, coincidencias y errores.
2. Consultar `/api/redes` por red y verificar que cada cuenta responde, qué período cubre y si alcanzó el límite de paginación.
3. Identificar la cuenta autora del Reel de prueba y comprobar si está en la lista monitoreada.
4. Reproducir el caso contra la lógica actual: cuenta no monitoreada, publicación fuera de los 30 elementos, caption insuficiente, fecha fuera de ventana o fallo de API.
5. Probar casos equivalentes por Facebook, X, YouTube y TikTok; distinguir limitaciones del código de restricciones de acceso del proveedor.

## Correcciones priorizadas

1. **No presentar una consulta vacía como cobertura completa.** Mostrar para cada red el período, cuentas consultadas, resultados, errores y límites alcanzados.
2. **Mejorar la detección de Instagram:** registrar las causas por las que una cuenta/publicación no se procesa y evaluar criterios complementarios a las raíces del título. Mantener la URL directa como identificador del hallazgo.
3. **Ampliar YouTube con control de cuota:** mantener la búsqueda por título y recorrer hasta 3 páginas de videos recientes de cada canal inventariado, con corte por fecha, contador de videos y aviso de límite alcanzado.
4. **Cerrar la brecha de Facebook, X y TikTok para repercusiones externas** solo mediante fuentes y permisos realmente disponibles; no simular cobertura automática donde la API no la ofrece.
5. **Conservar trazabilidad por publicación:** red, cuenta, fecha, URL directa, texto disponible, nota relacionada, fuente de detección y estado de verificación. Los hallazgos sin coincidencia segura deben quedar como pendientes, no desaparecer.
6. **Añadir pruebas de regresión** para publicaciones con caption vacío, enlaces a JusNoticias, títulos reformulados, varias notas similares, duplicados, ventanas temporales, errores de API y límites de paginación.

## Criterio para cerrar

La auditoría se considera cerrada únicamente cuando cada red tenga una cobertura documentada y probada, los límites se comuniquen claramente, los hallazgos recuperados se registren con su enlace directo y el caso del Reel tenga una explicación verificable. No se debe prometer cobertura total de una plataforma si sus API no la permiten.
