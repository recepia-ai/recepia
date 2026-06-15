# RECEPIA — SETUP.md (Semana 1)

> Guía operativa para arrancar el proyecto desde cero. Versión 0.1 — junio 2026.
>
> Pensado para ejecutar en Linux (Ubuntu/Debian/Hetzner) o macOS. Para Windows, usar WSL2.
>
> Cada bloque es un objetivo cerrado de 30-90 min. Puedes parar entre bloques sin perder contexto.

---

## Visión rápida

15 bloques organizados en este orden:

| # | Bloque | Tiempo aprox. |
|---|---|---|
| 0 | Pre-requisitos: cuentas y herramientas locales | 30 min |
| 1 | GitHub: organización y repositorio | 15 min |
| 2 | Monorepo: pnpm workspaces + Turborepo | 30 min |
| 3 | Configuración base: Biome, gitignore, scripts | 20 min |
| 4 | Documentación: copiar PROJECT/SCHEMA/AGENT/ROADMAP a `docs/` | 10 min |
| 5 | Supabase: crear proyecto y vincular CLI | 30 min |
| 6 | Doppler: proyectos y secretos | 30 min |
| 7 | Migración SQL inicial: aplicar SCHEMA.md | 30 min |
| 8 | Tipos TypeScript generados desde Supabase | 15 min |
| 9 | Seed: Dr. Patino y catálogo de servicios | 30 min |
| 10 | Next.js panel: arrancar `apps/panel` | 30 min |
| 11 | shadcn/ui: inicializar | 20 min |
| 12 | Cliente Supabase con `@supabase/ssr` | 30 min |
| 13 | Login con Magic Link | 60 min |
| 14 | Vercel: desplegar `apps/panel` | 30 min |
| 15 | Validación final: checklist completo | 20 min |

**Total estimado:** ~25 h con margen para imprevistos.

---

## Bloque 0 — Pre-requisitos

### 0.1 Cuentas necesarias

- [ ] **GitHub** — cuenta personal de Marc + capacidad de crear organización (gratis).
- [ ] **Supabase** — cuenta en `supabase.com`, plan Free para empezar.
- [ ] **Vercel** — cuenta en `vercel.com`, plan Hobby.
- [ ] **Doppler** — cuenta en `doppler.com`, plan Free (hasta 3 proyectos).
- [ ] **Anthropic** — cuenta en `console.anthropic.com` con créditos cargados.
- [ ] **DeepSeek** — cuenta en `platform.deepseek.com` con créditos.
- [ ] **Google Cloud** — cuenta para OAuth de Google Calendar (no obligatorio en semana 1, sí en semana 3).
- [ ] **360dialog** — cuenta en `hub.360dialog.com` (no obligatorio en semana 1, sí en semana 2).

### 0.2 Herramientas locales (Linux/macOS)

Verifica versiones exactas:

```bash
node -v          # debe ser >= 20.x, recomendado 22.x LTS
pnpm -v          # debe ser >= 9.x, recomendado 10.x
git --version    # cualquier versión reciente
```

Si Node no está o es antiguo, instalar vía `nvm` (Marc ya tiene este patrón de PetLearn):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# Cerrar y reabrir terminal
nvm install 22
nvm use 22
nvm alias default 22
```

Instalar pnpm:

```bash
npm install -g pnpm@latest
```

Instalar Supabase CLI:

```bash
# Linux
curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz -o /tmp/supabase.tar.gz
tar -xzf /tmp/supabase.tar.gz -C /tmp
sudo mv /tmp/supabase /usr/local/bin/supabase

