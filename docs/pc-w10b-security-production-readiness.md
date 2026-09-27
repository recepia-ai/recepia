# PC-W10B — Security & Production Release Readiness

Fecha de corte: 2026-09-27. Esta revisión no despliega ni migra Production y no copia datos entre entornos.

## 1. Diagnóstico ejecutivo

El código validado tiene una procedencia reproducible: `codex/product-construction-w1` contiene `main` y todo el trabajo comprometido de las ramas históricas auditadas. El preflight no destructivo de Preview pasa, y el único P0 de aplicación hallado —un IDOR en las acciones del chat de prueba— queda corregido en este paquete.

El aviso de GitHub durante el primer push descubrió además dos advisories críticos sobre Next.js 15.5.23. El RC fija Next.js 15.5.24 y actualiza los overrides transitivos con parche disponible. `pnpm audit --prod --audit-level high` termina sin vulnerabilidades conocidas.

El release a Production permanece bloqueado por dos P0 operativos que requieren actuación explícita fuera del código:

1. Production aún no tiene aplicada `20260926190000_redact_vapi_artifact_references.sql`; pueden quedar referencias históricas de artifacts Vapi hasta ejecutar esa redacción.
2. varios secretos de webhook/OAuth abarcan simultáneamente Preview y Production, y los valores Supabase generales de Preview todavía dependen de overrides de la rama estable. Antes del release deben quedar credenciales y scopes inequívocamente separados.

Por ello PC-W10B produce un release candidate verificable, pero no autoriza Production ni un piloto real.

## 2. Reconciliación Git

### Refs auditadas

| Ref | SHA al iniciar | Relación con rama validada | Clasificación |
|---|---:|---|---|
| `main` / `origin/main` | `667deae` | ancestro; faltan 40 commits | baseline antigua |
| `codex/product-construction-w1` | `0644959` | rama validada y sincronizada al iniciar | canónica para el RC |
| `feat/telephony-twilio` | `99110f2` local; `bd8f9d6` remoto | ancestro; 0 commits exclusivos | incorporada |
| `codex/canonical-baseline-reconciliation` | `bd8f9d6` | ancestro; 0 commits exclusivos | incorporada, worktree aún activo |

`main...codex/product-construction-w1 = 0/40`, `feat/telephony-twilio...codex/product-construction-w1 = 0/31` y `canonical-baseline-reconciliation...codex/product-construction-w1 = 0/32`. No hay conflicto de historial: la rama validada es una extensión lineal de `main`.

### Commits exactos ausentes de `main` al iniciar

```text
72fb360 d455654 d196046 fdd5e1e ddea615 3d44c4f 611098c bd8f9d6
99110f2 6724452 eaab6ea d4f7ed2 d14c9ac 3be56ff 839705f ba8e210
0ef3dc6 cb288d3 654b7f0 4e04c4a 20bce49 8c01f90 736dc0a 9bab3d3
5346848 86065c4 d86b1a5 35f8e20 52fcd88 291d8db a090b27 91ebb51
6fb0abe 88bb57a cc72388 7d1a541 6485db7 e4ec754 53b0dc1 0644959
```

El worktree principal contiene documentación y evidencia no rastreada ajena a este RC. El worktree de reconciliación contiene `docs/evidence/` no rastreado y tres migraciones no rastreadas; sus SHA-256 coinciden exactamente con las versiones ya rastreadas en la rama validada. No se elimina ni modifica nada de esos worktrees.

Estrategia segura: congelar el RC desde la rama limpia validada; preservar por separado la evidencia no rastreada; y, solo después de aprobar el release, actualizar `main` mediante fast-forward o PR desde este SHA. No se mezcla el worktree sucio de `main` en el RC.

## 3. Esquema Preview frente a Production

Se compararon dumps estructurales remotos de `public`, `storage` y `vault`, además del ledger de migraciones.

| Diferencia | Clasificación | Acción |
|---|---|---|
| comentario y redacción histórica de artifacts Vapi de `20260926190000` solo en Preview | migración pendiente, seguridad/privacidad | aplicar a Production solo con autorización y después de desplegar el código que ya no persiste URLs |
| función de plataforma `public.rls_auto_enable()` solo en Preview | drift de plataforma Supabase, no proviene del repositorio | no copiar manualmente; confirmar configuración de plataforma al normalizar entornos |
| tablas, columnas, tipos, enums, índices, constraints, RLS, policies, triggers y vistas | iguales | ninguna |
| estructura Storage y Vault | igual | ninguna; no se inspeccionaron ni copiaron secretos/contenido |

Las 28 tablas `public` tienen RLS activo. `telephony_numbers` y `web_chat_rate_limits` no tienen policy para clientes y por ello solo son accesibles por roles privilegiados. Los wrappers Vault están concedidos únicamente a `service_role`. La función de rate limit y el claim del outbox también están limitados a `service_role`.

## 4. Matriz de migraciones

