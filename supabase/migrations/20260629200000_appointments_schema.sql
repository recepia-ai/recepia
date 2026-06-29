-- =========================================================================
-- E5.6 — Appointments, Clients, Pets schema refinements
-- =========================================================================
-- Refina las tablas clients, pets y appointments existentes para alinearlas
-- con los requisitos del agente IA (E3): nuevos campos, CHECKs, índices y RLS.
--
-- Las tablas ya existen (creadas en initial_schema). Esta migración es
-- idempotente: usa ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS, etc.
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. CLIENTS — refinements
-- =========================================================================

-- 1a. Rename full_name → name (or add name if full_name doesn't exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE clients RENAME COLUMN full_name TO name;
  END IF;
END $$;

-- 1b. Fallback: add name column if still missing
ALTER TABLE clients ADD COLUMN IF NOT EXISTS name text;

-- 1c. Make name NOT NULL (backfill empty names first)
UPDATE clients SET name = 'Sin nombre' WHERE name IS NULL;
ALTER TABLE clients ALTER COLUMN name SET NOT NULL;

-- 1d. Phone CHECK constraint (E.164 format)
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_phone_check;
ALTER TABLE clients ADD CONSTRAINT clients_phone_check
  CHECK (phone ~ '^\+[1-9][0-9]{1,14}$');

-- 1e. UNIQUE constraint for (clinic_id, phone)
--     The existing partial unique index clients_clinic_phone_unique only
--     enforces uniqueness WHERE deleted_at IS NULL. We add a full constraint.
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_clinic_id_phone_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clients_clinic_id_phone_key'
      AND conrelid = 'clients'::regclass
  ) THEN
    -- Drop the old partial index first
    DROP INDEX IF EXISTS clients_clinic_phone_unique;
    ALTER TABLE clients
      ADD CONSTRAINT clients_clinic_id_phone_key UNIQUE (clinic_id, phone);
  END IF;
END $$;

-- 1f. idx_clients_phone (fast lookup by phone when a WhatsApp message arrives)
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);

-- =========================================================================
-- 2. PETS — refinements
-- =========================================================================

-- 2a. Add weight_kg
ALTER TABLE pets ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2);

-- 2b. Rename chip_number → microchip
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pets' AND column_name = 'chip_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pets' AND column_name = 'microchip'
  ) THEN
    ALTER TABLE pets RENAME COLUMN chip_number TO microchip;
  END IF;
END $$;

-- 2c. Fallback: add microchip if still missing
ALTER TABLE pets ADD COLUMN IF NOT EXISTS microchip text;

-- 2d. Change species from pet_species enum to text with CHECK (dog/cat only)
--     Drop dependent views first (CASCADE handles the dependency)
DROP VIEW IF EXISTS v_today_appointments;

--     First, drop the default if any
ALTER TABLE pets ALTER COLUMN species DROP DEFAULT;

--     Convert enum → text
ALTER TABLE pets
  ALTER COLUMN species TYPE text USING species::text;

--     Sanitize: any species not in the new CHECK → 'other' (non-blocking).
--     Once the app supports more species we can widen the CHECK.
UPDATE pets SET species = 'other' WHERE species NOT IN ('dog', 'cat');

--     Add CHECK constraint
ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_species_check;
ALTER TABLE pets ADD CONSTRAINT pets_species_check
  CHECK (species IN ('dog', 'cat'));

-- 2e. Drop sex column (replaced by pet_sex enum → not needed per spec)
--     We keep it for backward compat but make it nullable.
ALTER TABLE pets ALTER COLUMN sex DROP NOT NULL;

-- 2f. Update RLS for pets (also support JOIN path via clients for agents)
DROP POLICY IF EXISTS pets_member_read ON pets;
DROP POLICY IF EXISTS pets_member_write ON pets;

CREATE POLICY pets_member_read ON pets FOR SELECT
  USING (
    clinic_id IN (SELECT user_clinic_ids())
    OR client_id IN (
      SELECT id FROM clients WHERE clinic_id IN (SELECT user_clinic_ids())
    )
  );

