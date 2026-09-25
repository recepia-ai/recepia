-- One-time foundation for a fresh, isolated Recepia Preview project.
--
-- Apply this after 20260626000000_google_calendar and before
-- 20260628120000_real_seed_dr_patino. It creates only the stable parent rows
-- required by the historical clinic seed. It does not copy Production data,
-- credentials, integrations, conversations, clients, pets, or appointments.

begin;

insert into public.clinics (
  id,
  name,
  slug,
  timezone,
  locale,
  status,
  metadata
)
values (
  '00000000-0000-0000-0000-000000000001',
  'Hospital Veterinario Dr. Patino — Preview',
  'dr-patino',
  'Europe/Madrid',
  'es-ES',
  'active',
  '{"environment":"preview","dataset":"controlled-pilot"}'::jsonb
)
on conflict (id) do nothing;

insert into public.clinic_config (clinic_id, config, version)
values (
  '00000000-0000-0000-0000-000000000001',
  '{
    "identity": {
      "clinic_name": "Hospital Veterinario Dr. Patino — Preview",
      "agent_name": "Recepia",
      "tone": "professional_warm",
      "language_default": "es-ES"
    },
    "hours": {"timezone":"Europe/Madrid"},
    "calendar": {
      "provider": "google_calendar",
      "slot_granularity_minutes": 30,
      "booking_horizon_days": 60,
      "min_advance_minutes": 60
    },
    "operations": {
      "ai_channels": {
        "web": false,
        "whatsapp": false,
        "phone": false
      }
    },
    "services_catalog_ids": []
  }'::jsonb,
  1
)
on conflict (clinic_id) do nothing;

commit;
