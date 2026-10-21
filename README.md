# Tablero JusNoticias

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
- `functions/api/redes.js` consulta Facebook, Instagram, YouTube y X en Cloudflare Pages; la pestaña Redes ya consulta `/api/redes` y muestra el estado y los errores de cada fuente. Para obtener cifras necesita los IDs y secretos de Meta y YouTube configurados en Pages. X ya tiene una consulta preparada, pero requiere un token autorizado de X; TikTok y WhatsApp siguen pendientes de integración y no se incluyen en un total general.

## Documentación y pruebas

- [Checklist general de trabajo](docs/CHECKLIST_TRABAJO_TABLERO.md)
- [Manual sencillo del tablero](docs/MANUAL_TABLERO.md)
- [Configuración de métricas de Google](docs/GOOGLE_METRICS.md)
- [Estado de la integración de redes sociales](docs/REDES_SOCIALES.md)
- [Guía de Cloudflare Pages y estado de migración](docs/CLOUDFLARE_PAGES.md)

Para ejecutar las pruebas de regresión del historial:

```bash
python3 -m unittest discover -s tests -v
```

## Seguridad y estado de publicación

- No incluir tokens, claves privadas ni credenciales en archivos versionados. Configurar secretos solo en el entorno de ejecución correspondiente.
- La rama de trabajo se valida mediante una vista previa de Cloudflare Pages; todavía no equivale a una publicación definitiva.
- La consulta de metadatos del repositorio realizada el 21/10/2026 informa que `ACJ2026/redes-jusnoticias` es privado. Volver a verificar la visibilidad en GitHub antes de cambiarla o incorporar información sensible.
- Los cambios fusionados en `main` no se consideran publicados hasta comprobar el despliegue de Cloudflare Pages y abrir la URL de producción.
