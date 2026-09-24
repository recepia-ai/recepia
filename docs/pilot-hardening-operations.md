# PC-W9 — Pilot Hardening & Operations

## Alcance y estado

PC-W9 endurece Preview para pilotos controlados sin convertir el producto en una
plataforma de infraestructura. Production queda fuera del paquete.

- **PC-W9A — Observabilidad + regresiones:** **GO**; suite y validaciones locales superadas.
- **PC-W9B — Resiliencia operativa:** no iniciado.
- **PC-W9C — Higiene de datos e infraestructura:** no iniciado.
- **PC-W9D — Grabaciones y privacidad:** no iniciado.

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

El evaluador no envía notificaciones todavía: deja umbrales y agrupaciones
deterministas, verificables y listos para conectar al mecanismo operativo que se
decida. Esto evita introducir infraestructura pesada antes del piloto.

## Semántica de reintento cubierta

Un webhook completado se reutiliza por su identidad de proveedor; uno fallido
puede reclamarse. Una mutación de cita exitosa con el mismo input se reutiliza y
no se ejecuta dos veces. Una mutación fallida no se presenta como éxito y puede
reintentarse; el backend vuelve a comprobar cita existente y disponibilidad.
Esta protección complementa la deduplicación persistente de `channel_events`.

## Riesgos que permanecen al terminar PC-W9A

- Las alertas están definidas y probadas, pero todavía no tienen transporte de
  notificación; se decide al abordar operación del piloto.
- El dataset valida políticas deterministas y contratos, no sustituye un smoke
  conectado de proveedores.
- Kill switch, degradación por canal y respuestas exactas ante caídas pertenecen
  a PC-W9B y no se implementan en PC-W9A.
- Inventario/limpieza y privacidad de grabaciones siguen reservados a PC-W9C/D.
