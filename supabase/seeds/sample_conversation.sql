-- =====================================================================
-- Recepia — Seed: 1 conversación de ejemplo con mensajes
-- Archivo: supabase/seeds/sample_conversation.sql
-- =====================================================================
--
-- Inserta 1 cliente, 1 mascota, 1 conversación y 6 mensajes
-- para poder ver el split view del panel con datos reales.
--
-- PRE-REQUISITO: El seed de dr_patino.sql debe haberse ejecutado antes
-- (clínica `00000000-0000-0000-0000-000000000001` debe existir).
--
-- EJECUCIÓN:
--   doppler run -- psql "$SUPABASE_DB_URL" -f supabase/seeds/sample_conversation.sql
-- =====================================================================

BEGIN;

-- Cliente de prueba
INSERT INTO clients (id, clinic_id, phone, full_name)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  '+34666123456',
  'Carmen Vega'
)
ON CONFLICT DO NOTHING;

-- Mascota de prueba
INSERT INTO pets (id, clinic_id, client_id, name, species, breed, sex, birth_date)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  'Luna',
  'dog',
  'Golden Retriever',
  'female',
  '2021-03-15'
)
ON CONFLICT DO NOTHING;

-- Conversación
INSERT INTO conversations (id, clinic_id, client_id, pet_id, channel, status, category, urgency_level, started_at)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000201',
  'whatsapp',
  'active',
  'cita',
  'medium',
  '2026-06-20 09:15:00+02'
)
ON CONFLICT DO NOTHING;

-- Mensajes (alternando inbound/outbound)
INSERT INTO messages (id, conversation_id, clinic_id, direction, sender, content, content_type, created_at) VALUES
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000001',
    'inbound', 'client', 'Hola, necesito pedir cita para Luna. Tiene que vacunarse.',
    'text', '2026-06-20 09:15:00+02'
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000001',
    'outbound', 'agent', '¡Hola Carmen! Claro, te ayudo a agendar la vacunación de Luna. ¿Puedes decirme qué vacuna necesita?',
    'text', '2026-06-20 09:15:12+02'
  ),
  (
    '00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000001',
    'inbound', 'client', 'La anual, la rabia creo. También quería consultar por un bultito que le ha salido en la pata.',
    'text', '2026-06-20 09:16:30+02'
  ),
  (
    '00000000-0000-0000-0000-000000000404',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000001',
    'outbound', 'agent', 'Entendido. Para la vacuna de la rabia tenemos hueco mañana a las 10:00. Sobre el bultito, ¿prefieres que lo vea Samuel o María?',
    'text', '2026-06-20 09:16:45+02'
  ),
  (
    '00000000-0000-0000-0000-000000000405',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000001',
    'inbound', 'client', 'Con Samuel mejor, ya la conoce. ¿Puede ser mañana a las 10:00 entonces?',
    'text', '2026-06-20 09:17:15+02'
  ),
  (
    '00000000-0000-0000-0000-000000000406',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000001',
    'outbound', 'agent', '¡Perfecto! Te confirmo: cita mañana 21 de junio a las 10:00 con Samuel para vacunación de rabia y revisión del bultito en la pata. ¿Algo más en lo que pueda ayudarte?',
    'text', '2026-06-20 09:17:30+02'
  )
ON CONFLICT DO NOTHING;

COMMIT;
