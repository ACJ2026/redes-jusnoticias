# Checklist general de trabajo — Tablero JusNoticias

**Actualizado:** 20/10/2026.  
**Estados:** `[x]` hecho con evidencia; `[~]` preparado pero aún sin prueba integral; `[ ]` pendiente.

## 1. Repositorio y publicación
- [x] Trabajar las mejoras de explicación y período en `feature/indicadores-faciles-de-entender`.
- [x] PR #5 abierto contra `feat/cloudflare-pages-google-metrics`: https://github.com/ACJ2026/redes-jusnoticias/pull/5
- [x] Mantener secretos fuera del HTML y del repositorio.
- [x] Revisión sintáctica: JavaScript de la página generada parsea correctamente y el JSON integrado es válido (279 notas, 1.193 publicaciones relacionadas, 285 posteos y 64 medios).
- [x] Suite de regresión del historial y sincronización plantilla/HTML público pasan en GitHub Actions para el último commit validado: https://github.com/ACJ2026/redes-jusnoticias/actions/runs/39489639736
- [x] Pruebas nuevas del tablero público pasaron en GitHub Actions: plantilla y HTML generado sincronizados, JSON fuente coherente, portada presente, canal equivocado excluido de métricas propias y sin claves en el HTML: https://github.com/ACJ2026/redes-jusnoticias/actions/runs/39485365031
- [x] Validación de fechas de Google probada con casos válidos, fecha imposible, formato inválido, rango invertido y ventana máxima de 90 días.
- [ ] Completar pruebas de interacción del período, pestañas, filtros y estados vacíos en navegador.
- [ ] Probar la web en escritorio y móvil después de desplegar.
- [x] Cloudflare Pages confirmó despliegue exitoso para el commit `ae2ac34`: https://f73843a6.redes-jusnoticias.pages.dev/. La URL estable de vista previa de rama es https://feature-indicadores-faciles.redes-jusnoticias.pages.dev/. La actualización automática regeneró el HTML desde la plantilla; las pruebas de regresión y sincronización pasan. Falta inspección visual/interacción real en escritorio y móvil.
- [~] Vercel reportó límite diario de despliegues en los commits más recientes; esa vía es independiente del preview de Cloudflare y no debe confundirse con él.
- [ ] Confirmar URL oficial de producción. La URL de Pages usada en pruebas fue https://redes-jusnoticias.pages.dev/.
- [!] Hallazgo importante: GitHub informa que `ACJ2026/redes-jusnoticias` está **público**, mientras que el repositorio anterior `ignacervo-cell/jusnoticias-tablero` está privado y el plan previo trataba el destino como privado. No se cambió la visibilidad; confirmar la política institucional antes de fusionar.
- [x] Comparación de historial entre repositorios: los 1.103 pares nota–medio del repositorio anterior aparecen representados en los 1.193 pares del repositorio institucional; el destino tiene 90 pares adicionales. Siete URLs antiguas de Google Noticias fueron sustituidas por URLs distintas para el mismo par nota–medio; conviene revisar una muestra antes de declarar equivalencia perfecta.
- [ ] Resolver la relación de publicación entre el repositorio anterior `ignacervo-cell/jusnoticias-tablero` y el institucional `ACJ2026/redes-jusnoticias`; evitar versiones divergentes y confirmar cuál dominio debe ser oficial.

## 2. Período e indicadores
- [~] El tablero queda preparado para iniciar en el último mes disponible, no en todo el historial.
- [~] Gráficos mensuales, gráficos de redes, totales por medio y fecha destacada preparados para respetar el período seleccionado.
- [x] Rango de Google sincronizado con el período principal y limitado automáticamente a los últimos 90 días si la selección supera el máximo permitido; la interfaz explica la limitación. Falta probarlo visualmente en navegador.
- [ ] Probar mes único, varios meses, rango sin datos y cambios entre pestañas.
- [ ] Confirmar que la fecha destacada sea la última nota **dentro del período**, y diferenciarla de la fecha/hora en que se generaron los datos.
- [ ] Identificar seguidores y demás cifras actuales como actuales, no como históricos del período.
- [ ] Revisar totales, porcentajes, duplicados y estados vacíos.

