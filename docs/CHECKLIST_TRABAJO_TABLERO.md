# Checklist general de trabajo — Tablero JusNoticias

**Actualizado:** 20/10/2026.  
**Estados:** `[x]` hecho con evidencia; `[~]` preparado pero aún sin prueba integral; `[ ]` pendiente.

## 1. Repositorio y publicación
- [x] Trabajar las mejoras de explicación y período en `feature/indicadores-faciles-de-entender`.
- [x] PR #5 abierto contra `feat/cloudflare-pages-google-metrics`: https://github.com/ACJ2026/redes-jusnoticias/pull/5
- [x] Mantener secretos fuera del HTML y del repositorio.
- [ ] Revisar el diff completo y ejecutar pruebas de sintaxis/regresión antes de aprobar.
- [ ] Probar la web en escritorio y móvil después de desplegar.
- [ ] Confirmar URL oficial de producción. La URL de Pages usada en pruebas fue https://redes-jusnoticias.pages.dev/.
- [ ] Resolver cómo se relaciona el proyecto anterior `ignacervo-cell/jusnoticias-tablero` con el repositorio institucional `ACJ2026/redes-jusnoticias`; probar ambas páginas por separado y evitar versiones divergentes.

## 2. Período e indicadores
- [~] El tablero queda preparado para iniciar en el último mes disponible, no en todo el historial.
- [~] Gráficos mensuales, gráficos de redes, totales por medio y fecha destacada preparados para respetar el período seleccionado.
- [~] Rango de Google preparado para sincronizarse con el período principal.
- [ ] Probar mes único, varios meses, rango sin datos y cambios entre pestañas.
- [ ] Confirmar que la fecha destacada sea la última nota **dentro del período**, y diferenciarla de la fecha/hora en que se generaron los datos.
- [ ] Identificar seguidores y demás cifras actuales como actuales, no como históricos del período.
- [ ] Revisar totales, porcentajes, duplicados y estados vacíos.

## 3. Infografía territorial
- [~] Vista «Alcance territorial por localidad» añadida al código.
- [~] Filtro por tipo: radio, televisión, prensa gráfica y portal digital.
- [~] Localidades no verificadas separadas.
- [ ] Verificar la localidad y categoría de cada medio: el catálogo inicial es orientativo.
- [ ] Distinguir claramente Chubut, otras provincias de la Patagonia y alcance nacional/otras provincias usando sedes comprobadas.
- [ ] Comparar manualmente cifras por localidad, región y tipo contra los registros del período.
- [ ] Probar filtro, ausencia de datos y diseño móvil.
- [ ] Mantener la aclaración: se cuentan publicaciones detectadas, no lectores, audiencia ni alcance efectivo.

## 4. Relevamiento y preservación histórica
- [x] Mantener la regla de no borrar registros anteriores solo porque una corrida nueva no los detectó.
- [x] El proceso contempla verificaciones para fallar explícitamente ante fallos de fuentes o caídas sospechosas del volumen.
- [x] Documentar que Google Noticias encuentra candidatos, pero no prueba copia, atribución ni exhaustividad.
- [~] GitHub Actions está programado cada dos horas, en el minuto 59, hora argentina.
- [ ] Revisar ejecuciones recientes de Actions y confirmar que terminan y publican correctamente.
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
- [ ] Verificar accesos oficiales, permisos y métricas disponibles por plataforma.
- [ ] Integrar X y TikTok si existe una vía oficial autorizada; no asumir que sus estadísticas se obtienen como datos públicos sin credenciales.
- [ ] Confirmar que Instagram conectado sea exactamente `jus_chubut` y tenga permisos Meta válidos.
- [ ] Confirmar que YouTube use el canal de JusNoticias y no se sustituya por el canal general del Poder Judicial si no corresponde.
- [ ] Revisar Facebook: nombre/página institucional correcta y sin duplicados.
- [ ] Determinar qué estadísticas permite el canal de WhatsApp; no asumir que ofrece métricas equivalentes a las de otras redes.
- [ ] Mostrar «sin dato disponible» cuando una plataforma no entregue una métrica; no convertirlo en cero.
- [ ] Probar por red publicaciones, seguidores, reacciones, comentarios, compartidos y vistas solo cuando la plataforma ofrezca cada dato.

**Estado técnico conocido:** `api/redes.js` consultaba Facebook, Instagram y YouTube. X y TikTok no constaban integrados en ese endpoint cuando se revisó el código; verificar el estado de cualquier otra ruta antes de darlo por cerrado.

## 6. Google Analytics 4 y Search Console
- [x] La API de Google de Cloudflare Pages respondió correctamente en una prueba para 01/10/2026–19/10/2026.
- [x] En esa prueba: GA4 4.671 usuarios, 6.407 sesiones, 7.558 páginas vistas; Search Console 1.559 clics y 66.462 impresiones. Son datos de esa prueba, no cifras permanentes.
- [~] Revisar variables de producción de Cloudflare Pages: `GA4_PROPERTY_ID`, `GSC_SITE_URL`, secreto `GOOGLE_SERVICE_ACCOUNT_JSON`.
- [ ] Confirmar permisos de solo lectura de la cuenta de servicio en GA4 y Search Console.
- [ ] Probar la consulta de producción con varios rangos y comprobar errores/fechas incompletas.
- [ ] Mantener GA4 (actividad dentro del sitio) y Search Console (resultados de búsqueda) separados; no sumar sus métricas.
- [ ] Corregir `docs/GOOGLE_METRICS.md`, que aún menciona configuración en Vercel aunque esta ruta se preparó para Cloudflare Pages.

## 7. Seguridad
- [x] No incluir claves privadas ni tokens en el HTML público.
- [~] `api/redes.js` usa credenciales del servidor para proveedores que las requieren.
- [ ] Revisar si el endpoint de redes puede invocarse sin autenticación y valorar el riesgo según el carácter público/privado de los datos.
- [ ] Revisar exposición de errores del proveedor, parámetros de fecha, paginación, caché y posibles URLs con credenciales.
- [ ] Confirmar que tokens no aparezcan en logs ni respuestas.

## 8. Claridad visual y documentación
- [~] Portada tipo infografía ejecutiva con identidad visible “JusNoticias” y subtítulo “Tablero de repercusión y comunicación judicial”, título del navegador actualizado, indicadores dinámicos y botón de ingreso al tablero completo; falta validación visual en navegador.
- [~] Preparar etiquetas en lenguaje sencillo para usuarios, sesiones, vistas, clics e impresiones.
- [~] Manual `docs/MANUAL_TABLERO.md` actualizado con frecuencia cada dos horas.
- [ ] Corregir referencias restantes a Vercel cuando corresponda Cloudflare Pages.
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
