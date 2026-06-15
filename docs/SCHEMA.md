# RECEPIA — SCHEMA.md

> Modelo de datos completo. Versión 0.1 — junio 2026.
>
> Este documento define todas las tablas, relaciones, índices, políticas RLS y triggers del sistema. La sección final contiene la migración SQL lista para aplicar.

---

## 1. Visión general

Recepia es **multi-tenant por diseño**: toda tabla con datos operativos lleva `clinic_id` y RLS activada. El aislamiento es lógico (no físico), suficiente para MVP y para producción inicial.

### 1.1 Dominios

El schema se organiza en cinco dominios:

1. **Tenant y configuración** — `clinics`, `clinic_users`, `clinic_config`, `clinic_config_history`, `clinic_channels`, `clinic_integrations`.
2. **CRM** — `clients`, `pets`, `services`.
3. **Conversaciones** — `conversations`, `messages`, `conversation_summaries`.
4. **Agenda** — `appointments`.
5. **Auditoría** — `tool_invocations`, `events`.

### 1.2 Diagrama lógico (resumen)

```
auth.users ──┐
             │
             ▼
       clinic_users ──────► clinics ◄──── clinic_config
                              │             clinic_config_history
                              │             clinic_channels
                              │             clinic_integrations
                              │
                              ├──► clients ──► pets
                              │      │
                              │      ▼
                              ├──► conversations ──► messages
                              │      │              conversation_summaries
                              │      │              tool_invocations
                              │      ▼
                              └──► appointments ──► services

                              events (transversal, FK a clinic_id y conversation_id)
```

---

## 2. Convenciones

- **PKs**: `uuid` generadas con `gen_random_uuid()`.
- **Timestamps**: `created_at` y `updated_at` en todas las tablas, con trigger automático para `updated_at`.
- **Borrado**: soft delete (`deleted_at`) en tablas con datos sensibles del cliente final (`clients`, `pets`, `conversations`). El resto, borrado físico.
- **Naming**: `snake_case`, plurales para tablas (`clients`, no `client`).
- **Enums**: tipos PostgreSQL nativos, prefijo del dominio si hay colisión (`conversation_status`, `appointment_status`).
- **JSONB**: para configuración flexible y metadatos. Nunca para datos relacionales primarios.
- **Índices**: siempre sobre `clinic_id` en tablas con RLS por clínica, más índices específicos por columna de consulta frecuente.
- **Foreign keys**:
  - `ON DELETE CASCADE` para hijos lógicos (un `pet` se borra si se borra su `client`).
  - `ON DELETE SET NULL` para referencias laterales (una `conversation` no se borra si se borra una `pet`).
  - `ON DELETE RESTRICT` por defecto si hay duda.

---

## 3. Tipos enum

```sql
-- Estado de clínica
create type clinic_status as enum ('active', 'suspended', 'archived');

-- Rol del usuario dentro de una clínica
create type clinic_user_role as enum ('admin', 'recepcion', 'veterinario');

-- Canal de comunicación
create type channel_type as enum ('whatsapp', 'phone', 'web');

-- Estado de un canal configurado
create type channel_status as enum ('active', 'paused', 'error', 'pending_verification');

-- Tipo de integración externa
create type integration_type as enum (
  'google_calendar',
  'qvet',
  'vetesoft',
  'cliniccloud',
  'geclisa',
  'other'
);

-- Estado de integración
create type integration_status as enum ('active', 'paused', 'error', 'pending_oauth');

-- Especies de mascotas (incluye 'exotic' para regla de transferencia/rechazo)
create type pet_species as enum (
  'dog', 'cat', 'rabbit', 'ferret', 'rodent',
  'bird', 'reptile', 'fish', 'exotic', 'other'
);

create type pet_sex as enum ('male', 'female', 'unknown');

-- Categorías de servicio (catálogo por clínica)
create type service_category as enum (
  'consultation',
  'vaccine',
  'surgery',
  'grooming',
  'adn',
  'bureaucratic',
  'diagnostic',
  'other'
);

-- Estado de conversación
create type conversation_status as enum (
  'active',           -- agente está atendiendo
  'awaiting_human',   -- esperando intervención humana
  'human_handling',   -- humano ha tomado control
  'completed',        -- cerrada con éxito
  'transferred',      -- transferida (telefonía) o derivada
  'abandoned'         -- cliente abandonó sin resolver
);

-- Categoría de la conversación (clasificación IA)
create type conversation_category as enum (
  'cita',
  'urgencia',
  'vacunacion',
  'peluqueria',
  'hospitalizacion',
  'medicacion',
  'receta',
  'informe',
  'administracion',
  'informacion_general'
);

-- Urgencia detectada
create type urgency_level as enum ('low', 'medium', 'high', 'critical');

-- Origen del mensaje
create type message_direction as enum ('inbound', 'outbound');
create type message_sender as enum ('client', 'agent', 'human', 'system');
create type message_content_type as enum (
  'text', 'audio', 'image', 'document',
  'system_event', 'tool_call', 'tool_result'
);

-- Estado de cita
create type appointment_status as enum (
  'scheduled', 'confirmed', 'cancelled', 'no_show', 'completed'
);
```

