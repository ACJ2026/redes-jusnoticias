# Incidente: enlaces de publicaciones compartidas sin validar

**Fecha:** 26 de octubre de 2026  
**Área:** «Quién compartió nuestras notas en redes»  
**Estado:** corrección de código y prueba de regresión incorporadas; despliegue y comprobación real en producción pendientes de confirmación.

## Síntoma

Algunas filas mostraban «Ver publicación directa», pero el destino podía abrir una publicación cuyo contenido no correspondía a la nota de JusNoticias. Esto hacía que una coincidencia de palabras pareciera una atribución confirmada.

## Causa encontrada en el código

1. `functions/api/compartidos.js` relaciona textos de redes con títulos de notas. Las coincidencias que no son concluyentes se marcan `verificacion: "a_verificar"`; las coincidencias con evidencia fuerte se marcan `verificacion: "fuerte"`.
2. La plantilla `templates/tablero.html` ignoraba ese estado al construir la celda de enlace: bastaba con que `publicacion_url` empezara con `http://` o `https://` para rotularla «Ver publicación directa». Por eso una candidata débil podía verse igual que una publicación confirmada.
3. Los registros históricos que solo tenían una URL tampoco guardaban necesariamente una decisión de verificación. La plantilla los trataba como directos por el mero formato de la URL.
4. El título «Adopciones: Convocatoria Pública Provincial» aparece en varias notas de fechas distintas. Por ello, una coincidencia parcial de palabras no debe bastar para asegurar qué nota fue compartida.

## Qué se había cambiado antes y por qué no alcanzó

- El commit [9eb0c573](https://github.com/ACJ2026/redes-jusnoticias/commit/9eb0c5736a729c91e3eec2aced30015533fa2be5) incorporó la sección de publicaciones compartidas.
- El commit [6bb9cfcc](https://github.com/ACJ2026/redes-jusnoticias/commit/6bb9cfcc4a972a44dd6520826c2ec0e8d20cc3b2) amplió la resolución de enlaces. La lógica comprobaba el formato y la asociación por nota/medio, pero el renderizado del post social seguía sin exigir evidencia fuerte de contenido.
- Los commits [beed4d44](https://github.com/ACJ2026/redes-jusnoticias/commit/beed4d44e312b5b3e7c53566e29b4715c05f995f) y [099a0cf4](https://github.com/ACJ2026/redes-jusnoticias/commit/099a0cf4d85ff0b78d4f34b31372ac064e0a3fd0) desacoplaron la carga del historial de revisiones para que una API lenta no bloqueara el tablero.
- El commit [c17d2045](https://github.com/ACJ2026/redes-jusnoticias/commit/c17d2045488ed7643cad0d63950c0117d5826505) reconstruyó el HTML público desde la plantilla vigente.
- Una corrección posterior aisló los errores de la tabla para que una fila defectuosa no detuviera toda la inicialización. Eso resolvía la robustez de la interfaz, pero no comprobaba la exactitud semántica de los enlaces. El mensaje inicial de la excepción del navegador nunca quedó disponible, así que no se afirma una causa exacta para aquella excepción.

## Corrección aplicada

- Solo se muestra un enlace de publicación como **«Abrir publicación coincidente»** cuando la API la clasifica con evidencia fuerte (`verificacion === "fuerte"`).
- Las coincidencias débiles se mantienen identificadas como candidatas, pero su URL queda oculta hasta comprobar el contenido.
- Los enlaces históricos sin un estado explícito de verificación también quedan ocultos; una URL con formato válido no es prueba de que sea la publicación correcta.
- El resumen separa «coincidencias fuertes» de «candidatas sin confirmar», para que las candidatas no se cuenten como publicaciones confirmadas.
- Se agregó una prueba de regresión que exige estos controles.

## Comprobaciones para cerrar el incidente

1. Ejecutar `python3 -m unittest discover -s tests -v`.
2. Confirmar que el workflow de reconstrucción publica ambos HTML generados a partir de `templates/tablero.html`.
3. Confirmar que Cloudflare Pages despliega el commit correctivo en producción.
4. Abrir `https://jusnoticias.pages.dev/`, pulsar «Buscar ahora» y verificar que solo las coincidencias fuertes tengan enlace directo. Revisar por separado las candidatas sin confirmar.
5. Si un enlace fuerte abre contenido distinto, conservar el caso como incidencia y revisar el permalink/texto devuelto por la API de origen; no volver a rotularlo como confirmado solo por su formato.

**Límite importante:** «evidencia fuerte» significa que el texto o el enlace devuelto por la fuente coincide de manera fuerte con la nota; no garantiza que una plataforma no cambie o retire el post después de la consulta.