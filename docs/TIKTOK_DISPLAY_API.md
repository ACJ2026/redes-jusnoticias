# Integración de TikTok Display API

## Rutas implementadas

- `GET /api/tiktok/auth`: muestra el formulario de conexión protegido por una clave administrativa.
- `POST /api/tiktok/auth`: limita a cinco los intentos fallidos por IP cada 15 minutos, valida la clave administrativa, guarda un `state` OAuth aleatorio (10 minutos) y redirige a TikTok.
- `GET /api/tiktok/callback`: consume el `state` de forma atómica y de un solo uso, intercambia el código OAuth y almacena los tokens solo en Cloudflare KV.
- `GET /api/tiktok`: renueva el access token cuando se acerca su vencimiento y consulta perfil y hasta 100 videos recientes.
- `GET /api/redes`: incorpora TikTok a la consulta de redes existente y devuelve publicaciones con fecha, likes, comentarios, compartidos y vistas cuando TikTok informa esos campos.

La implementación usa los endpoints oficiales de TikTok API v2. El access token vence normalmente a las 24 horas y el refresh token tiene su propio vencimiento; el servidor renueva y persiste ambos. Un bloqueo con vencimiento coordina renovaciones simultáneas. Ante fallos temporales de renovación conserva los tokens para permitir reintentos; si TikTok rechaza el refresh token con `invalid_grant`, elimina la autorización obsoleta y se debe volver a conectar la cuenta. La Display API devuelve metadatos de videos públicos y sus métricas disponibles; los campos opcionales ausentes se devuelven como `null`. La autorización y aprobación de scopes deben estar completas para la cuenta.

## Configuración necesaria en Cloudflare Pages

Configurar en **Preview** primero, y luego replicar por separado en **Production** cuando se apruebe el despliegue:

### Variables de entorno

| Variable | Tipo | Uso |
|---|---|---|
| `TIKTOK_CLIENT_KEY` | texto | Client Key de TikTok Developers |
| `TIKTOK_CLIENT_SECRET` | secreto | Client Secret de TikTok Developers |
| `TIKTOK_CONNECT_KEY` | secreto | Clave administrativa propia para impedir que visitantes reemplacen la cuenta conectada |
| `TIKTOK_REDIRECT_URI` | texto | URI exacta registrada en TikTok; debe corresponder al entorno |
| `TIKTOK_KV` | binding de Cloudflare KV | Namespace privado para guardar tokens OAuth |
| `TIKTOK_AUTH_DB` | binding de Cloudflare D1 | Base de datos para limitar intentos, consumir state de forma atómica y coordinar renovaciones |

**No crear `TIKTOK_ACCESS_TOKEN` ni `TIKTOK_OPEN_ID` como variables manuales.** Los tokens y el open_id se guardan en KV en el callback; así el servidor puede renovarlos y conservar el refresh token rotado.

### Almacenamiento de autenticación

Crear un namespace KV dedicado para TikTok y vincularlo a la Pages Function con el nombre exacto `TIKTOK_KV`. Los tokens de acceso y renovación se guardan únicamente ahí. Para Preview y Production, usar namespaces separados para que la autorización de prueba no interfiera con la cuenta conectada en producción. No compartir el contenido de KV ni copiar tokens en archivos o mensajes.

Crear una base D1 independiente para Preview, vincularla solo al entorno Preview con el nombre `TIKTOK_AUTH_DB` y aplicar `migrations/0001_tiktok_auth_security.sql` a esa base (por ejemplo, con `wrangler d1 execute <NOMBRE_DB_PREVIEW> --remote --file=migrations/0001_tiktok_auth_security.sql`). La tabla de intentos conserva HMACs de IP, no direcciones IP en texto. El consumo atómico de state y el bloqueo de renovación también requieren esa base. La integración falla de forma cerrada si el binding o las tablas no están disponibles; **no iniciar OAuth antes de configurar y aplicar la migración en Preview**. No reutilizar esta base en Production.

### URI de retorno

La URI registrada debe coincidir exactamente con `TIKTOK_REDIRECT_URI` y con la usada en el intercambio del código.

- Producción: `https://jusnoticias.pages.dev/api/tiktok/callback` (única dirección de producción; `redes-jusnoticias.pages.dev` está descartada)
- Preview configurado en Cloudflare para esta rama: `https://feature-tiktok-display-oauth.jusnoticias.pages.dev/api/tiktok/callback`

El valor de Preview `TIKTOK_REDIRECT_URI` debe ser exactamente la URL anterior. El código la valida y no deriva una URI alternativa del host de la solicitud. Confirmar también que TikTok Developers tenga registrada esa misma URI; no se puede comprobar desde la configuración de Cloudflare.

En TikTok Developers deben estar configurados Login Kit y los scopes `user.info.basic`, `user.info.stats` y `video.list`. La autorización de usuario no sustituye la aprobación previa de los scopes que TikTok someta a revisión.

## Flujo de conexión de prueba

1. Configurar las variables, los bindings KV y D1 y aplicar la migración únicamente en Preview.
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
- Después de cinco intentos fallidos desde una IP, el sexto y los posteriores reciben `429` durante el resto de la ventana de 15 minutos. La base D1 debe estar disponible para que el flujo OAuth funcione.
- Esta integración no publica videos ni consulta WhatsApp.
