-- =========================================================================
-- GestorVet coexistence foundation
-- =========================================================================
-- Recepia and GestorVet will coexist during the clinic transition. This
-- migration generalizes Vault-backed integrations and adds:
--   * stable local <-> external identifiers;
--   * a durable transactional outbox;
--   * sync-run audit records;
--   * automatic enqueueing for clients, pets and appointments.
--
-- No network request is made from PostgreSQL. A server-side worker claims and
-- processes outbox rows. Unsupported GestorVet mutations are recorded as
-- blocked reconciliation work instead of being silently discarded.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. Generalize clinic_integrations for non-OAuth providers
-- -------------------------------------------------------------------------

ALTER TABLE clinic_integrations
  ALTER COLUMN token_expires_at DROP NOT NULL;

ALTER TABLE clinic_integrations
  DROP CONSTRAINT IF EXISTS clinic_integrations_provider_check;

ALTER TABLE clinic_integrations
  ADD CONSTRAINT clinic_integrations_provider_check
  CHECK (provider IN ('google_calendar', 'gestorvet'));

ALTER TABLE clinic_integrations
  DROP CONSTRAINT IF EXISTS clinic_integrations_provider_token_check;

ALTER TABLE clinic_integrations
  ADD CONSTRAINT clinic_integrations_provider_token_check
  CHECK (
    provider <> 'google_calendar'
    OR token_expires_at IS NOT NULL
  );

COMMENT ON COLUMN clinic_integrations.metadata IS
  'Non-secret provider configuration. GestorVet credentials live only in Vault.';

-- -------------------------------------------------------------------------
-- 2. Local <-> external identifier registry
-- -------------------------------------------------------------------------

CREATE TABLE integration_external_links (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  provider           text NOT NULL,
  entity_type        text NOT NULL,
  local_id           uuid,
  external_id        text NOT NULL,
  external_parent_id text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_external_links_provider_check
    CHECK (provider IN ('gestorvet')),
  CONSTRAINT integration_external_links_entity_type_check
    CHECK (entity_type IN (
      'client', 'pet', 'appointment', 'clinic_user', 'service',
      'species', 'breed', 'consultation_reason', 'center', 'location'
    )),
  UNIQUE (clinic_id, provider, entity_type, external_id)
);

CREATE UNIQUE INDEX integration_external_links_local_unique
  ON integration_external_links (clinic_id, provider, entity_type, local_id)
  WHERE local_id IS NOT NULL;

CREATE INDEX integration_external_links_lookup_idx
  ON integration_external_links (clinic_id, provider, entity_type, local_id, external_id);

CREATE TRIGGER set_updated_at_integration_external_links
  BEFORE UPDATE ON integration_external_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE integration_external_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_external_links_admin_read
  ON integration_external_links FOR SELECT
  USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));

-- -------------------------------------------------------------------------
-- 3. Durable integration outbox
-- -------------------------------------------------------------------------

CREATE TABLE integration_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  operation       text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'pending',
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at       timestamptz,
  locked_by       text,
  last_error      text,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_outbox_provider_check
    CHECK (provider IN ('gestorvet')),
  CONSTRAINT integration_outbox_entity_type_check
    CHECK (entity_type IN ('client', 'pet', 'appointment')),
  CONSTRAINT integration_outbox_operation_check
    CHECK (operation IN ('create', 'update', 'reconcile_update', 'reconcile_cancel')),
  CONSTRAINT integration_outbox_status_check
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'blocked')),
  CONSTRAINT integration_outbox_attempts_check
    CHECK (attempts >= 0)
);

CREATE UNIQUE INDEX integration_outbox_pending_unique
  ON integration_outbox (clinic_id, provider, entity_type, entity_id, operation)
  WHERE status = 'pending';

CREATE INDEX integration_outbox_claim_idx
  ON integration_outbox (provider, status, next_attempt_at, created_at);

CREATE INDEX integration_outbox_entity_idx
  ON integration_outbox (clinic_id, entity_type, entity_id, created_at DESC);

CREATE TRIGGER set_updated_at_integration_outbox
  BEFORE UPDATE ON integration_outbox
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE integration_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_outbox_admin_read
  ON integration_outbox FOR SELECT
  USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));

-- -------------------------------------------------------------------------
-- 4. Pull/import audit trail
-- -------------------------------------------------------------------------

CREATE TABLE integration_sync_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  provider       text NOT NULL,
  direction      text NOT NULL,
  resource       text NOT NULL,
  status         text NOT NULL DEFAULT 'running',
  cursor         jsonb NOT NULL DEFAULT '{}'::jsonb,
  records_read   integer NOT NULL DEFAULT 0,
  records_created integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_skipped integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  error_summary  text,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_sync_runs_provider_check
    CHECK (provider IN ('gestorvet')),
  CONSTRAINT integration_sync_runs_direction_check
    CHECK (direction IN ('pull', 'push', 'reconcile')),
  CONSTRAINT integration_sync_runs_status_check
    CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
  CONSTRAINT integration_sync_runs_counts_check
    CHECK (
      records_read >= 0 AND records_created >= 0 AND records_updated >= 0
      AND records_skipped >= 0 AND records_failed >= 0
    )
);