---

## 4. Funciones helper

Estas funciones se usan en políticas RLS y en lógica de aplicación.

```sql
-- IDs de las clínicas del usuario autenticado
create or replace function public.user_clinic_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id
  from clinic_users
  where user_id = auth.uid();
$$;

-- ¿El usuario tiene alguno de los roles indicados en la clínica?
create or replace function public.user_has_role_in_clinic(
  p_clinic_id uuid,
  p_roles clinic_user_role[]
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from clinic_users
    where clinic_id = p_clinic_id
      and user_id = auth.uid()
      and role = any(p_roles)
  );
$$;

-- Trigger genérico de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

---

## 5. Tablas

### 5.1 Dominio: Tenant y configuración

#### `clinics`

Una fila por clínica cliente.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| name | text NOT NULL | Nombre comercial |
| slug | text UNIQUE NOT NULL | Usado en URLs internas |
| timezone | text DEFAULT 'Europe/Madrid' | IANA timezone |
| locale | text DEFAULT 'es-ES' | BCP 47 |
| status | clinic_status DEFAULT 'active' | |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

#### `clinic_users`

Relación N:M entre usuarios de Supabase Auth y clínicas, con rol.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | |
| user_id | uuid FK → auth.users(id) ON DELETE CASCADE | |
| role | clinic_user_role NOT NULL | |
| created_at | timestamptz | |
| UNIQUE | (clinic_id, user_id) | Un usuario tiene un único rol por clínica |

#### `clinic_config`

Configuración operativa actual de cada clínica. **Una fila por clínica** (1:1). Estructura del JSONB definida en `AGENT.md`.

| Columna | Tipo | Notas |
|---|---|---|
| clinic_id | uuid PK FK → clinics(id) ON DELETE CASCADE | |
| config | jsonb NOT NULL | Estructura validada por código TS/Zod |
| version | int NOT NULL DEFAULT 1 | Incrementa con cada update |
| updated_by | uuid FK → auth.users(id) NULL | |
| updated_at | timestamptz DEFAULT now() | |

#### `clinic_config_history`

Snapshot histórico de configuraciones anteriores. Permite auditar y revertir.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | |
| config | jsonb NOT NULL | Snapshot completo |
| version | int NOT NULL | |
| updated_by | uuid FK → auth.users(id) NULL | |
| created_at | timestamptz DEFAULT now() | |
| UNIQUE | (clinic_id, version) | |

#### `clinic_channels`

Canales de comunicación de cada clínica (números de WhatsApp y, en Iteración 2, teléfono).

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | |
| channel_type | channel_type NOT NULL | |
| identifier | text NOT NULL | Número E.164 |
| provider | text NOT NULL | `'360dialog'`, `'twilio'`, `'vapi'`... |
| provider_config | jsonb DEFAULT '{}' | Referencias a secretos, no secretos en sí |
| status | channel_status DEFAULT 'pending_verification' | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| UNIQUE | (channel_type, identifier) | Un mismo número no se duplica entre clínicas |

#### `clinic_integrations`

Integraciones externas (Google Calendar, futuros softwares vet).

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | |
| integration_type | integration_type NOT NULL | |
| credentials | jsonb DEFAULT '{}' | Tokens OAuth — encriptar con Supabase Vault en producción |
| config | jsonb DEFAULT '{}' | Mapeos de calendarios, IDs externos, etc. |
| status | integration_status DEFAULT 'pending_oauth' | |
| last_synced_at | timestamptz NULL | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| UNIQUE | (clinic_id, integration_type) | Una integración de cada tipo por clínica |

---

### 5.2 Dominio: CRM

#### `clients`

Propietarios de mascotas. Identificados unívocamente por (clinic_id, phone).

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | |
| phone | text NOT NULL | E.164 |
| email | text NULL | |
| full_name | text NULL | Puede no conocerse en primer contacto |
| preferred_language | text DEFAULT 'es' | |
| notes | text NULL | Notas internas del personal |
| metadata | jsonb DEFAULT '{}' | Campos extra (referido, tags, etc.) |
| deleted_at | timestamptz NULL | Soft delete |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| UNIQUE | (clinic_id, phone) WHERE deleted_at IS NULL | |

#### `pets`

Mascotas asociadas a un cliente.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | |
| client_id | uuid FK → clients(id) ON DELETE CASCADE | |
| name | text NOT NULL | |
| species | pet_species NOT NULL | `'exotic'` dispara reglas de transferencia/rechazo |
| breed | text NULL | |
| birth_date | date NULL | |
| sex | pet_sex DEFAULT 'unknown' | |
| chip_number | text NULL | |
| notes | text NULL | |
| metadata | jsonb DEFAULT '{}' | |
| active | boolean DEFAULT true | False si fallecida o trasladada |
| deleted_at | timestamptz NULL | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `services`

Catálogo de servicios ofrecidos por cada clínica.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | |
| name | text NOT NULL | |
| category | service_category NOT NULL | |
| duration_minutes | int NOT NULL DEFAULT 30 | |
| requires_transfer | boolean DEFAULT false | True si agendar siempre requiere humano |
| price_estimate | numeric(10,2) NULL | Solo informativo, no se factura desde aquí |
| active | boolean DEFAULT true | |
| metadata | jsonb DEFAULT '{}' | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### 5.3 Dominio: Conversaciones

#### `conversations`

Un hilo de comunicación unificado, sea WhatsApp o (futuro) teléfono.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | |
| client_id | uuid FK → clients(id) ON DELETE SET NULL | Puede iniciarse sin cliente conocido |
| pet_id | uuid FK → pets(id) ON DELETE SET NULL | Idem |
| channel | channel_type NOT NULL | |
| channel_thread_id | text NULL | ID del proveedor (wa_id, call_sid) |
| status | conversation_status DEFAULT 'active' | |
| category | conversation_category NULL | Clasificación IA |
| urgency_level | urgency_level NULL | |
| assigned_to | uuid FK → auth.users(id) ON DELETE SET NULL | Cuando humano toma control |
| started_at | timestamptz DEFAULT now() | |
| ended_at | timestamptz NULL | |
| metadata | jsonb DEFAULT '{}' | Provider-specific extras |
| deleted_at | timestamptz NULL | Soft delete |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `messages`

Mensajes individuales dentro de una conversación. **El `clinic_id` se denormaliza para que RLS sea rápido sin JOIN.**

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| conversation_id | uuid FK → conversations(id) ON DELETE CASCADE | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | Denormalizado |
| direction | message_direction NOT NULL | |
| sender | message_sender NOT NULL | |
| sender_user_id | uuid FK → auth.users(id) ON DELETE SET NULL | Solo cuando sender='human' |
| content | text NULL | Texto del mensaje |
| content_type | message_content_type DEFAULT 'text' | |
| attachments | jsonb DEFAULT '[]' | URLs de audios, imágenes, etc. |
| provider_message_id | text NULL | ID del proveedor (WhatsApp message_id) |
| created_at | timestamptz DEFAULT now() | |

#### `conversation_summaries`

Resumen estructurado IA al cerrar conversación. 1:1 con `conversations`.

| Columna | Tipo | Notas |
|---|---|---|
| conversation_id | uuid PK FK → conversations(id) ON DELETE CASCADE | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | Denormalizado |
| summary | jsonb NOT NULL | Ver esquema en `AGENT.md` |
| model_used | text NULL | Ej. `'deepseek-chat'` |
| created_at | timestamptz DEFAULT now() | |

Estructura indicativa del JSONB `summary` (definida en `AGENT.md`):

```json
{
  "client_name": "Juan García",
  "pet_name": "Toby",
  "pet_species": "dog",
  "reason": "Cojera pata trasera izquierda",
  "outcome": "Cita creada 2026-06-12 17:00",
  "category": "cita",
  "urgency": "medium",
  "follow_up_required": false,
  "key_points": ["..."]
}
```

---

### 5.4 Dominio: Agenda

#### `appointments`

Citas creadas en la clínica.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | |
| conversation_id | uuid FK → conversations(id) ON DELETE SET NULL | La que la generó |
| client_id | uuid FK → clients(id) ON DELETE RESTRICT | No se borra un cliente con citas |
| pet_id | uuid FK → pets(id) ON DELETE SET NULL | |
| service_id | uuid FK → services(id) ON DELETE SET NULL | |
| starts_at | timestamptz NOT NULL | |
| ends_at | timestamptz NOT NULL | |
| status | appointment_status DEFAULT 'scheduled' | |
| notes | text NULL | |
| external_calendar_event_id | text NULL | ID en Google Calendar |
| metadata | jsonb DEFAULT '{}' | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### 5.5 Dominio: Auditoría

#### `tool_invocations`

Cada vez que el agente IA invoca una tool, queda registrada.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| conversation_id | uuid FK → conversations(id) ON DELETE CASCADE | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | |
| tool_name | text NOT NULL | Ej. `'crear_cita'` |
| input | jsonb NOT NULL | Args con los que se llamó |
| output | jsonb NULL | Resultado |
| success | boolean NOT NULL | |
| error_code | text NULL | |
| error_message | text NULL | |
| duration_ms | int NULL | |
| created_at | timestamptz DEFAULT now() | |

#### `events`

Eventos de negocio para auditoría y futuras estadísticas. Tabla append-only.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK → clinics(id) ON DELETE CASCADE | |
| conversation_id | uuid FK → conversations(id) ON DELETE SET NULL | NULL si no aplica |
| event_type | text NOT NULL | Ej. `'appointment.created'`, `'conversation.transferred'` |
| actor_type | text NULL | `'agent'`, `'human'`, `'system'`, `'client'` |
| actor_id | uuid NULL | user_id si actor='human' |
| payload | jsonb DEFAULT '{}' | |
| created_at | timestamptz DEFAULT now() | |

---

### 5.6 Telefonía (Iteración 2 — schema preparado, tabla diferida)

Cuando llegue Iteración 2, se añade:

```sql
-- Diferido hasta Iteración 2
create table call_metadata (
  conversation_id uuid primary key references conversations(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  provider text not null,                     -- 'vapi'
  provider_call_id text not null,
  caller_phone text not null,
  duration_seconds int null,
  recording_url text null,
  transcript_url text null,
  cost_usd numeric(10,4) null,
  created_at timestamptz default now()
);
create index on call_metadata(clinic_id);
create unique index on call_metadata(provider, provider_call_id);
```

No se aplica en migración inicial.

---

## 6. Índices

Más allá de los implícitos (PKs y UNIQUE), se crean explícitamente:

```sql
-- Multi-tenancy: índice por clinic_id en todas las tablas tenant-scoped
create index on clinic_users(clinic_id);
create index on clinic_users(user_id);
create index on clinic_channels(clinic_id);
create index on clinic_integrations(clinic_id);
create index on clients(clinic_id);
create index on pets(clinic_id);
create index on pets(client_id);
create index on services(clinic_id);
create index on conversations(clinic_id);
create index on conversations(client_id);
create index on messages(clinic_id);
create index on messages(conversation_id, created_at);
create index on conversation_summaries(clinic_id);
create index on appointments(clinic_id);
create index on appointments(starts_at);
create index on tool_invocations(clinic_id);
create index on tool_invocations(conversation_id);
create index on events(clinic_id, created_at desc);
create index on events(conversation_id);

-- Búsqueda por teléfono del cliente (caso de uso: identificar al llamar)
create index on clients(clinic_id, phone) where deleted_at is null;

-- Búsqueda full-text en mensajes (para "buscar Toby")
create index on messages using gin (to_tsvector('spanish', coalesce(content, '')));

-- Citas próximas (vista del día)
create index on appointments(clinic_id, starts_at) where status in ('scheduled', 'confirmed');
```

---

## 7. RLS (Row-Level Security)

### 7.1 Principio

- Todas las tablas con `clinic_id` tienen RLS habilitada.
- Las Edge Functions usan **service role key** (bypasea RLS) pero **siempre pasan `clinic_id` explícito** en cada query.
- El cliente Supabase del panel web usa el JWT del usuario, sujeto a RLS.

### 7.2 Patrón estándar de políticas

Para cada tabla `T` con `clinic_id`:

```sql
alter table T enable row level security;

-- SELECT: miembros de la clínica pueden ver
create policy "members can read"
  on T for select
  using (clinic_id in (select user_clinic_ids()));

-- INSERT: miembros pueden crear si el clinic_id es uno de los suyos
create policy "members can insert"
  on T for insert
  with check (clinic_id in (select user_clinic_ids()));

-- UPDATE: miembros pueden actualizar (refinable por rol)
create policy "members can update"
  on T for update
  using (clinic_id in (select user_clinic_ids()))
  with check (clinic_id in (select user_clinic_ids()));

-- DELETE: solo admin (caso a caso)
create policy "admin can delete"
  on T for delete
  using (
    user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[])
  );
