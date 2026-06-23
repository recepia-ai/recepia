# Recepia

Recepcionista virtual veterinaria con IA. Plataforma SaaS multi-tenant.

## Documentacion

- docs/PROJECT.md
- docs/SCHEMA.md
- docs/AGENT.md
- docs/ROADMAP.md
- docs/SETUP.md
- docs/LEGAL.md
- docs/PROMPTS.md

## Estructura

- apps/panel: Next.js, panel web
- packages/core: logica del agente, tools, tipos compartidos
- packages/db: cliente Supabase y tipos generados
- packages/ui: componentes compartidos
- supabase: migraciones y Edge Functions
- docs: documentacion del proyecto

## Desarrollo

    pnpm install
    pnpm dev

## Database migrations & types

Cuando aplicas una migración a Supabase (vía `psql` o `pnpm db:push`), después regenera los types con:

    pnpm db:gen-types

Esto sobreescribe `packages/db/src/types.gen.ts` con la definición real desde la DB. Requiere tener el Supabase CLI instalado y linkado al proyecto remoto (`supabase link --project-ref vsnrlpfsgwwdmiyndwnl`).

**NO edites `types.gen.ts` manualmente.** Si los tipos fallan en algún query, primero verifica que la DB tiene los campos esperados y luego regenera.