# Verificar
supabase --version
```

Instalar Doppler CLI:

```bash
(curl -Ls https://cli.doppler.com/install.sh || wget -qO- https://cli.doppler.com/install.sh) | sudo sh
doppler --version
```

Instalar Vercel CLI:

```bash
pnpm install -g vercel
vercel --version
```

### 0.3 Criterio de "hecho"

- [ ] Todas las cuentas activas y verificadas.
- [ ] `node`, `pnpm`, `git`, `supabase`, `doppler`, `vercel` ejecutables sin errores.

---

## Bloque 1 — GitHub: organización y repositorio

### 1.1 Crear organización

1. Ir a `https://github.com/organizations/new`.
2. Plan: **Free**.
3. Nombre: `recepia-ai`.
4. Email de contacto: el de Marc.
5. Quién: cuenta personal.

### 1.2 Crear repositorio

1. Dentro de `recepia-ai`, crear repo `recepia`.
2. **Private**.
3. Sin README, sin .gitignore, sin licencia (los añadiremos a mano).

### 1.3 Clonar localmente

```bash
cd ~/projects   # o donde Marc guarda sus proyectos
git clone git@github.com:recepia-ai/recepia.git
cd recepia
```

### 1.4 Configurar Git (si no está)

```bash
git config user.name "Marc SR"
git config user.email "tu-email@dominio"
```

### 1.5 Criterio de "hecho"

- [ ] Repo `recepia-ai/recepia` accesible.
- [ ] `cd recepia` funciona localmente con remote `origin` apuntando a GitHub.

---

## Bloque 2 — Monorepo: pnpm workspaces + Turborepo

### 2.1 Inicializar el monorepo

Desde la raíz del repo:

```bash
pnpm init
```

Editar `package.json` raíz:

```json
{
  "name": "recepia",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=10.0.0"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "format": "biome format --write .",
    "format:check": "biome format ."
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

### 2.2 Crear `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 2.3 Crear `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### 2.4 Crear estructura de carpetas

```bash
mkdir -p apps packages/core packages/db packages/ui supabase docs
touch apps/.gitkeep packages/core/.gitkeep packages/db/.gitkeep packages/ui/.gitkeep
```

### 2.5 Instalar dependencias raíz

```bash
pnpm install
```

### 2.6 Criterio de "hecho"

- [ ] `pnpm install` corre sin errores.
- [ ] `pnpm turbo --version` muestra Turborepo 2.x.
- [ ] Estructura visible: `apps/`, `packages/`, `supabase/`, `docs/`.

---

## Bloque 3 — Configuración base

### 3.1 Crear `.gitignore` raíz

```gitignore
# Dependencias
node_modules/
.pnpm-store/

# Build outputs
.next/
dist/
build/
out/
*.tsbuildinfo

# Turbo
.turbo/

# Entornos
.env
.env*.local
.env.development
.env.production

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Editor
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
.idea/
.DS_Store

# Supabase local
supabase/.branches
supabase/.temp
supabase/.env

# Doppler
.doppler.yaml
```

### 3.2 Crear `biome.json` raíz

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "ignore": [
      "**/node_modules",
      "**/.next",
      "**/dist",
      "**/.turbo",
      "**/types.gen.ts"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noUnusedTemplateLiteral": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

### 3.3 Crear `tsconfig.base.json` raíz

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### 3.4 Crear `README.md` raíz

```markdown
# Recepia

Recepcionista virtual veterinaria con IA. Plataforma SaaS multi-tenant.

## Documentación

- [`docs/PROJECT.md`](./docs/PROJECT.md) — visión, alcance, stack, fases.
- [`docs/SCHEMA.md`](./docs/SCHEMA.md) — modelo de datos.
- [`docs/AGENT.md`](./docs/AGENT.md) — diseño del agente conversacional.
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — plan de Iteración 1.
- [`docs/SETUP.md`](./docs/SETUP.md) — guía de setup inicial.

## Estructura

\`\`\`
recepia/
├── apps/panel/        Next.js — panel web
├── packages/
│   ├── core/          Lógica del agente, tools, tipos compartidos
│   ├── db/            Cliente Supabase + tipos generados
│   └── ui/            Componentes shadcn compartidos
├── supabase/          Migraciones y Edge Functions
└── docs/              Documentación del proyecto
\`\`\`

## Desarrollo

\`\`\`bash
pnpm install
pnpm dev
\`\`\`
```

### 3.5 Primer commit

```bash
git add .
git commit -m "chore: initial monorepo setup"
git push origin main
```

### 3.6 Criterio de "hecho"

- [ ] `pnpm format` corre sin errores.
- [ ] Commit visible en GitHub.
- [ ] `.env` no aparece en el repo (verificar con `git status`).

---

## Bloque 4 — Documentación

### 4.1 Copiar los documentos generados

Copia a `docs/` los 5 archivos producidos en los chats anteriores:

```bash
# Desde la carpeta donde tengas los .md descargados
cp PROJECT.md SCHEMA.md AGENT.md ROADMAP.md SETUP.md ~/projects/recepia/docs/
```

### 4.2 Commit

```bash
cd ~/projects/recepia
git add docs/
git commit -m "docs: add foundational documents"
git push
```

### 4.3 Criterio de "hecho"

- [ ] Los 5 documentos accesibles desde `docs/` en GitHub.

---

## Bloque 5 — Supabase: proyecto y vinculación

### 5.1 Crear proyecto en Supabase

1. Ir a `https://supabase.com/dashboard`.
2. New project:
   - **Name:** `recepia-prod` (este es el primero; el de dev puede esperar).
   - **Database password:** generar uno fuerte y guardar en gestor de contraseñas.
   - **Region:** `eu-central-1` (Frankfurt) o `eu-west-2` (London).
   - **Pricing plan:** Free.
3. Esperar 1-2 min a que se aprovisione.

### 5.2 Anotar credenciales

Del panel de Supabase, sección **Project Settings → API**, anotar:

- `Project URL` (formato `https://xxxx.supabase.co`)
- `anon public` key
- `service_role` key — **MUY SENSIBLE**

### 5.3 Vincular CLI al proyecto

```bash
cd ~/projects/recepia
supabase init
# Responder yes a generar carpetas si pregunta

# Obtener el project ref (los caracteres antes de .supabase.co)
# Ejemplo: si URL es https://abcdwxyz.supabase.co, ref es "abcdwxyz"

supabase link --project-ref TU_PROJECT_REF
# Pedirá la password de la BD: introducir la del paso 5.1
```

### 5.4 Estructura generada

Supabase CLI habrá creado:

```
supabase/
├── config.toml
├── migrations/
└── seed.sql
```

### 5.5 Criterio de "hecho"

- [ ] Proyecto Supabase visible en dashboard.
- [ ] `supabase status` desde el repo muestra el proyecto vinculado.
- [ ] `supabase/config.toml` existe.

---

## Bloque 6 — Doppler: secretos centralizados

### 6.1 Crear proyecto en Doppler

1. Ir a `https://dashboard.doppler.com`.
2. New project: `recepia`.
3. Configs por defecto: `dev`, `stg`, `prd`. Mantener `dev` y `prd`, eliminar `stg` por ahora.

### 6.2 Cargar secretos en `prd`

En la config `prd` de Doppler, añadir:

```
SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Notas:
- `NEXT_PUBLIC_*` son los que el frontend de Next.js puede leer.
- `SUPABASE_SERVICE_ROLE_KEY` jamás se expone al cliente; solo Edge Functions y scripts.

### 6.3 Vincular CLI local a `dev`

```bash
cd ~/projects/recepia
doppler login                     # autentica navegador
doppler setup                     # selecciona proyecto recepia + config dev
```

Para `dev`, copia inicialmente los mismos secretos de `prd` (en una iteración futura tendrás un proyecto Supabase separado para dev).

### 6.4 Probar el flujo

```bash
doppler run -- printenv | grep SUPABASE
```

Debe imprimir las variables. Si lo hace, la carga funciona.

### 6.5 Añadir comando de conveniencia al `package.json` raíz

```json
"scripts": {
  ...
  "with-env": "doppler run --"
}
```

Así podrás hacer `pnpm with-env pnpm dev` y se inyectan las vars.

### 6.6 Criterio de "hecho"

- [ ] `doppler secrets` muestra todas las variables esperadas.
- [ ] `doppler run -- echo $SUPABASE_URL` imprime la URL.

---

## Bloque 7 — Migración SQL inicial

### 7.1 Crear archivo de migración

```bash
cd ~/projects/recepia
supabase migration new initial_schema
```

Esto crea un archivo en `supabase/migrations/YYYYMMDDHHMMSS_initial_schema.sql`.

### 7.2 Pegar el SQL

Abrir el archivo recién creado y pegar **íntegramente** el bloque SQL de la sección 11 de `docs/SCHEMA.md` (desde `-- Recepia — Migración inicial` hasta `-- Fin migración inicial`).

### 7.3 Aplicar la migración

```bash
supabase db push
```

Te pedirá confirmación. Confirmar.

Si todo va bien, verás algo como:
```
Applying migration 20260610_000000_initial_schema.sql...
Finished supabase db push
```

### 7.4 Verificar en Supabase Studio

1. Abrir `https://supabase.com/dashboard/project/TU_REF/editor`.
2. Confirmar que aparecen las 15 tablas:
   - `clinics`, `clinic_users`, `clinic_config`, `clinic_config_history`, `clinic_channels`, `clinic_integrations`
   - `clients`, `pets`, `services`
   - `conversations`, `messages`, `conversation_summaries`
   - `appointments`
   - `tool_invocations`, `events`
3. En cada una, verificar el icono de candado (RLS activa).

### 7.5 Criterio de "hecho"

- [ ] Migración aplicada sin errores.
- [ ] 15 tablas visibles en Supabase Studio.
- [ ] RLS activa en todas (icono de candado).
- [ ] Las 2 vistas (`v_today_appointments`, `v_active_conversations`) existen.

### 7.6 Si algo falla

- Si `supabase db push` falla por "type already exists", la BD tiene estado previo. Resetear con `supabase db reset` (esto borra todo, solo si es BD vacía).
- Si hay errores de sintaxis SQL, revisar que copiaste el bloque completo. Las migraciones en Supabase son transaccionales: o se aplica todo o nada.

---

## Bloque 8 — Tipos TypeScript generados

### 8.1 Inicializar `packages/db`

```bash
cd ~/projects/recepia/packages/db
pnpm init
```

Editar `packages/db/package.json`:

```json
{
  "name": "@recepia/db",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "gen:types": "supabase gen types typescript --linked > src/types.gen.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

### 8.2 Generar los tipos

```bash
cd ~/projects/recepia
mkdir -p packages/db/src
pnpm --filter @recepia/db gen:types
```

Debe crear `packages/db/src/types.gen.ts` con tipos de todas las tablas.

### 8.3 Crear `packages/db/src/index.ts`

```typescript
export type { Database } from "./types.gen";
```

### 8.4 Crear `packages/db/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

### 8.5 Instalar dependencias

```bash
cd ~/projects/recepia
pnpm install
```

### 8.6 Criterio de "hecho"

- [ ] `packages/db/src/types.gen.ts` existe y no está vacío.
- [ ] `pnpm --filter @recepia/db typecheck` pasa sin errores.

---

## Bloque 9 — Seed: Dr. Patino y servicios

### 9.1 Crear usuario admin en Supabase Auth

1. En Supabase Studio → **Authentication → Users → Add user**.
2. Email: el de Marc.
3. Password: NO (vamos a usar Magic Link, deja la opción de "Auto Confirm User" activada).
4. Confirmar creación.
5. Copiar el `id` (UUID) del usuario creado.

### 9.2 Editar `supabase/seed.sql`

Reemplazar el contenido por:

```sql
-- Seed inicial: Hospital Veterinario Dr. Patino

-- Clínica
insert into clinics (id, name, slug, timezone, locale, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'Hospital Veterinario Dr. Patino',
  'dr-patino',
  'Europe/Madrid',
  'es-ES',
  'active'
)
on conflict (id) do nothing;

-- clinic_config (PEGAR AQUÍ el JSON completo de AGENT.md §11)
insert into clinic_config (clinic_id, config, version)
values (
  '00000000-0000-0000-0000-000000000001',
  $${
    "identity": {
      "clinic_name": "Hospital Veterinario Dr. Patino",
      "legal_name": "Hospital Veterinario Dr. Patino S.L.",
      "agent_name": "Recepia",
      "tone": "professional_warm",
      "language_default": "es-ES",
      "disclaimer_first_contact": "Hola, soy Recepia, la asistente virtual del Hospital Veterinario Dr. Patino. Te atiendo encantada. ¿En qué puedo ayudarte?"
    }
    /* ... estructura completa de AGENT.md §11 ... */
  }$$::jsonb,
  1
)
on conflict (clinic_id) do nothing;

-- Servicios
insert into services (clinic_id, name, category, duration_minutes, requires_transfer) values
  ('00000000-0000-0000-0000-000000000001', 'Consulta general', 'consultation', 30, false),
  ('00000000-0000-0000-0000-000000000001', 'Vacunación', 'vaccine', 20, false),
  ('00000000-0000-0000-0000-000000000001', 'Revisión anual', 'consultation', 30, false),
  ('00000000-0000-0000-0000-000000000001', 'Peluquería - baño', 'grooming', 60, false),
  ('00000000-0000-0000-0000-000000000001', 'Peluquería - corte de pelo', 'grooming', 90, false),
  ('00000000-0000-0000-0000-000000000001', 'Peluquería - corte de uñas', 'grooming', 15, false),
  ('00000000-0000-0000-0000-000000000001', 'Test ADN', 'adn', 30, false),
  ('00000000-0000-0000-0000-000000000001', 'Implantación de chip', 'bureaucratic', 20, false),
  ('00000000-0000-0000-0000-000000000001', 'Pasaporte', 'bureaucratic', 30, false),
  ('00000000-0000-0000-0000-000000000001', 'Certificado de viaje', 'bureaucratic', 30, false),
  ('00000000-0000-0000-0000-000000000001', 'Cambio de nombre / titularidad', 'bureaucratic', 20, false)
on conflict do nothing;

-- Vincular usuario admin (REEMPLAZAR USER_UUID por el copiado en paso 9.1)
insert into clinic_users (clinic_id, user_id, role)
values (
  '00000000-0000-0000-0000-000000000001',
  'USER_UUID_AQUI',
  'admin'
)
on conflict (clinic_id, user_id) do nothing;
```

**IMPORTANTE:**
- Sustituir el `/* ... estructura completa ... */` por el JSON completo de AGENT.md §11.
- Sustituir `USER_UUID_AQUI` por el UUID del usuario creado en 9.1.

### 9.3 Aplicar el seed

```bash
cd ~/projects/recepia
# Doppler para tener SUPABASE_DB_URL si lo configuras, o usar el de supabase link
supabase db push --include-seed
# Alternativa: psql con la connection string
```

Si `supabase db push` no aplica el seed automáticamente, ejecutarlo manualmente desde Studio (SQL Editor) pegando el contenido de `seed.sql`.

### 9.4 Verificar

En Supabase Studio:
- Tabla `clinics`: 1 fila Dr. Patino.
- Tabla `clinic_config`: 1 fila con `config` no vacío.
- Tabla `services`: 11 filas.
- Tabla `clinic_users`: 1 fila vinculando al admin.

### 9.5 Criterio de "hecho"

- [ ] Las 4 tablas con datos correctos.
- [ ] Validar `clinic_config.config` parsea como JSON válido (Supabase Studio lo muestra formateado).

---

## Bloque 10 — Next.js: arrancar `apps/panel`

### 10.1 Crear la app

```bash
cd ~/projects/recepia/apps
pnpm dlx create-next-app@latest panel \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint
```

Esto crea `apps/panel/`. Decir **no** a "Use Turbopack" si pregunta (estabilidad).

### 10.2 Ajustar `apps/panel/package.json`

```json
{
  "name": "@recepia/panel",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@recepia/db": "workspace:*",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0"
  }
}
```

### 10.3 Ajustar `apps/panel/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "noEmit": true,
    "jsx": "preserve",
    "incremental": true
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

### 10.4 Instalar todo

```bash
cd ~/projects/recepia
pnpm install
```

### 10.5 Probar dev

```bash
pnpm with-env pnpm --filter @recepia/panel dev
```

Abrir `http://localhost:3000`. Debe verse la home de Next.js.

### 10.6 Criterio de "hecho"

- [ ] `pnpm --filter @recepia/panel dev` arranca sin errores.
- [ ] `http://localhost:3000` carga.

---

## Bloque 11 — shadcn/ui: inicializar

### 11.1 Init en `apps/panel`

```bash
cd ~/projects/recepia/apps/panel
pnpm dlx shadcn@latest init
```

Responder:
- Style: **Default**.
- Base color: **Slate**.
- CSS variables: **Yes**.

Acepta los defaults para alias.

### 11.2 Instalar componentes mínimos

```bash
pnpm dlx shadcn@latest add button input label card form sonner
```

### 11.3 Verificar

Aparecerán componentes en `apps/panel/src/components/ui/`.

### 11.4 Criterio de "hecho"

- [ ] Carpeta `src/components/ui/` con archivos `button.tsx`, `input.tsx`, etc.
- [ ] `pnpm --filter @recepia/panel dev` sigue corriendo sin errores.

---

## Bloque 12 — Cliente Supabase con `@supabase/ssr`

### 12.1 Crear `src/lib/supabase/server.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@recepia/db";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component sin permiso de cookies, ok
          }
        },
      },
    },
  );
}
```

### 12.2 Crear `src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@recepia/db";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

