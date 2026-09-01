# Evolution API — transporte temporal de WhatsApp

> Entorno de demostración. Desde el 29 de agosto de 2026, el Hospital Dr. Patiño ha autorizado vincular temporalmente su móvil `+34 605 413 875` para estas pruebas. Evolution usa una sesión de WhatsApp Web no oficial; la autorización debe revocarse y la sesión debe cerrarse al terminar la demostración si no se decide mantener este transporte.

## Arquitectura

- Evolution API/Baileys mantiene la sesión de WhatsApp y actúa solo como transporte.
- Recepia recibe `MESSAGES_UPSERT` en `POST /api/channels/whatsapp/evolution`.
- El adaptador transforma el payload al contrato omnicanal existente y reutiliza el mismo agente, CRM, calendario, escalación y toma de control manual.
- Las respuestas automáticas y manuales salen por `POST /message/sendText/{instanceName}`.
- Los adaptadores `meta_cloud` y `360dialog` se conservan sin cambios para volver al transporte oficial.

## Seguridad

- `EVOLUTION_WEBHOOK_SECRET`: secreto aleatorio configurado en Vercel y enviado por Evolution mediante el header `x-recepia-webhook-secret`.
- La API key de Evolution se guarda únicamente en Supabase Vault mediante Ajustes → Integraciones.
- La URL, el nombre de instancia y el número identificador son configuración por clínica en `clinic_channels`.
- Solo puede existir un canal de WhatsApp activo por clínica; al activar Evolution, los canales oficiales quedan pausados, no eliminados.
- No se registran API keys, QR, credenciales de sesión ni tokens en este documento.

## Configuración del canal en Recepia

En **Ajustes → Integraciones → WhatsApp**:

1. Proveedor: `Evolution API (demostración temporal)`.
2. Número: número E.164 autorizado para las pruebas (`+34605413875` en la demostración actual).
3. URL de Evolution API: URL base accesible desde el despliegue de Recepia.
4. Instancia: nombre exacto creado en Evolution, por ejemplo `recepia-demo`.
5. API key: introducirla directamente en el campo protegido.

## Configuración de Evolution

1. Usar la última versión estable validada. A 23 de agosto de 2026 es `v2.3.7`; `2.4.0-rc2` sigue siendo una versión preliminar y añade activación de licencia.
2. Crear una instancia con integración `WHATSAPP-BAILEYS` y QR habilitado.
3. Configurar el webhook de la instancia con:
   - URL: `https://recepia-panel.vercel.app/api/channels/whatsapp/evolution`
   - Evento: `MESSAGES_UPSERT`
   - Header: `x-recepia-webhook-secret: <EVOLUTION_WEBHOOK_SECRET>`
   - Base64: desactivado.
4. Vincular el teléfono desde **Dispositivos vinculados → Vincular con número de teléfono**
   usando el código temporal de ocho caracteres devuelto por Evolution. El QR queda como método
   alternativo, ya que WhatsApp rechazó repetidamente los QR de Baileys para el número del hospital.

Validación del 29-08-2026: la instancia `recepia-demo` se recreó sin las credenciales residuales del
número anterior y `+34605413875` quedó conectado correctamente mediante código de vinculación.

### Ejecución local para la demostración

1. Iniciar Colima y levantar el stack conservando sus volúmenes:

   ```bash
   colima start
   docker-compose --env-file infra/evolution/.env -f infra/evolution/docker-compose.yml up -d
   ```

2. Comprobar `http://127.0.0.1:8080/`; debe devolver la versión `2.3.7`.
3. Para una prueba puntual puede publicarse temporalmente esa URL:

   ```bash
   cloudflared tunnel --url http://127.0.0.1:8080 --no-autoupdate
   ```

4. Los Quick Tunnels son efímeros y ya no son el transporte habitual de la demostración. El túnel nombrado `recepia-evolution-demo` expone Evolution mediante `https://evolution.iatope.com`, usa `infra/evolution/cloudflared-config.yml` y está instalado como servicio de usuario de macOS.
5. Mantener Colima y los contenedores de Evolution activos. `cloudflared` se inicia automáticamente mientras el usuario de macOS esté conectado. Para producción definitiva, Evolution debe trasladarse a infraestructura permanentemente encendida.

Si el Quick Tunnel caduca, Recepia puede haber generado y guardado la respuesta de la IA sin que WhatsApp la haya aceptado. El panel marca esos mensajes como **No entregado**, pasa la conversación a `awaiting_human` y no debe reenviar automáticamente el texto para evitar duplicados. La recuperación correcta es: crear un túnel nuevo, actualizar la URL base del canal, comprobar que la instancia está `open` y devolver después la conversación al agente.

Al devolver una conversación al agente, la escalación activa queda archivada en el historial. Los resultados de calendario de turnos anteriores son históricos: una petición nueva de disponibilidad debe ejecutar de nuevo las herramientas y no reutilizar un error antiguo como si siguiera vigente.

En `v2.3.7`, `POST /webhook/set/{instanceName}` espera la configuración dentro de una propiedad raíz `webhook`, aunque la documentación más reciente muestre el objeto directamente. La verificación posterior debe hacerse con `GET /webhook/find/{instanceName}` sin registrar ni mostrar `headers`.

Antes del QR deben cumplirse estas comprobaciones:

- El webhook de Recepia sin secreto devuelve `401`.
- El mismo webhook, autenticado pero con un payload inválido, devuelve `400`.
- Un endpoint protegido de Evolution a través del túnel y sin `apikey` devuelve `401`.

## Prueba E2E

1. [x] Enviar un mensaje desde un segundo teléfono al número conectado a Evolution.
2. [x] Confirmar que la conversación aparece en la vista WhatsApp del panel y se actualiza sin recargar (comprobación autenticada cada 3 segundos).
3. [x] Confirmar que el agente se presenta como agente de IA del equipo del hospital.
4. [x] Pedir una cita y verificar que el agente responde y utiliza el calendario existente.
5. [x] Tomar el control desde el panel, enviar una respuesta manual y comprobar que la IA permanece en silencio.
6. [x] Devolver el control a la IA y comprobar que la conversación continúa con el mismo contexto.
7. Forzar una consulta clínica y verificar que se deriva a una persona sin diagnosticar ni prescribir.
8. Reiniciar Evolution y comprobar que la sesión se recupera; si no, registrar la necesidad de volver a escanear el QR.

Validación del 27-08-2026: Laura solicitó una revisión general para Thor, eligió el 28-08-2026 a las 09:30 con Elisabeth Menasanch y confirmó la reserva. La cita quedó `confirmed` en Recepia, vinculada al cliente, mascota, servicio y veterinaria, con evento creado en el calendario dedicado de Google. Los eventos se envían con hora local y offset explícitos (`Europe/Madrid`) y textos operativos en español. La confirmación y el cierre de conversación fueron aceptados por Evolution y recibidos por WhatsApp.

## Criterio de cierre de la demostración

El transporte temporal está listo cuando el E2E automático y manual funciona desde un WhatsApp de pruebas, la conversación y la cita quedan registradas en Recepia y los canales oficiales permanecen disponibles y pausados.

## Referencias

- [Documentación oficial: crear instancia](https://docs.evolutionfoundation.com.br/evolution-api/create-instance)
- [Documentación oficial: configurar webhook](https://docs.evolutionfoundation.com.br/evolution-api/set-webhook)
- [Documentación oficial: enviar texto](https://docs.evolutionfoundation.com.br/evolution-api/send-text-message)
- [Versiones oficiales de Evolution API](https://github.com/evolution-foundation/evolution-api/releases)
