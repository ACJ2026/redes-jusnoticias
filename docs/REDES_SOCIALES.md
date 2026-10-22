# Integración de redes sociales — estado técnico

## Qué muestra el tablero hoy

La pestaña **Redes** mantiene una vista histórica basada en `data/redes2.json` y `data/canales.json`. La consulta de `/api/redes` solo se ejecuta cuando la persona pulsa **Consultar fuentes disponibles**; abrir la pestaña no inicia llamadas a las APIs. El panel en vivo muestra por separado el estado, publicaciones y seguidores que respondan las APIs de Facebook, Instagram, YouTube y X. No sustituye ni mezcla el historial con las métricas en vivo.

## Ruta de Cloudflare Pages y ruta heredada de Vercel

`functions/api/redes.js` adapta la consulta social al runtime de Cloudflare Pages y usa variables `env.*`; `api/redes.js` sigue como ruta heredada de Vercel. La interfaz ya consulta la ruta de Pages y muestra errores por plataforma cuando faltan permisos o credenciales. **La conexión visual no significa que las cuentas estén autenticadas ni que las cifras ya se hayan validado contra cuentas reales**: eso requiere configurar secretos, verificar IDs y probar respuestas en producción.

Variables que requiere la ruta social de Pages. La ruta heredada de Vercel usa las variables de Meta y YouTube; la integración de X se implementa en Pages:

- `META_TOKEN`: token de usuario de Meta con `pages_show_list`, `pages_read_engagement` y `read_insights`, y acceso a las páginas. No debe ser un token de página si también se usa para obtener los tokens de ambas páginas y consultar Instagram.
- `FB_PAGE_ID`: identificador de la página de Facebook JusNoticias (`116101835114568`).
- `FB_PAGE_ID_2`: identificador opcional de la segunda página (`761013867341405`, JusNoticias STJ). La función consulta ambas páginas cuando se configura esta variable.
- `FB_PAGE_TOKEN` / `FB_PAGE_TOKEN_2`: alternativas opcionales para guardar directamente los tokens de página de la primera y segunda página, respectivamente, si no se usa un token de usuario válido en `META_TOKEN`. Configurarlos únicamente como secrets de Cloudflare Pages.
- `IG_USER_ID`: identificador de Instagram, obligatorio y correspondiente a `@jus_chubut`.
- `YT_KEY`: clave de YouTube Data API.
- `YT_CANAL_ID`: ID de canal confirmado para `@jusnoticiasprensa2865`.
- `X_BEARER_TOKEN`: token de aplicación autorizado para consultar el timeline público de X.
- `X_USER_HANDLE`: nombre de usuario de X sin arroba; opcional, por defecto `Jus_Noticias`.

No guardar estos valores ni tokens en el repositorio, HTML, issues o documentación. Configurarlos únicamente como variables/secrets del entorno de ejecución. La ruta debe mostrar errores sin convertirlos en cero ni exponer credenciales.

## Cuentas entregadas para el tablero

