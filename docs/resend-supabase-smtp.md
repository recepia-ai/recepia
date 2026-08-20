# SMTP de Supabase Auth con Resend

Estado: activo en producción desde el 20 de agosto de 2026. El dominio
`recepia.iatope.com` está verificado, Supabase usa una credencial limitada a
envío desde ese dominio y el flujo real de enlace mágico está validado.

## Decisión

- Proveedor: Resend Free para el piloto (3.000 emails/mes y máximo 100/día).
- Dominio exclusivo de autenticación: `recepia.iatope.com`.
- Remitente: `Recepia <acceso@recepia.iatope.com>`.
- SMTP: `smtp.resend.com`, puerto `465`, usuario `resend`.
- Límite inicial de Supabase: 30 emails/hora.
- Intervalo por usuario: 60 segundos para evitar abuso y reenvíos accidentales.
- Tracking de enlaces: desactivado; los enlaces de Supabase son de un solo uso.

No se reutiliza `mail.ofertas.iatope.com`: separar autenticación y marketing
protege la reputación del correo de acceso.

## Configuración aplicada

1. Resend: `recepia.iatope.com`, región Irlanda, estado `verified`.
2. Cloudflare: DKIM, SPF y MX publicados y comprobados mediante DNS público.
3. Credencial activa: `supabase-recepia-prod-domain`, permiso `Sending access`
   restringido a `recepia.iatope.com`.
4. Supabase Auth:
   - SMTP personalizado activo;
   - sender `acceso@recepia.iatope.com`;
   - sender name `Recepia`;
   - host `smtp.resend.com`, puerto `465`, usuario `resend`;
   - intervalo por usuario de 60 segundos;
   - límite de 30 emails/hora.
5. Plantillas alojadas sincronizadas desde `supabase/templates/`:
   - enlace mágico: `Tu enlace de acceso a Recepia`;
   - invitación: `Te han invitado a Recepia`.
6. Tracking de aperturas y clics no configurado en Resend.

## Validación

El 20 de agosto de 2026 se solicitaron cinco enlaces mágicos desde
`https://recepia-panel.vercel.app/login` al usuario de prueba controlado. Resend
marcó los cinco como `delivered`; tres llegaron en unos tres minutos, respetando
el intervalo por usuario. El cuarto se envió después de sustituir la credencial
por la clave restringida al dominio, validando también la rotación. El quinto se
envió después de revocar las credenciales provisionales, confirmando que solo la
clave restringida seguía dando servicio.

Queda como validación funcional posterior invitar a un miembro desde Ajustes →
Equipo y completar la incorporación. DMARC ya existe en `iatope.com` con política
de observación; debe endurecerse cuando haya datos suficientes de entregabilidad.

## Limpieza de credenciales

Durante la activación se generaron dos credenciales de envío sin restricción de
dominio: `supabase-recepia-prod` y `supabase-recepia-prod-smtp`. Ambas se
revocaron el 20 de agosto de 2026. La única credencial de Supabase que permanece
activa es `supabase-recepia-prod-domain`.

Las claves no se guardan en el repositorio, Vercel ni chats. Supabase cifra la
contraseña SMTP en su configuración alojada.
