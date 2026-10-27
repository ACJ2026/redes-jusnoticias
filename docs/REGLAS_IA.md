# Reglas para las IAs que trabajan en el tablero (Claude y GPT/Codex)

Leer este archivo, `REGLAS.md` y la última entrada de `BITACORA.md` **antes de hacer cualquier cambio**.

## Reglas

1. **Nada directo en `main`.** Siempre rama + PR. Se fusiona solo con los chequeos en verde: `validar`, `pruebas-historial` y Cloudflare Pages.
2. **Las correcciones de notas puntuales son datos, no código.** Confirmar o descartar una publicación se carga en `data/revision_manual.json` (`nota_id`, `medio`, `url`, `decision` "confirmar" o "descartar", `fecha`, `motivo`) o con los botones del tablero. No agregar listas por número de nota en `scripts/actualizar.py` ni en `scripts/verificar_publicaciones.py`.
3. **Las pruebas verifican mecanismos, no cantidades.** No escribir pruebas que exijan un número de medios o publicaciones de los datos reales: corren antes de guardar y frenan la actualización cuando los datos cambian.
4. **No cambiar la concurrencia de `.github/workflows/actualizar.yml`** (debe quedar `cancel-in-progress: false`) ni lanzar corridas en cadena. Cada empuje al recolector dispara una actualización.
5. **Consultar con Ignacio antes de cambiar qué se cuenta o cómo se detecta** una publicación (incluye qué métodos cuentan como verificados y los umbrales de coincidencia).
6. **Leer el motivo real del error antes de corregir.** No declarar nada resuelto sin una corrida terminada con éxito y la fecha nueva en `data/actualizado.txt`.
7. **Coordinar:** revisar los PR abiertos y los últimos cambios de `main` antes de empezar, y anotar cada cambio en `BITACORA.md` (qué, por qué, PR y resultado).
8. **No borrar filas de datos históricos** ni inventar resultados (ver `REGLAS.md`).

## Errores ya cometidos que no deben repetirse (24 al 27/10/2026)

| # | Qué pasó | Consecuencia | Corrección |
| --- | --- | --- | --- |
| 1 | El verificador reemplazaba la URL por la final tras una redirección sin guardar la anterior (#95). El primer arreglo (#99) actuaba en otro paso | El control de historial frenó el guardado ~12 h (EQS Notas, nota 14593) | #101: la URL vieja va a `url_alternativas` |
| 2 | Prueba que exigía el texto literal "Buscar en Instagram", que se arma en el navegador (#107) | Fallaba siempre e iba a frenar la actualización | #108 |
| 3 | Se fusionó #107 aunque el propio PR decía "no integrar hasta confirmar las pruebas"; se interpretó como falla rara que los trabajos no arrancaran | GitHub Actions estaba frenado por facturación y nadie lo vio | Leer el aviso; repositorio público y relevamiento cada 4 h (#108) |
| 4 | Commits subidos directo a `main` (unos 40 desde el 26/10; los del #106 con el PR abierto) | Sin revisión; cada empuje disparaba corridas | Regla 1 |
| 5 | Filas del detalle con 7 celdas y encabezado de 6; botón Descartar con clase de ayuda (#97) | Botones grandes y superpuestos, etiquetas corridas en celular | #102 y #103 |
| 6 | Listas fijas por nota (14884 y 14664) en `actualizar.py` y `verificar_publicaciones.py` | Un parche nuevo por cada nota con problemas | #126: pasadas a `data/revision_manual.json` |
| 7 | Pruebas con números de los datos ("la 14884 tiene 24 medios"); el número se cambió a 21 y otra vez a 24 | La corrida del 27/10 10:40 no guardó | #126: pruebas del mecanismo |
| 8 | `cancel-in-progress: true` en `actualizar.yml` | 4 corridas canceladas seguidas; sin datos nuevos desde las 06:45 del 27/10 | #126: vuelve a `false` |
| 9 | `metodoVerificado` no incluía "Confirmada manualmente" (#120) | Lo confirmado con el botón Confirmar dejó de contar | #126 |
| 10 | Cambios de conteo sin consultar: 49 publicaciones de buscador dejaron de contarse (#120) y criterio de "misma nota" más estricto (#122) | Cambian las cifras del tablero | Pendiente de decisión de Ignacio |
| 11 | PR #88 contradice el criterio decidido (número principal = total de medios) | Confusión sobre qué se muestra | Cerrar o actualizar #88; revisar #94, #104, #117, #123 y #124 |
