# RECEPIA — ROADMAP.md (Iteración 1)

> Plan ejecutivo de las 6 semanas hasta tener Recepia operativa por WhatsApp en el Hospital Veterinario Dr. Patino. Versión 0.1 — junio 2026.
>
> Este documento se actualiza al cierre de cada semana con lo realmente ejecutado y los ajustes para la siguiente.

---

## 1. Visión de la iteración

**Objetivo:** Recepia atendiendo conversaciones de WhatsApp en el Hospital Veterinario Dr. Patino con panel de control para su personal, en producción, al final de la semana 6.

**Capacidad disponible:** ~25 h/semana de Marc (asumiendo Cércana en paralelo). 150 h totales.

**Stack ya cerrado** (referencias en `PROJECT.md`):
- Supabase (PostgreSQL + Auth + Storage + Edge Functions), región EU.
- Next.js 15 + TypeScript + Tailwind + shadcn/ui.
- 360dialog (BSP de WhatsApp Business).
- Claude Sonnet (LLM agente) + DeepSeek (LLM batch para resúmenes y clasificación).
- Google Calendar para agenda.

**Lo que NO se construye en Iteración 1:** telefonía, onboarding self-service, facturación, integraciones con software veterinario, estadísticas avanzadas.

---

## 2. Decisiones cerradas en este roadmap

Estas decisiones estaban abiertas en PROJECT.md §12. Las cierro aquí para no perder tiempo en semana 1.

| Decisión | Resolución | Razonamiento |
|---|---|---|
| Hosting del panel | **Vercel** | Cero fricción con Next.js 15, free tier suficiente para piloto, deploys por push, edge functions complementarias. Migración a Coolify/Hetzner cuando ingresos lo justifiquen. |
| Estructura monorepo | **pnpm workspaces + Turborepo** | Standard de facto para Next.js + paquetes compartidos. Curva mínima. Cércana usa Next.js pero distinto contexto; aquí Turborepo aporta cacheado de builds. |
| LLM principal del agente | **Claude Sonnet (4.5 o superior disponible)** | Function calling fiable, español natural, razonamiento robusto para reglas complejas. GPT-4o se evalúa en semana 4 con dataset golden si hay dudas. |
| LLM para resúmenes/clasificación | **DeepSeek-chat** | Coste ~10x menor que Claude. Calidad suficiente para tareas estructuradas (JSON output). Ya validado por Marc en otros proyectos. |
| Cliente Supabase TypeScript | **`@supabase/ssr` + tipos generados** | Soporte App Router de Next.js 15, cookies seguras, tipado fuerte. |
| Validación de schemas | **Zod** | Para `clinic_config`, tool inputs/outputs, payloads de webhooks. |
| Testing | **Vitest** (unit + integration) y **Playwright** (e2e mínimo) | Vitest por velocidad y compatibilidad ESM/TS. Playwright solo para flujos críticos del panel. |
| Logger | **Pino** con transporte a Sentry/PostHog | Estructurado, JSON, performante. |
| Gestión de secretos | **Doppler** (recomendado) o variables Supabase | Marc viene de incidentes pasados con secretos en otros proyectos: Doppler obliga a higiene. |
| Linter / formatter | **Biome** | Más rápido que ESLint+Prettier, una sola herramienta, configuración mínima. |

---

## 3. Hitos clave (milestones)

| Hito | Fin de | Demuestra |
|---|---|---|
| M1 — Fundaciones | Semana 1 | Repo público, monorepo arrancando, schema aplicado en Supabase, panel "hello world" en Vercel |
| M2 — Pipeline WhatsApp | Semana 2 | Un mensaje real de WhatsApp llega al webhook y se persiste en `messages` |
| M3 — Agente operativo | Semana 3 | El agente conversa por WhatsApp, identifica cliente, crea citas reales en Google Calendar |
| M4 — Panel funcional | Semana 4 | Personal de la clínica puede ver conversaciones y citas desde un navegador |
| M5 — Configurable e intervenible | Semana 5 | Humano puede tomar control de una conversación; admin puede editar `clinic_config` desde el panel |
| M6 — En producción | Semana 6 | Hospital Dr. Patino usa Recepia en su WhatsApp real con al menos un día de tráfico sin incidentes |

---

## 4. Cadencia operativa

