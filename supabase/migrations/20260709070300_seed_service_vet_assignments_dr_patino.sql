-- Portable equivalent of the historical Dr. Patino assignment seed.
-- Service IDs are generated on a fresh database, so resolve them by their
-- stable clinic + slug identity instead of Production UUIDs.

insert into public.service_vet_assignments (service_id, vet_user_id, clinic_id)
select
  services.id,
  mapping.vet_user_id,
  '00000000-0000-0000-0000-000000000001'::uuid
from (
  values
    ('analisis_sangre', '00000000-0000-0000-0000-000000000015'::uuid),
    ('analisis_sangre', '00000000-0000-0000-0000-000000000014'::uuid),
    ('radiografia', '00000000-0000-0000-0000-000000000011'::uuid),
    ('radiografia', '00000000-0000-0000-0000-000000000013'::uuid),
    ('radiografia', '00000000-0000-0000-0000-000000000014'::uuid),
    ('curva_glucosa', '00000000-0000-0000-0000-000000000015'::uuid),
    ('curva_glucosa', '00000000-0000-0000-0000-000000000014'::uuid),
    ('fructosamina', '00000000-0000-0000-0000-000000000015'::uuid),
    ('fructosamina', '00000000-0000-0000-0000-000000000014'::uuid),
    ('tiroides', '00000000-0000-0000-0000-000000000015'::uuid),
    ('tiroides', '00000000-0000-0000-0000-000000000014'::uuid),
    ('serologia_leishmania', '00000000-0000-0000-0000-000000000015'::uuid),
    ('serologia_leishmania', '00000000-0000-0000-0000-000000000014'::uuid),
    ('test_panel', '00000000-0000-0000-0000-000000000015'::uuid),
    ('test_panel', '00000000-0000-0000-0000-000000000014'::uuid),
    ('citologias', '00000000-0000-0000-0000-000000000015'::uuid),
    ('citologias', '00000000-0000-0000-0000-000000000014'::uuid),
    ('citologias', '00000000-0000-0000-0000-000000000012'::uuid),
    ('revision_geriatrica', '00000000-0000-0000-0000-000000000013'::uuid),
    ('revision_geriatrica', '00000000-0000-0000-0000-000000000014'::uuid),
    ('sondaje', '00000000-0000-0000-0000-000000000011'::uuid),
    ('sondaje', '00000000-0000-0000-0000-000000000013'::uuid)
) as mapping(service_slug, vet_user_id)
join public.services as services
  on services.clinic_id = '00000000-0000-0000-0000-000000000001'::uuid
 and services.slug = mapping.service_slug
join public.clinic_users as vets
  on vets.id = mapping.vet_user_id
 and vets.clinic_id = services.clinic_id
on conflict on constraint service_vet_assignments_service_id_vet_user_id_key do nothing;
