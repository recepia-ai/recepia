# RECEPIA — ROADMAP.md

> **Hoja de ruta viva.** Versión 0.4 — 21 de agosto de 2026.
> Sustituye a la v0.1 (plan de 6 semanas naturales, junio 2026), que quedó obsoleta: el trabajo real se organizó por **épicas y fases**, no por semanas de calendario.
>
> **Para cualquier IA que empiece a trabajar en Recepia: lee este documento entero antes de tocar nada.** Después, según la tarea, lee `PROJECT.md` (visión y decisiones), `AGENT.md` (diseño del agente y config del Dr. Patiño), `SCHEMA.md` (modelo de datos), `SETUP.md` (entorno) y `LEGAL.md`.

---

## 0. Briefing en 60 segundos (contexto mínimo obligatorio)

**Qué es Recepia.** Una plataforma SaaS multi-tenant que sustituye buena parte del trabajo de recepción telefónica y de mensajería de una clínica veterinaria mediante un agente conversacional de IA. No es un asistente para una sola clínica: es un producto configurable donde dar de alta un centro nuevo es **configuración, no desarrollo**.

**Para qué sirve, en concreto.** Una clínica veterinaria media dedica entre 1 y 3 personas a atender el teléfono y el WhatsApp durante todo el horario de apertura. La mayoría de esas interacciones son repetitivas: pedir cita, cambiarla, cancelarla, preguntar horarios, preguntar si hay que venir ya. Recepia automatiza el 60–80 % de ese volumen para liberar al personal hacia atención presencial y para que ninguna consulta se quede sin respuesta a las 22:00 de un domingo.

**Qué hace el agente.**

- Atiende conversaciones y entiende a un cliente que escribe como escribe la gente real.
- Identifica al cliente por su teléfono, y a su mascota; da de alta a los que no existen.
- Consulta disponibilidad real y crea, modifica y cancela citas en el calendario de la clínica.
- Detecta urgencias y escala a una persona según reglas configuradas por la clínica.
- Registra todo: mensajes, invocaciones de tools, citas, resúmenes.

**Qué NO hace, nunca.** No diagnostica, no prescribe medicación, no recomienda productos, no da precios de intervenciones, no autoriza tratamientos, no accede al historial clínico. Estas prohibiciones no son un detalle de producto: son la frontera legal (RGPD, EU AI Act, responsabilidad veterinaria) y la razón por la que el agente tiene guardrails duros. Cualquier cambio que las erosione es un cambio que se rechaza.

**Quién lo usa hoy.** Hospital Veterinario Dr. Patiño, cliente piloto (3 meses gratis a cambio de feedback y derecho a referencia). Interlocutor por parte de la clínica: **Samuel**. Todas las reglas específicas del Dr. Patiño (no atender exóticos, horarios por servicio, escalaciones automáticas, ventana de contacto con veterinarios) viven como **datos** en `clinic_config` y en el seed, nunca como `if` en el código.

**Principios que no se negocian** (detalle en `PROJECT.md` §6):

1. El cerebro vive en nuestro backend. WhatsApp, teléfono y cualquier canal futuro son transporte.
2. Multi-tenancy desde el primer día: `clinic_id NOT NULL` + RLS en todas las tablas de datos de cliente. El piloto no es excusa para hardcodear.
3. Configuración como dato, no como código.
4. Tools tipadas con Zod, testeables sin pasar por el LLM.
5. Idempotencia y auditoría en todo lo que modifica estado externo.
6. Datos en la UE.
7. Humano siempre en el bucle: toda conversación es interrumpible en vivo.

### 0.1 Reinicio operativo — Conversaciones primero

El 20 de agosto de 2026 Marc redefinió el orden de construcción: se conserva todo lo útil del repositorio, pero la ejecución se reinicia desde el vertical que da sentido al producto, **Conversaciones**.

