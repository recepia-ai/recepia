-- =====================================================================
-- Recepia — Migración: Settings, equipo e invitaciones
-- Archivo: supabase/migrations/20260623120000_settings_and_team.sql
-- =====================================================================
-- Añade columnas a clinics y clinic_users, crea tabla de invitaciones.
-- Idempotente: usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- =====================================================================

-- -------------------------------------------------------------------
-- 1. Clinics — columnas de datos comerciales y fiscales
-- -------------------------------------------------------------------
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS legal_name          TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tax_id              TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS email               TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS phone               TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS address_street      TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS address_city        TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS address_postal_code TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS address_country     TEXT DEFAULT 'ES';

-- -------------------------------------------------------------------
-- 2. clinic_users — columnas de identidad e invitación
-- -------------------------------------------------------------------
ALTER TABLE clinic_users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE clinic_users ADD COLUMN IF NOT EXISTS email         TEXT;
ALTER TABLE clinic_users ADD COLUMN IF NOT EXISTS invited_at    TIMESTAMPTZ;
ALTER TABLE clinic_users ADD COLUMN IF NOT EXISTS invited_by    UUID REFERENCES auth.users(id);

-- clinic_users no tenía updated_at en el esquema inicial.
ALTER TABLE clinic_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Trigger para mantener updated_at (mismo patrón que el resto de tablas).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_clinic_users'
      AND tgrelid = 'clinic_users'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_clinic_users
      BEFORE UPDATE ON clinic_users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END
$$;

-- -------------------------------------------------------------------
-- 3. Nueva tabla: clinic_invitations
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinic_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         clinic_user_role NOT NULL DEFAULT 'recepcion',
  display_name TEXT,
  token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  invited_by   UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clinic_invitations_clinic_id
  ON clinic_invitations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_invitations_email
  ON clinic_invitations(email);
CREATE INDEX IF NOT EXISTS idx_clinic_invitations_token
  ON clinic_invitations(token) WHERE status = 'pending';

-- Trigger updated_at (mismo patrón).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_clinic_invitations'
      AND tgrelid = 'clinic_invitations'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_clinic_invitations
      BEFORE UPDATE ON clinic_invitations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END
$$;

ALTER TABLE clinic_invitations ENABLE ROW LEVEL SECURITY;

-- Solo admins de la clínica gestionan invitaciones.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'clinic_invitations_admin_all'
      AND tablename = 'clinic_invitations'
  ) THEN
    CREATE POLICY "clinic_invitations_admin_all" ON clinic_invitations
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM clinic_users
          WHERE clinic_users.clinic_id = clinic_invitations.clinic_id
            AND clinic_users.user_id = auth.uid()
            AND clinic_users.role = 'admin'
        )
      );
  END IF;
END $$;

-- -------------------------------------------------------------------
-- 4. Backfill datos existentes
-- -------------------------------------------------------------------

-- Dr. Patino — datos reales ya conocidos
UPDATE clinics
SET
  legal_name          = 'VET. PATINO, S.L.',
  address_street      = 'AV. Cardenal Vidal i Barraquer núm. 34 bajos',
  address_postal_code = '43005',
  address_city        = 'Tarragona',
  address_country     = 'ES'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Admin actual (Marc) — display_name y email para equipo y perfil
UPDATE clinic_users
SET
  display_name = 'Marc Soler',
  email        = 'marcsolerroldan85@gmail.com'
WHERE user_id = '08bf4193-ccbc-46e1-8421-4c14a202e43c';
