# PC-W9D — Grabaciones, privacidad y retención de audio

Estado: **GO técnico condicionado** el 26 de septiembre de 2026. La grabación se
impone en OFF para cada llamada dinámica; habilitarla en pilotos requiere
validación legal y una decisión explícita por clínica.

## 1. Estado comprobado

Vapi está generando para las llamadas terminadas:

- grabación mono y estéreo;
- transcript completo;
- `messages` y `messagesOpenAIFormatted`;
- logs y referencias de diagnóstico;
- metadata de llamada, nodos, métricas y variables;
- URLs privadas del proveedor y URLs prefirmadas con expiración explícita.

Los conteos se obtuvieron sin leer ni exponer URLs, teléfonos o transcripts:

| Entorno | Llamadas Vapi | End-of-call reports | Transcript completo | Referencia de grabación | Copia en Storage Recepia |
|---|---:|---:|---:|---:|---:|
| Preview | 1 | 1 | 1 | 1 | 0 |
| Production | 14 | 12 | 12 | 10 | 0 |

Todas las URLs prefirmadas encontradas estaban ya expiradas. Supabase solo tiene
el bucket privado `pet-records`, vacío y limitado a PDF/imágenes; no existe bucket
de audio. `recording_storage_path` está vacío en todas las llamadas.

Recepia persiste actualmente:

- `call_sessions`: estado, participantes, timestamps, duración, estado de
  transcript y transcript completo en `metadata`;
- `conversations` y `messages`: timeline normalizado de la conversación;
- `channel_events`: evidencia del webhook y tool calls;
- `tool_invocations`: entrada, resultado y error de las tools;
- `provider_call_id`: referencia durable para recuperar o borrar la llamada en
  Vapi mediante una petición autenticada.

Antes de PC-W9D también se persistían URLs de artifacts en
`call_sessions.metadata` y en el payload bruto de `channel_events`. El código y
la migración de PC-W9D dejan de conservarlas: se guarda únicamente
`recording_available=true`. No existe endpoint de reproducción ni descarga en
Recepia y la UI no muestra una URL.

## 2. Controles de Vapi

Vapi configura artifacts mediante `artifactPlan`. La grabación puede activarse o
desactivarse por assistant y por llamada individual; transcript, logging, vídeo y
PCAP tienen controles separados. El número dinámico de Recepia resuelve un
assistant por `assistant-request`, por lo que la política debe estar en el
assistant devuelto o en sus overrides, no depender de una copia manual divergente
del número.

Vapi almacena por defecto recordings, transcripts y logs en almacenamiento
privado. La descarga actual usa endpoints autenticados que redirigen a URLs
temporales; la private API key nunca debe llegar al navegador. La retención real
depende del paquete: Usage only 14 días, Core 30, Pro 180 y Premier personalizado.
Debe confirmarse el paquete vigente en Billing antes del piloto. Vapi también
ofrece ZDR, Data Retention y almacenamiento propio, sujetos a plan/configuración.

Fuentes oficiales:

