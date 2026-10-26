# Juschubut Noticias

Tablero de repercusión y comunicación judicial de la Agencia de Comunicación Judicial del Poder Judicial del Chubut.

## Vista previa

- **Producción (Cloudflare Pages):** https://jusnoticias.pages.dev/
- Es la única dirección del tablero (público, API y callbacks). `redes-jusnoticias.pages.dev` quedó descartada: no usarla en configuraciones, URIs de retorno ni enlaces. Las vistas previas de cada rama usan `<rama>.jusnoticias.pages.dev`.

## Cómo se genera

- `scripts/actualizar.py` releva notas y publicaciones relacionadas; la preservación del historial y las verificaciones están en los scripts de `scripts/`.
- `data/` contiene los registros históricos que usa el tablero.
- `templates/tablero.html` es la plantilla fuente del tablero público.
- `scripts/armar_publico.py` combina la plantilla y los datos para generar `publico/tablero_publico.html`; el workflow copia ese resultado a `publico/index.html`.
- `.github/workflows/actualizar.yml` programa el relevamiento cada cuatro horas, en el minuto 59 (cron de GitHub en UTC; en Argentina corre a las 21:59, 01:59, 05:59, 09:59, 13:59 y 17:59). Se pasó de 2 a 4 horas el 26/10/2026 para no superar los minutos gratis de GitHub Actions.
- `functions/api/google-metrics.js` es la Pages Function para Google Analytics 4 y Search Console.
- `functions/api/redes.js` consulta en Cloudflare Pages Facebook (dos páginas, con tokens de página e Insights de 28 días), Instagram (28 días), YouTube, X y TikTok; el parámetro `?redes=` limita la consulta a algunas fuentes. TikTok usa Display API con OAuth (rutas `/api/tiktok/auth`, `/api/tiktok/callback` y `/api/tiktok`), guarda el token en el KV `TIKTOK_KV` y el estado de autorización en la base D1 `TIKTOK_AUTH_DB`; ver `docs/TIKTOK_DISPLAY_API.md` antes de configurar Preview. WhatsApp sigue pendiente y ningún canal sin datos validados entra en un total general.

## Documentación y pruebas

- [Checklist general de trabajo](docs/CHECKLIST_TRABAJO_TABLERO.md)
- [Manual sencillo del tablero](docs/MANUAL_TABLERO.md)
- [Configuración de métricas de Google](docs/GOOGLE_METRICS.md)
- [Estado de la integración de redes sociales](docs/REDES_SOCIALES.md)
- [Configuración de TikTok Display API](docs/TIKTOK_DISPLAY_API.md)
- [Incidente y control de enlaces compartidos](docs/INCIDENTE_ENLACES_COMPARTIDOS.md)
- [Guía de Cloudflare Pages y estado de migración](docs/CLOUDFLARE_PAGES.md)

Para ejecutar las pruebas de regresión del historial:

```bash
python3 -m unittest discover -s tests -v
```

## Seguridad y estado de publicación

- No incluir tokens, claves privadas ni credenciales en archivos versionados. Configurar secretos solo en el entorno de ejecución correspondiente.
- La rama de trabajo se valida mediante una vista previa de Cloudflare Pages; todavía no equivale a una publicación definitiva.
- La consulta de metadatos del repositorio realizada el 21/10/2026 informa que `ACJ2026/redes-jusnoticias` es privado. Volver a verificar la visibilidad en GitHub antes de cambiarla o incorporar información sensible.
- El workflow `Reconstruir tablero público` de GitHub Actions terminó correctamente el 21/10/2026 para el commit `915c9c65a3ceb885ef342d2d931e0df444e7a308`. Esto confirma la reconstrucción automatizada del HTML, pero no sustituye la comprobación directa de la URL y de las funciones de servidor en producción.