El objetivo operativo es una única zona de conversaciones del hospital con vistas claramente separadas para WhatsApp, teléfono y web. Debe registrar todos los canales, permitir intervención humana en las conversaciones escritas y usar el mismo agente de IA detrás de todos ellos. Calendario, clientes, mascotas y equipo se conectarán progresivamente a este vertical.

**Ruta activa:**

1. **C1 — Centro de Conversaciones:** histórico, búsqueda, filtros, tiempo real, toma de control auditada y timeline preparado para texto, audio y llamadas.
2. **C2 — Núcleo omnicanal:** contrato independiente del proveedor y extracción de la lógica compartida a `packages/core`.
3. **C3 — WhatsApp:** demostración con Meta Cloud API y número de prueba; después onboarding 360dialog/Meta para el número real, adjuntos, reintentos e idempotencia.
4. **C4 — Telefonía real:** Vapi + Twilio como referencia inicial, transcripción, grabación, transferencia en caliente a una persona real y registro en la misma zona de conversaciones. El agente carga únicamente el contexto de la clínica y del cliente identificado para responder sobre citas, operaciones, cirugías, tareas pendientes y consultas sencillas. Los casos reservados a veterinario o secretaría disparan transferencia determinística. Proveedores y gasto se confirman antes de contratar.
5. **C5 — Agente operativo:** conectar el agente común con citas, clientes, mascotas, tareas del hospital, cierre, clasificación y resúmenes.

**Hecho cuando C1:** el panel muestra conversaciones activas y cerradas de web, WhatsApp y teléfono; permite buscar y filtrar; recibe cambios sin recargar; registra quién toma control; y representa una llamada simulada con sus mensajes/transcripción en el timeline.

**Inventario heredado que no se pierde:**

- Samuel considera correctos los 6 casos de la antigua Fase F. Marc hará la revisión final del agente al cierre del proyecto.
- Transparencia explícita de IA decidida: el agente se presenta como IA del equipo del hospital en el primer mensaje y siempre responde con claridad si se lo preguntan.
- Configuración del Dr. Patiño aún hardcodeada en partes del agente.
- Cierre, clasificación y resúmenes automáticos pendientes.
- Guardrails determinísticos, tests, observabilidad y cumplimiento legal pendientes antes de tráfico real.
- Onboarding de 360dialog aplazado hasta producción. Para la demostración se usa Meta Cloud API directa con número de prueba; el número real permanece intacto.
- SMTP de Auth: Resend activo en producción con `recepia.iatope.com` verificado, clave restringida al dominio, plantillas alojadas y límite de 30 emails/hora. Prueba real superada con cinco entregas; las dos claves temporales sin uso ya están revocadas.

Las antiguas fases F–K quedan como referencia e inventario. Ya no determinan el orden activo si contradicen C1–C5.

---

## 1. Estado real a 20 de agosto de 2026

**Último commit:** 29–30 de julio de 2026 (`fix(agent): end-to-end error handling`). El proyecto lleva ~3 semanas sin actividad en el repo.

**Dónde está el producto:** el agente funciona end-to-end **dentro de un chat de pruebas del panel**, contra la base de datos y el Google Calendar reales del entorno de test. Crea clientes, mascotas y citas de verdad. Lo que todavía **no** existe es el canal por el que un cliente final le habla: WhatsApp no está conectado.

**Panel desplegado:** https://recepia-panel.vercel.app (login por magic link de Supabase Auth).

**Fase en curso:** **C3 — WhatsApp real**, con C4 preparado en paralelo. C1 y C2 ya están construidas y compiladas. Samuel ejecutó los 6 casos de la antigua Fase F y los considera correctos. Marc hará la validación definitiva al cierre del proyecto.

### 1.1 Mapa de épicas

