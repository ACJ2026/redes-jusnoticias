# Integración de redes sociales — estado técnico

## Qué muestra el tablero hoy

La pestaña **Redes** usa los registros versionados en `data/redes2.json` y las referencias de seguidores en `data/canales.json`. No consulta automáticamente la ruta `/api/redes` al abrir la pestaña. Por lo tanto, las cifras deben describirse como los datos disponibles en la última generación, no como estadísticas en vivo.

## Ruta de Cloudflare Pages y ruta heredada de Vercel

`functions/api/redes.js` ya adapta la consulta social al runtime de Cloudflare Pages y usa variables `env.*`; `api/redes.js` sigue como ruta heredada de Vercel. La nueva ruta exige IDs explícitos de Facebook, Instagram y el canal correcto de YouTube, y devuelve errores por plataforma cuando faltan permisos o credenciales. **Todavía no está conectada a la interfaz del tablero ni validada contra cuentas reales**; no anunciar métricas sociales en vivo hasta configurar secretos, verificar IDs y probar respuestas.

Variables que requiere la ruta social de Pages (y que la ruta heredada también utiliza):

- `META_TOKEN`: token de Meta con los permisos mínimos necesarios.
- `FB_PAGE_ID`: identificador de la página oficial de Facebook JusNoticias, obligatorio y sin valor por defecto.
- `IG_USER_ID`: identificador de Instagram, obligatorio y correspondiente a `@jus_chubut`.
- `YT_KEY`: clave de YouTube Data API.
- `YT_CANAL_ID`: ID de canal confirmado para `@jusnoticiasprensa2865`.

No guardar estos valores ni tokens en el repositorio, HTML, issues o documentación. Configurarlos únicamente como variables/secrets del entorno de ejecución. La ruta debe mostrar errores sin convertirlos en cero ni exponer credenciales.

## Cuentas entregadas para el tablero

- Facebook: JusNoticias (cuenta indicada por el código como `prensastjchubut`); verificar el ID y nombre visibles.
- Instagram: [@jus_chubut](https://www.instagram.com/jus_chubut/); verificar el ID y permisos de Meta.
- YouTube: [JusNoticias Prensa](https://www.youtube.com/@jusnoticiasprensa2865); ID y seguidores pendientes de verificar. El canal general del Poder Judicial se conserva como referencia institucional distinta y ya no se cuenta como cuenta propia de JusNoticias.
- X: [@Jus_Noticias](https://x.com/Jus_Noticias); la información está en el conjunto de datos, pero no hay integración API en vivo verificada.
- TikTok: [@juschubut](https://www.tiktok.com/@juschubut); integración pendiente.
- WhatsApp: [Agencia de Comunicación Judicial](https://whatsapp.com/channel/0029VaGP0tX0lwgpiNAnBb1p); determinar qué estadísticas ofrece el canal antes de diseñar métricas.

## Próximos pasos antes de declarar la integración terminada

1. Confirmar titularidad, ID y permisos de cada cuenta con acceso autorizado.
2. Decidir si la ruta social permanece en Vercel o se porta a Cloudflare Pages.
3. Probar cada API con el período solicitado, paginación, límites y errores.
4. Conectar la interfaz solo cuando el endpoint esté desplegado y probado.
5. Mostrar «sin dato disponible» cuando una plataforma no entregue una métrica; no reemplazarlo por cero.
6. Mantener separadas las publicaciones propias, las de cuentas institucionales distintas y las publicaciones de otros medios.
