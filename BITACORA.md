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

- [x] Corregir el doble `.decode("utf-8")` en el generador público.
- [x] Añadir una API de servidor que consulte GA4 y Search Console con credenciales de entorno.
- [x] Añadir una sección Google al tablero que muestre el estado de configuración, tráfico, búsquedas y páginas principales.
- [x] Documentar variables de entorno y permisos mínimos necesarios.
- [ ] Ejecutar comprobaciones estáticas y pruebas del generador.
- [ ] Desplegar y validar con credenciales reales; mientras no se configuren las variables en Vercel, la conexión se considera pendiente.
- [ ] Registrar los resultados de CI y URL de despliegue cuando existan.

## Protocolo para la siguiente IA o desarrollador

1. Leer este archivo completo y revisar los últimos commits de la rama activa.
2. Comprobar `git status`/estado de la rama antes de modificar archivos.
3. Revisar los datos históricos existentes antes de ejecutar procesos que los escriban.
4. No cambiar los datos de noticias/redes para resolver una falla de interfaz o API.
5. Actualizar esta bitácora con fecha, archivos, motivo, pruebas, resultados y pendientes en el mismo cambio que modifica el proyecto.


### 2026-10-20 — Implementación inicial en rama de trabajo

Archivos creados/modificados:
- `api/google-metrics.js` (commits `f1dc7e51ba21303191d3298df73a683304d8bcc5`, `da60627cb043e75cc53321d61beb48889f24124a`, `0361234ade0399526dc62983b0dc957b8e6b1988`): endpoint GET de servidor con JWT firmado para cuenta de servicio, consultas de GA4 y Search Console, rango máximo de 90 días, informes separados para evitar sumar usuarios duplicados a través de dimensiones y totales completos de Search Console. Respuestas de configuración pendiente y error son explícitas.
- `scripts/armar_publico.py` (commits `7a3635d338f5ce476b16e0fa48dae1f539372fb0`, `6eba9f232039b129a3b59b86d186ca25cba73a3d`): eliminada la segunda llamada a `.decode("utf-8")`; se añadió pestaña Google en la plantilla embebida, con filtros de fechas, KPIs, páginas principales, canales, dispositivos, consultas y páginas de Search Console.
- `docs/GOOGLE_METRICS.md` (commit `fe1efa48d70aeac9082db4742c56de275e586ddd`): pasos de configuración, permisos de solo lectura y variables de entorno.
- `BITACORA.md` (commit inicial `a6fc8cf23c5f5a3b389fa59e56c5f8856c436bc9`): este registro y protocolo de continuidad.

Validaciones estáticas hechas durante edición:
- Se comprobó que la plantilla incluye la pestaña `Google`, la llamada a `/api/google-metrics` y el despachador `google: drawGoogle`.
- Se comprobó que el generador ya no contiene el doble `.decode("utf-8")`.
- Se corrigió la tarjeta de clics/impresiones para que use los totales de Search Console, no la suma parcial de las 25 consultas principales.
- Estas comprobaciones son inspecciones estáticas; todavía NO equivalen a una ejecución de Python/Node, una ejecución de GitHub Actions ni una validación con las APIs reales.

Configuración externa pendiente:
- Variables de Vercel: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID`, `GSC_SITE_URL`.
- Dar acceso de lectura al correo de la cuenta de servicio en GA4 y Search Console.
- Hasta configurar esas variables y permisos, la pestaña debe mostrar “Pendiente de configuración”; no afirmar que los datos reales ya están conectados.

Próxima acción:
- Abrir PR desde `feature/google-metrics-and-project-log` hacia `main` para revisar los cambios sin escribir directamente sobre `main`.
- Antes de publicar, ejecutar pruebas del generador y comprobar los endpoints en el despliegue de Vercel.


### 2026-10-20 — Pull request y estado de validación

- PR abierto: https://github.com/ACJ2026/redes-jusnoticias/pull/2
- Rama: `feature/google-metrics-and-project-log`; base `main`.
- HEAD inspeccionado antes de esta actualización de bitácora: `2d525ea4fc4861203f3a70a16059b2bb3592772b`.
- Comparación con `main`: 8 commits por delante, 0 por detrás; 4 archivos cambiados (BITACORA.md, api/google-metrics.js, docs/GOOGLE_METRICS.md, scripts/armar_publico.py).
- GitHub Actions: ejecución `39433106427`, job `pruebas-historial`, resultado `success`. Esto valida las pruebas de regresión del historial, no la API nueva ni el generador completo.
- Checks de Vercel para el commit inspeccionado informaron `failure` en ambos proyectos (`redes-jusnoticias` y `redes-jusnoticias-67i7`). No se pudo obtener el detalle del log desde la herramienta disponible; causa no determinada. No marcar despliegue como exitoso.
- El PR sigue abierto y sin merge. No modificar `main` ni afirmar que el cambio está publicado hasta resolver los checks y contar con aprobación explícita para integrar.
- El endpoint y la pestaña están preparados para informar “Pendiente de configuración” si faltan las variables; los datos reales de Google aún requieren configuración externa.
