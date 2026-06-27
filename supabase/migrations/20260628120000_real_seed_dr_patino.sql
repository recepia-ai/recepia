-- =========================================================================
-- Recepia — Seed real del Hospital Veterinario Dr. Patino
-- =========================================================================
-- Añade staff_type/specialties a clinic_users, refactoriza services,
-- crea vet_consultation_hours, inserta datos reales de la clínica.
--
-- PRE-REQUISITOS:
--   Migraciones anteriores aplicadas (initial, settings_and_team,
--   rls_policies, google_calendar_integration).
--   Usuario Marc (08bf4193-ccbc-46e1-8421-4c14a202e43c) y Samuel Test
--   deben existir en auth.users y clinic_users.
--
-- IDEMPOTENCIA: usa IF NOT EXISTS / DROP IF EXISTS / ON CONFLICT DO NOTHING.
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. LIMPIEZA — Eliminar seeds dummy
-- =========================================================================

-- 1a. Appointments
DELETE FROM appointments
WHERE clinic_id = '00000000-0000-0000-0000-000000000001';

-- 1b. Messages (pertenecen a conversations dummy)
DELETE FROM messages
WHERE conversation_id IN (
  SELECT id FROM conversations
  WHERE clinic_id = '00000000-0000-0000-0000-000000000001'
);

-- 1c. Conversations
DELETE FROM conversations
WHERE clinic_id = '00000000-0000-0000-0000-000000000001';

-- 1d. Pets dummy (todos los de la clínica)
DELETE FROM pets
WHERE clinic_id = '00000000-0000-0000-0000-000000000001';

-- 1e. Clients dummy (todos los de la clínica)
DELETE FROM clients
WHERE clinic_id = '00000000-0000-0000-0000-000000000001';

-- 1f. Services antiguos (schema incompatible con el nuevo diseño)
DELETE FROM services
WHERE clinic_id = '00000000-0000-0000-0000-000000000001';


-- =========================================================================
-- 2. SCHEMA — clinic_users
-- =========================================================================

-- 2a. Nuevas columnas
ALTER TABLE clinic_users ADD COLUMN IF NOT EXISTS specialty_primary  text;
ALTER TABLE clinic_users ADD COLUMN IF NOT EXISTS specialty_secondary text[];
ALTER TABLE clinic_users ADD COLUMN IF NOT EXISTS staff_type         text;

-- 2b. Permitir staff sin cuenta de login (user_id nullable)
--     La FK REFERENCES auth.users sigue intacta; NULL simplemente no la activa.
ALTER TABLE clinic_users ALTER COLUMN user_id DROP NOT NULL;

-- 2c. CHECK constraint para staff_type
ALTER TABLE clinic_users DROP CONSTRAINT IF EXISTS clinic_users_staff_type_check;
ALTER TABLE clinic_users ADD CONSTRAINT clinic_users_staff_type_check
  CHECK (staff_type IS NULL OR staff_type IN ('vet', 'atv', 'reception', 'admin'));


-- =========================================================================
-- 3. SCHEMA — services (refactorizar tabla existente)
-- =========================================================================

-- 3a. Eliminar columnas obsoletas (idempotente)
ALTER TABLE services DROP COLUMN IF EXISTS category;
ALTER TABLE services DROP COLUMN IF EXISTS requires_transfer;
ALTER TABLE services DROP COLUMN IF EXISTS price_estimate;
ALTER TABLE services DROP COLUMN IF EXISTS metadata;

-- 3b. Añadir columnas nuevas
ALTER TABLE services ADD COLUMN IF NOT EXISTS slug                           text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS description                    text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_min_cents                integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_max_cents                integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS requires_fasting               boolean NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS requires_specific_vet_user_id  uuid REFERENCES clinic_users(id);
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_surgery                     boolean NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS escalates_for_pricing          boolean NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS sort_order                     integer NOT NULL DEFAULT 0;

-- 3c. Ajustar default de duration_minutes a 25
ALTER TABLE services ALTER COLUMN duration_minutes SET DEFAULT 25;

