-- Keep the identity collected by the agent visible everywhere that reads a
-- conversation: inbox, detail view, search and client history.

-- Recover client links recorded by successful identification/registration
-- tools before application-level linking was introduced.
with identified_clients as (
  select distinct on (ti.conversation_id)
    ti.conversation_id,
    case
      when ti.tool_name = 'lookup_client' then ti.output -> 'client' ->> 'id'
      else ti.output ->> 'client_id'
    end as client_id
  from tool_invocations ti
  where ti.success
    and ti.conversation_id is not null
    and ti.tool_name in ('lookup_client', 'register_new_client')
  order by ti.conversation_id, ti.created_at desc
)
update conversations conv
set client_id = clients.id
from identified_clients identity
join clients
  on clients.id::text = identity.client_id
 and clients.deleted_at is null
where conv.id = identity.conversation_id
  and conv.clinic_id = clients.clinic_id
  and conv.client_id is null;

-- A registered pet is an explicit, unambiguous selection in that
-- conversation, so recover both foreign keys from the pet itself.
with registered_pets as (
  select distinct on (ti.conversation_id)
    ti.conversation_id,
    ti.output ->> 'pet_id' as pet_id
  from tool_invocations ti
  where ti.success
    and ti.conversation_id is not null
    and ti.tool_name = 'register_new_pet'
  order by ti.conversation_id, ti.created_at desc
)
update conversations conv
set client_id = pets.client_id,
    pet_id = pets.id
from registered_pets identity
join pets
  on pets.id::text = identity.pet_id
 and pets.active
 and pets.deleted_at is null
where conv.id = identity.conversation_id
  and conv.clinic_id = pets.clinic_id
  and (conv.client_id is null or conv.pet_id is null);

-- Confirmed appointments are the strongest historical source of the client
-- and pet selected in a conversation.
with latest_appointments as (
  select distinct on (a.conversation_id)
    a.conversation_id,
    a.clinic_id,
    a.client_id,
    a.pet_id
  from appointments a
  where a.conversation_id is not null
  order by a.conversation_id, a.created_at desc
)
update conversations conv
set client_id = appointment.client_id,
    pet_id = appointment.pet_id
from latest_appointments appointment
where conv.id = appointment.conversation_id
  and conv.clinic_id = appointment.clinic_id
  and (conv.client_id is distinct from appointment.client_id
    or conv.pet_id is distinct from appointment.pet_id);

-- If an identified client has only one active pet, there is no ambiguity and
-- old conversations can safely display it.
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

-- Future appointment writes also repair the linked conversation even if they
-- originate outside the chat agent.
create function sync_appointment_conversation_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.conversation_id is not null then
    update conversations
    set client_id = new.client_id,
        pet_id = new.pet_id
    where id = new.conversation_id
      and clinic_id = new.clinic_id
      and (client_id is distinct from new.client_id
        or pet_id is distinct from new.pet_id);
  end if;
  return new;
end;
$$;

create trigger sync_appointment_conversation_identity_after_write
after insert or update of conversation_id, client_id, pet_id on appointments
for each row execute function sync_appointment_conversation_identity();