## 3. Infografía territorial
- [~] Vista «Alcance territorial por localidad» añadida al código.
- [~] Filtro por tipo: radio, televisión, prensa gráfica y portal digital.
- [~] Localidades no verificadas separadas.
- [~] En octubre 2026, de las 85 publicaciones relacionadas clasificadas como confianza media/alta, 28 todavía no tienen localidad confirmada. En todo el JSON histórico, quedan medios sin sede corroborada: mantenerlos separados y no asignarlos por intuición.
- [~] Catálogo territorial actualizado con ubicaciones corroboradas: Del Mar Digital, ADN Sur y Crónica (Comodoro Rivadavia); EQS Notas (Esquel); Digital Chubut (Puerto Madryn). Fuentes: https://delmardigital.net/, https://www.adnsur.com.ar/, https://www.eqsnotas.com/eqs-notas_t67d0abdfdccdd2c5abb6237c, https://prensaescrita.org/argentina/chubut/ y el clipping institucional https://comunidadfac.org.ar/prensa/2024/clipping%20Semanal%20del%2013-04%20al%2019-04.pdf.
- [ ] Verificar la localidad y categoría de cada medio restante; los medios de cobertura provincial o sin sede confirmada deben seguir como no verificados.
- [ ] Distinguir claramente Chubut, otras provincias de la Patagonia y alcance nacional/otras provincias usando sedes comprobadas.
- [ ] Comparar manualmente cifras por localidad, región y tipo contra los registros del período.
- [ ] Probar filtro, ausencia de datos y diseño móvil.
- [ ] Mantener la aclaración: se cuentan publicaciones detectadas, no lectores, audiencia ni alcance efectivo.

## 4. Relevamiento y preservación histórica
- [x] Mantener la regla de no borrar registros anteriores solo porque una corrida nueva no los detectó.
- [x] El proceso contempla verificaciones para fallar explícitamente ante fallos de fuentes o caídas sospechosas del volumen.
- [x] Documentar que Google Noticias encuentra candidatos, pero no prueba copia, atribución ni exhaustividad.
- [~] GitHub Actions está programado cada dos horas, en el minuto 59, hora argentina.
- [x] La ejecución programada del 20/10/2026 19:22 UTC terminó correctamente, incluidos relevamiento, generación del HTML público y guardado: https://github.com/ACJ2026/redes-jusnoticias/actions/runs/39482960177. Las dos programadas previas revisadas también terminaron correctamente.
- [ ] Auditar la lista de medios, fuentes fallidas, paginación y fechas.
- [ ] Etiquetar coincidencias como posibles hasta verificar evidencia; distinguir tema similar, texto similar y atribución explícita.
- [ ] No presentar la fecha de la nota de JusNoticias como si fuera la fecha comprobada del artículo externo.

## 5. Redes sociales — inventario entregado por el usuario
Los enlaces están recibidos; **la integración técnica de cada uno aún debe verificarse**.

- [x] YouTube — JusNoticias Prensa: https://www.youtube.com/@jusnoticiasprensa2865
- [x] X: https://x.com/Jus_Noticias
- [x] Instagram — Jus Chubut: https://www.instagram.com/jus_chubut/
- [x] TikTok — Jus Chubut: https://www.tiktok.com/@juschubut
- [x] WhatsApp — Agencia de Comunicación Judicial: https://whatsapp.com/channel/0029VaGP0tX0lwgpiNAnBb1p
- [ ] Confirmar titularidad, nombre e identificador de cada cuenta.
- [x] Corregido el riesgo de atribuir métricas del canal general del Poder Judicial a JusNoticias: 12 publicaciones históricas de ese canal se conservaron pero dejaron de computarse como propias; el canal general queda identificado como referencia institucional separada.
- [~] Agregada la cuenta correcta «JusNoticias Prensa» sin inventar seguidores; falta obtener/verificar el ID correcto y configurar `YT_CANAL_ID` junto con `YT_KEY`.
- [ ] Verificar accesos oficiales, permisos y métricas disponibles por plataforma.
- [ ] Decidir si la ruta social seguirá en Vercel o se portará a Cloudflare Pages; no asumir que `api/redes.js` se ejecuta en Pages ni que el tablero la consume.
- [x] Endurecida la ruta heredada de Vercel: valida fechas reales, limita la consulta a 90 días, usa ventana reciente por defecto y no cachea respuestas con errores. Aún no está conectada al tablero público ni desplegada en Pages.
- [ ] Integrar X y TikTok si existe una vía oficial autorizada; no asumir que sus estadísticas se obtienen como datos públicos sin credenciales.
- [ ] Confirmar que Instagram conectado sea exactamente `jus_chubut` y tenga permisos Meta válidos.
- [ ] Confirmar que YouTube use el canal de JusNoticias y no se sustituya por el canal general del Poder Judicial si no corresponde.
- [ ] Revisar Facebook: nombre/página institucional correcta y sin duplicados.
- [ ] Determinar qué estadísticas permite el canal de WhatsApp; no asumir que ofrece métricas equivalentes a las de otras redes.
- [ ] Mostrar «sin dato disponible» cuando una plataforma no entregue una métrica; no convertirlo en cero.
- [ ] Probar por red publicaciones, seguidores, reacciones, comentarios, compartidos y vistas solo cuando la plataforma ofrezca cada dato.

