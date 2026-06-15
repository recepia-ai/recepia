# RECEPIA — Recepcionista Virtual Veterinaria con IA

> Documento maestro del proyecto. Punto de entrada para cualquier persona o agente IA que se incorpore al desarrollo. Versión 0.1 — junio 2026.

---

## 1. Visión

Recepia es una plataforma SaaS multi-tenant que sustituye gran parte del trabajo de recepción telefónica y de mensajería de una clínica veterinaria mediante IA conversacional, manteniendo o mejorando la calidad de atención percibida por el cliente final.

El objetivo no es construir un asistente para una sola clínica, sino una plataforma configurable que permita desplegar nuevos centros mediante configuración, sin desarrollo adicional.

**Hipótesis comercial:** una clínica veterinaria de tamaño medio dedica entre 1 y 3 personas a recepción telefónica y WhatsApp en horario de apertura. Recepia debe automatizar el 60-80% de esas interacciones para liberar al personal hacia tareas de mayor valor (atención presencial, ventas, fidelización) o reducir costes de plantilla.

---

## 2. Producto

### 2.1 Capacidades funcionales

Recepia es capaz de:

- Atender mensajes de WhatsApp Business 24/7.
- Atender llamadas telefónicas con voz natural (a partir de Iteración 2).
- Mantener conversación natural en español identificando cliente, mascota y motivo.
- Crear, modificar y cancelar citas en la agenda de la clínica.
- Detectar urgencias y aplicar reglas de transferencia configuradas.
- Transferir a humano cuando las reglas lo requieren.
- Registrar todas las conversaciones con transcripción, grabación (en llamadas) y resumen estructurado automático.
- Mantener ficha de cliente y mascota con historial unificado de todos los canales.
- Permitir intervención manual del personal en cualquier conversación en vivo.

### 2.2 Canales

| Canal | Iteración | Estado |
|---|---|---|
| WhatsApp Business | 1 | MVP |
| Panel web (recepción) | 1 | MVP |
| Telefonía SIP con IA de voz | 2 | Posterior |
| Integración software veterinario | 3+ | Diferido |

### 2.3 Lo que Recepia **no** hace

- No emite diagnósticos médicos veterinarios.
- No prescribe medicación.
- No autoriza tratamientos.
- No accede a historial clínico de la mascota (solo a su ficha administrativa) salvo integración explícita con software veterinario.
- No opera fuera de los horarios configurados por cada clínica.

Esta delimitación es importante para el cumplimiento legal y para gestionar expectativas comerciales.

---

## 3. Cliente piloto

**Hospital Veterinario Dr. Patiño** — primer cliente, en régimen de piloto gratuito durante 3 meses, a cambio de feedback semanal estructurado, acceso a conversaciones reales y derecho a uso como referencia comercial.

Tras el piloto, conversión opcional a licencia comercial.

Reglas operativas específicas del Dr. Patiño (no atender exóticos, horarios diferenciados por servicio, transferencias automáticas en hospitalización/recetas/informes/medicación, ventana de contacto Samuel/María 16:00–16:30, etc.) están definidas en detalle en `AGENT.md` como configuración de clínica, no como código.

---

## 4. Alcance del MVP (Iteración 1)

**Objetivo:** Recepia operativa por WhatsApp en el Hospital Dr. Patiño en 6 semanas desde el arranque, con panel de control para su personal.

### 4.1 Incluido

- Schema multi-tenant en Supabase con RLS por `clinic_id`.
- Onboarding manual de la primera clínica con `clinic_config` cargado a mano.
- Webhook receptor de WhatsApp Business (vía 360dialog).
- Motor de agente conversacional con tools: `crear_cita`, `modificar_cita`, `cancelar_cita`, `consultar_disponibilidad`, `transferir_a_humano`, `clasificar_categoria`, `finalizar_conversacion`.
- Integración Google Calendar (OAuth por clínica) para agenda.
- Panel web responsive con: lista de conversaciones, detalle con timeline, ficha cliente/mascota, vista de citas, intervención manual ("tomar control"), configuración de clínica.
- Generación automática de resumen estructurado al cerrar conversación.
- Autenticación Supabase Auth con roles `admin`, `recepcion`, `veterinario`.

