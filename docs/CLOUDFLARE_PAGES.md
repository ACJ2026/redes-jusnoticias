# Migración del tablero público a Cloudflare Pages

## Objetivo

Publicar el tablero desde la carpeta `publico/` sin hacer público el repositorio ni cambiar el recolector histórico. El workflow de GitHub Actions sigue actualizando los JSON y generando `publico/index.html`; Cloudflare Pages debe desplegar los cambios que llegan a `main`.

## Crear el proyecto Pages

**Estado que debe resolverse antes de la puesta en producción:** al 20/10/2026, GitHub informa que `ACJ2026/redes-jusnoticias` tiene `private: false` (público), aunque el plan de migración lo describía como privado. Confirmar la política institucional y quién puede cambiarla; no asumir que el repositorio es privado ni publicar secretos.

Configurar un proyecto Cloudflare Pages conectado al repositorio `ACJ2026/redes-jusnoticias` una vez confirmada la política de visibilidad:

- **Production branch:** `main`
- **Root directory:** dejar vacío (raíz del repositorio)
- **Build command:** `exit 0`
- **Build output directory:** `publico`

Mantener `functions/` en la raíz del repositorio; Cloudflare Pages la utiliza para resolver las rutas de Pages Functions aunque los archivos estáticos se publiquen desde `publico/`. No cambiar la visibilidad de forma automática: requiere una decisión institucional explícita.

## Configurar Google como secretos

En la configuración del proyecto Pages, agregar las mismas variables que usa la función de Vercel. Para producción, guardarlas como secretos cuando el panel lo permita:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON completo de la cuenta de servicio, con `client_email` y `private_key`.
- `GA4_PROPERTY_ID`: ID numérico de la propiedad de Google Analytics 4.
- `GSC_SITE_URL`: propiedad exacta de Search Console (por ejemplo, URL-prefix o propiedad de dominio, según cómo esté verificada).

Estas variables corresponden solo a Google. La ruta social de Pages (`functions/api/redes.js`) y la ruta heredada de Vercel usan `META_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`, `YT_KEY` y, para el canal correcto, `YT_CANAL_ID`; no son intercambiables con las variables de Google.

La cuenta de servicio debe tener acceso de lectura a la propiedad de GA4 y a Search Console. No copiar credenciales al HTML, al repositorio ni a documentación.

La función `functions/api/google-metrics.js` conserva la ruta y el formato de respuesta de Vercel: `/api/google-metrics?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`. La plantilla del tablero ya consulta esa ruta relativa, por lo que no requiere cambios de URL.

**Importante para redes sociales:** `api/redes.js` es la ruta heredada de Vercel; `functions/api/redes.js` ya contiene la adaptación para Cloudflare Pages. Sin embargo, la plantilla actual todavía no consulta `/api/redes`, y las redes visibles provienen del JSON generado por GitHub Actions. La función de Pages aún requiere IDs y secretos verificados y pruebas reales antes de conectarla a la interfaz. X, TikTok y WhatsApp requieren evaluación separada de APIs y permisos.

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