| Migración | Preview | Production | Reversible | Riesgo / dependencia |
|---|---:|---:|---|---|
| `20260616193323_initial_schema` | sí | sí | no trivial | baseline total |
| `20260623120000_settings_and_team` | sí | sí | parcial | Auth/equipo |
| `20260623200000_rls_policies_team_management` | sí | sí | sí, con cautela | RLS; alta seguridad |
| `20260626174227_google_calendar_integration` | sí | sí | parcial | Google/Vault |
| `20260628120000_real_seed_dr_patino` | sí | sí | datos no reversibles sin backup | seed histórico |
| `20260629000000_vault_wrappers` | sí | sí | sí | service role/Vault |
| `20260629100000_fix_vault_create_secret` | sí | sí | sí | firma RPC |
| `20260629200000_appointments_schema` | sí | sí | no trivial | citas/clientes/mascotas |
| `20260709070218_service_vet_assignments` | sí | sí | parcial | disponibilidad |
| `20260709070300_seed_service_vet_assignments_dr_patino` | sí | sí | datos | seed histórico |
| `20260715000000_tool_invocations_conversation_nullable` | sí | sí | sí | tools |
| `20260820120000_conversation_foundation` | sí | sí | no trivial | omnicanal |
| `20260820170000_channel_events` | sí | sí | no trivial | idempotencia |
| `20260820183000_whatsapp_channel_secrets` | sí | sí | parcial | WhatsApp/Vault |
| `20260820200000_web_chat_rate_limits` | sí | sí | sí | rate limiting |
| `20260823160000_gestorvet_coexistence` | sí | sí | parcial | outbox/RPC |
| `20260827120000_conversation_identity_consistency` | sí | sí | parcial | identidad/FK |
| `20260828120000_client_identity_and_pet_search` | sí | sí | parcial | índices/búsqueda |
| `20260828130000_pet_clinical_records` | sí | sí | no trivial | historia clínica/RLS |
| `20260829120000_telephony` | sí | sí | no trivial | Vapi/Twilio |
| `20260926090000_appointment_active_identity_unique` | sí | sí | sí (drop index) | código compatible con `23505` debe precederla |
| `20260926190000_redact_vapi_artifact_references` | sí | **no** | **no para URLs borradas** | PC-W9D; requiere backup controlado y autorización |

No existen migraciones de onboarding PC-W10A: reutiliza `clinic_config`, `clinic_users` y tablas ya versionadas.

## 5. Variables y secretos Vercel

No se imprimieron valores. Estado observado en `recepia-panel`:

| Grupo | Scope actual | Scope objetivo / decisión |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | entradas históricas compartidas Preview+Production y overrides Preview solo para `codex/product-construction-w1` | Production-only para credenciales Production; Preview-only para credenciales Preview, sin depender de una rama |
| `NEXT_PUBLIC_APP_URL` | entradas separadas Preview y Production | correcto; comprobar hostname antes del release |
| `GOOGLE_CLIENT_ID` | Production general y override de rama Preview | separar por entorno o documentar formalmente el cliente compartido |
| `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | compartidas Preview+Production | separar; cada redirect debe corresponder al entorno |
| `EVOLUTION_WEBHOOK_SECRET` | entradas separadas Preview y Production | correcto |
| `VAPI_WEBHOOK_SECRET`, `WHATSAPP_WEBHOOK_SECRET`, `OAUTH_STATE_SECRET` | compartidas Preview+Production | **separar antes del release** y rotar coordinadamente en proveedores |
| Meta app/verify/app secret | compartidas | P1: aceptable solo si el mismo Meta app es una decisión explícita y sus callbacks están acotados |
| `ANTHROPIC_API_KEY` | compartida | P1 coste/cuotas; separar recomendado, no expone tenant por sí sola |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_URL` | legacy compartidas; no consumidas por runtime | retirar después de confirmar CI/operación externa |
| `CRON_SECRET` | ausente | añadir si se activa el worker GestorVet; hoy el endpoint falla cerrado con 503 |
| `GESTORVET_API_KEY`, `GESTORVET_NOC` | ausentes | solo necesarias al activar esa integración |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `VAPI_PRIVATE_KEY`, `VAPI_ASSISTANT_ID` | ausentes de runtime | correcto si siguen limitadas a provisioning/manual tooling |
| `WEB_CHAT_ALLOWED_ORIGINS` | ausente | opcional; se admiten same-origin y orígenes de `clinic_config` |

## 6. Revisión de seguridad

### P0

- **Cerrado en código:** IDOR en `/settings/test-agent/chat`. Un admin podía suministrar un UUID de conversación de otra clínica y las acciones con `service_role` no validaban `clinic_id`. Las rutas de envío y lectura ahora rechazan todo objeto no perteneciente al tenant antes de leer mensajes o ejecutar el Agent.
- **Cerrado en dependencias:** Next.js 15.5.23 estaba afectado por dos advisories críticos (uno Windows-only y otro en Image Optimization/AVIF). El RC usa 15.5.24; `sharp` y los overrides transitivos se elevan a sus versiones parcheadas. El audit de dependencias de Production queda limpio en niveles high/critical.
- **Abierto, configuración:** separación de secretos/scopes indicada en §5.
- **Abierto, Production data hygiene:** migración PC-W9D pendiente indicada en §4.

