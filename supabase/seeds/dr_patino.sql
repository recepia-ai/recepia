-- =====================================================================
-- Recepia — Seed inicial del Hospital Veterinario Dr. Patino
-- Archivo: supabase/seeds/dr_patino.sql
-- Versión: 0.1 — junio 2026
-- =====================================================================
--
-- Este archivo carga la configuración completa de la primera clínica
-- piloto (Hospital Veterinario Dr. Patino) en una base de datos Recepia
-- recién migrada.
--
-- PRE-REQUISITOS antes de ejecutar:
--   1. La migración inicial debe estar aplicada (todas las tablas y
--      enums del SCHEMA.md presentes).
--   2. Crear el usuario admin desde Supabase Studio →
--      Authentication → Users → Add user, con "Auto Confirm User".
--   3. Copiar el UUID del usuario recién creado y SUSTITUIRLO debajo en
--      la cadena `__USER_UUID_AQUI__` (búsqueda y reemplazo).
--
-- EJECUCIÓN:
--   Opción A — desde Supabase CLI:
--     psql "$(supabase status -o env DB_URL)" -f supabase/seeds/dr_patino.sql
--
--   Opción B — desde Supabase Studio:
--     Abrir SQL Editor, pegar este archivo entero, ejecutar.
--
-- IDEMPOTENCIA:
--   Todos los INSERT usan ON CONFLICT DO NOTHING. Se puede re-ejecutar
--   sin duplicar datos. Si quieres reemplazar el clinic_config existente,
--   borrarlo antes manualmente o usar la versión upsert al final del
--   archivo (comentada).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Clínica
-- ---------------------------------------------------------------------
INSERT INTO clinics (id, name, slug, timezone, locale, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Hospital Veterinario Dr. Patino',
  'dr-patino',
  'Europe/Madrid',
  'es-ES',
  'active'
)
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------
-- 2. clinic_config (estructura completa de AGENT.md §11)
-- ---------------------------------------------------------------------
INSERT INTO clinic_config (clinic_id, config, version)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  $RECEPIA${
    "identity": {
      "clinic_name": "Hospital Veterinario Dr. Patino",
      "legal_name": "Hospital Veterinario Dr. Patino S.L.",
      "agent_name": "Recepia",
      "tone": "professional_warm",
      "language_default": "es-ES",
      "disclaimer_first_contact": "Hola, soy Recepia, la asistente virtual del Hospital Veterinario Dr. Patino. Te atiendo encantada. ¿En qué puedo ayudarte?"
    },
    "hours": {
      "timezone": "Europe/Madrid",
      "general": {
        "monday":    [{ "start": "08:00", "end": "20:00" }],
        "tuesday":   [{ "start": "08:00", "end": "20:00" }],
        "wednesday": [{ "start": "08:00", "end": "20:00" }],
        "thursday":  [{ "start": "08:00", "end": "20:00" }],
        "friday":    [{ "start": "08:00", "end": "20:00" }],
        "saturday":  [{ "start": "09:00", "end": "13:00" }],
        "sunday":    []
      },
      "by_service_category": {
        "adn": {
          "monday":    [{ "start": "11:00", "end": "14:30" }],
          "tuesday":   [{ "start": "11:00", "end": "14:30" }],
          "wednesday": [{ "start": "11:00", "end": "14:30" }],
          "thursday":  [{ "start": "11:00", "end": "14:30" }],
          "friday":    [{ "start": "11:00", "end": "14:30" }],
          "saturday":  [],
          "sunday":    []
        },
        "bureaucratic": {
          "monday":    [{ "start": "10:00", "end": "12:30" }],
          "tuesday":   [{ "start": "10:00", "end": "12:30" }],
          "wednesday": [{ "start": "10:00", "end": "12:30" }],
          "thursday":  [{ "start": "10:00", "end": "12:30" }],
          "friday":    [{ "start": "10:00", "end": "12:30" }],
          "saturday":  [{ "start": "10:00", "end": "12:30" }],
          "sunday":    []
        }
      },
      "emergency": {
        "monday":    [],
        "tuesday":   [],
        "wednesday": [],
        "thursday":  [],
        "friday":    [],
        "saturday":  [{ "start": "13:00", "end": "21:00" }],
        "sunday":    [{ "start": "09:00", "end": "21:00" }]
      },
      "holidays": []
    },
    "policies": {
      "refused_species": ["exotic"],
      "refused_species_response": "Lo siento mucho. En el Hospital Veterinario Dr. Patino no atendemos animales exóticos. Te recomiendo buscar un centro especializado en exóticos en tu zona. Si tu animal tiene una urgencia, no dudes en buscar atención lo antes posible. ¿Puedo ayudarte con algo más?",
      "transfer_immediate": [
        "hospitalization_inquiry",
        "prescription_request",
        "report_request",
        "medication_inquiry",
        "referred_patient",
        "in_hours_emergency",
        "complaint",
        "death_or_grief"
      ],
      "transfer_targets": {
        "in_hours": {
          "type": "human_takes_over",
          "message_to_client": "Te paso ahora mismo con una persona del equipo. Un momento, por favor."
        },
        "out_of_hours": {
          "type": "schedule_callback",
          "callback_window": {
            "monday":    [{ "start": "08:00", "end": "20:00" }],
            "tuesday":   [{ "start": "08:00", "end": "20:00" }],
            "wednesday": [{ "start": "08:00", "end": "20:00" }],
            "thursday":  [{ "start": "08:00", "end": "20:00" }],
            "friday":    [{ "start": "08:00", "end": "20:00" }],
            "saturday":  [{ "start": "09:00", "end": "13:00" }],
            "sunday":    []
          },
          "message_to_client": "Ahora mismo no hay nadie del equipo disponible. He tomado nota de tu mensaje y te llamarán en cuanto abramos. Si es una urgencia y necesitas atención inmediata, dirígete al hospital de urgencias 24h más cercano."
        }
      },
      "vet_direct_contact": {
        "allowed_vets": [
          { "name": "Samuel" },
          { "name": "María" }
        ],
        "window": {
          "monday":    [{ "start": "16:00", "end": "16:30" }],
          "tuesday":   [{ "start": "16:00", "end": "16:30" }],
          "wednesday": [{ "start": "16:00", "end": "16:30" }],
          "thursday":  [{ "start": "16:00", "end": "16:30" }],
          "friday":    [{ "start": "16:00", "end": "16:30" }],
          "saturday":  [],
          "sunday":    []
        },
        "out_of_window_response": "Puedes hablar directamente con Samuel o María de lunes a viernes de 16:00 a 16:30. Fuera de ese horario, puedo tomar nota y que te llamen ellos cuando estén disponibles, o transferirte con otra persona del equipo. ¿Qué prefieres?"
      },
      "consent": {
        "whatsapp_first_message": "Te atiende Recepia, asistente virtual del Hospital Veterinario Dr. Patino. Tus datos se tratan conforme a nuestra política de privacidad. Si tienes cualquier duda, puedes pedir hablar con una persona del equipo en cualquier momento.",
        "call_recording_message": "Esta llamada será atendida por Recepia, asistente virtual del Hospital Veterinario Dr. Patino, y puede ser grabada para mejorar el servicio. Si prefieres hablar con una persona, dilo en cualquier momento."
      }
    },
    "services_catalog_ids": [],
    "calendar": {
      "provider": "google_calendar",
      "calendars": {
        "default_calendar_id": "PENDIENTE_CONFIGURAR_OAUTH"
      },
      "slot_granularity_minutes": 15,
      "booking_horizon_days": 60,
      "min_advance_minutes": 60
    },
    "agent_behavior": {
      "llm_model": "claude-sonnet-4-5",
      "temperature": 0.3,
      "max_clarification_attempts": 2,
      "fallback_action": "transfer"
    },
    "voice": null,
    "data_retention": {
      "messages_days": 365,
      "recordings_days": 90,
      "summaries_days": 730
    }
  }$RECEPIA$::jsonb,
  1
)
ON CONFLICT (clinic_id) DO NOTHING;


