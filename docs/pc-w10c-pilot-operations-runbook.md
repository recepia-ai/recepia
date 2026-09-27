# PC-W10C — Runbook de operación y métricas del piloto

Estado: **PC-W10C GO en Preview** el 27 de septiembre de 2026. Este documento no autoriza activar una clínica real ni desplegar Production.

La validación conectada de la clínica Preview mostró Web, WhatsApp, Voz/Vapi y
Google Calendar operativos; 5 conversaciones de la ventana (1 Web, 2 WhatsApp,
2 Voz), 11 tools correctas, 0 tools fallidas y 0 fallos assistant-request. La
prueba fue de lectura, no creó citas ni nueva evidencia. El aislamiento por
clínica se valida además con un test que mezcla deliberadamente filas de dos
tenants y excluye por completo el ajeno.

## 1. Responsabilidades y reglas de seguridad

- El responsable de turno revisa **Ajustes → Operaciones** al inicio y al final de cada jornada y tras cualquier aviso del equipo.
- Solo un administrador puede activar o pausar IA y cerrar alertas. Tomar una conversación requiere una membresía válida de la clínica.
- Primero se contiene el incidente con el kill switch; después se diagnostica. Nunca se promete una cita si `create_appointment` no devolvió éxito y `appointment_id`.
- No se reenvían manualmente webhooks o mensajes con aceptación incierta sin comprobar antes `channel_events`, `messages` y la cita/evento existente.
- La vista y todas sus consultas se filtran por `clinic_id`. No contiene cuerpos de mensajes, teléfonos ni inputs de tools en las métricas.

## 2. Activación de una clínica piloto

1. Ejecutar el provisioning interno en dry-run y revisar clínica, admin, servicios, veterinarios, horarios y asignaciones.
2. Ejecutar con `--apply`; iniciar sesión como admin y completar **Ajustes → Preparación piloto**.
3. Conectar Google, asignar un calendario a cada veterinario y verificar una consulta `freeBusy` no destructiva.
4. Configurar Web, WhatsApp y Vapi. En Vapi, mantener el número dinámico: `assistantId=null`, Server URL de Recepia y secreto del entorno correcto. Grabación OFF.
5. Confirmar en **Operaciones** que los proveedores figuran operativos y que los tres kill switches siguen pausados.
6. Activar Web, realizar smoke; activar WhatsApp, realizar smoke; activar Voz, realizar llamada técnica. Nunca activar varios canales a la vez durante la primera puesta en marcha.
7. Registrar hora, responsable, SHA/deployment y resultado. La activación real necesita autorización del owner.

## 3. Pausa, takeover y retorno a IA

- **Pausar Web/WhatsApp/Voz:** Ajustes → Operaciones → `Pausar IA`. Se conservan inbound, conversaciones y eventos; no se ejecutan Agent/tools y el caso queda para revisión humana cuando el canal lo permite.
- **Takeover:** abrir la conversación → `Tomar control`. El operador responde desde Recepia. La acción genera `conversation.human_takeover` para auditoría y métricas futuras.
- **Retorno a IA:** confirmar que la incidencia está resuelta → `Devolver a IA`. Se archiva la escalación y se genera `conversation.returned_to_ai`.
- Reactivar un kill switch no devuelve automáticamente casos en atención humana ni borra evidencia.

## 4. Procedimientos por incidente

### Google Calendar no disponible

1. Pausar IA de los canales que puedan reservar; mantener recepción.
2. Revisar alerta, `tool_invocations.error_code`, conexión OAuth, calendarios asignados y estado de Google.
3. No confirmar citas ni crear filas manuales mientras no exista lectura y escritura segura.
4. Reconectar OAuth/asignación si procede y ejecutar `freeBusy` no destructivo.
5. Resolver la alerta, reactivar un canal y observar una interacción antes de restaurar el resto.

### WhatsApp / Evolution no disponible

1. Pausar IA WhatsApp; revisar estado de canal, instancia, webhook y evidencia `sending → accepted/failed`.
2. Un timeout con aceptación incierta no se reenvía a ciegas. Comprobar primero proveedor, `channel_events` y `messages`.
3. Restaurar webhook/secreto del mismo entorno, hacer un smoke sintético único y reactivar.

### Vapi no disponible

1. Pausar IA Voz o desviar llamadas operativamente.
2. Verificar número dinámico, `assistantId=null`, Server URL, secreto y alerta `vapi_assistant_request_failed`.
3. Confirmar que inbound assistant-request no depende de la API key administrativa guardada en Vault.
4. Hacer llamada técnica corta; debe crear una sola `call_session` y conversación antes de reactivar.

### Webhook fallido o repetido

1. Correlacionar por `event_id`, canal y proveedor; comprobar si el evento ya quedó `completed`.
2. Validar autenticación, payload y disponibilidad del endpoint.
3. Reprocesar solo si el registro falló y la operación es segura. La deduplicación debe reutilizar eventos completados.

### `create_appointment` fallido

1. Pausar la promesa de reserva y abrir tool/código de error.
2. Comprobar cita interna y evento Google antes de reintentar.
3. `CONFIRMATION_REQUIRED` y slot ocupado son resultados de negocio, no caídas. Un fallo OAuth/Google requiere el procedimiento anterior.
4. Tras timeout, repetir el mismo input: la identidad activa y el event ID determinista deben devolver la cita ganadora sin duplicar.