**Estado técnico conocido:** `api/redes.js` es una ruta de Vercel que consulta Facebook, Instagram y YouTube, pero la plantilla pública actual no la llama: las redes visibles provienen del JSON generado por GitHub Actions. Por eso, no debe describirse como una integración en vivo del tablero. Si se usa Cloudflare Pages, la ruta social debe portarse como Pages Function y probarse por separado. X y TikTok no están integrados; WhatsApp queda pendiente de verificar métricas disponibles.

## 6. Google Analytics 4 y Search Console
- [x] La API de Google de Cloudflare Pages respondió correctamente en una prueba para 01/10/2026–19/10/2026.
- [x] En esa prueba: GA4 4.671 usuarios, 6.407 sesiones, 7.558 páginas vistas; Search Console 1.559 clics y 66.462 impresiones. Son datos de esa prueba, no cifras permanentes.
- [~] Revisar variables de producción de Cloudflare Pages: `GA4_PROPERTY_ID`, `GSC_SITE_URL`, secreto `GOOGLE_SERVICE_ACCOUNT_JSON`.
- [ ] Confirmar permisos de solo lectura de la cuenta de servicio en GA4 y Search Console.
- [ ] Probar la consulta de producción con varios rangos y comprobar errores/fechas incompletas.
- [ ] Mantener GA4 (actividad dentro del sitio) y Search Console (resultados de búsqueda) separados; no sumar sus métricas.
- [x] `docs/GOOGLE_METRICS.md` describe Cloudflare Pages Functions y las variables requeridas; confirmar la configuración real del entorno.

## 7. Seguridad
- [x] No incluir claves privadas ni tokens en el HTML público.
- [~] `api/redes.js` usa credenciales del servidor para proveedores que las requieren.
- [ ] Revisar si el endpoint de redes puede invocarse sin autenticación y valorar el riesgo según el carácter público/privado de los datos.
- [ ] Revisar exposición de errores del proveedor, parámetros de fecha, paginación, caché y posibles URLs con credenciales.
- [ ] Confirmar que tokens no aparezcan en logs ni respuestas.

## 8. Claridad visual y documentación
- [x] Portada tipo infografía ejecutiva con identidad visible “JusNoticias” y subtítulo “Tablero de repercusión y comunicación judicial”, título del navegador actualizado, indicadores dinámicos y botón de ingreso al tablero completo; portada incorporada a la plantilla generadora y archivos públicos regenerados.
- [x] JavaScript de la plantilla y HTML generado parsean correctamente; JSON de datos válido. `api/redes.js` y la función de fechas de Google pasan parseo sintáctico; validación de fechas probada.
- [~] La herramienta de navegación no permitió inspeccionar visualmente la URL de vista previa; falta abrirla en navegador real y probar el botón, rutas, filtros y diseño móvil.
- [~] Preparar etiquetas en lenguaje sencillo para usuarios, sesiones, vistas, clics e impresiones.
- [~] Manual `docs/MANUAL_TABLERO.md` actualizado con frecuencia cada dos horas.
- [~] Diferenciar en la documentación las dos vías de publicación observadas (Vercel y Cloudflare Pages) y confirmar cuál es la URL institucional definitiva.
- [ ] Revisar títulos, leyendas, ortografía, contraste, tablas largas, estados vacíos y móvil.
- [ ] Distinguir claramente «último registro del período» de «datos generados/actualizados».
- [ ] Validar visualmente el tablero real después del despliegue.

## 9. Orden de cierre
1. [ ] Revisar diff y validar sintaxis/pruebas.
2. [ ] Probar período, filtros y panel Google con datos reales.
3. [ ] Verificar catálogo y números de la infografía territorial.
4. [ ] Revisar GitHub Actions y la publicación efectiva.
5. [ ] Validar cuentas/permisos sociales e integrar las plataformas que permitan acceso oficial.
6. [ ] Actualizar documentación Cloudflare y auditar seguridad.
7. [ ] Revisar escritorio y móvil.
8. [ ] Solo después, pedir autorización para fusionar el PR y publicar.

## Reglas de trabajo
- No editar `main` directamente.
- No fusionar ni publicar producción sin revisión y autorización.
- No borrar el historial por una corrida incompleta.
- No inventar enlaces, métricas, cuentas ni localidades.
- No tratar una coincidencia de Google Noticias como prueba de copia o atribución.
- Usar `[x]` solo para tareas con evidencia; `[~]` cuando falte prueba integral.
