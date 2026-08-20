# Onboarding 360dialog + Meta — piloto Dr. Patiño

> Checklist operativo iniciado el 20 de agosto de 2026. No activa servicios ni autoriza gasto.

## Objetivo

Conectar un número de WhatsApp Business del Hospital Veterinario Dr. Patiño a Recepia, primero en pruebas y después con tráfico real, manteniendo la propiedad de los activos en manos de la clínica.

## Propuesta para el piloto

- Alta directa en 360dialog con un único canal.
- Plan Regular: 49 EUR/mes por número, más las tarifas de mensajería de Meta.
- La licencia empieza a facturarse cuando se activa el canal; desarrollar el webhook y el adaptador antes de activarlo no genera ese cargo.
- Revisar de nuevo la tarifa variable de Meta antes del piloto: se han anunciado cambios para mensajes de servicio a partir del 1 de octubre de 2026.
- WABA y Meta Business Portfolio propiedad del Hospital Veterinario Dr. Patiño.
- Recepia recibe solo los permisos y credenciales técnicas necesarios para operar la integración.
- No contratar todavía el programa Partner de 360dialog. Se reconsiderará al incorporar nuevas clínicas.
- Si el número real ya usa WhatsApp Business App, evaluar Coexistence para evitar una migración brusca durante el piloto.

La contratación y cualquier cargo requieren aprobación expresa de Marc.

## Información que debe confirmar Marc con la clínica

- [ ] Número que se usará para el piloto, en formato E.164 (`+34...`).
- [ ] Estado actual del número:
  - no está registrado en WhatsApp;
  - usa WhatsApp Business App;
  - usa WhatsApp personal;
  - ya está conectado a otra API/BSP.
- [ ] Si el equipo necesita seguir usando WhatsApp Business App durante el piloto.
- [ ] Persona administradora del Meta Business Portfolio de la clínica.
- [ ] Acceso de esa persona a Facebook/Meta y al correo corporativo.
- [ ] Razón social exacta, dirección legal, teléfono y web pública de la clínica.
- [ ] Nombre visible solicitado para WhatsApp, previsiblemente `Hospital Veterinario Dr. Patiño`.
- [ ] Documento oficial para verificación empresarial y documento de dirección/teléfono si Meta lo solicita.
- [ ] Capacidad de recibir el código OTP por SMS o llamada internacional en el número elegido.

## Prerrequisitos antes de abrir Embedded Signup

- [ ] Meta Business Portfolio creado y propiedad de la clínica.
- [ ] Sección Business Info completa: razón social, dirección, web y teléfono.
- [ ] Web pública activa, accesible por HTTPS y describiendo claramente la actividad del hospital.
- [ ] La persona que completa el flujo es propietaria o administradora del Portfolio.
- [ ] Decidido si el alta será estándar o mediante Coexistence.
- [ ] Método de pago y gasto mensual aprobados por Marc.

## Secuencia de alta

1. Crear la cuenta directa de 360dialog.
2. Iniciar Embedded Signup desde el Client Hub.
3. Seleccionar o crear el Meta Business Portfolio de la clínica.
4. Crear la WABA del hospital.
5. Añadir el número y completar el OTP por SMS o llamada.
6. Solicitar el display name del hospital.
7. Completar la verificación empresarial si aparece en el flujo.
8. Esperar a que número, WABA y display name estén aprobados.
9. Generar la API key y guardarla fuera del repositorio.
10. Usar primero un entorno controlado para validar webhook, plantillas e idempotencia.

## Trabajo técnico

- [x] Resolver `clinic_id` por Phone Number ID o número receptor en `clinic_channels`.
- [x] Autenticar el webhook mediante header secreto configurado en 360dialog.
- [x] Persistir inbound/outbound con identificadores del proveedor.
- [x] Invocar el mismo bucle del agente que usa el chat web.
- [x] Idempotencia y auditoría base en `channel_events`.
- [x] Respuesta manual desde el panel enviada realmente por 360dialog.
- [x] Credencial por clínica cifrada en Supabase Vault.
- [ ] Reintentos salientes persistentes y cola de fallos.
- [ ] Ventana de atención de 24 horas y plantillas aprobadas.
- [ ] Descarga/transcripción de audio y política de retención de adjuntos.
- [ ] Prueba primero con número controlado y después con el número real.

## Decisiones pendientes

1. Número nuevo frente al número actual de la clínica.
2. Alta estándar frente a Coexistence.
3. Cuenta directa de un canal para el piloto frente a cuenta Partner al escalar Recepia.
4. Momento exacto del cambio al número real.

## Fuentes oficiales consultadas

- [Embedded Signup de 360dialog](https://docs.360dialog.com/docs/hub/embedded-signup)
- [Onboarding con WhatsApp Coexistence](https://docs.360dialog.com/docs/waba-management/embedded-signup/whatsapp-coexistence/coexistence-onboarding)
- [Precios de 360dialog](https://360dialog.com/pricing)
- [Documentación de precios y facturación](https://docs.360dialog.com/docs/pricing)
- [Guía de verificación empresarial](https://docs.360dialog.com/docs/waba-management/whatsapp-business-verification-guide)
