# Seguimiento: HTML obsoleto en «Quién compartió nuestras notas en redes»

**Fecha:** 26 de octubre de 2026  
**Síntoma reportado:** la interfaz muestra «A verificar (3 de 4 palabras del título en común)» y, al mismo tiempo, «Ver publicación directa»; al abrir el destino, el contenido no corresponde a la nota.  
**Estado:** se agregó una regla de no caché para el HTML público. El despliegue debe confirmarse en Cloudflare después del commit; la comprobación visual en navegador sigue pendiente.

## Hallazgo

El código vigente de `templates/tablero.html` y `publico/index.html` ya exige `verificacion === "fuerte"` para mostrar un enlace de publicación como «Abrir publicación coincidente». Para una fila `a_verificar`, debe ocultar el destino y mostrar «Candidata sin confirmar; enlace oculto». El texto reportado por el usuario («Ver publicación directa») contradice ese código vigente.

La API de Cloudflare Pages informa despliegues de producción exitosos para el proyecto `jusnoticias`, incluido el despliegue del commit `1700d68d3946a69288c6eb03b3195ef68904c665` del 26/10/2026 a las 21:55 UTC. No fue posible recuperar el HTML publicado mediante el navegador de esta sesión (error de caché de la herramienta web) ni hacer una prueba visual interactiva. Por eso, la hipótesis principal es que se estaba sirviendo HTML anterior desde alguna caché, pero no se presenta como causa definitivamente demostrada.

## Corrección de esta iteración

Se añadió `publico/_headers` con `Cache-Control: no-cache, no-store, must-revalidate` para `/`, `/index.html` y `/tablero_publico.html`, para reducir la posibilidad de que la página pública conserve un render anterior a la corrección. Esto no valida por sí mismo el contenido de cada permalink: únicamente evita reutilizar HTML obsoleto en esos paths.

## Historial de cambios previos y por qué no bastaron

- `9eb0c573`: incorporación inicial de la sección de publicaciones compartidas.
- `6bb9cfcc`: ampliación de la resolución de enlaces; comprobar formato/relación no garantizaba que la interfaz respetara la verificación semántica.
- `beed4d44` y `099a0cf4`: desacoplaron el historial de revisiones de la carga inicial; esto atiende el bloqueo del tablero, no la exactitud de los enlaces.
- `c17d2045`: reconstrucción de HTML público desde la plantilla vigente.
- `c9d8de8c`: ocultar enlaces sociales sin verificar.
- `ff70d7ff`: prueba de regresión para impedir enlaces sin verificar.
- `88f86cdd`, `ddeeeff5`, `4905dfc3`, `9abb60da`, `0a4e2b70`, `72d950f2`: documentación del incidente y de las validaciones/despliegues. La documentación anterior anotó correctamente que no se había comprobado visualmente en el navegador, pero se dio por cerrada la parte de despliegue sin resolver la discrepancia que el usuario siguió observando.
- `1700d68d`: actualización automática de datos; no modifica la lógica de enlaces.

## Criterio para cerrar el incidente

1. Confirmar que el nuevo despliegue de Cloudflare termina en `success` e incluye `publico/_headers`.
2. Abrir la URL canónica en una ventana privada o tras recarga forzada y verificar que una fila «A verificar» no tenga enlace clicable a la publicación.
3. Solo mostrar un enlace de publicación como coincidente cuando la evidencia de origen lo sostenga. Si el enlace oficial de Meta/YouTube aun así abre contenido distinto, tratarlo como una incidencia de permalink y revisar el objeto y el texto devueltos por la API; no degradar el control a una mera comprobación de que la URL comienza por HTTPS.

**Límite:** desde esta sesión no se pudo inspeccionar el contenido real de la página en un navegador. El estado de despliegue puede verificarse por API, pero no equivale a una prueba visual de que la caché del cliente quedó invalidada.