### 12.3 Crear `src/middleware.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 12.4 Criterio de "hecho"

- [ ] Los 3 archivos creados sin errores de TypeScript.
- [ ] `pnpm --filter @recepia/panel typecheck` pasa.

---

## Bloque 13 — Login con Magic Link

### 13.1 Configurar URL de redirect en Supabase

En Supabase Studio → **Authentication → URL Configuration**:
- Site URL: `http://localhost:3000` (cambiar a producción tras desplegar).
- Redirect URLs: añadir `http://localhost:3000/auth/callback` y (para producción) `https://recepia.iatope.com/auth/callback`.

### 13.2 Crear `src/app/login/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Recepia</CardTitle>
          <CardDescription>Accede con tu email</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-slate-700">
              Te hemos enviado un enlace de acceso a <strong>{email}</strong>.
              Revisa tu correo.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="tu@email.com"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Enviando..." : "Enviar enlace de acceso"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 13.3 Crear `src/app/auth/callback/route.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

### 13.4 Crear `src/app/page.tsx` (home autenticada)

```tsx
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lectura de prueba: la primera clínica accesible por RLS
  const { data: clinics } = await supabase
    .from("clinics")
    .select("id, name, slug")
    .limit(1);

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Recepia · Panel</h1>
          <form action={signOut}>
            <Button variant="outline" type="submit">Cerrar sesión</Button>
          </form>
        </div>
        <p className="text-sm text-slate-600">Conectado como <strong>{user.email}</strong></p>
        <div className="rounded-lg border bg-white p-6 space-y-2">
          <h2 className="font-medium">Clínica accesible</h2>
          {clinics && clinics.length > 0 ? (
            <pre className="text-sm bg-slate-50 p-3 rounded">{JSON.stringify(clinics[0], null, 2)}</pre>
          ) : (
            <p className="text-sm text-slate-500">Sin acceso a clínicas. Verifica vinculación en `clinic_users`.</p>
          )}
        </div>
      </div>
    </main>
  );
}
```

