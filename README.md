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
- `functions/api/redes.js` prepara la consulta de Facebook, Instagram y YouTube en Cloudflare Pages; `api/redes.js` sigue como ruta heredada de Vercel. La Pages Function requiere IDs y secretos verificados y aún no está conectada a la interfaz, por lo que las cifras sociales visibles no son métricas en vivo.

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
- **Atención:** GitHub informa que el repositorio institucional tiene visibilidad pública al 20/10/2026, aunque el plan de migración lo describía como privado. Confirmar la política institucional antes de fusionar o incorporar información que no deba ser pública.
- No fusionar ni modificar la rama `main` como parte de este trabajo sin revisión y autorización explícita.