-- 3d. Backfill slugs nulos (seguridad — no debería haber filas tras el DELETE)
UPDATE services SET slug = 'legacy_' || id WHERE slug IS NULL;

-- 3e. Hacer slug NOT NULL
ALTER TABLE services ALTER COLUMN slug SET NOT NULL;

-- 3f. UNIQUE constraint
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_clinic_id_slug_key;
ALTER TABLE services ADD CONSTRAINT services_clinic_id_slug_key UNIQUE (clinic_id, slug);

-- 3g. Índice de servicios activos
CREATE INDEX IF NOT EXISTS idx_services_active ON services(active) WHERE active = true;

-- 3h. Nuevas políticas RLS (reemplazan las antiguas)
DROP POLICY IF EXISTS services_member_read ON services;
DROP POLICY IF EXISTS services_admin_write ON services;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'services_select' AND tablename = 'services'
  ) THEN
    CREATE POLICY services_select ON services FOR SELECT
      USING (clinic_id IN (SELECT user_clinic_ids()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'services_admin_insert' AND tablename = 'services'
  ) THEN
    CREATE POLICY services_admin_insert ON services FOR INSERT
      WITH CHECK (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'services_admin_update' AND tablename = 'services'
  ) THEN
    CREATE POLICY services_admin_update ON services FOR UPDATE
      USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]))
      WITH CHECK (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'services_admin_delete' AND tablename = 'services'
  ) THEN
    CREATE POLICY services_admin_delete ON services FOR DELETE
      USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;
END $$;


-- =========================================================================
-- 4. SCHEMA — vet_consultation_hours (tabla nueva)
-- =========================================================================

CREATE TABLE IF NOT EXISTS vet_consultation_hours (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  vet_user_id   uuid NOT NULL REFERENCES clinic_users(id) ON DELETE CASCADE,
  day_of_week   smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vet_user_id, day_of_week, start_time),
  CHECK (start_time < end_time)
);

-- 4a. Trigger set_updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_vet_consultation_hours'
      AND tgrelid = 'vet_consultation_hours'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_vet_consultation_hours
      BEFORE UPDATE ON vet_consultation_hours
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 4b. Índices
CREATE INDEX IF NOT EXISTS idx_vet_consultation_hours_clinic_id
  ON vet_consultation_hours(clinic_id);

CREATE INDEX IF NOT EXISTS idx_vet_consultation_hours_vet_user_id
  ON vet_consultation_hours(vet_user_id);

-- 4c. RLS
ALTER TABLE vet_consultation_hours ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'vet_consultation_hours_select'
      AND tablename = 'vet_consultation_hours'
  ) THEN
    CREATE POLICY vet_consultation_hours_select ON vet_consultation_hours FOR SELECT
      USING (clinic_id IN (SELECT user_clinic_ids()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'vet_consultation_hours_admin_insert'
      AND tablename = 'vet_consultation_hours'
  ) THEN
    CREATE POLICY vet_consultation_hours_admin_insert ON vet_consultation_hours FOR INSERT
      WITH CHECK (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'vet_consultation_hours_admin_update'
      AND tablename = 'vet_consultation_hours'
  ) THEN
    CREATE POLICY vet_consultation_hours_admin_update ON vet_consultation_hours FOR UPDATE
      USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]))
      WITH CHECK (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'vet_consultation_hours_admin_delete'
      AND tablename = 'vet_consultation_hours'
  ) THEN
    CREATE POLICY vet_consultation_hours_admin_delete ON vet_consultation_hours FOR DELETE
      USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;
END $$;


-- =========================================================================
-- 5. SEED — Datos reales del Hospital Veterinario Dr. Patino
-- =========================================================================

-- 5a. Actualizar datos de la clínica
UPDATE clinics SET
  name                 = 'Hospital Veterinario Dr. Patino',
  legal_name           = 'VET. PATINO, S.L.',
  tax_id               = 'B55708507',
  email                = 'hvpatino@hotmail.com',
  phone                = '+34 977 235 779',
  address_street       = 'Avenida Cardenal Vidal i Barraquer 34',
  address_city         = 'Tarragona',
  address_postal_code  = '43005',
  address_country      = 'ES'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 5b. Actualizar usuarios existentes (Marc admin, Samuel Test vet)