- Facebook: JusNoticias (cuenta indicada por el código como `prensastjchubut`); verificar el ID y nombre visibles.
- Instagram: [@jus_chubut](https://www.instagram.com/jus_chubut/); verificar el ID y permisos de Meta.
- YouTube: [JusNoticias Prensa](https://www.youtube.com/@jusnoticiasprensa2865); ID y seguidores pendientes de verificar. El canal general del Poder Judicial se conserva como referencia institucional distinta y ya no se cuenta como cuenta propia de JusNoticias.
- X: [@Jus_Noticias](https://x.com/Jus_Noticias); la función de Pages ya consulta la API v2 con `X_BEARER_TOKEN` y `X_USER_HANDLE` (opcional, por defecto `Jus_Noticias`). Requiere una aplicación de desarrollador y acceso autorizado a la API; hasta configurar el token, la interfaz debe mostrar el error de conexión y no un cero.
- TikTok: [@juschubut](https://www.tiktok.com/@juschubut); el dominio `https://jusnoticias.pages.dev/` ya está verificado en TikTok Developers. La autorización OAuth, el callback de producción, el almacenamiento seguro de tokens y la consulta de Display API siguen pendientes.
- WhatsApp: [Agencia de Comunicación Judicial](https://whatsapp.com/channel/0029VaGP0tX0lwgpiNAnBb1p); determinar qué estadísticas ofrece el canal antes de diseñar métricas.

## Instagram Insights: prueba validada con Graph API v26.0

El 22/10/2026 se verificó en Graph API Explorer el perfil `@jus_chubut` (ID `17841410514175238`), que devolvió `followers_count=2610` y `media_count=2938`. También respondió la consulta de Insights con `metric=reach,views,accounts_engaged,total_interactions`, `period=day`, `metric_type=total_value` y un rango explícito de fechas. La respuesta de prueba informó alcance 2344, visualizaciones 44072, cuentas que interactuaron 430 e interacciones totales 665 para el rango consultado por el usuario, del 24/09/2026 al 22/10/2026.

En la rama de trabajo, la función de Instagram consulta esas cuatro métricas de forma aislada con el rango solicitado por la API y las devuelve bajo `insights`; la interfaz muestra los valores por separado y su rango. Si una métrica falla, se muestra como no disponible, nunca como cero. La prueba manual confirma que la consulta funciona con el token/permisos del Explorador; todavía debe validarse desde el entorno de Cloudflare Pages con el secreto configurado y no equivale a un despliegue de producción.

## X: solicitudes, costos y errores de créditos

Una consulta exitosa a X realiza una llamada `GET /2/users/by/username/{username}?user.fields=public_metrics` para el perfil y entre una y diez llamadas `GET /2/users/{id}/tweets` (100 publicaciones por página, acotadas a los últimos 90 días). En total son **2 a 11 solicitudes HTTP por consulta**; si la primera llamada devuelve un error, la paginación no comienza. No se consultan endpoints de búsqueda ni se hacen escrituras.

La [tarifa oficial pay-per-use](https://docs.x.com/x-api/getting-started/pricing) cobra por recursos devueltos: **US$ 0,010 por usuario** y **US$ 0,005 por publicación** a tarifa estándar. La lectura de publicaciones propias puede costar **US$ 0,001 por publicación** si se cumple el requisito de Owned Reads: el ID debe coincidir con el usuario autenticado, que además debe ser propietario de la aplicación. No se puede confirmar esa elegibilidad solo por el nombre de la variable bearer. La documentación indica deduplicación de recursos durante una ventana UTC de 24 horas (garantía blanda). Por ello, para 1.000 publicaciones únicas leídas, el orden de magnitud por ventana de deduplicación es hasta **US$ 5,01** estándar o **US$ 1,01** si aplican Owned Reads; menos publicaciones reducen el costo proporcionalmente.

La producción reportó `HTTP 402` y la consola de X indicó saldo y créditos gratuitos en cero. La documentación de [créditos y precios](https://docs.x.com/x-api/getting-started/pricing#credit-balance) dice que las solicitudes se bloquean con saldo cero o negativo hasta agregar créditos. Sin embargo, la integración existente solo conserva el código HTTP y descarta `title`, `detail` y `type` de la respuesta del proveedor; por eso no se puede atribuir el `402` exclusivamente al saldo ni verificar un submotivo de X. El tablero mostrará que se requieren créditos o acceso habilitado, sin convertir el error en métricas cero. No se habilitan compras ni recargas automáticas.

El historial local de X se conserva separado de la consulta en vivo. La pestaña muestra la fecha de actualización de esos datos históricos y los identifica como parciales; no se presentan como cifras actuales.

## TikTok: requisitos para integrar la API oficial

La [Display API oficial de TikTok](https://developers.tiktok.com/docs/en/display-api-overview) permite consultar el perfil y las publicaciones públicas recientes de una cuenta autorizada. Para usarla se necesita una cuenta de desarrollador, aprobación de los productos necesarios, autorización OAuth del titular y los permisos correspondientes, entre ellos `video.list` y `user.info.stats` para las estadísticas del perfil. La documentación de [inicio de la integración](https://developers.tiktok.com/docs/en/display-api-get-started) describe el flujo de autorización.

La verificación del dominio está completada para `https://jusnoticias.pages.dev/`, pero no habilita por sí sola el acceso a la API. Antes de consultar TikTok desde Pages hay que completar Login Kit/OAuth, confirmar el Redirect URI de producción, configurar secretos de servidor y definir la renovación segura de tokens. No se debe poner un token en el HTML ni presentar un fallo de autorización como cero publicaciones. Hasta completar esos pasos, la interfaz debe mostrar que el dominio está verificado y la API pendiente.

## WhatsApp Channels: usar las estadísticas de administración

WhatsApp ofrece a los administradores estadísticas del canal en la propia aplicación: crecimiento y alcance de los últimos 30 días, regiones principales, seguidores y bajas, reacciones y resultados de encuestas; también permite ver las visualizaciones de cada actualización. Consultar la [ayuda oficial sobre estadísticas de canales](https://faq.whatsapp.com/809740894165112) y la [información del reporte de canales](https://faq.whatsapp.com/6480469855345352/).

No hay una integración de API de métricas de canales validada en este tablero. Hasta confirmar un endpoint oficial disponible para esta cuenta, la vía fiable es registrar manualmente las métricas que el administrador pueda consultar en WhatsApp y su fecha de captura. No mostrar WhatsApp como cero actividad ni mezclar una captura manual con cifras de API en vivo.

## Regla común de publicación

X, Facebook, Instagram y YouTube aparecen en el panel de consulta por API, pero solo aportan cifras cuando la API responde con credenciales válidas. TikTok tiene el dominio verificado, pero queda pendiente de autorización OAuth, almacenamiento seguro de tokens y validación de Display API; WhatsApp queda pendiente de una fuente de métricas automatizable o de un procedimiento de carga manual documentado. Ningún total general se publica hasta que la cobertura sea verificable.

## Próximos pasos antes de declarar la integración terminada

1. Confirmar titularidad, ID y permisos de cada cuenta con acceso autorizado.
2. Configurar y verificar las credenciales de Facebook, Instagram, YouTube y X en Cloudflare Pages; para Facebook, validar las dos páginas y sus tokens. La función de Pages consulta `FB_PAGE_ID` y, si está definido, `FB_PAGE_ID_2`.
3. Probar cada API con el período solicitado, paginación, límites y errores.
4. Configurar los secretos en Cloudflare Pages y verificar que Facebook, Instagram, YouTube y X respondan correctamente desde `/api/redes`; comprobar que la paginación cubra el período y que los errores no se conviertan en ceros.
5. Mostrar «sin dato disponible» cuando una plataforma no entregue una métrica; no reemplazarlo por cero.
6. Mantener separadas las publicaciones propias, las de cuentas institucionales distintas y las publicaciones de otros medios.
