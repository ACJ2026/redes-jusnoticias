# Revisión de consistencia del tablero — 27/10/2026

## Incidencia reproducida en los datos

La nota 14884, «Puerto Madryn: condenan a una comerciante por difamar a una vecina en redes sociales», tenía 24 medios distintos. Cinco registros aparecían como pendientes por conservar estados de búsqueda o enlaces de Google Noticias. Además, otros registros se contaban como confirmados solo por tener un enlace y el método genérico «Buscador web», sin evidencia explícita de revisión. La tabla de revisión manual aportada incluía enlaces originales para los 24 medios.

## Cambios preparados

1. Se actualizaron los 24 registros de esa nota con los enlaces directos aportados en la revisión y un método de verificación explícito. No se borraron registros ni se reconstruyó el historial completo.
2. El clasificador del tablero ya no considera verificada una publicación únicamente porque tenga una URL. Exige un método documentado de revisión, una URL HTTP(S) directa y que el registro no esté marcado como pendiente ni apunte a Google Noticias.
3. El pie de página ahora advierte si la fecha de relevamiento falta/no es válida o supera las 24 horas. La fecha del relevamiento no se presenta como garantía de que todas las APIs en vivo respondieron.
4. Se añadieron pruebas de regresión para el criterio de verificación y el aviso de datos vencidos.
5. Se documentó el cambio en `BITACORA.md`.

## Auditoría de alcance y limitaciones

- La lógica de resumen y detalle comparte el clasificador `esConfirmada`; corregir ese criterio evita que los conteos generales y las filas de detalle interpreten de forma distinta una URL encontrada por buscador.
- Las redes sociales y Google tienen consultas independientes. El sello de fecha de los datos históricos no garantiza actualidad de esas consultas; cada panel debe conservar sus propios estados de error/no disponible.
- Los registros automáticos de otros temas que solo indiquen «Buscador web» pasarán a pendientes hasta que exista evidencia de revisión documentada. Es una corrección deliberadamente conservadora: evita mostrar como verificado algo que el sistema no ha probado.
- Esta revisión no afirma que se hayan comprobado manualmente todos los enlaces de todo el histórico. La actualización de los 24 enlaces de la nota se basa en la revisión y URLs proporcionadas por el usuario.
- La rama todavía requiere ejecutar las pruebas, reconstruir `publico/index.html` y `publico/tablero_publico.html`, y confirmar el despliegue antes de dar la incidencia por cerrada.

## Validación pendiente

- [x] Suite `python3 -m unittest discover -s tests -v` (validación GitHub Actions 40507446150 y 40507548209).
- [x] `node --check` sobre el JavaScript extraído del HTML generado (validación GitHub Actions 40507548209).
- [x] Regeneración de `publico/index.html` y `publico/tablero_publico.html` (workflow 40507547948, correcto).
- [x] GitHub Actions y despliegue de producción verificados: Cloudflare Pages confirmó estado `success` para el commit `a30d206913741dd5babd3502242dd3b15e05d343` el 27/10/2026.
