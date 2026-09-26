# PC-W10 — Pilot Launch Readiness

Estado: **PC-W10A implementado y validado en Preview** el 27 de septiembre de 2026.

## PC-W10A — procedimiento interno de alta

La fuente declarativa es un manifiesto JSON validado. El comando es dry-run por
defecto y solo escribe con `--apply`:

```bash
pnpm dlx tsx apps/panel/scripts/provision-pilot-clinic.ts \
  --manifest docs/examples/pilot-clinic.example.json
```

El operador revisa el plan determinista y repite con `--apply` únicamente tras
cargar `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del entorno
destino. El manifiesto nunca contiene secretos. El alta hace upsert por slug,
usuario, servicio, franja y asignación; repetirla no crea duplicados. Crea la
clínica, admin, veterinarios, servicios, horarios y asignaciones con Web,
WhatsApp, Voz y recording en OFF.

Después del alta, el admin completa desde el panel: identidad/idioma/timezone y
mensajes en **Ajustes → Clínica**; Google, WhatsApp, Vapi y transferencia en
**Ajustes → Integraciones**; activación independiente en **Ajustes →
Operaciones**; y verificación en **Ajustes → Preparación piloto**. Los secretos
permanecen en Vault/env/configuración segura.

La prueba conectada creó en Supabase Preview `veterinaria-norte-pcw10a` con un
admin sintético, un veterinario, un servicio propio, dos franjas y una
asignación. Dos ejecuciones devolvieron el mismo `clinic_id` y los mismos
conteos. Una sesión sintética del admin verificó por RLS que solo veía su
clínica; no vio conversaciones, citas ni integraciones de otro tenant. Su
prompt contiene únicamente identidad/servicio propios, y los tres canales y la
grabación permanecen OFF.

## 1. Evidencia y baseline

- Preview estable `recepia-panel`, deployment `dpl_HpW12LaRmba4Kb8mMK6TkRt6YB38`,
  está `Ready` en el commit `e4ec754` de `codex/product-construction-w1`.
- Preview usa Supabase `recepia-preview` (`mnaaqqczygictolvplrp`) y sus
  overrides de rama para URL, anon key y service role.
- Production canónica `app.recepia.iatope.com` está `Ready`, pero su deployment
  manual más reciente no expone SHA Git en Vercel. `main` sigue en `667deae` y
  está 38 commits/237 ficheros por detrás de la rama validada.
- Production usa `recepia-rodaction` (`vsnrlpfsgwwdmiyndwnl`). La protección de
  concurrencia de citas está aplicada; la redacción histórica de artifacts Vapi
  de PC-W9D no está aplicada y el código de audio OFF no se ha desplegado allí.
- Las sondas HTTP devolvieron `200` para Production `/login`. Preview está detrás
  de Vercel Authentication y tanto `/login` como el chat público redirigen a SSO
  sin bypass.

## 2. Estado del producto

| Área | Clasificación | Evidencia / límite |
|---|---|---|
| Login por magic link | Lista para piloto | Redirect por entorno y callback PKCE implementados; ya validado en Preview. |
| Alta de clínica/admin | Bloqueante | No existe alta self-service ni flujo interno único; hoy requiere bootstrap técnico de Auth, clínica, membresía y config. |
| Equipo e invitaciones | Lista para piloto | Admin invita, reenvía, revoca y cambia roles; enlace automático de invitación pendiente. |
| Clientes y mascotas | Lista para piloto | CRUD, búsqueda, aislamiento por clínica y ficha clínica de mascota. |
| Servicios/precios/duraciones | Lista para piloto | CRUD, activación, reglas clínicas y asignación a veterinarios. |
| Veterinarios | Usable con limitaciones | Se derivan de miembros con rol veterinario; no hay estado activo independiente. |
| Horarios | Lista para piloto español peninsular | Intervalos por veterinario; varias rutas auxiliares aún fijan `Europe/Madrid`. |
| Agenda y citas | Lista para piloto | Alta, cambio, cancelación, Google, confirmación e idempotencia/concurrencia probadas. |
| Google Calendar | Usable con configuración | OAuth y calendarios por veterinario son self-service; credenciales OAuth y redirects son operación de Recepia. |
| Conversaciones/takeover | Lista para piloto | Inbox multicanal, transcript, tools, control humano y retorno a IA. |
| Chat web | Bloqueante para otra clínica | Transporte, rate limit y persistencia funcionan, pero el prompt contiene identidad, catálogo, horarios y urgencias del Dr. Patiño. |
| WhatsApp | Usable con limitaciones | Evolution E2E validado; alta de instancia/webhook/secreto sigue siendo técnica y Evolution es temporal. Comparte el prompt web hardcodeado. |
| Voz/Vapi | Usable con limitaciones | E2E de reserva validado, assistant-request dinámico y audio OFF; saludo aún anuncia posible grabación y algunas reglas nombran a Samuel/Anicura. |
| Kill switches | Lista para piloto | Web, WhatsApp y voz independientes, auditados y con persistencia inbound. |
| Operaciones/alertas | Usable con limitaciones | Estados y alertas persistentes visibles; sin email/SMS/push externo. |

## 3. Onboarding actual

La clínica puede, una vez provisionada: editar sus datos, invitar equipo,
configurar servicios/precios/duraciones, asignar veterinarios, cargar horarios,
conectar Google, asignar calendarios, guardar canales y operar kill switches.

Recepia debe intervenir hoy para:

1. Crear la clínica, `clinic_config`, admin Auth y membresía inicial.
2. Verificar slug, redirects Auth y URL del chat/allowed origins.
3. Configurar credenciales OAuth globales y comprobar Vault.
4. Aprovisionar Evolution o Meta, secreto/header y webhook.
5. Aprovisionar número Twilio/Vapi, assistant, Server URL y secreto; mantener el
   número sin assistant estático.
6. Validar los datos operativos y ejecutar el acceptance test conectado.

El onboarding de un piloto debe ser un flujo interno reproducible y reentrante,
no necesariamente SaaS self-service. Debe crear la identidad mínima con canales
IA OFF, mostrar una checklist de readiness y permitir que el admin complete el
resto desde el panel sin editar código.

## 4. Configuración del agente

| Dato/regla | Fuente actual | Gap |
|---|---|---|
| Nombre, dirección, urgencias | `clinics` en voz; constantes `clinic-data.ts` en web/WhatsApp | Eliminar constantes del prompt multicanal. |
| Idioma | `clinics.locale` parcial; prompts en código | Falta política por clínica y fallback consistente. |
| Saludo | Código (`VOICE_FIRST_MESSAGE` y prompt web) | Debe derivarse de config; el aviso de grabación contradice audio OFF. |
| Servicios/precios/duraciones | DB/tools y catálogo dinámico en voz; catálogo hardcodeado adicional en prompt web | DB debe ser la única autoridad en todos los canales. |
| Horarios | DB para disponibilidad; texto fijo en prompt web | Eliminar texto fijo; responder desde datos/tools. |
| Escalado | Reglas en código/prompt; número en `clinic_channels.provider_config` | Casos y destino necesitan defaults seguros y overrides de clínica. |
| Reserva/confirmación | Código + tests golden | Conservar centralizado; no hacerlo editable libremente. |
| Recording | Código: `artifactPlan.recordingEnabled=false` | Correcto para piloto; futura config por clínica no implementada. |
| Fuera de horario | Texto hardcodeado | Crear config estructurada de urgencias/fallback y usar timezone real. |
| Secretos | Vercel env + Vault por integración/canal | Correcto si se verifican scopes/fingerprints por entorno. |

## 5. Datos y seguridad

Production piloto debe contener solo: clínica real, admin y equipo autorizados,
servicios, vets, asignaciones, horarios, calendarios e integraciones explícitas.
El bootstrap demo y `TEST RECEPIA`/`Mascota Demo` no deben ejecutarse ni aparecer
en Production. Los datos reales se introducen durante onboarding y no se copian
desde Preview.

Controles técnicos ya presentes: RLS por `clinic_id`, contexto de una única
membresía, guardas de ownership, service role solo server-side, Vault wrappers
solo para `service_role`, webhooks con secreto, rate limit/origin control para
chat, logs estructurados sin cuerpos/teléfonos/tool inputs y audio OFF.

Bloqueantes técnicos de seguridad para piloto:

- demostrar con una matriz automatizada que cada rol/tenant no puede leer ni
  mutar recursos ajenos en las rutas críticas;
- inventariar endpoints públicos y verificar autenticación, límites y payload
  máximo en el entorno candidato;
- verificar que Preview y Production no reutilizan secretos de webhook ni
  credenciales Supabase, aunque tengan los mismos nombres;
- aplicar la redacción PC-W9D en Production antes de tráfico nuevo y confirmar
  que no quedan URLs de artifacts;
- retirar el texto de grabación mientras `recordingEnabled=false`.

## 6. Prioridades

### P0 — bloquea piloto

1. Convertir prompt/identidad/horarios/urgencias hardcodeados en contexto por
   clínica y hacer DB/config la única autoridad operativa.
2. Corregir el saludo de voz para audio OFF y añadir test que impida volver a
   anunciar grabación cuando esté desactivada.
3. Crear un onboarding interno reproducible con checklist y canales OFF por
   defecto; no requiere alta SaaS pública.
4. Construir un release candidate trazable desde Git: integrar la rama validada,
   etiquetar SHA y eliminar deployments manuales sin procedencia verificable.
5. Reconciliar migraciones/esquema Preview–Production y aplicar solo las
   pendientes tras backup; incluir la redacción de artifacts Vapi.
6. Ejecutar security preflight de tenants/roles/endpoints y un acceptance test
   E2E con los datos reales del piloto.

### P1 — importante, compatible con piloto controlado

- Readiness visible para configuración incompleta (vet sin horario/calendario,
  canal sin webhook, Google expirado).
- Runbook con responsables y revisión periódica de alertas internas.
- Métricas mínimas por canal y resolución automática.
- UI para allowed origins web y política de fuera de horario.
- Estado activo independiente del veterinario.
- Decisión del transporte WhatsApp definitivo; Evolution puede usarse solo con
  consentimiento y operación controlada.
- Generalizar timezone/formateo fuera de `Europe/Madrid` antes de Canarias u
  otros países.

### P2 — posterior

- Alta self-service, billing y onboarding SaaS completo.
- Alertas externas avanzadas, analytics, audio/reproductor/lifecycle y soporte
  multirregión/multidioma completo.

## 7. Release plan Production

1. **Freeze:** fijar SHA de release candidate, cerrar P0 y repetir suite/golden +
   smokes conectados en Preview.
2. **Preflight:** export lógico de Production, esquema/índices/migration ledger,
   conteos e integridad; inventario de variables por scope y configuración de
   Google/Vapi/WhatsApp sin mostrar secretos.
3. **Reconciliación:** comparar migraciones remotas. Aplicar primero cambios DB
   aditivos/compatibles y abortar ante drift o colisiones. No copiar dataset
   Preview.
4. **Configuración:** crear/validar clínica real, admin, servicios, vets,
   horarios y canales inicialmente OFF. Configurar Auth/OAuth/webhooks y Vault.
5. **Deploy:** desplegar exactamente el SHA etiquetado a `recepia-panel`
   Production; comprobar alias y variables antes de activar canales.
6. **Smoke:** login, tenant/roles, CRUD básico, freeBusy, chat web, WhatsApp,
   assistant-request y tools sin crear cita. Si se autoriza, una única cita
   sintética controlada con limpieza coordinada de Google.
7. **Activación:** habilitar canales uno a uno, con operador observando
   Operaciones/conversaciones y ventana inicial supervisada.
8. **Rollback:** pausar kill switches, desconectar webhooks si procede y promover
   el deployment anterior. Las migraciones aditivas permanecen; el índice de
   citas tiene rollback documentado. Restaurar datos solo desde backup tras
   identificar daño, nunca por reflejo.

## 8. Runbook mínimo

- Activar clínica: completar checklist, probar Google y activar primero Web,
  después WhatsApp y finalmente Voz.
- Pausar canal: Ajustes → Operaciones → Pausar IA; inbound/evidencia se conserva.
- Google caído: pausar automatización de reservas, revisar OAuth/Vault/calendar,
  no confirmar citas y pasar a gestión humana.
- WhatsApp caído: revisar `accepted/failed`, no reenviar timeouts inciertos a
  ciegas y atender desde inbox.
- Vapi caído: verificar número dinámico, Server URL/secreto y alertas; desviar
  operativamente las llamadas si el bootstrap no responde.
- Takeover: abrir conversación, tomar control, responder y devolver a IA solo al
  resolver el incidente.
- Rollback: kill switches primero; deployment anterior después; migración/datos
  solo conforme al plan aprobado.

## 9. Métricas mínimas

Por día y clínica: conversaciones por canal, llamadas atendidas, citas creadas,
modificadas y canceladas, escalados/takeovers, tool failures por código, latencia
de webhook/tool, errores por canal y porcentaje de conversaciones resueltas sin
takeover. Deben derivarse de tablas/logs existentes con una consulta o vista
ligera; no se propone una plataforma analytics.

## 10. Checklist Pilot GO

- [ ] Todos los P0 cerrados y documentados.
- [ ] SHA de release trazable, suite completa y Preview acceptance test verdes.
- [ ] Backup y schema/migration diff de Production revisados.
- [ ] Clínica real sin datos TEST; admin/equipo/roles verificados.
- [ ] Servicios, vets, asignaciones, horarios y calendarios completos.
- [ ] Auth, Google, Web, WhatsApp y Vapi smokes verdes.
- [ ] Grabación OFF y saludo coherente; URLs Vapi ausentes.
- [ ] Kill switches y takeover ensayados por el operador.
- [ ] Alertas revisables y responsables/runbook asignados.
- [ ] Rollback ensayado o verificado sin afectar datos válidos.
- [ ] Aprobación explícita del owner para activar cada canal.

## 11. Bloques propuestos

1. **PC-W10A — Clinic Configuration & Onboarding:** eliminar hardcodes, definir
   config estructurada, onboarding interno y readiness checklist.
2. **PC-W10B — Security & Production Release Readiness:** matriz tenant/roles,
   endpoints, drift/migraciones, variables/secrets y release candidate trazable.
3. **PC-W10C — Pilot Operations & Metrics:** runbook ejecutable, responsables,
   consultas de métricas y señales de readiness sin analytics pesado.
4. **PC-W10D — Pilot Acceptance & Controlled Launch:** ensayo Preview, release
   Production autorizado, smoke real y activación progresiva con rollback.

**Orden recomendado:** PC-W10A primero. Sin configuración por clínica, cualquier
release o aceptación de una segunda clínica validaría accidentalmente reglas del
Dr. Patiño, no un producto multi-tenant.