- **Daily personal (10–15 min):** revisión de lo de ayer + plan de hoy. Marc en su cuaderno o herramienta habitual.
- **Weekly Recepia (30 min, viernes tarde):** revisión del checkpoint de la semana, ajuste de la siguiente. Output: actualizar este documento.
- **Weekly Dr. Patino (30 min, día a acordar):** demo + feedback. A partir de semana 4 si hay algo demostrable; antes, llamada breve de coordinación si hace falta input de la clínica.

---

## 5. Detalle por semanas

### Semana 1 — Fundaciones

**Objetivo:** Entorno de desarrollo y producción listo. Schema en Supabase aplicado. Panel "hello world" desplegado en Vercel. Cero código de producto todavía, todo plumbing.

**Pre-requisitos** (cerrar antes de empezar):
- [ ] Verificada disponibilidad de `recepia.com` / `.es` / `.ai` (Marc).
- [ ] Decisión final sobre dominio para el piloto (sugerencia: `recepia.iatope.com` durante desarrollo, como con Cércana).
- [ ] Email de confirmación del piloto cruzado con Dr. Patino.
- [ ] Cuenta de Doppler creada (free tier).

**Tareas:**

1. **Crear organización GitHub `recepia-ai`** y repositorio `recepia-ai/recepia` (privado por ahora).
   - *Hecho cuando:* repo existe, README inicial con link a docs.
2. **Inicializar monorepo** con pnpm workspaces + Turborepo.
   - Estructura: `apps/panel`, `packages/core`, `packages/db`, `packages/ui`, `supabase/`, `docs/`.
   - *Hecho cuando:* `pnpm install` y `pnpm turbo build` corren sin errores.
3. **Copiar los 4 documentos** (PROJECT.md, SCHEMA.md, AGENT.md, ROADMAP.md) a `docs/`.
4. **Configurar Biome** en raíz para todo el monorepo.
5. **Crear proyecto Supabase** en región Frankfurt o Dublin. Plan Free para empezar.
   - *Hecho cuando:* URL y anon key obtenidas, guardadas en Doppler.
6. **Configurar Doppler** con proyectos `recepia-dev` y `recepia-prod`. Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
7. **Inicializar Supabase CLI** localmente: `supabase init`. Vincular al proyecto remoto con `supabase link`.
8. **Aplicar migración inicial** del SCHEMA.md:
   - Crear `supabase/migrations/20260610_000000_initial_schema.sql` con el SQL de la sección 11 de SCHEMA.md.
   - `supabase db push`.
   - *Hecho cuando:* todas las tablas aparecen en Supabase Studio con RLS activada.
9. **Generar tipos TypeScript**: `supabase gen types typescript --linked > packages/db/types.gen.ts`.
10. **Crear app `panel`** con `pnpm dlx create-next-app@latest apps/panel --typescript --tailwind --app`.
11. **Configurar shadcn/ui** en `apps/panel` con `pnpm dlx shadcn-ui@latest init`.
12. **Página de login** con Supabase Auth Magic Link (sin diseño elaborado, solo funcional).
13. **Crear usuario admin** del Dr. Patino en Supabase Auth, vincularlo en `clinic_users` con rol `admin`.
14. **Aplicar seed inicial**: clínica Dr. Patino + `clinic_config` de AGENT.md §11 + catálogo de servicios.
15. **Desplegar `apps/panel` en Vercel** conectado al repo de GitHub. Variables de entorno desde Doppler (integración Doppler↔Vercel).
16. **Login funcional en producción:** Marc puede acceder a `recepia.iatope.com` (o el dominio que se decida) con el usuario admin y ve una página vacía con su email arriba.

**Entregable de la semana:** Vercel sirviendo el panel, login con Magic Link funciona, Marc autenticado puede leer (vía RLS) la fila de la clínica Dr. Patino desde el cliente.

**Checkpoint validable:**
- [ ] `pnpm turbo build` pasa.
- [ ] Migración aplicada, RLS activa, seed cargado.
- [ ] Magic Link login funciona en producción.
- [ ] Una consulta autenticada al cliente Supabase devuelve `clinics` con 1 fila.

**Riesgos específicos:**
- Doppler ↔ Vercel integration puede tardar en sincronizar la primera vez. Fallback: variables manuales en Vercel.
- Magic Link requiere SMTP configurado en Supabase. Si falla, usar provider Resend o el SMTP por defecto de Supabase para piloto.

**Tiempo estimado:** ~25 h.

---

### Semana 2 — Pipeline WhatsApp inbound + outbound