| Épica | Estado | Detalle |
|---|---|---|
| **E1 — Infra y deploy** | ✅ Hecho | Monorepo pnpm + Turborepo, Biome, Supabase (proyecto `vsnrlpfsgwwdmiyndwnl`) linkado, panel en Vercel, tipos generados con `pnpm db:gen-types`. |
| **E2 — Schema y datos** | ✅ Hecho | 12 migraciones aplicadas: schema inicial, settings y equipo, RLS, integración Google Calendar, seed real Dr. Patiño, wrappers de Vault, schema de citas, `service_vet_assignments` (N:M servicio↔veterinario). |
| **E3 — Pipeline WhatsApp** | 🟡 **Meta directo construido, E2E pendiente** | Parser común para 360dialog/Meta, webhook Meta con desafío y firma HMAC, inbound/outbound, idempotencia, auditoría, Vault y envío manual construidos. Faltan configurar la app/número de prueba, ventana de 24 h, plantillas, medios y E2E. |
| **E4 — Agente y tools** | 🟡 Fases 1–4 hechas, en Fase F | System prompt, bucle conversacional, persistencia, chat UI de prueba, manejo de errores end-to-end. 11 tools operativas. |
| **E5 — Google Calendar** | ✅ Hecho | OAuth con tokens en Vault, refresh, autodescubrimiento de calendarios, `vet_calendars`, CRUD de eventos. |
| **E6 — Resúmenes y clasificación** | ❌ No empezado | Sin Edge Function de resumen, sin integración DeepSeek, sin dataset golden formalizado. |
| **E7 — Panel: lecturas** | ✅ Hecho (con hueco) | Conversaciones (lista + detalle + timeline), calendario día/semana/mes, clientes con ficha y mascotas. **Falta:** búsqueda global full-text y vista de auditoría `/events`. |
| **E8 — Panel: escrituras** | ✅ Hecho | Tomar control / devolver al agente, ajustes de clínica, perfil, equipo (invitaciones, roles, expulsión), integraciones. **Falta:** editor de `clinic_config` como formulario y CRUD de servicios. |
| **E9 — Cumplimiento legal** | 🟡 Documentado, sin ejecutar | `LEGAL.md` existe. Falta DPIA y Encargado de Tratamiento firmado con el Dr. Patiño. **Bloqueante para tráfico real.** |
| **E10 — Onboarding cliente** | 🟡 Iniciado | Materiales de Fase F entregados. Falta formación del equipo y plan de soporte. |

### 1.2 Tools implementadas (11)

`lookup_client`, `register_new_client`, `lookup_pets_by_client`, `register_new_pet`, `find_service_by_name`, `check_availability`, `create_appointment`, `modify_appointment`, `cancel_appointment`, `lookup_appointments`, `escalate_to_human`.

Viven en `apps/panel/src/lib/agent/tools/`, cada una con su esquema Zod, y se exponen a Anthropic vía `registry.ts` usando `toJSONSchema` nativo de Zod v4.

**Faltan respecto al diseño de `AGENT.md` §5:** `clasificar_conversacion` y `finalizar_conversacion`. Sin ellas no hay cierre automático de conversación ni categorización, y por tanto E6 (resúmenes) no puede dispararse.

---

## 2. Desviaciones respecto a lo documentado

Estas diferencias entre el diseño de `PROJECT.md` y el código real son **conscientes o pendientes de decidir**, no errores a "arreglar" por iniciativa propia. Ninguna IA debe reorganizar esto sin que Marc lo apruebe.