### 13.5 Probar el flujo

```bash
cd ~/projects/recepia
pnpm with-env pnpm --filter @recepia/panel dev
```

1. Abrir `http://localhost:3000`.
2. Te redirige a `/login`.
3. Introducir el email del admin que creaste en 9.1.
4. Recibir el Magic Link en el correo.
5. Pulsar el enlace.
6. Aterrizar en `/` autenticado, con el JSON de la clínica visible.

### 13.6 Si el email no llega

Supabase Free tiene un SMTP de demo con límites estrictos.

**Opciones:**

- **Opción A (rápida, sólo para test):** mantener SMTP de Supabase, comprobar Spam.
- **Opción B (recomendada para piloto):** configurar SMTP propio en Supabase Studio → Project Settings → Auth → SMTP. Proveedor sugerido: **Resend** (free tier 100 emails/día, plan Pro 3000/mes barato).

### 13.7 Criterio de "hecho"

- [ ] Magic Link funciona end-to-end localmente.
- [ ] Tras login, la home muestra el JSON de la clínica Dr. Patino.
- [ ] Cerrar sesión funciona.

---

## Bloque 14 — Vercel: desplegar `apps/panel`

### 14.1 Conectar repo a Vercel

1. Ir a `https://vercel.com/new`.
2. Importar `recepia-ai/recepia` desde GitHub.
3. **Root Directory:** `apps/panel`.
4. **Framework Preset:** Next.js (detectado automáticamente).
5. **Build Command:** dejar default.
6. **Output Directory:** dejar default.
7. NO desplegar todavía: añadir variables de entorno primero.