### Error de autenticación

1. No usar service role en navegador ni compartir enlaces mágicos.
2. Confirmar URL de entorno, redirect permitido, usuario/membresía y expiración; solicitar un enlace mágico nuevo.
3. Para webhook, comparar únicamente presencia/fingerprint operativa del secreto, nunca imprimirlo.

## 5. Rollback

### Deployment

1. Pausar los tres kill switches.
2. Identificar SHA y deployment anterior conocido como Ready.
3. Promover/redeployar solo ese SHA en el entorno afectado.
4. Ejecutar login, tenant isolation, Operaciones, Google read, web auth, WhatsApp auth y Vapi assistant-request.
5. Reactivar canales uno a uno. Una migración aditiva no se revierte automáticamente con el código.

### Configuración

1. Pausar el canal afectado.
2. Consultar `clinic_config_history` y la configuración/canal anterior; documentar actor y momento.
3. Restaurar únicamente el bloque afectado mediante la UI o procedimiento aprobado. No copiar secretos entre entornos.
4. Ejecutar smoke no destructivo y reactivar. Para secretos, usar rotación/configuración del proveedor y Vault; no recuperar valores desde logs.

## 6. Métricas y definiciones (ventana móvil de 7 días)

| Métrica | Fuente y cálculo |
|---|---|
| Conversaciones totales/por canal | `conversations` no eliminadas, iniciadas en la ventana; agrupadas por `channel`. |
| Llamadas | `call_sessions.started_at` en la ventana. |
| Citas creadas por IA | `appointments.created_by='agent'` creadas en la ventana. |
| Modificadas/canceladas | `tool_invocations` exitosas de `modify_appointment` / `cancel_appointment`. Es número de operaciones, no necesariamente citas distintas. |
| Escalados | conversaciones distintas con `escalate_to_human` exitoso. |
| Takeovers | conversaciones distintas con evento `conversation.human_takeover`; se incluye además el estado humano actualmente visible. El histórico anterior al evento puede quedar infracontado. |
| Tools success/failure | invocaciones persistidas por `success`. |
| Fallos assistant-request | señales `vapi.assistant_request.failed`. |
| Respuesta media | tiempo entre cada mensaje inbound de cliente y la siguiente respuesta outbound del Agent en la misma conversación. No mide percepción de red/proveedor. |
| Duración media llamada | media de `call_sessions.duration_seconds` con valor. |
| Resolución automática verificable | conversación `completed`, sin escalado ni takeover y con al menos una tool de objetivo (`create`, `modify` o `cancel_appointment`) exitosa. Denominador: conversaciones cerradas (`completed`, `transferred`, `abandoned`). |

La resolución automática es deliberadamente conservadora: las consultas meramente informativas no pueden clasificarse con precisión con los datos actuales y no entran en el numerador. La tasa muestra `—` cuando no hay conversaciones cerradas.

## 7. Alertas

Las alertas viven en `channel_events`, proveedor `recepia-operations`, con severidad, clínica, canal, timestamp, código y enlace a conversación cuando existe. Un administrador puede marcar una alerta como resuelta; se añade un evento `operational.alert.resolved`, no se borra la alerta original. La deduplicación sigue la ventana de cada regla.

Para un piloto controlado, el panel más una revisión de turno es suficiente. Email solo debe añadirse si se necesita operación fuera de horario; el destino recomendado sería una dirección operativa por clínica, con alert ID y enlace, sin PII. SMS/push queda fuera de alcance.

## 8. Resumen semanal reproducible

Cada lunes, fijar la ventana de siete días y registrar desde Operaciones:

1. volumen total y Web/WhatsApp/Voz;
2. tasa y cobertura de resolución automática verificable;
3. citas creadas/modificadas/canceladas;
4. escalados y takeovers;
5. tools OK/fallidas y principales `error_code`;
6. fallos assistant-request, respuesta media y duración media de llamada;
7. alertas abiertas/resueltas y tres causas principales;
8. acciones recomendadas con responsable y fecha.

No se exportan textos, teléfonos ni nombres. El informe debe indicar clínica, zona temporal, inicio/fin de ventana y SHA desplegado.

## 9. API key administrativa Vapi (P1)

La key guardada en Vault se escribe al configurar el canal, pero el runtime actual no la lee para inbound, assistant-request, tool calls ni persistencia. Esas rutas usan el secreto del webhook y el `phoneNumberId`. La key administrativa rechazada bloquea automatización futura de sync/inspección de número o assistant desde Recepia, no el flujo E2E entrante validado.

Clasificación: **P1 no bloqueante para un piloto controlado**, siempre que el número dinámico se verifique manualmente antes de activar Voz. La causa compatible con la evidencia es key inválida/revocada o de otro workspace; no se puede distinguir sin rotación o prueba administrativa autorizada. No se rota ni sustituye en PC-W10C.

## 10. Datos mínimos del piloto

Conservar: fecha, `clinic_id`, canal, intención/categoría cuando exista, estado/resultado, nombre de tool, éxito, `appointment_id` cuando exista, escalado/takeover, `error_code`, duración y latencia. No duplicar en analytics nombres, teléfonos, cuerpos de mensaje, transcript, tool input ni credenciales. La evidencia clínica permanece en las tablas operativas con sus controles existentes.
