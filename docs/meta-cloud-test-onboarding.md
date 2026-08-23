# Meta WhatsApp Cloud API — entorno de demostración

> Checklist operativo iniciado el 21 de agosto de 2026. Solo autoriza el número de prueba proporcionado por Meta. No autoriza conectar el número real del hospital ni asumir gastos.

## Estado verificado — 23 de agosto de 2026

- Porfolio empresarial Meta: `Recepia` (`business_id=4548379128777722`), sin verificar durante la demostración.
- Aplicación Meta: `Recepia` (`app_id=1529572905588227`), en modo desarrollo.
- Condiciones de WhatsApp Business y Cloud API aceptadas con autorización explícita de Marc.
- `META_WHATSAPP_VERIFY_TOKEN` y `META_WHATSAPP_APP_SECRET` guardados como variables sensibles de Production y Preview en Vercel. El App Secret se rotó antes de guardar el valor definitivo.
- Despliegue de producción regenerado y en estado Ready.
- Callback verificado por Meta: GET 200.
- Campo `messages` suscrito en la versión v26.0.
- Webhook de muestra firmado recibido: POST 200. El procesador rechazó correctamente asociarlo a una clínica porque el ejemplo usa el número ficticio `16505551111` y no existe un canal `meta_cloud` para él.
- Número de prueba confirmado aunque la pantalla de Developers siga mostrando de forma obsoleta que no hay número: `+1 555-668-8613`, Phone Number ID `1206555752548755`, WABA ID `1235240618736353`.
- Usuario del sistema `Recepia API` (`61593392469840`) con acceso total a la aplicación Recepia y a la WABA de prueba.
- Token permanente de usuario del sistema regenerado el 23 de agosto de 2026 con los permisos mínimos `whatsapp_business_management`, `whatsapp_business_messaging` y `whatsapp_business_manage_events`. El valor vigente permanece cifrado en Supabase Vault y el canal `meta_cloud` referencia el secreto nuevo.
- Canal `meta_cloud` activo en `clinic_channels`, vinculado al número y a los identificadores de prueba anteriores.
- Aplicación Recepia suscrita a la WABA: el `POST /1235240618736353/subscribed_apps` devolvió éxito y el `GET` posterior confirmó `app_id=1529572905588227`.
- El ciclo controlado `DELETE` → `POST` de `subscribed_apps` se completó correctamente, pero no reparó el selector de remitente de API Testing. WhatsApp Manager reconoce el número y muestra `0 de 5 destinatarios añadidos`, mientras Meta Developers sigue indicando que la aplicación no tiene ningún número disponible.
- Tras renovar la credencial, un envío directo con la plantilla oficial `hello_world` autenticó correctamente y llegó hasta la validación del destinatario. Meta devolvió `131030` (`Recipient phone number not in allowed list`). El bloqueo real es que API Testing no permite añadir `+34 661 077 669` porque no carga el número público de prueba.
- Direct Support y Business Settings muestran otra cuenta de WhatsApp (`1044621661695900`) dentro del mismo porfolio. La relación `1044621661695900/phone_numbers` devuelve el número de prueba y su Phone Number ID; la relación `1235240618736353/phone_numbers` también lo expone.
- La aplicación no estaba suscrita a `1044621661695900`. Se añadió la suscripción sin retirar la anterior, el `GET` posterior confirmó `app_id=1529572905588227` y Recepia pasó a guardar `1044621661695900` como WABA ID operativo. API Testing siguió sin cargar el remitente después de este cambio.
- Caso de Meta Direct Support `37633292229647346`, categoría **Dev: Phone Number & Registration Issues**. Meta lo clasificó como severidad estándar, lo cerró automáticamente sin investigación técnica y remitió al foro de la comunidad de desarrolladores.
- Para aislar el problema se creó desde cero la aplicación temporal `Recepia Messaging Test` (`app_id=1106710908689488`) en el mismo porfolio, únicamente con el caso de uso WhatsApp Business Messaging. Al solicitar el número gratuito, esperar más de un minuto y recargar, Meta volvió a mostrar que no había ningún número disponible. Esto descarta la configuración de la aplicación original y sitúa el fallo en el aprovisionamiento del porfolio/WABA de prueba.
- Caso de Meta Direct Support `27395235070154712`, categoría **Dev: Account & WABA**, tipo **Account Activity Issues**, asociado a la WABA `1235240618736353` y al teléfono de prueba `15556688613`. Se solicitó reparar o reiniciar la asignación del Public Test Number, pero Meta AI Agent respondió que el canal no podía atender el problema y lo derivó al Developer Community Forum, sin análisis ni reparación técnica.
- El foro oficial muestra publicaciones recientes con el mismo patrón de cierres automáticos, pero mantiene deshabilitada la acción **Hacer una pregunta** para esta cuenta, incluso entrando desde el enlace categorizado de la herramienta de errores.
- Se intentó escalar mediante **Informar de un error**, asociándolo tanto a la aplicación limpia como a la aplicación Recepia original. Meta permite seleccionar la aplicación y el producto, pero bloquea **Siguiente** y avisa de que el soporte técnico para esas categorías ya no está disponible y que se use el foro. Por tanto, los tres canales oficiales probados —Direct Support, bug report y comunidad— no permiten obtener una reparación.
- Para descartar también el porfolio original se creó un entorno totalmente separado: porfolio `Recepia Sandbox` (`business_id=1611080270728854`) y aplicación `Recepia Sandbox Messaging` (`app_id=957295927423465`). Se completó el onboarding inicial de WhatsApp, se solicitó el número público de prueba, se esperó más de un minuto y se recargó API Testing. Meta volvió a mostrar **No hay ningún número de teléfono disponible para esta aplicación** y mantuvo el botón **Solicitar número de prueba**. La incidencia queda aislada a la cuenta de desarrollador o al servicio de aprovisionamiento de Meta, no a la aplicación, WABA ni porfolio originales de Recepia.
- Pendiente para el E2E: añadir un destinatario permitido en Meta, enviar el mensaje inicial de prueba y validar entrada, respuesta del agente y toma de control desde el panel.
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

El entorno usa un token permanente de usuario del sistema con el conjunto mínimo de permisos de WhatsApp. Debe rotarse inmediatamente si se expone y sustituirse en el mismo secreto de Supabase Vault, sin almacenar su valor en documentación, consultas guardadas ni registros.

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
