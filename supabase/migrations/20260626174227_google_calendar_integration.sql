-- =========================================================================
-- E5.1 — Google Calendar Integration Schema
-- =========================================================================
-- Añade soporte para integraciones OAuth con Google Calendar usando
-- Supabase Vault para encriptar tokens, y la tabla vet_calendars para
-- mapear veterinarios a calendarios de Google.
-- =========================================================================

-- -------------------------------------------------------------------
-- 1. HABILITAR VAULT (si no está ya habilitado)
-- -------------------------------------------------------------------
-- Supabase Vault está disponible en todos los planes (Free incluido).
-- Encripta secrets en disco, backups y replicación. Solo se desencriptan
-- on-the-fly al consultar vault.decrypted_secrets.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault'
  ) THEN
    CREATE EXTENSION supabase_vault CASCADE;
  END IF;
END $$;

-- -------------------------------------------------------------------
-- 2. REFACTOR clinic_integrations — reemplazar columnas legacy
--    por el nuevo diseño Vault-based
-- -------------------------------------------------------------------

-- 2a. Eliminar la constraint UNIQUE antigua (usa el enum integration_type)
ALTER TABLE clinic_integrations
  DROP CONSTRAINT IF EXISTS clinic_integrations_clinic_id_integration_type_key;

-- 2b. Eliminar columnas obsoletas (solo si existen — idempotente)
--     integration_type (enum) → reemplazado por provider (text)
--     credentials (jsonb)    → reemplazado por vault_secret_id (uuid)
--     config (jsonb)         → no necesario en el nuevo diseño
--     status (enum)          → no necesario (Vault gestiona ciclo de vida)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinic_integrations' AND column_name = 'integration_type'
  ) THEN
    ALTER TABLE clinic_integrations DROP COLUMN integration_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinic_integrations' AND column_name = 'credentials'
  ) THEN
    ALTER TABLE clinic_integrations DROP COLUMN credentials;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinic_integrations' AND column_name = 'config'
  ) THEN
    ALTER TABLE clinic_integrations DROP COLUMN config;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinic_integrations' AND column_name = 'status'
  ) THEN
    ALTER TABLE clinic_integrations DROP COLUMN status;
  END IF;
END $$;

-- 2c. Añadir columnas nuevas
ALTER TABLE clinic_integrations
  ADD COLUMN IF NOT EXISTS provider                text NOT NULL DEFAULT 'google_calendar',
  ADD COLUMN IF NOT EXISTS vault_secret_id        uuid,
  ADD COLUMN IF NOT EXISTS token_expires_at       timestamptz,
  ADD COLUMN IF NOT EXISTS scope                  text,
  ADD COLUMN IF NOT EXISTS external_account_email text,
  ADD COLUMN IF NOT EXISTS metadata               jsonb NOT NULL DEFAULT '{}'::jsonb;

-- El default 'google_calendar' solo es para migrar filas existentes (si las hay).
-- Para filas nuevas, la aplicación siempre debe especificar provider.
-- Lo quitamos una vez aplicada la migración:
ALTER TABLE clinic_integrations
  ALTER COLUMN provider DROP DEFAULT;

-- 2d. Restaurar UNIQUE constraint con provider (text)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clinic_integrations_clinic_id_provider_key'
      AND conrelid = 'clinic_integrations'::regclass
  ) THEN
    ALTER TABLE clinic_integrations
      ADD CONSTRAINT clinic_integrations_clinic_id_provider_key
      UNIQUE (clinic_id, provider);
  END IF;
END $$;

-- 2e. CHECK constraint para provider (solo google_calendar por ahora)
ALTER TABLE clinic_integrations
  DROP CONSTRAINT IF EXISTS clinic_integrations_provider_check;

ALTER TABLE clinic_integrations
  ADD CONSTRAINT clinic_integrations_provider_check
  CHECK (provider IN ('google_calendar'));

-- 2f. NOT NULL en vault_secret_id y token_expires_at (para nuevas filas)
--     Usamos DO block para hacerlos opcionales durante la migración
DO $$
BEGIN
  ALTER TABLE clinic_integrations ALTER COLUMN vault_secret_id SET NOT NULL;
EXCEPTION
  WHEN not_null_violation THEN
    RAISE NOTICE 'vault_secret_id tiene NULLs — corrige manualmente o elimina las filas legacy';
END $$;