### 4.2 Excluido del MVP

- Telefonía (Iteración 2).
- Onboarding self-service de clínicas (manual hasta Iteración 3).
- Facturación Stripe (Iteración 3).
- Integración con software veterinario (Iteración 4).
- Estadísticas y dashboards avanzados (Iteración 3).
- App móvil nativa (no planificada; el panel responsive cubre móvil).

### 4.3 Criterios de éxito del MVP

- Funcionamiento estable durante 30 días sin caídas de servicio relevantes.
- ≥ 60% de conversaciones de WhatsApp resueltas sin intervención humana.
- Cero incidentes graves de transferencia (ej. urgencia mal clasificada como rutinaria).
- Feedback positivo del personal de recepción del Dr. Patiño en al menos 2 de los 3 puntos de feedback semanal.

---

## 5. Stack técnico

Decisiones cerradas. No reabrir sin justificación de cambio importante.

### 5.1 Plataforma base

| Capa | Tecnología | Justificación |
|---|---|---|
| Base de datos | Supabase (PostgreSQL en región EU) | Stack que el equipo ya conoce, RLS nativa, Auth + Storage + Realtime integrados, residencia UE para RGPD. |
| Frontend panel | Next.js 15 App Router + TypeScript | Coherencia con resto de proyectos del equipo. |
| UI | Tailwind + shadcn/ui | Velocidad de iteración, componentes accesibles. |
| Autenticación | Supabase Auth (Magic Link + Email/Pass) | Integrado en Supabase, ya validado en PetLearn. |
| Edge runtime | Supabase Edge Functions (Deno) | Webhooks, lógica de agente, integraciones, sin VPS adicional. |
| Hosting panel | Vercel (preferido) o Coolify en VPS Hetzner | A decidir según presupuesto en deploy. |

### 5.2 Capa de IA

| Capa | Tecnología | Justificación |
|---|---|---|
| LLM agente conversacional | Claude (Sonnet) o GPT-4o, configurable por clínica | Necesidad de razonamiento robusto, llamada a tools fiable, conversación en español natural. |
| LLM tareas batch (resúmenes, clasificación, análisis) | DeepSeek API | Coste muy inferior, calidad suficiente para tareas asíncronas. |
| STT (futuro, telefonía) | Deepgram Nova-3 | Español de alta calidad, baja latencia. |
| TTS (futuro, telefonía) | Cartesia Sonic (principal) + ElevenLabs Multilingual v2 (premium opcional) | Cartesia: ~90ms latencia, voz natural. ElevenLabs: máxima calidad expresiva. |

### 5.3 Telefonía (Iteración 2)

| Capa | Tecnología | Justificación |
|---|---|---|
| Orquestación voz-IA | **Vapi.ai** | Latencia ~700-900ms, function calling robusto, webhooks ricos, abstrae complejidad SIP. |
| Trunk SIP | Twilio (España) | Mayor facilidad de provisión, números españoles disponibles. |
| Plan de migración futura | LiveKit Agents (open source) | Si volúmenes justifican operar infraestructura propia. Arquitectura preparada: cerebro en backend, Vapi solo como transporte. |

### 5.4 Mensajería

| Capa | Tecnología | Justificación |
|---|---|---|
| WhatsApp Business | 360dialog (BSP oficial de Meta) | Más económico que Twilio para España, contacto directo con Meta. Alternativa: Twilio si se prefiere consolidar proveedores. |

### 5.5 Automatización e integraciones

| Capa | Tecnología | Justificación |
|---|---|---|
| Workflows asíncronos (notificaciones, reportes, cron) | n8n self-hosted en VPS Hetzner | Visual, modificable por usuarios no técnicos en el futuro. |
| **Importante** | n8n NO se usa para el flujo conversacional en vivo | Latencia y manejo de errores requieren código propio en Edge Functions. |

### 5.6 Observabilidad

