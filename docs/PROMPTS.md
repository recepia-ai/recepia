# RECEPIA — PROMPTS.md

> Catálogo de prompts para ejecutar el ROADMAP con Claude Code (compatible con DeepSeek, Claude Sonnet y otros agentes de codificación). Versión 0.1 — junio 2026.
>
> Los prompts están organizados por semana del ROADMAP y diseñados para producir resultados predecibles y revisables. No son rígidos: úsalos como punto de partida, ajusta según la realidad.

---

## 1. Cómo usar este documento

### 1.1 Anatomía de un prompt

Cada prompt tiene esta estructura:

- **ID** (ej. `P-S1-03`): identificador estable para referenciarlo.
- **Objetivo**: qué tiene que producir.
- **Prerrequisitos**: qué debe estar hecho antes (otros prompts ejecutados, archivos creados, cuentas activas).
- **Contexto a leer**: archivos del repo que Claude Code debe leer antes de tocar nada.
- **Prompt**: el texto literal a pegar en Claude Code.
- **Criterio de hecho**: cómo verificar que está terminado.
- **Gotchas**: errores comunes y cómo evitarlos.

### 1.2 Cómo se ejecuta un prompt

1. Asegúrate de estar en una **rama nueva**: `git checkout -b feat/[id-prompt]-[slug-corto]`.
2. Asegúrate de que Doppler está apuntando a `dev`: `doppler setup` si dudas.
3. Pega el prompt en Claude Code.
4. Cuando termine, revisa los cambios (`git diff`).
5. Ejecuta los checks del criterio de hecho.
6. Si pasa, commit con mensaje convencional y push.
7. Pull request a `main` (revisión propia es suficiente en piloto).

### 1.3 Cuándo NO usar un prompt

- Cuando la tarea es **demasiado pequeña** (< 5 min): hazlo a mano, evitas overhead de revisar diff.
- Cuando la tarea es **demasiado grande o ambigua**: divídela en sub-prompts antes.
- Cuando es **algo nuevo y crítico** que no has hecho antes: pruébalo manualmente primero, luego automatiza si tiene sentido.

---

## 2. CLAUDE.md para el repositorio

Antes de empezar, **crea un archivo `CLAUDE.md` en la raíz del repo** con el siguiente contenido. Claude Code lo lee automáticamente al inicio de cada sesión y le da contexto permanente.

````markdown
# Instrucciones para Claude Code en este repositorio

## Sobre este proyecto

Recepia es una plataforma SaaS multi-tenant de recepción virtual veterinaria con IA. El piloto inicial es el Hospital Veterinario Dr. Patino.

## Documentos obligatorios antes de tocar código

Antes de implementar cualquier tarea, lee SIEMPRE estos archivos en este orden:

1. `docs/PROJECT.md` — visión, alcance, stack.
2. El documento específico de la tarea:
   - Cambios de schema → `docs/SCHEMA.md`
   - Lógica del agente → `docs/AGENT.md`
   - Calendario semanal → `docs/ROADMAP.md`
   - Setup técnico → `docs/SETUP.md`
   - Cumplimiento legal → `docs/LEGAL.md`

## Stack obligatorio (no proponer alternativas)

- pnpm workspaces + Turborepo
- Next.js 15 App Router + TypeScript
- Tailwind + shadcn/ui
- Supabase (PostgreSQL + Auth + Edge Functions)
- Biome para lint y formato
- Zod para validación
- Vitest para tests
- Pino para logging
- Doppler para secretos (NUNCA hardcodear secretos)

## Reglas de oro

1. **NO instales paquetes nuevos sin confirmación previa**. Si necesitas algo, primero lista la alternativa y pregunta.
2. **NO modifiques archivos fuera del scope explícito del prompt**. Si necesitas tocar algo más, primero pregunta.
3. **NO inventes APIs o imports**. Si dudas sobre una librería, lee su documentación o pide al usuario que la consulte.
4. **NO commitees archivos `.env` ni secretos**. El proyecto usa Doppler.
5. **TODOS los cambios deben pasar `pnpm typecheck` y `pnpm format` antes de considerar terminada la tarea**.
6. **Multi-tenancy**: cualquier tabla nueva o consulta DEBE respetar el aislamiento por `clinic_id`. Sin excepciones.
7. **RLS**: cualquier tabla nueva tiene RLS habilitada con políticas explícitas.
8. **Idempotencia**: cualquier acción que modifique estado externo (Google Calendar, WhatsApp) debe ser idempotente.
9. **Logging**: usa Pino, nunca `console.log` en código de producción.
10. **Cuando dudes, PARA y pregunta**, no improvises.

## Convenciones de código

- TypeScript estricto: `noUncheckedIndexedAccess`, sin `any` salvo comentario `// biome-ignore` justificado.
- Imports absolutos con alias `@/*` en `apps/panel`, paths relativos cortos en `packages/*`.
- Componentes React: funciones nombradas, no `default export` salvo Next.js lo requiera.
- Async/await sobre `.then()`.
- Errores: tipos discriminados (`{ ok: true, data } | { ok: false, error }`) sobre throw en lógica de negocio.

## Convenciones de commits

Formato Conventional Commits:
- `feat(scope): description` — nueva funcionalidad
- `fix(scope): description` — bugfix
- `chore(scope): description` — mantenimiento, deps
- `docs(scope): description` — documentación
- `refactor(scope): description` — sin cambio funcional
- `test(scope): description` — tests

Scopes habituales: `panel`, `core`, `db`, `agent`, `whatsapp`, `auth`, `infra`.

## Estructura del repo