**Objetivo:** Mensajes reales de WhatsApp entran al sistema y se persisten en la base de datos. El sistema puede responder mensajes (no con IA aún, solo eco controlado). Motor de carga de `clinic_config` listo.

**Pre-requisitos:**
- [ ] Cuenta de 360dialog creada y verificada.
- [ ] Número WhatsApp Business del Dr. Patino solicitado o uno de prueba provisionado por 360dialog.
- [ ] Plantillas iniciales aprobadas (saludo de bienvenida).

**Tareas:**

1. **Configurar webhook entrante en 360dialog** apuntando a Edge Function `whatsapp_inbound`.
2. **Edge Function `whatsapp_inbound`** en `supabase/functions/whatsapp_inbound/index.ts`:
   - Validar firma del webhook (HMAC).
   - Identificar `clinic_id` por número receptor (`clinic_channels.identifier`).
   - Buscar o crear `clients` por `phone`.
   - Buscar `conversations` activa del cliente o crear nueva.
   - Insertar `messages` con `direction='inbound'`.
   - Disparar (por ahora solo loguear) la cola del agente.
   - *Hecho cuando:* envías un mensaje de WhatsApp al número y aparece en la tabla `messages` en Supabase Studio.
3. **Edge Function `whatsapp_outbound`** (helper interno, no webhook):
   - Recibe `conversation_id` y `content`.
   - Llama a la API de 360dialog para enviar.
   - Persiste el mensaje en `messages` con `direction='outbound'`.
   - Maneja errores y reintentos básicos.
4. **Package `packages/core/src/config/`**:
   - Tipos Zod del esquema `clinic_config` (espejo del JSON Schema de AGENT.md §3).
   - Función `loadClinicConfig(clinicId)` que carga, valida y cachea (in-memory por proceso, TTL 60s).
   - Tests unitarios del parser con la config del Dr. Patino.
5. **Tabla `clinic_channels`** poblada con el número de WhatsApp del Dr. Patino y `provider='360dialog'`.
6. **Eco controlado:** mientras no haya agente real, una rama del flujo manda al cliente "Hemos recibido tu mensaje, en breve te atenderemos" después de los primeros 5 segundos sin respuesta. Esto valida el outbound end-to-end.
7. **Página `/conversations` en el panel** (lectura, sin estilos finales): tabla simple que lista conversaciones de la clínica del usuario logueado. Esto valida RLS desde el frontend.
8. **Logger Pino** integrado en Edge Functions con destinos configurables (consola en dev, Sentry en prod).

**Entregable:** envío un WhatsApp al número del Dr. Patino, el mensaje aparece en `messages`, el sistema responde con eco, y veo la conversación listada en `/conversations` del panel.

**Checkpoint:**
- [ ] Webhook recibe y valida correctamente.
- [ ] `clinic_config` se carga validada por Zod.
- [ ] Mensajes entran y salen vía 360dialog.
- [ ] Panel lista conversaciones respetando RLS.

**Riesgos:**
- Verificación del número de WhatsApp Business por Meta puede tardar 1–3 días hábiles. Iniciar trámite en semana 1.
- 360dialog puede requerir display name aprobado antes de enviar fuera de plantilla. Tenerlo en cuenta.

**Tiempo estimado:** ~25 h.

---

### Semana 3 — Agente conversacional operativo

**Objetivo:** El agente IA atiende conversaciones reales de WhatsApp end-to-end. Identifica al cliente, gestiona citas en Google Calendar, transfiere cuando corresponde.

**Pre-requisitos:**
- [ ] Pipeline WhatsApp de semana 2 funcionando.
- [ ] Credenciales de Anthropic API en Doppler.
- [ ] OAuth de Google Calendar conectado al menos al calendario de prueba.

**Tareas:**

1. **Package `packages/core/src/agent/`**:
   - `prompts/system.ts`: plantilla del system prompt de AGENT.md §4 + función `buildSystemPrompt(config, channel, clientHistory)`.
   - `tools/`: implementación de las 10 tools de AGENT.md §5. Cada tool: archivo independiente con JSON Schema (Zod → JSON Schema), handler tipado, tests unitarios.
   - `loop.ts`: bucle conversacional principal. Recibe `conversation_id` y un mensaje nuevo, carga contexto, llama al LLM, ejecuta tools, escribe respuesta.
2. **Integración Google Calendar:**
   - Edge Function `oauth_google_callback`.
   - Persistencia de tokens en `clinic_integrations.credentials`.
   - Refresh automático.
   - Helpers `getAvailableSlots`, `createEvent`, `updateEvent`, `deleteEvent` en `packages/core/src/integrations/google_calendar.ts`.