CREATE INDEX integration_sync_runs_clinic_idx
  ON integration_sync_runs (clinic_id, provider, started_at DESC);

ALTER TABLE integration_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_sync_runs_admin_read
  ON integration_sync_runs FOR SELECT
  USING (user_has_role_in_clinic(clinic_id, ARRAY['admin']::clinic_user_role[]));

-- -------------------------------------------------------------------------
-- 5. Atomic outbox claim for the service-role worker
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_integration_outbox(
  p_provider text,
  p_worker_id text,
  p_limit integer DEFAULT 25
)
RETURNS SETOF integration_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_provider <> 'gestorvet' THEN
    RAISE EXCEPTION 'Unsupported integration provider';
  END IF;

  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 100';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM integration_outbox
    WHERE provider = p_provider
      AND attempts < 10
      AND EXISTS (
        SELECT 1
        FROM clinic_integrations AS integrations
        WHERE integrations.clinic_id = integration_outbox.clinic_id
          AND integrations.provider = p_provider
          AND COALESCE((integrations.metadata->>'sync_enabled')::boolean, false)
      )
      AND (
        (status IN ('pending', 'failed') AND next_attempt_at <= now())
        OR (status = 'processing' AND locked_at < now() - interval '15 minutes')
      )
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE integration_outbox AS jobs
  SET status = 'processing',
      attempts = jobs.attempts + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      last_error = NULL
  FROM candidates
  WHERE jobs.id = candidates.id
  RETURNING jobs.*;
END;
$$;

REVOKE ALL ON FUNCTION claim_integration_outbox(text, text, integer)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_integration_outbox(text, text, integer)
  TO service_role;

-- -------------------------------------------------------------------------
-- 6. Automatic enqueueing
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enqueue_gestorvet_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_entity_type text;
  v_operation text;
  v_status text := 'pending';
  v_has_external_id boolean;
BEGIN
  v_clinic_id := NEW.clinic_id;

  IF NOT EXISTS (
    SELECT 1
    FROM clinic_integrations
    WHERE clinic_id = v_clinic_id
      AND provider = 'gestorvet'
      AND COALESCE((metadata->>'sync_enabled')::boolean, false)
  ) THEN
    RETURN NEW;
  END IF;

  v_has_external_id := NULLIF(
    NEW.metadata #>> '{integrations,gestorvet,external_id}',
    ''
  ) IS NOT NULL;

  IF TG_TABLE_NAME = 'clients' THEN
    v_entity_type := 'client';
    IF TG_OP = 'INSERT' AND v_has_external_id THEN
      RETURN NEW;
    END IF;
    v_operation := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;

  ELSIF TG_TABLE_NAME = 'pets' THEN
    v_entity_type := 'pet';
    IF TG_OP = 'INSERT' AND v_has_external_id THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
      v_operation := 'create';
    ELSE
      v_operation := 'reconcile_update';
      v_status := 'blocked';
    END IF;

  ELSIF TG_TABLE_NAME = 'appointments' THEN
    v_entity_type := 'appointment';
    IF TG_OP = 'INSERT' AND v_has_external_id THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
      v_operation := 'create';
    ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
      v_operation := 'reconcile_cancel';
      v_status := 'blocked';
    ELSE
      v_operation := 'reconcile_update';
      v_status := 'blocked';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO integration_outbox (
    clinic_id, provider, entity_type, entity_id, operation, status,
    last_error
  ) VALUES (
    v_clinic_id, 'gestorvet', v_entity_type, NEW.id, v_operation, v_status,
    CASE WHEN v_status = 'blocked'
      THEN 'GestorVet API manual does not document this mutation'
      ELSE NULL
    END
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_enqueue_gestorvet
  AFTER INSERT OR UPDATE OF name, phone, email, notes, metadata, deleted_at
  ON clients
  FOR EACH ROW EXECUTE FUNCTION enqueue_gestorvet_change();

CREATE TRIGGER pets_enqueue_gestorvet
  AFTER INSERT OR UPDATE OF client_id, name, species, breed, birth_date, sex,
    microchip, notes, metadata, active, deleted_at, weight_kg
  ON pets
  FOR EACH ROW EXECUTE FUNCTION enqueue_gestorvet_change();

CREATE TRIGGER appointments_enqueue_gestorvet
  AFTER INSERT OR UPDATE OF client_id, pet_id, vet_user_id, service_id,
    starts_at, ends_at, status, notes, cancellation_reason, metadata
  ON appointments
  FOR EACH ROW EXECUTE FUNCTION enqueue_gestorvet_change();

COMMENT ON TABLE integration_outbox IS
  'Transactional integration work. blocked rows require manual reconciliation or a newly supported provider operation.';

COMMIT;