```
recepia/
├── apps/
│   └── panel/              # Next.js — panel web
├── packages/
│   ├── core/               # Lógica del agente, tools, tipos compartidos
│   ├── db/                 # Cliente Supabase + tipos generados
│   └── ui/                 # Componentes shadcn compartidos
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seeds/
├── docs/
└── CLAUDE.md (este archivo)
```

## Cuando termines una tarea

Ejecuta SIEMPRE estos comandos antes de declarar la tarea como completada:

```bash
pnpm format
pnpm typecheck
pnpm lint
pnpm test  # solo si la tarea afecta a tests
```

Si alguno falla, arregla antes de proponer commit.
````

---

## 3. Reglas globales que aplican a todos los prompts

Estas reglas se invocan implícitamente cuando Claude Code lee `CLAUDE.md`, pero conviene tenerlas claras también para Marc:

1. **Un prompt = una rama Git**. No mezclar trabajos diferentes.
2. **Diff < 500 líneas siempre que sea posible**. Si excede, divide la tarea.
3. **Prefiero pasos parados con feedback intermedio que un mega-prompt todo en uno**. Es más lento aparentemente, pero detectas errores antes.
4. **El agente nunca decide**: si hay alternativa, ofrécela y pregunta. Marc es quien decide.
5. **Nada se da por hecho**. Si una librería ha de comportarse de cierta manera, comprobarlo en docs o en código antes de asumir.

---

## 4. Plantilla base de prompt

Si necesitas crear un prompt nuevo no listado aquí, usa esta plantilla:

```
[CONTEXTO]
Estoy trabajando en Recepia. Antes de cualquier cambio, lee:
- docs/PROJECT.md
- docs/[DOCUMENTO_ESPECÍFICO].md
- CLAUDE.md

[OBJETIVO]
Quiero que [DESCRIBE LO QUE QUIERES, CON VERBO CLARO].

[ALCANCE]
- Archivos a tocar: [LISTA EXPLÍCITA o "explora el repo y propón"]
- Archivos a NO tocar: [LISTA o "el resto del proyecto"]

[REQUISITOS ESPECÍFICOS]
1. [...]
2. [...]
3. [...]

[CRITERIO DE HECHO]
La tarea está completa cuando:
- [ ] [...]
- [ ] [...]
- [ ] `pnpm typecheck`, `pnpm format`, `pnpm lint` pasan.

[PRIMERO]
Antes de empezar a escribir código, dame:
1. Tu plan paso a paso.
2. Lista de archivos que vas a crear o modificar.
3. Cualquier duda o decisión que necesites que te confirme.

Si todo está claro, espera mi OK para implementar.
```

---

## 5. Prompts — Semana 1 (Fundaciones)

Aplica al SETUP.md bloques 1-14. Cada prompt cubre uno o dos bloques.

---

### P-S1-01 · Inicializar monorepo

**Objetivo:** crear estructura de monorepo con pnpm workspaces, Turborepo, Biome y tsconfig base.

**Prerrequisitos:** repo `recepia-ai/recepia` clonado, Node 22 + pnpm 10 instalados.

**Contexto a leer:** ninguno (es el primer prompt).

**Prompt:**

```
Estoy arrancando el monorepo de Recepia desde cero. El repo está vacío salvo por el directorio .git/.

OBJETIVO
Inicializar el monorepo con la estructura descrita en docs/SETUP.md bloque 2 y bloque 3, que aún no está copiado al repo. Te paso aquí los archivos exactos a crear.

ALCANCE
Archivos a crear en la raíz:
- package.json
- pnpm-workspace.yaml
- turbo.json
- .gitignore
- biome.json
- tsconfig.base.json
- README.md

Carpetas a crear (con .gitkeep):
- apps/
- packages/core/
- packages/db/
- packages/ui/
- supabase/
- docs/

NO toques nada más.

CONTENIDO DE CADA ARCHIVO
[AQUÍ PEGAR LOS BLOQUES EXACTOS DE docs/SETUP.md §2.1, §2.2, §2.3, §3.1, §3.2, §3.3, §3.4]

REQUISITOS
1. Usa exactamente los contenidos que te paso.
2. NO instales todavía dependencias hasta el final.
3. Después de crear los archivos, ejecuta `pnpm install` y verifica que termina sin errores.

PRIMERO
Antes de crear nada, lista los archivos exactos que vas a crear con sus rutas. Espera mi OK.
```

**Criterio de hecho:**
- [ ] `pnpm install` corre sin errores.
- [ ] `pnpm turbo --version` muestra Turborepo 2.x.
- [ ] `pnpm format` y `pnpm typecheck` no fallan (aunque no haya código aún).

**Gotchas:**
- Claude Code puede proponer ESLint+Prettier por defecto. Cortarlo: este proyecto usa Biome.
- Puede sugerir `npm` o `yarn`. Cortarlo: pnpm es obligatorio.

---

### P-S1-02 · Copiar documentación al repo

**Objetivo:** trasladar PROJECT.md, SCHEMA.md, AGENT.md, ROADMAP.md, SETUP.md, LEGAL.md, PROMPTS.md a `docs/`.

**Prerrequisitos:** P-S1-01 hecho. Los 7 archivos descargados en local.

**Manual (no necesita Claude Code):**

```bash
# Desde donde tengas descargados los .md
cp PROJECT.md SCHEMA.md AGENT.md ROADMAP.md SETUP.md LEGAL.md PROMPTS.md ~/projects/recepia/docs/
cp dr_patino.sql ~/projects/recepia/supabase/seeds/

cd ~/projects/recepia
git add docs/ supabase/seeds/
git commit -m "docs: add foundational documents and Dr. Patino seed"
git push
```