3. **Conectar bucle del agente al pipeline de WhatsApp:**
   - `whatsapp_inbound` deja de hacer eco y encola al agente (Supabase queue o invocación directa con timeout).
   - El agente responde vía `whatsapp_outbound`.
4. **Guardrails básicos** (AGENT.md §10): no múltiples preguntas, longitud máxima, detección de patrones de prescripción.
5. **Generación de resúmenes** (Edge Function `summarize_conversation`): se dispara al cerrar conversación, llama a DeepSeek, persiste en `conversation_summaries`.
6. **Tests de agente con dataset mínimo:** 5–10 conversaciones simuladas que validen las 3–4 rutas principales (alta de cliente nuevo + cita, transferencia por receta, rechazo de exótico, urgencia crítica).

**Entregable:** envío un WhatsApp diciendo "Quiero pedir cita para mi perro Toby, tiene cojera". El agente identifica que soy cliente nuevo, me pregunta nombre, registra al cliente y la mascota, propone un hueco, lo confirma, crea cita en Google Calendar y me envía confirmación. Todo registrado en DB.

**Checkpoint:**
- [ ] Flujo "cita nueva" funciona end-to-end con persona real.
- [ ] Flujo "rechazo de exótico" responde como dice la config.
- [ ] Flujo "transferencia por receta" cambia `conversation.status` a `awaiting_human`.
- [ ] Resumen generado tras cerrar conversación.

**Riesgos:**
- Calidad del prompt en español puede requerir varias iteraciones. Presupuestar 20% del tiempo de la semana a prompt engineering.
- Tool calling con argumentos complejos (fechas ISO, IDs) a veces falla. Validación Zod estricta y reintento con feedback al LLM.
- Latencia de respuesta total < 8s. Si excede, optimizar.

**Tiempo estimado:** ~30 h (semana intensiva).

---

### Semana 4 — Panel funcional

**Objetivo:** El personal del Dr. Patino puede ver, en un navegador, todo lo que está pasando: conversaciones en vivo, citas del día, fichas de cliente y mascota.

**Tareas:**

1. **Layout y navegación del panel** (sidebar + topbar) con shadcn/ui.
2. **Página `/conversations`**: lista filtrada por estado (activas, esperando humano, completadas). Realtime con Supabase Realtime para actualizaciones en vivo.
3. **Página `/conversations/[id]`**: detalle de conversación con timeline de mensajes, datos de cliente y mascota a la derecha, resumen IA (si existe).
4. **Página `/calendar`**: vista de citas del día (usa la vista `v_today_appointments`). Tabla simple por ahora.
5. **Página `/clients`**: búsqueda y listado. Detalle de cliente con sus mascotas e historial.
6. **Componentes reutilizables en `packages/ui/`**: `MessageBubble`, `ConversationListItem`, `PetCard`, `ClientCard`, `StatusBadge`, `UrgencyBadge`.
7. **Búsqueda global rudimentaria**: input que consulta full-text en `messages` y devuelve resultados linkados a sus conversaciones.
8. **Vista de auditoría `/events`** (solo admin): tabla de últimos eventos. Útil en piloto para depurar.

**Entregable:** Marc o cualquier persona del Dr. Patino accede al panel, ve la conversación que está sucediendo en este momento, abre el detalle, ve el timeline y los datos del cliente.

**Checkpoint:**
- [ ] Realtime de mensajes funciona.
- [ ] Navegación entre vistas sin recargas excesivas.
- [ ] Búsqueda devuelve resultados.
- [ ] Móvil aceptable (no perfecto, sí utilizable).

**Riesgos:**
- Realtime de Supabase tiene límite de canales por proyecto. Para piloto suficiente; vigilar en escala.
- Diseño puede consumir más tiempo del previsto. Restricción: shadcn/ui defaults, no diseñar componentes a medida en esta semana.

**Tiempo estimado:** ~25 h.

---

### Semana 5 — Intervención humana + configurador

**Objetivo:** El personal puede tomar control de una conversación en vivo. El admin puede editar la configuración de la clínica desde el panel.

**Tareas:**

1. **Botón "Tomar control"** en detalle de conversación:
   - Cambia `conversations.assigned_to` al user_id actual y `status` a `human_handling`.
   - Pausa al agente para esa conversación (flag verificado por `loop.ts`).
   - Habilita input de texto en el panel para escribir como humano.
