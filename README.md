# Tablero JusNoticias

Tablero de repercusión y comunicación judicial de la Agencia de Comunicación Judicial del Poder Judicial del Chubut.

## Vista previa

- **Vista previa de la rama de trabajo:** https://feature-indicadores-faciles.redes-jusnoticias.pages.dev/
- **URL de producción:** pendiente de confirmar. No considerar la vista previa como publicación institucional definitiva.

## Cómo se genera

- `scripts/actualizar.py` releva notas y publicaciones relacionadas; la preservación del historial y las verificaciones están en los scripts de `scripts/`.
- `data/` contiene los registros históricos que usa el tablero.
- `templates/tablero.html` es la plantilla fuente del tablero público.
- `scripts/armar_publico.py` combina la plantilla y los datos para generar `publico/tablero_publico.html`; el workflow copia ese resultado a `publico/index.html`.
- `.github/workflows/actualizar.yml` programa el relevamiento cada dos horas, en el minuto 59 (cron de GitHub en UTC; equivalente a minutos 59 de las horas pares en Argentina).
- `functions/api/google-metrics.js` es la Pages Function para Google Analytics 4 y Search Console.
- `api/redes.js` es una ruta heredada de Vercel. No se ejecuta automáticamente en Cloudflare Pages y la plantilla actual no la consume; no presentarla como integración en vivo del tablero.

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