**Criterio de hecho:** los 7 .md y el .sql visibles en GitHub.

---

### P-S1-03 · Aplicar migración inicial y generar tipos

**Objetivo:** crear la migración SQL en `supabase/migrations/`, aplicarla al proyecto Supabase remoto, y generar tipos TypeScript en `packages/db`.

**Prerrequisitos:**
- Proyecto Supabase creado y vinculado (SETUP.md bloque 5).
- Doppler configurado con `SUPABASE_*` vars (SETUP.md bloque 6).
- Documentos copiados (P-S1-02).

**Contexto a leer:** `docs/SCHEMA.md` (especialmente sección 11).

**Prompt:**

```
CONTEXTO
Lee primero estos archivos:
- docs/SCHEMA.md (especialmente la sección 11 — migración SQL inicial)
- docs/SETUP.md bloque 7 y bloque 8
- CLAUDE.md

OBJETIVO
1. Crear el archivo de migración inicial en supabase/migrations/ con el SQL EXACTO de SCHEMA.md sección 11.
2. Inicializar packages/db con package.json, tsconfig.json y src/index.ts según docs/SETUP.md bloque 8.
3. Generar los tipos TypeScript desde Supabase.

ALCANCE
Archivos a crear:
- supabase/migrations/20260610_000000_initial_schema.sql
- packages/db/package.json
- packages/db/tsconfig.json
- packages/db/src/index.ts
- packages/db/src/types.gen.ts (generado, no escribir a mano)

No toques nada más del monorepo.

REQUISITOS
1. El contenido del archivo de migración debe ser EXACTAMENTE el bloque SQL de SCHEMA.md §11. Si algo no cuadra, PARA y pregunta antes de inventar.
2. El comando para aplicar la migración es: supabase db push. Ejecútalo y muéstrame la salida.
3. El comando para generar tipos es: pnpm --filter @recepia/db gen:types. Ejecútalo después de la migración.
4. Al final, ejecuta `pnpm install` desde la raíz para que el workspace se enlace.
5. Verifica con `pnpm --filter @recepia/db typecheck` que pasa.

PRIMERO
Antes de tocar nada, dime:
1. ¿Confirma que el archivo de migración debe llamarse exactamente "20260610_000000_initial_schema.sql"? (Sí.)
2. ¿Hay algún paso que no esté claro o requiera mi input?
3. Plan de ejecución (4-5 pasos).

Espera mi OK.
```

**Criterio de hecho:**
- [ ] 15 tablas visibles en Supabase Studio con RLS activa.
- [ ] `packages/db/src/types.gen.ts` existe y no está vacío.
- [ ] `pnpm --filter @recepia/db typecheck` pasa.

**Gotchas:**
- Si `supabase db push` falla por "type already exists", BD no está limpia. Usa `supabase db reset` solo si la BD es nueva y vacía.
- Si los tipos generados están vacíos, suele ser falta de `supabase login` previo.

---

### P-S1-04 · Aplicar seed del Dr. Patino

**Objetivo:** cargar la clínica, configuración, servicios y usuario admin.

**Prerrequisitos:**
- P-S1-03 ejecutado.
- Usuario admin creado en Supabase Auth desde el dashboard (Authentication → Users → Add user, "Auto Confirm").
- UUID del usuario admin copiado.

**Contexto a leer:** `docs/SETUP.md` bloque 9, `supabase/seeds/dr_patino.sql`.

**Prompt:**

```
CONTEXTO
Lee:
- supabase/seeds/dr_patino.sql
- docs/SETUP.md bloque 9
- CLAUDE.md

OBJETIVO
Aplicar el seed dr_patino.sql al proyecto Supabase remoto, sustituyendo previamente el placeholder __USER_UUID_AQUI__ por el UUID real que te voy a dar.

UUID DEL USUARIO ADMIN
[PEGAR AQUÍ EL UUID — formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx]

ALCANCE
- Modificar supabase/seeds/dr_patino.sql sustituyendo el placeholder por el UUID real.
- Ejecutar el SQL contra la BD remota.

NO modifiques ningún otro archivo. No toques migraciones.

REQUISITOS
1. Verifica que el UUID que te paso tiene formato válido. Si no, paras.
2. Ejecuta el SQL mediante: psql "$SUPABASE_DB_URL" -f supabase/seeds/dr_patino.sql, usando la variable de entorno de Doppler. O alternativa: pegar el SQL en Supabase Studio SQL Editor.
3. Al final, ejecuta la query de verificación que está al final del SQL y muéstrame los conteos.

PRIMERO
Dime tu plan en 3 pasos. Confirma cómo vas a ejecutar el SQL (CLI vs Studio). Espera mi OK.
```

**Criterio de hecho:**
- [ ] Conteos verificados: `clinics=1, clinic_config=1, services=11, clinic_users=1`.
- [ ] `services_catalog_ids` rellenado con 11 UUIDs.

---

### P-S1-05 · Crear app `panel` con Next.js + shadcn

**Objetivo:** crear `apps/panel` con Next.js 15, configurar shadcn/ui, instalar dependencias mínimas.

**Prerrequisitos:** P-S1-01 hecho.

**Prompt:**