```

### 7.3 Excepciones por tabla

- **`clinics`**: solo lectura del registro propio. No se inserta desde cliente (siempre desde service role / wizard de admin Recepia).
- **`clinic_users`**: lectura abierta a miembros de la clínica. INSERT/UPDATE/DELETE solo por `admin`.
- **`clinic_config`** y **`clinic_config_history`**: lectura abierta a miembros, UPDATE solo `admin`.
- **`appointments`**: todos los roles pueden CRUD.
- **`messages`** y **`conversations`**: todos los roles pueden leer. INSERT desde cliente solo para `sender='human'` (la IA escribe desde service role).
- **`tool_invocations`** y **`events`**: lectura para miembros, **sin INSERT/UPDATE/DELETE desde el cliente** (solo service role).

---

## 8. Triggers

### 8.1 `updated_at` automático

Aplicar a todas las tablas con `updated_at`:

```sql
create trigger set_updated_at_X
before update on X
for each row execute function set_updated_at();
```

### 8.2 Historial de `clinic_config`

Cada vez que se actualiza `clinic_config`, se guarda snapshot en `clinic_config_history`:

```sql
create or replace function archive_clinic_config()
returns trigger
language plpgsql
as $$
begin
  if old.config is distinct from new.config then
    insert into clinic_config_history (clinic_id, config, version, updated_by)
    values (old.clinic_id, old.config, old.version, old.updated_by);
    new.version = old.version + 1;
  end if;
  return new;
