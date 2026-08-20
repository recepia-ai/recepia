-- =====================================================================
-- Recepia — Fundación omnicanal de conversaciones
-- =====================================================================

-- Registrar quién tomó una conversación y cuándo, sin sustituir el estado
-- existente que ya usa el panel.
alter table conversations
  add column controlled_by uuid references auth.users(id) on delete set null,
  add column controlled_at timestamptz;

create index conversations_clinic_activity_idx
  on conversations(clinic_id, updated_at desc)
  where deleted_at is null;

create index conversations_controlled_by_idx
  on conversations(controlled_by)
  where controlled_by is not null;

-- Una conversación telefónica puede contener una o más sesiones de llamada
-- (reintentos, transferencia o devolución de llamada). Los turnos hablados se
-- normalizan también en messages para que compartan timeline con WhatsApp.
create table call_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  provider text not null,
  provider_call_id text not null,
  direction message_direction not null,
  status text not null check (
    status in ('queued', 'ringing', 'in_progress', 'completed', 'failed', 'missed', 'transferred')
  ),
  from_number text,
  to_number text,
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  recording_storage_path text,
  transcript_status text not null default 'pending' check (
    transcript_status in ('pending', 'processing', 'completed', 'failed', 'not_available')
  ),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_call_id)
);

create index call_sessions_clinic_started_idx
  on call_sessions(clinic_id, started_at desc);
create index call_sessions_conversation_idx
  on call_sessions(conversation_id, started_at);

create function ensure_call_session_clinic_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  conversation_clinic_id uuid;
begin
  select clinic_id into conversation_clinic_id
  from conversations
  where id = new.conversation_id;

  if conversation_clinic_id is null then
    raise exception 'Conversation % does not exist', new.conversation_id;
  end if;

  if new.clinic_id <> conversation_clinic_id then
    raise exception 'call_sessions.clinic_id must match its conversation clinic_id';
  end if;

  return new;
end;
$$;

create trigger ensure_call_session_clinic_id_before_write
before insert or update of clinic_id, conversation_id on call_sessions
for each row execute function ensure_call_session_clinic_id();

create trigger set_updated_at_call_sessions
before update on call_sessions
for each row execute function set_updated_at();

alter table call_sessions enable row level security;

create policy call_sessions_member_read on call_sessions for select
  using (clinic_id in (select user_clinic_ids()));

-- Bandeja completa: conserva conversaciones cerradas y añade una previsualización
-- del último mensaje y métricas de llamada. security_invoker mantiene el RLS de
-- las tablas subyacentes para cada usuario del panel.
create view v_conversations_inbox
with (security_invoker = true) as
select
  conv.*,
  c.name as client_name,
  c.phone as client_phone,
  p.name as pet_name,
  message_stats.message_count,
  message_stats.last_message_at,
  message_stats.last_message_preview,
  message_stats.last_message_sender,
  call_stats.call_count,
  call_stats.last_call_at,
  call_stats.last_call_duration_seconds
from conversations conv
left join clients c on c.id = conv.client_id
left join pets p on p.id = conv.pet_id
left join lateral (
  select
    count(*)::bigint as message_count,
    max(m.created_at) as last_message_at,
    (array_agg(left(m.content, 180) order by m.created_at desc)
      filter (where m.content is not null))[1] as last_message_preview,
    (array_agg(m.sender order by m.created_at desc))[1] as last_message_sender
  from messages m
  where m.conversation_id = conv.id
) message_stats on true
left join lateral (
  select
    count(*)::bigint as call_count,
    max(cs.started_at) as last_call_at,
    (array_agg(cs.duration_seconds order by cs.started_at desc))[1]
      as last_call_duration_seconds
  from call_sessions cs
  where cs.conversation_id = conv.id
) call_stats on true
where conv.deleted_at is null;

-- Búsqueda de bandeja por identidad o por cualquier mensaje de la conversación.
-- La función exige pertenencia a la clínica además del RLS de las tablas.
create function search_conversation_ids(
  p_clinic_id uuid,
  p_query text,
  p_limit integer default 100
)
returns table (conversation_id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  select conv.id
  from conversations conv
  left join clients c on c.id = conv.client_id
  left join pets p on p.id = conv.pet_id
  where conv.clinic_id = p_clinic_id
    and conv.deleted_at is null
    and p_clinic_id in (select user_clinic_ids())
    and (
      coalesce(c.name, '') ilike '%' || trim(p_query) || '%'
      or coalesce(c.phone, '') ilike '%' || trim(p_query) || '%'
      or coalesce(p.name, '') ilike '%' || trim(p_query) || '%'
      or exists (
        select 1
        from messages m
        where m.conversation_id = conv.id
          and to_tsvector('spanish', coalesce(m.content, ''))
            @@ plainto_tsquery('spanish', trim(p_query))
      )
    )
  order by coalesce(
    (select max(m.created_at) from messages m where m.conversation_id = conv.id),
    conv.started_at
  ) desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- El panel se refrescará al recibir cambios en conversaciones, mensajes o
-- llamadas. Los bloques son idempotentes para entornos donde alguna tabla ya
-- estuviera publicada manualmente.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'call_sessions'
  ) then
    alter publication supabase_realtime add table call_sessions;
  end if;
end
$$;