```
CONTEXTO
Lee:
- docs/SETUP.md bloques 10 y 11
- CLAUDE.md

OBJETIVO
Crear apps/panel con Next.js 15, configurar shadcn/ui e instalar los componentes mínimos (button, input, label, card, form, sonner).

ALCANCE
- Crear apps/panel mediante create-next-app con las opciones de SETUP.md §10.1.
- Actualizar apps/panel/package.json con el nombre @recepia/panel y la dependencia workspace @recepia/db.
- Ajustar apps/panel/tsconfig.json para extender ../../tsconfig.base.json.
- Inicializar shadcn/ui en apps/panel con shadcn@latest init.
- Añadir los 6 componentes shadcn listados.

NO crees páginas todavía. Solo el esqueleto.

REQUISITOS
1. Después de crear, ejecuta `pnpm install` desde la raíz.
2. Verifica que `pnpm --filter @recepia/panel dev` arranca y muestra la home de Next.js en http://localhost:3000.
3. Verifica que los archivos shadcn están en apps/panel/src/components/ui/.

PRIMERO
Confírmame el orden de los pasos (3-5 pasos) antes de empezar. Espera mi OK.
```

**Criterio de hecho:**
- [ ] `pnpm --filter @recepia/panel dev` arranca sin errores.
- [ ] `localhost:3000` carga.
- [ ] Carpeta `src/components/ui/` con los 6 componentes shadcn.

**Gotchas:**
- `create-next-app` pregunta sobre Turbopack. Decir NO por estabilidad.
- shadcn pregunta sobre alias y base color. Aceptar defaults excepto base color → Slate.

---

### P-S1-06 · Cliente Supabase con `@supabase/ssr` + middleware

**Objetivo:** integrar Supabase Auth en el panel con cliente server, cliente browser, y middleware de protección de rutas.

**Prerrequisitos:** P-S1-05 hecho.

**Prompt:**

```
CONTEXTO
Lee:
- docs/SETUP.md bloque 12
- packages/db/src/index.ts (debe exportar el tipo Database)
- CLAUDE.md

OBJETIVO
Implementar la integración de Supabase Auth en apps/panel siguiendo exactamente docs/SETUP.md bloque 12.

ALCANCE
Crear estos archivos en apps/panel/src/:
- lib/supabase/server.ts
- lib/supabase/client.ts
- middleware.ts

Usa el contenido literal de SETUP.md bloque 12.

NO crees páginas todavía.

REQUISITOS
1. Importa el tipo Database desde @recepia/db. Si el alias no funciona, depura, pero NO copies el tipo manualmente.
2. Las variables de entorno deben llamarse exactamente: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. Asegúrate de que están en Doppler pero NO las hardcodees en código.
3. Después de crear, ejecuta `pnpm --filter @recepia/panel typecheck` y muéstrame el output.

PRIMERO
¿Alguna duda sobre la integración? Espera mi OK.
```

**Criterio de hecho:**
- [ ] Los 3 archivos creados.
- [ ] `pnpm --filter @recepia/panel typecheck` pasa.
- [ ] Importación de `Database` resuelve correctamente.

---

### P-S1-07 · Login con Magic Link + página home autenticada

**Objetivo:** implementar el flujo de login completo + página home que muestra la clínica accesible.

**Prerrequisitos:** P-S1-06 hecho. Site URL y Redirect URLs configurados en Supabase Auth.

**Prompt:**

```
CONTEXTO
Lee:
- docs/SETUP.md bloque 13
- apps/panel/src/lib/supabase/server.ts y client.ts (que ya existen)
- CLAUDE.md

OBJETIVO
Implementar el flujo de login con Magic Link y la página home autenticada según docs/SETUP.md bloque 13 (apartados 13.2, 13.3, 13.4).

ALCANCE
Crear en apps/panel/src/app/:
- login/page.tsx
- auth/callback/route.ts
- page.tsx (sobrescribir si existe)

Si Next.js generó automáticamente un layout.tsx con cosas innecesarias, simplifícalo a un layout mínimo con fuente Inter y children. No añadas providers de tema todavía.

REQUISITOS
1. Usa los componentes shadcn ya instalados (Button, Input, Label, Card...).
2. La página home (page.tsx) debe hacer una consulta a la tabla `clinics` limit 1 para validar que RLS funciona end-to-end.
3. Implementa también signOut como server action.
4. Ejecuta `pnpm with-env pnpm --filter @recepia/panel dev` y verifica:
   - http://localhost:3000 redirige a /login si no estás autenticado.
   - El formulario de login acepta email y muestra confirmación.
   - El callback de /auth/callback gestiona el code.

NO toques middleware ni los clientes de Supabase, ya están hechos.

PRIMERO
Dame plan de archivos y orden. Espera OK.
```

**Criterio de hecho:**
- [ ] Magic Link llega al email y al pulsarlo aterrizas en `/` autenticado.
- [ ] La home muestra JSON de la clínica Dr. Patino.
- [ ] Cerrar sesión funciona.

**Gotchas:**
- Si Magic Link no llega: configurar SMTP propio (Resend) en Supabase Auth.
- Si después del callback se redirige a una página equivocada: verificar `Site URL` y `Redirect URLs` en Supabase Dashboard.

---

### P-S1-08 · Desplegar a Vercel

**Manual, no necesita Claude Code:**

```bash
# En Vercel dashboard:
# 1. Importar repo
# 2. Root directory: apps/panel
# 3. Conectar Doppler ↔ Vercel o copiar variables manualmente
# 4. Deploy
# 5. Actualizar Site URL y Redirect URLs en Supabase con la URL pública
```

**Criterio de hecho:** SETUP.md §15 (validación final) completo.

---

## 6. Prompts — Semana 2 (Pipeline WhatsApp)

---

### P-S2-01 · Motor de carga de `clinic_config` con Zod