### 14.2 Integrar Doppler con Vercel

Opción más limpia: integración nativa Doppler → Vercel.

1. En Doppler → Integrations → Vercel.
2. Autorizar.
3. Vincular proyecto `recepia` config `prd` al proyecto Vercel `recepia`.

Si la integración no encaja, alternativa manual:

1. En Doppler `prd`, descarga `.env`: `doppler secrets download --no-file --format env`.
2. En Vercel → Project Settings → Environment Variables, copiar manualmente.

### 14.3 Desplegar

En Vercel, pulsar **Deploy**. Esperar 2-3 min.

### 14.4 Probar URL pública

Vercel asigna automáticamente `recepia-xxxx.vercel.app`.

1. Abrir.
2. Te redirige a `/login`.
3. Probar Magic Link con el email del admin.
4. **Importante:** antes de probar, actualizar Site URL y Redirect URLs en Supabase Auth con la URL de Vercel:
   - Site URL: `https://recepia-xxxx.vercel.app`
   - Redirect: `https://recepia-xxxx.vercel.app/auth/callback`

### 14.5 (Opcional) Subdominio `recepia.iatope.com`

1. En Vercel → Project → Settings → Domains, añadir `recepia.iatope.com`.
2. En Raiola (donde está `iatope.com`), añadir registro CNAME apuntando a `cname.vercel-dns.com`.
3. Esperar propagación.
4. Actualizar Site URL y Redirect en Supabase.

