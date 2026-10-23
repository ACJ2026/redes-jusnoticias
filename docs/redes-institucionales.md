# Inventario institucional de redes — Juschubut Noticias

Última revisión documental: 2026-10-23.

Este inventario separa las cuentas institucionales de los perfiles administradores y distingue lo que está documentado en el código de lo que fue validado con respuestas reales. La presencia de una variable o una respuesta HTTP 200 no demuestra, por sí sola, que las métricas sean correctas.

## Cuentas propias y estado de integración

| Plataforma | Cuenta o perfil | Datos identificados | Estado / próximo paso |
|---|---|---|---|
| Facebook | Página Prensa STJ Chubut | El código documenta el ID `116101835114568` para la primera página. | Confirmar nombre e identidad visibles en Meta y validar métricas en Pages con el token configurado. |
| Facebook | Página STJ Chubut / JusNoticias STJ | El código documenta el ID `761013867341405` como segunda página. | Mantenerla separada de la primera; validar métricas y permisos de forma independiente. |
| Facebook | Perfil administrador “STJ Chubut 1” | https://www.facebook.com/stjchubut1 | Es un perfil personal informado por el equipo, no una tercera página institucional. No sumar sus amigos como seguidores de las páginas. |
| Instagram | `@jus_chubut` | https://www.instagram.com/jus_chubut/ — ID documentado: `17841410514175238`. | Hay una prueba documentada de Graph API v26.0 del 22/10/2026: 2.610 seguidores y 2.938 publicaciones; también se probaron Insights para un rango explícito. Falta validar la consulta desde Cloudflare Pages con los secretos de producción. |
| YouTube | Canal de JusNoticias | La documentación del código menciona `@jusnoticiasprensa2865`, pero una auditoría posterior advirtió que el valor de respaldo podría apuntar a un canal que ya no se usa. | No usar el canal de respaldo automáticamente. Confirmar el enlace e ID del canal institucional vigente antes de configurar o interpretar métricas. |
| X | `@Jus_Noticias` | https://x.com/Jus_Noticias | La función de Pages usa `X_BEARER_TOKEN` y `X_USER_HANDLE`. Se informó un error HTTP 402 por saldo/créditos agotados de la API. Investigar primero el acceso a X Analytics y la exportación disponible; no asumir que una suscripción de consumo resuelve la detección de publicaciones de terceros. |
| TikTok | `@juschubut` | https://www.tiktok.com/@juschubut | Existe documentación de integración Display API y OAuth. Verificar autorización, callback de producción y almacenamiento seguro del token antes de dar las métricas por operativas. |
| WhatsApp | Canal Agencia de Comunicación Judicial | https://whatsapp.com/channel/0029VaGP0tX0lwgpiNAnBb1p | No sumar seguidores estimados obtenidos de una página pública sin validar que el dato sea estable y atribuible al canal. Confirmar qué métricas ofrece oficialmente la plataforma. |
| LinkedIn | Página Poder Judicial del Chubut | https://www.linkedin.com/company/poderjudicialchubut/home/ | Cuenta incorporada al inventario institucional. Verificar administración, permisos y disponibilidad de API antes de prometer métricas automáticas. |

## Variables documentadas para Cloudflare Pages

La ruta principal es `functions/api/redes.js`. Los nombres de variables documentados en `docs/REDES_SOCIALES.md` son:

- Meta/Facebook e Instagram: `META_TOKEN`, `FB_PAGE_ID`, `FB_PAGE_ID_2`, `FB_PAGE_TOKEN`, `FB_PAGE_TOKEN_2`, `IG_USER_ID`.
- YouTube: `YT_KEY`, `YT_CANAL_ID`.
- X: `X_BEARER_TOKEN`, `X_USER_HANDLE` (opcional; por defecto `Jus_Noticias`).
- TikTok: revisar `docs/TIKTOK_DISPLAY_API.md` para los secretos, OAuth y almacenamiento requeridos.

Los valores secretos deben revisarse exclusivamente en la configuración de Cloudflare Pages; no copiarlos a este documento, al repositorio, a incidencias ni a registros. Los identificadores de páginas/canales no sustituyen los permisos ni la validación de los datos.

## Criterios para el tablero

1. Mantener las dos páginas de Facebook como fuentes distintas. Un fallo de una no debe borrar ni ocultar los datos válidos de la otra.
2. No contar el perfil personal “STJ Chubut 1” como página ni equiparar amigos con seguidores.
3. No presentar una métrica no disponible como cero. Conservar el error por plataforma sin mostrar tokens ni credenciales.
4. Separar las estadísticas de las cuentas propias de la detección de publicaciones de otros medios que comparten notas de JusNoticias. Son problemas distintos y pueden tener límites de API diferentes.
5. No sumar métricas de plataformas distintas en un total general si sus definiciones y períodos no son comparables.
6. Para toda cifra mostrada, identificar la plataforma y el período. Antes de cerrar una implementación, contrastar los valores con la fuente oficial y con la respuesta de la API.
7. No modificar, eliminar ni sobrescribir el historial existente al cambiar las consultas en vivo.

## Próximas verificaciones

- [ ] Confirmar visualmente las dos páginas de Facebook y probar cada una por separado desde Cloudflare Pages.
- [ ] Repetir la consulta de Insights de `@jus_chubut` desde el entorno de Pages; la prueba en Graph API Explorer no valida por sí sola el entorno desplegado.
- [ ] Confirmar el canal oficial vigente de YouTube y su ID; quitar cualquier respaldo automático a un canal obsoleto.
- [ ] Revisar si la cuenta administradora de `@Jus_Noticias` puede abrir X Analytics y exportar datos de publicaciones propias sin contratar la API. No dar por hecho que Analytics permite detectar publicaciones de terceros.
- [ ] Validar permisos y límites de TikTok y LinkedIn.
- [ ] Investigar la disponibilidad de métricas oficiales para el canal de WhatsApp antes de implementar una cifra.
- [ ] Ejecutar `python3 -m unittest discover -s tests -v` y comprobar la vista previa de la rama. La vista previa no equivale a validar producción.

## Referencias internas

- [Estado técnico de redes sociales](REDES_SOCIALES.md)
- [Documentación de TikTok Display API](TIKTOK_DISPLAY_API.md)
- [README del proyecto](../README.md)