**Objetivo:** crear `packages/core/src/config/` con tipos Zod del `clinic_config` y función `loadClinicConfig()`.

**Prerrequisitos:** Semana 1 cerrada.

**Contexto a leer:** `docs/AGENT.md` §3 (estructura completa de clinic_config).

**Prompt:**

```
CONTEXTO
Lee:
- docs/AGENT.md sección 3 ENTERA (estructura de clinic_config)
- docs/AGENT.md sección 11 (config completa del Dr. Patino, te servirá de fixture)
- packages/db/src/index.ts
- CLAUDE.md

OBJETIVO
Crear packages/core con un módulo de configuración que:
1. Define los tipos Zod del clinic_config (espejo del JSON Schema de AGENT.md §3).
2. Expone función loadClinicConfig(clinicId) que carga, valida con Zod, y cachea in-memory con TTL 60s.
3. Tiene tests unitarios que cargan el config del Dr. Patino y verifican que parsea sin errores.

ALCANCE
Crear:
- packages/core/package.json (nombre @recepia/core, depende de @recepia/db, zod, vitest)
- packages/core/tsconfig.json (extends ../../tsconfig.base.json)
- packages/core/src/index.ts
- packages/core/src/config/schema.ts (definición Zod)
- packages/core/src/config/loader.ts (función loadClinicConfig)
- packages/core/src/config/loader.test.ts (test con fixture)
- packages/core/test/fixtures/dr_patino_config.json (copia del JSON de AGENT.md §11)

NO toques otros workspaces.

REQUISITOS
1. Los tipos Zod deben cubrir TODA la estructura de AGENT.md §3, no abreviar.
2. La función loadClinicConfig toma un SupabaseClient como argumento (no lo crea ella) y devuelve un Result tipo discriminado:
   - { ok: true, config: ClinicConfig }
   - { ok: false, error: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DB_ERROR', details?: string }
3. El cache es un Map<clinicId, { config, expiresAt }> simple. No introduzcas dependencias de cache externas.
4. Test debe pasar `pnpm --filter @recepia/core test`.
5. Tipos: cero `any` en este módulo.

PRIMERO
1. Lista los enums y unions del schema que vas a modelar (TransferTrigger, HoursByDay, etc.).
2. Confirma si vas a importar tipos de @recepia/db o crearlos en este paquete.
3. Espera mi OK.
```

**Criterio de hecho:**
- [ ] `pnpm --filter @recepia/core test` pasa.
- [ ] `pnpm --filter @recepia/core typecheck` pasa.
- [ ] El test valida el JSON real del Dr. Patino.

---

### P-S2-02 · Edge Function `whatsapp_inbound`

**Objetivo:** webhook que recibe mensajes de 360dialog, identifica clínica/cliente/conversación, persiste mensaje.

**Prerrequisitos:** P-S2-01, número de 360dialog configurado en `clinic_channels`.

**Prompt:**

```
CONTEXTO
Lee:
- docs/AGENT.md sección 2 (anatomía de una conversación)
- docs/SCHEMA.md sección 5.3 (conversations, messages)
- docs/ROADMAP.md semana 2 tarea 2
- packages/core/src/config/loader.ts
- CLAUDE.md

OBJETIVO
Implementar una Supabase Edge Function llamada whatsapp_inbound que:
1. Recibe POST de 360dialog con un mensaje entrante.
2. Verifica firma HMAC del webhook.
3. Identifica clinic_id por número receptor (clinic_channels.identifier).
4. Crea o recupera el client por teléfono.
5. Crea o recupera la conversación activa del cliente.
6. Persiste el mensaje en messages con direction='inbound'.
7. Devuelve 200 OK rápido (procesamiento adicional asíncrono).

ALCANCE
Crear:
- supabase/functions/whatsapp_inbound/index.ts (Deno runtime)
- supabase/functions/whatsapp_inbound/types.ts (payload de 360dialog tipado)
- supabase/functions/_shared/supabase.ts (cliente Supabase service role compartido)
- supabase/functions/_shared/360dialog.ts (validación de firma)

NO modifiques otros archivos.

REQUISITOS
1. Usa @supabase/supabase-js v2 con la service role key (variable env SUPABASE_SERVICE_ROLE_KEY).
2. El payload de 360dialog: si no estás seguro de su estructura, déjalo como `Record<string, unknown>` y pídeme la doc oficial; NO inventes.
3. Validación HMAC con HMAC-SHA256 sobre el cuerpo crudo. Variable env: D360_WEBHOOK_SECRET.
4. Si el clinic_id no se encuentra, log warning y devolver 200 (no rebotar mensajes).
5. Si el client no existe, crearlo con phone + preferred_language='es', el full_name queda null hasta que el agente lo pida.
6. La conversación se considera "activa" si su status='active' o 'awaiting_human' o 'human_handling' y started_at < 24h. Si no hay activa, crear nueva.
7. Logging con console.log estructurado (Deno standard). Estructurar como JSON: {level, msg, clinic_id, conversation_id, ...}.

NO añadas lógica de agente todavía. Solo persistir.

PRIMERO
1. Confirma que tienes claro el payload de 360dialog (di "no sé" si no, te paso un ejemplo).
2. Dame el plan en pasos.
3. Espera OK.
```

**Criterio de hecho:**
- [ ] `supabase functions deploy whatsapp_inbound` sin errores.
- [ ] Probado con `curl` simulando un payload: aparece fila en `messages`.
- [ ] Firma inválida → 401.

**Gotchas:**
- Si el agente inventa el formato de webhook de 360dialog, párale y pásale un JSON real de su doc oficial: <https://docs.360dialog.com>.