### 14.6 Criterio de "hecho"

- [ ] Vercel deploy en verde.
- [ ] URL pública funcional con login.
- [ ] Tras login, JSON de la clínica visible.

---

## Bloque 15 — Validación final de la Semana 1

Checklist completo. **Solo cuando todos los checks pasen**, la Semana 1 está cerrada.

### Infraestructura

- [ ] Repo `recepia-ai/recepia` accesible en GitHub.
- [ ] Monorepo arranca con `pnpm install` sin errores.
- [ ] `pnpm turbo build` pasa para todos los workspaces.
- [ ] `pnpm format` pasa.
- [ ] `pnpm typecheck` pasa.

### Base de datos

- [ ] 15 tablas creadas en Supabase con RLS activa.
- [ ] Vistas `v_today_appointments` y `v_active_conversations` existen.
- [ ] Clínica Dr. Patino seedeada con `clinic_config` completo (no `{}`).
- [ ] 11 servicios en `services`.
- [ ] Usuario admin en `auth.users` + vinculado en `clinic_users` con rol `admin`.

### Secretos

- [ ] Todas las variables en Doppler config `prd`.
- [ ] Integración Doppler ↔ Vercel sincronizando, o variables copiadas manualmente.
- [ ] `.env*` NO commiteado al repo.