end;
$$;

create trigger archive_clinic_config_before_update
before update on clinic_config
for each row execute function archive_clinic_config();
```

### 8.3 Denormalización de `clinic_id` en `messages`

Para evitar errores, el `clinic_id` de `messages` se rellena automáticamente del de `conversations`:

```sql
create or replace function set_message_clinic_id()
returns trigger
language plpgsql
as $$
begin
  if new.clinic_id is null then
    select clinic_id into new.clinic_id
    from conversations where id = new.conversation_id;
  end if;
  return new;
end;
$$;

create trigger set_message_clinic_id_before_insert
before insert on messages
for each row execute function set_message_clinic_id();
```

Mismo patrón para `tool_invocations` y `conversation_summaries`.

---

## 9. Vistas útiles

### 9.1 `v_today_appointments`

Citas de hoy por clínica:

```sql
create or replace view v_today_appointments as
select
  a.*,
  c.full_name as client_name,
  c.phone as client_phone,
  p.name as pet_name,
  p.species as pet_species,
  s.name as service_name
from appointments a
left join clients c on c.id = a.client_id
left join pets p on p.id = a.pet_id
left join services s on s.id = a.service_id
where a.starts_at::date = current_date
  and a.status in ('scheduled', 'confirmed');
```

### 9.2 `v_active_conversations`

Conversaciones en curso o esperando humano:

```sql
create or replace view v_active_conversations as
select
  conv.*,
  c.full_name as client_name,
  c.phone as client_phone,
  p.name as pet_name,
  (select count(*) from messages m where m.conversation_id = conv.id) as message_count,
  (select max(created_at) from messages m where m.conversation_id = conv.id) as last_message_at
