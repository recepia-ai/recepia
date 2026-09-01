-- Strong client identity, historical conversation repair and pet-aware search.

alter table clients
  add column if not exists document_id text;

create unique index if not exists clients_clinic_document_id_unique
  on clients (
    clinic_id,
    upper(regexp_replace(document_id, '[^A-Za-z0-9]', '', 'g'))
  )
  where document_id is not null and deleted_at is null;

create index if not exists pets_clinic_name_search_idx
  on pets (clinic_id, lower(name))
  where active and deleted_at is null;

-- Conversations created before identity linking can be recovered safely when
-- their channel phone matches one and only one active client in the clinic.
with identity_matches as (
  select
    conv.id as conversation_id,
    (array_agg(c.id order by c.id))[1] as client_id,
    count(*) as matches
  from conversations conv
  join clients c
    on c.clinic_id = conv.clinic_id
   and c.deleted_at is null
   and regexp_replace(c.phone, '[^0-9]', '', 'g') = regexp_replace(
     coalesce(conv.metadata ->> 'client_phone', conv.channel_thread_id, ''),
     '[^0-9]',
     '',
     'g'
   )
  where conv.client_id is null
    and coalesce(conv.metadata ->> 'client_phone', conv.channel_thread_id, '') <> ''
  group by conv.id
)
update conversations conv
set client_id = identity_matches.client_id
from identity_matches
where conv.id = identity_matches.conversation_id
  and identity_matches.matches = 1;

with single_pets as (
  select client_id, (array_agg(id order by id))[1] as pet_id
  from pets
  where active and deleted_at is null
  group by client_id
  having count(*) = 1
)
update conversations conv
set pet_id = single_pets.pet_id
from single_pets
where conv.client_id = single_pets.client_id
  and conv.pet_id is null;

create or replace function search_conversation_ids(
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
      or coalesce(c.email, '') ilike '%' || trim(p_query) || '%'
      or coalesce(c.document_id, '') ilike '%' || trim(p_query) || '%'
      or coalesce(p.name, '') ilike '%' || trim(p_query) || '%'
      or exists (
        select 1
        from pets client_pet
        where client_pet.client_id = conv.client_id
          and client_pet.active
          and client_pet.deleted_at is null
          and (
            client_pet.name ilike '%' || trim(p_query) || '%'
            or coalesce(client_pet.breed, '') ilike '%' || trim(p_query) || '%'
            or coalesce(client_pet.microchip, '') ilike '%' || trim(p_query) || '%'
          )
      )
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
