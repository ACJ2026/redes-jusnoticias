# Panel en vivo de la portada

## Qué muestra
- **Recorrido de la última nota:** Nota → Medios que la publicaron → Fuera de Chubut → Redes en vivo. Los tres primeros datos salen del último relevamiento guardado (cada 4 h); el cuarto, de la consulta en vivo.
- **Repercusiones entrando:** publicaciones en medios de las notas más recientes (último relevamiento).
- **Redes en vivo:** seguidores, publicaciones e interacciones de los últimos 7 días de Facebook (JusNoticias y STJ), Instagram, YouTube y TikTok. El alcance de Instagram es de la cuenta, en una ventana de 28 días. X no se consulta (su API pide créditos).

## Cómo funciona
- `functions/api/panel-vivo.js` reutiliza `functions/api/redes.js`: los tokens nunca llegan al navegador.
- Lo consultado no se escribe en `data/redes2.json` ni en `data/canales.json`. Se guarda solo en una caché compartida de 5 minutos.
- Si una red falla (token vencido, límite, error), el panel muestra «sin dato en vivo · último dato: fecha» y su chip queda gris. Nunca muestra 0 en lugar de un dato que falta.
- «Interacción alta, media o baja» compara cada publicación con las demás del mismo canal. Es solo una ayuda visual: no entra en ninguna cifra.

## Configuración en Cloudflare Pages
1. **Caché compartida (recomendado):** crear un namespace KV (por ejemplo `jusnoticias-panel-vivo`) y vincularlo al proyecto con el nombre **`PANEL_KV`**, en Producción y en Preview. Sin ese vínculo se usa la Cache API de Cloudflare, que en la prueba del 28/10/2026 funcionó en la vista previa.
2. Las credenciales son las mismas que usa «Consultar fuentes disponibles» (`META_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`, `YT_KEY`, `YT_CANAL_ID` y los datos de TikTok). `META_TOKEN` vence cerca del 21/12/2026: ese día Facebook (si no hay token de página guardado) e Instagram pasan a «sin dato en vivo» sin romper el panel.

## Estado al 28/10/2026 (vista previa)
- Responden: Facebook JusNoticias, Facebook STJ, Instagram y YouTube. La segunda consulta salió de la caché.
- TikTok: «Token refresh failed». Hay que volver a autorizar la cuenta desde `/api/tiktok/auth`.
- X: no se consulta.