| Capa | Tecnología |
|---|---|
| Errores | Sentry |
| Producto / eventos | PostHog (self-hosted en VPS o cloud) |
| Logs conversacionales | Tabla `events` en Supabase con índices por `clinic_id` y `conversation_id` |

---

## 6. Principios arquitectónicos

Estos principios no se negocian a la ligera. Cualquier excepción debe justificarse explícitamente.

### 6.1 El cerebro vive en nuestro backend

Vapi (telefonía), WhatsApp y cualquier futuro canal son **capas de transporte**. La lógica conversacional (qué decir, cuándo transferir, qué tool invocar) vive en Edge Functions de Supabase. Esto permite:

- Reutilizar el mismo agente para WhatsApp y teléfono sin duplicar.
- Migrar de proveedor de telefonía si fuera necesario.
- Versionar y auditar las decisiones del agente.

### 6.2 Multi-tenancy desde el primer día

Todas las tablas con datos de cliente llevan `clinic_id NOT NULL`. RLS activada en todas. No se permite código que asuma "una sola clínica". El cliente piloto no es excusa para hardcodear.

### 6.3 Configuración como dato, no como código

Las reglas de cada clínica (horarios, servicios, reglas de transferencia, prompt base, voz preferida, etc.) viven en una tabla `clinic_config` (JSONB versionado), no en el código. Editables desde el panel. El agente carga la config al inicio de cada conversación.

### 6.4 Tools tipadas y testeables

Cada acción del agente (crear cita, transferir, etc.) es una función serverless tipada (TypeScript + Zod) con esquema JSON Schema expuesto al LLM. Cada tool tiene tests unitarios y se puede invocar sin pasar por el agente.

### 6.5 Idempotencia y auditoría

Todas las acciones que modifican estado externo (crear cita, enviar mensaje) son idempotentes (clave de idempotencia) y se registran en tabla `events`. Reintentos seguros, debug trazable.

### 6.6 Datos en UE, cifrado en reposo

Supabase configurado en región europea. Información sensible (teléfonos, emails, contenido de conversaciones) no se loguea fuera de la base de datos. Sentry y PostHog configurados con masking.

### 6.7 Humano siempre en el bucle

Toda conversación es interrumpible en tiempo real por el personal de recepción desde el panel. El agente nunca toma decisiones irreversibles sin confirmación humana en casos límite definidos por `clinic_config`.

---

## 7. Multi-tenancy

### 7.1 Modelo

Cada entidad cliente (clínica veterinaria) es un **tenant**. Una organización con varias sedes puede tener varios tenants o un tenant con sub-configuración (decisión diferida a fase comercial).

### 7.2 Aislamiento

- Aislamiento lógico mediante RLS de Supabase con `clinic_id`.
- No hay aislamiento físico (no separamos bases de datos por tenant en MVP).
- Backups por defecto de Supabase (Point-in-Time Recovery en plan Pro).

### 7.3 Configuración por tenant

Cada clínica tiene:

- Número de WhatsApp Business propio (canal dedicado).
- Número de teléfono propio (Iteración 2).
- Cuenta de Google Calendar conectada vía OAuth.
- `clinic_config` con: horarios, servicios, veterinarios, reglas de transferencia, prompt base, voz TTS, modelo LLM preferido.
- Usuarios propios con roles internos a la clínica.

### 7.4 Onboarding (cómo se da de alta una clínica)

| Iteración | Modo |
|---|---|
| 1 (MVP) | Manual por el equipo Recepia (asistido) |
| 2 | Manual con checklist guiado |
| 3 | Self-service con wizard de configuración |

---

## 8. Fases / Roadmap

### Iteración 1 — WhatsApp + Panel + CRM
**Duración estimada:** 6 semanas a ~25h/semana de Marc.
**Entregable:** Recepia operativa por WhatsApp en Dr. Patiño con panel de control.
**Detalle:** ver `ROADMAP.md` (a producir).