UPDATE clinic_users SET staff_type = 'admin'
WHERE user_id = '08bf4193-ccbc-46e1-8421-4c14a202e43c';

UPDATE clinic_users SET staff_type = 'vet'
WHERE clinic_id = '00000000-0000-0000-0000-000000000001'
  AND user_id IS NOT NULL
  AND user_id != '08bf4193-ccbc-46e1-8421-4c14a202e43c';

-- 5c. Veterinarios (SIN user_id — no tienen cuenta de login todavía)
INSERT INTO clinic_users
  (id, clinic_id, user_id, role, display_name, email, staff_type,
   specialty_primary, specialty_secondary)
VALUES
  ('00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001', NULL,
   'admin', 'Samuel Patino', 'samuel@iatope.com', 'vet',
   'Cirugía', ARRAY['Traumatología', 'Neurología', 'Oftalmología']),

  ('00000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000001', NULL,
   'veterinario', 'María Pascual', 'maria@iatope.com', 'vet',
   'Dermatología', ARRAY['TAC', 'Medicina general']),

  ('00000000-0000-0000-0000-000000000013',
   '00000000-0000-0000-0000-000000000001', NULL,
   'veterinario', 'Esteve Basora', 'esteve@iatope.com', 'vet',
   'Anestesiología', ARRAY['Cardiología', 'Medicina general']),

  ('00000000-0000-0000-0000-000000000014',
   '00000000-0000-0000-0000-000000000001', NULL,
   'veterinario', 'Elisabeth Menasanch', 'elisabeth@iatope.com', 'vet',
   'Medicina general', ARRAY['Ecografía', 'ADNS canino']),

  ('00000000-0000-0000-0000-000000000015',
   '00000000-0000-0000-0000-000000000001', NULL,
   'veterinario', 'Fernando Moreno', 'fernando@iatope.com', 'vet',
   'Medicina general', ARRAY['Laboratorio', 'ADNS canino'])
ON CONFLICT (id) DO NOTHING;

-- 5d. ATVs (auxiliares técnicos veterinarios)
INSERT INTO clinic_users
  (id, clinic_id, user_id, role, display_name, staff_type)
VALUES
  ('00000000-0000-0000-0000-000000000021',
   '00000000-0000-0000-0000-000000000001', NULL,
   'recepcion', 'Eva', 'atv'),
  ('00000000-0000-0000-0000-000000000022',
   '00000000-0000-0000-0000-000000000001', NULL,
   'recepcion', 'Katy', 'atv'),
  ('00000000-0000-0000-0000-000000000023',
   '00000000-0000-0000-0000-000000000001', NULL,
   'recepcion', 'Sune', 'atv'),
  ('00000000-0000-0000-0000-000000000024',
   '00000000-0000-0000-0000-000000000001', NULL,
   'recepcion', 'Carmen', 'atv')
ON CONFLICT (id) DO NOTHING;

-- 5e. Recepción
INSERT INTO clinic_users
  (id, clinic_id, user_id, role, display_name, staff_type)
VALUES
  ('00000000-0000-0000-0000-000000000031',
   '00000000-0000-0000-0000-000000000001', NULL,
   'recepcion', 'Mariano', 'reception'),
  ('00000000-0000-0000-0000-000000000032',
   '00000000-0000-0000-0000-000000000001', NULL,
   'recepcion', 'Gina', 'reception'),
  ('00000000-0000-0000-0000-000000000033',
   '00000000-0000-0000-0000-000000000001', NULL,
   'recepcion', 'Chelo', 'reception'),
  ('00000000-0000-0000-0000-000000000034',
   '00000000-0000-0000-0000-000000000001', NULL,
   'recepcion', 'Eli', 'reception')
ON CONFLICT (id) DO NOTHING;


-- =========================================================================
-- 6. SEED — Horarios de consulta
-- =========================================================================
-- day_of_week: 0=domingo, 1=lunes … 5=viernes, 6=sábado
-- Solo L-V (1-5). Sin sábados ni domingos.
-- Total: 10 + 10 + 5 + 5 + 5 = 35 rows.
-- =========================================================================