from conversations conv
left join clients c on c.id = conv.client_id
left join pets p on p.id = conv.pet_id
where conv.status in ('active', 'awaiting_human', 'human_handling')
  and conv.deleted_at is null;
```

---

## 10. Datos seed iniciales (Dr. Patiño)

Tras aplicar la migración inicial, se ejecuta un script de seed con:

1. `clinic` Dr. Patiño.
2. `clinic_config` con las reglas del brief (horarios por servicio, transferencias, ventana Samuel/María, no exóticos).
3. `services` del catálogo del hospital.
4. Usuario admin de la clínica.

El script de seed se documenta en detalle en `AGENT.md` porque incluye la estructura completa de `clinic_config`. Aquí solo dejamos el esqueleto:

```sql
-- Seed mínimo (estructura completa en AGENT.md)
insert into clinics (id, name, slug, timezone)
values (
  '00000000-0000-0000-0000-000000000001',
  'Hospital Veterinario Dr. Patiño',
  'dr-patino',
  'Europe/Madrid'
);

insert into clinic_config (clinic_id, config)
values (
  '00000000-0000-0000-0000-000000000001',
  '{}'::jsonb  -- estructura completa en AGENT.md
);
```

---

## 11. Migración SQL inicial (lista para aplicar)

Esta es la migración completa. Guardar como `supabase/migrations/20260610_000000_initial_schema.sql` y aplicar con `supabase db push`.

```sql
--------------------------------------------------------------------
-- Recepia — Migración inicial (v0.1, 2026-06-10)
--------------------------------------------------------------------

-- Extensiones
create extension if not exists "pgcrypto";

