# Meta WhatsApp Cloud API — entorno de demostración

> Checklist operativo iniciado el 21 de agosto de 2026. Solo autoriza el número de prueba proporcionado por Meta. No autoriza conectar el número real del hospital ni asumir gastos.

## Estado verificado — 21 de agosto de 2026

- Porfolio empresarial Meta: `Recepia` (`business_id=4548379128777722`), sin verificar durante la demostración.
- Aplicación Meta: `Recepia` (`app_id=1529572905588227`), en modo desarrollo.
- Condiciones de WhatsApp Business y Cloud API aceptadas con autorización explícita de Marc.
- `META_WHATSAPP_VERIFY_TOKEN` y `META_WHATSAPP_APP_SECRET` guardados como variables sensibles de Production y Preview en Vercel. El App Secret se rotó antes de guardar el valor definitivo.
- Despliegue de producción regenerado y en estado Ready.
- Callback verificado por Meta: GET 200.
- Campo `messages` suscrito en la versión v26.0.
- Webhook de muestra firmado recibido: POST 200. El procesador rechazó correctamente asociarlo a una clínica porque el ejemplo usa el número ficticio `16505551111` y no existe un canal `meta_cloud` para él.
- Bloqueo actual: el botón **Solicitar número de prueba** termina sin asignar número y vuelve a ofrecer la solicitud, sin error visible. Se ha reproducido antes y después de configurar el webhook.
- No se ha registrado el número real del hospital ni se ha añadido método de pago.

## Objetivo

Demostrar a Samuel el flujo completo de Recepia por WhatsApp sin contratar 360dialog y sin modificar la cuenta de WhatsApp Business del Hospital Veterinario Dr. Patiño.

## Arquitectura

- Meta WhatsApp Cloud API actúa únicamente como transporte.
- El agente, las tools, los guardrails y la persistencia siguen viviendo en Recepia.
- El webhook comparte el parser de WhatsApp Cloud API con el adaptador de 360dialog.
- El proveedor persistido para este entorno es `meta_cloud`.
- 360dialog se conserva como opción prevista para el lanzamiento.

## Límites de seguridad

- Usar solo el número de prueba que aparezca en **Meta Developers → WhatsApp → API Setup**.
- No registrar ni migrar `+34 605 413 875` durante esta fase.
- Usar datos ficticios o del propio equipo; no introducir conversaciones clínicas reales.
- No guardar tokens, App Secret ni Verify Token en documentación, commits o chats.
- El access token se introduce en **Ajustes → Integraciones** y se cifra en Supabase Vault.
- El App Secret y el Verify Token son secretos de la app y se guardan como variables sensibles de Vercel.

## Variables del despliegue

- `META_WHATSAPP_VERIFY_TOKEN`: valor aleatorio usado por Meta para verificar el callback.
- `META_WHATSAPP_APP_SECRET`: App Secret de la aplicación Meta, usado para validar `X-Hub-Signature-256`.

Configurar ambas en Production y Preview. No usar el mismo valor para las dos variables.

## Configuración del canal en Recepia

En **Ajustes → Integraciones → WhatsApp**:

1. Proveedor: `Meta Cloud API directa`.
2. Número: número de prueba de Meta en formato E.164.
3. Phone Number ID: copiarlo de API Setup.
4. WABA ID: copiarlo de API Setup, si aparece.
5. Versión Graph API: copiar exactamente la versión mostrada por Meta, con formato `vN.N`.
6. Access token temporal: introducirlo directamente en el campo protegido.

Los tokens de usuario temporales caducan; Meta indica que normalmente duran 24 horas. Para la demostración basta generar uno nuevo. Un token de sistema permanente se evaluará únicamente antes de tráfico estable.

## Webhook en Meta

- Callback URL: `https://recepia-panel.vercel.app/api/channels/whatsapp/meta`
- Verify Token: el valor de `META_WHATSAPP_VERIFY_TOKEN`.
- Suscribirse al campo `messages` de la cuenta de WhatsApp Business de prueba.

Recepia responde al desafío GET y valida la firma HMAC de cada POST antes de procesarlo.

## Prueba E2E

1. Añadir el teléfono personal de prueba como destinatario permitido en Meta.
2. Enviar el mensaje de plantilla inicial desde API Setup si Meta lo exige.
3. Responder desde el teléfono personal.
4. Confirmar que la conversación aparece en la pestaña WhatsApp del panel.
5. Comprobar que el agente se presenta como IA del equipo del hospital.
6. Pedir una cita y verificar su persistencia y, cuando Google Calendar esté reconectado, el evento externo.
7. Tomar el control desde el panel y enviar una respuesta humana.
8. Devolver la conversación al agente.
9. Repetir un webhook y confirmar que no duplica el mensaje ni las acciones.
10. Confirmar estados enviado, entregado y leído cuando Meta los emita.

## Criterio de cierre

La demostración está lista cuando el flujo completo funciona con el número de prueba, queda visible en el panel y no interviene el número real del hospital.

## Fuente técnica

- [Colección oficial de WhatsApp Cloud API de Meta](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api)
