# Integración de Google Analytics 4 y Search Console

## Propósito

Añadir al tablero de repercusión de JusNoticias un panel independiente de métricas de audiencia y búsqueda, sin reemplazar el seguimiento de notas, medios o redes ya existente.

## Variables de entorno requeridas en Vercel

Configurar únicamente en Vercel → Project → Settings → Environment Variables:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: contenido JSON de una cuenta de servicio de Google con una clave privada. No guardar el JSON en el repositorio, en issues ni en la bitácora.
- `GA4_PROPERTY_ID`: identificador numérico de la propiedad GA4 (no el ID de medición que empieza por G-).
- `GSC_SITE_URL`: propiedad exacta de Search Console, por ejemplo `https://jusnoticias.juschubut.gov.ar/` si esa es la propiedad verificada.

## Permisos en Google

1. En Google Analytics, abrir Administración → Gestión de accesos de la propiedad y añadir el correo `client_email` de la cuenta de servicio con permiso de lectura (Viewer).
2. En Search Console, añadir el mismo correo como usuario con acceso completo o restringido suficiente para consultar el rendimiento de búsqueda, según la política de la organización.
3. No compartir contraseñas personales ni tokens OAuth en el código.
4. Tras guardar las variables, desplegar de nuevo Vercel para que la función las reciba.

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

## Checklist de puesta en marcha

- [ ] Configurar las tres variables de entorno.
- [ ] Dar permisos de solo lectura a la cuenta de servicio en GA4 y Search Console.
- [ ] Desplegar en Vercel.
- [ ] Probar `/api/google-metrics` sin parámetros y con fechas explícitas.
- [ ] Comparar totales con Site Kit para el mismo período, contemplando diferencias de zona horaria/definición.
- [ ] Verificar que no se expongan secretos en la respuesta del endpoint ni en la consola del navegador.