### Iteración 2 — Telefonía con IA de voz
**Duración estimada:** 4-6 semanas.
**Entregable:** mismo agente atendiendo llamadas telefónicas con Vapi + Cartesia.
**Riesgos:** latencia, calidad de voz en español, regulación de grabaciones.

### Iteración 3 — SaaS comercial
**Duración estimada:** 4-8 semanas.
**Entregable:** onboarding self-service, facturación Stripe, panel admin Recepia, estadísticas por clínica, primeros 2-3 clientes de pago.

### Iteración 4 — Integraciones software veterinario
**Duración estimada:** variable (depende de partners).
**Entregable:** conectores con al menos 1-2 softwares veterinarios populares en España (candidatos a investigar: QVet, Vetesoft, ClinicCloud, Geclisa).

### Iteración 5 — Escalado comercial
Marketing, ventas, expansión geográfica, voces en otros idiomas.

---

## 9. Modelo de negocio

### 9.1 Cliente objetivo

- Clínicas veterinarias en España con ≥ 1 persona dedicada a recepción.
- Volumen estimado: 50-300 llamadas/WhatsApp por día.
- Disposición a pago: estimada 200-500 €/mes según volumen.

### 9.2 Pricing tentativo (a validar tras MVP)

| Plan | Precio mensual orientativo | Incluye |
|---|---|---|
| Inicial | ~199 € | WhatsApp, hasta X conversaciones/mes |
| Profesional | ~399 € | WhatsApp + teléfono, hasta Y minutos/mes |
| Premium | ~699 € | Volumen alto, voz premium ElevenLabs, soporte prioritario |

Estos números son **orientativos** y deben validarse con coste real de infraestructura por clínica tras el piloto.

### 9.3 Estructura de costes por clínica (estimación inicial)

- Vapi: ~$0.05/min plataforma
- LLM voz (Realtime o pipeline): ~$0.04-0.10/min
- TTS Cartesia: ~$0.02-0.04/min
- STT Deepgram: ~$0.01/min
- WhatsApp 360dialog: cuota fija mensual + coste por conversación
- Infraestructura compartida: marginal

**Coste agregado por clínica con uso medio:** ~$300-600/mes. Margen objetivo: 40-60%.

### 9.4 Modelo de piloto

- Gratuito durante 3 meses.
- A cambio de: feedback semanal, acceso a conversaciones reales (anonimizadas), derecho a referencia comercial.
- Tras piloto: decisión libre del cliente. Si no continúa, datos exportables.

---

## 10. Cumplimiento legal

Recepia trata datos personales (clientes propietarios) y datos de salud animal. Aunque los datos de salud animal no son "datos de salud" en sentido estricto del RGPD (que aplica a personas), la información del propietario sí lo es.

### 10.1 RGPD

- Residencia de datos en UE (Supabase región EU).
- Encargado de tratamiento documentado con cada clínica cliente (Recepia es encargada, la clínica responsable).
- Política de privacidad propia + adendas para cada clínica.
- Derechos ARSULIPO operativos desde día 1: exportación, eliminación, rectificación.
- Cifrado en reposo (Supabase) y en tránsito (TLS).
- DPIA ligera antes de comercializar.

### 10.2 Grabación de llamadas (Iteración 2)

- Consentimiento informado del cliente al inicio de la llamada (mensaje hablado por el agente).
- Almacenamiento de grabaciones con plazo máximo configurable por clínica (90 días por defecto).
- Acceso restringido por roles.
- Posibilidad de borrado a petición del cliente final.

### 10.3 EU AI Act

El agente toma decisiones de **triaje** (clasificar urgencia, decidir transferencia). Esto **no** clasifica como sistema de alto riesgo en el Anexo III del AI Act (no es triaje médico de humanos), pero requiere:

- Transparencia: el cliente sabe que habla con una IA.
- Supervisión humana: las urgencias críticas siempre transfieren a humano.
- Documentación del sistema y de su entrenamiento.

### 10.4 LSSI-CE

Aviso legal, política de cookies del panel, identificación del prestador.

### 10.5 Antes de producción comercial