-- ENUMS
create type clinic_status as enum ('active', 'suspended', 'archived');
create type clinic_user_role as enum ('admin', 'recepcion', 'veterinario');
create type channel_type as enum ('whatsapp', 'phone', 'web');
create type channel_status as enum ('active', 'paused', 'error', 'pending_verification');
create type integration_type as enum (
  'google_calendar', 'qvet', 'vetesoft', 'cliniccloud', 'geclisa', 'other'
);
create type integration_status as enum ('active', 'paused', 'error', 'pending_oauth');
create type pet_species as enum (
  'dog', 'cat', 'rabbit', 'ferret', 'rodent',
  'bird', 'reptile', 'fish', 'exotic', 'other'
);
create type pet_sex as enum ('male', 'female', 'unknown');
create type service_category as enum (
  'consultation', 'vaccine', 'surgery', 'grooming', 'adn',
  'bureaucratic', 'diagnostic', 'other'
);
create type conversation_status as enum (
  'active', 'awaiting_human', 'human_handling',
  'completed', 'transferred', 'abandoned'
);
create type conversation_category as enum (
  'cita', 'urgencia', 'vacunacion', 'peluqueria', 'hospitalizacion',
  'medicacion', 'receta', 'informe', 'administracion', 'informacion_general'
);
create type urgency_level as enum ('low', 'medium', 'high', 'critical');
create type message_direction as enum ('inbound', 'outbound');
create type message_sender as enum ('client', 'agent', 'human', 'system');
create type message_content_type as enum (
  'text', 'audio', 'image', 'document',
  'system_event', 'tool_call', 'tool_result'
);
create type appointment_status as enum (
  'scheduled', 'confirmed', 'cancelled', 'no_show', 'completed'
);

-- FUNCIONES HELPER
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.user_clinic_ids()
returns setof uuid
language sql stable security definer
set search_path = public as $$
  select clinic_id from clinic_users where user_id = auth.uid();
$$;

create or replace function public.user_has_role_in_clinic(
  p_clinic_id uuid,
  p_roles clinic_user_role[]
) returns boolean
language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from clinic_users
    where clinic_id = p_clinic_id
      and user_id = auth.uid()
      and role = any(p_roles)
  );
$$;

-- TABLA: clinics
create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  timezone text not null default 'Europe/Madrid',
  locale text not null default 'es-ES',
  status clinic_status not null default 'active',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at_clinics
before update on clinics for each row execute function set_updated_at();

-- TABLA: clinic_users
create table clinic_users (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role clinic_user_role not null,
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);
create index on clinic_users(clinic_id);
create index on clinic_users(user_id);

-- TABLA: clinic_config
create table clinic_config (
  clinic_id uuid primary key references clinics(id) on delete cascade,
  config jsonb not null default '{}',
  version int not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- TABLA: clinic_config_history
create table clinic_config_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  config jsonb not null,
  version int not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (clinic_id, version)
);
create index on clinic_config_history(clinic_id);

-- Trigger: archivar config al actualizar
create or replace function archive_clinic_config()
returns trigger language plpgsql as $$
begin
  if old.config is distinct from new.config then
    insert into clinic_config_history (clinic_id, config, version, updated_by)
    values (old.clinic_id, old.config, old.version, old.updated_by);
    new.version = old.version + 1;
    new.updated_at = now();
  end if;
  return new;
end;
$$;
create trigger archive_clinic_config_before_update
before update on clinic_config
for each row execute function archive_clinic_config();

-- TABLA: clinic_channels
create table clinic_channels (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  channel_type channel_type not null,
  identifier text not null,
  provider text not null,
  provider_config jsonb not null default '{}',
  status channel_status not null default 'pending_verification',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_type, identifier)
);
create index on clinic_channels(clinic_id);
create trigger set_updated_at_clinic_channels
before update on clinic_channels for each row execute function set_updated_at();

-- TABLA: clinic_integrations
create table clinic_integrations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  integration_type integration_type not null,
  credentials jsonb not null default '{}',
  config jsonb not null default '{}',
  status integration_status not null default 'pending_oauth',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, integration_type)
);
create index on clinic_integrations(clinic_id);
create trigger set_updated_at_clinic_integrations
before update on clinic_integrations for each row execute function set_updated_at();

-- TABLA: clients
create table clients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  phone text not null,
  email text,
  full_name text,
  preferred_language text not null default 'es',
  notes text,
  metadata jsonb not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_clinic_phone_unique
  on clients(clinic_id, phone) where deleted_at is null;
create index on clients(clinic_id);
create trigger set_updated_at_clients
before update on clients for each row execute function set_updated_at();

-- TABLA: pets
create table pets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  species pet_species not null,
  breed text,
  birth_date date,
  sex pet_sex not null default 'unknown',
  chip_number text,
  notes text,
  metadata jsonb not null default '{}',
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on pets(clinic_id);
create index on pets(client_id);
create trigger set_updated_at_pets
before update on pets for each row execute function set_updated_at();