| Documentado | Realidad | Comentario |
|---|---|---|
| Lógica del agente en **Supabase Edge Functions (Deno)** | Vive en **`apps/panel/src/lib/agent/`** (Next.js server-side). El directorio `supabase/functions/` no existe. | Ha permitido iterar mucho más rápido. **Pero** el principio "el cerebro vive en nuestro backend, el canal es transporte" exige que el agente sea invocable desde un webhook de WhatsApp y, más tarde, desde Vapi. Hay dos salidas válidas: (a) exponer el bucle como API route del panel y que el webhook la llame, o (b) extraer a Edge Function al abordar E3. **Decisión pendiente y bloqueante para E3.** |
| `packages/core` con la lógica del agente | Contiene el contrato omnicanal tipado con Zod; el bucle sigue server-side en Next.js. | WhatsApp, web y telefonía comparten contrato y persistencia sin duplicar el cerebro. Queda extraer configuración hardcodeada del prompt. |
| Tools con nombres en español (`crear_cita`, `buscar_cliente`) | Nombres en inglés (`create_appointment`, `lookup_client`). | Cambio de facto. `AGENT.md` §5 está desactualizado en este punto. |
| Testing con Vitest + Playwright | Sin suite de tests automatizados. Validación manual vía páginas `/settings/test-*`. | **Deuda técnica principal del proyecto.** El dataset golden de `PROJECT.md` §12 no existe. |
| Logger Pino, Sentry, PostHog | No integrados. | Bloqueante blando para producción: sin observabilidad no se puede operar el piloto con tráfico real. |
| Gestión de secretos con Doppler | Variables de entorno directas (`turbo.json` declara `ANTHROPIC_API_KEY`, credenciales de Google, etc.). | Aceptable en desarrollo. Revisar antes de comercializar. |

---

## 3. Hoja de ruta heredada hasta producción

Esta sección conserva el plan F–K anterior como referencia e inventario. Desde el reinicio operativo del 20 de agosto de 2026, el orden activo es C1–C5 (§0.1). El objetivo sigue siendo el Dr. Patiño atendiendo WhatsApp y llamadas reales con Recepia desde un único panel.

### Fase F — Validación del agente con Samuel *(en curso)*

**Objetivo:** saber si el agente responde como el Dr. Patiño quiere que responda, antes de conectarlo a nadie real.

- [x] Samuel ha ejecutado los 6 casos del checklist y los considera correctos.
- [x] Feedback funcional recibido: sin cambios solicitados por Samuel.
- [ ] Convertir el feedback en cambios de `system-prompt.ts` y/o `clinic_config`. **Regla: si el cambio es específico del Dr. Patiño, va a la config, no al prompt del código.**
- [ ] Segunda ronda de validación si los cambios son sustanciales.

**Hecho cuando:** Samuel considera publicables las respuestas de los 6 casos. Cumplido; queda una revisión final de Marc al cierre del proyecto.

**Estimación:** 1 semana (mayormente tiempo de Samuel, no de Marc).

---

### Fase G — Cierre del ciclo conversacional

**Objetivo:** que una conversación pueda terminarse y resumirse sola. Corresponde a E4 (resto) + E6.

- [ ] Tool `finalizar_conversacion` (cierra la conversación, marca `status`).
- [ ] Tool `clasificar_conversacion` (categoría + nivel de urgencia, según `AGENT.md` §5.8).
- [ ] Generación de resumen estructurado al cierre, con **DeepSeek** (no Claude: es tarea batch y el coste importa). Persistir en `conversation_summaries`.
- [ ] Cierre por inactividad (timeout configurable por clínica).
- [ ] Mostrar el resumen en el detalle de conversación del panel.

**Hecho cuando:** una conversación del chat de prueba se cierra sola, genera resumen y categoría, y ambos se ven en el panel.

**Estimación:** ~20 h.

---

### Fase H — Decisión arquitectónica y punto de entrada del agente

**Objetivo:** desbloquear E3. **Esta fase es una decisión, no código; no empieces E3 sin cerrarla.**

- [x] Decidido: el bucle permanece server-side en Next.js y los webhooks invocan un procesador común interno.
- [x] Contratos de canal extraídos a `packages/core`.
- [x] Contrato Zod independiente del proveedor para mensajes y eventos de llamada.
- [x] Decisión y operación documentadas en `PROJECT.md` y `conversations-operations.md`.

**Criterio para decidir:** el mismo bucle tiene que servir para WhatsApp hoy y para Vapi en la Iteración 2, sin duplicar lógica. Si la opción elegida no cumple eso, es la opción equivocada.

**Estimación:** ~8 h.

---

