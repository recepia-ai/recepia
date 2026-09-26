# PC-W9 — Pilot Hardening & Operations

## Alcance y estado

PC-W9 endurece Preview para pilotos controlados sin convertir el producto en una
plataforma de infraestructura. Production queda fuera del paquete.

- **PC-W9A — Observabilidad + regresiones:** **GO**; suite y validaciones locales superadas.
- **PC-W9B — Resiliencia operativa:** **GO**; controles, degradación, reintentos y alertas persistentes validados.
- **PC-W9C — Higiene de datos e infraestructura:** Fase 1 auditada; PC-W9C.2
  separa Preview de Production y está pendiente de reconectar proveedores.
- **PC-W9D — Grabaciones y privacidad:** no iniciado.

## PC-W9C.2 — Supabase aislado para Preview

La rama `codex/product-construction-w1` usa el proyecto Supabase exclusivo
`recepia-preview` (`mnaaqqczygictolvplrp`). El proyecto histórico
`recepia-rodaction` (`vsnrlpfsgwwdmiyndwnl`) permanece como Production y no se
ha modificado durante la separación.

La Preview estable tiene overrides de rama para
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY`. Los valores no se documentan. Production conserva
sus variables y no se ha desplegado.

El nuevo proyecto recibió las 20 migraciones canónicas, RLS, funciones, vistas,
triggers y un dataset piloto controlado:

- 1 clínica `dr-patino`, 14 miembros (13 perfiles operativos y 1 usuario Auth
  administrador), 37 servicios, 35 tramos horarios y 22 asignaciones
  servicio-veterinario;
- 0 clientes, mascotas, citas, conversaciones, mensajes, eventos de canal,
  invocaciones de tools, sesiones de llamada, calendarios de veterinario,
  integraciones y canales externos al terminar el bootstrap;
- IA Web, WhatsApp y Voz desactivada hasta reconectar y validar cada proveedor.

No se copiaron filas de Production. Google Calendar/Vault, Evolution y Vapi
requieren configuración explícita en Preview. Auth usa la URL estable como
`site_url` y admite callbacks de esa URL y de localhost. En el plan Free se
conservan las plantillas de correo por defecto. La CLI confirmó la configuración
de Auth y después falló al leer una opción de Storage no soportada por esa
versión; no afecta al runtime ni a las migraciones.

El bootstrap reproducible está en
`supabase/bootstrap/preview_pilot_foundation.sql`. Además, dos migraciones
históricas se hicieron portables: `gen_random_bytes` se resuelve en el esquema
`extensions` y las asignaciones de veterinarios resuelven servicios por slug en
lugar de UUIDs generados en Production.

## Dataset dorado de PC-W9A

La fuente versionada es
`apps/panel/src/lib/agent/evals/pc-w9a-golden-dataset.json`. Usa exclusivamente
la identidad sintética `TEST RECEPIA` / `Mascota Demo` / `Consulta general` y
cubre web, WhatsApp y teléfono.

El test del dataset comprueba que existen casos para identificación, servicio,
fechas relativas y absolutas, zona horaria, disponibilidad, confirmación pura y
condicional, alta/modificación/cancelación de cita, takeover humano, reintento,
idempotencia, duplicados y creación única. Los casos deterministas de fecha y
confirmación se ejecutan contra las mismas funciones que usa el producto. No
llaman a Anthropic, Google, Vapi, Evolution ni Supabase.

## Logs operativos

`operationalLog` emite una línea JSON por evento en el log estándar de Vercel o
del proceso local. No registra mensajes, teléfonos, inputs de tools, payloads de
proveedor, tokens ni datos clínicos. Campos de correlación disponibles:

- `clinic_id`, `conversation_id`, `call_session_id`;
- `channel`, `provider`, `event_id`;
- `tool`, `appointment_id`, `error_code`;
- `duration_ms`, `status`, `duplicate`.

Eventos iniciales:

- `webhook.completed`, `webhook.duplicate`, `webhook.failed`;
- `tool.completed`, `tool.failed`, `tool.duplicate`;
- `vapi.assistant_request.completed`, `vapi.assistant_request.failed`.

La invocación central de tools conserva además la evidencia detallada existente
en `tool_invocations`. Los logs son para detección/correlación; las tablas siguen
siendo la evidencia operativa canónica.

## Alertas mínimas

Las reglas versionadas viven en `operational-alerts.ts` y su evaluador puro está
cubierto por tests. En PC-W9A no se añade Sentry, un collector ni una cola nueva.
Una integración posterior con log drain/cron puede consumir exactamente estas
reglas sin cambiar el contrato:

| Alerta | Umbral | Primera respuesta del operador |
|---|---:|---|
| Webhook repetidamente fallido | 3 por clínica/proveedor/canal en 5 min | Revisar endpoint, autenticación y último `channel_event`; no reprocesar a mano sin verificar idempotencia. |
| Google Calendar no disponible | 2 errores Google por clínica en 5 min | Comprobar OAuth/Vault y `freeBusy`; no prometer ni crear citas hasta recuperar lectura segura. |
| Tool con fallo recurrente | 3 del mismo tool/código por clínica en 10 min | Abrir `tool_invocations`, correlacionar conversación/llamada y decidir retry o takeover. |
| Creación de cita fallida | 1 fallo no esperado | Confirmar que no existe cita/evento antes de reintentar; `CONFIRMATION_REQUIRED` y slot ya ocupado no alertan. |
| Vapi `assistant-request` fallido | 1 | Verificar número dinámico, Server URL, secreto y respuesta del Preview antes de otra llamada. |

PC-W9B conecta el evaluador a un transporte ligero y persistente. Cada señal de
fallo se guarda como `operational.signal` y cada alerta deduplicada como
`operational.alert` en `channel_events`, con destino visible en
**Ajustes → Operaciones**. La identidad de alerta combina regla, clínica,
proveedor y ventana temporal, de modo que un incidente repetido no inunda el
panel. No se registran secretos, payloads clínicos ni textos de pacientes.

WhatsApp añade una sexta regla: dos fallos de outbound por clínica/proveedor en
cinco minutos generan aviso. Las alertas de creación de cita y bootstrap Vapi
son críticas; el resto son avisos operativos. El transporte es deliberadamente
interno al stack actual: no añade Sentry, colas ni servicios de notificación.

## Semántica de reintento cubierta

Un webhook completado se reutiliza por su identidad de proveedor; uno fallido
puede reclamarse. Una mutación de cita exitosa con el mismo input se reutiliza y
no se ejecuta dos veces. Una mutación fallida no se presenta como éxito y puede
reintentarse; el backend vuelve a comprobar cita existente y disponibilidad.
Esta protección complementa la deduplicación persistente de `channel_events`.

## PC-W9B — Control por clínica y canal

La configuración `clinic_config.config.operations.ai_channels` mantiene tres
interruptores independientes: `web`, `whatsapp` y `phone`. La ausencia de una
clave conserva el comportamiento anterior (`true`). Solo un administrador de
la clínica puede modificarlos en **Ajustes → Operaciones**. Cada escritura
incluye actor, instante y canal; el trigger existente de `clinic_config_history`
conserva el valor anterior y `updated_by`.

| Canal pausado | Recepción y evidencia | Automatización | Respuesta al usuario | Estado operador |
|---|---|---|---|---|
| Web | Persiste inbound, conversación y evento | Agent y tools no se ejecutan | Aviso determinista, sin prometer ninguna operación | `awaiting_human` |
| WhatsApp | Persiste inbound, conversación, evento y evidencia de outbound | Agent y tools no se ejecutan | Mismo aviso; `accepted` o `failed` según el proveedor | `awaiting_human` |
| Voz / Vapi | Persiste `call_session`, conversación y eventos | Assistant dinámico sin tools; tool tardía devuelve `AUTOMATION_DISABLED` | Saludo de pausa y revisión por el equipo | `awaiting_human` |

El takeover manual existente sigue teniendo prioridad: cuando una conversación
ya está bajo control humano, el inbound se persiste y no se genera otra
respuesta automática. Reactivar un canal no borra ni reasigna conversaciones.

## Comportamiento ante proveedores degradados

- **Google Calendar:** refresh, `freeBusy`, creación, verificación y compensación
  tienen timeout de 12 segundos. Un token no utilizable produce degradación, no
  una confirmación. La cita externa se crea antes de la fila interna; si Google
  falla no hay cita interna, y si falla el insert interno se intenta borrar el
  evento externo. El ID determinista del evento y la búsqueda previa de una cita
  idéntica permiten reutilizar un éxito al repetir confirmación/tool call.
- **Vapi:** los eventos usan identidad persistente, los duplicados se reutilizan
  y un evento tardío no puede regresar una llamada ya terminada. Un
  `assistant-request` fallido queda correlacionado y genera alerta crítica. No se
  añade un retry propio: Vapi conserva la responsabilidad del retry de webhook.
- **WhatsApp:** los duplicados inbound no generan un segundo outbound. Los
  mensajes conservan `sending → accepted/failed`; un fallo queda visible y lleva
  la conversación a revisión humana. Solo rechazos HTTP explícitos 429/5xx de
  Meta/360dialog tienen reintento acotado; una excepción/timeout con aceptación
  desconocida no se reenvía a ciegas. Evolution conserva un único intento salvo
  su fallback de compatibilidad de payload, para evitar duplicados sin una clave
  de idempotencia del proveedor.

## Estado operativo visible

**Ajustes → Operaciones** resume Web, WhatsApp, Voz/Vapi y Google Calendar como
`Operativo`, `Degradado` o `Desactivado`. La señal combina configuración activa,
integraciones/canales presentes y alertas de los últimos 30 minutos. Es una
vista operativa mínima, no un monitor de disponibilidad externo.

## Riesgos que permanecen al terminar PC-W9B

- Las alertas llegan al panel y persisten, pero todavía no envían correo, SMS o
  push externo; durante el piloto el operador debe revisar Ajustes → Operaciones.
- El dataset valida políticas deterministas y contratos, no sustituye un smoke
  conectado de proveedores.
- La carrera entre creaciones simultáneas idénticas queda cerrada en Preview
  por un índice UNIQUE parcial y recuperación idempotente de `23505`. La
  aplicación a Production permanece pendiente de autorización explícita.
- Inventario/limpieza y privacidad de grabaciones siguen reservados a PC-W9C/D.

## PC-W9C.4 — Concurrencia de citas

La identidad activa de una cita queda protegida en base de datos por
`appointments_active_identity_unique_idx`, sobre `clinic_id`, `client_id`,
`pet_id`, `vet_user_id`, `service_id` y `starts_at`, con `NULLS NOT DISTINCT` y
predicado `status <> 'cancelled'`. `confirmed`, `completed` y `no_show`
conservan la identidad; cancelar libera la combinación para una nueva reserva.

La creación sigue buscando primero una cita existente. Si dos ejecuciones
superan simultáneamente esa lectura, el índice decide el ganador. La ejecución
que recibe PostgreSQL `23505` no elimina el evento Google determinista, relee
la cita ganadora y devuelve su `appointment_id` y `google_event_id` como éxito
idempotente. Un evento recuperado tras conflicto HTTP 409 tampoco se elimina
por un fallo posterior que no lo creó.

La reprogramación consulta previamente la misma identidad. El índice cubre la
ventana restante; si el `UPDATE` pierde la carrera, se revierte el cambio de
Google Calendar de forma best-effort y la tool devuelve `SLOT_ALREADY_BOOKED`.

La migración `20260926090000_appointment_active_identity_unique.sql` aborta si
detecta duplicados activos antes de crear el índice. Rollback operativo:

```sql
drop index if exists public.appointments_active_identity_unique_idx;
```

El rollback del índice no revierte código y solo debe usarse tras detener o
serializar nuevas reservas. Preview fue validada con una carrera SQL
transaccional y un smoke conectado: dos creaciones simultáneas produjeron un
`23505`, ambas devolvieron el mismo `appointment_id`, se persistió una fila y
Google expuso un único evento. El evento y todas las entidades sintéticas se
eliminaron al finalizar. Production fue auditada (8 citas, 0 identidades
activas duplicadas y 0 solapamientos), pero la migración no se aplicó allí.