---

### P-S2-03 · Edge Function `whatsapp_outbound`

**Objetivo:** helper interno para enviar mensajes vía 360dialog.

**Prerrequisitos:** P-S2-02.

**Prompt:**

```
CONTEXTO
Lee:
- supabase/functions/whatsapp_inbound/index.ts (referencia de estilo)
- docs/SCHEMA.md sección 5.3 (messages)
- CLAUDE.md

OBJETIVO
Implementar supabase/functions/whatsapp_outbound como helper interno (no webhook público):
1. Recibe payload { conversation_id, content, content_type? }.
2. Recupera la conversación y el cliente (para el teléfono).
3. Llama a la API de 360dialog para enviar el mensaje.
4. Persiste mensaje en messages con direction='outbound', sender='agent'.
5. Maneja errores con backoff exponencial simple (3 reintentos).

ALCANCE
Crear:
- supabase/functions/whatsapp_outbound/index.ts

NO modifiques whatsapp_inbound.

REQUISITOS
1. Endpoint privado: validar header Authorization con un secret interno (variable env INTERNAL_FUNCTION_SECRET).
2. API key de 360dialog en variable env D360_API_KEY.
3. Idempotencia: si el mismo conversation_id + content + minuto-timestamp ya existe en messages como outbound en los últimos 60s, no reenviar.
4. Logging estructurado.

PRIMERO
Plan en 4-5 pasos. OK.
```

**Criterio de hecho:**
- [ ] Llamada con curl al endpoint envía un WhatsApp real al número de prueba.
- [ ] Mensaje persistido en `messages`.

---

### P-S2-04 · Página `/conversations` (read-only)

**Objetivo:** primera vista del panel que lista conversaciones.

**Prompt:**

```
CONTEXTO
Lee:
- apps/panel/src/app/page.tsx (referencia de patrón)
- docs/SCHEMA.md (tabla conversations y vista v_active_conversations)
- CLAUDE.md

OBJETIVO
Crear página /conversations en apps/panel que liste todas las conversaciones de las clínicas del usuario.

ALCANCE
Crear:
- apps/panel/src/app/conversations/page.tsx (server component)
- apps/panel/src/app/conversations/_components/conversations-table.tsx
- apps/panel/src/app/conversations/_components/status-badge.tsx

NO toques middleware ni otras páginas.

REQUISITOS
1. Server Component que hace SELECT a la vista v_active_conversations.
2. Tabla con columnas: cliente (full_name o phone), mascota, canal, status, urgency_level, last_message_at, message_count.
3. Status y urgency como badges con colores (shadcn Badge — añadir si falta).
4. Sin paginación todavía (limit 50).
5. Si la lista está vacía, mensaje "No hay conversaciones activas" en estilo placeholder.
6. Click en una fila → navega a /conversations/[id] (deja el Link aunque la página no exista aún).

PRIMERO
Plan. OK.
```

**Criterio de hecho:**
- [ ] Página renderiza sin errores.
- [ ] RLS funciona (solo ves conversaciones de tu clínica).

---

## 7. Prompts — Semana 3 (Agente conversacional)

A partir de aquí, los prompts ganan complejidad. **Recomendación: usar Claude Sonnet para estos, no DeepSeek**, salvo que tengas mucha tolerancia a iteración.

---

### P-S3-01 · Tools del agente con JSON Schema (parte 1: lectura)

**Objetivo:** implementar las 4 tools de solo lectura: `buscar_cliente`, `consultar_horario_y_disponibilidad`, `consultar_servicios_disponibles` (auxiliar), `clasificar_conversacion`.

**Contexto a leer:** `docs/AGENT.md` §5 (tools), `packages/core/src/config/schema.ts`.

**Prompt:**

```
CONTEXTO
Lee con MUCHA atención:
- docs/AGENT.md sección 5 ENTERA (cada tool con su JSON Schema)
- packages/core/src/config/schema.ts
- docs/SCHEMA.md sección 5
- CLAUDE.md

OBJETIVO
Implementar 4 tools de SOLO LECTURA del agente en packages/core/src/agent/tools/:
- buscar_cliente.ts
- consultar_horario_y_disponibilidad.ts (con calendario MOCKEADO por ahora — devuelve slots fijos)
- clasificar_conversacion.ts
- consultar_servicios_disponibles.ts (auxiliar)

ALCANCE
Crear:
- packages/core/src/agent/tools/types.ts (interface Tool<Input, Output>)
- packages/core/src/agent/tools/registry.ts (registro accesible por nombre)
- 4 archivos de tools mencionados arriba
- Tests vitest por cada tool en mismo directorio con sufijo .test.ts

NO implementes todavía las tools de escritura.

REQUISITOS
1. Cada Tool exporta:
   - name: string (literal)
   - description: string (para el LLM)
   - inputSchema: ZodSchema (que también se convierte a JSON Schema)
   - outputSchema: ZodSchema
   - handler: (input, ctx) => Promise<Output | ToolError>
   donde ctx = { supabase, clinicId, conversationId, logger }
2. registry.ts exporta:
   - getTool(name): Tool | null
   - listTools(): Tool[]
   - getJsonSchemas(): Record<string, JsonSchema>  // para pasar al LLM
3. Conversión Zod → JSON Schema: usa la librería zod-to-json-schema (instálala si no está; confirma conmigo).
4. Cada tool registra su invocación en tool_invocations (salvo clasificar_conversacion que actualiza conversations directamente).
5. Tests: para cada tool, dos casos felices y un caso de error.

PRIMERO
1. Confírmame: ¿añado la dependencia zod-to-json-schema?
2. Esqueleto de tipos Tool<I, O> y ToolError.
3. Lista de exports por archivo.
4. Espera OK.
```

