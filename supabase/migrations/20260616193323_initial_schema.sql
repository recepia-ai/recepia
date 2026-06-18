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

-- FUNCIONES DEPENDIENTES DE TABLAS
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