- [Call recording, logging and transcribing](https://docs.vapi.ai/assistants/call-recording)
- [Retrieve call artifacts](https://docs.vapi.ai/assistants/retrieve-call-artifacts)
- [Logs and retention](https://docs.vapi.ai/observability/logs/overview)
- [Pricing and raw-data retention](https://docs.vapi.ai/billing/pricing-and-success-packages)
- [Data flow and custom storage](https://docs.vapi.ai/security-and-privacy/data-flow)
- [Delete call API](https://docs.vapi.ai/api-reference/calls/delete)

## 3. Riesgos encontrados

1. Las referencias prefirmadas se conservaban aunque no eran necesarias. RLS las
   limitaba a miembros de la clínica y ya estaban expiradas, pero aumentaban la
   superficie de exposición. PC-W9D las elimina de nueva persistencia y prepara
   el saneamiento de referencias históricas.
2. `call_sessions`, `messages` y `channel_events` son legibles hoy por cualquier
   miembro de la clínica (`admin`, `recepcion` o `veterinario`). Existe aislamiento
   entre clínicas, pero no restricción por rol dentro de la clínica.
3. Un borrado local de conversación no borra automáticamente la llamada en Vapi.
   Además, `channel_events.conversation_id` usa `ON DELETE SET NULL`, de modo que
   borrar solo la conversación puede dejar evidencia técnica con PII.
4. La configuración `data_retention` declarada no tiene todavía un job que la
   ejecute. Production declara 365 días para mensajes y 90 para grabaciones;
   Preview no contiene esos valores. Ninguno controla por sí solo la retención de
   Vapi.
5. El saludo informa de que la llamada puede grabarse, pero no recaba una
   aceptación explícita. Si la base jurídica elegida es consentimiento, continuar
   en línea no basta como consentimiento tácito bajo RGPD.

## 4. Decisión de producto recomendada

**Opción D: grabación desactivada por defecto y activable por clínica**, tras
validar base jurídica, texto, finalidad, roles y plazo. El transcript operativo
puede mantenerse separado de la grabación, sujeto a su propia política.

El control efectivo actual es
`assistantOverrides.artifactPlan.recordingEnabled=false`, incluido por Recepia en
cada respuesta dinámica a `assistant-request`. También se desactivan vídeo y
PCAP; permanecen activos `loggingEnabled` y `transcriptPlan.enabled`. Así el
assistant puede conversar, ejecutar tools y persistir transcript/metadata sin
crear audio grabado.

No existe hoy un interruptor de clínica que permita activar audio. Si se autoriza
en el futuro, el campo persistido será
`clinic_config.config.voice.recording_enabled`, con ausencia/`false` como valor
seguro. Solo un administrador podrá cambiarlo y el backend lo aceptará únicamente
si la clínica también tiene finalidad, plazo, roles y texto legal validados. No
se implementa todavía esa lectura ni su UI.

Cuando una clínica active audio, se usará el patrón de la opción B: Recepia guarda
solo `provider_call_id` y `recording_available`, nunca una URL. El audio se obtiene
server-side desde Vapi mediante una URL autenticada y efímera.

| Opción | Ventajas | Inconvenientes | Decisión |
|---|---|---|---|
| A. Depender temporalmente de Vapi | Cero almacenamiento propio | Menor control y difícil demostrar borrado coordinado | No como política estable |
| B. Referencia segura | Implementación pequeña; no duplica audio | Sigue dependiendo de retención/disponibilidad Vapi | Patrón cuando D esté habilitada |
| C. Storage privado propio | Control de lifecycle, residencia y acceso | Mayor responsabilidad, coste y superficie de seguridad | Posponer hasta necesidad demostrada |
| D. Desactivada por defecto | Máxima minimización y decisión por clínica | Menos evidencia de calidad; requiere flujo opt-in | **Recomendada** |

## 5. Política mínima de acceso

- Transcript: `admin` y `recepcion`; veterinario solo cuando exista una necesidad
  asistencial definida y auditable.
- Audio: `admin` por defecto; acceso excepcional a `recepcion` si la clínica lo
  habilita. No acceso general para `veterinario`.
- Siempre aplicar `clinic_id` y comprobar el rol en servidor antes de recuperar
  un artifact.
- Registrar cada reproducción/descarga como evento de auditoría con usuario,
  clínica, llamada, timestamp y finalidad; nunca registrar la URL ni la API key.
- No incluir transcripts, URLs, teléfonos ni fragmentos de audio en logs técnicos.

El RLS actual garantiza aislamiento por tenant, pero no cumple todavía esta
separación interna por rol. Es un work package pequeño posterior, no un nuevo
subsistema de permisos.

## 6. Retención piloto propuesta

| Dato | Plazo inicial | Motivo |
|---|---:|---|
| Audio | Desactivado; 30 días máximo si se habilita | QA puntual y minimización |
| Transcript | 180 días | Operación, reclamaciones y continuidad administrativa |
| Metadata de llamada | 365 días | Métricas, trazabilidad e idempotencia |
| Tool invocations y errores | 90 días | Depuración y evidencia operativa |
| Logs detallados del proveedor | 14–30 días | Diagnóstico; evitar retención extensa de PII |

Los plazos deben convertirse en lifecycle real, no solo configuración. Al
expirar: borrar primero el call artifact en Vapi, verificar el resultado y luego
eliminar/redactar transcript y referencias locales según su plazo. Un fallo del
proveedor queda `deletion_pending` y se reintenta; no se informa como completado.

Al borrar una conversación: borrar la llamada en Vapi mediante `DELETE /call/:id`,
limpiar mensajes/call session y redactar o borrar los `channel_events` asociados.
Al borrar una clínica: enumerar primero todos los `provider_call_id`, completar o
dejar auditado el borrado externo y solo después ejecutar el cascade local y
eliminar la credencial Vault.

## 7. Consentimiento e información

Texto técnico propuesto si se decide recabar consentimiento explícito:

> Soy Recepia, el asistente de inteligencia artificial de {{clinicName}}. Para
> gestionar y mejorar la atención, ¿aceptas que grabemos esta llamada? Puedes
> decir que no y continuar sin grabación, o pedir hablar con una persona.

La respuesta debe persistirse como `granted`, `declined` o `not_obtained`, con
timestamp y versión del texto. Ante `declined`, `recordingEnabled=false`; la
política de transcript debe explicarse y resolverse por separado.

Esto es una recomendación técnica, no una conclusión legal. La clínica/Recepia
debe validar con asesoría jurídica la base de licitud, responsabilidades,
información por capas, derechos, transferencias y si basta información/oposición
o se requiere consentimiento. La AEPD recuerda que, cuando el consentimiento es
la base, debe ser inequívoco y mediante acción afirmativa; la inacción no basta:
[criterio AEPD](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/5-bases-legitimadoras-del-tratamiento/FAQ-0211-segun-el-rgpd-como-debe-solicitarse-el-consentimiento-de-los-interesados).
El deber de información procede del
[artículo 13 RGPD](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679).

## 8. Diseño de reproducción futura

1. Botón `Reproducir` solo si `recording_available=true` y el rol lo permite.
2. Mostrar duración y transcript; sincronización palabra/audio queda opcional.
3. Endpoint same-origin server-side `GET /api/calls/:id/recording`:
   autentica sesión, clínica y rol; lee la Vapi private key desde Vault; solicita
   `/call/:provider_call_id/stereo-recording`; sigue el redirect temporal en el
   servidor y transmite el audio.
4. Cabeceras `Cache-Control: private, no-store`, sin URL permanente en HTML/JSON,
   sin CORS público y con soporte controlado de `Range`.
5. No ofrecer descarga por defecto; si se habilita, usar el mismo control y dejar
   auditoría explícita.

No se implementa todavía el reproductor ni Storage propio.

## 9. Criterio previo a pilotos

- Confirmar el paquete/retención real de Vapi.
- Validar jurídicamente el aviso y la base de licitud.
- Decidir si el piloto necesita audio; si sí, habilitarlo por clínica con plazo y
  roles explícitos.
- Aplicar en Production la migración de redacción solo con autorización.
- Implementar el job de retención y borrado coordinado antes de conservar audio
  de forma sistemática.

Con audio OFF se conservan transcript, mensajes, metadata de llamada, duración,
estado, eventos y tool invocations; `recording_available=false` y no se conserva
URL ni fichero de audio. Con audio ON en el futuro se conservarán los mismos datos
más `recording_available=true` y `provider_call_id`; el audio seguirá en Vapi y no
se guardará ninguna URL ni copia en Supabase Storage.