-- ---------------------------------------------------------------------
-- 3. Catálogo de servicios (11 servicios iniciales)
-- ---------------------------------------------------------------------
INSERT INTO services (clinic_id, name, category, duration_minutes, requires_transfer) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Consulta general',                  'consultation',  30, false),
  ('00000000-0000-0000-0000-000000000001', 'Vacunación',                        'vaccine',       20, false),
  ('00000000-0000-0000-0000-000000000001', 'Revisión anual',                    'consultation',  30, false),
  ('00000000-0000-0000-0000-000000000001', 'Peluquería - baño',                 'grooming',      60, false),
  ('00000000-0000-0000-0000-000000000001', 'Peluquería - corte de pelo',        'grooming',      90, false),
  ('00000000-0000-0000-0000-000000000001', 'Peluquería - corte de uñas',        'grooming',      15, false),
  ('00000000-0000-0000-0000-000000000001', 'Test ADN',                          'adn',           30, false),
  ('00000000-0000-0000-0000-000000000001', 'Implantación de chip',              'bureaucratic',  20, false),
  ('00000000-0000-0000-0000-000000000001', 'Pasaporte',                         'bureaucratic',  30, false),
  ('00000000-0000-0000-0000-000000000001', 'Certificado de viaje',              'bureaucratic',  30, false),
  ('00000000-0000-0000-0000-000000000001', 'Cambio de nombre / titularidad',    'bureaucratic',  20, false)
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------
-- 4. Rellenar services_catalog_ids en clinic_config
--    Lo hacemos en un paso aparte porque depende de los IDs generados.
-- ---------------------------------------------------------------------
UPDATE clinic_config
SET config = jsonb_set(
  config,
  '{services_catalog_ids}',
  (
    SELECT to_jsonb(array_agg(id::text))
    FROM services
    WHERE clinic_id = '00000000-0000-0000-0000-000000000001'
  )
)
WHERE clinic_id = '00000000-0000-0000-0000-000000000001';