**Criterio de hecho:**
- [ ] 4 tools + registry implementados.
- [ ] Tests verdes.
- [ ] JSON Schemas generados correctamente.

---

### P-S3-02 · Tools del agente (parte 2: escritura)

**Objetivo:** las tools que modifican estado: `registrar_cliente`, `registrar_mascota`, `crear_cita`, `modificar_cita`, `cancelar_cita`, `transferir_a_humano`, `finalizar_conversacion`.

**Prompt:** *(estructura idéntica a P-S3-01, ajustando lista de tools y añadiendo requisito de idempotencia explícita en crear_cita)*

---

### P-S3-03 · Bucle conversacional `loop.ts`

**Objetivo:** orquestación del bucle: mensaje entra → cargar contexto → invocar LLM → ejecutar tools → responder.

**Prompt:**

```
CONTEXTO
Lee:
- docs/AGENT.md secciones 2, 4, 6 enteras
- packages/core/src/agent/tools/registry.ts
- packages/core/src/config/loader.ts
- CLAUDE.md

OBJETIVO
Implementar packages/core/src/agent/loop.ts: el bucle conversacional principal.

ALCANCE
Crear:
- packages/core/src/agent/loop.ts
- packages/core/src/agent/llm/anthropic.ts (cliente Claude)
- packages/core/src/agent/prompts/system.ts (plantilla de AGENT.md §4.1, función buildSystemPrompt)
- packages/core/src/agent/intent.ts (intent detector simple regex+keywords para triggers de transferencia)
- Tests del loop con LLM MOCKEADO (no llamar a API real en tests)

NO toques las tools.

REQUISITOS
1. Función principal: processIncomingMessage({ conversationId, supabase, logger }): Promise<void>
   Pasos:
   - Cargar conversación + clinic_config.
   - Verificar status: si no es 'active', no hacer nada (el humano tiene control).
   - Cargar historial de mensajes (últimos ~30 mensajes).
   - Ejecutar intent detector sobre el último mensaje del cliente. Si dispara trigger, forzar tool transferir_a_humano y salir.
   - Construir system prompt con buildSystemPrompt.
   - Llamar al LLM con: system, mensajes, tools (JSON schemas del registry).
   - Loop: mientras LLM devuelva tool_use, ejecutar tool y volver a llamar.
   - Cuando LLM devuelva texto final, escribirlo en messages y enviar por whatsapp_outbound.
   - Si LLM invoca transferir_a_humano o finalizar_conversacion, cerrar bucle.
2. Guardrails post-LLM (AGENT.md §10): aplicar antes de enviar.
3. Límite duro: máximo 8 iteraciones del bucle por mensaje (evita loops infinitos).
4. Logger estructurado en cada paso clave.
5. Tipos discriminados para Result.

PRIMERO
1. Plan general en 5-7 pasos.
2. Confírmame: ¿LLM es @anthropic-ai/sdk? ¿Modelo "claude-sonnet-4-5"?
3. ¿Cómo manejas el intent detector? Lista de triggers a detectar con regex de ejemplo.
4. OK.
```

**Criterio de hecho:**
- [ ] Tests del loop con LLM mockeado pasan.
- [ ] El loop respeta el límite de 8 iteraciones.
- [ ] Intent detector dispara correctamente con frases de ejemplo.

**Gotchas:**
- Tentación: dejar que el LLM decida transferencias siempre. NO. Las transferencias inmediatas son determinísticas.

---

### P-S3-04 · Conectar bucle al pipeline WhatsApp

**Requiere decisión arquitectónica previa**: cómo invocar el bucle (escrito en Node/TypeScript) desde la Edge Function de Deno. Opciones:

1. Compilar `loop.ts` para que funcione en Deno (con `npm:@recepia/core`).
2. Crear una segunda Edge Function `agent_process_message` que importe el código compilado.
3. Mover el procesamiento a un job worker (Supabase Queues + worker en VPS).

Esta decisión se aborda en el chat correspondiente, no se prompt-ea a ciegas.

---

### P-S3-05 · Resumen automático al cerrar

**Objetivo:** Edge Function `summarize_conversation` que llama a DeepSeek con el transcript y guarda en `conversation_summaries`.

**Prompt:** *(estructura ya familiar, sigue patrón de las anteriores)*

---

## 8. Prompts — Semanas 4-6 (plantillas)

A partir de la semana 4, los prompts se afinan al ejecutar la semana, no antes. La razón: el feedback acumulado de semanas 1-3 cambia la forma óptima de pedir las cosas. Aquí dejo solo el esquema para que tengas un norte.

### Semana 4 — Panel funcional

- **P-S4-01**: layout y navegación con shadcn.
- **P-S4-02**: detalle de conversación con timeline + datos cliente/mascota.
- **P-S4-03**: vista calendario del día.
- **P-S4-04**: listado y detalle de clientes.
- **P-S4-05**: realtime de mensajes con Supabase Realtime.
- **P-S4-06**: búsqueda full-text.

### Semana 5 — Intervención humana + configurador

- **P-S5-01**: botón "tomar control" con transición de estados.
- **P-S5-02**: input de mensaje humano en detalle de conversación.
- **P-S5-03**: formulario de edición de `clinic_config` (el más complicado del panel).
- **P-S5-04**: CRUD de servicios.
- **P-S5-05**: gestión de usuarios de la clínica.
- **P-S5-06**: estado de integraciones (Google Calendar).

