# Auditoría de falsas coincidencias — nota 14664 — 27/10/2026

## Nota original

«El Poder Judicial de Chubut participa del IV Congreso Nacional Penal Adolescente y Juvenil», publicada por Jusnoticias el 02/10/2026:
https://jusnoticias.juschubut.gov.ar/el-poder-judicial-de-chubut-participa-del-iv-congreso-nacional-penal-adolescente-y-juvenil/

## Causa raíz

El recolector `scripts/actualizar.py` comparaba cada artículo con la mejor nota dentro de una ventana de fechas, sin un umbral mínimo de relevancia para aceptar esa asociación. Una similitud de frases del 20% podía confirmar un artículo y una coincidencia de términos podía dejarlo pendiente. En noticias de eventos nacionales, compartir expresiones como «congreso penal adolescente y juvenil» no significa que el medio haya publicado la nota de Chubut.

El verificador `scripts/verificar_publicaciones.py` también usaba un umbral de título y cuerpo que no exigía suficiente evidencia de reproducción del mismo artículo. Esto permitía que notas independientes sobre el mismo congreso quedaran asociadas a la nota original.

## Qué se corrigió

- Se creó `scripts/relevancia_publicaciones.py` con un criterio común que exige evidencia sustancial en el cuerpo: términos compartidos, proporción del contenido oficial reproducido, proporción en el texto del medio y frases coincidentes. Además exige coincidencia específica del título o similitud de frases muy alta.
- `scripts/actualizar.py` solo asigna una publicación a una nota cuando el criterio común confirma que hay evidencia de la misma nota. No crea pendientes por mera similitud temática.
- `scripts/verificar_publicaciones.py` usa el mismo criterio. Si el texto no demuestra que es la misma publicación, lo excluye del conteo y guarda las métricas y el motivo; no lo declara confirmado.
- Se conservaron las filas históricas de la nota 14664, pero se marcaron como excluidas del conteo las asociaciones que no acreditan la misma publicación. No se borró historial.
- Se añadieron pruebas de regresión para una copia verdadera y para una noticia distinta sobre la participación de la Justicia chaqueña en el mismo evento.

## Resultado de la revisión de datos

Solo **Noticias PMY** queda contada como publicación de esta nota, con URL directa y título/contenido coincidentes.

Se excluyeron del conteo:
- CHACODIAPORDIA.COM: artículo sobre la participación de la Justicia chaqueña en el congreso.
- Del Mar Digital: cobertura propia del mismo evento, no reproducción de esta nota.
- Diario La Portada: encuentro con estudiantes sobre la ley penal juvenil.
- Metadata Noticias: capacitación sobre el régimen penal juvenil.
- Canal Doce Misiones: cobertura de la delegación de Misiones.
- La Nota San Juan: no se pudo acreditar que reproduzca esta nota.
- Diario Huarpe, El 10 TV, El Mediador - Santa Cruz, El Tribuno e InfoBariloche: solo había referencias de Google Noticias, no URL directa corroborada.

En las cinco referencias de Google Noticias, «excluida del conteo» significa que no hay prueba suficiente de esta publicación; no se afirma que esos medios nunca hayan publicado una noticia relacionada. Si aparece un enlace directo verificable, se podrá revisar por separado.

## Validación pendiente

- [ ] Ejecutar suite de regresión de GitHub Actions.
- [ ] Comprobar sintaxis de los scripts y del JavaScript público generado.
- [ ] Regenerar `publico/index.html` y `publico/tablero_publico.html`.
- [ ] Confirmar que el despliegue de Cloudflare Pages terminó correctamente.
- [ ] Revisar visualmente el tablero publicado; no dar por cerrada la incidencia solo porque el código pase las pruebas.
