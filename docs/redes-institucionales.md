# Inventario institucional de redes — Juschubut Noticias

Última actualización: 2026-10-21.

Este documento registra los perfiles y canales informados para el tablero de Juschubut Noticias. Los enlaces se toman como inventario de referencia aportado por el equipo; su existencia, titularidad y estado de acceso deben verificarse antes de configurar integraciones.

## Perfiles y canales

| Plataforma | Tipo | Enlace | Estado técnico |
|---|---|---|---|
| Instagram | Cuenta `@jus_chubut` | https://www.instagram.com/jus_chubut/ | Integración prevista; falta verificar `IG_USER_ID` y permisos Meta |
| YouTube | Canal JusNoticias Prensa | https://www.youtube.com/@jusnoticiasprensa2865 | Falta configurar/verificar `YT_KEY` y `YT_CANAL_ID` |
| TikTok | Cuenta `@juschubut` | https://www.tiktok.com/@juschubut | No consta integración en la función actual; evaluar API y métricas disponibles |
| WhatsApp | Canal institucional | https://whatsapp.com/channel/0029VaGP0tX0lwgpiNAnBb1p | No consta integración en la función actual; evaluar qué estadísticas pueden obtenerse |
| LinkedIn | Página Poder Judicial del Chubut | https://www.linkedin.com/company/poderjudicialchubut/home/ | No consta integración en la función actual; verificar permisos/API |
| X | Cuenta `@Jus_Noticias` | https://x.com/Jus_Noticias | Integración prevista; falta configurar/verificar `X_BEARER_TOKEN` y acceso API |
| Facebook | Perfil administrador `STJ Chubut 1` | https://www.facebook.com/stjchubut1 | Perfil con aproximadamente 5.000 amigos, según información del equipo. No contabilizar como tercera página institucional |
| Facebook | Página institucional Prensa STJ Chubut | https://www.facebook.com/prensastjchubut/ | Integración prevista; confirmar ID de página y permisos |
| Facebook | Página institucional STJ Chubut | https://www.facebook.com/STJCHUBUT/ | Integración prevista; confirmar ID de página y permisos |

## Criterio para Facebook

- `STJ Chubut 1` es el perfil administrador informado por el equipo; no debe contabilizarse como una tercera página institucional.
- Las dos páginas institucionales deben mantenerse diferenciadas en el inventario y, si la API lo permite, sus métricas deben consultarse y mostrarse por separado.
- Evaluar por separado cómo orientar a los aproximadamente 5.000 amigos del perfil hacia las páginas institucionales.
- No convertir, fusionar, eliminar ni modificar perfiles o páginas sin evaluación previa y autorización expresa. No asumir que los amigos de un perfil se transfieren automáticamente como seguidores de una página.

## Estado de la API de redes

La prueba compartida el 21/10/2026 de `/api/redes` devolvió un objeto `redes` vacío y estos faltantes:

- Facebook: `FB_PAGE_ID`.
- Instagram: `IG_USER_ID`.
- YouTube: `YT_KEY`.
- X: `X_BEARER_TOKEN`.

El código también contempla `META_TOKEN` para Facebook e Instagram, `YT_CANAL_ID` para YouTube y `X_USER_HANDLE` para X. Deben inspeccionarse las variables de entorno en Cloudflare sin revelar sus valores. Una respuesta HTTP 200 no implica que todas las integraciones estén funcionando.

Google Analytics 4 y Google Search Console forman parte del tablero de métricas web y no se cuentan como redes sociales.

## Instrucción de auditoría para la IA de Cloudflare

Estamos trabajando en Juschubut Noticias, del Poder Judicial del Chubut.

Proyecto Cloudflare Pages: `redes-jusnoticias`  
URL: https://redes-jusnoticias.pages.dev/  
Endpoint: `/api/redes`

Usá este inventario como referencia. Auditá el código y la configuración de `redes-jusnoticias` y `jusnoticias`, sin modificar nada.

1. Identificá las variables requeridas, cuáles están configuradas y cuáles faltan. No muestres secretos.
2. Verificá cómo obtener métricas de las dos páginas de Facebook por separado.
3. Aclarar qué estadísticas pueden obtenerse del perfil administrador y cuáles requieren herramientas/API de Meta.
4. Evaluá las métricas automáticas disponibles para Instagram, YouTube, TikTok, WhatsApp, LinkedIn y X.
5. Indicá permisos, credenciales, planes de API y accesos administrativos necesarios.
6. Proponé pruebas con datos reales, manejo de errores y protección del historial para evitar pérdida o duplicación de registros.
7. No inventes identificadores ni supongas que una API funciona porque devuelve HTTP 200.
8. No muestres claves, tokens, secretos ni credenciales en respuestas, código o registros.
9. No sobrescribas ni elimines el historial existente.
10. No crees, elimines ni modifiques variables, permisos, tokens, archivos, despliegues ni configuraciones sin autorización expresa.
11. Presentá el diagnóstico en español, por plataforma, con perfiles identificados, métricas disponibles, estado de integración, variables faltantes, permisos/limitaciones y próximo paso concreto.

Primero entregá el diagnóstico y esperá autorización antes de efectuar cambios.