CREATE POLICY pets_member_write ON pets FOR ALL
  USING (
    clinic_id IN (SELECT user_clinic_ids())
    OR client_id IN (
      SELECT id FROM clients WHERE clinic_id IN (SELECT user_clinic_ids())
    )
  )
  WITH CHECK (
    clinic_id IN (SELECT user_clinic_ids())
    OR client_id IN (
      SELECT id FROM clients WHERE clinic_id IN (SELECT user_clinic_ids())
    )
  );

-- 2g. idx_pets_client_id
CREATE INDEX IF NOT EXISTS idx_pets_client_id ON pets(client_id);

-- =========================================================================
-- 3. APPOINTMENTS — refinements
-- =========================================================================

-- 3a. Add missing columns
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS vet_user_id uuid REFERENCES clinic_users(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_calendar_id text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT 'agent';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES clinic_users(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- 3b. Migrate external_calendar_event_id → google_event_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'external_calendar_event_id'
  ) THEN
    -- Copy over any existing data
    UPDATE appointments
      SET google_event_id = external_calendar_event_id
      WHERE google_event_id IS NULL AND external_calendar_event_id IS NOT NULL;
    ALTER TABLE appointments DROP COLUMN external_calendar_event_id;
  END IF;
END $$;

-- 3c. Change status from appointment_status enum to text
--     Drop dependent objects first
DROP INDEX IF EXISTS appointments_clinic_id_starts_at_idx;

--     Add a temporary text column, migrate data, then swap
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status_new text;

--     Copy data (cast enum to text)
UPDATE appointments SET status_new = status::text WHERE status_new IS NULL;

--     Map 'scheduled' → 'confirmed' (old enum value no longer in CHECK)
UPDATE appointments SET status_new = 'confirmed' WHERE status_new = 'scheduled';

--     Drop the old column and rename
ALTER TABLE appointments DROP COLUMN status;
ALTER TABLE appointments RENAME COLUMN status_new TO status;

--     Set NOT NULL and default
ALTER TABLE appointments ALTER COLUMN status SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN status SET DEFAULT 'confirmed';

--     Add CHECK constraint
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('confirmed', 'cancelled', 'no_show', 'completed'));

-- 3d. CHECK: ends_at > starts_at
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_ends_at_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_ends_at_check
  CHECK (ends_at > starts_at);

-- 3e. CHECK: cancellation_reason required when status='cancelled'
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_cancellation_reason_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_cancellation_reason_check
  CHECK (
    (status = 'cancelled' AND cancellation_reason IS NOT NULL)
    OR (status != 'cancelled')
  );

-- 3f. CHECK: created_by must be one of the allowed values
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_created_by_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_created_by_check
  CHECK (created_by IN ('agent', 'admin', 'reception'));

-- 3g. New indices
CREATE INDEX IF NOT EXISTS idx_appointments_vet_user_id ON appointments(vet_user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

--     Recreate the partial index that was dropped in 3c (now with text status)
CREATE INDEX IF NOT EXISTS appointments_clinic_id_starts_at_idx
  ON appointments(clinic_id, starts_at)
  WHERE status IN ('confirmed');

-- =========================================================================
-- 4. UPDATE VIEW v_today_appointments
-- =========================================================================

CREATE OR REPLACE VIEW v_today_appointments AS
SELECT
  a.*,
  c.name AS client_name,
  c.phone AS client_phone,
  p.name AS pet_name,
  p.species AS pet_species,
  s.name AS service_name
FROM appointments a
LEFT JOIN clients c ON c.id = a.client_id
LEFT JOIN pets p ON p.id = a.pet_id
LEFT JOIN services s ON s.id = a.service_id
WHERE a.starts_at::date = current_date
  AND a.status IN ('confirmed');

-- =========================================================================
-- 5. CLEANUP — drop unused enum types
-- =========================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    DROP TYPE appointment_status;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pet_species') THEN
    DROP TYPE pet_species;
  END IF;

  -- pet_sex is still used by pets.sex column — keep it
END $$;

COMMIT;