DO $$
BEGIN
  ALTER TABLE clinic_integrations ALTER COLUMN token_expires_at SET NOT NULL;
EXCEPTION
  WHEN not_null_violation THEN
    RAISE NOTICE 'token_expires_at tiene NULLs — corrige manualmente o elimina las filas legacy';
END $$;

-- -------------------------------------------------------------------
-- 3. DROP RLS policies legacy de clinic_integrations
--    (las reemplazamos con admin-only más estrictas)
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS clinic_integrations_read ON clinic_integrations;
DROP POLICY IF EXISTS clinic_integrations_admin_write ON clinic_integrations;

-- -------------------------------------------------------------------
-- 4. NUEVAS RLS policies — clinic_integrations (admin-only)
-- -------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'clinic_integrations_admin_select'
      AND tablename = 'clinic_integrations'
  ) THEN
    CREATE POLICY clinic_integrations_admin_select ON clinic_integrations
      FOR SELECT
      USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'clinic_integrations_admin_insert'
      AND tablename = 'clinic_integrations'
  ) THEN
    CREATE POLICY clinic_integrations_admin_insert ON clinic_integrations
      FOR INSERT
      WITH CHECK (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'clinic_integrations_admin_update'
      AND tablename = 'clinic_integrations'
  ) THEN
    CREATE POLICY clinic_integrations_admin_update ON clinic_integrations
      FOR UPDATE
      USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]))
      WITH CHECK (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'clinic_integrations_admin_delete'
      AND tablename = 'clinic_integrations'
  ) THEN
    CREATE POLICY clinic_integrations_admin_delete ON clinic_integrations
      FOR DELETE
      USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;
END $$;

-- -------------------------------------------------------------------
-- 5. TABLA vet_calendars
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vet_calendars (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  vet_user_id         uuid NOT NULL REFERENCES clinic_users(id) ON DELETE CASCADE,
  google_calendar_id  text NOT NULL,
  calendar_summary    text,
  sync_enabled        boolean NOT NULL DEFAULT true,
  last_synced_at      timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, vet_user_id)
);

-- 5a. Trigger set_updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_vet_calendars'
      AND tgrelid = 'vet_calendars'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_vet_calendars
      BEFORE UPDATE ON vet_calendars
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 5b. Índices
CREATE INDEX IF NOT EXISTS idx_vet_calendars_clinic_id
  ON vet_calendars(clinic_id);

CREATE INDEX IF NOT EXISTS idx_vet_calendars_vet_user_id
  ON vet_calendars(vet_user_id);

-- 5c. RLS
ALTER TABLE vet_calendars ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT: admin ve todos; miembros ven su propio calendario
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'vet_calendars_select'
      AND tablename = 'vet_calendars'
  ) THEN
    CREATE POLICY vet_calendars_select ON vet_calendars
      FOR SELECT
      USING (
        user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[])
        OR vet_user_id IN (
          SELECT id FROM clinic_users WHERE user_id = auth.uid()
        )
      );
  END IF;

  -- INSERT: admin-only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'vet_calendars_admin_insert'
      AND tablename = 'vet_calendars'
  ) THEN
    CREATE POLICY vet_calendars_admin_insert ON vet_calendars
      FOR INSERT
      WITH CHECK (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;

  -- UPDATE: admin-only (IMPORTANTE: sin esta policy, los updates fallan
  --         silenciosamente con 0 rows affected)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'vet_calendars_admin_update'
      AND tablename = 'vet_calendars'
  ) THEN
    CREATE POLICY vet_calendars_admin_update ON vet_calendars
      FOR UPDATE
      USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]))
      WITH CHECK (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;

  -- DELETE: admin-only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'vet_calendars_admin_delete'
      AND tablename = 'vet_calendars'
  ) THEN
    CREATE POLICY vet_calendars_admin_delete ON vet_calendars
      FOR DELETE
      USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;
END $$;

-- -------------------------------------------------------------------
-- 6. LIMPIEZA — eliminar tipos enum obsoletos (solo si ya no se usan)
-- -------------------------------------------------------------------
-- integration_type e integration_status solo los usaba clinic_integrations,
-- que ahora usa provider (text). Si otras tablas futuras los necesitaran,
-- se recrean. Por ahora los eliminamos para mantener el schema limpio.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'integration_type'
  ) THEN
    DROP TYPE integration_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'integration_status'
  ) THEN
    DROP TYPE integration_status;
  END IF;
END $$;