### Panel

- [ ] `apps/panel` arranca local en `http://localhost:3000`.
- [ ] Magic Link login funciona en local.
- [ ] Magic Link login funciona en Vercel.
- [ ] Tras login, página home muestra JSON de la clínica del admin (lo que prueba que RLS funciona).
- [ ] Logout funciona.

### Documentación

- [ ] `docs/` contiene PROJECT.md, SCHEMA.md, AGENT.md, ROADMAP.md, SETUP.md.

---

## Resolución de problemas comunes

### "Cannot find module '@recepia/db'"

```bash
cd ~/projects/recepia
pnpm install
# Si persiste:
rm -rf node_modules apps/panel/node_modules packages/db/node_modules
pnpm install
```

### "Invalid JWT" tras login

El JWT secret cambió o las cookies están corruptas. Borrar cookies del navegador para el dominio y volver a login.

### `supabase db push` falla por permisos

Reintentar `supabase login` y luego `supabase link --project-ref TU_REF`.

### Magic Link no llega

- Comprobar Spam.
- Configurar SMTP propio (Resend) en Supabase Auth si Supabase Free está rate-limited.

### Vercel no tiene las variables

Forzar redespliegue tras añadir variables: cambiar en Doppler dispara webhook a Vercel si la integración está activa. Si no, redespliegue manual desde el dashboard.