-- ---------------------------------------------------------------------
-- 5. Vincular usuario admin
--
-- IMPORTANTE — ACCIÓN MANUAL REQUERIDA:
--    1. Crear el usuario admin en Supabase Studio
--       (Authentication → Users → Add user, con "Auto Confirm User").
--    2. Copiar el UUID del usuario recién creado.
--    3. Sustituir __USER_UUID_AQUI__ por el UUID antes de ejecutar
--       este archivo. Si el UUID sigue como placeholder, esta sección
--       NO se ejecuta (protegida por la guarda WHERE).
-- ---------------------------------------------------------------------
INSERT INTO clinic_users (clinic_id, user_id, role)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '__USER_UUID_AQUI__'::uuid,
  'admin'::clinic_user_role
WHERE position('__USER_UUID' in '__USER_UUID_AQUI__') = 0  -- guarda: solo si fue reemplazado
ON CONFLICT (clinic_id, user_id) DO NOTHING;


-- ---------------------------------------------------------------------
-- 6. Verificaciones — deben devolver los siguientes conteos
-- ---------------------------------------------------------------------
SELECT 'clinics'        AS tabla, COUNT(*) AS filas FROM clinics        WHERE id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'clinic_config'  AS tabla, COUNT(*) AS filas FROM clinic_config  WHERE clinic_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'services'       AS tabla, COUNT(*) AS filas FROM services       WHERE clinic_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'clinic_users'   AS tabla, COUNT(*) AS filas FROM clinic_users   WHERE clinic_id = '00000000-0000-0000-0000-000000000001';

-- Conteos esperados tras ejecución correcta:
--   clinics        : 1
--   clinic_config  : 1
--   services       : 11
--   clinic_users   : 1 (si reemplazaste el UUID) o 0 (si no)


COMMIT;


-- =====================================================================
-- BLOQUE OPCIONAL — Forzar actualización de clinic_config
-- =====================================================================
-- Si necesitas REEMPLAZAR la configuración existente (por ejemplo
-- porque ya estaba seedeada y quieres actualizarla), descomenta el
-- siguiente bloque. Esto disparará el trigger archive_clinic_config()
-- y guardará la versión anterior en clinic_config_history.
-- =====================================================================

-- BEGIN;
-- UPDATE clinic_config
-- SET config = $RECEPIA$
--   { /* ... pegar de nuevo el JSON completo aquí ... */ }
-- $RECEPIA$::jsonb
-- WHERE clinic_id = '00000000-0000-0000-0000-000000000001';
-- COMMIT;
