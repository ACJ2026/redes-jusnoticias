# Migración del tablero público a Cloudflare Pages

## Objetivo

Publicar el tablero desde la carpeta `publico/` sin hacer público el repositorio ni cambiar el recolector histórico. El workflow de GitHub Actions sigue actualizando los JSON y generando `publico/index.html`; Cloudflare Pages debe desplegar los cambios que llegan a `main`.

## Crear el proyecto Pages

**Visibilidad del repositorio:** la consulta de metadatos de GitHub del 21/10/2026 informa `private: true`. Confirmar esta configuración directamente en GitHub antes de cambiar la visibilidad; nunca publicar secretos ni datos que deban mantenerse privados.

Configurar un proyecto Cloudflare Pages conectado al repositorio `ACJ2026/redes-jusnoticias` una vez confirmada la política de visibilidad:

- **Production branch:** `main`
- **Root directory:** dejar vacío (raíz del repositorio)
- **Build command:** `exit 0`
- **Build output directory:** `publico`

Mantener `functions/` en la raíz del repositorio; Cloudflare Pages la utiliza para resolver las rutas de Pages Functions aunque los archivos estáticos se publiquen desde `publico/`. No cambiar la visibilidad de forma automática: requiere una decisión institucional explícita.

## Configurar Google como secretos

En la configuración del proyecto Pages, configurar las variables que consume la función de Cloudflare Pages. Para producción, guardarlas como secretos cuando el panel lo permita:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON completo de la cuenta de servicio, con `client_email` y `private_key`.
- `GA4_PROPERTY_ID`: ID numérico de la propiedad de Google Analytics 4.
- `GSC_SITE_URL`: propiedad exacta de Search Console (por ejemplo, URL-prefix o propiedad de dominio, según cómo esté verificada).

Estas variables corresponden solo a Google. La ruta social de Pages (`functions/api/redes.js`) y la ruta heredada de Vercel usan `META_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`, `YT_KEY` y, para el canal correcto, `YT_CANAL_ID`; no son intercambiables con las variables de Google.

La cuenta de servicio debe tener acceso de lectura a la propiedad de GA4 y a Search Console. No copiar credenciales al HTML, al repositorio ni a documentación.

La función `functions/api/google-metrics.js` expone la ruta `/api/google-metrics?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`. La plantilla consulta esa ruta relativa. La plantilla del tablero ya consulta esa ruta relativa, por lo que no requiere cambios de URL.

**Importante para redes sociales:** `api/redes.js` es la ruta heredada de Vercel; `functions/api/redes.js` es la ruta de Cloudflare Pages y la interfaz ya consulta `/api/redes`. La función requiere IDs y secretos verificados y pruebas reales. X ya está conectado a la consulta y requiere `X_BEARER_TOKEN` y, opcionalmente, `X_USER_HANDLE`. TikTok y WhatsApp no están conectados; necesitan evaluación separada de APIs, permisos y disponibilidad de métricas.

## Validación de producción en Cloudflare Pages

1. Desplegar una rama de prueba o un Preview Deployment de Pages.
2. Consultar `/api/google-metrics?desde=2026-10-01&hasta=2026-10-19` en el dominio de prueba.
3. Confirmar que responde con `estado: "ok"`, datos de Analytics y Search Console; no basta con recibir HTTP 200.
4. Abrir el tablero y revisar las pestañas Resumen, Medios, Notas, Redes y Google; probar los filtros de fecha y los enlaces. En Redes, consultar `/api/redes` y comprobar el estado individual de Facebook, Instagram y YouTube.
5. Confirmar que un commit posterior de GitHub Actions actualiza el despliegue público y que no se pierden registros del historial.
6. No usar los checks de Vercel como criterio de publicación de Cloudflare Pages. La validación de Google y redes sigue dependiendo de credenciales reales y debe hacerse contra las rutas de Pages.

## Revisión de publicaciones desde el tablero

La pestaña **Notas** permite resolver una publicación pendiente desde el detalle de cada nota. El servicio conserva la decisión vigente y agrega un registro inalterable por intervención a la bitácora. El código no se habilita para escribir si faltan la base o la clave de revisión.

Antes de usar los botones en producción, configurar lo siguiente en el proyecto Cloudflare Pages:

1. Crear una base D1 **separada** para las revisiones (no reutilizar `TIKTOK_AUTH_DB`).
2. En **Settings → Bindings**, agregar el binding D1 con el nombre exacto `REVISIONES_DB` para Production y, si se probará, también para Preview.
3. Ejecutar `migrations/0002_revisiones_publicaciones.sql` contra esa base remota. La migración crea una tabla con la última decisión por publicación y otra de bitácora que conserva todas las decisiones.
4. Crear una clave aleatoria de al menos 32 bytes y guardarla como secreto `REVISIONES_CLAVE` en la configuración de variables y secretos de Pages. No guardar esa clave en GitHub, en este archivo ni en el HTML.
5. Esperar al despliegue y abrir `/api/revisiones`. Debe responder JSON con `revisiones`; si responde 503, la base o la migración todavía no están listas.
6. En la primera acción desde el tablero, introducir la clave autorizada. Se conserva solo durante la sesión del navegador. Si se responde «Clave incorrecta», volverá a pedirla.

Los botones no deben considerarse operativos hasta completar esta configuración y probar en el sitio publicado una confirmación, un descarte, la persistencia tras recargar y el recálculo de los contadores. La API rechaza escrituras sin clave, solicitudes de otro origen y confirmaciones con enlaces de Google/Bing en lugar del enlace directo del medio. Al confirmar desde una referencia de búsqueda, el usuario debe pegar la URL directa de la publicación; el enlace de búsqueda queda asociado como referencia de origen.

## Límites de esta migración

- Este cambio agrega la función compatible con Cloudflare Pages; no crea el proyecto Pages ni configura secretos en la cuenta de Cloudflare.
- La validación con datos reales de Google sigue pendiente hasta comprobar que los secretos estén configurados en el proyecto de producción y que la cuenta de servicio tenga permisos correctos. La herramienta disponible en esta revisión no permitió consultar el dominio `pages.dev` directamente, por lo que no se afirma que la función ya devuelva datos reales.
- `api/redes.js` es una ruta heredada para Vercel; no confundir su existencia con la validación del despliegue de Cloudflare Pages. No desactivar servicios heredados hasta confirmar qué tráfico y dominios siguen utilizándolos.