### Fase I — Pipeline WhatsApp (E3)

**Objetivo:** que un mensaje real de WhatsApp entre, lo procese el agente, y la respuesta salga.

**Pre-requisitos de demostración:**

- [ ] App de desarrollo de Meta creada con el producto WhatsApp y número de prueba.
- [ ] Webhook de prueba suscrito al campo `messages`.
- [ ] Cuenta 360dialog y número real: aplazados hasta preparar producción, sin método de pago durante la demostración.

**Tareas:**

- [x] Webhook inbound: header secreto de 360dialog, resolución multi-tenant por Phone Number ID/número, identificación del cliente, conversación activa o nueva e inserción idempotente.
- [ ] Outbound 360dialog: envío y persistencia con identificador real construidos; faltan reintentos persistentes y cola de fallos.
- [ ] Poblar `clinic_channels` con el número del Dr. Patiño y `provider='360dialog'`.
- [x] Conectar el bucle del agente común al webhook.
- [x] Añadir Meta Cloud API directa como segundo transporte, con validación de firma y secretos separados.
- [ ] E2E con número de prueba de Meta y toma de control manual.
- [ ] Gestión de la ventana de 24 h de WhatsApp y de plantillas cuando se excede.

**Hecho cuando:** Marc escribe un WhatsApp al número, el agente le da cita, la cita aparece en Google Calendar y la conversación aparece en el panel.

**Estimación:** ~30 h + tiempo de espera de Meta.

---

### Fase J — Endurecimiento para tráfico real

**Objetivo:** poder dormir tranquilo con el sistema encendido.

- [ ] **Dataset golden**: ≥ 20 conversaciones reales o realistas del Dr. Patiño, con las tool calls y clasificaciones esperadas.
- [ ] Suite de evaluación automatizada (Vitest) que corra el dataset y reporte % de acierto. **Umbral de producción: ≥ 80 %.**
- [ ] Tests unitarios de las 13 tools.
- [ ] Sentry en panel y backend; PostHog para eventos de producto. Con masking de datos personales.
- [ ] **Kill switch** por clínica (`clinics.status='suspended'`) probado de verdad.
- [ ] Modo supervisado: notificación al panel por cada respuesta del agente, activable por clínica.
- [ ] Vista `/events` de auditoría (admin) y búsqueda global en el panel.
- [ ] PITR de Supabase activado antes de que entre el primer dato real.

**Hecho cuando:** el dataset golden pasa al ≥ 80 %, Sentry recibe errores y el kill switch corta el servicio en menos de un minuto.

**Estimación:** ~25 h.

---

### Fase K — Legal y lanzamiento (E9 + E10)

**Objetivo:** encender Recepia en el WhatsApp real del Dr. Patiño.

- [ ] **DPIA ligera** redactada.
- [ ] **Encargado de Tratamiento firmado** con el Dr. Patiño. *Sin esto no entra tráfico real, sin excepciones.*
- [ ] Política de privacidad y aviso legal del panel publicados.
- [ ] Editor de `clinic_config` como formulario en el panel (hoy solo se edita por SQL/seed) + CRUD de servicios.
- [ ] Sesión de formación con el equipo del Dr. Patiño (2 h) y documento de uso de 2–3 páginas.
- [ ] Canal de soporte con Marc y SLA orientativo (< 2 h en horario laborable).
- [ ] Cambio al número real y 14 días en modo supervisado.

**Hecho cuando:** un día completo de tráfico real sin incidentes graves y sin ninguna urgencia mal clasificada.

**Estimación:** ~25 h + plazos legales.

---

### Resumen de la ruta

| Fase | Bloque | Estimación | Bloquea a |
|---|---|---|---|
| F | Validación con Samuel | 1 semana (de Samuel) | G |
| G | Cierre + resúmenes | ~20 h | — |
| H | Decisión arquitectónica | ~8 h | **I** |
| I | Pipeline WhatsApp | ~30 h + Meta | J, K |
| J | Endurecimiento | ~25 h | K |
| K | Legal y lanzamiento | ~25 h + legal | producción |