2. **Botón "Devolver al agente"**: invierte la operación.
3. **Página `/settings`** (solo admin):
   - Edición de `clinic_config` como formulario estructurado (no JSON raw).
   - Secciones: identidad, horarios, reglas de transferencia, política de exóticos, ventana de veterinarios.
   - Cada cambio se guarda con incremento de versión y se archiva en `clinic_config_history`.
4. **Página `/settings/services`**: gestión del catálogo de servicios (CRUD).
5. **Página `/settings/integrations`**: estado de Google Calendar, reconexión si OAuth expira.
6. **Página `/settings/team`** (admin): invitar usuarios a la clínica, asignar roles.
7. **Notificaciones in-app:** badge en sidebar cuando hay conversaciones `awaiting_human`. Sonido opcional (en MVP, silencioso por defecto).

**Entregable:** una conversación que el agente transfiere aparece en estado "esperando humano". El recepcionista entra, pulsa "tomar control", escribe al cliente y resuelve. Después, el admin edita los horarios de la clínica desde la sección de configuración.

**Checkpoint:**
- [ ] Transferencia de control entre agente y humano sin race conditions.
- [ ] Cambios de config se aplican sin reiniciar nada.
- [ ] `clinic_config_history` registra cada cambio.

**Riesgos:**
- Race condition: agente y humano escribiendo a la vez. Mitigar con bloqueo optimista (versión de conversación).
- Validación de config en formulario debe espejar Zod del backend. Generador `zod-to-form` o mantenerlo a mano.

**Tiempo estimado:** ~25 h.

---

### Semana 6 — Pulido y puesta en producción

**Objetivo:** Recepia en producción real con el Dr. Patino. Bugs críticos resueltos. Personal entrenado.

**Tareas:**

1. **Sesión de onboarding presencial o por videollamada** con el equipo del Dr. Patino (2 h):
   - Demo de cada parte del panel.
   - Roles asignados.
   - Cómo escalar problemas.
2. **Recepia en el número WhatsApp real del Dr. Patino** (cambio desde número de prueba). Verificación con Meta completada.
3. **Tests de regresión completos** con el dataset golden (que ya debería tener ~20–30 conversaciones recogidas durante semanas 3–5).
4. **Modo supervisado activado:** durante 14 días tras lanzamiento, notificación al panel por cada respuesta del agente (configurable).
5. **Resolución de bugs P0/P1** del backlog acumulado.
6. **Documento para el equipo del Dr. Patino:** PDF de 2–3 páginas con cómo usar el panel, cómo escalar, cómo tomar control. Útil para que no dependan de Marc para todo.
7. **Plan de soporte del piloto:** canal de Slack/WhatsApp compartido con Marc, SLA orientativo (respuesta en < 2 h en horario laborable).
8. **Backup y disaster recovery comprobado:** PITR de Supabase activado en plan Pro si el piloto está usando datos reales sensibles.
9. **DPIA ligera** y firma del Encargado de Tratamiento (preparados a partir del documento legal mínimo que se hará en paralelo a estas semanas).
10. **Retrospectiva personal de la Iteración 1:** qué funcionó, qué no, qué mover a Iteración 2.

**Entregable:** Hospital Veterinario Dr. Patino atiende su WhatsApp con Recepia en producción. Un día completo sin incidentes graves.

**Checkpoint:**
- [ ] 100% de conversaciones del día persistidas correctamente.
- [ ] 0 transferencias mal clasificadas en casos críticos (medicación, hospitalización, urgencias).
- [ ] Personal del Dr. Patino puede usar el panel sin ayuda de Marc.
- [ ] Encargado de Tratamiento firmado.

**Riesgos:**
- Ola de uso real puede sacar bugs no detectados en testing. Tener disponibilidad alta esos primeros días.
- Personal puede resistirse al cambio. Mitigar con onboarding humano de verdad, no solo PDF.

**Tiempo estimado:** ~25 h.

---

## 6. Backlog organizado por épicas

Los bloques semanales agrupan tareas heterogéneas. En paralelo conviene organizar el trabajo por **épicas** para que Claude Code pueda trabajar bloques completos sin saltar de contexto.