-- TABLA: services
create table services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  category service_category not null,
  duration_minutes int not null default 30,
  requires_transfer boolean not null default false,
  price_estimate numeric(10,2),
  active boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on services(clinic_id);
create trigger set_updated_at_services
before update on services for each row execute function set_updated_at();

-- TABLA: conversations
create table conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  pet_id uuid references pets(id) on delete set null,
  channel channel_type not null,
  channel_thread_id text,
  status conversation_status not null default 'active',
  category conversation_category,
  urgency_level urgency_level,
  assigned_to uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on conversations(clinic_id);
create index on conversations(client_id);
create index on conversations(status);
create trigger set_updated_at_conversations
before update on conversations for each row execute function set_updated_at();

-- TABLA: messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  direction message_direction not null,
  sender message_sender not null,
  sender_user_id uuid references auth.users(id) on delete set null,
  content text,
  content_type message_content_type not null default 'text',
  attachments jsonb not null default '[]',
  provider_message_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on messages(clinic_id);
create index on messages(conversation_id, created_at);
create index on messages using gin (to_tsvector('spanish', coalesce(content, '')));

-- Trigger: denormalizar clinic_id en messages
create or replace function set_message_clinic_id()
returns trigger language plpgsql as $$
begin
  if new.clinic_id is null then
    select clinic_id into new.clinic_id
    from conversations where id = new.conversation_id;
  end if;
  return new;
end;
$$;
create trigger set_message_clinic_id_before_insert
before insert on messages for each row execute function set_message_clinic_id();

-- TABLA: conversation_summaries
create table conversation_summaries (
  conversation_id uuid primary key references conversations(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  summary jsonb not null,
  model_used text,
  created_at timestamptz not null default now()
);
create index on conversation_summaries(clinic_id);

-- TABLA: appointments
create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  client_id uuid not null references clients(id) on delete restrict,
  pet_id uuid references pets(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'scheduled',
  notes text,
  external_calendar_event_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on appointments(clinic_id);
create index on appointments(starts_at);
create index on appointments(clinic_id, starts_at)
  where status in ('scheduled', 'confirmed');
create trigger set_updated_at_appointments
before update on appointments for each row execute function set_updated_at();

-- TABLA: tool_invocations
create table tool_invocations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  tool_name text not null,
  input jsonb not null,
  output jsonb,
  success boolean not null,
  error_code text,
  error_message text,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index on tool_invocations(clinic_id);
create index on tool_invocations(conversation_id);

-- TABLA: events
create table events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  event_type text not null,
  actor_type text,
  actor_id uuid,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on events(clinic_id, created_at desc);
create index on events(conversation_id);
create index on events(event_type);

--------------------------------------------------------------------
-- RLS — Row Level Security
--------------------------------------------------------------------

-- Habilitar RLS en todas las tablas tenant-scoped
alter table clinics enable row level security;
alter table clinic_users enable row level security;
alter table clinic_config enable row level security;
alter table clinic_config_history enable row level security;
alter table clinic_channels enable row level security;
alter table clinic_integrations enable row level security;
alter table clients enable row level security;
alter table pets enable row level security;
alter table services enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table conversation_summaries enable row level security;
alter table appointments enable row level security;
alter table tool_invocations enable row level security;
alter table events enable row level security;

-- clinics: solo lectura del registro propio
create policy clinics_read on clinics for select
  using (id in (select user_clinic_ids()));

-- clinic_users
create policy clinic_users_read on clinic_users for select
  using (clinic_id in (select user_clinic_ids()));
create policy clinic_users_admin_write on clinic_users for all
  using (user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[]))
  with check (user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[]));

-- clinic_config
create policy clinic_config_read on clinic_config for select
  using (clinic_id in (select user_clinic_ids()));
create policy clinic_config_admin_update on clinic_config for update
  using (user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[]))
  with check (user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[]));

-- clinic_config_history
create policy clinic_config_history_read on clinic_config_history for select
  using (clinic_id in (select user_clinic_ids()));

-- clinic_channels
create policy clinic_channels_read on clinic_channels for select
  using (clinic_id in (select user_clinic_ids()));
create policy clinic_channels_admin_write on clinic_channels for all
  using (user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[]))
  with check (user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[]));

-- clinic_integrations
create policy clinic_integrations_read on clinic_integrations for select
  using (clinic_id in (select user_clinic_ids()));
create policy clinic_integrations_admin_write on clinic_integrations for all
  using (user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[]))
  with check (user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[]));