-- Samuel Patino (000...011): L-V 08:30-09:00 + L-V 16:30-18:45
INSERT INTO vet_consultation_hours
  (clinic_id, vet_user_id, day_of_week, start_time, end_time)
SELECT '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000011',
       d, '08:30'::time, '09:00'::time
FROM generate_series(1, 5) AS d
ON CONFLICT (vet_user_id, day_of_week, start_time) DO NOTHING;

INSERT INTO vet_consultation_hours
  (clinic_id, vet_user_id, day_of_week, start_time, end_time)
SELECT '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000011',
       d, '16:30'::time, '18:45'::time
FROM generate_series(1, 5) AS d
ON CONFLICT (vet_user_id, day_of_week, start_time) DO NOTHING;

-- María Pascual (000...012): L-V 08:30-09:00 + L-V 16:30-18:45
INSERT INTO vet_consultation_hours
  (clinic_id, vet_user_id, day_of_week, start_time, end_time)
SELECT '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000012',
       d, '08:30'::time, '09:00'::time
FROM generate_series(1, 5) AS d
ON CONFLICT (vet_user_id, day_of_week, start_time) DO NOTHING;

INSERT INTO vet_consultation_hours
  (clinic_id, vet_user_id, day_of_week, start_time, end_time)
SELECT '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000012',
       d, '16:30'::time, '18:45'::time
FROM generate_series(1, 5) AS d
ON CONFLICT (vet_user_id, day_of_week, start_time) DO NOTHING;

-- Esteve Basora (000...013): L-V 08:30-10:00
INSERT INTO vet_consultation_hours
  (clinic_id, vet_user_id, day_of_week, start_time, end_time)
SELECT '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000013',
       d, '08:30'::time, '10:00'::time
FROM generate_series(1, 5) AS d
ON CONFLICT (vet_user_id, day_of_week, start_time) DO NOTHING;

-- Elisabeth Menasanch (000...014): L-V 09:30-13:00
INSERT INTO vet_consultation_hours
  (clinic_id, vet_user_id, day_of_week, start_time, end_time)
SELECT '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000014',
       d, '09:30'::time, '13:00'::time
FROM generate_series(1, 5) AS d
ON CONFLICT (vet_user_id, day_of_week, start_time) DO NOTHING;

-- Fernando Moreno (000...015): L-V 11:00-14:30
INSERT INTO vet_consultation_hours
  (clinic_id, vet_user_id, day_of_week, start_time, end_time)
SELECT '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000015',
       d, '11:00'::time, '14:30'::time
FROM generate_series(1, 5) AS d
ON CONFLICT (vet_user_id, day_of_week, start_time) DO NOTHING;


-- =========================================================================
-- 7. SEED — Catálogo de servicios (37 servicios)
-- =========================================================================
-- sort_order: 10-70 Grupo A, 110-150 Grupo B, 210-230 Grupo C,
--             310-420 Grupo D, 510-520 Grupo E, 610 Grupo F,
--             710-760 Grupo G, 810 Grupo H.
-- Precios en céntimos (5000 = 50.00 €).
-- duration_minutes por defecto = 25. Solo se especifica si ≠ 25.
-- =========================================================================