| Épica | Semanas relacionadas | Descripción |
|---|---|---|
| E1 — Infra y deploy | 1, 6 | Repo, monorepo, Supabase, Vercel, Doppler, CI |
| E2 — Schema y datos | 1, 5 | Migraciones, RLS, seed, historial de config |
| E3 — Pipeline WhatsApp | 2, 6 | 360dialog, webhooks, mensajes inbound/outbound |
| E4 — Agente y tools | 3 | System prompt, 10 tools, bucle conversacional, guardrails |
| E5 — Integraciones externas | 3 | Google Calendar OAuth y CRUD de eventos |
| E6 — Resúmenes y clasificación | 3 | Edge Function de resumen, dataset de evaluación |
| E7 — Panel: lecturas | 4 | Conversaciones, calendario, clientes, mascotas, búsqueda |
| E8 — Panel: escrituras | 5 | Intervención humana, configurador, gestión de servicios y equipo |
| E9 — Cumplimiento legal | 5, 6 | DPIA, Encargado de Tratamiento, política de privacidad |
| E10 — Onboarding cliente | 6 | Documentación, formación, soporte |

Cada épica vive como issue o milestone en GitHub. Cada tarea semanal es una issue hija.

---

## 7. Definición de "hecho" para el MVP

El MVP se considera **listo para producción** cuando:

1. Las 6 semanas de hitos están cumplidas.
2. El dataset golden de evaluación (≥ 20 conversaciones del Dr. Patino) pasa con ≥ 80% de aciertos en tool calls y clasificación de urgencia.
3. No hay bugs P0 abiertos.
4. Encargado de Tratamiento firmado con el Dr. Patino.
5. Documento de uso del panel entregado al equipo.
6. Sentry y PostHog reciben datos en producción y no hay errores no triados acumulados.
7. Plan de soporte del piloto activado y comunicado.

---

## 8. Riesgos transversales del roadmap

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Marc no puede dedicar 25 h/semana por carga de Cércana | Alta | Alto | Reducir alcance de semanas 4–5 (panel más simple). Posponer features no críticas a Iteración 1.5. |
| Verificación WhatsApp Business tarda más de lo esperado | Media | Alto | Iniciar trámite semana 1 sin esperar a tener pipeline. Mientras tanto, usar número de prueba 360dialog. |
| Dr. Patino no facilita acceso a Google Calendar a tiempo | Media | Medio | Mockear integración con calendario de Marc para desarrollo, cambiar antes de semana 6. |
| Personal de la clínica no usa el panel (resistencia) | Media | Alto | Onboarding humano semana 6 + iteración rápida según feedback. |
| Coste de Claude API mayor del previsto en piloto | Baja | Medio | Monitorizar tokens por conversación desde semana 3. Si excede umbral, pasar a Claude Haiku para tareas no críticas. |
| Bug crítico en producción tras lanzamiento | Media | Muy alto | Modo supervisado primeros 14 días + kill switch global por clínica (`clinics.status='suspended'`). |
| Pérdida de datos por error de schema | Muy baja | Muy alto | PITR de Supabase activado antes de cargar datos reales. Migraciones siempre con backup previo. |

---

## 9. Qué cambia en este documento con el tiempo

Este ROADMAP es **vivo**. Al cierre de cada semana, en la sesión de viernes:

1. Marcar tareas hechas vs no hechas.
2. Anotar deuda técnica acumulada que se mueve a Iteración 2.
3. Ajustar plan de la semana siguiente si hay desviaciones > 20%.
4. Si una semana se desliza, mover el hito M correspondiente y comunicar al Dr. Patino con honestidad.

El control de versiones del documento vive en el repo (`docs/ROADMAP.md`). Cada cierre de semana es un commit con título `roadmap: cierre semana X`.

---

## 10. Después de Iteración 1

Cuando el MVP esté en producción, las siguientes prioridades en orden son:

1. **Iteración 1.5 — Estabilización (2 semanas):** bugfixes del piloto, mejoras de prompt según feedback real, primeras estadísticas básicas.
2. **Iteración 2 — Telefonía (4–6 semanas):** integración Vapi + Cartesia, grabaciones, transcripciones. Detalle en futuro `ROADMAP-IT2.md`.
3. **Iteración 3 — SaaS comercial (4–8 semanas):** onboarding self-service, Stripe, segundo y tercer cliente.

Pero esto es para **después de validar el piloto**. Ningún paso de las próximas iteraciones se planifica en detalle hasta que la 1 esté funcionando con tráfico real ≥ 2 semanas.

---

## 11. Cambios

| Fecha | Versión | Autor | Cambio |
|---|---|---|---|
| 2026-06-10 | 0.1 | Marc + Claude | Documento inicial. Piloto Dr. Patino confirmado. |
