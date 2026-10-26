# Nota de trabajo: ampliar cobertura de YouTube

**Fecha:** 26 de octubre de 2026  
**Rama:** `mejora/cobertura-redes-youtube`

## Hallazgo
El radar ya revisaba canales inventariados, pero solo la primera página de 25 videos por canal. En canales con publicaciones frecuentes podía omitir videos que todavía estaban dentro de la ventana de 30 días.

## Cambio propuesto
- Consultar hasta 3 páginas de 25 videos por canal (máximo 75).
- Detener la paginación cuando la página ya contiene videos anteriores a la ventana de búsqueda.
- Informar cuántos videos se revisaron y cuántos canales alcanzaron el tope de paginación.
- Mantener coincidencias dudosas como «A verificar»; no convertir esta mejora en una afirmación de cobertura total.

## Validación pendiente
Se añadieron comprobaciones estáticas al test del radar y se actualizó `docs/AUDITORIA_COBERTURA_REDES.md`. No se pudo anexar esta entrada directamente al archivo histórico `BITACORA.md` mediante la herramienta disponible, por lo que esta nota deja la trazabilidad del cambio sin reemplazar ni truncar la bitácora existente. GitHub Actions puede no ejecutar los checks debido al límite de minutos documentado en la bitácora. Antes de fusionar se debe revisar el diff y probar la función con credenciales reales.