-- clients
create policy clients_member_read on clients for select
  using (clinic_id in (select user_clinic_ids()));
create policy clients_member_write on clients for all
  using (clinic_id in (select user_clinic_ids()))
  with check (clinic_id in (select user_clinic_ids()));

-- pets
create policy pets_member_read on pets for select
  using (clinic_id in (select user_clinic_ids()));
create policy pets_member_write on pets for all
  using (clinic_id in (select user_clinic_ids()))
  with check (clinic_id in (select user_clinic_ids()));

-- services
create policy services_member_read on services for select
  using (clinic_id in (select user_clinic_ids()));
create policy services_admin_write on services for all
  using (user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[]))
  with check (user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[]));

-- conversations
create policy conversations_member_read on conversations for select
  using (clinic_id in (select user_clinic_ids()));
create policy conversations_member_update on conversations for update
  using (clinic_id in (select user_clinic_ids()))
  with check (clinic_id in (select user_clinic_ids()));
-- INSERT solo desde service role (edge functions)

-- messages
create policy messages_member_read on messages for select
  using (clinic_id in (select user_clinic_ids()));
-- INSERT humanos: solo desde panel (sender='human' validable en aplicación)
create policy messages_human_insert on messages for insert
  with check (
    clinic_id in (select user_clinic_ids())
    and sender = 'human'
    and sender_user_id = auth.uid()
  );

-- conversation_summaries
create policy conv_summaries_read on conversation_summaries for select
  using (clinic_id in (select user_clinic_ids()));
-- INSERT/UPDATE solo service role

-- appointments
create policy appointments_member_all on appointments for all
  using (clinic_id in (select user_clinic_ids()))
  with check (clinic_id in (select user_clinic_ids()));

-- tool_invocations: solo lectura para miembros
create policy tool_invocations_read on tool_invocations for select
  using (clinic_id in (select user_clinic_ids()));

-- events: solo lectura para miembros
create policy events_read on events for select
  using (clinic_id in (select user_clinic_ids()));

--------------------------------------------------------------------
-- VISTAS
--------------------------------------------------------------------

create or replace view v_today_appointments as
select
  a.*,
  c.full_name as client_name,
  c.phone as client_phone,
  p.name as pet_name,
  p.species as pet_species,
  s.name as service_name
from appointments a
left join clients c on c.id = a.client_id
left join pets p on p.id = a.pet_id
left join services s on s.id = a.service_id
where a.starts_at::date = current_date
  and a.status in ('scheduled', 'confirmed');

create or replace view v_active_conversations as
select
  conv.*,
  c.full_name as client_name,
  c.phone as client_phone,
  p.name as pet_name,
  (select count(*) from messages m where m.conversation_id = conv.id) as message_count,
  (select max(created_at) from messages m where m.conversation_id = conv.id) as last_message_at
from conversations conv
left join clients c on c.id = conv.client_id
left join pets p on p.id = conv.pet_id
where conv.status in ('active', 'awaiting_human', 'human_handling')
  and conv.deleted_at is null;

-- Fin migración inicial
```

---

## 12. Próximos pasos tras aplicar la migración

1. **Generar tipos TypeScript** con `supabase gen types typescript --local > packages/db/types.ts`.
2. **Configurar Supabase Auth**: habilitar Magic Link, configurar redirect URLs del panel.
3. **Setup Supabase Vault** para credenciales sensibles de `clinic_integrations.credentials` y `clinic_channels.provider_config`.
4. **Crear bucket Storage** `clinic-attachments` para adjuntos de mensajes (audios, imágenes), con políticas RLS espejando las de `messages`.
5. **Ejecutar seed Dr. Patiño** con la estructura completa de `clinic_config` que se define en `AGENT.md`.
6. **Tests de RLS**: crear suite que valide aislamiento entre clínicas con dos usuarios distintos.

---

## 13. Decisiones pendientes específicas del schema

1. **Cifrado de `credentials` en `clinic_integrations`** — uso de Supabase Vault vs. cifrado a nivel aplicación. Decidir en semana 2.
2. **Particionado de `messages` y `events`** — diferido hasta volumen real. Probablemente innecesario en MVP.
3. **Retención de datos** — política de borrado automático de mensajes y grabaciones antiguas. Configurable por clínica en `clinic_config`. Implementar como cron job en n8n en Iteración 3.
4. **Search avanzada** — full-text está cubierto con índice GIN. Búsqueda semántica (embeddings) diferida.

---

## 14. Cambios

| Fecha | Versión | Autor | Cambio |
|---|---|---|---|
| 2026-06-10 | 0.1 | Marc + Claude | Documento inicial. |
