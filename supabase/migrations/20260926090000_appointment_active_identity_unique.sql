do $$
begin
  if exists (
    select 1
    from public.appointments
    where status <> 'cancelled'
    group by clinic_id, client_id, pet_id, vet_user_id, service_id, starts_at
    having count(*) > 1
  ) then
    raise exception
      'Cannot enforce appointment active identity: duplicate active appointment identities exist';
  end if;
end
$$;

create unique index if not exists appointments_active_identity_unique_idx
  on public.appointments (
    clinic_id,
    client_id,
    pet_id,
    vet_user_id,
    service_id,
    starts_at
  ) nulls not distinct
  where status <> 'cancelled';

comment on index public.appointments_active_identity_unique_idx is
  'One active appointment per clinic/client/pet/vet/service/start identity; cancelled rows release the identity.';
