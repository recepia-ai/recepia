-- =========================================================================
-- Fix — vault_create_secret returns uuid directly, not a record
-- =========================================================================
-- Supabase Vault's create_secret() returns a uuid scalar, not a record
-- with .id field. The original wrapper used `SELECT ... INTO v_result`
-- and tried to access `v_result.id`, which fails with:
--   "record 'v_result' has no field 'id'"
--
-- This migration replaces the wrapper with the correct implementation:
-- assign the return value directly to a uuid variable.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.vault_create_secret(
  p_secret      text,
  p_name        text DEFAULT NULL,
  p_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := vault.create_secret(p_secret, p_name, p_description);
  RETURN v_id;
END;
$$;

-- Permissions remain unchanged (already set in the original migration,
-- but re-applied here for safety — CREATE OR REPLACE preserves grants).
REVOKE ALL ON FUNCTION public.vault_create_secret(text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) TO service_role;