-- GRUPO A — Consultas y vacunas (25 min)
INSERT INTO services
  (clinic_id, name, slug, description, price_min_cents, price_max_cents,
   duration_minutes, requires_fasting, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Consulta general', 'consulta_general',
   'Consulta veterinaria general con exploración física completa.',
   5000, NULL, 25, false, 10),

  ('00000000-0000-0000-0000-000000000001',
   'Vacuna anual perro', 'vacuna_anual_perro',
   'Vacunación anual completa para perros (polivalente + rabia). El precio varía según peso y estado de salud.',
   4000, 7000, 25, false, 20),

  ('00000000-0000-0000-0000-000000000001',
   'Vacuna anual gato', 'vacuna_anual_gato',
   'Vacunación anual completa para gatos (trivalente + rabia). El precio varía según peso y estado de salud.',
   4000, 5500, 25, false, 30),

  ('00000000-0000-0000-0000-000000000001',
   'Vacuna rabia', 'vacuna_rabia',
   'Vacuna monovalente contra la rabia.',
   4000, NULL, 25, false, 40),

  ('00000000-0000-0000-0000-000000000001',
   'Vacuna leishmania', 'vacuna_leishmania',
   'Vacuna contra la leishmaniosis canina.',
   7000, NULL, 25, false, 50),

  ('00000000-0000-0000-0000-000000000001',
   'Revisión cachorro / primovacunación', 'revision_cachorro',
   'Revisión completa del cachorro y primeras vacunas según calendario.',
   5000, NULL, 25, false, 60),

  ('00000000-0000-0000-0000-000000000001',
   'Visita', 'visita',
   'Visita de seguimiento o consulta puntual.',
   5000, NULL, 25, false, 70)
ON CONFLICT (clinic_id, slug) DO NOTHING;

-- GRUPO B — Tratamientos rápidos (10 min)
INSERT INTO services
  (clinic_id, name, slug, price_min_cents, price_max_cents,
   duration_minutes, requires_fasting, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Inyectables', 'inyectables',
   1500, 2000, 10, false, 110),

  ('00000000-0000-0000-0000-000000000001',
   'Convenia (antibiótico)', 'convenia',
   3000, NULL, 10, false, 120),

  ('00000000-0000-0000-0000-000000000001',
   'Depo', 'depo',
   3000, NULL, 10, false, 130),

  ('00000000-0000-0000-0000-000000000001',
   'Solensia', 'solensia',
   8000, NULL, 10, false, 140),

  ('00000000-0000-0000-0000-000000000001',
   'Librela', 'librela',
   9000, NULL, 10, false, 150)
ON CONFLICT (clinic_id, slug) DO NOTHING;

-- GRUPO C — Desparasitaciones y trámites cortos (5 min)
INSERT INTO services
  (clinic_id, name, slug, price_min_cents, price_max_cents,
   duration_minutes, requires_fasting, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Desparasitación interna', 'desparasitacion_interna',
   700, 800, 5, false, 210),

  ('00000000-0000-0000-0000-000000000001',
   'Desparasitación externa', 'desparasitacion_externa',
   1300, 5000, 5, false, 220),

  ('00000000-0000-0000-0000-000000000001',
   'Cartilla', 'cartilla',
   600, NULL, 5, false, 230)
ON CONFLICT (clinic_id, slug) DO NOTHING;

-- GRUPO D — Pruebas diagnósticas (25 min, salvo curva_glucosa 60 min)
INSERT INTO services
  (clinic_id, name, slug, price_min_cents,
   duration_minutes, requires_fasting, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Análisis de sangre', 'analisis_sangre', 7000,
   25, false, 310),

  ('00000000-0000-0000-0000-000000000001',
   'Radiografía', 'radiografia', 7000,
   25, false, 320),

  ('00000000-0000-0000-0000-000000000001',
   'Microchip', 'microchip', 5600,
   25, false, 330),

  ('00000000-0000-0000-0000-000000000001',
   'Pasaporte europeo', 'pasaporte_europeo', 5600,
   25, false, 340),

  ('00000000-0000-0000-0000-000000000001',
   'Cambio de nombre', 'cambio_nombre_microchip', 4000,
   25, false, 350),

  ('00000000-0000-0000-0000-000000000001',
   'Citologías', 'citologias', 3000,
   25, false, 360),

  ('00000000-0000-0000-0000-000000000001',
   'Test coronavirus/parvovirus/leishmania', 'test_panel', 4500,
   25, false, 370),

  ('00000000-0000-0000-0000-000000000001',
   'Serología leishmania', 'serologia_leishmania', 8000,
   25, false, 380),

  ('00000000-0000-0000-0000-000000000001',
   'Tiroides', 'tiroides', 6000,
   25, false, 390),

  ('00000000-0000-0000-0000-000000000001',
   'Fenobarbital', 'fenobarbital', 8000,
   25, false, 400),

  ('00000000-0000-0000-0000-000000000001',
   'Fructosamina', 'fructosamina', 7000,
   25, false, 410),

  ('00000000-0000-0000-0000-000000000001',
   'Curva de glucosa', 'curva_glucosa', 12000,
   60, false, 420)
