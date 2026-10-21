# Integración de redes sociales — estado técnico

## Qué muestra el tablero hoy

La pestaña **Redes** mantiene una vista histórica basada en `data/redes2.json` y `data/canales.json`, y ahora consulta `/api/redes` al abrir la pestaña (también permite repetir la consulta manualmente). El panel en vivo muestra por separado el estado, publicaciones y seguidores que respondan las APIs de Facebook, Instagram, YouTube y X. No sustituye ni mezcla el historial con las métricas en vivo.

## Ruta de Cloudflare Pages y ruta heredada de Vercel

`functions/api/redes.js` adapta la consulta social al runtime de Cloudflare Pages y usa variables `env.*`; `api/redes.js` sigue como ruta heredada de Vercel. La interfaz ya consulta la ruta de Pages y muestra errores por plataforma cuando faltan permisos o credenciales. **La conexión visual no significa que las cuentas estén autenticadas ni que las cifras ya se hayan validado contra cuentas reales**: eso requiere configurar secretos, verificar IDs y probar respuestas en producción.

Variables que requiere la ruta social de Pages. La ruta heredada de Vercel usa las variables de Meta y YouTube; la integración de X se implementa en Pages:

- `META_TOKEN`: token de Meta con los permisos mínimos necesarios.
- `FB_PAGE_ID`: identificador de la página oficial de Facebook JusNoticias, obligatorio y sin valor por defecto.
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
- TikTok: [@juschubut](https://www.tiktok.com/@juschubut); integración pendiente.
- WhatsApp: [Agencia de Comunicación Judicial](https://whatsapp.com/channel/0029VaGP0tX0lwgpiNAnBb1p); determinar qué estadísticas ofrece el canal antes de diseñar métricas.

## Estado visible de TikTok y WhatsApp

Ambos canales deben aparecer en el inventario del tablero para que el equipo sepa que existen. Sin embargo, no se deben representar como cero publicaciones ni como métricas en vivo: TikTok todavía no tiene integración de datos y WhatsApp requiere determinar qué estadísticas ofrece el canal. Hasta verificarlo, las publicaciones y métricas de esas plataformas deben figurar como pendientes/no disponibles.

## Próximos pasos antes de declarar la integración terminada

1. Confirmar titularidad, ID y permisos de cada cuenta con acceso autorizado.
2. Configurar y verificar las credenciales de Facebook, Instagram, YouTube y X en Cloudflare Pages; las funciones de Pages ya están conectadas a la interfaz.
3. Probar cada API con el período solicitado, paginación, límites y errores.
4. Configurar los secretos en Cloudflare Pages y verificar que Facebook, Instagram, YouTube y X respondan correctamente desde `/api/redes`; comprobar que la paginación cubra el período y que los errores no se conviertan en ceros.
5. Mostrar «sin dato disponible» cuando una plataforma no entregue una métrica; no reemplazarlo por cero.
6. Mantener separadas las publicaciones propias, las de cuentas institucionales distintas y las publicaciones de otros medios.
