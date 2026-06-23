-- =====================================================================
-- Recepia — Migración: RLS Policies para team management y CRUD
-- Archivo: supabase/migrations/20260623200000_rls_policies_team_management.sql
-- =====================================================================
-- Audición inicial (2026-06-23):
--   clinics:        SELECT  (clinics_read)
--   clinic_users:   SELECT  (clinic_users_read)
--                   ALL     (clinic_users_admin_write, admin-only)
--   conversations:  SELECT  (conversations_member_read)
--                   UPDATE  (conversations_member_update)
-- Las helper functions user_clinic_ids() y user_has_role_in_clinic()
-- son SECURITY DEFINER → no hay riesgo de recursion.
-- =====================================================================

-- -------------------------------------------------------------------
-- 1. clinics — UPDATE (admin-only)
-- -------------------------------------------------------------------
-- Bug: /settings/clinic devolvía éxito pero no escribía porque RLS
-- solo tenía SELECT. PostgreSQL no devuelve error con UPDATE sin USING.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinics' AND policyname = 'clinics_update_admin'
  ) THEN
    CREATE POLICY "clinics_update_admin" ON clinics
      FOR UPDATE
      USING (user_has_role_in_clinic(id, ARRAY['admin'::clinic_user_role]))
      WITH CHECK (user_has_role_in_clinic(id, ARRAY['admin'::clinic_user_role]));
  END IF;
END
$$;

-- -------------------------------------------------------------------
-- 2. conversations — INSERT (cualquier clinic_users)
-- -------------------------------------------------------------------
-- conversations_member_read e _update ya existen; añadimos INSERT
-- para que el sistema de chat y el panel puedan crear conversaciones.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversations' AND policyname = 'conversations_member_insert'
  ) THEN
    CREATE POLICY "conversations_member_insert" ON conversations
      FOR INSERT
      WITH CHECK (clinic_id IN (SELECT user_clinic_ids()));
  END IF;
END
$$;

-- -------------------------------------------------------------------
-- 3. conversation_summaries — SELECT (ya existe) + INSERT
-- -------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversation_summaries' AND policyname = 'conv_summaries_member_insert'
  ) THEN
    CREATE POLICY "conv_summaries_member_insert" ON conversation_summaries
      FOR INSERT
      WITH CHECK (clinic_id IN (SELECT user_clinic_ids()));
  END IF;
END
$$;

-- -------------------------------------------------------------------
-- 4. events — INSERT
-- -------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'events' AND policyname = 'events_member_insert'
  ) THEN
    CREATE POLICY "events_member_insert" ON events
      FOR INSERT
      WITH CHECK (clinic_id IN (SELECT user_clinic_ids()));
  END IF;
END
$$;

-- -------------------------------------------------------------------
-- 5. tool_invocations — INSERT
-- -------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tool_invocations' AND policyname = 'tool_invocations_member_insert'
  ) THEN
    CREATE POLICY "tool_invocations_member_insert" ON tool_invocations
      FOR INSERT
      WITH CHECK (clinic_id IN (SELECT user_clinic_ids()));
  END IF;
END
$$;
