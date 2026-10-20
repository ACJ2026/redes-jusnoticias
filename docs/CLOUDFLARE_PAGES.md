# Migración del tablero público a Cloudflare Pages

## Objetivo

Publicar el tablero desde la carpeta `publico/` sin hacer público el repositorio ni cambiar el recolector histórico. El workflow de GitHub Actions sigue actualizando los JSON y generando `publico/index.html`; Cloudflare Pages debe desplegar los cambios que llegan a `main`.

## Crear el proyecto Pages

Configurar un proyecto Cloudflare Pages conectado al repositorio privado `ACJ2026/redes-jusnoticias`:

- **Production branch:** `main`
- **Root directory:** dejar vacío (raíz del repositorio)
- **Build command:** `exit 0`
- **Build output directory:** `publico`

No cambiar la visibilidad del repositorio. Mantener `functions/` en la raíz del repositorio; Cloudflare Pages la utiliza para resolver las rutas de Pages Functions aunque los archivos estáticos se publiquen desde `publico/`.

## Configurar Google como secretos

En la configuración del proyecto Pages, agregar las mismas variables que usa la función de Vercel. Para producción, guardarlas como secretos cuando el panel lo permita:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON completo de la cuenta de servicio, con `client_email` y `private_key`.
- `GA4_PROPERTY_ID`: ID numérico de la propiedad de Google Analytics 4.
- `GSC_SITE_URL`: propiedad exacta de Search Console (por ejemplo, URL-prefix o propiedad de dominio, según cómo esté verificada).

La cuenta de servicio debe tener acceso de lectura a la propiedad de GA4 y a Search Console. No copiar credenciales al HTML, al repositorio ni a documentación.

La función `functions/api/google-metrics.js` conserva la ruta y el formato de respuesta de Vercel: `/api/google-metrics?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`. La plantilla del tablero ya consulta esa ruta relativa, por lo que no requiere cambios de URL.

## Validación antes de sustituir Vercel

1. Desplegar una rama de prueba o un Preview Deployment de Pages.
2. Consultar `/api/google-metrics?desde=2026-10-01&hasta=2026-10-19` en el dominio de prueba.
3. Confirmar que responde con `estado: "ok"`, datos de Analytics y Search Console; no basta con recibir HTTP 200.
4. Abrir el tablero y revisar las pestañas Resumen, Medios, Notas, Redes y Google; probar los filtros de fecha y los enlaces.
5. Confirmar que un commit posterior de GitHub Actions actualiza el despliegue público y que no se pierden registros del historial.
6. Mantener Vercel como alternativa hasta validar el funcionamiento real con credenciales de producción.

## Límites de esta migración

- Este cambio agrega la función compatible con Cloudflare Pages; no crea el proyecto Pages ni configura secretos en la cuenta de Cloudflare.
- La función no puede validarse contra Google hasta que los secretos estén configurados y la cuenta de servicio tenga permisos correctos.
- No cambiar ni desactivar el proyecto Vercel hasta completar la validación de extremo a extremo.