### Tipos de Supabase no se generan

```bash
supabase login
supabase link --project-ref TU_REF
pnpm --filter @recepia/db gen:types
```

---

## Decisiones que se cierran al ejecutar este setup

| Tema | Decisión final |
|---|---|
| Versión de Node | 22 LTS |
| Versión de pnpm | 10 |
| Gestor de paquetes | pnpm workspaces |
| Build orchestrator | Turborepo 2.x |
| Linter / formatter | Biome 2.x |
| TypeScript | 5.5+ |
| Cliente Supabase | `@supabase/ssr` para Next.js App Router |
| Estilo de auth | Magic Link, sin password |
| Email transactional | Supabase default → migrar a Resend en piloto |
| Dominio dev | `recepia.iatope.com` (subdominio del que controla Marc) |
| Doppler configs | `dev` y `prd` por ahora; `stg` cuando haya tráfico |

---

## Qué sigue tras cerrar Bloque 15

Una vez todos los checks de la sección "Validación final" pasen, has cerrado la **Semana 1** del ROADMAP. Lo que viene en Semana 2:

- 360dialog: solicitar número WhatsApp Business del Dr. Patino.
- Edge Function `whatsapp_inbound` que recibe mensajes y los persiste.
- Edge Function `whatsapp_outbound` que envía vía 360dialog.
- Motor de carga de `clinic_config` con Zod en `packages/core`.
- Página `/conversations` (lectura) en el panel.

Estos pasos vivirán en un futuro `SETUP-WEEK2.md` cuando los abordemos.

---

## Cambios

| Fecha | Versión | Autor | Cambio |
|---|---|---|---|
| 2026-06-10 | 0.1 | Marc + Claude | Documento inicial. |
