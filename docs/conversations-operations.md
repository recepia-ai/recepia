# Operación de Conversaciones

Estado: implementación técnica compilada; activación de proveedores y E2E reales pendientes.

## Puntos de entrada

- Chat web público: `https://<panel>/chat/<clinic-slug>`.
- Mensajes web: `POST /api/channels/web/message`.
- Sincronización de respuestas humanas web: `GET /api/channels/web/messages`.
- Webhook 360dialog: `POST /api/channels/whatsapp/360dialog`.
- Webhook Meta Cloud API: `GET|POST /api/channels/whatsapp/meta`.
- Server URL de Vapi: `POST /api/channels/phone/vapi`.

Los tres canales escriben en las mismas tablas `conversations`, `messages` y
`channel_events`. Las llamadas añaden `call_sessions`.

## Secretos

No pegar claves de 360dialog o Vapi en tickets, documentación, commits ni chats.
Un administrador las introduce en **Ajustes → Integraciones**. La Server Action
las envía directamente a Supabase Vault y `clinic_channels` solo conserva el UUID
del secreto cifrado.

Los secretos de autenticación de webhooks son variables del despliegue:

- `WHATSAPP_WEBHOOK_SECRET`: configurar en 360dialog como header
  `X-Recepia-Webhook-Secret`, o como `Authorization: Bearer <secreto>`.
- `META_WHATSAPP_VERIFY_TOKEN`: token aleatorio del desafío de verificación del
  webhook directo de Meta.
- `META_WHATSAPP_APP_SECRET`: App Secret usado para validar la firma
  `X-Hub-Signature-256` antes de procesar eventos de Meta.
- `VAPI_WEBHOOK_SECRET`: configurar como credencial/header `X-Vapi-Secret`.
- `WEB_CHAT_ALLOWED_ORIGINS`: orígenes adicionales separados por comas. El
  propio dominio del panel siempre está permitido.

## Configuración de 360dialog

En **Ajustes → Integraciones → WhatsApp**:

- Número en E.164 (`+34...`).
- `phone_number_id` entregado por Meta/360dialog.
- WABA ID, si está disponible.
- `D360-API-KEY`, que queda cifrada.

Configurar el webhook por número, que tiene prioridad y mejor rendimiento. El
endpoint acusa el evento inmediatamente y procesa la IA en segundo plano. Los
identificadores del proveedor hacen idempotentes los reintentos. Los audios y
adjuntos se registran y pasan a revisión humana hasta activar transcripción y
descarga de medios.

## Configuración directa de Meta para demostraciones

La integración directa se limita al número de prueba de Meta. En **Ajustes →
Integraciones → WhatsApp**, seleccionar `Meta Cloud API directa` e introducir el
número de prueba, Phone Number ID, WABA ID opcional, versión Graph API mostrada
por Meta y el access token temporal. El token queda cifrado en Vault.

Callback: `https://recepia-panel.vercel.app/api/channels/whatsapp/meta`. El
checklist completo vive en `meta-cloud-test-onboarding.md`. No conectar el número
real del hospital en esta fase.

## Configuración de Vapi

En **Ajustes → Integraciones → Teléfono**:

- Número de recepción en E.164.
- Vapi Phone Number ID.
- Assistant ID.
- Número físico de transferencia del hospital.
- Private API key, cifrada en Vault.

El número de Vapi debe usar el Server URL de Recepia y no tener un asistente fijo,
para que Vapi envíe `assistant-request`. Recepia devuelve el Assistant ID junto con
variables verificadas del cliente:

- `clinicName`
- `customerPhone`
- `customerName`
- `customerContext` (mascotas y próximas citas)
- `humanTransferNumber`

El prompt del asistente de Vapi debe presentarse en su primera intervención como
agente de IA del equipo del hospital y usar `humanTransferNumber` en una tool
`transferCall` con transferencia en caliente. Vapi envía estados, transcripción y
el informe final al mismo endpoint; Recepia los incorpora a la conversación.

## Prueba E2E mínima antes de tráfico real

1. Web: abrir el chat, identificarse, pedir una cita, tomar el control desde el
   panel y comprobar que la respuesta humana aparece en el chat.
2. WhatsApp: enviar un texto real, comprobar respuesta de IA, estados
   enviado/entregado/leído y respuesta manual después de tomar control.
3. Teléfono: llamar desde un cliente conocido, comprobar presentación como IA,
   contexto correcto, transcripción, grabación y transferencia atendida por una
   persona real.
4. Repetir un webhook de cada proveedor y confirmar que no duplica mensajes ni
   acciones.
5. Confirmar que una clínica no puede leer ni operar datos de otra.

No activar tráfico real hasta completar privacidad/consentimiento de grabación,
DPIA, retención de audio, monitorización, rate limiting y kill switch probado.
