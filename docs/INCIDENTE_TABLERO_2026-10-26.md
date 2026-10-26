# Incidente de tablero — 26 de octubre de 2026

## Resumen

Se informó que los indicadores aparecían como «—» y que el botón «Ingresar al tablero completo» no respondía. La traza disponible mostraba estas funciones:

enlaceNotaSitioMedio → celdaNotaSitioMedio → dibujarCompartidos.

El usuario pidió investigar el historial de cambios, corregir sin exigir más pasos en el navegador y dejar documentada la causa probable y las acciones.

## Qué se encontró en el historial

1. El commit [9eb0c573](https://github.com/ACJ2026/redes-jusnoticias/commit/9eb0c5736a729c91e3eec2aced30015533fa2be5) incorporó la sección «Quién compartió nuestras notas en redes» y su renderizado sincrónico durante la inicialización.
2. El commit [6bb9cfcc](https://github.com/ACJ2026/redes-jusnoticias/commit/6bb9cfcc4a972a44dd6520826c2ec0e8d20cc3b2) corrigió enlaces de redes y usó enlaces directos a notas o perfiles conocidos; la lógica de resolución de enlaces de la tabla quedó más compleja.
3. Los commits [beed4d44](https://github.com/ACJ2026/redes-jusnoticias/commit/beed4d44e312b5b3e7c53566e29b4715c05f995f) y [099a0cf4](https://github.com/ACJ2026/redes-jusnoticias/commit/099a0cf4d85ff0b78d4f34b31372ac064e0a3fd0) desacoplaron la consulta del historial de revisiones para que una API lenta no bloqueara la pantalla. Esos cambios no alteraron las funciones de enlaces de compartidos.
4. El commit [c17d2045](https://github.com/ACJ2026/redes-jusnoticias/commit/c17d2045488ed7643cad0d63950c0117d5826505) reconstruyó los HTML públicos desde la plantilla actual. Esto mantiene la versión pública sincronizada, pero no evitaba que una excepción de una sección secundaria interrumpiera el resto del script.

## Diagnóstico

La traza identifica el área de la excepción, pero no incluye el mensaje inicial (TypeError, ReferenceError, etc.). Por eso **no es posible afirmar con rigor cuál propiedad o registro concreto disparó el error original**.

Sí se identificó un defecto de resiliencia: el renderizado de la tabla de compartidos se ejecutaba sin aislamiento dentro de la inicialización general. Si esa tabla arrojaba una excepción, el JavaScript podía detenerse antes de registrar los manejadores de los botones y ejecutar el renderizado de métricas. Esto coincide con los síntomas de indicadores vacíos y botón inactivo.

## Corrección aplicada al código fuente

En templates/tablero.html:

- Se validan y normalizan los arreglos y objetos usados por la sección.
- Se comprueba que las URL sean cadenas antes de evaluarlas como enlaces.
- Cada fila defectuosa se captura y se sustituye por un aviso, sin abortar el resto de la tabla.
- La inicialización completa de la sección queda protegida por try/catch. Si falla, se muestra un aviso local y el tablero continúa inicializando sus otras funciones.

Se agregó una prueba de regresión estática en tests/test_tablero_publico.py y esta bitácora se actualizó.

## Estado de publicación

El código fuente quedó actualizado en GitHub. La reparación **no se declara confirmada en producción** hasta verificar que CI pase, que la reconstrucción genere los dos HTML públicos, que Cloudflare Pages complete el despliegue y que el sitio de producción responda con el archivo nuevo. Esas comprobaciones deben quedar anotadas al terminar.
