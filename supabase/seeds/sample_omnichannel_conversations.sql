-- =====================================================================
-- Recepia — Seed de demostración omnicanal
-- Requiere 20260820120000_conversation_foundation.sql y el seed Dr. Patiño.
-- Nunca ejecutar en producción con datos reales.
-- =====================================================================

begin;

insert into clients (id, clinic_id, phone, name)
values (
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000001',
  '+34600000999',
  'Cliente Demo Omnicanal'
)
on conflict do nothing;

insert into pets (id, clinic_id, client_id, name, species, sex)
values (
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000102',
  'Nala',
  'cat',
  'female'
)
on conflict do nothing;

insert into conversations (
  id, clinic_id, client_id, pet_id, channel, channel_thread_id,
  status, category, urgency_level, started_at, ended_at
)
values (
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000202',
  'phone',
  'demo-call-thread-001',
  'completed',
  'cita',
  'low',
  now() - interval '35 minutes',
  now() - interval '29 minutes'
)
on conflict do nothing;

insert into call_sessions (
  id, clinic_id, conversation_id, provider, provider_call_id, direction,
  status, from_number, to_number, started_at, answered_at, ended_at,
  duration_seconds, transcript_status
)
values (
  '00000000-0000-0000-0000-000000000502',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000302',
  'demo',
  'demo-call-001',
  'inbound',
  'completed',
  '+34600000999',
  '+34977000000',
  now() - interval '35 minutes',
  now() - interval '34 minutes 55 seconds',
  now() - interval '29 minutes',
  355,
  'completed'
)
on conflict do nothing;

insert into messages (
  id, conversation_id, clinic_id, direction, sender, content,
  content_type, created_at, metadata
)
values
  (
    '00000000-0000-0000-0000-000000000412',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000001',
    'inbound', 'system', 'Llamada entrante iniciada', 'system_event',
    now() - interval '35 minutes', '{"call_session_id":"00000000-0000-0000-0000-000000000502"}'
  ),
  (
    '00000000-0000-0000-0000-000000000413',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000001',
    'inbound', 'client', 'Hola, llamo para pedir una revisión para Nala.', 'text',
    now() - interval '34 minutes', '{"source":"phone_transcript"}'
  ),
  (
    '00000000-0000-0000-0000-000000000414',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000001',
    'outbound', 'agent', 'Claro. ¿Qué día te iría mejor para la revisión?', 'text',
    now() - interval '33 minutes 45 seconds', '{"source":"phone_transcript"}'
  ),
  (
    '00000000-0000-0000-0000-000000000415',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000001',
    'inbound', 'client', 'El jueves por la mañana, si puede ser.', 'text',
    now() - interval '33 minutes', '{"source":"phone_transcript"}'
  ),
  (
    '00000000-0000-0000-0000-000000000416',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000001',
    'outbound', 'system', 'Llamada finalizada · 5 min 55 s', 'system_event',
    now() - interval '29 minutes', '{"call_session_id":"00000000-0000-0000-0000-000000000502"}'
  )
on conflict do nothing;

commit;