Revisión por abogado especialista en RGPD/AI Act. Coste estimado: 800-2.000 €. Diferible hasta cierre del piloto, pero **no** hasta primera venta comercial.

---

## 11. Estructura del repositorio

Monorepo. Estructura propuesta (ajustable):

```
recepia/
├── apps/
│   ├── panel/              # Next.js 15 — panel web
│   └── (futuro) marketing/ # Landing pública
├── packages/
│   ├── core/               # Lógica del agente, tools, tipos compartidos
│   ├── db/                 # Schema Supabase, migrations, tipos generados
│   └── ui/                 # Componentes shadcn compartidos
├── supabase/
│   ├── migrations/         # SQL versionado
│   └── functions/          # Edge Functions (Deno)
├── docs/
│   ├── PROJECT.md          # Este documento
│   ├── SCHEMA.md           # Modelo de datos
│   ├── AGENT.md            # Diseño del agente
│   ├── ROADMAP.md          # Detalle iteración 1
│   └── SECURITY.md         # Posición de seguridad
└── README.md
```

Organización GitHub: `recepia-ai` (a crear). Repositorio inicial: `recepia-ai/recepia` (monorepo).

---

## 12. Decisiones pendientes

Listado vivo. Se cierra cada decisión con fecha y razonamiento al resolverla.

1. **Confirmación del piloto Dr. Patiño** — pendiente reunión esta semana.
2. **Dominio y nombre comercial** — verificar disponibilidad `recepia.com`, `.es`, `.ai` + marca OEPM.
3. **Hosting del panel** — Vercel vs Coolify en Hetzner. Decidir en semana 1.
4. **BSP de WhatsApp** — 360dialog vs Twilio. Decidir en semana 2 según pricing actual y cobertura España.
5. **LLM principal del agente** — Claude Sonnet vs GPT-4o. Probar ambos con prompts de Dr. Patiño en semana 3.
6. **Estructura monorepo** — Turborepo, pnpm workspaces simple, o Nx. Decidir en semana 1.
7. **Estrategia de testing del agente** — datasets de conversaciones reales del Dr. Patiño + evals automatizadas. Definir en semana 4.

---

## 13. Riesgos identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Dr. Patiño no firma piloto | Media | Alto | Cerrar esta semana; tener 1-2 leads adicionales como backup. |
| Latencia/calidad voz IA insuficiente para producción | Media | Alto | Vapi + Cartesia probado; fallback a ElevenLabs; iteración 2 con beta cerrado. |
| WhatsApp Business rechaza el caso de uso | Baja | Alto | Plantilla y caso de uso validados con 360dialog antes de implementar. |
| Coste por conversación más alto que pricing | Media | Medio | Modelado financiero antes de cerrar pricing comercial. |
| Bug crítico de transferencia (urgencia mal clasificada) | Baja | Muy alto | Reglas duras de transferencia (no decisión del LLM en casos críticos), supervisión humana del piloto. |
| Marc no termina por exceso de proyectos (Cércana) | Media | Alto | Iteración 1 acotada a 6 semanas; ROADMAP.md con checkpoints semanales. |
| Filtración de credenciales | Baja | Alto | Doppler/Infisical para secretos; nunca commits de `.env`. |

---

## 14. Glosario

- **Agente**: el componente IA conversacional de Recepia.
- **Tenant / clínica**: cada cliente de Recepia (una clínica veterinaria).
- **Tool / function**: una acción que el agente puede invocar (crear cita, transferir, etc.).
- **Conversación**: un hilo de mensajes/audio entre un cliente final y Recepia, sin importar canal.
- **Transferencia**: derivación de la conversación a una persona humana de la clínica.
- **BSP**: Business Solution Provider de WhatsApp (intermediario oficial autorizado por Meta).
- **STT**: Speech-to-Text (transcripción).
- **TTS**: Text-to-Speech (síntesis de voz).
- **RLS**: Row-Level Security de PostgreSQL.

---

## 15. Cambios

| Fecha | Versión | Autor | Cambio |
|---|---|---|---|
| 2026-06-10 | 0.1 | Marc + Claude | Documento inicial. |
