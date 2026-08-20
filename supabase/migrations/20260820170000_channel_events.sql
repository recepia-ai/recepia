-- =====================================================================
-- Recepia — Eventos de canal e idempotencia omnicanal
-- =====================================================================

create table channel_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  channel channel_type not null,
  provider text not null,
  event_id text not null,
  event_type text not null,
  status text not null default 'processing' check (
    status in ('processing', 'completed', 'failed')
  ),
  payload jsonb not null default '{}',
  result jsonb,
  error_message text,
  occurred_at timestamptz not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, provider, event_id)
);

create index channel_events_clinic_created_idx
  on channel_events(clinic_id, created_at desc);
create index channel_events_conversation_idx
  on channel_events(conversation_id, created_at);

create function ensure_channel_event_clinic_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  conversation_clinic_id uuid;
begin
  if new.conversation_id is null then
    return new;
  end if;

  select clinic_id into conversation_clinic_id
  from conversations
  where id = new.conversation_id;

  if conversation_clinic_id is null then
    raise exception 'Conversation % does not exist', new.conversation_id;
  end if;

  if new.clinic_id <> conversation_clinic_id then
    raise exception 'channel_events.clinic_id must match its conversation clinic_id';
  end if;

  return new;
end;
$$;

create trigger ensure_channel_event_clinic_id_before_write
before insert or update of clinic_id, conversation_id on channel_events
for each row execute function ensure_channel_event_clinic_id();

create trigger set_updated_at_channel_events
before update on channel_events
for each row execute function set_updated_at();

alter table channel_events enable row level security;

create policy channel_events_member_read on channel_events for select
  using (clinic_id in (select user_clinic_ids()));

-- Los identificadores se prefijan con el proveedor en la aplicación, de modo
-- que un reintento del mismo mensaje nunca genera dos respuestas del agente.
create unique index messages_clinic_provider_message_unique
  on messages(clinic_id, provider_message_id)
  where provider_message_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'channel_events'
  ) then
    alter publication supabase_realtime add table channel_events;
  end if;
end
$$;