### Controles verificados

- RLS activo en 28/28 tablas públicas y prueba conectada de no visibilidad cross-tenant.
- `service_role` permanece en módulos server-only; no hay variable pública equivalente.
- selección de clínica falla si el usuario tiene cero o varias membresías; las operaciones mutables principales acotan por `clinic_id`.
- webhooks Evolution/360dialog/Vapi usan secreto con comparación constante; Meta valida HMAC.
- eventos Vapi/WhatsApp y citas tienen idempotencia; la identidad activa de cita está protegida en DB.
- chat web valida origen, tamaño, UUID y rate limit por sesión+clínica.
- rutas administrativas verifican sesión y rol; `test-agent` legacy no se expone en deployments.
- wrappers Vault solo ejecutables por `service_role`.
- el payload Vapi se redacta y recording queda OFF por defecto.

### P1

- La comprobación de origen del chat web no sustituye protección anti-bot; el rate limit vive en DB y no hay WAF dedicado.
- El acceso GET a mensajes del chat web usa `sessionId` UUID + teléfono como capability; debe tratarse como identificador sensible y rotarse al terminar la sesión.
- Logs de errores de Google pueden incluir texto del proveedor; sanitizar/estructurar antes de aumentar tráfico.
- Alertas críticas son visibles/persistentes pero no tienen transporte externo.
- Apps de proveedor compartidas entre entornos aumentan el radio de impacto aunque se separen secretos.

### P2

- Normalizar `rls_auto_enable` entre proyectos desde configuración de Supabase.
- Separar claves Anthropic por costes/cuotas.
- Añadir WAF/bot management y auditoría centralizada cuando aumente tráfico.
- Eliminar variables legacy tras verificar tooling externo.

## 7. Preflight automatizado

Script: `apps/panel/scripts/release-preflight.ts` (`pnpm --filter @recepia/panel release:preflight -- ...`). Es no destructivo respecto a producto: no crea citas, mensajes, conversaciones ni eventos. Genera una sesión Auth temporal para probar RLS.

Comprueba Supabase esperado, clínica activa, timezone, configuración, kill switches, recording OFF, servicios, horarios, calendarios, Google, canales, rol admin, login, aislamiento RLS y ausencia de fuga en conversaciones/citas/integraciones. Con `--base-url`, añade login público, redirección del panel, rechazo de payload web inválido, autenticación de webhooks y cierre del API de test.

Resultado Preview conectado: PASS; 37 servicios activos, 35 franjas, 5 calendarios, Google configurado, WhatsApp y teléfono activos, tenant isolation PASS, recording `SAFE_DEFAULT OFF`. Sondas HTTP: `/login` 200, `/settings` 307, web inválido 400, Evolution/360dialog/Meta/Vapi sin credencial 401. El API legacy queda protegido por middleware y, dentro de deployment, devuelve 404.

## 8. Release candidate y plan de Production

Referencia prevista: tag anotado `pc-w10b-rc.1` sobre el commit final de este documento y del preflight. La Preview estable debe resolver exactamente ese SHA antes de considerarlo congelado.

Orden seguro:

1. **Freeze:** proteger el SHA/tag, detener cambios y registrar hashes de migraciones.
2. **Backup:** export lógico cifrado de esquema y datos afectados; inventario de índices, migration ledger y conteos. Restringir el backup que pueda contener URLs históricas.
3. **Migration preflight:** `migration list`, diff de esquema, salud, espacio y consulta de filas afectadas por PC-W9D; abortar ante drift.
4. **Variables:** separar Preview/Production, rotar secretos coordinadamente y probar firmas contra Preview; nunca copiar Vault.
5. **Código:** desplegar el RC a Production con recording OFF y redacción de nuevos payloads ya activa. No promover Preview por alias accidental: desplegar el SHA congelado en `recepia-panel` Production.
6. **Migración:** con autorización explícita, aplicar únicamente `20260926190000_redact_vapi_artifact_references.sql` a Production. Código primero evita que el runtime antiguo reintroduzca URLs tras la limpieza.
7. **Smoke:** login, tenant/roles, panel, clínica, Google read-only, webhooks con sondas sin mutación, recording OFF y lectura de Agenda; no crear cita real.
8. **Activación progresiva:** mantener canales IA en OFF; habilitar por clínica y canal tras checklist humano.
9. **Rollback:** promover el deployment Production anterior y poner kill switches OFF. La migración PC-W9D no se revierte restaurando URLs al runtime; el backup es solo evidencia/recuperación restringida. El comentario puede revertirse, pero la minimización debe conservarse. Si falla una migración transaccional, rollback DB automático; si ya confirmó, restaurar únicamente con un plan de incidente autorizado.

## 9. Decisión PC-W10B

**NO-GO temporal para Production/piloto** hasta cerrar los dos P0 operativos. El código y preflight quedan listos como RC; no se inicia PC-W10C.