ON CONFLICT (clinic_id, slug) DO NOTHING;

-- GRUPO E — Ecografías (specialty-specific)
INSERT INTO services
  (clinic_id, name, slug, price_min_cents, duration_minutes,
   requires_specific_vet_user_id, requires_fasting, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Ecografía', 'ecografia', 8000, 30,
   '00000000-0000-0000-0000-000000000014', -- Elisabeth Menasanch
   false, 510),

  ('00000000-0000-0000-0000-000000000001',
   'Ecocardiografía', 'ecocardiografia', 12000, 45,
   '00000000-0000-0000-0000-000000000013', -- Esteve Basora
   false, 520)
ON CONFLICT (clinic_id, slug) DO NOTHING;

-- GRUPO F — Revisiones especiales
INSERT INTO services
  (clinic_id, name, slug, price_min_cents, duration_minutes,
   requires_fasting, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Revisión geriátrica completa', 'revision_geriatrica', 22000, 30,
   false, 610)
ON CONFLICT (clinic_id, slug) DO NOTHING;

-- GRUPO G — CIRUGÍAS (Samuel Patino, 240 min, requieren ayuno)
INSERT INTO services
  (clinic_id, name, slug, description,
   price_min_cents, price_max_cents, duration_minutes,
   requires_fasting, requires_specific_vet_user_id,
   is_surgery, escalates_for_pricing, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Limpieza dental', 'limpieza_dental',
   'Limpieza dental completa bajo anestesia general.',
   22000, NULL, 240,
   true, '00000000-0000-0000-0000-000000000011',
   true, false, 710),

  ('00000000-0000-0000-0000-000000000001',
   'Castración perro macho', 'castracion_perro_macho',
   'Castración de perro macho. El precio varía según peso.',
   28000, 38000, 240,
   true, '00000000-0000-0000-0000-000000000011',
   true, true, 720),

  ('00000000-0000-0000-0000-000000000001',
   'Castración perra hembra', 'castracion_perra_hembra',
   'Castración de perra hembra. El precio varía según peso y tamaño.',
   46000, 60000, 240,
   true, '00000000-0000-0000-0000-000000000011',
   true, true, 730),

  ('00000000-0000-0000-0000-000000000001',
   'Castración gato macho', 'castracion_gato_macho',
   'Castración de gato macho.',
   13000, NULL, 240,
   true, '00000000-0000-0000-0000-000000000011',
   true, false, 740),

  ('00000000-0000-0000-0000-000000000001',
   'Castración gata hembra', 'castracion_gata_hembra',
   'Castración de gata hembra.',
   26000, NULL, 240,
   true, '00000000-0000-0000-0000-000000000011',
   true, false, 750),

  ('00000000-0000-0000-0000-000000000001',
   'Esterilización de gata', 'esterilizacion_gata',
   'Esterilización de gata (ligadura de trompas).',
   26000, NULL, 240,
   true, '00000000-0000-0000-0000-000000000011',
   true, false, 760)
ON CONFLICT (clinic_id, slug) DO NOTHING;

-- GRUPO H — Otros
INSERT INTO services
  (clinic_id, name, slug, price_min_cents, duration_minutes,
   requires_fasting, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Sondaje', 'sondaje', 18000, 30,
   false, 810)
ON CONFLICT (clinic_id, slug) DO NOTHING;


-- =========================================================================
-- 8. Actualizar services_catalog_ids en clinic_config
-- =========================================================================
UPDATE clinic_config
SET config = jsonb_set(
  config,
  '{services_catalog_ids}',
  (
    SELECT to_jsonb(array_agg(id::text))
    FROM services
    WHERE clinic_id = '00000000-0000-0000-0000-000000000001'
      AND active = true
  )
)
WHERE clinic_id = '00000000-0000-0000-0000-000000000001';


COMMIT;
