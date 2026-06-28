-- =========================================================================
-- Recepia — Vault wrapper functions for service_role access
-- =========================================================================
-- Supabase Vault functions live in the `vault` schema, which is not directly
-- callable via supabase.rpc() from the client (even with SERVICE_ROLE_KEY).
-- These SECURITY DEFINER wrappers expose them in the `public` schema, locked
-- to service_role only.
-- =========================================================================

-- -------------------------------------------------------------------
-- 1. vault_create_secret — wrapper for vault.create_secret
-- -------------------------------------------------------------------
-- Returns the new secret's UUID.
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
  v_result record;
BEGIN
  SELECT vault.create_secret(p_secret, p_name, p_description) INTO v_result;
  RETURN v_result.id;
END;
$$;

-- -------------------------------------------------------------------
-- 2. vault_update_secret — wrapper for vault.update_secret
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vault_update_secret(
  p_id          uuid,
  p_secret      text,
  p_name        text DEFAULT NULL,
  p_description text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
BEGIN
  PERFORM vault.update_secret(p_id, p_secret, p_name, p_description);
END;
$$;

-- -------------------------------------------------------------------
-- 3. vault_delete_secret — DELETE directly from vault.secrets
--    (Vault has no built-in delete_secret function)
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vault_delete_secret(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = p_id;
  RETURN FOUND;
END;
$$;

-- -------------------------------------------------------------------
-- 4. vault_read_secret — returns the decrypted value of a secret
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vault_read_secret(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = p_id;
  RETURN v_secret;
END;
$$;

-- -------------------------------------------------------------------
-- Permissions: only service_role can execute
-- -------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.vault_create_secret(text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.vault_update_secret(uuid, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_update_secret(uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.vault_delete_secret(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_delete_secret(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.vault_read_secret(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_read_secret(uuid) TO service_role;
