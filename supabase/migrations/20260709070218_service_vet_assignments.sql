-- ---------------------------------------------------------------------------
-- service_vet_assignments — N:M relationship between services and vets
--
-- Expresses "which vets can perform which service". Coexists with
-- services.requires_specific_vet_user_id which acts as a hard override
-- (checkAvailability respects the override first, then falls back to
-- this table, then falls back to all clinic vets).
-- ---------------------------------------------------------------------------

-- 1. Table
CREATE TABLE IF NOT EXISTS service_vet_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  vet_user_id uuid NOT NULL REFERENCES clinic_users(id) ON DELETE CASCADE,
  clinic_id   uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, vet_user_id)
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_service_vet_assignments_service_id
  ON service_vet_assignments(service_id);

CREATE INDEX IF NOT EXISTS idx_service_vet_assignments_vet_user_id
  ON service_vet_assignments(vet_user_id);

CREATE INDEX IF NOT EXISTS idx_service_vet_assignments_clinic_id
  ON service_vet_assignments(clinic_id);

-- 3. RLS
ALTER TABLE service_vet_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT: members of the clinic can read assignments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'service_vet_assignments_select'
      AND tablename = 'service_vet_assignments'
  ) THEN
    CREATE POLICY service_vet_assignments_select ON service_vet_assignments
      FOR SELECT
      USING (clinic_id IN (SELECT user_clinic_ids()));
  END IF;

  -- INSERT: admin-only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'service_vet_assignments_admin_insert'
      AND tablename = 'service_vet_assignments'
  ) THEN
    CREATE POLICY service_vet_assignments_admin_insert ON service_vet_assignments
      FOR INSERT
      WITH CHECK (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;

  -- UPDATE: admin-only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'service_vet_assignments_admin_update'
      AND tablename = 'service_vet_assignments'
  ) THEN
    CREATE POLICY service_vet_assignments_admin_update ON service_vet_assignments
      FOR UPDATE
      USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]))
      WITH CHECK (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;

  -- DELETE: admin-only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'service_vet_assignments_admin_delete'
      AND tablename = 'service_vet_assignments'
  ) THEN
    CREATE POLICY service_vet_assignments_admin_delete ON service_vet_assignments
      FOR DELETE
      USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));
  END IF;
END $$;
