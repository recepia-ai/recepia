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