**Camino crítico:** los trámites de 360dialog y Meta. Arráncalos en paralelo con las fases F y G, no cuando llegue la Fase I.

---

## 4. Definición de "hecho" para el MVP

El MVP se considera listo para producción cuando:

1. Fases F a K completadas.
2. Dataset golden ≥ 20 conversaciones, pasando con ≥ 80 % de acierto en tool calls y clasificación de urgencia.
3. Cero bugs P0 abiertos.
4. Encargado de Tratamiento firmado.
5. Documento de uso entregado al equipo del Dr. Patiño y formación hecha.
6. Sentry y PostHog recibiendo datos, sin errores sin triar acumulados.
7. Kill switch probado.
8. Plan de soporte del piloto activo y comunicado.

**Criterios de éxito del piloto** (se miden después, sobre 30 días de tráfico): ≥ 60 % de conversaciones resueltas sin intervención humana, cero incidentes graves de clasificación de urgencia, feedback positivo del personal.

---

## 5. Deuda técnica acumulada

Priorizada. No se resuelve por iniciativa propia de una IA: se resuelve en la fase donde está asignada.

| Deuda | Gravedad | Dónde se resuelve |
|---|---|---|
| Sin tests automatizados de ningún tipo | Alta | Fase J |
| Sin observabilidad (Sentry / PostHog / logger) | Alta | Fase J |
| `packages/core` vacío; lógica acoplada al panel | Media | Fase H |
| `AGENT.md` §5 desactualizado (nombres de tools) | Media | Fase G |
| Páginas `/settings/test-*` expuestas en el panel de producción | Media | Fase K (ocultar o proteger tras rol admin) |
| `clinic_config` solo editable por SQL | Media | Fase K |
| Sin gestión de secretos (Doppler) | Baja | Antes de comercializar |
| Sin CI (lint + build en cada push) | Baja | Fase J |

---

## 6. Riesgos vivos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| **Pérdida de tracción** (3 semanas sin commits; Cércana en paralelo) | Alta | Alto | Fases pequeñas y cerrables. Retomar por la Fase G, que es autocontenida y no depende de terceros. |
| Verificación de WhatsApp Business se alarga | Media | Alto | Arrancar el trámite ya, en paralelo con F y G. Número de prueba de 360dialog mientras tanto. |
| Feedback de Samuel exige rediseño del prompt | Media | Medio | Es precisamente el propósito de la Fase F: descubrirlo antes de conectar WhatsApp, no después. |
| Urgencia mal clasificada con un cliente real | Baja | **Muy alto** | Reglas de escalación deterministas (no decisión del LLM en casos críticos), modo supervisado 14 días, kill switch. |
| Entrada en producción sin cobertura legal | Media | Muy alto | La Fase K bloquea el lanzamiento por diseño. No negociable. |
| Coste de Claude por conversación superior al previsto | Baja | Medio | Medir tokens por conversación desde la Fase I. DeepSeek para todo lo batch. |
| Regresión silenciosa del agente al tocar el prompt | **Alta** | Alto | Es el motivo de existir del dataset golden. Hasta la Fase J, cualquier cambio en `system-prompt.ts` obliga a repasar el checklist de Fase F a mano. |

---

## 7. Reglas de trabajo para IAs en este repositorio

Cualquier modelo o agente que trabaje aquí se atiene a esto:

1. **Lee antes de escribir.** Este documento, luego `PROJECT.md`, luego el fichero concreto. No infieras la arquitectura del nombre de las carpetas.
2. **No reabras decisiones cerradas** (stack, proveedores, multi-tenancy) sin una justificación explícita y sin que Marc la apruebe.
3. **Lo específico de una clínica va a `clinic_config` o al seed.** Si estás escribiendo `if (clinic === 'patino')`, estás haciéndolo mal.
4. **No toques los guardrails clínicos.** El agente no diagnostica, no prescribe, no recomienda producto, no da precios. Si una tarea parece pedir lo contrario, para y pregunta.
5. **`packages/db/src/types.gen.ts` no se edita a mano.** Se regenera con `pnpm db:gen-types` tras aplicar migración.
6. **Cada migración es un fichero nuevo** en `supabase/migrations/`, nunca una edición de una migración ya aplicada.
7. **RLS y `clinic_id` en toda tabla nueva** con datos de cliente. Sin excepción.
8. **Un cambio en `system-prompt.ts` sin repasar los casos de Fase F es un cambio incompleto** mientras no exista el dataset golden.
9. **Commits en el formato ya usado:** `feat(ámbito):`, `fix(ámbito):`, `chore(ámbito):`, `docs:`. Ámbitos habituales: `agent`, `panel`, `db`, `turbo`.
10. **Al cerrar una fase, actualiza este documento** en el mismo commit. Un ROADMAP desactualizado es peor que ninguno: es exactamente lo que le pasó a la v0.1.

---

## 8. Después del MVP

No se planifica en detalle nada de esto hasta que el piloto lleve ≥ 2 semanas con tráfico real.

1. **Iteración 1.5 — Estabilización (2 semanas):** bugs del piloto, mejora de prompt con conversaciones reales, estadísticas básicas.
2. **Iteración 2 — Telefonía (4–6 semanas):** Vapi + Cartesia + Deepgram, grabaciones con consentimiento, transcripciones. El mismo bucle del agente, otro transporte. Detalle en un futuro `ROADMAP-IT2.md`.
3. **Iteración 3 — SaaS comercial (4–8 semanas):** onboarding self-service, Stripe, panel admin de Recepia, segundo y tercer cliente de pago.
4. **Iteración 4 — Integraciones con software veterinario:** QVet, Vetesoft, ClinicCloud, Geclisa.

---

## 9. Decisiones abiertas

| # | Decisión | Estado | Se cierra en |
|---|---|---|---|
| 1 | Punto de entrada del agente: API route del panel vs Edge Function | **Abierta — bloqueante** | Fase H |
| 2 | ¿Se extrae la lógica a `packages/core`? | Abierta | Fase H |
| 3 | Transporte WhatsApp | Parcialmente cerrada 21-08-2026: Meta directo para pruebas; 360dialog previsto para producción sin contratar todavía | Antes del número real |
| 4 | Estrategia de cierre de conversación por inactividad (timeout) | Abierta | Fase G |
| 5 | Gestión de secretos: Doppler vs variables de entorno | Diferida | Antes de comercializar |
| 6 | Dominio comercial definitivo (`recepia.com` / `.es` / `.ai`) + marca OEPM | Abierta | Antes de la Fase K |

Al cerrar una decisión: anótala aquí con fecha y razonamiento, y refleja el cambio en `PROJECT.md` §12.

---

## 10. Cambios

| Fecha | Versión | Autor | Cambio |
|---|---|---|---|
| 2026-06-10 | 0.1 | Marc + Claude | Documento inicial. Plan de 6 semanas. Piloto Dr. Patiño confirmado. |
| 2026-08-20 | 0.2 | Marc + Claude | Reescritura completa. Se sustituye el plan por semanas naturales por fases F–K. Se añade briefing de contexto para IAs (§0), estado real por épicas (§1), desviaciones respecto al diseño (§2), deuda técnica (§5) y reglas de trabajo para IAs (§7). |
| 2026-08-20 | 0.3 | Marc + Codex | Reinicio operativo con Conversaciones como vertical prioritario. Se añade la ruta C1–C5 y se conserva F–K como inventario heredado. |
| 2026-08-21 | 0.4 | Marc + Codex | Meta Cloud API directa pasa a ser el transporte de demostración con número de prueba; 360dialog se aplaza hasta producción. Se refleja el adaptador común y el E2E pendiente. |
