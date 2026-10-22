# Integración de TikTok Display API

## Rutas implementadas

- `GET /api/tiktok/auth`: muestra el formulario de conexión protegido por una clave administrativa.
- `POST /api/tiktok/auth`: valida la clave administrativa, crea un `state` OAuth de un solo uso (10 minutos) y redirige a TikTok.
- `GET /api/tiktok/callback`: valida el `state`, intercambia el código OAuth y almacena los tokens solo en Cloudflare KV.
- `GET /api/tiktok`: renueva el access token cuando se acerca su vencimiento y consulta perfil y hasta 100 videos recientes.
- `GET /api/redes`: incorpora TikTok a la consulta de redes existente y devuelve publicaciones con fecha, likes, comentarios, compartidos y vistas cuando TikTok informa esos campos.

La implementación usa los endpoints oficiales de TikTok API v2. El access token vence normalmente a las 24 horas y el refresh token tiene su propio vencimiento; el servidor renueva y persiste ambos. La Display API devuelve metadatos de videos públicos y sus métricas disponibles; la autorización y aprobación de scopes deben estar completas para la cuenta.

## Configuración necesaria en Cloudflare Pages

Configurar en **Preview** primero, y luego replicar por separado en **Production** cuando se apruebe el despliegue:

### Variables de entorno

| Variable | Tipo | Uso |
|---|---|---|
| `TIKTOK_CLIENT_KEY` | texto | Client Key de TikTok Developers |
| `TIKTOK_CLIENT_SECRET` | secreto | Client Secret de TikTok Developers |
| `TIKTOK_CONNECT_KEY` | secreto | Clave administrativa propia para impedir que visitantes reemplacen la cuenta conectada |
| `TIKTOK_REDIRECT_URI` | texto | URI exacta registrada en TikTok; debe corresponder al entorno |
| `TIKTOK_KV` | binding de Cloudflare KV | Namespace privado para guardar state y tokens OAuth |

**No crear `TIKTOK_ACCESS_TOKEN` ni `TIKTOK_OPEN_ID` como variables manuales.** Los tokens y el open_id se guardan en KV en el callback; así el servidor puede renovarlos y conservar el refresh token rotado.

### Namespace KV

Crear un namespace KV dedicado para TikTok y vincularlo a la Pages Function con el nombre exacto `TIKTOK_KV`. Para Preview y Production, usar namespaces separados para que la autorización de prueba no interfiera con la cuenta conectada en producción. No compartir el contenido de KV ni copiar tokens en archivos o mensajes.

### URI de retorno

La URI registrada debe coincidir exactamente con `TIKTOK_REDIRECT_URI` y con la usada en el intercambio del código.

- Producción: `https://redes-jusnoticias.pages.dev/api/tiktok/callback`
- Preview de esta rama, si Cloudflare genera la URL de rama estándar: `https://feature-tiktok-display-oauth.redes-jusnoticias.pages.dev/api/tiktok/callback`

Verificar la URL real que Cloudflare asigna al preview antes de registrarla. No usar `jusnoticias.pages.dev` salvo que ese dominio esté efectivamente asignado a este proyecto.

En TikTok Developers deben estar configurados Login Kit y los scopes `user.info.basic`, `user.info.stats` y `video.list`. La autorización de usuario no sustituye la aprobación previa de los scopes que TikTok someta a revisión.

## Flujo de conexión de prueba

1. Configurar todas las variables y el binding KV en Preview.
2. Registrar la URI de callback de Preview en TikTok Developers.
3. Abrir `/api/tiktok/auth` en la URL de Preview.
4. Ingresar la `TIKTOK_CONNECT_KEY` (no es la Client Secret de TikTok) y continuar.
5. Iniciar sesión con la cuenta institucional `@juschubut` y aprobar los permisos.
6. Verificar `/api/tiktok` y después pulsar «Consultar fuentes disponibles» en la sección Redes.
7. Confirmar que el endpoint no expone tokens, que los errores de autorización quedan claros y que las métricas aparecen solo si la API las devuelve.

## Límites conocidos

- La consulta recupera como máximo 100 videos recientes por ejecución (cinco páginas de 20) y el endpoint `/api/redes?desde=AAAA-MM-DD` filtra esos resultados por la fecha solicitada. No equivale a un archivo histórico completo de todos los videos.
- La portada `cover_image_url` que devuelve TikTok es temporal; no debe tratarse como una URL permanente.
- La API puede no entregar métricas hasta que la aplicación y sus scopes estén aprobados y la cuenta haya autorizado el acceso.
- Esta integración no publica videos ni consulta WhatsApp.
