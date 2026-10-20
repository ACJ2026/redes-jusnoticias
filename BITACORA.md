# Bitácora técnica — Tablero de repercusión JusNoticias

> Documento de continuidad para personas y asistentes de IA. Leer antes de cambiar código o datos. Registrar aquí cada intervención relevante y actualizar el estado al terminar.

## Objetivo y reglas de trabajo

- Mantener el tablero existente de repercusión de JusNoticias y ampliarlo sin perder el historial de notas, medios y redes.
- Registrar los cambios en esta bitácora y en commits descriptivos.
- No sobrescribir ni reconstruir los archivos históricos de datos para añadir nuevas fuentes.
- No declarar una integración operativa hasta verificarla en producción con credenciales válidas.
- No guardar secretos, tokens ni claves privadas en el repositorio.
- Trabajar en ramas de cambios; no editar `main` directamente.
- Distinguir entre código implementado, pruebas locales, ejecución de GitHub Actions y despliegue de Vercel. Una etapa no prueba automáticamente las otras.

## Arquitectura observada al iniciar esta intervención

- Tablero público estático: `publico/tablero_publico.html`; Vercel publica la carpeta `publico/` y usa `publico/index.html`.
- El HTML público se genera desde una plantilla codificada en Base64 dentro de `scripts/armar_publico.py`; los datos del tablero se insertan en el marcador `/*DATOS*/`.
- Recolección histórica de noticias y repercusión: `scripts/actualizar.py`, con datos en `data/notas2.json`, `data/rep2.json`, `data/medios.json`, `data/redes2.json` y `data/canales.json`.
- API existente de redes sociales: `api/redes.js`; usa variables de entorno de Vercel para credenciales de Meta y, opcionalmente, YouTube.
- Automatización de actualización: `.github/workflows/actualizar.yml`.
- No se encontró al inicio una API de Google Analytics 4 ni de Search Console conectada al tablero.

## Datos de Site Kit proporcionados por el usuario

Período del informe: 22/09/2026–19/10/2026.

- Usuarios/tráfico general informado por Site Kit: aproximadamente 6,5 mil; variación -11,7 % contra los 28 días anteriores.
- Canales: búsqueda orgánica 45,2 %, directo 41,6 %, social orgánico 10,2 %, referencia 1,5 %, otros 1,5 %.
- Search Console: 114 mil impresiones (-12,7 %), 2,7 mil clics (-16 %) y 3 mil visitantes únicos desde búsquedas (-9,4 %).
- Móvil representa 59,7 % de los dispositivos.
- Página principal: 962 páginas vistas; noticia sobre indemnización a una pasajera en Comodoro Rivadavia: 1.351 páginas vistas.
- LCP de laboratorio en móvil: 12,0 s (deficiente); datos de usuarios reales muestran LCP 2,2 s (bueno).
- Estas cifras son una captura aportada por el usuario, no una conexión automática ni una validación independiente de las APIs.

## Incidencias previas conocidas

- En la ejecución de GitHub Actions identificada como run `39428259025`, el paso de generación pública falló por doble llamada a `.decode("utf-8")` en la línea de plantilla de `scripts/armar_publico.py`. El error fue `AttributeError: 'str' object has no attribute 'decode'`. La corrección prevista es dejar un solo `.decode("utf-8")`.
- En ese run, la comprobación de conservación de historial informó OK antes de fallar la generación pública. También se registró un error aislado de JSON en la fuente Atento Chubut; el log indicó que el proceso continuó conservando el historial.
- Los avisos de Node.js 20 y Ubuntu runner eran avisos de mantenimiento, no la causa de ese fallo.

## Registro de intervenciones

### 2026-10-20 — Inicio de integración de métricas Google

- Motivo: incorporar al tablero existente métricas de GA4 y Search Console, evitando la copia manual de los informes de Site Kit.
- Rama de trabajo: `feature/google-metrics-and-project-log`, creada desde `main`.
- Inspección: se verificaron `vercel.json`, `api/redes.js`, `.github/workflows/actualizar.yml` y `scripts/armar_publico.py`.
- Hallazgo: el sitio es estático salvo las funciones bajo `api/`; por ello, la integración debe consultar las APIs desde una función de servidor y no exponer credenciales en el navegador.
- Cambios y pruebas de esta rama se anotarán debajo a medida que se completen.

## Estado actual y próximos pasos

- [ ] Corregir el doble `.decode("utf-8")` en el generador público.
- [ ] Añadir una API de servidor que consulte GA4 y Search Console con credenciales de entorno.
- [ ] Añadir una sección Google al tablero que muestre el estado de configuración, tráfico, búsquedas y páginas principales.
- [ ] Documentar variables de entorno y permisos mínimos necesarios.
- [ ] Ejecutar comprobaciones estáticas y pruebas del generador.
- [ ] Desplegar y validar con credenciales reales; mientras no se configuren las variables en Vercel, la conexión se considera pendiente.
- [ ] Registrar los SHA de commits, resultados de CI y URL de PR/despliegue cuando existan.

## Protocolo para la siguiente IA o desarrollador

1. Leer este archivo completo y revisar los últimos commits de la rama activa.
2. Comprobar `git status`/estado de la rama antes de modificar archivos.
3. Revisar los datos históricos existentes antes de ejecutar procesos que los escriban.
4. No cambiar los datos de noticias/redes para resolver una falla de interfaz o API.
5. Actualizar esta bitácora con fecha, archivos, motivo, pruebas, resultados y pendientes en el mismo cambio que modifica el proyecto.
