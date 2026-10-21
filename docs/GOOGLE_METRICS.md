# Integración de Google Analytics 4 y Search Console

## Propósito

Añadir al tablero de repercusión de JusNoticias un panel independiente de métricas de audiencia y búsqueda, sin reemplazar el seguimiento de notas, medios o redes ya existente.

La ruta `functions/api/google-metrics.js` está implementada como una **Cloudflare Pages Function**. La configuración de esta función debe hacerse en el proyecto de Cloudflare Pages que la publica. No confundirla con el proceso de GitHub Actions que releva notas y genera los archivos públicos; son flujos distintos y hay que verificar por separado dónde está publicada cada versión del tablero.

## Variables de entorno en Cloudflare Pages

En el panel de Cloudflare, abrir el proyecto de Pages correspondiente y configurar las variables/secrets del entorno (Production y Preview cuando corresponda):

- `GOOGLE_SERVICE_ACCOUNT_JSON`: contenido JSON de una cuenta de servicio de Google con una clave privada. Guardar como secret; no incluir el JSON en el repositorio, en issues ni en la bitácora.
- `GA4_PROPERTY_ID`: identificador numérico de la propiedad GA4 (no el ID de medición que empieza por G-).
- `GSC_SITE_URL`: propiedad exacta de Search Console, por ejemplo `https://jusnoticias.juschubut.gov.ar/` si esa es la propiedad verificada.

Después de cambiar variables, volver a desplegar la función para que el entorno las reciba.

## Permisos en Google

1. En Google Analytics, abrir Administración → Gestión de accesos de la propiedad y añadir el correo `client_email` de la cuenta de servicio con permiso de lectura (Viewer).
2. En Search Console, añadir el mismo correo con los permisos mínimos que permitan consultar el rendimiento de búsqueda, según la política de la organización.
3. No compartir contraseñas personales ni tokens OAuth en el código.

## Datos que debe devolver el endpoint

- GA4: usuarios, sesiones, vistas, sesiones con interacción, duración media, canales, dispositivos y páginas.
- Search Console: clics, impresiones, CTR, posición, consultas y páginas de destino.
- Ventana de consulta limitada a 90 días por petición; rango predeterminado de los últimos 28 días.
- Errores de configuración/API explícitos; nunca sustituir un error por ceros silenciosamente.

## Seguridad y límites

- La cuenta de servicio debe tener permisos mínimos de solo lectura.
- Las credenciales permanecen exclusivamente en variables de entorno del servidor.
- El navegador consulta solo la ruta propia `/api/google-metrics`; no recibe la clave privada.
- Los informes de GA4 y Search Console pueden diferir en definición, atribución, frescura y zona horaria; no deben sumarse como si fueran la misma métrica.
- Si las variables no están configuradas, el panel debe indicarlo como “Pendiente de configuración”, no afirmar que la integración está funcionando.
- La función debe validar el método HTTP y el rango de fechas, limitar el rango solicitado y no devolver claves, tokens ni datos sensibles en errores.

## Checklist de puesta en marcha

- [ ] Confirmar cuál proyecto y dominio de Cloudflare Pages sirven el tablero público y la función `/api/google-metrics`.
- [ ] Configurar las tres variables en el entorno correcto; no copiarlas a archivos del repositorio.
- [ ] Dar permisos de solo lectura a la cuenta de servicio en GA4 y permisos mínimos suficientes en Search Console.
- [ ] Desplegar la Cloudflare Pages Function.
- [ ] Probar `/api/google-metrics` sin parámetros y con fechas explícitas, en rangos válidos e inválidos.
- [ ] Comparar totales con la interfaz de Google para el mismo período, contemplando diferencias de zona horaria/definición.
- [ ] Verificar que no se expongan secretos en la respuesta del endpoint ni en la consola del navegador.
- [ ] Verificar por separado el despliegue del recolector y de la versión pública generada por GitHub Actions.


## Fuentes concretas de tráfico en Analytics

La respuesta de `/api/google-metrics` incluye `analytics.fuentes`, obtenida de las dimensiones `sessionSource` y `sessionMedium` de GA4. Cada fila conserva la fuente y el medio originales, y añade sesiones, páginas vistas, usuarios y una clasificación aproximada para facilitar la lectura.

- Las fuentes mostradas son las que Analytics registró realmente en el rango consultado; no son una lista fija de plataformas.
- Los nombres de origen conocidos pueden clasificarse como buscador, red social o asistente de IA. La fuente y el medio originales siguen visibles para poder comprobar la clasificación.
- Las visitas sin referencia identificable se mantienen como “Acceso directo” o “Sin identificar” según los valores que entrega GA4.
- La API consulta los datos cuando se solicita, pero GA4 puede demorar en procesarlos. No describir estos datos como tiempo real segundo a segundo.
- Search Console aporta consultas y páginas que aparecen en la Búsqueda de Google; no representa todos los buscadores. El porcentaje de clics es clics dividido por impresiones. La posición es un promedio y el puesto 1 es el más alto.
