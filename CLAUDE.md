# Instrucciones para Claude (mismo contenido que AGENTS.md)

Este repositorio es el tablero de repercusión de Juschubut Noticias. Antes de cualquier cambio, leé `docs/REGLAS_IA.md`, `REGLAS.md` y la última entrada de `BITACORA.md`.

Reglas obligatorias (detalle y errores ya cometidos en `docs/REGLAS_IA.md`):

1. Nada directo en `main`: siempre rama + PR; fusionar solo con `validar`, `pruebas-historial` y Cloudflare Pages en verde.
2. Confirmar o descartar publicaciones de una nota puntual se hace en `data/revision_manual.json` o con los botones del tablero, nunca con listas por nota en el código.
3. Las pruebas verifican mecanismos, no cantidades de los datos reales (`data/*.json`).
4. No cambiar la concurrencia de `.github/workflows/actualizar.yml` (`cancel-in-progress: false`) ni lanzar corridas en cadena.
5. Consultar con Ignacio antes de cambiar qué se cuenta o cómo se detecta una publicación.
6. Leer el motivo real de un error antes de corregir; no declarar nada resuelto sin una corrida exitosa y la fecha nueva en `data/actualizado.txt`.
7. Revisar PR abiertos y últimos cambios de `main` antes de empezar; anotar todo en `BITACORA.md`.
8. No borrar filas históricas ni inventar resultados. Escribir en español, en lenguaje simple.
9. Toda difusión de una nota de JusNoticias cuenta (copia, versión propia o copia de otro medio).
10. Las mejoras de detección son hacia adelante: no completar notas anteriores salvo pedido de Ignacio.

Comprobaciones antes de abrir un PR:
- `python3 -m unittest discover -s tests -v`
- Si cambia `templates/tablero.html`: `python3 scripts/armar_publico.py data/notas2.json data/rep2.json data/redes2.json data/canales.json data/medios.json publico/tablero_publico.html && cp publico/tablero_publico.html publico/index.html`

## Orden de chats (regla de Ignacio, 04/11/2026)

Cada chat es de un solo proyecto, y su nombre empieza con el proyecto:

| Prefijo del chat | Proyecto | Repositorio |
|---|---|---|
| «Jurisprudencia ·» | Búsqueda de fallos, fichas y notas para JusNoticias | `ignacervo-cell/panel-agentes` |
| «AME ·» | AME, incluidos el Financiero, la cartera, Bitso y BTC | `ignacervo-cell/panel2` |
| «Tablero ·» | Tablero de repercusión de JusNoticias | `ACJ2026/redes-jusnoticias` |
| «Trading ·» | Copy trading en BingX y otros brokers para lo mismo, separado de AME | `ignacervo-cell/mi-trading` |
| «Personal ·» | Temas personales | — |

Si Ignacio pide algo de **otro** proyecto, no se hace en este chat:
1. se le manda al chat de ese proyecto con `send_message`, con el contexto necesario (los chats se buscan con `list_sessions` por el prefijo del título);
2. si no existe, se crea uno con `create_session`, con su repositorio y un título con el prefijo;
3. se le avisa a Ignacio a qué chat se pasó;
4. si no está claro de qué proyecto es, se le pregunta antes.

El chat que recibe el pedido no publica, no sube cambios y no borra nada sin la confirmación de Ignacio en ese chat.