### Semana 6 — Producción

- **P-S6-01**: dataset de evaluación con conversaciones reales.
- **P-S6-02**: modo supervisado activable por config.
- **P-S6-03**: kill switch global por clínica.
- **P-S6-04**: documentación de usuario para el equipo Dr. Patino.

---

## 9. Prompts de revisión y QA

Estos son **transversales**: úsalos cuando termines una épica o antes de mergear una rama importante.

### P-QA-01 · Revisión de seguridad

**Objetivo:** identificar potenciales filtraciones de datos, secretos hardcodeados, falta de RLS.

**Prompt:**

```
CONTEXTO
Lee:
- CLAUDE.md
- docs/SCHEMA.md sección 7 (RLS)
- docs/LEGAL.md sección 5.2 (medidas técnicas)

OBJETIVO
Auditar el repositorio buscando issues de seguridad. Cero cambios, solo informe.

ALCANCE
Revisa el repo entero. Para cada finding:
- Severidad (high / medium / low)
- Archivo y línea
- Descripción del riesgo
- Sugerencia concreta

REQUISITOS
Busca específicamente:
1. Strings que parezcan API keys, tokens, passwords en el código (regex tipo /sk-[a-zA-Z0-9]+/).
2. Console.log que loguee variables sensibles (.password, .token, .email completos, .phone).
3. Endpoints o Edge Functions sin validación de input.
4. Edge Functions que usen service role key sin validar el origen.
5. Tablas sin RLS, o políticas RLS sobre-permisivas.
6. Componentes React server que reciban datos del cliente sin sanitizar.
7. Patrones de SQL injection (no debería haber por el cliente Supabase, pero por si acaso).
8. Cookies sin httpOnly o sin secure en producción.

NO modifiques nada. Solo informe en formato Markdown.

PRIMERO
Empieza el escaneo.
```

### P-QA-02 · Revisión de RLS por aislamiento

**Prompt:** *(crear dos usuarios en dos clínicas distintas, verificar que cada uno solo ve sus datos. Patrón habitual: script de test en `tests/rls/`.)*

### P-QA-03 · Evaluación del agente con dataset golden

**Prompt:** *(cuando tengas el dataset de ~20-30 conversaciones del Dr. Patino, este prompt corre la suite y reporta métricas: tool accuracy, transfer correctness, urgency accuracy.)*

---

## 10. Prompts de troubleshooting

Cuando algo falla, no hagas un prompt nuevo cada vez. Usa estos genéricos:

### T-01 · "Esto no compila"

```
TypeScript error / lint error que no entiendo:

[PEGAR ERROR COMPLETO]

Archivo y contexto relevante:
[PEGAR ARCHIVO o RUTA]

Análisis y propuesta de fix.
- NO refactores el archivo entero.
- Cambio mínimo que resuelva.
- Explica el porqué del error en 2 frases.
```

### T-02 · "Funciona en local pero no en Vercel"

```
Algo falla en deploy de Vercel pero funciona en local.

Logs de Vercel:
[PEGAR LOGS]

Variables que estoy usando:
[LISTAR NEXT_PUBLIC_*]

Hipótesis principales (sin tocar código todavía) y cómo verificarlas.
```

### T-03 · "Supabase no devuelve lo que espero"

```
Una consulta a Supabase no devuelve lo que espero.

Consulta:
[PEGAR .from(...).select(...)]

Lo que espero ver:
[...]

Lo que veo:
[...]

Tipos generados de la tabla:
[PEGAR EL TIPO DE @recepia/db]

¿Es problema de RLS, de tipos o de query? Diagnóstico y cómo verificar cada hipótesis.
```

---

## 11. Anti-patterns: cómo NO redactar prompts

### Anti-pattern 1: "haz el panel"

Demasiado vago. Resultado impredecible. Divide en sub-tareas.

### Anti-pattern 2: pegar 4 documentos completos en el prompt

Saturas el contexto. Mejor: "lee X, Y, Z del repo y vuelve cuando los hayas leído". Claude Code es bueno leyendo archivos.

### Anti-pattern 3: no especificar alcance

Sin "NO toques X", el agente puede refactorizar medio repo. Siempre delimita.

### Anti-pattern 4: omitir el criterio de hecho

Sin criterio, no sabes si está "terminado". Defínelo siempre.

### Anti-pattern 5: aceptar el primer plan sin discutir

Si el agente propone un plan, **léelo** antes de decir OK. La mitad de los errores se evitan en ese paso.

### Anti-pattern 6: dar feedback en bloque al final

Mejor: corrige en iteraciones cortas. Si tras un primer intento ves un error claro, párale y redirige antes de que avance más.

### Anti-pattern 7: pedir "perfecto"

Pídele que sea "correcto y testeable", no perfecto. La perfección invita a sobre-ingeniería.

---

## 12. Mantenimiento de este documento

Este archivo es **vivo**. Cada vez que ejecutes un prompt y aprendas algo:

- Si un prompt funcionó bien: déjalo como está.
- Si un prompt tuvo que retocarse: actualiza la versión aquí.
- Si descubres un nuevo anti-pattern: añádelo a §11.
- Cuando llegues a la semana 4, escribe los prompts detallados de S4 en el documento (sustituye las plantillas placeholder).

Versionado: cada cambio sustancial bump de versión en la cabecera y entrada en §13.

---

## 13. Cambios

| Fecha | Versión | Autor | Cambio |
|---|---|---|---|
| 2026-06-10 | 0.1 | Marc + Claude | Documento inicial. Prompts Semanas 1-3 detallados, plantillas Semanas 4-6. |
