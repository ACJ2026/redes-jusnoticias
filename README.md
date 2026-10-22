# Juschubut Noticias

Tablero de repercusión y comunicación judicial de la Agencia de Comunicación Judicial del Poder Judicial del Chubut.

## Vista previa

- **Producción (Cloudflare Pages):** https://redes-jusnoticias.pages.dev/
- La vista previa de la rama de trabajo no es la URL de producción: https://feature-indicadores-faciles.redes-jusnoticias.pages.dev/

## Cómo se genera

- `scripts/actualizar.py` releva notas y publicaciones relacionadas; la preservación del historial y las verificaciones están en los scripts de `scripts/`.
- `data/` contiene los registros históricos que usa el tablero.
- `templates/tablero.html` es la plantilla fuente del tablero público.
- `scripts/armar_publico.py` combina la plantilla y los datos para generar `publico/tablero_publico.html`; el workflow copia ese resultado a `publico/index.html`.
- `.github/workflows/actualizar.yml` programa el relevamiento cada dos horas, en el minuto 59 (cron de GitHub en UTC; en Argentina (UTC-3) corre al minuto 59 de horas impares: 21:59, 23:59, 01:59, 03:59, 05:59, 07:59, 09:59, 11:59, 13:59, 15:59, 17:59 y 19:59).
- `functions/api/google-metrics.js` es la Pages Function para Google Analytics 4 y Search Console.
- `functions/api/redes.js` consulta Facebook, Instagram, YouTube y X en Cloudflare Pages, y ahora integra también TikTok mediante Display API y OAuth. TikTok dispone de las rutas `/api/tiktok/auth`, `/api/tiktok/callback` y `/api/tiktok`; requiere Client Key/Secret, una clave administrativa de conexión y un binding KV llamado `TIKTOK_KV`. Ver `docs/TIKTOK_DISPLAY_API.md` antes de configurar Preview. La integración todavía requiere credenciales, autorización de `@juschubut` y aprobación de los permisos en TikTok Developers. WhatsApp sigue pendiente y no se incluye como cero actividad.

## Documentación y pruebas

- [Checklist general de trabajo](docs/CHECKLIST_TRABAJO_TABLERO.md)
- [Manual sencillo del tablero](docs/MANUAL_TABLERO.md)
- [Configuración de métricas de Google](docs/GOOGLE_METRICS.md)
- [Estado de la integración de redes sociales](docs/REDES_SOCIALES.md)\n- [Configuración de TikTok Display API](docs/TIKTOK_DISPLAY_API.md)
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
