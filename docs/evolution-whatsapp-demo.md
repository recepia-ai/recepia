# Evolution API — transporte temporal de WhatsApp

> Entorno de demostración. No conecta ni autoriza conectar el número real del Hospital Dr. Patiño. Evolution usa una sesión de WhatsApp Web no oficial y debe operar únicamente con un número de pruebas prescindible.

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
2. Número: número E.164 exclusivo de pruebas.
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
4. Escanear el QR desde el teléfono de pruebas.

## Prueba E2E

1. Enviar un mensaje desde un segundo teléfono al número conectado a Evolution.
2. Confirmar que la conversación aparece en la vista WhatsApp del panel.
3. Confirmar que el agente se presenta como agente de IA del equipo del hospital.
4. Pedir una cita y verificar que el agente responde y utiliza el calendario existente.
5. Tomar el control desde el panel y enviar una respuesta manual.
6. Devolver el control a la IA y comprobar que la conversación continúa con el mismo contexto.
7. Forzar una consulta clínica y verificar que se deriva a una persona sin diagnosticar ni prescribir.
8. Reiniciar Evolution y comprobar que la sesión se recupera; si no, registrar la necesidad de volver a escanear el QR.

## Criterio de cierre de la demostración

El transporte temporal está listo cuando el E2E automático y manual funciona desde un WhatsApp de pruebas, la conversación y la cita quedan registradas en Recepia y los canales oficiales permanecen disponibles y pausados.

## Referencias

- [Documentación oficial: crear instancia](https://docs.evolutionfoundation.com.br/evolution-api/create-instance)
- [Documentación oficial: configurar webhook](https://docs.evolutionfoundation.com.br/evolution-api/set-webhook)
- [Documentación oficial: enviar texto](https://docs.evolutionfoundation.com.br/evolution-api/send-text-message)
- [Versiones oficiales de Evolution API](https://github.com/evolution-foundation/evolution-api/releases)
